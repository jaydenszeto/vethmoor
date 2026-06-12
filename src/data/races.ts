/** The five peoples of Vethmoor. */

import type { Culture } from '@/gen/names';
import type { AttrId, SkillId } from './skillsDef';

export interface RaceDef {
  id: Culture;
  name: string;
  blurb: string;
  attrs: Partial<Record<AttrId, number>>; // added to base 40
  skillBonus: Partial<Record<SkillId, number>>; // added to base 5
  magickaMult: number;
}

export const RACES: readonly RaceDef[] = [
  {
    id: 'karthi',
    name: 'Karthi',
    blurb: 'Coast-folk of the western marshes. Patient, saltworn, hard to drown.',
    attrs: { end: 10, per: 5, wil: 5 },
    skillBonus: { athletics: 10, speechcraft: 10, restoration: 5, blade: 5 },
    magickaMult: 1.25,
  },
  {
    id: 'veldrun',
    name: 'Veldrun',
    blurb: 'Ash-pale dreamers said to share blood with the volcano’s sleep. Magicka runs deep.',
    attrs: { int: 15, wil: 10, end: -5 },
    skillBonus: { destruction: 10, alteration: 10, conjuration: 10, alchemy: 5 },
    magickaMult: 1.75,
  },
  {
    id: 'sutherai',
    name: 'Sutherai',
    blurb: 'Dune-strider nomads of the steppe roads. Nothing in the March moves faster.',
    attrs: { spd: 15, agi: 10, str: -5 },
    skillBonus: { marksman: 10, sneak: 10, athletics: 5, lightArmor: 10 },
    magickaMult: 1.25,
  },
  {
    id: 'morchai',
    name: 'Morchai',
    blurb: 'Grey-green miners of the badlands holds. The mountain’s patience, the mountain’s fists.',
    attrs: { str: 15, end: 10, spd: -5, per: -5 },
    skillBonus: { blunt: 10, heavyArmor: 10, block: 10, blade: 5 },
    magickaMult: 1.0,
  },
  {
    id: 'grimmwold',
    name: 'Grimmwold',
    blurb: 'Northern hearth-clans who came for timber and stayed for the strangeness.',
    attrs: { str: 10, end: 5, wil: 5 },
    skillBonus: { blade: 10, block: 5, heavyArmor: 5, speechcraft: 5, restoration: 5 },
    magickaMult: 1.25,
  },
];

export const RACE_BY_ID: ReadonlyMap<Culture, RaceDef> = new Map(RACES.map((r) => [r.id, r]));
