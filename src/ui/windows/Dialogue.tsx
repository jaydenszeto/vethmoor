/**
 * Dialogue window — Morrowind topic hyperlinks on a parchment log.
 * Left: conversation manuscript ([topic] words are live links).
 * Right: known-topic index, persuasion tools, services.
 */

import { useEffect, useRef } from 'react';
import { extractSegments } from '@/systems/dialogue';
import { gameApi, useUi } from '@/ui/store';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

const ROLE_LABELS: Record<string, string> = {
  villager: 'Villager',
  guard: 'Guard',
  trader: 'Trader',
  innkeep: 'Innkeeper',
  priest: 'Priest of the Tides',
  noble: 'Noble',
  nomad: 'Ash Nomad',
};

function LogText({ text }: { text: string }) {
  return (
    <>
      {extractSegments(text).map((seg, i) =>
        seg.link ? (
          <span key={i} className="vm-topic-link" onClick={() => gameApi().chooseTopic(seg.link as string)}>
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

export function DialogueWindow() {
  const d = useUi((s) => s.dialogue);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [d?.log.length]);

  if (!d) return null;

  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-dim" />
      <div
        className="vm-panel"
        style={{ width: 760, height: 540, padding: 'var(--sp-5)', position: 'relative', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <PixelHeading text={d.name.toUpperCase()} scale={2} color="#5fa285" tracking={2} />
          <span className="vm-label">{ROLE_LABELS[d.role] ?? d.role}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', margin: '6px 0 2px' }}>
          <span className="vm-label">Disposition</span>
          <div className="vm-meter" style={{ flex: 1 }}>
            <i style={{ width: `${d.disposition}%` }} />
          </div>
          <span className="vm-label" style={{ color: 'var(--ink-dim)' }}>{d.disposition}</span>
        </div>
        <hr className="vm-rule" />

        <div style={{ display: 'flex', gap: 'var(--sp-4)', flex: 1, minHeight: 0 }}>
          {/* Manuscript log */}
          <div
            ref={logRef}
            className="vm-parchment"
            style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-4) var(--sp-5)', fontSize: 'var(--text-md)', lineHeight: 1.55 }}
          >
            {d.log.map((entry, i) => (
              <div key={i} style={{ marginBottom: 'var(--sp-3)' }}>
                {entry.topic && (
                  <div
                    style={{
                      fontVariant: 'small-caps',
                      letterSpacing: '0.1em',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--quill-fade)',
                      marginBottom: 2,
                    }}
                  >
                    {entry.topic}
                  </div>
                )}
                <LogText text={entry.text} />
              </div>
            ))}
          </div>

          {/* Topic index + tools */}
          <div style={{ width: 210, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="vm-label" style={{ marginBottom: 4 }}>Topics</div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {d.topics.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="vm-btn-frame"
                  style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 2, padding: '3px 10px' }}
                  onClick={() => gameApi().chooseTopic(t.id)}
                >
                  {t.keyword}
                </button>
              ))}
            </div>
            <hr className="vm-rule" />
            <div className="vm-label" style={{ marginBottom: 4 }}>Persuasion</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
              <button type="button" className="vm-btn-frame" style={{ padding: '3px 6px', fontSize: 'var(--text-xs)' }} onClick={() => gameApi().persuade('admire')}>
                Admire
              </button>
              <button type="button" className="vm-btn-frame" style={{ padding: '3px 6px', fontSize: 'var(--text-xs)' }} onClick={() => gameApi().persuade('intimidate')}>
                Intimidate
              </button>
              <button type="button" className="vm-btn-frame" style={{ padding: '3px 6px', fontSize: 'var(--text-xs)' }} onClick={() => gameApi().persuade('bribe10')}>
                Bribe 10g
              </button>
              <button type="button" className="vm-btn-frame" style={{ padding: '3px 6px', fontSize: 'var(--text-xs)' }} onClick={() => gameApi().persuade('bribe50')}>
                Bribe 50g
              </button>
            </div>
            {d.canBarter && (
              <button
                type="button"
                className="vm-btn-frame vm-btn-frame--active"
                style={{ width: '100%', marginTop: 'var(--sp-3)' }}
                onClick={() => gameApi().openBarter()}
              >
                Barter
              </button>
            )}
            <button type="button" className="vm-btn-frame" style={{ width: '100%', marginTop: 6 }} onClick={() => gameApi().closeTop()}>
              Goodbye
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
