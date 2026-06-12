/** Book reader — a tall parchment leaf. Skill books teach +1 on first read. */

import { gameApi, useUi } from '@/ui/store';

export function BookReader() {
  const b = useUi((s) => s.book);
  if (!b) return null;

  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-dim" />
      <div
        className="vm-parchment"
        style={{ width: 540, height: '78vh', padding: 'var(--sp-8)', position: 'relative', display: 'flex', flexDirection: 'column' }}
      >
        <div
          style={{
            fontVariant: 'small-caps',
            letterSpacing: '0.16em',
            fontSize: 'var(--text-xl)',
            textAlign: 'center',
            color: 'var(--quill)',
            marginBottom: 'var(--sp-2)',
          }}
        >
          {b.title}
        </div>
        <div style={{ height: 1, background: 'rgba(60,44,24,0.4)', margin: '0 15% var(--sp-4)' }} />
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            fontSize: 'var(--text-md)',
            lineHeight: 1.6,
            color: 'var(--quill-dim)',
          }}
        >
          {b.text}
        </div>
        {b.note && (
          <div style={{ marginTop: 'var(--sp-3)', color: '#3c6a59', fontStyle: 'italic', textAlign: 'center', fontSize: 'var(--text-sm)' }}>
            {b.note}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--sp-3)' }}>
          <button
            type="button"
            className="vm-btn-frame"
            style={{ background: 'rgba(36,28,18,0.85)', borderColor: 'rgba(36,28,18,0.9)' }}
            onClick={() => gameApi().closeTop()}
          >
            Close the covers
          </button>
        </div>
      </div>
    </div>
  );
}
