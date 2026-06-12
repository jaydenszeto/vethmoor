/**
 * EnemyActor — a creature with a capsule body, an AI state machine and a
 * procedurally-animated rig. Friendly actors (summons) hunt enemies instead
 * of the player.
 */

import * as THREE from 'three';
import { stepBody, type BodyState, type CollisionQuery, type MoveInput } from '@/engine/collision';
import { mix32 } from '@/engine/rng';
import { clamp } from '@/engine/math';
import { raycastBoxes, type RayHit } from '@/engine/raycast';
import type { Aabb } from '@/engine/math';
import { enemyDef, type EnemyDef } from '@/data/enemies';
import type { EnemyId } from '@/data/ids';
import { buildCreature, type CreatureRig } from '@/gen/models/creatures';

export type AiState = 'idle' | 'wander' | 'chase' | 'attack' | 'flee' | 'dead';

const moveInput: MoveInput = { ax: 0, az: 0, ay: 0, jump: false };
const losBoxes: Aabb[] = [];
const losHit: RayHit = { t: Infinity, box: null };

export interface ActorContext {
  q: CollisionQuery;
  playerX: number;
  playerY: number;
  playerZ: number;
  /** 0..1 — sneak/shroud/night makes the player harder to spot. */
  stealthFactor: number;
  /** Deal damage to the player (already rolled). */
  hurtPlayer: (dmg: number, fromX: number, fromZ: number) => void;
  /** Caster enemies launch bolts. */
  fireBolt: (x: number, y: number, z: number, tx: number, ty: number, tz: number, dmg: number) => void;
  /** Friendly targets: returns nearest hostile actor (for summons). */
  nearestEnemy: (x: number, z: number, range: number) => EnemyActor | null;
  onDeath: (a: EnemyActor) => void;
  timeS: number;
}

export class EnemyActor {
  readonly def: EnemyDef;
  readonly rig: CreatureRig;
  readonly body: BodyState;
  readonly spawnId: string;
  readonly friendly: boolean;
  /** Set by the spawn system for boss-marker spawns (quest kill triggers). */
  isBoss = false;

  hp: number;
  state: AiState = 'idle';
  private stateT = 0;
  private attackCd = 0;
  private telegraphT = 0;
  private struckThisAttack = false;
  private wanderX = 0;
  private wanderZ = 0;
  private homeX: number;
  private homeZ: number;
  private animT: number;
  private staggerT = 0;
  private lastSeenT = -999;
  yaw = 0;
  /** Summons expire. */
  ttl = Infinity;

  constructor(kind: EnemyId, x: number, z: number, q: CollisionQuery, spawnId: string, friendly = false) {
    this.def = enemyDef(kind);
    this.spawnId = spawnId;
    this.friendly = friendly;
    this.hp = this.def.hp;
    this.rig = buildCreature(kind, mix32(spawnId.length * 7349 + ((x | 0) << 8) + (z | 0)), this.def.scale);
    const y = q.heightAt(x, z);
    this.body = {
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: true,
      mode: this.def.flying ? 'levitate' : 'walk',
      landImpact: 0,
    };
    this.homeX = x;
    this.homeZ = z;
    this.animT = (x * 13 + z * 7) % 6.28;
    this.rig.group.position.set(x, y, z);
  }

  get alive(): boolean {
    return this.state !== 'dead';
  }

  takeDamage(dmg: number, fromX: number, fromZ: number): void {
    if (!this.alive) return;
    const mitigated = dmg * (1 - Math.min(0.6, this.def.ar / (this.def.ar + 50)));
    this.hp -= mitigated;
    this.staggerT = 0.25;
    // Knock back slightly.
    const dx = this.body.x - fromX;
    const dz = this.body.z - fromZ;
    const len = Math.hypot(dx, dz) || 1;
    this.body.vx += (dx / len) * 2.2;
    this.body.vz += (dz / len) * 2.2;
    if (this.state === 'idle' || this.state === 'wander') {
      this.state = 'chase';
    }
    if (this.hp <= 0) this.state = 'dead';
  }

  private canSee(ctx: ActorContext, dist: number): boolean {
    const effSight = this.def.sight * ctx.stealthFactor;
    if (dist > effSight && dist > this.def.hearing) return false;
    if (dist <= this.def.hearing) return true;
    // LOS vs static boxes.
    ctx.q.aabbsNear((this.body.x + ctx.playerX) / 2, (this.body.z + ctx.playerZ) / 2, dist / 2 + 3, losBoxes);
    return !raycastBoxes(
      this.body.x,
      this.body.y + this.rig.height * 0.7,
      this.body.z,
      ctx.playerX,
      ctx.playerY + 1.2,
      ctx.playerZ,
      losBoxes,
      losHit,
    );
  }

  update(dt: number, ctx: ActorContext): void {
    if (this.state === 'dead') {
      // Corpse settle: tip over.
      const b = this.rig.body;
      b.rotation.z = Math.min(b.rotation.z + dt * 4, Math.PI / 2);
      this.syncMesh(ctx);
      return;
    }
    this.ttl -= dt;
    if (this.ttl <= 0) {
      this.hp = 0;
      this.state = 'dead';
      ctx.onDeath(this);
      return;
    }

    this.stateT += dt;
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.staggerT = Math.max(0, this.staggerT - dt);

    // Target: player, or nearest enemy for friendlies.
    let tx = ctx.playerX;
    let ty = ctx.playerY;
    let tz = ctx.playerZ;
    let targetActor: EnemyActor | null = null;
    if (this.friendly) {
      targetActor = ctx.nearestEnemy(this.body.x, this.body.z, 26);
      if (targetActor) {
        tx = targetActor.body.x;
        ty = targetActor.body.y;
        tz = targetActor.body.z;
      }
    }
    const dist = Math.hypot(tx - this.body.x, tz - this.body.z);
    const seen = this.friendly ? targetActor !== null : this.canSee(ctx, dist);
    if (seen) this.lastSeenT = ctx.timeS;

    const fleeing = this.def.fleesBelow > 0 && this.hp < this.def.hp * this.def.fleesBelow;

    // ----- state transitions -----
    if (fleeing && this.state !== 'flee') this.state = 'flee';
    else if (this.state === 'idle') {
      if (seen && (!this.friendly || targetActor)) this.state = 'chase';
      else if (this.stateT > 2 + (mix32((this.animT * 100) | 0) % 5)) {
        this.state = 'wander';
        this.stateT = 0;
        const ang = (mix32((ctx.timeS * 31) | 0) / 4294967296) * 6.28;
        this.wanderX = this.homeX + Math.cos(ang) * 9;
        this.wanderZ = this.homeZ + Math.sin(ang) * 9;
      }
    } else if (this.state === 'wander') {
      if (seen) this.state = 'chase';
      else if (Math.hypot(this.wanderX - this.body.x, this.wanderZ - this.body.z) < 1.2 || this.stateT > 9) {
        this.state = 'idle';
        this.stateT = 0;
      }
    } else if (this.state === 'chase') {
      const leash = Math.hypot(this.body.x - this.homeX, this.body.z - this.homeZ);
      if (!this.friendly && (ctx.timeS - this.lastSeenT > 6 || leash > 60)) {
        this.state = 'wander';
        this.wanderX = this.homeX;
        this.wanderZ = this.homeZ;
        this.stateT = 0;
      } else if (dist < this.def.reach * 0.9 && this.attackCd === 0) {
        this.state = 'attack';
        this.telegraphT = 0.4;
        this.struckThisAttack = false;
      }
    } else if (this.state === 'attack') {
      this.telegraphT -= dt;
      if (this.telegraphT <= 0 && !this.struckThisAttack) {
        this.struckThisAttack = true;
        this.attackCd = this.def.attackCd;
        if (this.def.reach > 5) {
          // Caster: bolt at the target.
          ctx.fireBolt(this.body.x, this.body.y + this.rig.height * 0.7, this.body.z, tx, ty + 1.1, tz, this.def.dmg);
        } else if (dist < this.def.reach * 1.15) {
          if (this.friendly && targetActor) {
            targetActor.takeDamage(this.def.dmg, this.body.x, this.body.z);
            if (!targetActor.alive) ctx.onDeath(targetActor);
          } else if (!this.friendly) {
            ctx.hurtPlayer(this.def.dmg, this.body.x, this.body.z);
          }
        }
      }
      if (this.telegraphT < -0.2) this.state = 'chase';
    } else if (this.state === 'flee') {
      if (dist > 32 || this.hp > this.def.hp * (this.def.fleesBelow + 0.1)) {
        this.state = 'wander';
        this.stateT = 0;
      }
    }

    // ----- movement -----
    let mx = 0;
    let mz = 0;
    let speed = 0;
    if (this.staggerT > 0) {
      speed = 0;
    } else if (this.state === 'wander') {
      mx = this.wanderX - this.body.x;
      mz = this.wanderZ - this.body.z;
      speed = this.def.speed * 0.45;
    } else if (this.state === 'chase') {
      mx = tx - this.body.x;
      mz = tz - this.body.z;
      speed = this.def.speed;
      // Casters keep their distance.
      if (this.def.reach > 5 && dist < 8) {
        mx = -mx;
        mz = -mz;
      }
    } else if (this.state === 'flee') {
      mx = this.body.x - tx;
      mz = this.body.z - tz;
      speed = this.def.speed * 1.15;
    }
    const len = Math.hypot(mx, mz) || 1;
    moveInput.ax = (mx / len) * speed;
    moveInput.az = (mz / len) * speed;
    moveInput.jump = false;

    if (this.def.flying) {
      const groundY = ctx.q.heightAt(this.body.x, this.body.z);
      const hoverY = groundY + 2.6 + Math.sin(ctx.timeS * 1.7 + this.animT) * 0.4;
      const targetY = this.state === 'attack' ? ty + 0.8 : hoverY;
      moveInput.ay = clamp((targetY - this.body.y) * 2.2, -5, 5);
    } else {
      moveInput.ay = 0;
    }

    stepBody(this.body, moveInput, dt, ctx.q);

    // Face movement / target.
    if (speed > 0.01 || this.state === 'attack') {
      const fx = this.state === 'attack' ? tx - this.body.x : mx;
      const fz = this.state === 'attack' ? tz - this.body.z : mz;
      if (Math.hypot(fx, fz) > 0.01) {
        const target = Math.atan2(-fx, -fz);
        let dy = target - this.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        this.yaw += dy * Math.min(1, dt * 8);
      }
    }

    // ----- animation -----
    const moving = Math.hypot(this.body.vx, this.body.vz) > 0.3;
    if (moving) this.animT += dt * Math.hypot(this.body.vx, this.body.vz) * 1.6;
    const swing = Math.sin(this.animT * 2.4) * 0.5;
    if (this.rig.legsL) this.rig.legsL.rotation.x = moving ? swing : 0;
    if (this.rig.legsR) this.rig.legsR.rotation.x = moving ? -swing : 0;
    if (this.rig.wingL) {
      const flap = Math.sin(ctx.timeS * 9 + this.animT) * 0.7;
      this.rig.wingL.rotation.z = flap;
      (this.rig.wingR as THREE.Object3D).rotation.z = -flap;
    }
    // Attack lunge / telegraph rear-back.
    const lunge =
      this.state === 'attack'
        ? this.telegraphT > 0
          ? -0.25 * (1 - this.telegraphT / 0.4)
          : 0.4
        : 0;
    this.rig.body.position.z = lunge * -0.5;
    this.rig.body.rotation.x = lunge * 0.35;

    this.syncMesh(ctx);
  }

  private syncMesh(ctx: ActorContext): void {
    this.rig.group.position.set(this.body.x, this.body.y, this.body.z);
    this.rig.group.rotation.y = this.yaw;
    void ctx;
  }

  dispose(): void {
    this.rig.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}
