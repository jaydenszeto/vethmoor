/**
 * Dungeon registry — 15 sites. 12 procedural (theme + seed + tier), 3
 * authored (smugglers' cave, the Weeping Barrow, Undertooth). Entrance
 * positions are hand-placed near roads, coasts and POI logic so discovery
 * feels intentional. Tier drives loot + spawns (P5).
 */

import { dungeonId, type DungeonId } from './ids';

export type DungeonTheme = 'crypt' | 'mine' | 'cave' | 'ruin';

export interface DungeonDef {
  id: DungeonId;
  name: string;
  theme: DungeonTheme;
  tier: 1 | 2 | 3;
  /** Entrance position (world meters). */
  pos: readonly [number, number];
  authored?: 'smugglers' | 'barrow' | 'undertooth';
}

export const DUNGEONS: readonly DungeonDef[] = [
  // — authored —
  {
    id: dungeonId('smugglers-cave'),
    name: "Smugglers' Cave",
    theme: 'cave',
    tier: 1,
    pos: [1670, 9485],
    authored: 'smugglers',
  },
  {
    id: dungeonId('weeping-barrow'),
    name: 'The Weeping Barrow',
    theme: 'crypt',
    tier: 2,
    pos: [5150, 8870],
    authored: 'barrow',
  },
  {
    id: dungeonId('undertooth'),
    name: 'The Undertooth',
    theme: 'cave',
    tier: 3,
    pos: [6144, 5980],
    authored: 'undertooth',
  },
  // — procedural —
  { id: dungeonId('gullcliff-hollow'), name: 'Gullcliff Hollow', theme: 'cave', tier: 1, pos: [1450, 7600] },
  { id: dungeonId('fenwick-crypt'), name: 'Fenwick Crypt', theme: 'crypt', tier: 1, pos: [2900, 10300] },
  { id: dungeonId('old-margrave-mine'), name: 'Old Margrave Mine', theme: 'mine', tier: 1, pos: [2400, 5200] },
  { id: dungeonId('thornroot-warren'), name: 'Thornroot Warren', theme: 'cave', tier: 2, pos: [8700, 10100] },
  { id: dungeonId('sunken-watch'), name: 'The Sunken Watch', theme: 'ruin', tier: 2, pos: [4300, 9900] },
  { id: dungeonId('graverold-barrows'), name: 'Graverold Barrows', theme: 'crypt', tier: 2, pos: [7300, 8800] },
  { id: dungeonId('duskvein-shaft'), name: 'Duskvein Shaft', theme: 'mine', tier: 2, pos: [8950, 5950] },
  { id: dungeonId('ashfall-vault'), name: 'Ashfall Vault', theme: 'ruin', tier: 2, pos: [6500, 3800] },
  { id: dungeonId('mirewatch-ruin'), name: 'Mirewatch Ruin', theme: 'ruin', tier: 1, pos: [10300, 9600] },
  { id: dungeonId('hollow-of-teeth'), name: 'The Hollow of Teeth', theme: 'cave', tier: 3, pos: [5400, 4900] },
  { id: dungeonId('kragdeep-galleries'), name: 'Kragdeep Galleries', theme: 'mine', tier: 3, pos: [7800, 6300] },
  { id: dungeonId('choirs-descent'), name: "The Choir's Descent", theme: 'crypt', tier: 3, pos: [4200, 3300] },
];

export function dungeonByIdStr(id: string): DungeonDef | undefined {
  return DUNGEONS.find((d) => (d.id as string) === id);
}
