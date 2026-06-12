/**
 * Dune-strider travel window — fares scale with distance (10 + 4/km) and the
 * clock advances at strider pace while the screen rides through black.
 */

import { gameApi, useUi } from '@/ui/store';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

export function TravelWindow() {
  useUi((s) => s.charVersion);
  const t = useUi((s) => s.travel);
  const gold = gameApi().getCharacter()?.gold ?? 0;
  if (!t) return null;

  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-dim" />
      <div className="vm-panel" style={{ width: 600, maxHeight: '80vh', overflowY: 'auto', padding: 'var(--sp-5)', position: 'relative' }}>
        <PixelHeading text="DUNE-STRIDER CARAVAN" scale={2} color="#5fa285" tracking={2} />
        <p style={{ color: 'var(--ink-fade)', fontSize: 'var(--text-sm)', margin: '6px 0 0' }}>
          The beetle kneels at {t.from}. The driver names fares; the March names the hours. You carry {gold} gold.
        </p>
        <hr className="vm-rule" />

        {t.options.map((o) => {
          const broke = gold < o.fare;
          return (
            <div key={o.id} className="vm-row" style={{ padding: '7px 0', borderBottom: '1px solid rgba(95,162,133,0.08)', alignItems: 'flex-start' }}>
              <span>
                <span style={{ color: 'var(--ink)', fontVariant: 'small-caps', letterSpacing: '0.06em', fontSize: 'var(--text-lg)' }}>
                  {o.name}
                </span>
                <div style={{ color: 'var(--ink-fade)', fontSize: 'var(--text-xs)', fontStyle: 'italic' }}>{o.tagline}</div>
                <div className="vm-label" style={{ marginTop: 2 }}>
                  {o.km} km · ~{o.hours} hour{o.hours > 1 ? 's' : ''}
                </div>
              </span>
              <button
                type="button"
                className="vm-btn-frame"
                disabled={broke}
                style={{ whiteSpace: 'nowrap' }}
                onClick={() => gameApi().travelTo(o.id)}
              >
                Ride — {o.fare}g
              </button>
            </div>
          );
        })}

        <hr className="vm-rule" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="vm-btn-frame" onClick={() => gameApi().closeTop()}>
            Stay
          </button>
        </div>
      </div>
    </div>
  );
}
