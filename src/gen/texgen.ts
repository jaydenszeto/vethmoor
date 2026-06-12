/**
 * Canvas/pixel-buffer texture synthesis toolkit. All tiles are seamless
 * (wrapped lattice noise) and deterministic from the world seed.
 */

import { clamp01 } from '@/engine/math';
import { Sfc32 } from '@/engine/rng';
import { tiledFbm } from './noise';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function rgb(hex: number): Rgb {
  return { r: (hex >> 16) & 255, g: (hex >> 8) & 255, b: hex & 255 };
}

export function mixRgb(a: Rgb, b: Rgb, t: number, out: Rgb): Rgb {
  out.r = a.r + (b.r - a.r) * t;
  out.g = a.g + (b.g - a.g) * t;
  out.b = a.b + (b.b - a.b) * t;
  return out;
}

/**
 * Fill an RGBA pixel buffer via a per-pixel shading function.
 * fn receives (px, py, out) and writes 0..255 channels into out.
 */
export function shadePixels(
  size: number,
  fn: (x: number, y: number, out: Rgb) => void,
): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const out: Rgb = { r: 0, g: 0, b: 0 };
  let p = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      fn(x, y, out);
      data[p++] = clamp01(out.r / 255) * 255;
      data[p++] = clamp01(out.g / 255) * 255;
      data[p++] = clamp01(out.b / 255) * 255;
      data[p++] = 255;
    }
  }
  return data;
}

/** Sprinkle deterministic speckles (size 1-2 px, wrapped) onto a buffer. */
export function speckle(
  data: Uint8Array,
  size: number,
  rng: Sfc32,
  count: number,
  color: Rgb,
  alpha: number,
  big = false,
): void {
  for (let i = 0; i < count; i++) {
    const x = rng.int(0, size - 1);
    const y = rng.int(0, size - 1);
    const n = big && rng.chance(0.5) ? 2 : 1;
    for (let dy = 0; dy < n; dy++) {
      for (let dx = 0; dx < n; dx++) {
        const idx = (((y + dy) % size) * size + ((x + dx) % size)) * 4;
        const a = alpha * rng.range(0.6, 1);
        data[idx] = (data[idx] as number) * (1 - a) + color.r * a;
        data[idx + 1] = (data[idx + 1] as number) * (1 - a) + color.g * a;
        data[idx + 2] = (data[idx + 2] as number) * (1 - a) + color.b * a;
      }
    }
  }
}

/** Short directional strokes (grass blades, scratches), wrapped. */
export function strokes(
  data: Uint8Array,
  size: number,
  rng: Sfc32,
  count: number,
  color: Rgb,
  alpha: number,
  len: [number, number],
  vertical: boolean,
): void {
  for (let i = 0; i < count; i++) {
    let x = rng.int(0, size - 1);
    let y = rng.int(0, size - 1);
    const L = rng.int(len[0], len[1]);
    const drift = rng.chance(0.5) ? 1 : -1;
    for (let s = 0; s < L; s++) {
      const idx = ((y % size) * size + (x % size)) * 4;
      const a = alpha * (1 - s / L);
      data[idx] = (data[idx] as number) * (1 - a) + color.r * a;
      data[idx + 1] = (data[idx + 1] as number) * (1 - a) + color.g * a;
      data[idx + 2] = (data[idx + 2] as number) * (1 - a) + color.b * a;
      if (vertical) {
        y = (y + 1) % size;
        if (rng.chance(0.3)) x = (x + drift + size) % size;
      } else {
        x = (x + 1) % size;
        if (rng.chance(0.3)) y = (y + drift + size) % size;
      }
    }
  }
}

/** Convenience: two-tone fBm base fill. */
export function noiseBase(
  size: number,
  seed: number,
  dark: Rgb,
  light: Rgb,
  scale = 8,
  octaves = 4,
  contrast = 1,
): Uint8Array {
  const tmp: Rgb = { r: 0, g: 0, b: 0 };
  return shadePixels(size, (x, y, out) => {
    let n = tiledFbm((x / size) * scale, (y / size) * scale, scale, seed, octaves) * 0.5 + 0.5;
    n = clamp01(0.5 + (n - 0.5) * contrast);
    mixRgb(dark, light, n, tmp);
    out.r = tmp.r;
    out.g = tmp.g;
    out.b = tmp.b;
  });
}
