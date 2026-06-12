/** One-shot sound effects, all synthesized. */

import { mix32 } from '@/engine/rng';
import { noiseBurst, tone } from './synth';

export type Surface = 'grass' | 'dirt' | 'rock' | 'sand' | 'mud' | 'water';

let stepCounter = 0;

/** Tiny deterministic variation per call (no Math.random). */
function jitter(scale: number): number {
  stepCounter++;
  return ((mix32(stepCounter) / 4294967296) * 2 - 1) * scale;
}

export function footstep(surface: Surface, sneaking: boolean): void {
  const g = (sneaking ? 0.08 : 0.2) * (1 + jitter(0.2));
  switch (surface) {
    case 'grass':
      noiseBurst({ filter: 'lowpass', freq: 480 + jitter(80), dur: 0.09, gain: g });
      break;
    case 'dirt':
      noiseBurst({ filter: 'lowpass', freq: 660 + jitter(100), dur: 0.085, gain: g });
      noiseBurst({ filter: 'bandpass', freq: 1900, q: 2, dur: 0.03, gain: g * 0.3, when: 0.01 });
      break;
    case 'rock':
      noiseBurst({ filter: 'bandpass', freq: 1150 + jitter(150), q: 1.4, dur: 0.06, gain: g });
      break;
    case 'sand':
      noiseBurst({ filter: 'highpass', freq: 900, dur: 0.13, gain: g * 0.8 });
      break;
    case 'mud':
      noiseBurst({
        filter: 'lowpass',
        freq: 420 + jitter(60),
        freqEnd: 160,
        dur: 0.16,
        gain: g * 1.1,
      });
      break;
    case 'water':
      noiseBurst({ filter: 'bandpass', freq: 850 + jitter(150), q: 1.1, dur: 0.18, gain: g });
      tone({ freq: 520 + jitter(120), freqEnd: 240, dur: 0.07, gain: g * 0.25 });
      break;
  }
}

export function landThump(intensity: number): void {
  noiseBurst({ filter: 'lowpass', freq: 240, freqEnd: 90, dur: 0.18, gain: 0.12 + intensity * 0.2 });
}

export function uiClick(): void {
  tone({ freq: 1900, dur: 0.035, gain: 0.07, type: 'square' });
}

export function uiHover(): void {
  tone({ freq: 1300, dur: 0.02, gain: 0.03, type: 'square' });
}
