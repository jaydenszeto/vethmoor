/**
 * UI shell — routes screens from gameMode + the uiMode stack. The 3D canvas
 * lives beneath; everything here composites at native resolution.
 */

import './theme.css';
import { topMode, useUi } from '@/ui/store';
import { MainMenu } from '@/ui/menus/MainMenu';
import { PauseMenu } from '@/ui/menus/PauseMenu';
import { SettingsMenu } from '@/ui/menus/SettingsMenu';
import { Toasts } from '@/ui/hud/Toasts';

export function App() {
  const gameMode = useUi((s) => s.gameMode);
  const stack = useUi((s) => s.uiStack);
  const top = topMode(stack);

  return (
    <>
      {gameMode === 'play' && top === null && <div className="vm-crosshair" />}
      {gameMode === 'menu' && top === null && <MainMenu />}
      {top === 'pause' && <PauseMenu />}
      {top === 'settings' && <SettingsMenu />}
      <Toasts />
    </>
  );
}
