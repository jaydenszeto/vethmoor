/**
 * The Drowned Throne — the choice, then the chosen epilogue. The world
 * continues afterward; only the sky is different.
 */

import { gameApi, useUi } from '@/ui/store';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

const EPILOGUE: Record<'sever' | 'rebind', { title: string; text: string }> = {
  sever: {
    title: 'THE LONG MORNING',
    text: `You reach into the dream and cut.

There is no sound. There is the opposite of sound — a silence that starts beneath the volcano and rolls outward across the March like a tide going out for the last time. Somewhere above you, the Ember Tooth exhales, and for the first time in anyone's history, nothing rides the breath.

The storms end that week. The shared dreams end that night.

The fungal towers will stand for a generation, the scholars say, then settle into ordinary forest. The ash-fields will go to grass. Vethmoor will become a smaller place — a province, a coastline, a land like other lands, where children sleep in their own heads and the sea gives back only what fishermen put into it.

In Saltmere they ring the temple bell for Sela Veth, who did not live to see the sky she purchased. You stood at the rail of the dock that evening and found you could not remember your dreams. You never would again. It felt — and you have stopped apologizing for this — like a door, closing kindly.

The March endures. It is what it was always for.`,
  },
  rebind: {
    title: 'THE TENDED FIRE',
    text: `You reach into the dream and mend.

The tear closes the way deep water closes — without seam, without scar, without thanks. The throne's drowned king sighs once, a sound you will spend the rest of your life failing to describe, and settles back into the sleep that makes the March possible.

The ash falls fine again that season. The lattice, the Conclave reports with something close to reverence, is finer than any record: the dreams come up silver now, all of them, and the whole of Vethmoor wakes rested.

The wonder stays. The price stays with it. The storms will come back someday — sleep is not stillness — and some other writ-bearer will stand where you stood and choose again. The Choir sings a tenth note now, in the deep fanes. They say it is your name. They are probably lying. Probably.

In Saltmere, Sela Veth lived three weeks past the mending, long enough to dream the silver dream once. "Worth it," she said, and died smiling, and the gulls rode the warm ash-wind over her burying.

The March endures — strange, grotesque, dreaming, alive. You kept the fire lit. Tend it.`,
  },
};

export function EndingScreen() {
  const ending = useUi((s) => s.ending);
  if (!ending) return null;

  if (ending === 'choice') {
    return (
      <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
        <div className="vm-dim" style={{ background: 'rgba(2, 4, 5, 0.88)' }} />
        <div className="vm-panel" style={{ width: 640, padding: 'var(--sp-8)', position: 'relative', textAlign: 'center' }}>
          <PixelHeading text="THE DROWNED THRONE" scale={2} color="#ff9a3c" tracking={3} />
          <p style={{ color: 'var(--ink-dim)', lineHeight: 1.6, margin: 'var(--sp-5) 0' }}>
            The hall is the one from everyone’s dream. The chair is not empty. Ulmoth’s sleep moves through the stone like slow
            weather, and the tear in it hangs before you, close enough to touch — close enough to <em>choose</em>.
          </p>
          <div style={{ display: 'flex', gap: 'var(--sp-4)', justifyContent: 'center', marginTop: 'var(--sp-5)' }}>
            <button
              type="button"
              className="vm-btn-frame"
              style={{ padding: 'var(--sp-3) var(--sp-5)', fontSize: 'var(--text-md)' }}
              onClick={() => gameApi().chooseEnding('sever')}
            >
              Sever the dream
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-fade)', marginTop: 4 }}>
                End the storms. End the wonder. Free the March of its god.
              </div>
            </button>
            <button
              type="button"
              className="vm-btn-frame"
              style={{ padding: 'var(--sp-3) var(--sp-5)', fontSize: 'var(--text-md)' }}
              onClick={() => gameApi().chooseEnding('rebind')}
            >
              Re-bind the sleeper
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-fade)', marginTop: 4 }}>
                Mend the tear. Keep the wonder — and the suffering it feeds.
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const ep = EPILOGUE[ending];
  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-dim" style={{ background: 'rgba(2, 4, 5, 0.92)' }} />
      <div
        className="vm-parchment"
        style={{ width: 560, maxHeight: '82vh', padding: 'var(--sp-8)', position: 'relative', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ fontVariant: 'small-caps', letterSpacing: '0.18em', fontSize: 'var(--text-xl)', textAlign: 'center', color: 'var(--quill)' }}>
          {ep.title}
        </div>
        <div style={{ height: 1, background: 'rgba(60,44,24,0.4)', margin: 'var(--sp-3) 15% var(--sp-4)' }} />
        <div style={{ flex: 1, overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.65, color: 'var(--quill-dim)', fontSize: 'var(--text-md)' }}>
          {ep.text}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--sp-4)' }}>
          <button
            type="button"
            className="vm-btn-frame"
            style={{ background: 'rgba(36,28,18,0.85)', borderColor: 'rgba(36,28,18,0.9)' }}
            onClick={() => gameApi().closeTop()}
          >
            Walk the March
          </button>
        </div>
      </div>
    </div>
  );
}
