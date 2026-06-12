/** Inventory: equipment paper-doll (left) + filterable item list (right). */

import { useMemo, useState } from 'react';
import type { ItemId } from '@/data/ids';
import { itemDef, type EquipSlot } from '@/data/items';
import { encumbrance } from '@/systems/inventory';
import { maxCarry } from '@/systems/stats';
import { gameApi, useUi } from '@/ui/store';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

const SLOT_LAYOUT: ReadonlyArray<[EquipSlot, string]> = [
  ['head', 'Head'],
  ['amulet', 'Amulet'],
  ['cuirass', 'Cuirass'],
  ['robe', 'Robe'],
  ['shirt', 'Shirt'],
  ['gauntlets', 'Hands'],
  ['ring1', 'Ring'],
  ['ring2', 'Ring'],
  ['greaves', 'Greaves'],
  ['pants', 'Pants'],
  ['boots', 'Boots'],
  ['weapon', 'Weapon'],
  ['shield', 'Shield'],
];

type Filter = 'all' | 'weapons' | 'apparel' | 'consumables' | 'misc';

export function InventoryWindow() {
  useUi((s) => s.charVersion); // re-render on character mutations
  const [filter, setFilter] = useState<Filter>('all');
  const c = gameApi().getCharacter();

  const list = useMemo(() => {
    if (!c) return [];
    return c.inventory
      .map((s) => ({ stack: s, def: itemDef(s.id) }))
      .filter(({ def }) => {
        if (filter === 'all') return true;
        if (filter === 'weapons') return def.kind === 'weapon' || def.id === ('arrow' as ItemId);
        if (filter === 'apparel') return def.kind === 'armor' || def.kind === 'clothing';
        if (filter === 'consumables') return def.kind === 'potion' || def.kind === 'ingredient';
        return def.kind === 'book' || def.kind === 'tool' || def.kind === 'misc';
      })
      .sort((a, b) => a.def.name.localeCompare(b.def.name));
  }, [c, filter, c?.inventory.length, useUi.getState().charVersion]);

  if (!c) return null;
  const enc = encumbrance(c);
  const encMax = maxCarry(c);

  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-dim" />
      <div className="vm-panel" style={{ width: 700, height: 520, padding: 'var(--sp-5)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <PixelHeading text="POSSESSIONS" scale={2} color="#5fa285" tracking={2} />
          <span className="vm-label" style={{ color: enc > encMax ? 'var(--blood)' : undefined }}>
            {enc} / {encMax} burden · {c.gold} gold
          </span>
        </div>
        <hr className="vm-rule" />

        <div style={{ display: 'flex', gap: 'var(--sp-5)', flex: 1, minHeight: 0 }}>
          {/* Paper-doll */}
          <div style={{ width: 230 }}>
            {SLOT_LAYOUT.map(([slot, label]) => {
              const id = c.equipment[slot];
              return (
                <button
                  key={slot}
                  type="button"
                  className="vm-btn-frame"
                  onClick={() => id && gameApi().unequipSlot(slot)}
                  title={id ? 'Unequip' : ''}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    width: '100%',
                    marginBottom: 3,
                    padding: '3px 10px',
                    color: id ? 'var(--ink)' : 'var(--ink-ghost)',
                  }}
                >
                  <span className="vm-label">{label}</span>
                  <span style={{ fontVariant: 'normal', letterSpacing: 0 }}>
                    {id ? itemDef(id).name : '—'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Item list */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              {(['all', 'weapons', 'apparel', 'consumables', 'misc'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`vm-btn-frame ${filter === f ? 'vm-btn-frame--active' : ''}`}
                  style={{ padding: '2px 8px', fontSize: 'var(--text-xs)' }}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {list.length === 0 && (
                <div style={{ color: 'var(--ink-ghost)', fontStyle: 'italic', padding: 'var(--sp-3)' }}>
                  Nothing but lint and resolve.
                </div>
              )}
              {list.map(({ stack, def }) => (
                <div
                  key={def.id}
                  className="vm-row"
                  style={{ padding: '3px 6px', borderBottom: '1px solid rgba(95,162,133,0.08)' }}
                >
                  <span style={{ color: 'var(--ink)' }}>
                    {def.name}
                    {stack.n > 1 && <span style={{ color: 'var(--ink-fade)' }}> ×{stack.n}</span>}
                  </span>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span className="vm-label">{def.weight}w</span>
                    {(def.weapon || def.armor || def.clothing) && (
                      <button type="button" className="vm-btn-frame" style={{ padding: '1px 8px', fontSize: 'var(--text-xs)' }} onClick={() => gameApi().equipItem(def.id)}>
                        Equip
                      </button>
                    )}
                    {def.potion && (
                      <button type="button" className="vm-btn-frame" style={{ padding: '1px 8px', fontSize: 'var(--text-xs)' }} onClick={() => gameApi().usePotion(def.id)}>
                        Drink
                      </button>
                    )}
                    {def.book && (
                      <button type="button" className="vm-btn-frame" style={{ padding: '1px 8px', fontSize: 'var(--text-xs)' }} onClick={() => gameApi().readBook(def.id)}>
                        Read
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <hr className="vm-rule" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="vm-btn-frame" onClick={() => gameApi().closeTop()}>
            Close (Tab)
          </button>
        </div>
      </div>
    </div>
  );
}
