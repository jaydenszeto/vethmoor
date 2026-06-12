/**
 * The item catalog. Weapons/armor are generated from material-tier tables
 * (deterministic ids like 'duskglass-sword'); consumables, clothing, books
 * and tools are hand-authored. validateItems() runs in dev boot + tests.
 */

import type { ItemId } from './ids';
import { itemId } from './ids';
import type { SkillId } from './skillsDef';

export type EquipSlot =
  | 'weapon'
  | 'head'
  | 'cuirass'
  | 'greaves'
  | 'boots'
  | 'gauntlets'
  | 'shield'
  | 'shirt'
  | 'pants'
  | 'robe'
  | 'amulet'
  | 'ring1'
  | 'ring2';

export type WeaponSkill = Extract<SkillId, 'blade' | 'blunt' | 'marksman'>;

export interface ItemDef {
  id: ItemId;
  name: string;
  kind: 'weapon' | 'armor' | 'clothing' | 'potion' | 'ingredient' | 'book' | 'tool' | 'misc';
  weight: number;
  value: number;
  weapon?: {
    skill: WeaponSkill;
    dmg: number;
    speed: number; // swings/sec
    reach: number;
    twoHanded: boolean;
    ranged: boolean;
  };
  armor?: { slot: Exclude<EquipSlot, 'weapon'>; ar: number; heavy: boolean };
  clothing?: { slot: Exclude<EquipSlot, 'weapon'> };
  potion?: { stat: 'hp' | 'mp' | 'fat'; amount: number };
  ingredient?: { effects: readonly [string, string, string, string] };
  book?: { textId: string; teaches?: SkillId };
  tier?: number; // 0..4 for loot weighting
}

// ----- material tiers ----------------------------------------------------------

export const TIERS = ['iron', 'steel', 'wyrmbronze', 'duskglass', 'voidstone'] as const;
export type Tier = (typeof TIERS)[number];

const TIER_NAME: Record<Tier, string> = {
  iron: 'Iron',
  steel: 'Steel',
  wyrmbronze: 'Wyrmbronze',
  duskglass: 'Duskglass',
  voidstone: 'Voidstone',
};

/** Damage/AR multiplier + value multiplier per tier. */
const TIER_POWER = [1, 1.35, 1.8, 2.4, 3.1];
const TIER_VALUE = [1, 2.6, 7, 18, 45];

interface WeaponBase {
  key: string;
  name: string;
  skill: WeaponSkill;
  dmg: number;
  speed: number;
  reach: number;
  twoHanded: boolean;
  weight: number;
  value: number;
}

const WEAPON_BASES: readonly WeaponBase[] = [
  { key: 'dagger', name: 'Dagger', skill: 'blade', dmg: 5, speed: 1.6, reach: 1.8, twoHanded: false, weight: 1.5, value: 12 },
  { key: 'sword', name: 'Sword', skill: 'blade', dmg: 9, speed: 1.0, reach: 2.2, twoHanded: false, weight: 4.5, value: 28 },
  { key: 'greatsword', name: 'Greatsword', skill: 'blade', dmg: 14, speed: 0.7, reach: 2.5, twoHanded: true, weight: 9, value: 55 },
  { key: 'mace', name: 'Mace', skill: 'blunt', dmg: 10, speed: 0.9, reach: 2.0, twoHanded: false, weight: 6, value: 26 },
  { key: 'warhammer', name: 'Warhammer', skill: 'blunt', dmg: 16, speed: 0.55, reach: 2.5, twoHanded: true, weight: 12, value: 60 },
  { key: 'bow', name: 'Bow', skill: 'marksman', dmg: 8, speed: 0.8, reach: 0, twoHanded: true, weight: 3, value: 35 },
];

interface ArmorBase {
  key: string;
  name: string;
  slot: Exclude<EquipSlot, 'weapon'>;
  ar: number;
  weight: number;
  value: number;
}

const ARMOR_BASES: readonly ArmorBase[] = [
  { key: 'helm', name: 'Helm', slot: 'head', ar: 8, weight: 3, value: 18 },
  { key: 'cuirass', name: 'Cuirass', slot: 'cuirass', ar: 8, weight: 11, value: 45 },
  { key: 'greaves', name: 'Greaves', slot: 'greaves', ar: 8, weight: 6, value: 26 },
  { key: 'boots', name: 'Boots', slot: 'boots', ar: 8, weight: 4, value: 16 },
  { key: 'gauntlets', name: 'Gauntlets', slot: 'gauntlets', ar: 8, weight: 2.5, value: 14 },
  { key: 'shield', name: 'Shield', slot: 'shield', ar: 10, weight: 6, value: 30 },
];

/** Heavy tiers wear iron/steel/voidstone; light tiers leather/wyrmhide/duskglass. */
const HEAVY_TIERS: readonly Tier[] = ['iron', 'steel', 'voidstone'];

const LIGHT_SETS = [
  { key: 'leather', name: 'Leather', power: 0.6, valueMult: 0.8, weightMult: 0.45 },
  { key: 'wyrmhide', name: 'Wyrmhide', power: 1.3, valueMult: 6, weightMult: 0.4 },
  { key: 'duskglass', name: 'Duskglass', power: 2.1, valueMult: 16, weightMult: 0.35 },
] as const;

// ----- catalog assembly -----------------------------------------------------------

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const items: ItemDef[] = [];

// Weapons across all 5 tiers.
TIERS.forEach((tier, ti) => {
  for (const base of WEAPON_BASES) {
    items.push({
      id: itemId(`${tier}-${base.key}`),
      name: `${TIER_NAME[tier]} ${base.name}`,
      kind: 'weapon',
      weight: base.weight,
      value: Math.round(base.value * (TIER_VALUE[ti] as number)),
      tier: ti,
      weapon: {
        skill: base.skill,
        dmg: round1(base.dmg * (TIER_POWER[ti] as number)),
        speed: base.speed,
        reach: base.reach,
        twoHanded: base.twoHanded,
        ranged: base.key === 'bow',
      },
    });
  }
});

// Heavy armor (iron/steel/voidstone).
HEAVY_TIERS.forEach((tier) => {
  const ti = TIERS.indexOf(tier);
  for (const base of ARMOR_BASES) {
    items.push({
      id: itemId(`${tier}-${base.key}`),
      name: `${TIER_NAME[tier]} ${base.name}`,
      kind: 'armor',
      weight: base.weight,
      value: Math.round(base.value * (TIER_VALUE[ti] as number)),
      tier: ti,
      armor: { slot: base.slot, ar: round1(base.ar * (TIER_POWER[ti] as number)), heavy: true },
    });
  }
});

// Light armor sets.
for (const set of LIGHT_SETS) {
  for (const base of ARMOR_BASES) {
    if (base.key === 'shield' && set.key !== 'duskglass') continue; // light shields are rare
    items.push({
      id: itemId(`${set.key}-${base.key}`),
      name: `${set.name} ${base.name}`,
      kind: 'armor',
      weight: round1(base.weight * set.weightMult),
      value: Math.round(base.value * set.valueMult),
      tier: set.key === 'leather' ? 0 : set.key === 'wyrmhide' ? 2 : 3,
      armor: { slot: base.slot, ar: round1(base.ar * set.power), heavy: false },
    });
  }
}

// Arrows (simple stackable ammo).
items.push({
  id: itemId('arrow'),
  name: 'Iron Arrow',
  kind: 'tool',
  weight: 0.1,
  value: 1,
  tier: 0,
});

// Clothing.
const CLOTHES: ReadonlyArray<[string, string, Exclude<EquipSlot, 'weapon'>, number, number]> = [
  ['shirt-rough', 'Rough Shirt', 'shirt', 1, 2],
  ['pants-rough', 'Rough Trousers', 'pants', 1, 2],
  ['shirt-fine', 'Fine Shirt', 'shirt', 1, 14],
  ['pants-fine', 'Fine Trousers', 'pants', 1, 14],
  ['robe-grey', 'Grey Robe', 'robe', 2, 10],
  ['robe-conclave', 'Conclave Robe', 'robe', 2, 60],
  ['amulet-bone', 'Bone Amulet', 'amulet', 0.2, 8],
  ['amulet-duskglass', 'Duskglass Amulet', 'amulet', 0.2, 90],
  ['ring-copper', 'Copper Ring', 'ring1', 0.1, 6],
  ['ring-silver', 'Silver Ring', 'ring1', 0.1, 25],
];
for (const [id, name, slot, weight, value] of CLOTHES) {
  items.push({ id: itemId(id), name, kind: 'clothing', weight, value, clothing: { slot }, tier: value > 20 ? 2 : 0 });
}

// Potions.
const POTIONS: ReadonlyArray<[string, string, 'hp' | 'mp' | 'fat', number, number]> = [
  ['potion-mend-small', 'Salve of Mending', 'hp', 25, 18],
  ['potion-mend', 'Draught of Mending', 'hp', 60, 55],
  ['potion-magicka-small', 'Ashen Philter', 'mp', 30, 20],
  ['potion-magicka', 'Deep Philter', 'mp', 70, 60],
  ['potion-fatigue-small', 'Roadwine', 'fat', 60, 10],
  ['potion-fatigue', 'Strider’s Roadwine', 'fat', 140, 28],
  ['potion-mend-grand', 'Grand Draught of Mending', 'hp', 130, 140],
  ['potion-magicka-grand', 'Drowned King’s Philter', 'mp', 150, 160],
];
for (const [id, name, stat, amount, value] of POTIONS) {
  items.push({
    id: itemId(id),
    name,
    kind: 'potion',
    weight: 0.5,
    value,
    potion: { stat, amount },
    tier: value > 100 ? 3 : value > 40 ? 1 : 0,
  });
}

// Ingredients (4 effects each; alchemy matches shared effects — P6).
const ING: ReadonlyArray<[string, string, string, string, string, string, number]> = [
  ['ingredient-ashcap', 'Ashcap', 'restore-mp', 'fire-resist', 'drain-fat', 'fortify-int', 4],
  ['ingredient-marsh-reed', 'Marsh Reed', 'restore-fat', 'water-breath', 'drain-hp', 'fortify-spd', 2],
  ['ingredient-spore-pod', 'Spore Pod', 'restore-hp', 'poison', 'fortify-end', 'drain-mp', 3],
  ['ingredient-gull-egg', 'Gull Egg', 'restore-fat', 'restore-hp', 'drain-mp', 'fortify-per', 2],
  ['ingredient-ember-moss', 'Ember Moss', 'fire-resist', 'restore-mp', 'light', 'drain-fat', 5],
  ['ingredient-bittercap', 'Bittercap', 'poison', 'restore-mp', 'drain-fat', 'invisibility', 6],
  ['ingredient-duskpetal', 'Duskpetal', 'fortify-int', 'light', 'restore-mp', 'drain-hp', 8],
  ['ingredient-bone-meal', 'Bone Meal', 'fortify-end', 'drain-fat', 'restore-hp', 'poison', 3],
  ['ingredient-salt-crystal', 'Salt Crystal', 'drain-hp', 'fire-resist', 'fortify-wil', 'restore-fat', 2],
  ['ingredient-shrike-feather', 'Shrike Feather', 'fortify-spd', 'drain-mp', 'restore-fat', 'light', 3],
  ['ingredient-crab-chitin', 'Crab Chitin', 'fortify-end', 'restore-hp', 'drain-spd', 'water-breath', 2],
  ['ingredient-wolf-lichen', 'Wolf Lichen', 'drain-per', 'restore-mp', 'poison', 'fortify-agi', 4],
  ['ingredient-glow-worm', 'Glow Worm', 'light', 'restore-hp', 'fortify-luc', 'drain-wil', 5],
  ['ingredient-rust-fern', 'Rust Fern', 'drain-agi', 'restore-fat', 'fire-resist', 'fortify-str', 3],
  ['ingredient-void-salts', 'Void Salts', 'restore-mp', 'fortify-wil', 'drain-hp', 'invisibility', 14],
  ['ingredient-kings-tear', "King's Tear", 'restore-hp', 'restore-mp', 'restore-fat', 'fortify-luc', 30],
];
for (const [id, name, e1, e2, e3, e4, value] of ING) {
  items.push({
    id: itemId(id),
    name,
    kind: 'ingredient',
    weight: 0.2,
    value,
    ingredient: { effects: [e1, e2, e3, e4] },
    tier: value > 10 ? 2 : 0,
  });
}

// Books (texts live in data/books.ts — P6 wires the reader).
const BOOKS: ReadonlyArray<[string, string, string, number, SkillId | undefined]> = [
  ['book-ninefold-tide', 'The Ninefold Tide', 'ninefold-tide', 35, undefined],
  ['book-pattern-of-ash', 'A Pattern of Ash', 'pattern-of-ash', 35, undefined],
  ['book-letters-saltmere', 'Letters from Saltmere', 'letters-saltmere', 20, undefined],
  ['book-blade-primer', 'The Sellsword’s Primer', 'skill-blade', 50, 'blade'],
  ['book-ward-and-shield', 'Ward and Shield', 'skill-block', 50, 'block'],
  ['book-ash-alchemy', 'Ash and Alembic', 'skill-alchemy', 50, 'alchemy'],
  ['book-veiled-flame', 'The Veiled Flame', 'skill-destruction', 50, 'destruction'],
  ['book-quiet-foot', 'The Quiet Foot', 'skill-sneak', 50, 'sneak'],
  ['book-locks-of-greyharbor', 'Locks of Greyharbor', 'skill-security', 50, 'security'],
  ['book-roadsong', 'Roadsong of the Striders', 'skill-athletics', 50, 'athletics'],
];
for (const [id, name, textId, value, teaches] of BOOKS) {
  items.push({
    id: itemId(id),
    name,
    kind: 'book',
    weight: 1,
    value,
    book: teaches ? { textId, teaches } : { textId },
    tier: 1,
  });
}

// Tools + valuables. 'gold' is the currency pseudo-item: weightless, value 1;
// pickup/loot flows convert it straight into character.gold.
items.push(
  { id: itemId('gold'), name: 'Gold', kind: 'misc', weight: 0, value: 1, tier: 0 },
  { id: itemId('lockpick'), name: 'Lockpick', kind: 'tool', weight: 0.1, value: 8, tier: 0 },
  { id: itemId('torch'), name: 'Torch', kind: 'tool', weight: 1, value: 4, tier: 0 },
  { id: itemId('gem-duskglass'), name: 'Raw Duskglass', kind: 'misc', weight: 0.3, value: 50, tier: 2 },
  { id: itemId('gem-seaglass'), name: 'Seaglass Bauble', kind: 'misc', weight: 0.2, value: 12, tier: 0 },
  { id: itemId('idol-drowned'), name: 'Drowned Idol', kind: 'misc', weight: 1.2, value: 80, tier: 2 },
  { id: itemId('vargen-tablets'), name: 'The Vargen Tablets', kind: 'misc', weight: 4, value: 0, tier: 3 },
);

export const ITEMS: readonly ItemDef[] = items;
export const ITEM_BY_ID: ReadonlyMap<ItemId, ItemDef> = new Map(items.map((i) => [i.id, i]));

export function itemDef(id: ItemId): ItemDef {
  const def = ITEM_BY_ID.get(id);
  if (!def) throw new Error(`unknown item: ${id}`);
  return def;
}

/** Dev/test invariant check: unique ids, sane numbers. */
export function validateItems(): void {
  const seen = new Set<string>();
  for (const it of ITEMS) {
    if (seen.has(it.id)) throw new Error(`duplicate item id: ${it.id}`);
    seen.add(it.id);
    if (it.weight < 0 || it.value < 0) throw new Error(`bad numbers on ${it.id}`);
  }
}

export interface ItemStack {
  id: ItemId;
  n: number;
}
