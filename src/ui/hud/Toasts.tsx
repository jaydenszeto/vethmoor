import { useEffect } from 'react';
import { useUi } from '@/ui/store';

const TOAST_MS = 3200;

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);

  useEffect(() => {
    if (!toasts.length) return;
    const newest = toasts[toasts.length - 1] as { id: number };
    const t = window.setTimeout(() => dismiss(newest.id), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toasts, dismiss]);

  if (!toasts.length) return null;
  return (
    <div className="vm-toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`vm-toast vm-toast--${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
