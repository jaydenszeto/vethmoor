/**
 * Level-up rite — pick 3 attributes; multipliers (×1–×5) come from the
 * governed skill-ups banked since the last level.
 */

import { useState } from 'react';
import { ATTRS } from '@/data/skillsDef';
import { attrMultiplier } from '@/systems/stats';
import { gameApi, useUi } from '@/ui/store';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

export function LevelUpDialog() {
  useUi((s) => s.charVersion);
  const [picks, setPicks] = useState<string[]>([]);
  const c = gameApi().getCharacter();
  if (!c) return null;

  const toggle = (id: string): void => {
    setPicks((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id);
      if (p.length >= 3) return p;
      return [...p, id];
    });
  };

  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-dim" />
      <div className="vm-panel" style={{ width: 460, padding: 'var(--sp-5)', position: 'relative' }}>
        <PixelHeading text="THE MARCH SHAPES YOU" scale={2} color="#ff9a3c" tracking={2} />
        <p style={{ color: 'var(--ink-fade)', fontSize: 'var(--text-sm)', margin: '6px 0 0' }}>
          Level {c.level} → {c.level + 1}. Choose three attributes; what you practiced rises further.
        </p>
        <hr className="vm-rule" />

        {ATTRS.map((a) => {
          const mult = attrMultiplier(c.attrUps[a.id]);
          const sel = picks.includes(a.id);
          const capped = c.attrs[a.id] >= 100;
          return (
            <button
              key={a.id}
              type="button"
              className={`vm-btn-frame ${sel ? 'vm-btn-frame--active' : ''}`}
              disabled={capped && !sel}
              style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 3, padding: '4px 12px' }}
              onClick={() => toggle(a.id)}
            >
              <span>{a.name}</span>
              <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span style={{ color: 'var(--ink-fade)' }}>{c.attrs[a.id]}</span>
                <span style={{ color: mult > 1 ? 'var(--ember)' : 'var(--ink-ghost)', fontSize: 'var(--text-xs)', width: 24, textAlign: 'right' }}>
                  ×{mult}
                </span>
              </span>
            </button>
          );
        })}

        <hr className="vm-rule" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="vm-btn-frame vm-btn-frame--active"
            disabled={picks.length !== 3}
            onClick={() => gameApi().applyLevelUp(picks as unknown as [string, string, string])}
          >
            Advance ({picks.length}/3)
          </button>
        </div>
      </div>
    </div>
  );
}
