/**
 * Topic resolution + hyperlink extraction. An NPC's available topics are the
 * defs whose scope matches (most specific text wins) intersected with the
 * player's known topics (core topics are always known).
 */

import { mix32, xmur3 } from '@/engine/rng';
import { CORE_TOPICS, TOPICS, type GameView, type TopicDef } from '@/data/topics';
import type { NpcRole } from '@/gen/models/humanoid';

export interface NpcIdentity {
  key: string; // stable id for variant picking + disposition
  name: string;
  role: NpcRole;
  town: string | null;
}

function scopeRank(def: TopicDef, npc: NpcIdentity): number {
  const s = def.scope;
  if (!s) return 0;
  const roleMatch = s.role !== undefined && s.role === npc.role;
  const townMatch = s.town !== undefined && (s.town as string) === npc.town;
  if (s.role !== undefined && s.role !== npc.role) return -1;
  if (s.town !== undefined && (s.town as string) !== npc.town) return -1;
  return (roleMatch ? 2 : 0) + (townMatch ? 1 : 0);
}

/** Best-matching def for a topic id, given the NPC. */
export function topicDefFor(npc: NpcIdentity, topicId: string, view: GameView): TopicDef | null {
  let best: TopicDef | null = null;
  let bestRank = -1;
  for (const def of TOPICS) {
    if (def.id !== topicId) continue;
    if (def.cond && !def.cond(view)) continue;
    const rank = scopeRank(def, npc);
    if (rank > bestRank) {
      bestRank = rank;
      best = def;
    }
  }
  return best;
}

/** Topics this NPC will discuss (known ∪ core, excluding the greeting). */
export function visibleTopics(npc: NpcIdentity, known: readonly string[], view: GameView): string[] {
  const knownSet = new Set<string>([...known, ...CORE_TOPICS]);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const def of TOPICS) {
    if (def.id === 'greeting' || seen.has(def.id)) continue;
    if (!knownSet.has(def.id) && !def.core) continue;
    if (def.cond && !def.cond(view)) continue;
    if (scopeRank(def, npc) < 0) continue;
    seen.add(def.id);
    out.push(def.id);
  }
  return out;
}

/** Deterministic text variant for (npc, topic). */
export function topicText(npc: NpcIdentity, topicId: string, view: GameView): string | null {
  const def = topicDefFor(npc, topicId, view);
  if (!def) return null;
  const h = mix32(xmur3(`${npc.key}:${topicId}`)());
  return def.text[h % def.text.length] as string;
}

export interface TextSegment {
  text: string;
  link: string | null;
}

/** Split "[bracketed]" keywords into link segments. */
export function extractSegments(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), link: null });
    const keyword = m[1] as string;
    out.push({ text: keyword, link: keyword.toLowerCase() });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), link: null });
  return out;
}

/** All topic ids referenced by links in a text. */
export function linkedTopics(text: string): string[] {
  return extractSegments(text)
    .filter((s) => s.link !== null)
    .map((s) => s.link as string)
    .filter((id) => TOPICS.some((t) => t.id === id));
}
