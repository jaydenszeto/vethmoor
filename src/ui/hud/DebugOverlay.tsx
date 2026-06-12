/** Dev-only stats overlay. Toggle with F3. Polls window.dbg.stats() at 4 Hz. */

import { useEffect, useState } from 'react';

interface DbgApi {
  stats?: () => Record<string, unknown>;
}

export function DebugOverlay() {
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState<Record<string, unknown>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === 'F3') {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => {
      const dbg = (window as unknown as { dbg?: DbgApi }).dbg;
      if (dbg?.stats) setStats(dbg.stats());
    }, 250);
    return () => window.clearInterval(id);
  }, [visible]);

  if (!visible) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        padding: '6px 10px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        lineHeight: 1.5,
        color: 'var(--verdigris)',
        background: 'rgba(6,8,8,0.7)',
        border: '1px solid var(--edge)',
        pointerEvents: 'none',
        whiteSpace: 'pre',
      }}
    >
      {Object.entries(stats)
        .map(([k, v]) => `${k.padEnd(7)} ${String(v)}`)
        .join('\n')}
    </div>
  );
}
