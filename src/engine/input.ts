/**
 * Input manager — THE single authority over pointer lock and the UI window
 * stack. No other module may call requestPointerLock/exitPointerLock.
 *
 * Flow: gameplay keys are polled by systems via held()/wasPressed();
 * UI-affecting keys mutate the uiMode stack here and are mirrored to React
 * through the 'ui:stack' event. Windows that need a payload (dialogue target,
 * container id) have it set in the zustand store by the opening system.
 */

import { events, type GameMode } from './events';

export type UiMode =
  | 'pause'
  | 'inventory'
  | 'character'
  | 'spellbook'
  | 'journal'
  | 'map'
  | 'dialogue'
  | 'barter'
  | 'container'
  | 'book'
  | 'alchemy'
  | 'travel'
  | 'rest'
  | 'levelup'
  | 'saves'
  | 'settings'
  | 'ending';

export type Action =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'jump'
  | 'sprint'
  | 'interact'
  | 'sneak';

const ACTION_KEYS: Record<Action, readonly string[]> = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE'],
  sneak: ['KeyC'],
};

/** Window-toggle keys active during play with an empty stack. */
const TOGGLE_KEYS: Record<string, UiMode> = {
  Tab: 'inventory',
  KeyI: 'inventory',
  KeyJ: 'journal',
  KeyM: 'map',
  KeyK: 'spellbook',
  KeyT: 'rest',
};

class InputManager {
  private canvas: HTMLCanvasElement | null = null;
  private down = new Set<string>();
  private pressedEdges = new Set<string>();
  private releasedEdges = new Set<string>();

  private stack: UiMode[] = [];
  gameMode: GameMode = 'boot';

  locked = false;
  private wantLock = false;

  /** Accumulated pointer-lock mouse deltas, consumed by the camera each tick. */
  mouseDx = 0;
  mouseDy = 0;

  attackHeld = false;
  attackPressed = false;
  attackReleased = false;
  castPressed = false;

  /** Wheel steps since last tick (hotbar cycling). */
  wheelDelta = 0;

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('wheel', this.onWheel, { passive: true });
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('click', this.onDocClick);
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', this.clearAll);
  }

  // ----- UI mode stack ------------------------------------------------------

  get uiOpen(): boolean {
    return this.stack.length > 0;
  }

  get topMode(): UiMode | null {
    return this.stack.length ? (this.stack[this.stack.length - 1] as UiMode) : null;
  }

  pushMode(mode: UiMode): void {
    if (this.topMode === mode) return;
    this.stack.push(mode);
    this.syncLockToStack();
    events.emit('ui:stack', { stack: [...this.stack] });
  }

  popMode(): void {
    if (!this.stack.length) return;
    this.stack.pop();
    this.syncLockToStack();
    events.emit('ui:stack', { stack: [...this.stack] });
  }

  /** Close everything (e.g. returning to main menu, death). */
  clearModes(): void {
    if (!this.stack.length) return;
    this.stack.length = 0;
    this.syncLockToStack();
    events.emit('ui:stack', { stack: [] });
  }

  /** Replace whole stack (load game restoring play state). */
  setMode(mode: UiMode | null): void {
    this.stack.length = 0;
    if (mode) this.stack.push(mode);
    this.syncLockToStack();
    events.emit('ui:stack', { stack: [...this.stack] });
  }

  private syncLockToStack(): void {
    if (this.gameMode === 'play' && this.stack.length === 0) {
      this.requestLock();
    } else if (this.locked) {
      document.exitPointerLock();
    } else {
      this.wantLock = false;
    }
    this.clearAll();
  }

  /** Game calls this on mode transitions so lock policy can follow. */
  onGameMode(mode: GameMode): void {
    this.gameMode = mode;
    this.syncLockToStack();
  }

  // ----- pointer lock -------------------------------------------------------

  private requestLock(): void {
    this.wantLock = true;
    if (this.locked || !this.canvas) return;
    const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    // Chrome throttles re-lock after a user Esc; retry on next click via onDocClick.
    if (p && typeof p.catch === 'function') p.catch(() => undefined);
  }

  private onLockChange = (): void => {
    this.locked = document.pointerLockElement === this.canvas;
    events.emit('input:lock', { locked: this.locked });
    if (!this.locked) {
      this.clearAll();
      // Browser-initiated exit (user pressed Esc) while playing → pause.
      if (this.wantLock && this.gameMode === 'play' && this.stack.length === 0) {
        this.wantLock = false;
        this.pushMode('pause');
      }
    }
  };

  private onDocClick = (): void => {
    if (this.wantLock && !this.locked && this.gameMode === 'play' && this.stack.length === 0) {
      this.requestLock();
    }
  };

  // ----- key + mouse handlers -----------------------------------------------

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    // Never trap browser-level combos.
    if (e.metaKey || e.altKey) return;
    const code = e.code;

    // While typing in a real input (chargen name field), stay out of the way.
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;

    if (code === 'Tab' || code === 'F5' || code === 'F9' || code === 'Space') e.preventDefault();

    if (code === 'Escape') {
      // Only reachable when NOT pointer-locked (browser consumes Esc in lock).
      if (this.stack.length) {
        this.popMode();
      } else if (this.gameMode === 'play') {
        this.pushMode('pause');
      }
      return;
    }

    if (this.gameMode === 'play' && this.stack.length === 0) {
      const toggle = TOGGLE_KEYS[code];
      if (toggle) {
        this.pushMode(toggle);
        return;
      }
      if (code === 'F5') {
        events.emit('input:hotkey', { slot: -1 }); // quicksave sentinel
        return;
      }
      if (code === 'F9') {
        events.emit('input:hotkey', { slot: -2 }); // quickload sentinel
        return;
      }
      if (code.startsWith('Digit')) {
        const n = Number(code.slice(5));
        if (n >= 1 && n <= 8) {
          events.emit('input:hotkey', { slot: n });
          return;
        }
      }
    } else if (this.stack.length > 0) {
      // Window-toggle key closes its own window again.
      const toggle = TOGGLE_KEYS[code];
      if (toggle && this.topMode === toggle) {
        this.popMode();
        return;
      }
    }

    this.down.add(code);
    this.pressedEdges.add(code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
    this.releasedEdges.add(e.code);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.locked) return;
    if (e.button === 0) {
      this.attackHeld = true;
      this.attackPressed = true;
    } else if (e.button === 2) {
      this.castPressed = true;
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      if (this.attackHeld) this.attackReleased = true;
      this.attackHeld = false;
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.locked) return;
    this.mouseDx += e.movementX;
    this.mouseDy += e.movementY;
  };

  private onWheel = (e: WheelEvent): void => {
    if (!this.locked) return;
    this.wheelDelta += Math.sign(e.deltaY);
  };

  private clearAll = (): void => {
    this.down.clear();
    this.pressedEdges.clear();
    this.releasedEdges.clear();
    this.attackHeld = false;
    this.attackPressed = false;
    this.attackReleased = false;
    this.castPressed = false;
    this.mouseDx = 0;
    this.mouseDy = 0;
    this.wheelDelta = 0;
  };

  // ----- polled API (gameplay systems) ---------------------------------------

  held(action: Action): boolean {
    const keys = ACTION_KEYS[action];
    for (let i = 0; i < keys.length; i++) if (this.down.has(keys[i] as string)) return true;
    return false;
  }

  wasPressed(action: Action): boolean {
    const keys = ACTION_KEYS[action];
    for (let i = 0; i < keys.length; i++) {
      if (this.pressedEdges.has(keys[i] as string)) return true;
    }
    return false;
  }

  /** Consume accumulated mouse delta (camera). */
  consumeMouse(out: { dx: number; dy: number }): void {
    out.dx = this.mouseDx;
    out.dy = this.mouseDy;
    this.mouseDx = 0;
    this.mouseDy = 0;
  }

  /** Clear per-tick edge state. Game calls this at the END of each sim step. */
  postSimClear(): void {
    this.pressedEdges.clear();
    this.releasedEdges.clear();
    this.attackPressed = false;
    this.attackReleased = false;
    this.castPressed = false;
    this.wheelDelta = 0;
  }
}

export const input = new InputManager();
