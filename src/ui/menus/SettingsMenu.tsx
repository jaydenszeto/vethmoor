import { gameApi, useUi } from '@/ui/store';
import type { RenderHeight } from '@/render/renderer';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

const HEIGHTS: readonly RenderHeight[] = [270, 360, 450];

export function SettingsMenu() {
  const settings = useUi((s) => s.settings);
  const setSettings = useUi((s) => s.setSettings);

  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-dim" />
      <div className="vm-panel" style={{ width: 420, padding: 'var(--sp-6)', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--sp-5)' }}>
          <PixelHeading text="SETTINGS" scale={2} color="#5fa285" tracking={2} />
        </div>

        <div className="vm-row">
          <span className="vm-label">Render resolution</span>
          <span style={{ display: 'flex', gap: 6 }}>
            {HEIGHTS.map((h) => (
              <button
                key={h}
                type="button"
                className={`vm-btn-frame ${settings.renderHeight === h ? 'vm-btn-frame--active' : ''}`}
                onClick={() => setSettings({ renderHeight: h })}
              >
                {h}p
              </button>
            ))}
          </span>
        </div>

        <div className="vm-row">
          <span className="vm-label">Mouse sensitivity</span>
          <input
            type="range"
            className="vm-slider"
            min={0.0008}
            max={0.005}
            step={0.0001}
            value={settings.mouseSens}
            onChange={(e) => setSettings({ mouseSens: Number(e.target.value) })}
          />
        </div>

        <div className="vm-row">
          <span className="vm-label">Invert Y</span>
          <button
            type="button"
            className={`vm-btn-frame ${settings.invertY ? 'vm-btn-frame--active' : ''}`}
            onClick={() => setSettings({ invertY: !settings.invertY })}
          >
            {settings.invertY ? 'On' : 'Off'}
          </button>
        </div>

        <div className="vm-row">
          <span className="vm-label">Fog density</span>
          <input
            type="range"
            className="vm-slider"
            min={0.5}
            max={1.5}
            step={0.05}
            value={settings.fogMult}
            onChange={(e) => setSettings({ fogMult: Number(e.target.value) })}
          />
        </div>

        <div className="vm-row">
          <span className="vm-label">Master volume</span>
          <input
            type="range"
            className="vm-slider"
            min={0}
            max={1}
            step={0.05}
            value={settings.volMaster}
            onChange={(e) => setSettings({ volMaster: Number(e.target.value) })}
          />
        </div>

        <hr className="vm-rule" />
        <button type="button" className="vm-btn" onClick={() => gameApi().closeTop()}>
          Done
        </button>
      </div>
    </div>
  );
}
