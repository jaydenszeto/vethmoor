/**
 * Player combat controller: melee swings with hold-to-charge, bow draw,
 * touch/projectile spellcasting. Damage model per the frozen spec:
 *   dmg = weaponDmg · charge(0.5–1) · (0.6+0.4·skill/100) · (0.75+STR/200)
 *         · (0.8+0.2·fatigueFrac), sneak ×2.5
 *   mitigation = effAR/(effAR+50), cap 75%
 */

import { events } from '@/engine/events';
import { input } from '@/engine/input';
import { itemId, type SpellId } from '@/data/ids';
import { itemDef } from '@/data/items';
import { spellDef } from '@/data/spells';
import { EYE_HEIGHT } from '@/data/world';
import type { EnemyActor } from '@/entities/actor';
import type { Player } from '@/entities/player';
import { clamp } from '@/engine/math';
import { awardSkillXp } from './skills';
import { removeItem, countItem } from './inventory';
import type { Character } from './stats';
import type { Effects } from './magic';
import { castSpell } from './magic';
import type { Projectiles } from './projectiles';
import type { SkillId } from '@/data/skillsDef';

export type CombatPose = 'idle' | 'windup' | 'swing' | 'cooldown' | 'bowdraw' | 'cast';

const FIST = { dmg: 2.5, speed: 1.3, reach: 1.9, skill: 'blade' as const };

export interface CombatCtx {
  player: Player;
  c: Character;
  actors: readonly EnemyActor[];
  projectiles: Projectiles;
  effects: Effects;
  isExterior: boolean;
  onKill: (a: EnemyActor) => void;
  playSfx: (kind: 'whoosh' | 'hit' | 'bow' | 'cast' | 'dud') => void;
  teleport: (x: number, z: number) => void;
}

export class PlayerCombat {
  pose: CombatPose = 'idle';
  poseT = 0;
  chargeT = 0;
  cooldown = 0;
  readied: SpellId | null = null;
  private hitDone = false;

  readySpell(id: SpellId | null): void {
    this.readied = id;
    events.emit('hud:spell', { name: id ? spellDef(id).name : null });
  }

  private weaponOf(ctx: CombatCtx): { dmg: number; speed: number; reach: number; skill: SkillId; ranged: boolean } {
    const bound = ctx.effects.boundBladeDmg;
    if (bound > 0) return { dmg: bound, speed: 1.1, reach: 2.2, skill: 'blade', ranged: false };
    const id = ctx.c.equipment.weapon;
    if (!id) return { ...FIST, ranged: false };
    const w = itemDef(id).weapon;
    if (!w) return { ...FIST, ranged: false };
    return { dmg: w.dmg, speed: w.speed, reach: w.reach || 2.0, skill: w.skill, ranged: w.ranged };
  }

  update(dt: number, ctx: CombatCtx): void {
    this.poseT += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const w = this.weaponOf(ctx);

    switch (this.pose) {
      case 'idle': {
        if (input.attackPressed && this.cooldown === 0) {
          if (w.ranged) {
            if (countItem(ctx.c, itemId('arrow')) > 0) {
              this.setPose('bowdraw');
              this.chargeT = 0;
            } else {
              events.emit('toast', { text: 'No arrows', kind: 'warn' });
            }
          } else {
            this.setPose('windup');
            this.chargeT = 0;
          }
        } else if (input.castPressed && this.cooldown === 0) {
          this.tryCast(ctx);
        }
        break;
      }
      case 'windup': {
        this.chargeT += dt;
        // Swing begins once the 150 ms windup has played AND the button was
        // released (or the charge maxed out).
        if (this.poseT >= 0.15 && (!input.attackHeld || this.chargeT > 1.1)) {
          this.beginSwing(ctx);
        }
        break;
      }
      case 'swing': {
        if (!this.hitDone && this.poseT > 0.04) {
          const hit = this.meleeHitTest(ctx, w.reach);
          if (hit) {
            this.hitDone = true;
            this.applyMeleeDamage(ctx, hit, w);
          }
        }
        if (this.poseT >= 0.12) {
          this.setPose('cooldown');
          this.cooldown = Math.max(0.15, 1 / w.speed - 0.27);
        }
        break;
      }
      case 'cooldown': {
        if (this.cooldown === 0) this.setPose('idle');
        break;
      }
      case 'bowdraw': {
        this.chargeT += dt;
        if (input.attackReleased || this.chargeT > 3) {
          this.fireArrow(ctx, w);
        }
        break;
      }
      case 'cast': {
        if (this.poseT >= 0.3) this.setPose('idle');
        break;
      }
    }
  }

  private setPose(p: CombatPose): void {
    this.pose = p;
    this.poseT = 0;
    if (p !== 'swing') this.hitDone = false;
  }

  private beginSwing(ctx: CombatCtx): void {
    const weight = ctx.c.equipment.weapon ? itemDef(ctx.c.equipment.weapon).weight : 0.5;
    ctx.c.fat = Math.max(0, ctx.c.fat - (4 + weight * 0.3));
    this.setPose('swing');
    ctx.playSfx('whoosh');
  }

  /** Nearest living hostile actor inside the swing cone. */
  private meleeHitTest(ctx: CombatCtx, reach: number): EnemyActor | null {
    const p = ctx.player;
    const ox = p.body.x;
    const oy = p.body.y + EYE_HEIGHT;
    const oz = p.body.z;
    const cp = Math.cos(p.pitch);
    const fx = -Math.sin(p.yaw) * cp;
    const fy = Math.sin(p.pitch);
    const fz = -Math.cos(p.yaw) * cp;

    let best: EnemyActor | null = null;
    let bestD = Infinity;
    for (const a of ctx.actors) {
      if (!a.alive || a.friendly) continue;
      const dx = a.body.x - ox;
      const dz = a.body.z - oz;
      const d = Math.hypot(dx, dz);
      if (d > reach + a.rig.radius) continue;
      // Cone check (~60°) on the horizontal plane.
      const dot = (dx / (d || 1)) * fx + (dz / (d || 1)) * fz;
      if (dot < 0.5) continue;
      // Vertical overlap — generous, in the Daggerfall spirit: anything in
      // front and in reach is fair game even if the crosshair rides high.
      const eyeHitY = oy + fy * d;
      if (eyeHitY < a.body.y - 0.7 || eyeHitY > a.body.y + a.rig.height + 1.0) continue;
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  private applyMeleeDamage(ctx: CombatCtx, target: EnemyActor, w: ReturnType<PlayerCombat['weaponOf']>): void {
    const c = ctx.c;
    const charge = clamp(0.5 + this.chargeT / 1.6, 0.5, 1.0);
    const skill = c.skills[w.skill];
    let dmg =
      w.dmg *
      charge *
      (0.6 + 0.4 * (skill / 100)) *
      (0.75 + c.attrs.str / 200) *
      (0.8 + 0.2 * (c.fat / c.fatMax));
    // Sneak attack on the unaware.
    if (ctx.player.sneaking && (target.state === 'idle' || target.state === 'wander')) {
      dmg *= 2.5;
      events.emit('toast', { text: 'Sneak attack!', kind: 'skill' });
      awardSkillXp(c, 'sneak', 4);
    }
    target.takeDamage(dmg, ctx.player.body.x, ctx.player.body.z);
    awardSkillXp(c, w.skill, 2);
    events.emit('hud:target', { name: target.def.name, frac: Math.max(0, target.hp / target.def.hp) });
    ctx.playSfx('hit');
    if (!target.alive) {
      awardSkillXp(c, w.skill, 5);
      ctx.onKill(target);
    }
  }

  private fireArrow(ctx: CombatCtx, w: ReturnType<PlayerCombat['weaponOf']>): void {
    const c = ctx.c;
    if (!removeItem(c, itemId('arrow'), 1)) {
      this.setPose('idle');
      return;
    }
    const power = clamp(this.chargeT / 0.8, 0.35, 1);
    const skill = c.skills.marksman;
    const dmg = w.dmg * power * (0.6 + 0.4 * (skill / 100)) * (0.8 + 0.2 * (c.fat / c.fatMax));
    const p = ctx.player;
    const cp = Math.cos(p.pitch);
    ctx.projectiles.fire(
      'arrow',
      false,
      p.body.x,
      p.body.y + EYE_HEIGHT - 0.1,
      p.body.z,
      -Math.sin(p.yaw) * cp,
      Math.sin(p.pitch),
      -Math.cos(p.yaw) * cp,
      35 * power,
      dmg,
    );
    awardSkillXp(c, 'marksman', 2);
    c.fat = Math.max(0, c.fat - 4);
    ctx.playSfx('bow');
    this.setPose('cooldown');
    this.cooldown = 0.45;
  }

  private tryCast(ctx: CombatCtx): void {
    if (!this.readied) {
      ctx.playSfx('dud');
      events.emit('toast', { text: 'No spell readied (use 1–8 or the spellbook)', kind: 'info' });
      return;
    }
    const p = ctx.player;
    const cp = Math.cos(p.pitch);
    const ok = castSpell(this.readied, {
      c: ctx.c,
      effects: ctx.effects,
      ox: p.body.x,
      oy: p.body.y + EYE_HEIGHT - 0.05,
      oz: p.body.z,
      fx: -Math.sin(p.yaw) * cp,
      fy: Math.sin(p.pitch),
      fz: -Math.cos(p.yaw) * cp,
      fireBolt: (dmg, speed, radius, color) => {
        ctx.projectiles.fire(
          'bolt',
          false,
          p.body.x,
          p.body.y + EYE_HEIGHT - 0.05,
          p.body.z,
          -Math.sin(p.yaw) * cp,
          Math.sin(p.pitch),
          -Math.cos(p.yaw) * cp,
          speed,
          dmg,
          radius,
          color,
        );
      },
      touch: (dmg) => {
        const hit = this.meleeHitTest(ctx, 2.3);
        if (hit) {
          hit.takeDamage(dmg, p.body.x, p.body.z);
          events.emit('hud:target', { name: hit.def.name, frac: Math.max(0, hit.hp / hit.def.hp) });
          ctx.playSfx('hit');
          if (!hit.alive) ctx.onKill(hit);
          return true;
        }
        return false;
      },
      summon: (duration) => {
        events.emit('summon:request', { duration });
      },
      teleport: ctx.teleport,
      isExterior: ctx.isExterior,
      playerX: p.body.x,
      playerZ: p.body.z,
    });
    if (ok) {
      this.setPose('cast');
      this.cooldown = 0.35;
      ctx.playSfx('cast');
    }
  }
}

import { totalArmor } from './inventory';

/** Damage arriving at the player; returns true if the blow killed them. */
export function applyPlayerDamage(
  c: Character,
  effects: Effects,
  raw: number,
  shieldEquipped: boolean,
): boolean {
  const effAR = totalArmor(c) + effects.armorBonus;
  const mitigation = Math.min(0.75, effAR / (effAR + 50));
  const dmg = raw * (1 - mitigation);
  c.hp -= dmg;
  c.fat = Math.max(0, c.fat - dmg * 0.5);
  // Skill use: armor + block.
  const cuirass = c.equipment.cuirass;
  if (cuirass) {
    const heavy = itemDef(cuirass).armor?.heavy;
    awardSkillXp(c, heavy ? 'heavyArmor' : 'lightArmor', 1.5);
  }
  if (shieldEquipped) awardSkillXp(c, 'block', 3);
  events.emit('hud:damage', { amount: dmg });
  return c.hp <= 0;
}
