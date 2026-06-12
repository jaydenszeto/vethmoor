/**
 * Title screen — left-anchored editorial stack over the live 3D backdrop.
 * One orchestrated entrance: kicker → title → rule → items, staggered.
 */

import { useEffect } from 'react';
import { gameApi, refreshSaves, useUi } from '@/ui/store';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

export function MainMenu() {
  const hasSave = useUi((s) => s.hasSave);

  useEffect(() => {
    void refreshSaves();
  }, []);

  return (
    <div className="vm-fill vm-fade-in">
      {/* legibility wash, heavier on the left where the type lives */}
      <div
        className="vm-fill"
        style={{
          background:
            'linear-gradient(100deg, rgba(4,6,6,0.86) 0%, rgba(4,6,6,0.55) 34%, rgba(4,6,6,0.05) 70%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 'clamp(32px, 8vw, 120px)',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'auto',
        }}
      >
        <div className="vm-rise" style={{ ['--i' as string]: 0 }}>
          <PixelHeading
            text="THE ASHEN MARCH"
            scale={2}
            color="#5fa285"
            tracking={2}
            shadow="rgba(0,0,0,0.6)"
          />
        </div>

        <div className="vm-rise" style={{ ['--i' as string]: 1, margin: '10px 0 2px' }}>
          <PixelHeading
            text="VETHMOOR"
            scale={9}
            gradient={['#ffc97e', '#c25f1d']}
            shadow="rgba(0,0,0,0.65)"
            tracking={1}
          />
        </div>

        <div
          className="vm-rise"
          style={{
            ['--i' as string]: 2,
            width: 320,
            height: 1,
            margin: '18px 0 26px',
            background: 'linear-gradient(90deg, rgba(95,162,133,0.55), transparent)',
          }}
        />

        <nav style={{ width: 280 }}>
          <div className="vm-rise" style={{ ['--i' as string]: 3 }}>
            <button type="button" className="vm-btn" onClick={() => gameApi().newGame()}>
              New Game
            </button>
          </div>
          <div className="vm-rise" style={{ ['--i' as string]: 4 }}>
            <button
              type="button"
              className="vm-btn"
              disabled={!hasSave}
              onClick={() => gameApi().continueGame()}
            >
              Continue
            </button>
          </div>
          <div className="vm-rise" style={{ ['--i' as string]: 5 }}>
            <button
              type="button"
              className="vm-btn"
              disabled={!hasSave}
              onClick={() => gameApi().openWindow('saves')}
            >
              Chronicles
            </button>
          </div>
          <div className="vm-rise" style={{ ['--i' as string]: 6 }}>
            <button
              type="button"
              className="vm-btn"
              onClick={() => gameApi().openWindow('settings')}
            >
              Settings
            </button>
          </div>
        </nav>

        <div
          className="vm-rise"
          style={{ ['--i' as string]: 7, marginTop: 38, maxWidth: 340 }}
        >
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--ink-fade)', fontStyle: 'italic' }}>
            “The ash is his breath. The storms are his turning.”
          </p>
          <p style={{ margin: '14px 0 0', fontSize: 'var(--text-xs)', color: 'var(--ink-ghost)', letterSpacing: '0.06em' }}>
            v0.1 · every texture, model &amp; sound conjured procedurally — nothing downloaded
          </p>
        </div>
      </div>
    </div>
  );
}
