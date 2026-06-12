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

// ----- combat ---------------------------------------------------------------

export function swingWhoosh(): void {
  noiseBurst({ filter: 'bandpass', freq: 600 + jitter(100), freqEnd: 1800, q: 1.6, dur: 0.16, gain: 0.14, attack: 0.02 });
}

export function meleeHit(): void {
  noiseBurst({ filter: 'lowpass', freq: 900, freqEnd: 250, dur: 0.12, gain: 0.3 });
  tone({ freq: 180 + jitter(40), freqEnd: 90, dur: 0.09, gain: 0.16 });
}

export function bowRelease(): void {
  tone({ freq: 320, freqEnd: 110, dur: 0.07, gain: 0.18, type: 'triangle' });
  noiseBurst({ filter: 'highpass', freq: 1400, dur: 0.08, gain: 0.1 });
}

export function castWhoosh(): void {
  noiseBurst({ filter: 'bandpass', freq: 700, freqEnd: 2600, q: 2.5, dur: 0.28, gain: 0.16, attack: 0.04 });
  tone({ freq: 520 + jitter(60), freqEnd: 1050, dur: 0.22, gain: 0.08, type: 'sine' });
}

export function castDud(): void {
  tone({ freq: 220, freqEnd: 140, dur: 0.14, gain: 0.1, type: 'square' });
}

export function hurtGrunt(): void {
  tone({ freq: 190 + jitter(35), freqEnd: 120, dur: 0.13, gain: 0.16, type: 'sawtooth' });
  noiseBurst({ filter: 'lowpass', freq: 500, dur: 0.1, gain: 0.12 });
}

export function enemyGrowl(baseFreq: number): void {
  tone({ freq: baseFreq * (1 + jitter(0.15)), freqEnd: baseFreq * 0.7, dur: 0.22, gain: 0.12, type: 'sawtooth' });
}

export function enemyDie(baseFreq: number): void {
  tone({ freq: baseFreq, freqEnd: baseFreq * 0.4, dur: 0.5, gain: 0.15, type: 'sawtooth' });
  noiseBurst({ filter: 'lowpass', freq: 420, freqEnd: 120, dur: 0.4, gain: 0.14 });
}

export function arrowImpact(): void {
  noiseBurst({ filter: 'bandpass', freq: 1500, q: 3, dur: 0.05, gain: 0.16 });
}

export function spellImpact(): void {
  noiseBurst({ filter: 'lowpass', freq: 1200, freqEnd: 300, dur: 0.2, gain: 0.22 });
  tone({ freq: 800, freqEnd: 200, dur: 0.16, gain: 0.1 });
}
