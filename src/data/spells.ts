/** The 14 spells. Cost = base · (1.5 − skill/100), floored at 40% base. */

import { spellId, type SpellId } from './ids';
import type { SkillId } from './skillsDef';

export type SpellEffect =
  | { kind: 'bolt'; dmg: number; speed: number; radius: number; color: number } // projectile (radius>0 = AoE)
  | { kind: 'touch'; dmg: number; color: number }
  | { kind: 'heal'; stat: 'hp' | 'mp' | 'fat'; amount: number }
  | { kind: 'buff'; buff: 'light' | 'stoneskin' | 'skyward' | 'shroud' | 'boundblade'; duration: number; magnitude: number }
  | { kind: 'summon'; duration: number }
  | { kind: 'mark' }
  | { kind: 'recall' };

export interface SpellDef {
  id: SpellId;
  name: string;
  school: Extract<SkillId, 'destruction' | 'restoration' | 'alteration' | 'conjuration'>;
  baseCost: number;
  effect: SpellEffect;
  blurb: string;
}

export const SPELLS: readonly SpellDef[] = [
  // Destruction
  { id: spellId('emberbolt'), name: 'Emberbolt', school: 'destruction', baseCost: 8, effect: { kind: 'bolt', dmg: 12, speed: 25, radius: 0, color: 0xff7a30 }, blurb: 'A coal of the Tooth’s anger, thrown.' },
  { id: spellId('ashlance'), name: 'Ashlance', school: 'destruction', baseCost: 18, effect: { kind: 'bolt', dmg: 26, speed: 34, radius: 0, color: 0xd9542b }, blurb: 'Faster, hotter, ruder.' },
  { id: spellId('firebloom'), name: 'Firebloom', school: 'destruction', baseCost: 30, effect: { kind: 'bolt', dmg: 20, speed: 20, radius: 4, color: 0xff9a3c }, blurb: 'It blossoms where it lands. Stand back.' },
  { id: spellId('frostgrasp'), name: 'Frostgrasp', school: 'destruction', baseCost: 14, effect: { kind: 'touch', dmg: 22, color: 0x9ccfe0 }, blurb: 'The sea-floor’s cold, lent to your palm.' },
  // Restoration
  { id: spellId('mend-wounds'), name: 'Mend Wounds', school: 'restoration', baseCost: 10, effect: { kind: 'heal', stat: 'hp', amount: 25 }, blurb: 'Knit flesh, quiet pain.' },
  { id: spellId('stamina-surge'), name: 'Stamina Surge', school: 'restoration', baseCost: 7, effect: { kind: 'heal', stat: 'fat', amount: 55 }, blurb: 'Borrowed breath, repaid never.' },
  { id: spellId('cleanse'), name: 'Cleanse', school: 'restoration', baseCost: 16, effect: { kind: 'heal', stat: 'hp', amount: 45 }, blurb: 'The Tide takes back its poisons.' },
  // Alteration
  { id: spellId('wisplight'), name: 'Wisplight', school: 'alteration', baseCost: 6, effect: { kind: 'buff', buff: 'light', duration: 90, magnitude: 1 }, blurb: 'A polite ghost with a lantern.' },
  { id: spellId('stoneskin'), name: 'Stoneskin', school: 'alteration', baseCost: 15, effect: { kind: 'buff', buff: 'stoneskin', duration: 60, magnitude: 16 }, blurb: 'Wear the March’s patience.' },
  { id: spellId('skyward'), name: 'Skyward', school: 'alteration', baseCost: 28, effect: { kind: 'buff', buff: 'skyward', duration: 20, magnitude: 1 }, blurb: 'The old levitations, frowned upon and glorious.' },
  { id: spellId('shroud'), name: 'Shroud', school: 'alteration', baseCost: 12, effect: { kind: 'buff', buff: 'shroud', duration: 25, magnitude: 0.35 }, blurb: 'Eyes slide off you like rain.' },
  // Conjuration
  { id: spellId('summon-ash-servant'), name: 'Summon Ash Servant', school: 'conjuration', baseCost: 24, effect: { kind: 'summon', duration: 30 }, blurb: 'Something that remembers having hands.' },
  { id: spellId('bound-blade'), name: 'Bound Blade', school: 'conjuration', baseCost: 16, effect: { kind: 'buff', buff: 'boundblade', duration: 60, magnitude: 15 }, blurb: 'A sword on loan from nowhere.' },
  { id: spellId('mark'), name: 'Mark', school: 'conjuration', baseCost: 10, effect: { kind: 'mark' }, blurb: 'Fold the corner of the world’s page.' },
];

// Recall completes the pair (14 total).
export const RECALL: SpellDef = {
  id: spellId('recall'),
  name: 'Recall',
  school: 'conjuration',
  baseCost: 14,
  effect: { kind: 'recall' },
  blurb: 'Return to the folded page.',
};

export const ALL_SPELLS: readonly SpellDef[] = [...SPELLS, RECALL];
export const SPELL_BY_ID: ReadonlyMap<SpellId, SpellDef> = new Map(ALL_SPELLS.map((s) => [s.id, s]));

export function spellDef(id: SpellId): SpellDef {
  const def = SPELL_BY_ID.get(id);
  if (!def) throw new Error(`unknown spell ${id}`);
  return def;
}

export function spellCost(def: SpellDef, skill: number): number {
  return Math.max(Math.round(def.baseCost * (1.5 - skill / 100)), Math.ceil(def.baseCost * 0.4));
}
