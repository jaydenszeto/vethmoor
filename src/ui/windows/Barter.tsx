/**
 * Barter window — merchant stock (buy) beside your goods (sell). Prices are
 * computed sim-side from disposition + Speechcraft and pushed whole.
 */

import { itemDef } from '@/data/items';
import type { ItemId } from '@/data/ids';
import { gameApi, useUi } from '@/ui/store';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

function TradeList({
  title,
  gold,
  rows,
  action,
  onDeal,
}: {
  title: string;
  gold: number;
  rows: { id: string; n: number; price: number }[];
  action: string;
  onDeal: (id: ItemId) => void;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="vm-row" style={{ padding: '0 0 4px' }}>
        <span className="vm-label">{title}</span>
        <span className="vm-label" style={{ color: 'var(--ember)' }}>{gold} gold</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--edge)', padding: '2px 6px', minHeight: 0 }}>
        {rows.length === 0 && (
          <div style={{ color: 'var(--ink-ghost)', fontStyle: 'italic', padding: 'var(--sp-2)' }}>Nothing to trade.</div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="vm-row" style={{ padding: '3px 0', borderBottom: '1px solid rgba(95,162,133,0.08)' }}>
            <span style={{ color: 'var(--ink)' }}>
              {itemDef(r.id as ItemId).name}
              {r.n > 1 && <span style={{ color: 'var(--ink-fade)' }}> ×{r.n}</span>}
            </span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className="vm-label" style={{ color: 'var(--ink-dim)' }}>{r.price}g</span>
              <button
                type="button"
                className="vm-btn-frame"
                style={{ padding: '1px 8px', fontSize: 'var(--text-xs)' }}
                onClick={() => onDeal(r.id as ItemId)}
              >
                {action}
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarterWindow() {
  const b = useUi((s) => s.barter);
  if (!b) return null;

  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-dim" />
      <div
        className="vm-panel"
        style={{ width: 740, height: 520, padding: 'var(--sp-5)', position: 'relative', display: 'flex', flexDirection: 'column' }}
      >
        <PixelHeading text={`TRADING — ${b.name.toUpperCase()}`} scale={2} color="#5fa285" tracking={2} />
        <hr className="vm-rule" />

        <div style={{ display: 'flex', gap: 'var(--sp-5)', flex: 1, minHeight: 0 }}>
          <TradeList title="Their wares" gold={b.merchantGold} rows={b.stock} action="Buy" onDeal={(id) => gameApi().barterBuy(id)} />
          <TradeList title="Your goods" gold={b.playerGold} rows={b.goods} action="Sell" onDeal={(id) => gameApi().barterSell(id)} />
        </div>

        <hr className="vm-rule" />
        <div className="vm-row" style={{ padding: 0 }}>
          <span style={{ color: 'var(--ink-dim)', fontStyle: 'italic', fontSize: 'var(--text-sm)' }}>
            {b.line ?? 'Disposition and Speechcraft move every price.'}
          </span>
          <button type="button" className="vm-btn-frame" onClick={() => gameApi().closeTop()}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
