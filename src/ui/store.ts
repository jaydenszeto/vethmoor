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

export interface DialogueView {
  npcKey: string;
  name: string;
  role: string;
  disposition: number;
  log: { topic: string | null; text: string }[];
  topics: { id: string; keyword: string }[];
  canBarter: boolean;
}

export interface BarterView {
  npcKey: string;
  name: string;
  merchantGold: number;
  playerGold: number;
  stock: { id: string; n: number; price: number }[];
  goods: { id: string; n: number; price: number }[];
  line: string | null;
}

export interface TravelView {
  from: string;
  options: { id: string; name: string; km: number; fare: number; hours: number; tagline: string }[];
}

export interface BookView {
  title: string;
  text: string;
  note: string | null;
}

export interface JournalData {
  quests: {
    quest: string;
    name: string;
    faction: string | null;
    complete: boolean;
    entries: { stage: number; day: number; text: string }[];
  }[];
  factions: {
    id: string;
    name: string;
    blurb: string;
    joined: boolean;
    rank: string;
    rep: number;
    duty: string | null;
  }[];
  topics: { id: string; keyword: string }[];
}

export interface MapData {
  url: string;
  sizeM: number;
  towns: { id: string; name: string; x: number; z: number }[];
  dungeons: { name: string; x: number; z: number }[];
  player: { x: number; z: number; yaw: number; interior: boolean };
}

export interface LocalMapData {
  label: string;
  rooms: { x0: number; z0: number; x1: number; z1: number }[];
  player: { x: number; z: number; yaw: number };
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
  dialogue: DialogueView | null;
  barter: BarterView | null;
  travel: TravelView | null;
  book: BookView | null;
  /** Bumped on quest:stage so the journal re-reads. */
  questVersion: number;
  ending: 'choice' | 'sever' | 'rebind' | null;
  /** True only while the field guide is showing its first-spawn greeting. */
  guideWelcome: boolean;
  /** Active wayfinding objective line (null = hidden). */
  objective: string | null;
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
  dialogue: null,
  barter: null,
  travel: null,
  book: null,
  questVersion: 0,
  ending: null,
  guideWelcome: false,
  objective: null,
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
  /** Absolute bearing to the active objective for the compass tick, or null. Polled per frame. */
  getObjectiveBearing(): number | null;
  readySpell(id: SpellIdLike): void;
  bindHotkey(id: SpellIdLike, slot: number): void;
  // ----- P6: dialogue / barter / travel / rest / books / alchemy ----------------
  /** Click a [topic] hyperlink or list entry in the open dialogue. */
  chooseTopic(topicId: string): void;
  persuade(kind: 'admire' | 'intimidate' | 'bribe10' | 'bribe50'): void;
  /** Switch the open dialogue into the barter window. */
  openBarter(): void;
  barterBuy(id: ItemId): void;
  barterSell(id: ItemId): void;
  travelTo(townId: string): void;
  /** Rest gate — RestDialog reads this on mount. */
  canRest(): { ok: boolean; reason: string };
  rest(hours: number): void;
  readBook(id: ItemId): void;
  /** Combine 2–4 ingredients; returns the result line for the window. */
  brewPotion(ids: ItemId[]): string;
  applyLevelUp(picks: readonly [string, string, string]): void;
  // ----- P7: journal / maps / endings -------------------------------------------
  getJournal(): JournalData;
  getMapData(): MapData;
  getLocalMap(): LocalMapData | null;
  chooseEnding(kind: 'sever' | 'rebind'): void;
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
  events.on('dialogue:state', (d) => useUi.setState({ dialogue: d }));
  events.on('barter:state', (b) => useUi.setState({ barter: b }));
  events.on('travel:open', (t) => useUi.setState({ travel: t }));
  events.on('book:open', (b) => useUi.setState({ book: b }));
  events.on('quest:stage', ({ name }) => {
    useUi.setState((s) => ({
      questVersion: s.questVersion + 1,
      toasts: [...s.toasts.slice(-3), { id: toastId++, text: `Journal updated — ${name}`, kind: 'quest' as ToastKind }],
    }));
  });
  events.on('ending:open', ({ phase }) => useUi.setState({ ending: phase }));
  events.on('guide:welcome', () => useUi.setState({ guideWelcome: true }));
  events.on('hud:objective', ({ text }) => useUi.setState({ objective: text }));
  events.on('toast', ({ text, kind }) =>
    useUi.setState((s) => ({
      toasts: [...s.toasts.slice(-3), { id: toastId++, text, kind }],
    })),
  );
}
