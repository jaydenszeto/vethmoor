/**
 * Alchemy bench (B) — pick 2–4 ingredients; shared virtues brew. Effects on
 * each ingredient reveal with Alchemy skill (1 at novice → all 4 at 75+).
 */

import { useMemo, useState } from 'react';
import type { ItemId } from '@/data/ids';
import { itemDef } from '@/data/items';
import { effectsOf, revealedEffects, sharedEffects } from '@/systems/alchemy';
import { gameApi, useUi } from '@/ui/store';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

export function AlchemyWindow() {
  useUi((s) => s.charVersion);
  const [picked, setPicked] = useState<ItemId[]>([]);
  const [line, setLine] = useState<string | null>(null);
  const c = gameApi().getCharacter();

  const ingredients = useMemo(() => {
    if (!c) return [];
    return c.inventory
      .map((s) => ({ stack: s, def: itemDef(s.id) }))
      .filter(({ def }) => def.kind === 'ingredient')
      .sort((a, b) => a.def.name.localeCompare(b.def.name));
  }, [c, c?.inventory.length, useUi.getState().charVersion]);

  if (!c) return null;
  const revealed = revealedEffects(c);
  const shared = sharedEffects(picked);

  const toggle = (id: ItemId): void => {
    setLine(null);
    setPicked((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id);
      if (p.length >= 4) return p;
      return [...p, id];
    });
  };

  const doBrew = (): void => {
    const result = gameApi().brewPotion(picked);
    setLine(result);
    setPicked([]);
  };

  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-dim" />
      <div
        className="vm-panel"
        style={{ width: 640, height: 520, padding: 'var(--sp-5)', position: 'relative', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <PixelHeading text="ALCHEMY" scale={2} color="#5fa285" tracking={2} />
          <span className="vm-label">Alchemy {c.skills.alchemy} · {revealed}/4 virtues seen</span>
        </div>
        <hr className="vm-rule" />

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {ingredients.length === 0 && (
            <div style={{ color: 'var(--ink-ghost)', fontStyle: 'italic', padding: 'var(--sp-3)' }}>
              No ingredients. The marsh, the steppe and the merchants all carry them.
            </div>
          )}
          {ingredients.map(({ stack, def }) => {
            const sel = picked.includes(def.id);
            return (
              <button
                key={def.id}
                type="button"
                className={`vm-btn-frame ${sel ? 'vm-btn-frame--active' : ''}`}
                style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 2, padding: '4px 10px' }}
                onClick={() => toggle(def.id)}
              >
                <span>
                  {def.name}
                  {stack.n > 1 && <span style={{ color: 'var(--ink-fade)' }}> ×{stack.n}</span>}
                </span>
                <span style={{ color: 'var(--ink-fade)', fontSize: 'var(--text-xs)', fontVariant: 'normal', letterSpacing: 0 }}>
                  {effectsOf(def.id)
                    .map((e, i) => (i < revealed ? e : '?'))
                    .join(' · ')}
                </span>
              </button>
            );
          })}
        </div>

        <hr className="vm-rule" />
        <div className="vm-row" style={{ padding: 0 }}>
          <span style={{ fontSize: 'var(--text-sm)' }}>
            {line ? (
              <span style={{ color: 'var(--verdigris)', fontStyle: 'italic' }}>{line}</span>
            ) : picked.length < 2 ? (
              <span className="vm-label">Choose 2–4 ingredients ({picked.length} chosen)</span>
            ) : shared.length ? (
              <span style={{ color: 'var(--ember)' }}>Shared virtues: {shared.join(', ')}</span>
            ) : (
              <span style={{ color: 'var(--ink-fade)' }}>No shared virtue — it would only make soup.</span>
            )}
          </span>
          <span style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="vm-btn-frame" disabled={picked.length < 2} onClick={doBrew}>
              Brew
            </button>
            <button type="button" className="vm-btn-frame" onClick={() => gameApi().closeTop()}>
              Close (B)
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
