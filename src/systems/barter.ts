/**
 * Merchants: seeded daily stock + the barter math.
 *   buy  = base · (1.6 − 0.006·disp − 0.002·speech), floor 0.9·base
 *   sell = base · (0.4 + 0.004·disp + 0.002·speech), cap 0.85·buy
 */

import { Sfc32, seedOf, xmur3 } from '@/engine/rng';
import { itemId, type ItemId } from '@/data/ids';
import { ITEMS, itemDef, type ItemStack } from '@/data/items';
import { events } from '@/engine/events';
import type { NpcRole } from '@/gen/models/humanoid';
import { awardSkillXp } from './skills';
import { addItem, removeItem } from './inventory';
import type { Character } from './stats';
import { getDisposition } from './disposition';

export function buyPrice(base: number, disp: number, speech: number): number {
  return Math.max(Math.round(base * (1.6 - 0.006 * disp - 0.002 * speech)), Math.round(base * 0.9), 1);
}

export function sellPrice(base: number, disp: number, speech: number): number {
  const raw = Math.round(base * (0.4 + 0.004 * disp + 0.002 * speech));
  return Math.max(1, Math.min(raw, Math.round(buyPrice(base, disp, speech) * 0.85)));
}

export interface MerchantState {
  stock: ItemStack[];
  gold: number;
  day: number;
}

const merchants = new Map<string, MerchantState>();

function rollStock(npcKey: string, role: NpcRole, day: number): MerchantState {
  const rng = new Sfc32(seedOf('stock', xmur3(npcKey)(), day));
  const stock: ItemStack[] = [];
  const add = (id: ItemId, n = 1): void => {
    const ex = stock.find((s) => s.id === id);
    if (ex) ex.n += n;
    else stock.push({ id, n });
  };
  const pickKind = (kind: string, maxTier: number): void => {
    const pool = ITEMS.filter((i) => i.kind === kind && (i.tier ?? 0) <= maxTier);
    if (pool.length) add((rng.pick(pool)).id);
  };

  if (role === 'trader') {
    add(itemId('torch'), rng.int(2, 5));
    add(itemId('lockpick'), rng.int(1, 4));
    add(itemId('arrow'), rng.int(20, 60));
    pickKind('weapon', 1);
    pickKind('weapon', 2);
    pickKind('armor', 1);
    pickKind('armor', 2);
    for (let i = 0; i < 3; i++) pickKind('potion', 1);
    for (let i = 0; i < 3; i++) pickKind('ingredient', 2);
    if (rng.chance(0.5)) pickKind('book', 2);
    if (rng.chance(0.3)) pickKind('clothing', 2);
    return { stock, gold: rng.int(400, 900), day };
  }
  if (role === 'innkeep') {
    add(itemId('potion-fatigue-small'), rng.int(2, 5));
    add(itemId('potion-mend-small'), rng.int(1, 3));
    for (let i = 0; i < 2; i++) pickKind('ingredient', 1);
    if (rng.chance(0.4)) pickKind('book', 1);
    return { stock, gold: rng.int(150, 350), day };
  }
  // priests trade a little mercy.
  add(itemId('potion-mend-small'), rng.int(2, 4));
  add(itemId('potion-mend'), rng.int(0, 2));
  return { stock, gold: rng.int(100, 250), day };
}

export function merchantState(npcKey: string, role: NpcRole, day: number): MerchantState {
  let m = merchants.get(npcKey);
  if (!m || m.day !== day) {
    const gold = m?.gold; // keep depleted gold within the day; restock resets it
    m = rollStock(npcKey, role, day);
    if (gold !== undefined && merchants.get(npcKey)?.day === day) m.gold = gold;
    merchants.set(npcKey, m);
  }
  return m;
}

export interface DealResult {
  ok: boolean;
  line: string;
}

export function buyFrom(c: Character, npcKey: string, role: NpcRole, day: number, id: ItemId): DealResult {
  const m = merchantState(npcKey, role, day);
  const stack = m.stock.find((s) => s.id === id);
  if (!stack) return { ok: false, line: 'Sold out.' };
  const price = buyPrice(itemDef(id).value, getDisposition(npcKey), c.skills.speechcraft);
  if (c.gold < price) return { ok: false, line: 'Your purse is lighter than your taste.' };
  c.gold -= price;
  m.gold += price;
  stack.n -= 1;
  if (stack.n <= 0) m.stock.splice(m.stock.indexOf(stack), 1);
  addItem(c, id, 1);
  awardSkillXp(c, 'speechcraft', 1);
  events.emit('char:changed', {});
  return { ok: true, line: `Bought for ${price} gold.` };
}

export function sellTo(c: Character, npcKey: string, role: NpcRole, day: number, id: ItemId): DealResult {
  const m = merchantState(npcKey, role, day);
  const def = itemDef(id);
  const price = sellPrice(def.value, getDisposition(npcKey), c.skills.speechcraft);
  if (m.gold < price) return { ok: false, line: 'They cannot afford it today.' };
  if (!removeItem(c, id, 1)) return { ok: false, line: 'You do not have that.' };
  c.gold += price;
  m.gold -= price;
  const ex = m.stock.find((s) => s.id === id);
  if (ex) ex.n += 1;
  else m.stock.push({ id, n: 1 });
  awardSkillXp(c, 'speechcraft', 1 + Math.floor(price / 20));
  events.emit('char:changed', {});
  return { ok: true, line: `Sold for ${price} gold.` };
}

export function serializeMerchants(): Record<string, MerchantState> {
  return Object.fromEntries(merchants);
}

export function restoreMerchants(data: Record<string, MerchantState>): void {
  merchants.clear();
  for (const [k, v] of Object.entries(data)) merchants.set(k, v);
}
