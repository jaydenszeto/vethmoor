/**
 * Inventory + equipment. Equipped items live in `equipment` (out of the
 * inventory stacks); both count toward encumbrance. Over-encumbered: no
 * sprint/jump, speed halved (enforced by Game's movement params).
 */

import { events } from '@/engine/events';
import type { ItemId } from '@/data/ids';
import { itemDef, type EquipSlot, type ItemStack } from '@/data/items';
import { clamp } from '@/engine/math';
import type { Character } from './stats';

export function addItem(c: Character, id: ItemId, n = 1): void {
  const existing = c.inventory.find((s) => s.id === id);
  if (existing) existing.n += n;
  else c.inventory.push({ id, n });
  events.emit('char:changed', {});
}

export function removeItem(c: Character, id: ItemId, n = 1): boolean {
  const idx = c.inventory.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  const stack = c.inventory[idx] as ItemStack;
  if (stack.n < n) return false;
  stack.n -= n;
  if (stack.n <= 0) c.inventory.splice(idx, 1);
  events.emit('char:changed', {});
  return true;
}

export function countItem(c: Character, id: ItemId): number {
  let n = c.inventory.find((s) => s.id === id)?.n ?? 0;
  for (const v of Object.values(c.equipment)) if (v === id) n++;
  return n;
}

export function encumbrance(c: Character): number {
  let w = 0;
  for (const s of c.inventory) w += itemDef(s.id).weight * s.n;
  for (const v of Object.values(c.equipment)) {
    if (v) w += itemDef(v).weight;
  }
  return Math.round(w * 10) / 10;
}

/** Resolve which slot an item equips into (rings pick the free one). */
function slotFor(c: Character, id: ItemId): EquipSlot | null {
  const def = itemDef(id);
  if (def.weapon) return 'weapon';
  if (def.armor) return def.armor.slot;
  if (def.clothing) {
    const s = def.clothing.slot;
    if (s === 'ring1') return c.equipment.ring1 === null ? 'ring1' : 'ring2';
    return s;
  }
  return null;
}

export function equipItem(c: Character, id: ItemId): boolean {
  const slot = slotFor(c, id);
  if (!slot) return false;
  if (!removeItem(c, id, 1)) return false;
  // Two-handed weapons displace the shield.
  const def = itemDef(id);
  if (def.weapon?.twoHanded && c.equipment.shield) {
    addItem(c, c.equipment.shield, 1);
    c.equipment.shield = null;
  }
  if (slot === 'shield' && c.equipment.weapon && itemDef(c.equipment.weapon).weapon?.twoHanded) {
    addItem(c, c.equipment.weapon, 1);
    c.equipment.weapon = null;
  }
  // Robe displaces shirt (worn over everything else is fine).
  const prev = c.equipment[slot];
  if (prev) addItem(c, prev, 1);
  c.equipment[slot] = id;
  events.emit('char:changed', {});
  return true;
}

export function unequipSlot(c: Character, slot: EquipSlot): void {
  const id = c.equipment[slot];
  if (!id) return;
  c.equipment[slot] = null;
  addItem(c, id, 1);
  events.emit('char:changed', {});
}

export function usePotion(c: Character, id: ItemId): boolean {
  const def = itemDef(id);
  if (!def.potion) return false;
  if (!removeItem(c, id, 1)) return false;
  const p = def.potion;
  if (p.stat === 'hp') c.hp = clamp(c.hp + p.amount, 0, c.hpMax);
  else if (p.stat === 'mp') c.mp = clamp(c.mp + p.amount, 0, c.mpMax);
  else c.fat = clamp(c.fat + p.amount, 0, c.fatMax);
  events.emit('toast', { text: `${def.name} restores you`, kind: 'item' });
  events.emit('char:changed', {});
  return true;
}

/** Total armor rating with skill scaling (used by combat in P5). */
export function totalArmor(c: Character): number {
  let ar = 0;
  const SLOT_WEIGHT: Partial<Record<EquipSlot, number>> = {
    cuirass: 0.4,
    head: 0.15,
    greaves: 0.15,
    boots: 0.1,
    gauntlets: 0.1,
    shield: 0.35, // passive block contribution
  };
  for (const [slot, id] of Object.entries(c.equipment) as [EquipSlot, ItemId | null][]) {
    if (!id) continue;
    const def = itemDef(id);
    if (!def.armor) continue;
    const skill = def.armor.heavy ? c.skills.heavyArmor : c.skills.lightArmor;
    const eff = def.armor.ar * (0.5 + skill * 0.0075);
    ar += eff * (SLOT_WEIGHT[slot] ?? 0.1) * 2.5;
  }
  return ar;
}
