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
import { DebugOverlay } from '@/ui/hud/DebugOverlay';

function Prompt() {
  const prompt = useUi((s) => s.prompt);
  if (!prompt) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '54%',
        transform: 'translateX(-50%)',
        fontSize: 'var(--text-md)',
        fontVariant: 'small-caps',
        letterSpacing: '0.06em',
        color: 'var(--ink)',
        textShadow: '0 1px 0 rgba(0,0,0,0.8)',
      }}
    >
      {prompt}
      <span style={{ color: 'var(--ink-fade)', marginLeft: 8, fontSize: 'var(--text-xs)' }}>[E]</span>
    </div>
  );
}

function Blackout() {
  const fading = useUi((s) => s.fading);
  return <div className={`vm-blackout ${fading ? 'vm-blackout--on' : ''}`} />;
}

export function App() {
  const gameMode = useUi((s) => s.gameMode);
  const stack = useUi((s) => s.uiStack);
  const top = topMode(stack);

  return (
    <>
      {gameMode === 'play' && top === null && <div className="vm-crosshair" />}
      {gameMode === 'play' && top === null && <Prompt />}
      {gameMode === 'menu' && top === null && <MainMenu />}
      {top === 'pause' && <PauseMenu />}
      {top === 'settings' && <SettingsMenu />}
      <Toasts />
      <Blackout />
      {import.meta.env.DEV && <DebugOverlay />}
    </>
  );
}
