/**
 * Character creation — a five-step rite over the drifting menu vista:
 * name → people → calling → birth-stone → the writ (review).
 */

import { useMemo, useState } from 'react';
import { RACES } from '@/data/races';
import { CLASSES } from '@/data/classes';
import { ATTRS, SKILLS } from '@/data/skillsDef';
import { BIRTH_STONES, createCharacter, type BirthStone } from '@/systems/stats';
import type { Culture } from '@/gen/names';
import { gameApi } from '@/ui/store';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

const STEPS = ['NAME', 'PEOPLE', 'CALLING', 'STONE', 'THE WRIT'] as const;

export function CharGen() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [race, setRace] = useState<Culture>('karthi');
  const [clazz, setClazz] = useState('sellsword');
  const [stone, setStone] = useState<BirthStone>('tide');

  const preview = useMemo(
    () => createCharacter(name || 'The Writ-Bearer', race, clazz, stone),
    [name, race, clazz, stone],
  );

  const next = (): void => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = (): void => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-dim" />
      <div className="vm-panel" style={{ width: 660, maxHeight: '86vh', overflowY: 'auto', padding: 'var(--sp-6)', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
          <PixelHeading text={STEPS[step] as string} scale={3} gradient={['#ffc97e', '#c25f1d']} />
          <span className="vm-label">
            {step + 1} / {STEPS.length}
          </span>
        </div>

        {step === 0 && (
          <div>
            <p style={{ color: 'var(--ink-dim)', marginTop: 0 }}>
              The harbormaster squints at the sealed writ, then at you. “And whom shall I record
              as delivered to Saltmere, alive and approximately whole?”
            </p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 24))}
              placeholder="Name"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-lg)',
                color: 'var(--ink)',
                background: 'var(--iron-0)',
                border: '1px solid var(--edge-bright)',
                outline: 'none',
              }}
            />
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            {RACES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRace(r.id)}
                className="vm-btn-frame"
                style={{
                  textAlign: 'left',
                  padding: 'var(--sp-3)',
                  borderColor: race === r.id ? 'var(--edge-ember)' : undefined,
                  color: race === r.id ? 'var(--ember)' : 'var(--ink-dim)',
                }}
              >
                <div style={{ fontSize: 'var(--text-lg)' }}>{r.name}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-fade)', fontVariant: 'normal', letterSpacing: 0 }}>
                  {r.blurb}
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            {CLASSES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setClazz(c.id)}
                className="vm-btn-frame"
                style={{
                  textAlign: 'left',
                  padding: 'var(--sp-3)',
                  borderColor: clazz === c.id ? 'var(--edge-ember)' : undefined,
                  color: clazz === c.id ? 'var(--ember)' : 'var(--ink-dim)',
                }}
              >
                <div style={{ fontSize: 'var(--text-lg)' }}>{c.name}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-fade)', fontVariant: 'normal', letterSpacing: 0 }}>
                  {c.blurb}
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--sp-3)' }}>
            {BIRTH_STONES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStone(s.id)}
                className="vm-btn-frame"
                style={{
                  padding: 'var(--sp-4)',
                  borderColor: stone === s.id ? 'var(--edge-ember)' : undefined,
                  color: stone === s.id ? 'var(--ember)' : 'var(--ink-dim)',
                }}
              >
                <div style={{ fontSize: 'var(--text-lg)' }}>{s.name}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-fade)', fontVariant: 'normal', letterSpacing: 0 }}>
                  {s.blurb}
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 4 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-5)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xl)', color: 'var(--ink)' }}>{preview.name}</div>
              <div style={{ color: 'var(--ink-dim)', marginBottom: 'var(--sp-3)' }}>
                {RACES.find((r) => r.id === race)?.name} ·{' '}
                {CLASSES.find((c) => c.id === clazz)?.name} ·{' '}
                {BIRTH_STONES.find((s) => s.id === stone)?.name}
              </div>
              <div className="vm-row" style={{ padding: '2px 0' }}>
                <span className="vm-label">Health</span>
                <span style={{ color: 'var(--blood)' }}>{preview.hpMax}</span>
              </div>
              <div className="vm-row" style={{ padding: '2px 0' }}>
                <span className="vm-label">Magicka</span>
                <span style={{ color: 'var(--arcane)' }}>{preview.mpMax}</span>
              </div>
              <div className="vm-row" style={{ padding: '2px 0' }}>
                <span className="vm-label">Fatigue</span>
                <span style={{ color: 'var(--moss)' }}>{preview.fatMax}</span>
              </div>
              <hr className="vm-rule" />
              {ATTRS.map((a) => (
                <div key={a.id} className="vm-row" style={{ padding: '1px 0' }}>
                  <span className="vm-label">{a.name}</span>
                  <span style={{ color: 'var(--ink)' }}>{preview.attrs[a.id]}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="vm-label" style={{ marginBottom: 6 }}>
                Major skills
              </div>
              {preview.major.map((s) => (
                <div key={s} className="vm-row" style={{ padding: '1px 0' }}>
                  <span style={{ color: 'var(--ink-dim)' }}>{SKILLS.find((d) => d.id === s)?.name}</span>
                  <span style={{ color: 'var(--verdigris)' }}>{preview.skills[s]}</span>
                </div>
              ))}
              <div className="vm-label" style={{ margin: '10px 0 6px' }}>
                Minor skills
              </div>
              {preview.minor.map((s) => (
                <div key={s} className="vm-row" style={{ padding: '1px 0' }}>
                  <span style={{ color: 'var(--ink-fade)' }}>{SKILLS.find((d) => d.id === s)?.name}</span>
                  <span style={{ color: 'var(--ink-dim)' }}>{preview.skills[s]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <hr className="vm-rule" style={{ marginTop: 'var(--sp-5)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button type="button" className="vm-btn-frame" onClick={step === 0 ? () => gameApi().toMenu() : back}>
            {step === 0 ? 'Abandon' : 'Back'}
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="vm-btn-frame vm-btn-frame--active" onClick={next}>
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="vm-btn-frame vm-btn-frame--active"
              onClick={() => gameApi().finishChargen(name, race, clazz, stone)}
            >
              Step ashore
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
