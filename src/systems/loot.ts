/**
 * Seeded loot tables + the world container state. A container's first open
 * rolls its contents from seedOf('loot', <stable id>); whatever the player
 * leaves persists in the runtime map and serializes into saves.
 */

import { Sfc32, seedOf, xmur3 } from '@/engine/rng';
import { itemId, type ItemId } from '@/data/ids';
import { ITEMS, type ItemStack } from '@/data/items';

// ----- table rolls ------------------------------------------------------------

function pool(kind: 'weapon' | 'armor', tier: number): ItemId[] {
  return ITEMS.filter((i) => i.kind === kind && (i.tier ?? 0) === tier).map((i) => i.id);
}

function potions(maxTier: number): ItemId[] {
  return ITEMS.filter((i) => i.kind === 'potion' && (i.tier ?? 0) <= maxTier).map((i) => i.id);
}

function ingredients(): ItemId[] {
  return ITEMS.filter((i) => i.kind === 'ingredient').map((i) => i.id);
}

function books(): ItemId[] {
  return ITEMS.filter((i) => i.kind === 'book').map((i) => i.id);
}

export function rollLoot(tag: string, seed: number): ItemStack[] {
  const rng = new Sfc32(seed);
  const out: ItemStack[] = [];
  const add = (id: ItemId, n = 1): void => {
    const ex = out.find((s) => s.id === id);
    if (ex) ex.n += n;
    else out.push({ id, n });
  };

  // tag forms: chest:boss:T, chest:tier:T, chest:home, chest:stock, chest:room
  const parts = tag.split(':');
  const isBoss = parts[1] === 'boss';
  const tier = parts[1] === 'boss' || parts[1] === 'tier' ? Number(parts[2] ?? 1) : 0;

  if (isBoss) {
    add(itemId('gold'), rng.int(40, 110) * tier);
    // Guaranteed gear at tier (sometimes one above).
    const upTier = Math.min(4, tier + (rng.chance(0.3) ? 1 : 0));
    const kind = rng.chance(0.5) ? 'weapon' : 'armor';
    const ids = pool(kind, upTier);
    if (ids.length) add(rng.pick(ids));
    if (rng.chance(0.8)) add(rng.pick(potions(tier)));
    if (rng.chance(0.5)) add(rng.pick(books()));
    if (rng.chance(0.6)) add(itemId('gem-duskglass'), rng.int(1, 2));
    if (tier >= 3 && rng.chance(0.4)) add(itemId('ingredient-void-salts'));
  } else if (tier > 0) {
    add(itemId('gold'), rng.int(8, 30) * tier);
    if (rng.chance(0.55)) {
      const kind = rng.chance(0.5) ? 'weapon' : 'armor';
      const ids = pool(kind, Math.max(0, tier - (rng.chance(0.5) ? 1 : 0)));
      if (ids.length) add(rng.pick(ids));
    }
    if (rng.chance(0.6)) add(rng.pick(potions(Math.max(0, tier - 1))));
    if (rng.chance(0.5)) add(rng.pick(ingredients()), rng.int(1, 2));
    if (rng.chance(0.15)) add(rng.pick(books()));
    if (rng.chance(0.3)) add(itemId('lockpick'), rng.int(1, 2));
  } else if (parts[1] === 'stock') {
    add(itemId('gold'), rng.int(10, 35));
    if (rng.chance(0.7)) add(rng.pick(potions(1)));
    add(rng.pick(ingredients()), rng.int(1, 3));
    if (rng.chance(0.4)) add(itemId('torch'), rng.int(1, 2));
  } else {
    // home/room: humble.
    if (rng.chance(0.8)) add(itemId('gold'), rng.int(2, 14));
    if (rng.chance(0.35)) add(rng.pick(potions(0)));
    if (rng.chance(0.3)) add(rng.pick(ingredients()));
    if (rng.chance(0.2)) add(itemId('gem-seaglass'));
    if (rng.chance(0.12)) add(rng.pick(books()));
  }
  return out;
}

// ----- container world-state ------------------------------------------------------

const containerState = new Map<string, ItemStack[]>();

/** Stable hash of an entity id string for seeding. */
function idHash(id: string): number {
  return xmur3(id)();
}

export function containerContents(entityId: string, tag: string): ItemStack[] {
  let items = containerState.get(entityId);
  if (!items) {
    items = rollLoot(tag, seedOf('loot', idHash(entityId)));
    containerState.set(entityId, items);
  }
  return items;
}

export function setContainerContents(entityId: string, items: ItemStack[]): void {
  containerState.set(entityId, items);
}

export function serializeContainers(): Record<string, ItemStack[]> {
  const out: Record<string, ItemStack[]> = {};
  for (const [k, v] of containerState) out[k] = v.map((s) => ({ ...s }));
  return out;
}

export function restoreContainers(data: Record<string, ItemStack[]>): void {
  containerState.clear();
  for (const [k, v] of Object.entries(data)) {
    containerState.set(k, v.map((s) => ({ ...s })));
  }
}

export function clearContainers(): void {
  containerState.clear();
}
