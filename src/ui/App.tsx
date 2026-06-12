/**
 * UI shell — routes screens from gameMode + the uiMode stack. The 3D canvas
 * lives beneath; everything here composites at native resolution.
 */

import './theme.css';
import { topMode, useUi } from '@/ui/store';
import { MainMenu } from '@/ui/menus/MainMenu';
import { PauseMenu } from '@/ui/menus/PauseMenu';
import { SettingsMenu } from '@/ui/menus/SettingsMenu';
import { SaveLoadMenu } from '@/ui/menus/SaveLoadMenu';
import { CharGen } from '@/ui/chargen/CharGen';
import { Hud } from '@/ui/hud/Hud';
import { Toasts } from '@/ui/hud/Toasts';
import { DebugOverlay } from '@/ui/hud/DebugOverlay';
import { InventoryWindow } from '@/ui/windows/Inventory';
import { CharacterSheet } from '@/ui/windows/CharacterSheet';
import { ContainerLoot } from '@/ui/windows/ContainerLoot';
import { Spellbook } from '@/ui/windows/Spellbook';
import { DialogueWindow } from '@/ui/windows/Dialogue';
import { BarterWindow } from '@/ui/windows/Barter';
import { TravelWindow } from '@/ui/windows/Travel';
import { RestDialog } from '@/ui/windows/RestDialog';
import { BookReader } from '@/ui/windows/BookReader';
import { AlchemyWindow } from '@/ui/windows/Alchemy';
import { LevelUpDialog } from '@/ui/windows/LevelUp';
import { JournalWindow } from '@/ui/windows/Journal';
import { MapWindow } from '@/ui/windows/MapWindow';
import { EndingScreen } from '@/ui/windows/Ending';
import { CombatOverlays, DeathScreen } from '@/ui/hud/CombatHud';

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
      {gameMode === 'play' && top === null && (
        <>
          <div className="vm-crosshair" />
          <Prompt />
        </>
      )}
      {gameMode === 'play' && <Hud />}
      {gameMode === 'play' && <CombatOverlays />}
      {gameMode === 'dead' && <DeathScreen />}
      {gameMode === 'menu' && top === null && <MainMenu />}
      {gameMode === 'chargen' && top === null && <CharGen />}
      {top === 'pause' && <PauseMenu />}
      {top === 'settings' && <SettingsMenu />}
      {top === 'saves' && <SaveLoadMenu />}
      {top === 'inventory' && <InventoryWindow />}
      {top === 'character' && <CharacterSheet />}
      {top === 'container' && <ContainerLoot />}
      {top === 'spellbook' && <Spellbook />}
      {top === 'dialogue' && <DialogueWindow />}
      {top === 'barter' && <BarterWindow />}
      {top === 'travel' && <TravelWindow />}
      {top === 'rest' && <RestDialog />}
      {top === 'book' && <BookReader />}
      {top === 'alchemy' && <AlchemyWindow />}
      {top === 'levelup' && <LevelUpDialog />}
      {top === 'journal' && <JournalWindow />}
      {top === 'map' && <MapWindow />}
      {top === 'ending' && <EndingScreen />}
      <Toasts />
      <Blackout />
      {import.meta.env.DEV && <DebugOverlay />}
    </>
  );
}
