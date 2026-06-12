/**
 * In-world HUD: vitals (bottom-left, Morrowind corner), compass strip
 * (top-center, canvas-drawn at rAF from live yaw), level-ready ember.
 */

import { useEffect, useRef } from 'react';
import { gameApi, useUi } from '@/ui/store';

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const frac = Math.max(0, Math.min(1, value / Math.max(1, max)));
  return (
    <div
      title={`${label} ${Math.round(value)}/${Math.round(max)}`}
      style={{
        width: 148,
        height: 10,
        background: 'rgba(6,8,8,0.78)',
        border: '1px solid var(--edge)',
        boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.6)',
        marginTop: 4,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 1,
          width: `calc(${frac * 100}% - 2px)`,
          background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 55%, black))`,
          transition: 'width 120ms linear',
        }}
      />
    </div>
  );
}

export function Hud() {
  const hud = useUi((s) => s.hud);
  return (
    <>
      <div style={{ position: 'absolute', left: 18, bottom: 16 }}>
        <Bar value={hud.hp} max={hud.hpMax} color="#c14b35" label="Health" />
        <Bar value={hud.mp} max={hud.mpMax} color="#5b87ab" label="Magicka" />
        <Bar value={hud.fat} max={hud.fatMax} color="#7e9a62" label="Fatigue" />
        {hud.levelReady && (
          <div
            style={{
              marginTop: 6,
              fontSize: 'var(--text-xs)',
              color: 'var(--ember)',
              letterSpacing: '0.08em',
              fontVariant: 'small-caps',
              textShadow: '0 0 8px rgba(255,154,60,0.5)',
            }}
          >
            rest to advance
          </div>
        )}
      </div>
      <Compass />
    </>
  );
}

const DIRS: ReadonlyArray<[number, string]> = [
  [0, 'N'],
  [Math.PI / 2, 'W'],
  [Math.PI, 'S'],
  [(3 * Math.PI) / 2, 'E'],
];

function Compass() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dpr = Math.min(2, window.devicePixelRatio);
    const W = 240;
    const H = 26;
    el.width = W * dpr;
    el.height = H * dpr;
    el.style.width = `${W}px`;
    el.style.height = `${H}px`;
    const ctx = el.getContext('2d') as CanvasRenderingContext2D;
    ctx.scale(dpr, dpr);
    let raf = 0;
    const PXPERRAD = W / (Math.PI * 1.2); // ~108° field shown

    const draw = (): void => {
      raf = requestAnimationFrame(draw);
      const yaw = gameApi().getYaw();
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(6,8,8,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(95,162,133,0.35)';
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

      // Ticks every 15°, cardinal labels.
      ctx.textAlign = 'center';
      for (let d = 0; d < 24; d++) {
        const ang = (d * Math.PI) / 12;
        // Screen offset for this absolute bearing.
        let rel = ang - yaw;
        while (rel > Math.PI) rel -= Math.PI * 2;
        while (rel < -Math.PI) rel += Math.PI * 2;
        const x = W / 2 + rel * PXPERRAD;
        if (x < 4 || x > W - 4) continue;
        const major = d % 6 === 0;
        ctx.fillStyle = major ? 'rgba(232,224,207,0.9)' : 'rgba(232,224,207,0.3)';
        ctx.fillRect(x, H - (major ? 9 : 5), 1, major ? 7 : 3);
      }
      ctx.font = '11px ui-monospace, monospace';
      for (const [ang, label] of DIRS) {
        let rel = ang - yaw;
        while (rel > Math.PI) rel -= Math.PI * 2;
        while (rel < -Math.PI) rel += Math.PI * 2;
        const x = W / 2 + rel * PXPERRAD;
        if (x < 10 || x > W - 10) continue;
        ctx.fillStyle = label === 'N' ? '#ff9a3c' : 'rgba(232,224,207,0.85)';
        ctx.fillText(label, x, 13);
      }
      // Center needle.
      ctx.fillStyle = '#ff9a3c';
      ctx.fillRect(W / 2, 1, 1, 5);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ position: 'absolute', left: '50%', top: 14, transform: 'translateX(-50%)' }}
    />
  );
}
