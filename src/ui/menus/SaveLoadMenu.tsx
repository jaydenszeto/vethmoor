/** Save/Load slots — from the pause menu (save+load) or main menu (load only). */

import { useEffect, useState } from 'react';
import { SLOTS, type SlotId } from '@/engine/saves';
import { gameApi, refreshSaves, useUi } from '@/ui/store';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

export function SaveLoadMenu() {
  const saves = useUi((s) => s.saves);
  const gameMode = useUi((s) => s.gameMode);
  const canSave = gameMode === 'play';
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshSaves();
  }, []);

  const metaFor = (slot: SlotId) => saves.find((s) => s.slot === slot);

  const doSave = async (slot: SlotId): Promise<void> => {
    setBusy(true);
    const label = slot === 'quick' ? 'Quicksave' : slot === 'auto' ? 'Autosave' : `Slot ${slot.slice(1)}`;
    await gameApi().saveSlot(slot, label);
    await refreshSaves();
    setBusy(false);
  };

  const doLoad = async (slot: SlotId): Promise<void> => {
    setBusy(true);
    await gameApi().loadSlot(slot);
    setBusy(false);
  };

  const doDelete = async (slot: SlotId): Promise<void> => {
    setBusy(true);
    await gameApi().deleteSave(slot);
    await refreshSaves();
    setBusy(false);
  };

  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-dim" />
      <div className="vm-panel" style={{ width: 520, maxHeight: '80vh', overflowY: 'auto', padding: 'var(--sp-5)', position: 'relative' }}>
        <PixelHeading text="CHRONICLES" scale={2} color="#5fa285" tracking={2} />
        <hr className="vm-rule" />
        {SLOTS.map((slot) => {
          const meta = metaFor(slot);
          const isAuto = slot === 'auto';
          return (
            <div key={slot} className="vm-row" style={{ padding: '4px 0', borderBottom: '1px solid rgba(95,162,133,0.08)' }}>
              <span>
                <span className="vm-label" style={{ marginRight: 10 }}>
                  {slot === 'quick' ? 'Quick' : isAuto ? 'Auto' : `Slot ${slot.slice(1)}`}
                </span>
                <span style={{ color: meta ? 'var(--ink)' : 'var(--ink-ghost)' }}>
                  {meta ? meta.playerLabel : 'empty'}
                </span>
              </span>
              <span style={{ display: 'flex', gap: 4 }}>
                {canSave && !isAuto && (
                  <button type="button" className="vm-btn-frame" disabled={busy} style={{ padding: '2px 10px', fontSize: 'var(--text-xs)' }} onClick={() => void doSave(slot)}>
                    Save
                  </button>
                )}
                {meta && (
                  <button type="button" className="vm-btn-frame" disabled={busy} style={{ padding: '2px 10px', fontSize: 'var(--text-xs)' }} onClick={() => void doLoad(slot)}>
                    Load
                  </button>
                )}
                {meta && !isAuto && (
                  <button type="button" className="vm-btn-frame" disabled={busy} style={{ padding: '2px 10px', fontSize: 'var(--text-xs)', color: 'var(--blood)' }} onClick={() => void doDelete(slot)}>
                    ✕
                  </button>
                )}
              </span>
            </div>
          );
        })}
        <hr className="vm-rule" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="vm-btn-frame" onClick={() => gameApi().closeTop()}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
