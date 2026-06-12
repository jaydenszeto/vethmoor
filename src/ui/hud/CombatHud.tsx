/** Combat HUD overlays: damage vignette, cast flash, target bar, readied spell, death. */

import { useEffect, useState } from 'react';
import { events } from '@/engine/events';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

const SCHOOL_GLOW: Record<string, string> = {
  destruction: 'rgba(255,122,48,0.45)',
  restoration: 'rgba(126,154,98,0.45)',
  alteration: 'rgba(111,163,200,0.45)',
  conjuration: 'rgba(95,162,133,0.5)',
};

export function CombatOverlays() {
  const [dmgPulse, setDmgPulse] = useState(0);
  const [castGlow, setCastGlow] = useState<string | null>(null);
  const [target, setTarget] = useState<{ name: string; frac: number } | null>(null);
  const [spell, setSpell] = useState<string | null>(null);

  useEffect(() => {
    const offs = [
      events.on('hud:damage', () => {
        setDmgPulse((p) => p + 1);
        window.setTimeout(() => setDmgPulse((p) => Math.max(0, p - 1)), 360);
      }),
      events.on('cast:flash', ({ school }) => {
        setCastGlow(SCHOOL_GLOW[school] ?? SCHOOL_GLOW.conjuration ?? null);
        window.setTimeout(() => setCastGlow(null), 320);
      }),
      events.on('hud:target', ({ name, frac }) => {
        setTarget(name ? { name, frac } : null);
      }),
      events.on('hud:spell', ({ name }) => setSpell(name)),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  useEffect(() => {
    if (!target) return;
    const t = window.setTimeout(() => setTarget(null), 3500);
    return () => window.clearTimeout(t);
  }, [target]);

  return (
    <>
      {dmgPulse > 0 && (
        <div
          className="vm-fill"
          style={{
            background: 'radial-gradient(80% 80% at 50% 50%, transparent 55%, rgba(180,40,20,0.4))',
            transition: 'opacity 300ms',
          }}
        />
      )}
      {castGlow && (
        <div
          className="vm-fill"
          style={{
            background: `radial-gradient(95% 95% at 50% 50%, transparent 70%, ${castGlow})`,
          }}
        />
      )}
      {target && (
        <div style={{ position: 'absolute', left: '50%', top: 'calc(50% + 26px)', transform: 'translateX(-50%)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-dim)', fontVariant: 'small-caps', letterSpacing: '0.08em' }}>
            {target.name}
          </div>
          <div style={{ width: 90, height: 5, background: 'rgba(6,8,8,0.8)', border: '1px solid var(--edge)', margin: '2px auto 0' }}>
            <div style={{ width: `${target.frac * 100}%`, height: '100%', background: 'var(--blood)' }} />
          </div>
        </div>
      )}
      {spell && (
        <div
          style={{
            position: 'absolute',
            right: 18,
            bottom: 16,
            fontSize: 'var(--text-sm)',
            color: 'var(--arcane)',
            fontVariant: 'small-caps',
            letterSpacing: '0.08em',
            textShadow: '0 1px 0 rgba(0,0,0,0.7)',
          }}
        >
          ✦ {spell}
        </div>
      )}
    </>
  );
}

export function DeathScreen() {
  return (
    <div className="vm-center vm-fade-in">
      <div className="vm-fill" style={{ background: 'radial-gradient(80% 80% at 50% 50%, rgba(20,4,2,0.5), rgba(8,2,1,0.92))' }} />
      <div style={{ position: 'relative', textAlign: 'center' }}>
        <PixelHeading text="THE MARCH TAKES ANOTHER" scale={4} gradient={['#c14b35', '#5d1f12']} />
        <p style={{ color: 'var(--ink-fade)', fontStyle: 'italic', marginTop: 14 }}>
          …but the tide gives back what it takes.
        </p>
      </div>
    </div>
  );
}
