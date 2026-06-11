import { createRoot } from 'react-dom/client';
import { Game } from '@/Game';
import { loadSettings, applySettings } from '@/engine/config';
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
  continueGame: () => undefined, // saves arrive in P4
  toMenu: () => game.toMenu(),
  closeTop: () => input.popMode(),
  openWindow: (mode) => input.pushMode(mode),
  applySettings: (partial) => {
    applySettings(partial);
    if (partial.renderHeight) game.setRenderHeight(partial.renderHeight);
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
    fps: () => game.loop.fps,
    draws: () => game.renderer.drawCalls,
  };
}
