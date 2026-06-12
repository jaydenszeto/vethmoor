import { gameApi } from '@/ui/store';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

export function PauseMenu() {
  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-dim" />
      <div className="vm-panel" style={{ width: 320, padding: 'var(--sp-6)', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--sp-5)' }}>
          <PixelHeading text="REST YOUR BLADE" scale={2} color="#5fa285" tracking={2} />
        </div>
        <button type="button" className="vm-btn" onClick={() => gameApi().closeTop()}>
          Return
        </button>
        <button type="button" className="vm-btn" onClick={() => gameApi().openWindow('saves')}>
          Chronicles
        </button>
        <button type="button" className="vm-btn" onClick={() => gameApi().openWindow('settings')}>
          Settings
        </button>
        <hr className="vm-rule" />
        <button type="button" className="vm-btn vm-btn--danger" onClick={() => gameApi().toMenu()}>
          Abandon to Menu
        </button>
      </div>
    </div>
  );
}
