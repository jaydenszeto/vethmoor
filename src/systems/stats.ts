/**
 * Character model + attribute/derived/level math. Formulas (frozen by tests):
 *   HP    = 20 + (STR+END)/2, +(2 + END/10) per level
 *   MP    = INT × racial multiplier (+ birth-stone)
 *   FAT   = STR + WIL + AGI + END
 *   speed = (3 + SPD·0.02) · (1 + Athletics·0.003)
 *   carry = STR × 4
 * Level-up: 10 major+minor skill-ups arm it; trigger on rest; pick 3
 * attributes; multiplier ×1..×5 from governed-skill-ups banked that level.
 */

import type { Culture } from '@/gen/names';
import { RACE_BY_ID } from '@/data/races';
import { CLASS_BY_ID } from '@/data/classes';
import type { ItemId } from '@/data/ids';
import type { ItemStack } from '@/data/items';
import type { EquipSlot } from '@/data/items';
import { SKILLS, type AttrId, type SkillId } from '@/data/skillsDef';
import { clamp } from '@/engine/math';

export type BirthStone = 'ember' | 'tide' | 'gale';

export const BIRTH_STONES: readonly { id: BirthStone; name: string; blurb: string }[] = [
  { id: 'ember', name: 'The Ember', blurb: '+25 magicka — the volcano dreamt of you' },
  { id: 'tide', name: 'The Tide', blurb: '+15 health — the sea gives back what it takes' },
  { id: 'gale', name: 'The Gale', blurb: '+10 Speed — the ash wind never catches you' },
];

export interface Character {
  name: string;
  race: Culture;
  clazz: string;
  stone: BirthStone;
  level: number;
  attrs: Record<AttrId, number>;
  skills: Record<SkillId, number>;
  skillXp: Record<SkillId, number>;
  major: readonly SkillId[];
  minor: readonly SkillId[];
  /** Major+minor skill-ups since last level. ≥10 arms level-up. */
  levelProgress: number;
  /** Governed-attribute skill-up bank (drives level multipliers). */
  attrUps: Record<AttrId, number>;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  fat: number;
  fatMax: number;
  gold: number;
  inventory: ItemStack[];
  equipment: Record<EquipSlot, ItemId | null>;
  spellsKnown: string[];
  hotkeys: (string | null)[];
}

const EMPTY_EQUIP: Record<EquipSlot, ItemId | null> = {
  weapon: null,
  head: null,
  cuirass: null,
  greaves: null,
  boots: null,
  gauntlets: null,
  shield: null,
  shirt: null,
  pants: null,
  robe: null,
  amulet: null,
  ring1: null,
  ring2: null,
};

export function createCharacter(
  name: string,
  race: Culture,
  classId: string,
  stone: BirthStone,
): Character {
  const raceDef = RACE_BY_ID.get(race);
  const classDef = CLASS_BY_ID.get(classId);
  if (!raceDef || !classDef) throw new Error('bad race/class');

  const attrs = {} as Record<AttrId, number>;
  for (const a of ['str', 'int', 'wil', 'agi', 'spd', 'end', 'per', 'luc'] as const) {
    attrs[a] = 40 + (raceDef.attrs[a] ?? 0);
  }
  for (const a of classDef.attrs) attrs[a] += 10;
  if (stone === 'gale') attrs.spd = clamp(attrs.spd + 10, 10, 100);

  const skills = {} as Record<SkillId, number>;
  const skillXp = {} as Record<SkillId, number>;
  for (const s of SKILLS) {
    skills[s.id] = 5 + (raceDef.skillBonus[s.id] ?? 0);
    skillXp[s.id] = 0;
  }
  for (const s of classDef.major) skills[s] += 25;
  for (const s of classDef.minor) skills[s] += 10;

  const attrUps = { str: 0, int: 0, wil: 0, agi: 0, spd: 0, end: 0, per: 0, luc: 0 };

  const c: Character = {
    name,
    race,
    clazz: classId,
    stone,
    level: 1,
    attrs,
    skills,
    skillXp,
    major: classDef.major,
    minor: classDef.minor,
    levelProgress: 0,
    attrUps,
    hp: 1,
    hpMax: 1,
    mp: 1,
    mpMax: 1,
    fat: 1,
    fatMax: 1,
    gold: classDef.starterGold,
    inventory: classDef.starterGear.map((g) => ({ id: g.id, n: g.n })),
    equipment: { ...EMPTY_EQUIP },
    spellsKnown: [...classDef.starterSpells],
    hotkeys: [
      classDef.starterSpells[0] ?? null,
      classDef.starterSpells[1] ?? null,
      classDef.starterSpells[2] ?? null,
      classDef.starterSpells[3] ?? null,
      null,
      null,
      null,
      null,
    ],
  };
  recalcDerived(c, true);
  return c;
}

export function magickaMax(c: Character): number {
  const mult = RACE_BY_ID.get(c.race)?.magickaMult ?? 1.25;
  return Math.round(c.attrs.int * mult) + (c.stone === 'ember' ? 25 : 0);
}

export function recalcDerived(c: Character, fill = false): void {
  const prevHpMax = c.hpMax;
  c.hpMax = Math.round(
    20 +
      (c.attrs.str + c.attrs.end) / 2 +
      (c.level - 1) * (2 + c.attrs.end / 10) +
      (c.stone === 'tide' ? 15 : 0),
  );
  c.mpMax = magickaMax(c);
  c.fatMax = c.attrs.str + c.attrs.wil + c.attrs.agi + c.attrs.end;
  if (fill) {
    c.hp = c.hpMax;
    c.mp = c.mpMax;
    c.fat = c.fatMax;
  } else {
    // Keep current proportions sane on max changes.
    if (c.hpMax > prevHpMax) c.hp += c.hpMax - prevHpMax;
    c.hp = clamp(c.hp, 0, c.hpMax);
    c.mp = clamp(c.mp, 0, c.mpMax);
    c.fat = clamp(c.fat, 0, c.fatMax);
  }
}

export function walkSpeed(c: Character): number {
  return (3 + c.attrs.spd * 0.02) * (1 + c.skills.athletics * 0.003);
}

export function maxCarry(c: Character): number {
  return c.attrs.str * 4;
}

/** Per-second regen; resting multiplies magicka ×20 and heals HP. */
export function regenTick(c: Character, dt: number, sprinting: boolean): void {
  if (!sprinting) {
    c.fat = clamp(c.fat + (4 + c.attrs.end * 0.05) * dt, 0, c.fatMax);
  } else {
    c.fat = clamp(c.fat - 8 * dt, 0, c.fatMax);
  }
  c.mp = clamp(c.mp + (0.1 + c.attrs.wil * 0.005) * dt, 0, c.mpMax);
}

export function levelUpReady(c: Character): boolean {
  return c.levelProgress >= 10;
}

/** Multiplier table from banked governed-skill-ups. */
export function attrMultiplier(ups: number): number {
  if (ups >= 10) return 5;
  if (ups >= 8) return 4;
  if (ups >= 5) return 3;
  if (ups >= 1) return 2;
  return 1;
}

/** Apply a level-up: player picked 3 attributes. */
export function applyLevelUp(c: Character, picks: readonly [AttrId, AttrId, AttrId]): void {
  for (const a of picks) {
    c.attrs[a] = clamp(c.attrs[a] + attrMultiplier(c.attrUps[a]), 10, 100);
  }
  c.level++;
  c.levelProgress = 0;
  for (const k of Object.keys(c.attrUps) as AttrId[]) c.attrUps[k] = 0;
  recalcDerived(c);
  c.hp = c.hpMax; // leveling at rest restores
  c.fat = c.fatMax;
}
