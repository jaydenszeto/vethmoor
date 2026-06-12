/**
 * Faction membership, reputation, promotion + radiant duties. Duty instances
 * are seeded by ('radiant', faction, counter) so every player's third Vigil
 * bounty is the same bounty. State serializes into the save `ext` blob.
 */

import { Sfc32, seedOf, xmur3 } from '@/engine/rng';
import { events } from '@/engine/events';
import { FACTION_BY_ID, type FactionId } from '@/data/factions';
import { itemId, type ItemId } from '@/data/ids';

export type { FactionId };

interface FactionState {
  joined: boolean;
  rank: number; // 1..5 once joined
  rep: number;
}

export type RadiantKind = 'bounty' | 'harvest' | 'deliver';

export interface RadiantDuty {
  faction: FactionId;
  kind: RadiantKind;
  /** bounty: enemy id · harvest: ingredient item id · deliver: town id. */
  target: string;
  targetName: string;
  count: number;
  progress: number;
  reward: number;
  counter: number;
}

const state = new Map<FactionId, FactionState>();
const duties = new Map<FactionId, RadiantDuty>();
const counters = new Map<FactionId, number>();
/** Free-form kill counters for authored quests ('vigil-1:bandit' → n). */
const killCounts = new Map<string, number>();

function st(f: FactionId): FactionState {
  let s = state.get(f);
  if (!s) {
    s = { joined: false, rank: 0, rep: 0 };
    state.set(f, s);
  }
  return s;
}

export function factionJoined(f: FactionId): boolean {
  return st(f).joined;
}

export function factionRank(f: FactionId): number {
  return st(f).rank;
}

export function factionRep(f: FactionId): number {
  return st(f).rep;
}

export function joinFaction(f: FactionId): void {
  const s = st(f);
  if (s.joined) return;
  s.joined = true;
  s.rank = 1;
  events.emit('toast', { text: `Joined ${FACTION_BY_ID.get(f)?.name} — ${rankTitle(f)}`, kind: 'quest' });
}

export function addRep(f: FactionId, n: number): void {
  st(f).rep += n;
}

export function rankTitle(f: FactionId): string {
  const s = st(f);
  const def = FACTION_BY_ID.get(f);
  if (!def || !s.joined) return 'Outsider';
  return def.ranks[Math.min(4, Math.max(0, s.rank - 1))] as string;
}

/** Promotion available? (rep meets the next rank's threshold) */
export function canPromote(f: FactionId): boolean {
  const s = st(f);
  const def = FACTION_BY_ID.get(f);
  if (!def || !s.joined || s.rank >= 5) return false;
  return s.rep >= (def.repForRank[s.rank] as number);
}

export function promote(f: FactionId): boolean {
  if (!canPromote(f)) return false;
  st(f).rank++;
  events.emit('toast', { text: `${FACTION_BY_ID.get(f)?.name}: promoted to ${rankTitle(f)}`, kind: 'quest' });
  return true;
}

/** Joined ranks sweeten every conversation: +2 disposition per rank held. */
export function factionDispositionBonus(): number {
  let b = 0;
  for (const s of state.values()) if (s.joined) b += s.rank * 2;
  return Math.min(12, b);
}

// ----- radiant duties --------------------------------------------------------------

const BOUNTY_KINDS: ReadonlyArray<[string, string]> = [
  ['bandit', 'bandits'],
  ['skeleton-warden', 'skeleton wardens'],
  ['ash-risen', 'ash-risen'],
  ['marsh-crab', 'marsh crabs'],
];

const HARVEST_KINDS: ReadonlyArray<[string, string]> = [
  ['ingredient-ashcap', 'Ashcap'],
  ['ingredient-marsh-reed', 'Marsh Reed'],
  ['ingredient-ember-moss', 'Ember Moss'],
  ['ingredient-bone-meal', 'Bone Meal'],
];

const DELIVER_TOWNS: ReadonlyArray<[string, string]> = [
  ['saltmere', 'Saltmere'],
  ['greyharbor', 'Greyharbor'],
  ['vornstead', 'Vornstead'],
  ['thornmoor', 'Thornmoor'],
  ['kraghold', 'Kraghold'],
  ['veskar', 'Veskar'],
];

const FACTION_DUTY: Record<FactionId, RadiantKind> = {
  vigil: 'bounty',
  conclave: 'harvest',
  skarn: 'deliver',
};

export function activeDuty(f: FactionId): RadiantDuty | null {
  return duties.get(f) ?? null;
}

/** Roll the next duty for a faction (deterministic by counter). */
export function startDuty(f: FactionId, homeTown: string): RadiantDuty {
  const existing = duties.get(f);
  if (existing) return existing;
  const counter = counters.get(f) ?? 0;
  const rng = new Sfc32(seedOf('radiant', xmur3(f)(), counter));
  const kind = FACTION_DUTY[f];
  let target: string;
  let targetName: string;
  let count: number;
  if (kind === 'bounty') {
    const pick = rng.pick(BOUNTY_KINDS);
    target = pick[0];
    targetName = pick[1];
    count = rng.int(2, 4);
  } else if (kind === 'harvest') {
    const pick = rng.pick(HARVEST_KINDS);
    target = pick[0];
    targetName = pick[1];
    count = rng.int(2, 4);
  } else {
    const options = DELIVER_TOWNS.filter(([id]) => id !== homeTown);
    const pick = rng.pick(options);
    target = pick[0];
    targetName = pick[1];
    count = 1;
  }
  const duty: RadiantDuty = {
    faction: f,
    kind,
    target,
    targetName,
    count,
    progress: 0,
    reward: 25 + rng.int(0, 4) * 5 + counter * 5,
    counter,
  };
  duties.set(f, duty);
  counters.set(f, counter + 1);
  return duty;
}

export function dutyDone(d: RadiantDuty): boolean {
  return d.progress >= d.count;
}

export function clearDuty(f: FactionId): void {
  duties.delete(f);
}

/** Kill hooks: radiant bounties + authored kill-count quests. */
export function onKillForFactions(enemyId: string): void {
  for (const d of duties.values()) {
    if (d.kind === 'bounty' && d.target === enemyId && d.progress < d.count) {
      d.progress++;
      events.emit('toast', { text: `Bounty: ${d.progress}/${d.count} ${d.targetName}`, kind: 'quest' });
    }
  }
}

export function bumpKillCount(key: string): number {
  const n = (killCounts.get(key) ?? 0) + 1;
  killCounts.set(key, n);
  return n;
}

export function killCount(key: string): number {
  return killCounts.get(key) ?? 0;
}

/** The radiant parcel item id (deliveries carry this). */
export const PARCEL: ItemId = itemId('sealed-parcel');

// ----- persistence -------------------------------------------------------------------

export interface FactionSave {
  state: Record<string, FactionState>;
  duties: Record<string, RadiantDuty>;
  counters: Record<string, number>;
  kills: Record<string, number>;
}

export function serializeFactions(): FactionSave {
  return {
    state: Object.fromEntries(state),
    duties: Object.fromEntries(duties),
    counters: Object.fromEntries(counters),
    kills: Object.fromEntries(killCounts),
  };
}

export function restoreFactions(data: FactionSave | undefined): void {
  state.clear();
  duties.clear();
  counters.clear();
  killCounts.clear();
  if (!data) return;
  for (const [k, v] of Object.entries(data.state)) state.set(k as FactionId, v);
  for (const [k, v] of Object.entries(data.duties)) duties.set(k as FactionId, v);
  for (const [k, v] of Object.entries(data.counters)) counters.set(k as FactionId, v);
  for (const [k, v] of Object.entries(data.kills)) killCounts.set(k, v);
}
