/** Seeded name generation — syllable tables per culture. */

import { Sfc32 } from '@/engine/rng';

export type Culture = 'karthi' | 'veldrun' | 'sutherai' | 'morchai' | 'grimmwold';

interface NameTable {
  first: readonly string[];
  mid: readonly string[];
  last: readonly string[];
  surnameFirst: readonly string[];
  surnameLast: readonly string[];
}

const TABLES: Record<Culture, NameTable> = {
  karthi: {
    first: ['Mar', 'Vel', 'Sor', 'Tal', 'Bren', 'Kas', 'Dor', 'Lis'],
    mid: ['e', 'a', 'o', 'i'],
    last: ['n', 'ra', 'th', 'la', 'ric', 'wen', 'mer', 'dan'],
    surnameFirst: ['Salt', 'Marsh', 'Grey', 'Tide', 'Reed', 'Gull', 'Brine', 'Fen'],
    surnameLast: ['wick', 'mere', 'born', 'water', 'strand', 'cole', 'ward', 'helm'],
  },
  veldrun: {
    first: ['Aze', 'Vyr', 'Sel', 'Ophe', 'Cal', 'Ner', 'Ily', 'Thal'],
    mid: ['ri', 'va', 'lo', 'my'],
    last: ['s', 'n', 'th', 'ra', 'is', 'el', 'on', 'ia'],
    surnameFirst: ['Cind', 'Ash', 'Vael', 'Mor', 'Sere', 'Lumen', 'Umbra', 'Pyre'],
    surnameLast: ['ral', 'thys', 'vane', 'imel', 'oth', 'aris', 'iel', 'umbra'],
  },
  sutherai: {
    first: ['Jun', 'Hak', 'Ome', 'Saz', 'Rin', 'Teo', 'Yas', 'Kel'],
    mid: ['a', 'u', 'o', 'e'],
    last: ['ri', 'da', 'no', 'sh', 'ka', 'ro', 'mi', 'to'],
    surnameFirst: ['Dune', 'Sun', 'Far', 'Wind', 'Salt', 'Star', 'Sand', 'Long'],
    surnameLast: ['rider', 'walker', 'song', 'reach', 'father', 'caller', 'shade', 'road'],
  },
  morchai: {
    first: ['Grul', 'Mok', 'Var', 'Drez', 'Khar', 'Bol', 'Urz', 'Shag'],
    mid: ['a', 'u', 'o', 'ga'],
    last: ['k', 'rok', 'dak', 'gar', 'mur', 'zog', 'nak', 'thur'],
    surnameFirst: ['Krag', 'Iron', 'Stone', 'Ash', 'Black', 'Deep', 'Grim', 'Ember'],
    surnameLast: ['jaw', 'fist', 'hide', 'tooth', 'brow', 'shank', 'maw', 'back'],
  },
  grimmwold: {
    first: ['Hild', 'Bjor', 'Sten', 'Ase', 'Ulf', 'Run', 'Geir', 'Sig'],
    mid: ['e', 'a', 'ny', 'ri'],
    last: ['gar', 'dis', 'mund', 'rid', 'vald', 'borg', 'stein', 'frid'],
    surnameFirst: ['Frost', 'Wold', 'Bear', 'Oak', 'Storm', 'Hearth', 'Wolf', 'North'],
    surnameLast: ['mane', 'shield', 'son', 'dottir', 'bane', 'holt', 'gard', 'horn'],
  },
};

export const CULTURES: readonly Culture[] = ['karthi', 'veldrun', 'sutherai', 'morchai', 'grimmwold'];

export function makeName(rng: Sfc32, culture: Culture): string {
  const t = TABLES[culture];
  const first = rng.pick(t.first) + (rng.chance(0.6) ? rng.pick(t.mid) : '') + rng.pick(t.last);
  const surname = rng.pick(t.surnameFirst) + rng.pick(t.surnameLast);
  return `${first} ${surname}`;
}

/** Region-appropriate culture roll (Karthi are the coastal majority). */
export function rollCulture(rng: Sfc32): Culture {
  return rng.pickWeighted(CULTURES, [0.34, 0.16, 0.16, 0.16, 0.18]);
}
