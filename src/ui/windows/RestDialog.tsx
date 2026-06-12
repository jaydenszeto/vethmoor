/**
 * Rest dialog (T) — pick hours, heal through them, trigger the level-up rite
 * when progress is armed. The sim gates resting near enemies / in water.
 */

import { useMemo, useState } from 'react';
import { gameApi, useUi } from '@/ui/store';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

export function RestDialog() {
  useUi((s) => s.charVersion);
  const [hours, setHours] = useState(8);
  const gate = useMemo(() => gameApi().canRest(), []);
  const c = gameApi().getCharacter();
  if (!c) return null;
  const ready = c.levelProgress >= 10;

  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-dim" />
      <div className="vm-panel" style={{ width: 420, padding: 'var(--sp-5)', position: 'relative' }}>
        <PixelHeading text="REST" scale={2} color="#5fa285" tracking={2} />
        {!gate.ok ? (
          <>
            <p style={{ color: 'var(--blood)', margin: 'var(--sp-4) 0' }}>{gate.reason}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="vm-btn-frame" onClick={() => gameApi().closeTop()}>
                Stay awake (T)
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--ink-fade)', fontSize: 'var(--text-sm)', margin: '6px 0 0' }}>
              Sleep knits wounds and gathers magicka.
              {ready && <span style={{ color: 'var(--ember)' }}> Your skills have grown — resting will advance you.</span>}
            </p>
            <hr className="vm-rule" />
            <div className="vm-row">
              <span className="vm-label">Hours</span>
              <input
                type="range"
                className="vm-slider"
                min={1}
                max={24}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
              />
              <span style={{ color: 'var(--ink)', width: 28, textAlign: 'right' }}>{hours}</span>
            </div>
            <div style={{ display: 'flex', gap: 4, margin: '4px 0 0' }}>
              {[1, 4, 8, 12].map((h) => (
                <button
                  key={h}
                  type="button"
                  className={`vm-btn-frame ${hours === h ? 'vm-btn-frame--active' : ''}`}
                  style={{ padding: '2px 10px', fontSize: 'var(--text-xs)' }}
                  onClick={() => setHours(h)}
                >
                  {h}h
                </button>
              ))}
            </div>
            <hr className="vm-rule" />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button type="button" className="vm-btn-frame" onClick={() => gameApi().closeTop()}>
                Cancel (T)
              </button>
              <button type="button" className="vm-btn-frame vm-btn-frame--active" onClick={() => gameApi().rest(hours)}>
                Sleep
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
