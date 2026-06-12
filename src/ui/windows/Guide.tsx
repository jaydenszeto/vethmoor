/**
 * Field Guide (H) — the one screen a new Writ-Bearer needs to start playing.
 * Auto-opens once as a "welcome" the moment a fresh character spawns (pushed
 * into the uiStack so pointer lock politely lets go), and is reachable any
 * time from the title screen, the pause menu, or the H key.
 */

import { useEffect } from 'react';
import { gameApi, useUi } from '@/ui/store';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

interface Row {
  keys: string[];
  text: string;
}
interface Section {
  title: string;
  rows: Row[];
}

const SECTIONS: Section[] = [
  {
    title: 'Move & Look',
    rows: [
      { keys: ['W', 'A', 'S', 'D'], text: 'walk the world' },
      { keys: ['Mouse'], text: 'look around' },
      { keys: ['Space'], text: 'jump' },
      { keys: ['Shift'], text: 'sprint' },
      { keys: ['C'], text: 'sneak' },
    ],
  },
  {
    title: 'Touch the World',
    rows: [
      { keys: ['E'], text: 'talk, open doors, loot, pull levers — whenever a word and an [E] surface at the crosshair' },
      { keys: ['Click'], text: 'capture the mouse to play' },
      { keys: ['Esc'], text: 'pause, and free the mouse' },
    ],
  },
  {
    title: 'Fight & Cast',
    rows: [
      { keys: ['LMB'], text: 'hold to wind a strike or draw the bow — release to loose it' },
      { keys: ['RMB'], text: 'cast the readied spell' },
      { keys: ['1–8'], text: 'ready a spell to the hand' },
      { keys: ['Wheel'], text: 'cycle through your spells' },
    ],
  },
  {
    title: 'Your Books',
    rows: [
      { keys: ['Tab'], text: 'inventory & what you wear' },
      { keys: ['V'], text: 'character — attributes & skills' },
      { keys: ['K'], text: 'spellbook' },
      { keys: ['J'], text: 'journal — quests, factions, people' },
      { keys: ['M'], text: 'map of Vethmoor' },
    ],
  },
  {
    title: 'Survive & Grow',
    rows: [
      { keys: ['T'], text: 'rest to heal — and rise a level when you are ready' },
      { keys: ['B'], text: 'brew at an alchemy bench' },
      { keys: [], text: 'Skills sharpen the more you use them. Fall in battle and you wake at the nearest temple.' },
    ],
  },
  {
    title: 'Keep the March',
    rows: [
      { keys: ['F5'], text: 'quicksave' },
      { keys: ['F9'], text: 'quickload' },
      { keys: ['H'], text: 'reopen this guide, any time' },
    ],
  },
];

function Key({ label }: { label: string }) {
  return <kbd className="vm-key">{label}</kbd>;
}

function GuideRow({ keys, text }: Row) {
  return (
    <div className="vm-guide-row">
      <span className="vm-guide-keys">
        {keys.length === 0 ? (
          <span className="vm-key" style={{ visibility: 'hidden' }} aria-hidden />
        ) : (
          keys.map((k) => <Key key={k} label={k} />)
        )}
      </span>
      <span>{text}</span>
    </div>
  );
}

export function Guide() {
  const welcome = useUi((s) => s.guideWelcome);
  const name = welcome ? gameApi().getCharacter()?.name ?? 'Writ-Bearer' : null;

  // The welcome flag is a one-shot: clear it when this screen leaves so the
  // next open (pause menu, H key) shows the plain reference, not the greeting.
  useEffect(() => {
    return () => {
      if (useUi.getState().guideWelcome) useUi.setState({ guideWelcome: false });
    };
  }, []);

  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-dim" />
      <div
        className="vm-panel"
        style={{
          width: 'min(820px, 92vw)',
          maxHeight: '88vh',
          padding: 'var(--sp-5) var(--sp-6)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--sp-4)' }}>
          <PixelHeading text={welcome ? 'WELCOME' : 'FIELD GUIDE'} scale={2} color="#5fa285" tracking={2} />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-fade)', fontVariant: 'small-caps', letterSpacing: '0.1em' }}>
            press <kbd className="vm-key" style={{ height: 18, minWidth: 18 }}>H</kbd> in the world to return here
          </span>
        </div>
        <hr className="vm-rule" />

        <div style={{ overflowY: 'auto', paddingRight: 'var(--sp-2)' }}>
          {/* the charge — what to actually do first */}
          <div className="vm-guide-charge" style={{ marginBottom: 'var(--sp-4)' }}>
            <div style={{ fontVariant: 'small-caps', letterSpacing: '0.12em', color: 'var(--ember)', fontSize: 'var(--text-sm)' }}>
              Your charge
            </div>
            <p style={{ margin: '4px 0 0', lineHeight: 1.55, color: 'var(--ink)' }}>
              {welcome && (
                <span style={{ color: 'var(--ink-dim)' }}>{name}, the pardon you were granted was always a summons. </span>
              )}
              You wake in <strong style={{ color: 'var(--bone)', fontWeight: 600 }}>Saltmere</strong>, a town of ash and salt. Its
              dying seer called for someone who can walk where she only dreamt — <strong style={{ color: 'var(--bone)', fontWeight: 600 }}>find her</strong>.
              Walk up to a townsfolk and press <Key label="E" /> to talk; open your journal with <Key label="J" /> to follow the thread.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))',
              gap: 'var(--sp-3)',
            }}
          >
            {SECTIONS.map((s) => (
              <div key={s.title} className="vm-guide-card">
                <h3>{s.title}</h3>
                {s.rows.map((r, i) => (
                  <GuideRow key={i} keys={r.keys} text={r.text} />
                ))}
              </div>
            ))}
          </div>

          <p
            style={{
              margin: 'var(--sp-4) 0 0',
              fontSize: 'var(--text-xs)',
              color: 'var(--ink-ghost)',
              fontStyle: 'italic',
              lineHeight: 1.5,
            }}
          >
            Vethmoor keeps no quest markers and few hand-holds — it trusts you to wander, to ask, to read what you find. That is the
            whole pleasure of it. Tend the fire. Tend the sleeper.
          </p>
        </div>

        <hr className="vm-rule" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="vm-btn-frame" onClick={() => gameApi().closeTop()}>
            {welcome ? 'Enter Vethmoor' : 'Close (H)'}
          </button>
        </div>
      </div>
    </div>
  );
}
