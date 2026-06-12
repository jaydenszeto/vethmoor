/** The three joinable powers of Vethmoor + their authored quest NPCs. */

export type FactionId = 'vigil' | 'conclave' | 'skarn';

export interface FactionDef {
  id: FactionId;
  name: string;
  /** Rank titles, index 0 = rank 1. */
  ranks: readonly [string, string, string, string, string];
  /** Reputation required to HOLD rank i+1 (rank 1 is granted on joining). */
  repForRank: readonly [number, number, number, number, number];
  blurb: string;
}

export const FACTIONS: readonly FactionDef[] = [
  {
    id: 'vigil',
    name: 'The Iron Vigil',
    ranks: ['Recruit', 'Warden', 'Road-Sergeant', 'Marshal', 'Iron Marshal'],
    repForRank: [0, 8, 20, 36, 58],
    blurb: 'Road-warden mercenaries. The March’s only law between town gates.',
  },
  {
    id: 'conclave',
    name: 'The Cindral Conclave',
    ranks: ['Listener', 'Scribe', 'Examiner', 'Senior Examiner', 'Magister'],
    repForRank: [0, 8, 20, 36, 58],
    blurb: 'Scholars of the volcano-dream. They measure what everyone else prays at.',
  },
  {
    id: 'skarn',
    name: 'House Skarn',
    ranks: ['Hand', 'Retainer', 'Oathman', 'Factor', 'Blood-Factor'],
    repForRank: [0, 8, 20, 36, 58],
    blurb: 'Old-blood mining house. Duskglass built it; pragmatism keeps it.',
  },
];

export const FACTION_BY_ID = new Map(FACTIONS.map((f) => [f.id, f]));

/** Authored quest NPCs — placed at fixed (no-rng) offsets in their towns. */
export interface QuestNpcDef {
  key: string;
  name: string;
  title: string;
  town: string;
  /** Mesh role for the humanoid generator. */
  meshRole: 'villager' | 'guard' | 'trader' | 'innkeep' | 'priest' | 'noble' | 'nomad';
  culture: 'karthi' | 'veldrun' | 'sutherai' | 'morchai' | 'grimmwold';
  /** Offset from town center, meters (axis-aligned, plaza-adjacent). */
  dx: number;
  dz: number;
  rotY: number;
}

export const QUEST_NPCS: readonly QuestNpcDef[] = [
  { key: 'seer', name: 'Sela Veth', title: 'the Seer', town: 'saltmere', meshRole: 'priest', culture: 'veldrun', dx: 9, dz: -9, rotY: -2.2 },
  { key: 'dren', name: 'Captain Brakka Dren', title: 'Iron Vigil Captain', town: 'vornstead', meshRole: 'guard', culture: 'morchai', dx: -10, dz: 8, rotY: 0.8 },
  { key: 'cindral', name: 'Magister Vael Cindral', title: 'Cindral Conclave', town: 'veskar', meshRole: 'priest', culture: 'veldrun', dx: 8, dz: 9, rotY: -0.7 },
  { key: 'skarn', name: 'Factor Ruvek Skarn', title: 'House Skarn', town: 'kraghold', meshRole: 'noble', culture: 'grimmwold', dx: -9, dz: -8, rotY: 2.4 },
];
