/**
 * Disposition + persuasion. Per-NPC values live in a runtime map and
 * serialize into saves. Admire/Intimidate roll against 35 + d40; Bribe buys
 * favor directly.
 */

import { Sfc32, seedOf, xmur3 } from '@/engine/rng';
import { clamp } from '@/engine/math';
import { events } from '@/engine/events';
import { awardSkillXp } from './skills';
import type { Character } from './stats';

const disp = new Map<string, number>();
let rollCounter = 0;

export function getDisposition(npcKey: string): number {
  let v = disp.get(npcKey);
  if (v === undefined) {
    // Stable base 42..58 per NPC.
    v = 42 + (xmur3(npcKey)() % 17);
    disp.set(npcKey, v);
  }
  return v;
}

export function modDisposition(npcKey: string, delta: number): number {
  const v = clamp(getDisposition(npcKey) + delta, 0, 100);
  disp.set(npcKey, v);
  return v;
}

export type PersuadeKind = 'admire' | 'intimidate' | 'bribe10' | 'bribe50';

export interface PersuadeResult {
  success: boolean;
  disposition: number;
  line: string;
}

export function persuade(c: Character, npcKey: string, kind: PersuadeKind): PersuadeResult {
  const rng = new Sfc32(seedOf('persuade', xmur3(npcKey)(), rollCounter++));
  if (kind === 'bribe10' || kind === 'bribe50') {
    const cost = kind === 'bribe10' ? 10 : 50;
    if (c.gold < cost) {
      return { success: false, disposition: getDisposition(npcKey), line: 'Your purse disagrees.' };
    }
    c.gold -= cost;
    const gain = kind === 'bribe10' ? 4 : 13;
    const d = modDisposition(npcKey, gain);
    awardSkillXp(c, 'speechcraft', 1);
    events.emit('char:changed', {});
    return { success: true, disposition: d, line: 'Coin smooths the conversation.' };
  }

  const target = 35 + rng.int(0, 40);
  if (kind === 'admire') {
    const score = c.skills.speechcraft + c.attrs.per / 2 + c.attrs.luc / 4;
    const ok = score >= target;
    const d = modDisposition(npcKey, ok ? 8 : -5);
    awardSkillXp(c, 'speechcraft', ok ? 3 : 1);
    return {
      success: ok,
      disposition: d,
      line: ok ? 'Flattery, expertly landed.' : 'The compliment curdles mid-air.',
    };
  }
  // intimidate
  const score = c.attrs.str / 2 + c.skills.speechcraft / 2 + c.attrs.per / 4;
  const ok = score >= target - 5;
  const d = modDisposition(npcKey, ok ? 10 : -8);
  awardSkillXp(c, 'speechcraft', ok ? 3 : 1);
  return {
    success: ok,
    disposition: d,
    line: ok ? 'They find your point persuasive.' : 'They are unimpressed by the performance.',
  };
}

export function serializeDispositions(): Record<string, number> {
  return Object.fromEntries(disp);
}

export function restoreDispositions(data: Record<string, number>): void {
  disp.clear();
  for (const [k, v] of Object.entries(data)) disp.set(k, v);
}
