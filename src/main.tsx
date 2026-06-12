import { createRoot } from 'react-dom/client';
import { Game } from '@/Game';
import { audio } from '@/audio/engine';
import { loadSettings, applySettings } from '@/engine/config';
import { events } from '@/engine/events';
import { deleteSave, listSaves } from '@/engine/saves';
import { addItem, equipItem, unequipSlot, usePotion } from '@/systems/inventory';
import { input } from '@/engine/input';
import { setWorldSeed } from '@/engine/rng';
import { App } from '@/ui/App';
import { initUiBridge, registerGameAPI, useUi } from '@/ui/store';

setWorldSeed('VETHMOOR-1');
loadSettings();

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const game = new Game(canvas);

registerGameAPI({
  newGame: () => game.newGame(),
  continueGame: () => void game.continueGame(),
  toMenu: () => game.toMenu(),
  closeTop: () => input.popMode(),
  openWindow: (mode) => input.pushMode(mode),
  applySettings: (partial) => {
    applySettings(partial);
    if (partial.renderHeight) game.setRenderHeight(partial.renderHeight);
    audio.applyVolumes();
  },
  finishChargen: (name, race, classId, stone) => game.finishChargen(name, race, classId, stone),
  getCharacter: () => game.character,
  equipItem: (id) => {
    if (game.character) equipItem(game.character, id);
    game.pushHudStats();
  },
  unequipSlot: (slot) => {
    if (game.character) unequipSlot(game.character, slot);
    game.pushHudStats();
  },
  usePotion: (id) => {
    if (game.character) usePotion(game.character, id);
    game.pushHudStats();
  },
  lootTake: (index) => game.lootTake(index),
  saveSlot: (slot, label) => game.saveSlot(slot, label),
  loadSlot: (slot) => game.loadSlot(slot),
  deleteSave: (slot) => deleteSave(slot),
  listSaves: () => listSaves(),
  getYaw: () => game.player.yaw,
  readySpell: (id) => game.combat.readySpell(id as never),
  bindHotkey: (id, slot) => {
    const c = game.character;
    if (!c) return;
    // One spell per slot; clear duplicates.
    for (let i = 0; i < c.hotkeys.length; i++) {
      if (c.hotkeys[i] === (id as string)) c.hotkeys[i] = null;
    }
    c.hotkeys[slot] = id as string;
    game.pushHudStats();
    events.emit('char:changed', {});
  },
});

initUiBridge();
useUi.setState({ settings: { ...loadSettings() } });

createRoot(document.getElementById('ui-root') as HTMLElement).render(<App />);

void game.boot();

// Dev console helpers (stripped from production builds).
if (import.meta.env.DEV) {
  (window as unknown as { dbg: object }).dbg = {
    game,
    input,
    stats: () => game.stats(),
    tp: (x: number, z: number) => game.tp(x, z),
    setHour: (h: number) => game.setHour(h),
    setWeather: (k: 'clear' | 'overcast' | 'rain' | 'ashstorm') => game.setWeather(k),
    closeUi: () => input.clearModes(),
    headless: () => {
      input.headless = true;
      input.clearModes();
    },
    give: (id: string, n = 1) => {
      if (game.character) equipOrAdd(game.character, id, n);
    },
    spawn: (kind: string, dist = 8) => {
      const b = game.player.body;
      return game.spawns.spawn(
        kind as never,
        b.x - Math.sin(game.player.yaw) * dist,
        b.z - Math.cos(game.player.yaw) * dist,
        game.world.query,
        `dbg:${kind}:${Math.floor(performance.now())}`,
      );
    },
    kill: () => {
      for (const a of game.spawns.actors) {
        if (a.alive && !a.friendly) a.takeDamage(99999, 0, 0);
      }
    },
    godmode: () => {
      if (game.character) {
        game.character.hpMax = 9999;
        game.character.hp = 9999;
        game.character.mpMax = 9999;
        game.character.mp = 9999;
      }
    },
    interact: () => {
      // Headless-friendly: simulate an E press routed through the real path.
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
      window.setTimeout(
        () => document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true })),
        30,
      );
    },
    attack: () => {
      input.locked = true; // headless: mouse handlers gate on lock
      document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
      window.setTimeout(() => document.dispatchEvent(new MouseEvent('mouseup', { button: 0 })), 250);
    },
    cast: () => {
      input.locked = true;
      document.dispatchEvent(new MouseEvent('mousedown', { button: 2 }));
      window.setTimeout(() => document.dispatchEvent(new MouseEvent('mouseup', { button: 2 })), 60);
    },
  };
}

function equipOrAdd(c: NonNullable<Game['character']>, id: string, n: number): void {
  addItem(c, id as never, n);
}
