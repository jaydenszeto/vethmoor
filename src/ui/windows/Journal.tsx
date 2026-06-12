/**
 * Journal (J) — quests on parchment, faction standing, known topics.
 * Entries read newest-first like a kept diary.
 */

import { useMemo, useState } from 'react';
import { gameApi, useUi } from '@/ui/store';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

type Tab = 'quests' | 'factions' | 'topics';

export function JournalWindow() {
  const questVersion = useUi((s) => s.questVersion);
  useUi((s) => s.charVersion);
  const [tab, setTab] = useState<Tab>('quests');
  const data = useMemo(() => gameApi().getJournal(), [questVersion, tab]);

  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-dim" />
      <div
        className="vm-panel"
        style={{ width: 700, height: 540, padding: 'var(--sp-5)', position: 'relative', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <PixelHeading text="JOURNAL" scale={2} color="#5fa285" tracking={2} />
          <span style={{ display: 'flex', gap: 4 }}>
            {(['quests', 'factions', 'topics'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`vm-btn-frame ${tab === t ? 'vm-btn-frame--active' : ''}`}
                style={{ padding: '2px 10px', fontSize: 'var(--text-xs)' }}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </span>
        </div>
        <hr className="vm-rule" />

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {tab === 'quests' && (
            <div className="vm-parchment" style={{ padding: 'var(--sp-4) var(--sp-5)', minHeight: '100%' }}>
              {data.quests.length === 0 && (
                <div style={{ color: 'var(--quill-fade)', fontStyle: 'italic' }}>The pages are blank. The March will fix that.</div>
              )}
              {data.quests.map((q) => (
                <div key={q.quest} style={{ marginBottom: 'var(--sp-5)' }}>
                  <div
                    style={{
                      fontVariant: 'small-caps',
                      letterSpacing: '0.12em',
                      fontSize: 'var(--text-lg)',
                      color: q.complete ? 'var(--quill-fade)' : 'var(--quill)',
                    }}
                  >
                    {q.name}
                    {q.complete && <span style={{ fontSize: 'var(--text-xs)', marginLeft: 8 }}>· concluded</span>}
                  </div>
                  {q.entries.map((e, i) => (
                    <div key={i} style={{ margin: '6px 0 0', lineHeight: 1.5, color: i === 0 ? 'var(--quill)' : 'var(--quill-dim)' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--quill-fade)', marginRight: 8 }}>Day {e.day}</span>
                      {e.text}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {tab === 'factions' &&
            data.factions.map((f) => (
              <div key={f.id} style={{ border: '1px solid var(--edge)', padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-3)' }}>
                <div className="vm-row" style={{ padding: 0 }}>
                  <span style={{ fontVariant: 'small-caps', letterSpacing: '0.08em', fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
                    {f.name}
                  </span>
                  <span className="vm-label" style={{ color: f.joined ? 'var(--ember)' : undefined }}>
                    {f.joined ? `${f.rank} · ${f.rep} standing` : 'not joined'}
                  </span>
                </div>
                <div style={{ color: 'var(--ink-fade)', fontSize: 'var(--text-sm)', fontStyle: 'italic', marginTop: 2 }}>{f.blurb}</div>
                {f.duty && (
                  <div style={{ color: 'var(--verdigris)', fontSize: 'var(--text-sm)', marginTop: 4 }}>Active duty: {f.duty}</div>
                )}
              </div>
            ))}

          {tab === 'topics' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {data.topics.length === 0 && (
                <div style={{ color: 'var(--ink-ghost)', fontStyle: 'italic', padding: 'var(--sp-3)' }}>
                  Nothing noted yet. People talk, if you let them.
                </div>
              )}
              {data.topics.map((t) => (
                <span key={t.id} className="vm-btn-frame" style={{ padding: '2px 10px', fontSize: 'var(--text-xs)', cursor: 'default' }}>
                  {t.keyword}
                </span>
              ))}
            </div>
          )}
        </div>

        <hr className="vm-rule" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="vm-btn-frame" onClick={() => gameApi().closeTop()}>
            Close (J)
          </button>
        </div>
      </div>
    </div>
  );
}
