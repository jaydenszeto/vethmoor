import { createRoot } from 'react-dom/client';
import { Game } from '@/Game';
import { audio } from '@/audio/engine';
import { loadSettings, applySettings } from '@/engine/config';
import { deleteSave, listSaves } from '@/engine/saves';
import { equipItem, unequipSlot, usePotion } from '@/systems/inventory';
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
});

initUiBridge();
useUi.setState({ settings: { ...loadSettings() } });

createRoot(document.getElementById('ui-root') as HTMLElement).render(<App />);

void game.boot();

// Dev console helpers (stripped from production builds).
if (import.meta.env.DEV) {
  (window as unknown as { dbg: object }).dbg = {
    game,
    stats: () => game.stats(),
    tp: (x: number, z: number) => game.tp(x, z),
    setHour: (h: number) => game.setHour(h),
    setWeather: (k: 'clear' | 'overcast' | 'rain' | 'ashstorm') => game.setWeather(k),
    closeUi: () => input.clearModes(),
    interact: () => {
      // Headless-friendly: simulate an E press routed through the real path.
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
      window.setTimeout(
        () => document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true })),
        30,
      );
    },
  };
}
