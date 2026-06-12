/**
 * Seeded value noise + fBm + domain warp. Pure functions of (x, y, seed) —
 * the terrain's height field is one continuous mathematical object, which is
 * what makes chunk seams impossible by construction.
 *
 * FROZEN once content exists (same contract as rng.ts).
 */

import { hash2f } from '@/engine/rng';

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Single-octave value noise in [-1, 1]. Frequency 1 = lattice cell of 1 unit. */
export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = smooth(xf);
  const v = smooth(yf);
  const a = hash2f(xi, yi, seed);
  const b = hash2f(xi + 1, yi, seed);
  const c = hash2f(xi, yi + 1, seed);
  const d = hash2f(xi + 1, yi + 1, seed);
  const top = a + (b - a) * u;
  const bot = c + (d - c) * u;
  return (top + (bot - top) * v) * 2 - 1;
}

/** Fractal Brownian motion, `octaves` octaves of value noise. Output ≈ [-1, 1]. */
export function fbm(x: number, y: number, seed: number, octaves: number, lacunarity = 2, gain = 0.5): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq, seed + i * 1013) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Ridged multifractal in [0, 1] — sharp crests for volcanic rock. */
export function ridged(x: number, y: number, seed: number, octaves: number): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise(x * freq, y * freq, seed + i * 2027));
    sum += n * n * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/**
 * Domain-warped fBm: offsets the sample position by a low-frequency vector
 * field before evaluating. warpAmp in input units.
 */
export function warpedFbm(
  x: number,
  y: number,
  seed: number,
  octaves: number,
  warpAmp: number,
  warpFreq: number,
): number {
  const wx = fbm(x * warpFreq, y * warpFreq, seed ^ 0x5bd1e995, 2);
  const wy = fbm(x * warpFreq + 31.7, y * warpFreq - 18.3, seed ^ 0x2545f491, 2);
  return fbm(x + wx * warpAmp, y + wy * warpAmp, seed, octaves);
}

/** Wrapped (tiling) value noise for seamless texture tiles. Period = integer cells. */
export function tiledValueNoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = smooth(xf);
  const v = smooth(yf);
  const w = (n: number): number => ((n % period) + period) % period;
  const a = hash2f(w(xi), w(yi), seed);
  const b = hash2f(w(xi + 1), w(yi), seed);
  const c = hash2f(w(xi), w(yi + 1), seed);
  const d = hash2f(w(xi + 1), w(yi + 1), seed);
  const top = a + (b - a) * u;
  const bot = c + (d - c) * u;
  return (top + (bot - top) * v) * 2 - 1;
}

/** Tiling fBm in [-1, 1] for texture synthesis. */
export function tiledFbm(x: number, y: number, period: number, seed: number, octaves: number): number {
  let amp = 1;
  let freq = 1;
  let per = period;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += tiledValueNoise(x * freq, y * freq, per, seed + i * 733) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
    per *= 2;
  }
  return sum / norm;
}
