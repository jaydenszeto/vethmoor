/**
 * Quest stage machine. Stages only move forward; every stage append a dated
 * journal entry. Flags are free-form booleans for sub-steps (e.g. the three
 * faction consultations). State serializes into the save `ext` blob.
 */

import { events } from '@/engine/events';
import { QUESTS, questDef } from '@/data/quests';

export interface JournalEntry {
  quest: string;
  stage: number;
  day: number;
}

const stages = new Map<string, number>();
const flags = new Set<string>();
const journal: JournalEntry[] = [];

export function questStage(id: string): number {
  return stages.get(id) ?? 0;
}

export function questFlag(id: string): boolean {
  return flags.has(id);
}

export function setQuestFlag(id: string): void {
  flags.add(id);
}

/** Advance a quest (forward only). Returns true if the stage changed. */
export function setQuestStage(id: string, stage: number, day: number): boolean {
  const def = questDef(id);
  if (!def) return false;
  if (questStage(id) >= stage) return false;
  stages.set(id, stage);
  journal.push({ quest: id, stage, day });
  const text = def.stages.find((s) => s.at === stage)?.journal;
  if (text) {
    events.emit('quest:stage', { quest: id, name: def.name, stage, text });
  }
  return true;
}

export function questComplete(id: string): boolean {
  const def = questDef(id);
  return def !== undefined && questStage(id) >= def.doneAt;
}

export interface JournalView {
  quest: string;
  name: string;
  faction: string | null;
  complete: boolean;
  entries: { stage: number; day: number; text: string }[];
}

/** Per-quest journal, newest quest activity first. */
export function journalView(): JournalView[] {
  const order: string[] = [];
  for (let i = journal.length - 1; i >= 0; i--) {
    const q = (journal[i] as JournalEntry).quest;
    if (!order.includes(q)) order.push(q);
  }
  return order.map((q) => {
    const def = questDef(q);
    return {
      quest: q,
      name: def?.name ?? q,
      faction: def?.faction ?? null,
      complete: questComplete(q),
      entries: journal
        .filter((e) => e.quest === q)
        .map((e) => ({
          stage: e.stage,
          day: e.day,
          text: def?.stages.find((s) => s.at === e.stage)?.journal ?? '',
        }))
        .reverse(),
    };
  });
}

export function activeQuestCount(): number {
  return [...stages.keys()].filter((q) => !questComplete(q)).length;
}

export interface QuestSave {
  stages: Record<string, number>;
  flags: string[];
  journal: JournalEntry[];
}

export function serializeQuests(): QuestSave {
  return { stages: Object.fromEntries(stages), flags: [...flags], journal: [...journal] };
}

export function restoreQuests(data: QuestSave | undefined): void {
  stages.clear();
  flags.clear();
  journal.length = 0;
  if (!data) return;
  for (const [k, v] of Object.entries(data.stages)) stages.set(k, v);
  for (const f of data.flags) flags.add(f);
  journal.push(...data.journal);
}

/** Dev sanity: every quest id referenced by a journal exists. */
export function validateQuests(): void {
  const seen = new Set<string>();
  for (const q of QUESTS) {
    if (seen.has(q.id)) throw new Error(`duplicate quest id ${q.id}`);
    seen.add(q.id);
    let prev = -1;
    for (const s of q.stages) {
      if (s.at <= prev) throw new Error(`quest ${q.id}: stages out of order at ${s.at}`);
      prev = s.at;
    }
    if (!q.stages.some((s) => s.at >= q.doneAt)) {
      throw new Error(`quest ${q.id}: no stage at/above doneAt ${q.doneAt}`);
    }
  }
}
