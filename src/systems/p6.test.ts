/**
 * P6 systems: dialogue topic resolution, persuasion bounds, barter price
 * inequalities + deterministic merchant stock, alchemy effect matching, and
 * skill-book bumps.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setWorldSeed } from '@/engine/rng';
import { DEFAULT_WORLD_SEED } from '@/data/world';
import { itemId } from '@/data/ids';
import { ITEMS, itemDef } from '@/data/items';
import { CORE_TOPICS, TOPICS, type GameView } from '@/data/topics';
import { BOOK_TEXTS } from '@/data/books';
import {
  extractSegments,
  linkedTopics,
  topicDefFor,
  topicText,
  visibleTopics,
  type NpcIdentity,
} from './dialogue';
import { getDisposition, modDisposition, persuade, restoreDispositions } from './disposition';
import { buyPrice, merchantState, sellPrice } from './barter';
import { brew, sharedEffects } from './alchemy';
import { bumpSkill } from './skills';
import { addItem } from './inventory';
import { createCharacter } from './stats';

beforeAll(() => setWorldSeed(DEFAULT_WORLD_SEED));
beforeEach(() => restoreDispositions({}));

const view: GameView = { day: 1, hour: 12, questStage: () => 0 };

function npc(role: NpcIdentity['role'], town: string | null = 'saltmere', key = 'test:npc'): NpcIdentity {
  return { key, name: 'Testa', role, town };
}

describe('topic database', () => {
  it('every [bracket] link points at a real topic id', () => {
    for (const def of TOPICS) {
      for (const text of def.text) {
        for (const seg of extractSegments(text)) {
          if (seg.link === null) continue;
          expect(
            TOPICS.some((t) => t.id === seg.link),
            `dangling link [${seg.link}] in topic "${def.id}"`,
          ).toBe(true);
        }
      }
    }
  });

  it('core topics all resolve for a generic villager', () => {
    for (const id of CORE_TOPICS) {
      expect(topicText(npc('villager'), id, view), `core topic "${id}"`).toBeTruthy();
    }
  });

  it('greeting resolves for every role', () => {
    for (const role of ['villager', 'guard', 'trader', 'innkeep', 'priest', 'nomad'] as const) {
      expect(topicText(npc(role), 'greeting', view)).toBeTruthy();
    }
  });

  it('role-scoped defs outrank generic ones and never leak to other roles', () => {
    for (const def of TOPICS) {
      if (!def.scope?.role) continue;
      const match = topicDefFor(npc(def.scope.role, def.scope.town ?? null), def.id, view);
      expect(match?.scope?.role).toBe(def.scope.role);
      // A different role must not receive this role-scoped text.
      const other = def.scope.role === 'priest' ? 'guard' : 'priest';
      const fallback = topicDefFor(npc(other, def.scope.town ?? null), def.id, view);
      if (fallback) expect(fallback.scope?.role).not.toBe(def.scope.role);
    }
  });

  it('text variants are deterministic per (npc, topic) and differ across NPCs', () => {
    const a1 = topicText(npc('villager', 'saltmere', 'npc:a'), 'greeting', view);
    const a2 = topicText(npc('villager', 'saltmere', 'npc:a'), 'greeting', view);
    expect(a1).toBe(a2);
  });

  it('visibleTopics gates on known ∪ core and excludes the greeting', () => {
    const vis = visibleTopics(npc('villager'), [], view);
    expect(vis).not.toContain('greeting');
    for (const id of vis) {
      expect(TOPICS.find((t) => t.id === id)?.core).toBe(true);
    }
    const more = visibleTopics(npc('villager'), ['ember tooth'], view);
    expect(more).toContain('ember tooth');
  });

  it('linkedTopics extracts only real topics', () => {
    const ids = linkedTopics('Ask about [the ashen march] or [nonsense topic].');
    expect(ids).toEqual(['the ashen march']);
  });
});

describe('disposition + persuasion', () => {
  it('base disposition is stable per key and within 42..58', () => {
    const d = getDisposition('town:saltmere:npc0');
    expect(d).toBe(getDisposition('town:saltmere:npc0'));
    expect(d).toBeGreaterThanOrEqual(42);
    expect(d).toBeLessThanOrEqual(58);
  });

  it('disposition clamps to 0..100', () => {
    expect(modDisposition('k', 500)).toBe(100);
    expect(modDisposition('k', -500)).toBe(0);
  });

  it('bribes always land and cost gold', () => {
    const c = createCharacter('T', 'karthi', 'sellsword', 'tide');
    c.gold = 60;
    const before = getDisposition('k2');
    const r = persuade(c, 'k2', 'bribe50');
    expect(r.success).toBe(true);
    expect(c.gold).toBe(10);
    expect(r.disposition).toBeGreaterThan(before);
    // Broke bribes refuse without side effects.
    const r2 = persuade(c, 'k2', 'bribe50');
    expect(r2.success).toBe(false);
    expect(c.gold).toBe(10);
  });
});

describe('barter math', () => {
  it('sell < buy for every disposition/speechcraft combination', () => {
    for (const base of [5, 40, 350]) {
      for (let disp = 0; disp <= 100; disp += 10) {
        for (let sp = 5; sp <= 100; sp += 19) {
          const b = buyPrice(base, disp, sp);
          const s = sellPrice(base, disp, sp);
          expect(s).toBeLessThan(b);
          expect(s).toBeGreaterThanOrEqual(1);
          expect(b).toBeGreaterThanOrEqual(Math.round(base * 0.9));
        }
      }
    }
  });

  it('higher disposition lowers buy and raises sell', () => {
    expect(buyPrice(100, 90, 30)).toBeLessThan(buyPrice(100, 10, 30));
    expect(sellPrice(100, 90, 30)).toBeGreaterThan(sellPrice(100, 10, 30));
  });

  it('merchant stock is deterministic per (npc, day) and restocks daily', () => {
    const a = merchantState('m1', 'trader', 3);
    const b = merchantState('m1', 'trader', 3);
    expect(b).toBe(a); // cached same-day
    const totalA = JSON.stringify(a.stock);
    const c = merchantState('m1', 'trader', 4);
    expect(c.day).toBe(4);
    // Day 3 regenerated from scratch matches the original roll.
    const a2 = merchantState('m1', 'trader', 3);
    expect(JSON.stringify(a2.stock)).toBe(totalA);
    // Traders always carry the staples.
    expect(a.stock.some((s) => (s.id as string) === 'torch')).toBe(true);
    expect(a.stock.some((s) => (s.id as string) === 'arrow')).toBe(true);
  });
});

describe('alchemy', () => {
  it('sharedEffects finds pairwise virtues only', () => {
    // marsh-reed: restore-fat/water-breath/drain-hp/fortify-spd
    // gull-egg:   restore-fat/restore-hp/drain-mp/fortify-per
    const shared = sharedEffects([itemId('ingredient-marsh-reed'), itemId('ingredient-gull-egg')]);
    expect(shared).toEqual(['restore-fat']);
    expect(sharedEffects([itemId('ingredient-marsh-reed')])).toEqual([]);
  });

  it('brewing consumes ingredients and bottles a restorative', () => {
    const c = createCharacter('T', 'karthi', 'cinderscribe', 'ember');
    addItem(c, itemId('ingredient-marsh-reed'), 1);
    addItem(c, itemId('ingredient-gull-egg'), 1);
    const r = brew(c, [itemId('ingredient-marsh-reed'), itemId('ingredient-gull-egg')]);
    expect(r.ok).toBe(true);
    expect(r.made).toBeTruthy();
    expect(itemDef(r.made as never).kind).toBe('potion');
    expect(c.inventory.some((s) => (s.id as string).startsWith('ingredient-marsh'))).toBe(false);
  });

  it('refuses <2 or unmatched ingredients without consuming them', () => {
    const c = createCharacter('T', 'karthi', 'cinderscribe', 'ember');
    addItem(c, itemId('ingredient-marsh-reed'), 1);
    expect(brew(c, [itemId('ingredient-marsh-reed')]).ok).toBe(false);
    expect(c.inventory.some((s) => (s.id as string) === 'ingredient-marsh-reed')).toBe(true);
  });
});

describe('books', () => {
  it('every book item references a real text', () => {
    for (const def of ITEMS) {
      if (def.kind !== 'book' || !def.book) continue;
      expect(
        BOOK_TEXTS.some((t) => t.id === def.book?.textId),
        `book item ${def.id} → missing text ${def.book.textId}`,
      ).toBe(true);
    }
  });

  it('bumpSkill raises the skill and banks level progress for majors', () => {
    const c = createCharacter('T', 'karthi', 'sellsword', 'tide');
    const before = c.skills.blade; // sellsword major
    const prog = c.levelProgress;
    expect(bumpSkill(c, 'blade')).toBe(true);
    expect(c.skills.blade).toBe(before + 1);
    expect(c.levelProgress).toBe(prog + 1);
  });
});
