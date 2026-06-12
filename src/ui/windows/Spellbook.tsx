/** Spellbook: known spells by school; click to ready, chips bind hotkeys. */

import { ALL_SPELLS, spellCost } from '@/data/spells';
import type { SpellId } from '@/data/ids';
import { gameApi, useUi } from '@/ui/store';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

const SCHOOL_COLORS: Record<string, string> = {
  destruction: 'var(--ember)',
  restoration: 'var(--moss)',
  alteration: 'var(--arcane)',
  conjuration: 'var(--verdigris)',
};

export function Spellbook() {
  useUi((s) => s.charVersion);
  const c = gameApi().getCharacter();
  if (!c) return null;
  const known = c.spellsKnown
    .map((id) => ALL_SPELLS.find((s) => (s.id as string) === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined);

  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-dim" />
      <div className="vm-panel" style={{ width: 560, maxHeight: '82vh', overflowY: 'auto', padding: 'var(--sp-5)', position: 'relative' }}>
        <PixelHeading text="SPELLBOOK" scale={2} color="#5fa285" tracking={2} />
        <p style={{ color: 'var(--ink-fade)', fontSize: 'var(--text-sm)', margin: '6px 0 0' }}>
          Ready a spell, then cast with the right hand (right mouse). Number chips bind hotkeys 1–8.
        </p>
        <hr className="vm-rule" />
        {known.length === 0 && (
          <div style={{ color: 'var(--ink-ghost)', fontStyle: 'italic' }}>
            You know no spells. The Conclave teaches — for coin.
          </div>
        )}
        {known.map((s) => {
          const cost = spellCost(s, c.skills[s.school]);
          const hotIdx = c.hotkeys.indexOf(s.id as string);
          return (
            <div key={s.id} className="vm-row" style={{ padding: '5px 0', borderBottom: '1px solid rgba(95,162,133,0.08)' }}>
              <span>
                <button
                  type="button"
                  className="vm-btn-frame"
                  style={{ marginRight: 10 }}
                  onClick={() => gameApi().readySpell(s.id)}
                >
                  Ready
                </button>
                <span style={{ color: SCHOOL_COLORS[s.school] }}>{s.name}</span>
                <span style={{ color: 'var(--ink-ghost)', fontSize: 'var(--text-xs)', marginLeft: 8 }}>
                  {s.school} · {cost} mp
                </span>
              </span>
              <span style={{ display: 'flex', gap: 2 }}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`vm-btn-frame ${hotIdx === n - 1 ? 'vm-btn-frame--active' : ''}`}
                    style={{ padding: '0 5px', fontSize: 'var(--text-xs)' }}
                    onClick={() => gameApi().bindHotkey(s.id, n - 1)}
                  >
                    {n}
                  </button>
                ))}
              </span>
            </div>
          );
        })}
        <hr className="vm-rule" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="vm-btn-frame" onClick={() => gameApi().closeTop()}>
            Close (K)
          </button>
        </div>
      </div>
    </div>
  );
}

export type { SpellId };
