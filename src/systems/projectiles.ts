/**
 * Pooled projectiles: arrows (gravity arc) and spell bolts (straight,
 * optionally AoE). Hot path allocates nothing — fixed pool, scratch vectors.
 */

import * as THREE from 'three';
import type { CollisionQuery } from '@/engine/collision';
import type { Aabb } from '@/engine/math';
import { raycastBoxes, type RayHit } from '@/engine/raycast';
import { paint, vertexColorMaterial } from '@/gen/models/primitives';
import type { EnemyActor } from '@/entities/actor';

const POOL = 28;
const ARROW_GRAVITY = 9.8;

interface Slot {
  active: boolean;
  kind: 'arrow' | 'bolt';
  hostile: boolean; // true = hurts the player
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  dmg: number;
  radius: number; // AoE radius (bolts)
  ttl: number;
  mesh: THREE.Mesh;
}

const scratchBoxes: Aabb[] = [];
const scratchHit: RayHit = { t: Infinity, box: null };

export interface ProjectileCtx {
  q: CollisionQuery;
  actors: readonly EnemyActor[];
  playerX: number;
  playerY: number;
  playerZ: number;
  hurtPlayer: (dmg: number, fromX: number, fromZ: number) => void;
  hurtActor: (a: EnemyActor, dmg: number, fromX: number, fromZ: number) => void;
  impact: (x: number, y: number, z: number, kind: 'arrow' | 'bolt') => void;
}

export class Projectiles {
  readonly group = new THREE.Group();
  private slots: Slot[] = [];

  constructor() {
    this.group.name = 'projectiles';
    const arrowGeo = paint(new THREE.ConeGeometry(0.04, 0.55, 4).toNonIndexed(), 0x8a7a5c);
    arrowGeo.rotateX(Math.PI / 2);
    const boltGeo = paint(new THREE.OctahedronGeometry(0.14, 0).toNonIndexed(), 0xffa050);
    for (let i = 0; i < POOL; i++) {
      const mesh = new THREE.Mesh(i % 2 === 0 ? boltGeo : arrowGeo, vertexColorMaterial());
      mesh.visible = false;
      this.group.add(mesh);
      this.slots.push({
        active: false,
        kind: 'bolt',
        hostile: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        dmg: 0,
        radius: 0,
        ttl: 0,
        mesh,
      });
    }
    // Re-pair meshes properly: half arrows, half bolts.
    this.slots.forEach((s, i) => {
      s.mesh.geometry = i < POOL / 2 ? boltGeo : arrowGeo;
    });
  }

  private alloc(kind: 'arrow' | 'bolt'): Slot | null {
    const start = kind === 'bolt' ? 0 : POOL / 2;
    const end = kind === 'bolt' ? POOL / 2 : POOL;
    for (let i = start; i < end; i++) {
      const s = this.slots[i] as Slot;
      if (!s.active) return s;
    }
    return null;
  }

  fire(
    kind: 'arrow' | 'bolt',
    hostile: boolean,
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    speed: number,
    dmg: number,
    radius = 0,
    color = 0xffa050,
  ): void {
    const s = this.alloc(kind);
    if (!s) return;
    const len = Math.hypot(dx, dy, dz) || 1;
    s.active = true;
    s.kind = kind;
    s.hostile = hostile;
    s.x = x;
    s.y = y;
    s.z = z;
    s.vx = (dx / len) * speed;
    s.vy = (dy / len) * speed;
    s.vz = (dz / len) * speed;
    s.dmg = dmg;
    s.radius = radius;
    s.ttl = 6;
    s.mesh.visible = true;
    if (kind === 'bolt') {
      (s.mesh.material as THREE.MeshLambertMaterial).emissive ??= new THREE.Color();
      // Shared material — tint via mesh color trick is global; acceptable: bolts share a hue.
      void color;
    }
    s.mesh.position.set(x, y, z);
  }

  tick(dt: number, ctx: ProjectileCtx): void {
    for (const s of this.slots) {
      if (!s.active) continue;
      s.ttl -= dt;
      if (s.ttl <= 0) {
        this.kill(s);
        continue;
      }
      const px = s.x;
      const py = s.y;
      const pz = s.z;
      if (s.kind === 'arrow') s.vy -= ARROW_GRAVITY * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;

      // Terrain / floor.
      if (s.y < ctx.q.heightAt(s.x, s.z)) {
        ctx.impact(px, py, pz, s.kind);
        this.explode(s, ctx);
        continue;
      }
      // Statics.
      ctx.q.aabbsNear(s.x, s.z, 1.5, scratchBoxes);
      if (raycastBoxes(px, py, pz, s.x, s.y, s.z, scratchBoxes, scratchHit)) {
        ctx.impact(s.x, s.y, s.z, s.kind);
        this.explode(s, ctx);
        continue;
      }
      // Actors (player projectiles) / player (hostile).
      if (s.hostile) {
        const dx = s.x - ctx.playerX;
        const dy = s.y - (ctx.playerY + 1.1);
        const dz = s.z - ctx.playerZ;
        if (dx * dx + dz * dz < 0.45 && Math.abs(dy) < 1.2) {
          ctx.hurtPlayer(s.dmg, px, pz);
          ctx.impact(s.x, s.y, s.z, s.kind);
          this.kill(s);
          continue;
        }
      } else {
        let hit: EnemyActor | null = null;
        for (const a of ctx.actors) {
          if (!a.alive || a.friendly) continue;
          const dx = s.x - a.body.x;
          const dz = s.z - a.body.z;
          const r = a.rig.radius + 0.18;
          if (dx * dx + dz * dz < r * r && s.y > a.body.y && s.y < a.body.y + a.rig.height + 0.3) {
            hit = a;
            break;
          }
        }
        if (hit) {
          ctx.hurtActor(hit, s.dmg, px, pz);
          ctx.impact(s.x, s.y, s.z, s.kind);
          this.explode(s, ctx, hit);
          continue;
        }
      }
      s.mesh.position.set(s.x, s.y, s.z);
      if (s.kind === 'arrow') {
        s.mesh.lookAt(s.x + s.vx, s.y + s.vy, s.z + s.vz);
      } else {
        s.mesh.rotation.y += dt * 9;
      }
    }
  }

  /** AoE on bolts with radius. */
  private explode(s: Slot, ctx: ProjectileCtx, already: EnemyActor | null = null): void {
    if (s.kind === 'bolt' && s.radius > 0) {
      if (s.hostile) {
        const d = Math.hypot(s.x - ctx.playerX, s.z - ctx.playerZ);
        if (d < s.radius) ctx.hurtPlayer(s.dmg * 0.8, s.x, s.z);
      } else {
        for (const a of ctx.actors) {
          if (!a.alive || a.friendly || a === already) continue;
          const d = Math.hypot(s.x - a.body.x, s.z - a.body.z);
          if (d < s.radius) ctx.hurtActor(a, s.dmg * 0.8, s.x, s.z);
        }
      }
    }
    this.kill(s);
  }

  private kill(s: Slot): void {
    s.active = false;
    s.mesh.visible = false;
  }
}
