/**
 * zustand store — the ONLY doorway between simulation and React.
 * Game → UI: typed events mirrored in by initUiBridge().
 * UI → Game: the frozen GameAPI registered by main.tsx.
 */

import { create } from 'zustand';
import { events, type GameMode, type ToastKind } from '@/engine/events';
import type { UiMode } from '@/engine/input';
import { config, type GameSettings } from '@/engine/config';
import type { Character, BirthStone } from '@/systems/stats';
import type { Culture } from '@/gen/names';
import type { EquipSlot } from '@/data/items';
import type { ItemId } from '@/data/ids';
import type { SaveMeta, SlotId } from '@/engine/saves';

export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

export interface HudStats {
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  fat: number;
  fatMax: number;
  enc: number;
  encMax: number;
  levelReady: boolean;
}

export interface ContainerView {
  label: string;
  items: { id: string; n: number }[];
}

interface UiState {
  gameMode: GameMode;
  uiStack: readonly UiMode[];
  toasts: Toast[];
  hasSave: boolean;
  settings: GameSettings;
  pointerLocked: boolean;
  prompt: string | null;
  fading: boolean;
  hud: HudStats;
  /** Bumped on char:changed so inventory/sheet re-read the live character. */
  charVersion: number;
  container: ContainerView | null;
  saves: SaveMeta[];
  setSettings: (partial: Partial<GameSettings>) => void;
  dismissToast: (id: number) => void;
}

export const useUi = create<UiState>()((set) => ({
  gameMode: 'boot',
  uiStack: [],
  toasts: [],
  hasSave: false,
  settings: { ...config },
  pointerLocked: false,
  prompt: null,
  fading: false,
  hud: { hp: 1, hpMax: 1, mp: 1, mpMax: 1, fat: 1, fatMax: 1, enc: 0, encMax: 1, levelReady: false },
  charVersion: 0,
  container: null,
  saves: [],
  setSettings: (partial) =>
    set((s) => {
      gameApi().applySettings(partial);
      return { settings: { ...s.settings, ...partial } };
    }),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export async function refreshSaves(): Promise<void> {
  const saves = await gameApi().listSaves();
  useUi.setState({ saves, hasSave: saves.length > 0 });
}

/** Top window, or null when the player is fully in-world. */
export function topMode(stack: readonly UiMode[]): UiMode | null {
  return stack.length ? (stack[stack.length - 1] as UiMode) : null;
}

// ----- GameAPI: UI → simulation commands -------------------------------------

export interface GameAPI {
  newGame(): void;
  continueGame(): void;
  toMenu(): void;
  closeTop(): void;
  openWindow(mode: UiMode): void;
  applySettings(partial: Partial<GameSettings>): void;
  finishChargen(name: string, race: Culture, classId: string, stone: BirthStone): void;
  /** Live character (read-only by convention; re-read on charVersion bumps). */
  getCharacter(): Character | null;
  equipItem(id: ItemId): void;
  unequipSlot(slot: EquipSlot): void;
  usePotion(id: ItemId): void;
  lootTake(index: number): void; // -1 = all
  saveSlot(slot: SlotId, label: string): Promise<boolean>;
  loadSlot(slot: SlotId): Promise<boolean>;
  deleteSave(slot: SlotId): Promise<void>;
  listSaves(): Promise<SaveMeta[]>;
  /** Camera yaw for the compass (read per animation frame). */
  getYaw(): number;
  readySpell(id: SpellIdLike): void;
  bindHotkey(id: SpellIdLike, slot: number): void;
}

/** Branded SpellId without importing the data layer into every consumer. */
export type SpellIdLike = string & { readonly __brand: 'SpellId' };

let api: GameAPI | null = null;

export function registerGameAPI(a: GameAPI): void {
  api = Object.freeze(a);
}

export function gameApi(): GameAPI {
  if (!api) throw new Error('GameAPI not registered yet');
  return api;
}

// ----- event bridge -----------------------------------------------------------

let toastId = 1;

export function initUiBridge(): void {
  events.on('game:mode', ({ mode }) => useUi.setState({ gameMode: mode }));
  events.on('ui:stack', ({ stack }) => useUi.setState({ uiStack: stack }));
  events.on('input:lock', ({ locked }) => useUi.setState({ pointerLocked: locked }));
  events.on('hud:prompt', ({ text }) => useUi.setState({ prompt: text }));
  events.on('screen:fade', ({ on }) => useUi.setState({ fading: on }));
  events.on('hud:stats', (hud) => useUi.setState({ hud }));
  events.on('char:changed', () => useUi.setState((s) => ({ charVersion: s.charVersion + 1 })));
  events.on('container:open', (c) => useUi.setState({ container: c }));
  events.on('toast', ({ text, kind }) =>
    useUi.setState((s) => ({
      toasts: [...s.toasts.slice(-3), { id: toastId++, text, kind }],
    })),
  );
}
