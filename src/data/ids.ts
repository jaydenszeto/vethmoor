/** Branded ID types — prevent cross-wiring content references at compile time. */

export type TownId = string & { readonly __brand: 'TownId' };
export type NpcId = string & { readonly __brand: 'NpcId' };
export type ItemId = string & { readonly __brand: 'ItemId' };
export type TopicId = string & { readonly __brand: 'TopicId' };
export type QuestId = string & { readonly __brand: 'QuestId' };
export type FactionId = string & { readonly __brand: 'FactionId' };
export type DungeonId = string & { readonly __brand: 'DungeonId' };
export type SpellId = string & { readonly __brand: 'SpellId' };
export type EnemyId = string & { readonly __brand: 'EnemyId' };
export type CellId = string & { readonly __brand: 'CellId' };
/** Stable seed-path entity id, e.g. "town:saltmere:lot3:chest0". */
export type SeedPathId = string & { readonly __brand: 'SeedPathId' };

export const townId = (s: string): TownId => s as TownId;
export const npcId = (s: string): NpcId => s as NpcId;
export const itemId = (s: string): ItemId => s as ItemId;
export const topicId = (s: string): TopicId => s as TopicId;
export const questId = (s: string): QuestId => s as QuestId;
export const factionId = (s: string): FactionId => s as FactionId;
export const dungeonId = (s: string): DungeonId => s as DungeonId;
export const spellId = (s: string): SpellId => s as SpellId;
export const enemyId = (s: string): EnemyId => s as EnemyId;
export const cellId = (s: string): CellId => s as CellId;
export const seedPathId = (s: string): SeedPathId => s as SeedPathId;

export type BiomeId =
  | 'coastalMarsh'
  | 'steppe'
  | 'fungalForest'
  | 'bittermarsh'
  | 'ashlands'
  | 'badlands';
