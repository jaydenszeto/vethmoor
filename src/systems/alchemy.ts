/**
 * Alchemy: combine 2–4 ingredients; shared effects activate. Restorative
 * shared effects brew potions (strength scales with Alchemy + INT); other
 * effects fizzle — for now the March keeps some secrets.
 * Ingredient effects reveal at Alchemy 25/50/75/100.
 */

import { itemId, type ItemId } from '@/data/ids';
import { itemDef } from '@/data/items';
import { events } from '@/engine/events';
import { awardSkillXp } from './skills';
import { addItem, removeItem } from './inventory';
import type { Character } from './stats';

export function revealedEffects(c: Character): number {
  return Math.max(1, Math.floor(c.skills.alchemy / 25) + 1);
}

export function effectsOf(id: ItemId): readonly string[] {
  return itemDef(id).ingredient?.effects ?? [];
}

export function sharedEffects(ids: readonly ItemId[]): string[] {
  if (ids.length < 2) return [];
  const counts = new Map<string, number>();
  for (const id of ids) {
    for (const e of new Set(effectsOf(id))) {
      counts.set(e, (counts.get(e) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, n]) => n >= 2).map(([e]) => e);
}

const BREW_MAP: Record<string, { weak: string; strong: string }> = {
  'restore-hp': { weak: 'potion-mend-small', strong: 'potion-mend' },
  'restore-mp': { weak: 'potion-magicka-small', strong: 'potion-magicka' },
  'restore-fat': { weak: 'potion-fatigue-small', strong: 'potion-fatigue' },
};

export interface BrewResult {
  ok: boolean;
  line: string;
  made: ItemId | null;
}

export function brew(c: Character, ids: readonly ItemId[]): BrewResult {
  if (ids.length < 2 || ids.length > 4) {
    return { ok: false, line: 'Two to four ingredients make a brew.', made: null };
  }
  const shared = sharedEffects(ids);
  if (shared.length === 0) {
    return { ok: false, line: 'These share no virtue. They would only make soup.', made: null };
  }
  for (const id of ids) {
    if (!removeItem(c, id, 1)) return { ok: false, line: 'Missing an ingredient.', made: null };
  }
  awardSkillXp(c, 'alchemy', 4);

  const brewable = shared.find((e) => BREW_MAP[e]);
  if (!brewable) {
    events.emit('toast', { text: 'The mixture hisses and is… educational.', kind: 'info' });
    return { ok: true, line: `The virtues (${shared.join(', ')}) refuse to settle into a bottle. Knowledge gained, potion lost.`, made: null };
  }
  const strength = (c.skills.alchemy + c.attrs.int / 2) / 25;
  const map = BREW_MAP[brewable] as { weak: string; strong: string };
  const made = itemId(strength >= 3 ? map.strong : map.weak);
  addItem(c, made, 1);
  return { ok: true, line: `You bottle ${itemDef(made).name}.`, made };
}
