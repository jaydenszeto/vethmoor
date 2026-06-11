/**
 * zustand store — the ONLY doorway between simulation and React.
 * Game → UI: typed events mirrored in by initUiBridge().
 * UI → Game: the frozen GameAPI registered by main.tsx.
 */

import { create } from 'zustand';
import { events, type GameMode, type ToastKind } from '@/engine/events';
import type { UiMode } from '@/engine/input';
import { config, type GameSettings } from '@/engine/config';

export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

interface UiState {
  gameMode: GameMode;
  uiStack: readonly UiMode[];
  toasts: Toast[];
  hasSave: boolean;
  settings: GameSettings;
  pointerLocked: boolean;
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
  setSettings: (partial) =>
    set((s) => {
      gameApi().applySettings(partial);
      return { settings: { ...s.settings, ...partial } };
    }),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

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
}

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
  events.on('toast', ({ text, kind }) =>
    useUi.setState((s) => ({
      toasts: [...s.toasts.slice(-3), { id: toastId++, text, kind }],
    })),
  );
}
