/** Enemy archetypes — stats, behavior flags, loot, sounds, model params. */

import { enemyId, itemId, type EnemyId, type ItemId } from './ids';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  dmg: number;
  ar: number;
  speed: number; // m/s chase
  reach: number;
  attackCd: number; // seconds between swings
  sight: number;
  hearing: number;
  fleesBelow: number; // hp fraction, 0 = never
  flying: boolean;
  fireImmune: boolean;
  xpSkill: number; // base gold-ish threat tier for loot
  tier: 1 | 2 | 3;
  /** Corpse loot table additions (plus generic rolls). */
  drops: ReadonlyArray<{ id: ItemId; n: [number, number]; chance: number }>;
  /** Voice: base frequency for synthesized growls. */
  voice: number;
  scale: number;
}

export const ENEMIES: readonly EnemyDef[] = [
  {
    id: enemyId('marsh-crab'),
    name: 'Marsh Crab',
    hp: 18,
    dmg: 5,
    ar: 8,
    speed: 2.2,
    reach: 1.6,
    attackCd: 1.6,
    sight: 10,
    hearing: 6,
    fleesBelow: 0,
    flying: false,
    fireImmune: false,
    xpSkill: 1,
    tier: 1,
    drops: [{ id: itemId('ingredient-crab-chitin'), n: [1, 2], chance: 0.9 }],
    voice: 220,
    scale: 1,
  },
  {
    id: enemyId('giant-rat'),
    name: 'Giant Rat',
    hp: 12,
    dmg: 4,
    ar: 2,
    speed: 4.2,
    reach: 1.4,
    attackCd: 1.1,
    sight: 12,
    hearing: 10,
    fleesBelow: 0.25,
    flying: false,
    fireImmune: false,
    xpSkill: 1,
    tier: 1,
    drops: [{ id: itemId('ingredient-wolf-lichen'), n: [1, 1], chance: 0.35 }],
    voice: 600,
    scale: 1,
  },
  {
    id: enemyId('rift-shrike'),
    name: 'Rift Shrike',
    hp: 22,
    dmg: 7,
    ar: 3,
    speed: 6.5,
    reach: 1.8,
    attackCd: 2.2,
    sight: 24,
    hearing: 8,
    fleesBelow: 0.15,
    flying: true,
    fireImmune: false,
    xpSkill: 2,
    tier: 1,
    drops: [{ id: itemId('ingredient-shrike-feather'), n: [1, 3], chance: 0.95 }],
    voice: 900,
    scale: 1,
  },
  {
    id: enemyId('skeleton-warden'),
    name: 'Skeleton Warden',
    hp: 35,
    dmg: 10,
    ar: 12,
    speed: 3.4,
    reach: 2.2,
    attackCd: 1.7,
    sight: 14,
    hearing: 7,
    fleesBelow: 0,
    flying: false,
    fireImmune: false,
    xpSkill: 3,
    tier: 2,
    drops: [
      { id: itemId('ingredient-bone-meal'), n: [1, 2], chance: 0.8 },
      { id: itemId('iron-sword'), n: [1, 1], chance: 0.25 },
    ],
    voice: 140,
    scale: 1,
  },
  {
    id: enemyId('ash-risen'),
    name: 'Ash-Risen',
    hp: 45,
    dmg: 12,
    ar: 8,
    speed: 2.6,
    reach: 2.0,
    attackCd: 1.9,
    sight: 13,
    hearing: 6,
    fleesBelow: 0,
    flying: false,
    fireImmune: true,
    xpSkill: 3,
    tier: 2,
    drops: [{ id: itemId('ingredient-ashcap'), n: [1, 2], chance: 0.7 }],
    voice: 110,
    scale: 1.05,
  },
  {
    id: enemyId('bandit'),
    name: 'Bandit',
    hp: 55,
    dmg: 11,
    ar: 14,
    speed: 4.0,
    reach: 2.2,
    attackCd: 1.4,
    sight: 17,
    hearing: 9,
    fleesBelow: 0.18,
    flying: false,
    fireImmune: false,
    xpSkill: 3,
    tier: 2,
    drops: [
      { id: itemId('gold'), n: [5, 30], chance: 1 },
      { id: itemId('potion-mend-small'), n: [1, 1], chance: 0.3 },
      { id: itemId('lockpick'), n: [1, 2], chance: 0.25 },
    ],
    voice: 320,
    scale: 1,
  },
  {
    id: enemyId('fungal-shambler'),
    name: 'Fungal Shambler',
    hp: 80,
    dmg: 16,
    ar: 10,
    speed: 1.9,
    reach: 2.6,
    attackCd: 2.4,
    sight: 11,
    hearing: 5,
    fleesBelow: 0,
    flying: false,
    fireImmune: false,
    xpSkill: 4,
    tier: 3,
    drops: [
      { id: itemId('ingredient-spore-pod'), n: [2, 4], chance: 1 },
      { id: itemId('ingredient-bittercap'), n: [1, 2], chance: 0.6 },
    ],
    voice: 90,
    scale: 1.3,
  },
  {
    id: enemyId('ember-wisp'),
    name: 'Ember Wisp',
    hp: 30,
    dmg: 9, // ranged bolt
    ar: 4,
    speed: 3.6,
    reach: 14, // caster: keeps distance
    attackCd: 2.6,
    sight: 20,
    hearing: 12,
    fleesBelow: 0.3,
    flying: true,
    fireImmune: true,
    xpSkill: 3,
    tier: 2,
    drops: [
      { id: itemId('ingredient-ember-moss'), n: [1, 2], chance: 0.85 },
      { id: itemId('ingredient-void-salts'), n: [1, 1], chance: 0.25 },
    ],
    voice: 1400,
    scale: 0.8,
  },
  {
    id: enemyId('herald'),
    name: 'Herald of the Drowned King',
    hp: 350,
    dmg: 26,
    ar: 30,
    speed: 3.2,
    reach: 3.0,
    attackCd: 1.8,
    sight: 30,
    hearing: 30,
    fleesBelow: 0,
    flying: false,
    fireImmune: true,
    xpSkill: 10,
    tier: 3,
    drops: [
      { id: itemId('gold'), n: [200, 400], chance: 1 },
      { id: itemId('voidstone-sword'), n: [1, 1], chance: 1 },
      { id: itemId('ingredient-kings-tear'), n: [2, 3], chance: 1 },
    ],
    voice: 70,
    scale: 1.6,
  },
];

export const ENEMY_BY_ID: ReadonlyMap<EnemyId, EnemyDef> = new Map(ENEMIES.map((e) => [e.id, e]));

export function enemyDef(id: EnemyId): EnemyDef {
  const def = ENEMY_BY_ID.get(id);
  if (!def) throw new Error(`unknown enemy ${id}`);
  return def;
}
