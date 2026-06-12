/**
 * Typed event bus — the one-way street from simulation to UI (and decoupled
 * system-to-system signals). The EventMap grows as systems come online; every
 * payload is a plain serializable-ish object so the UI bridge can mirror it
 * into zustand without touching sim internals.
 */

import type { UiMode } from './input';

export type GameMode = 'boot' | 'menu' | 'chargen' | 'play' | 'dead' | 'ending';

export type ToastKind = 'info' | 'skill' | 'quest' | 'warn' | 'item';

export interface EventMap {
  /** Game mode transitions (menu → play etc.). */
  'game:mode': { mode: GameMode };
  /** UI window stack changed (input.ts is the authority). */
  'ui:stack': { stack: readonly UiMode[] };
  /** Transient HUD notification. */
  toast: { text: string; kind: ToastKind };
  /** Pointer lock state (for pause-on-loss + cursor hints). */
  'input:lock': { locked: boolean };
  /** Fired by input when a gameplay hotkey is pressed (routed by Game). */
  'input:hotkey': { slot: number };
  /** Game clock: hour boundary crossed (schedules, ambience). */
  'time:hour': { hour: number; day: number };
  /** Cell-transition blackout. */
  'screen:fade': { on: boolean };
  /** Crosshair interaction prompt (null clears). */
  'hud:prompt': { text: string | null };
  /** Character sheet/inventory mutated (UI re-reads). */
  'char:changed': Record<string, never>;
  /** Container window contents (pushed on open + after takes). */
  'container:open': { label: string; items: { id: string; n: number }[] };
  /** Vital bars push (throttled ~10 Hz). */
  'hud:stats': {
    hp: number;
    hpMax: number;
    mp: number;
    mpMax: number;
    fat: number;
    fatMax: number;
    enc: number;
    encMax: number;
    levelReady: boolean;
  };
  /** Spell-cast screen flash (school-colored edge glow). */
  'cast:flash': { school: string };
  /** Player took damage (red vignette pulse). */
  'hud:damage': { amount: number };
  /** Crosshair target health readout (name null clears). */
  'hud:target': { name: string | null; frac: number };
  /** Readied spell changed. */
  'hud:spell': { name: string | null };
  /** Conjuration asks the spawn system for an ash servant. */
  'summon:request': { duration: number };
  /** Full dialogue view (pushed on open + after every topic/persuade). */
  'dialogue:state': {
    npcKey: string;
    name: string;
    role: string;
    disposition: number;
    log: { topic: string | null; text: string }[];
    topics: { id: string; keyword: string }[];
    canBarter: boolean;
  };
  /** Full barter view (pushed on open + after every deal). */
  'barter:state': {
    npcKey: string;
    name: string;
    merchantGold: number;
    playerGold: number;
    stock: { id: string; n: number; price: number }[];
    goods: { id: string; n: number; price: number }[];
    line: string | null;
  };
  /** Travel window contents. */
  'travel:open': {
    from: string;
    options: { id: string; name: string; km: number; fare: number; hours: number; tagline: string }[];
  };
  /** Book reader contents (note = "+1 Blade" style teach line). */
  'book:open': { title: string; text: string; note: string | null };
}

type Handler<K extends keyof EventMap> = (payload: EventMap[K]) => void;

class EventBus {
  private handlers = new Map<keyof EventMap, Set<Handler<never>>>();

  on<K extends keyof EventMap>(key: K, fn: Handler<K>): () => void {
    let set = this.handlers.get(key);
    if (!set) {
      set = new Set();
      this.handlers.set(key, set);
    }
    set.add(fn as Handler<never>);
    return () => set.delete(fn as Handler<never>);
  }

  emit<K extends keyof EventMap>(key: K, payload: EventMap[K]): void {
    const set = this.handlers.get(key);
    if (!set) return;
    for (const fn of set) (fn as Handler<K>)(payload);
  }
}

export const events = new EventBus();
