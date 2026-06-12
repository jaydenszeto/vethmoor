/** Container window: take items one by one or all at once. */

import { itemDef } from '@/data/items';
import { itemId } from '@/data/ids';
import { gameApi, useUi } from '@/ui/store';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

export function ContainerLoot() {
  const container = useUi((s) => s.container);
  if (!container) return null;

  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-panel" style={{ width: 380, padding: 'var(--sp-5)', position: 'relative' }}>
        <PixelHeading text={container.label.toUpperCase()} scale={2} color="#5fa285" tracking={1} />
        <hr className="vm-rule" />
        <div style={{ minHeight: 80, maxHeight: 280, overflowY: 'auto' }}>
          {container.items.length === 0 && (
            <div style={{ color: 'var(--ink-ghost)', fontStyle: 'italic' }}>Empty.</div>
          )}
          {container.items.map((s, i) => {
            const def = itemDef(s.id as never);
            const isGold = s.id === (itemId('gold') as string);
            return (
              <button
                key={`${s.id}-${i}`}
                type="button"
                className="vm-btn"
                style={{ fontSize: 'var(--text-md)', padding: '4px 14px' }}
                onClick={() => gameApi().lootTake(i)}
              >
                <span style={{ color: isGold ? 'var(--ember)' : undefined }}>
                  {def.name}
                  {s.n > 1 ? ` ×${s.n}` : ''}
                </span>
              </button>
            );
          })}
        </div>
        <hr className="vm-rule" />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            type="button"
            className="vm-btn-frame"
            disabled={container.items.length === 0}
            onClick={() => gameApi().lootTake(-1)}
          >
            Take all
          </button>
          <button type="button" className="vm-btn-frame" onClick={() => gameApi().closeTop()}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
