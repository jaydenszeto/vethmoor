/**
 * P7 systems: quest machine transitions, faction ranks + radiant determinism,
 * and quest-topic gating (npc scope, conds, disjoint defs).
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setWorldSeed } from '@/engine/rng';
import { DEFAULT_WORLD_SEED } from '@/data/world';
import { QUESTS } from '@/data/quests';
import { TOPICS, type GameView } from '@/data/topics';
import { QUEST_NPCS } from '@/data/factions';
import {
  journalView,
  questComplete,
  questStage,
  restoreQuests,
  serializeQuests,
  setQuestStage,
  validateQuests,
} from './quests';
import {
  addRep,
  canPromote,
  clearDuty,
  dutyDone,
  factionDispositionBonus,
  factionRank,
  joinFaction,
  onKillForFactions,
  promote,
  restoreFactions,
  serializeFactions,
  startDuty,
} from './factions';
import { topicDefFor, visibleTopics, type NpcIdentity } from './dialogue';

beforeAll(() => setWorldSeed(DEFAULT_WORLD_SEED));
beforeEach(() => {
  restoreQuests(undefined);
  restoreFactions(undefined);
});

const seer: NpcIdentity = { key: 'quest:seer', name: 'Sela Veth', role: 'priest', town: 'saltmere' };

function view(overrides: Partial<GameView> = {}): GameView {
  return {
    day: 1,
    hour: 12,
    questStage: (id) => questStage(id),
    questFlag: () => false,
    hasItem: () => false,
    factionJoined: () => false,
    factionRank: () => 0,
    canPromote: () => false,
    duty: () => null,
    ...overrides,
  };
}

describe('quest machine', () => {
  it('validates the quest database', () => {
    expect(() => validateQuests()).not.toThrow();
  });

  it('stages only move forward and journal in order', () => {
    expect(setQuestStage('main', 10, 1)).toBe(true);
    expect(setQuestStage('main', 20, 2)).toBe(true);
    expect(setQuestStage('main', 10, 3)).toBe(false); // never backward
    expect(questStage('main')).toBe(20);
    const j = journalView();
    expect(j[0]?.quest).toBe('main');
    expect(j[0]?.entries[0]?.stage).toBe(20); // newest first
    expect(j[0]?.entries[1]?.stage).toBe(10);
  });

  it('completion respects doneAt and round-trips through serialization', () => {
    setQuestStage('vigil-1', 10, 1);
    expect(questComplete('vigil-1')).toBe(false);
    setQuestStage('vigil-1', 30, 1);
    expect(questComplete('vigil-1')).toBe(true);
    const blob = JSON.parse(JSON.stringify(serializeQuests()));
    restoreQuests(undefined);
    expect(questStage('vigil-1')).toBe(0);
    restoreQuests(blob);
    expect(questStage('vigil-1')).toBe(30);
    expect(questComplete('vigil-1')).toBe(true);
  });

  it('every faction quest has a quest NPC anchor in a real town', () => {
    for (const q of QUESTS) {
      if (!q.faction) continue;
      expect(['vigil', 'conclave', 'skarn']).toContain(q.faction);
    }
    expect(QUEST_NPCS.map((n) => n.key).sort()).toEqual(['cindral', 'dren', 'seer', 'skarn']);
  });
});

describe('factions', () => {
  it('joining grants rank 1; promotion follows rep thresholds', () => {
    expect(factionRank('vigil')).toBe(0);
    joinFaction('vigil');
    expect(factionRank('vigil')).toBe(1);
    expect(canPromote('vigil')).toBe(false);
    addRep('vigil', 8);
    expect(canPromote('vigil')).toBe(true);
    expect(promote('vigil')).toBe(true);
    expect(factionRank('vigil')).toBe(2);
    expect(canPromote('vigil')).toBe(false); // needs 20 for rank 3
  });

  it('disposition bonus scales with held ranks and caps', () => {
    expect(factionDispositionBonus()).toBe(0);
    joinFaction('vigil');
    expect(factionDispositionBonus()).toBe(2);
    joinFaction('skarn');
    addRep('skarn', 100);
    promote('skarn');
    promote('skarn');
    promote('skarn');
    promote('skarn');
    expect(factionDispositionBonus()).toBe(2 + 10);
  });

  it('radiant duties are deterministic per counter and progress on kills', () => {
    joinFaction('vigil');
    const d1 = startDuty('vigil', 'vornstead');
    const sig = `${d1.kind}:${d1.target}:${d1.count}:${d1.reward}`;
    expect(d1.kind).toBe('bounty');
    for (let i = 0; i < d1.count; i++) onKillForFactions(d1.target);
    expect(dutyDone(d1)).toBe(true);
    clearDuty('vigil');
    // Same counter from a fresh runtime → identical duty.
    const saved = JSON.parse(JSON.stringify(serializeFactions())) as never;
    restoreFactions(undefined);
    joinFaction('vigil');
    const again = startDuty('vigil', 'vornstead');
    expect(`${again.kind}:${again.target}:${again.count}:${again.reward}`).toBe(sig);
    // Restored counters continue the sequence instead of repeating it.
    restoreFactions(saved);
    const d2 = startDuty('vigil', 'vornstead');
    expect(d2.counter).toBe(1);
  });

  it('skarn duties are deliveries addressed away from home', () => {
    joinFaction('skarn');
    const d = startDuty('skarn', 'kraghold');
    expect(d.kind).toBe('deliver');
    expect(d.target).not.toBe('kraghold');
  });
});

describe('quest dialogue gating', () => {
  it('the seer offers the summons only at main stage 10–19', () => {
    setQuestStage('main', 10, 1);
    expect(topicDefFor(seer, 'the summons', view())).toBeTruthy();
    setQuestStage('main', 20, 1);
    expect(topicDefFor(seer, 'the summons', view())).toBeNull();
  });

  it('npc-scoped topics never leak to ordinary villagers', () => {
    setQuestStage('main', 10, 1);
    const villager: NpcIdentity = { key: 'town:saltmere:npc3', name: 'X', role: 'villager', town: 'saltmere' };
    expect(topicDefFor(villager, 'the summons', view())).toBeNull();
    const vis = visibleTopics(villager, [], view());
    expect(vis).not.toContain('the summons');
    expect(vis).not.toContain('work');
  });

  it('tablet turn-in requires possession; consultations gate on stage 40', () => {
    setQuestStage('main', 20, 1);
    expect(topicDefFor(seer, 'vargen tablets', view())?.effect).toBeUndefined();
    const withTablets = view({ hasItem: (id) => id === 'vargen-tablets' });
    expect(topicDefFor(seer, 'vargen tablets', withTablets)?.effect).toBeTruthy();
    const dren: NpcIdentity = { key: 'quest:dren', name: 'Dren', role: 'guard', town: 'vornstead' };
    expect(topicDefFor(dren, 'vargen tablets', view())).toBeNull();
    setQuestStage('main', 40, 1);
    expect(topicDefFor(dren, 'vargen tablets', view())).toBeTruthy();
  });

  it('same-id quest defs keep disjoint conds (at most one resolves per state)', () => {
    // Spot-check 'work' on Dren across the whole vigil chain.
    const dren: NpcIdentity = { key: 'quest:dren', name: 'Dren', role: 'guard', town: 'vornstead' };
    const states: Array<Record<string, number>> = [
      { 'vigil-1': 0 },
      { 'vigil-1': 10 },
      { 'vigil-1': 20 },
      { 'vigil-1': 30 },
      { 'vigil-1': 30, 'vigil-2': 10 },
    ];
    for (const stages of states) {
      const v = view({
        questStage: (id) => stages[id] ?? 0,
        factionJoined: () => true,
        factionRank: () => 5,
      });
      const matching = TOPICS.filter(
        (t) => t.id === 'work' && t.scope?.npc === 'quest:dren' && (!t.cond || t.cond(v)),
      );
      expect(matching.length, JSON.stringify(stages)).toBeLessThanOrEqual(1);
      expect(topicDefFor(dren, 'work', v)).toBeTruthy();
    }
  });
});
