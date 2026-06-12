/**
 * Spellcasting + the active-effect engine. Buffs are queried by combat /
 * movement / render each tick (armor bonus, light, levitation, stealth).
 */

import { events } from '@/engine/events';
import { spellDef, spellCost, type SpellDef } from '@/data/spells';
import type { SpellId } from '@/data/ids';
import { clamp } from '@/engine/math';
import type { Character } from './stats';
import { awardSkillXp } from './skills';

export interface ActiveBuff {
  spell: SpellId;
  buff: 'light' | 'stoneskin' | 'skyward' | 'shroud' | 'boundblade';
  remaining: number;
  magnitude: number;
}

export class Effects {
  buffs: ActiveBuff[] = [];
  markPoint: { x: number; z: number } | null = null;

  tick(dt: number): void {
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      const b = this.buffs[i] as ActiveBuff;
      b.remaining -= dt;
      if (b.remaining <= 0) {
        this.buffs.splice(i, 1);
        events.emit('toast', { text: `${spellDef(b.spell).name} fades`, kind: 'info' });
      }
    }
  }

  private get(buff: ActiveBuff['buff']): ActiveBuff | undefined {
    return this.buffs.find((b) => b.buff === buff);
  }

  add(spell: SpellId, buff: ActiveBuff['buff'], duration: number, magnitude: number): void {
    const existing = this.get(buff);
    if (existing) {
      existing.remaining = duration;
      existing.magnitude = magnitude;
    } else {
      this.buffs.push({ spell, buff, remaining: duration, magnitude });
    }
  }

  get lightOn(): boolean {
    return this.get('light') !== undefined;
  }
  get armorBonus(): number {
    return this.get('stoneskin')?.magnitude ?? 0;
  }
  get skyward(): boolean {
    return this.get('skyward') !== undefined;
  }
  get stealthMult(): number {
    return this.get('shroud')?.magnitude ?? 1;
  }
  get boundBladeDmg(): number {
    return this.get('boundblade')?.magnitude ?? 0;
  }

  clear(): void {
    this.buffs.length = 0;
  }
}

export interface CastContext {
  c: Character;
  effects: Effects;
  /** Eye origin + forward. */
  ox: number;
  oy: number;
  oz: number;
  fx: number;
  fy: number;
  fz: number;
  fireBolt: (dmg: number, speed: number, radius: number, color: number) => void;
  /** Touch attack: damage the actor in reach (returns true if one was hit). */
  touch: (dmg: number) => boolean;
  summon: (duration: number) => void;
  teleport: (x: number, z: number) => void;
  isExterior: boolean;
  playerX: number;
  playerZ: number;
}

/** Returns true if the spell was cast (cost paid). */
export function castSpell(id: SpellId, ctx: CastContext): boolean {
  const def: SpellDef = spellDef(id);
  const c = ctx.c;
  const skill = c.skills[def.school];
  const cost = spellCost(def, skill);
  if (c.mp < cost) {
    events.emit('toast', { text: 'Not enough magicka', kind: 'warn' });
    return false;
  }

  const e = def.effect;
  if (e.kind === 'mark') {
    if (!ctx.isExterior) {
      events.emit('toast', { text: 'The fold will not take indoors', kind: 'warn' });
      return false;
    }
  } else if (e.kind === 'recall') {
    if (!ctx.effects.markPoint) {
      events.emit('toast', { text: 'No mark to recall to', kind: 'warn' });
      return false;
    }
  }

  c.mp -= cost;
  awardSkillXp(c, def.school, cost / 3);

  switch (e.kind) {
    case 'bolt':
      ctx.fireBolt(e.dmg, e.speed, e.radius, e.color);
      break;
    case 'touch':
      ctx.touch(e.dmg);
      break;
    case 'heal':
      if (e.stat === 'hp') c.hp = clamp(c.hp + e.amount, 0, c.hpMax);
      else if (e.stat === 'mp') c.mp = clamp(c.mp + e.amount, 0, c.mpMax);
      else c.fat = clamp(c.fat + e.amount, 0, c.fatMax);
      break;
    case 'buff':
      ctx.effects.add(id, e.buff, e.duration, e.magnitude);
      break;
    case 'summon':
      ctx.summon(e.duration);
      break;
    case 'mark':
      ctx.effects.markPoint = { x: ctx.playerX, z: ctx.playerZ };
      events.emit('toast', { text: 'The page is folded', kind: 'info' });
      break;
    case 'recall': {
      const m = ctx.effects.markPoint as { x: number; z: number };
      ctx.teleport(m.x, m.z);
      break;
    }
  }

  events.emit('cast:flash', { school: def.school });
  return true;
}
