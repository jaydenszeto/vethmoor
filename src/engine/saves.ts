/**
 * Save slots in IndexedDB (localStorage fallback). Versioned envelope with a
 * migration chain. Saves store the seed + diffs only — the world regenerates.
 */

import type { ItemStack } from '@/data/items';
import type { Character } from '@/systems/stats';

export const SAVE_VERSION = 1;

export interface SaveGame {
  version: number;
  seedStr: string;
  savedAt: number;
  label: string;
  playerLabel: string; // "Maren, level 3 Sellsword — Saltmere"
  clock: { day: number; minOfDay: number };
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    /** Interior cell id, or null for exterior. */
    cell: string | null;
    returnX: number;
    returnZ: number;
    returnYaw: number;
    character: Character;
  };
  containers: Record<string, ItemStack[]>;
  /** Extended by later phases (quests, factions, diffs). */
  ext: Record<string, unknown>;
}

export const SLOTS = ['quick', 'auto', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'] as const;
export type SlotId = (typeof SLOTS)[number];

const DB_NAME = 'vethmoor-saves';
const STORE = 'slots';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function lsKey(slot: string): string {
  return `vethmoor-save-${slot}`;
}

export async function writeSave(slot: SlotId, save: SaveGame): Promise<boolean> {
  const db = await openDb();
  if (db) {
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(save, slot);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }
  try {
    localStorage.setItem(lsKey(slot), JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export async function readSave(slot: SlotId): Promise<SaveGame | null> {
  const db = await openDb();
  if (db) {
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(slot);
      req.onsuccess = () => resolve(migrate(req.result as SaveGame | undefined) ?? null);
      req.onerror = () => resolve(null);
    });
  }
  try {
    const raw = localStorage.getItem(lsKey(slot));
    return raw ? (migrate(JSON.parse(raw) as SaveGame) ?? null) : null;
  } catch {
    return null;
  }
}

export async function deleteSave(slot: SlotId): Promise<void> {
  const db = await openDb();
  if (db) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(slot);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    return;
  }
  localStorage.removeItem(lsKey(slot));
}

export interface SaveMeta {
  slot: SlotId;
  label: string;
  playerLabel: string;
  savedAt: number;
}

export async function listSaves(): Promise<SaveMeta[]> {
  const out: SaveMeta[] = [];
  for (const slot of SLOTS) {
    const s = await readSave(slot);
    if (s) out.push({ slot, label: s.label, playerLabel: s.playerLabel, savedAt: s.savedAt });
  }
  return out;
}

export async function latestSave(): Promise<SlotId | null> {
  const all = await listSaves();
  if (!all.length) return null;
  all.sort((a, b) => b.savedAt - a.savedAt);
  return (all[0] as SaveMeta).slot;
}

/** Migration chain — bump SAVE_VERSION and add steps as the format grows. */
export function migrate(save: SaveGame | undefined): SaveGame | undefined {
  if (!save) return undefined;
  if (save.version === SAVE_VERSION) return save;
  // No older versions exist yet; refuse forward-compat saves.
  if (save.version > SAVE_VERSION) return undefined;
  return save;
}
