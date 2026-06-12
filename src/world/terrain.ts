/**
 * The world's height + biome field. worldHeight/biomeWeightsAt are pure,
 * continuous functions of (x, z) — every consumer (mesh, collision, gen
 * placement, AI) reads the same mathematics, so seams cannot exist.
 *
 * Composition order: continent/ocean → warped fBm scaled by blended biome
 * amplitude → edge-ring mountains → volcano max-blend → town plateaus.
 * Road carving joins in P2 (before town plateaus conceptually, applied after).
 */

import { clamp01, lerp, smoothstep } from '@/engine/math';
import { seedOf } from '@/engine/rng';
import { fbm, ridged, warpedFbm } from '@/gen/noise';
import { BIOMES, BIOME_ORDER } from '@/data/biomes';
import type { BiomeId } from '@/data/ids';
import { TOWNS } from '@/data/towns';
import {
  VOLCANO_HEIGHT,
  VOLCANO_RADIUS,
  VOLCANO_X,
  VOLCANO_Z,
  WORLD_SIZE,
} from '@/data/world';

// Seeds are derived lazily so setWorldSeed() has run first.
let seedsReady = false;
let S_HEIGHT = 0;
let S_MOIST = 0;
let S_VOLC = 0;

function ensureSeeds(): void {
  if (seedsReady) return;
  S_HEIGHT = seedOf('terrain-height');
  S_MOIST = seedOf('terrain-moisture');
  S_VOLC = seedOf('terrain-volcano');
  seedsReady = true;
}

/** Test/dev hook: re-derive seeds after a world-seed change. */
export function resetTerrainSeeds(): void {
  seedsReady = false;
}

const N_BIOMES = BIOME_ORDER.length;

// ----- fields ----------------------------------------------------------------

/** Volcanism 0..1 (distance falloff from the Ember Tooth). */
export function volcanism(x: number, z: number): number {
  const dx = x - VOLCANO_X;
  const dz = z - VOLCANO_Z;
  return clamp01(1 - Math.sqrt(dx * dx + dz * dz) / VOLCANO_RADIUS);
}

/** West-coast proximity 0..1. */
function coastal(x: number): number {
  return clamp01(1 - x / 2200);
}

/** Moisture 0..1 with a south-east wetland bias. */
function moisture(x: number, z: number): number {
  ensureSeeds();
  const n = fbm(x / 2300, z / 2300, S_MOIST, 3) * 0.5 + 0.5;
  const seBias = smoothstep(0.45, 1, ((x + z) / (2 * WORLD_SIZE)) * 1.15) * 0.22;
  return clamp01(n * 0.85 + seBias);
}

/**
 * Smooth biome weights at a point (sum = 1, all >= 0).
 * Order matches BIOME_ORDER: coastalMarsh, steppe, fungalForest,
 * bittermarsh, ashlands, badlands.
 */
export function biomeWeightsAt(x: number, z: number, out: number[]): number[] {
  const v = volcanism(x, z);
  const c = coastal(x);
  const m = moisture(x, z);

  const wBad = smoothstep(0.55, 0.74, v);
  const wAsh = smoothstep(0.26, 0.48, v) * (1 - wBad);
  const nonVolc = 1 - wBad - wAsh;
  const wCoast = smoothstep(0.3, 0.72, c) * nonVolc;
  const rest = nonVolc - wCoast;
  const tBitter = smoothstep(0.62, 0.76, m);
  const wBitter = tBitter * rest;
  const wFungal = smoothstep(0.44, 0.56, m) * (1 - tBitter) * rest;
  const wSteppe = rest - wBitter - wFungal;

  out[0] = wCoast;
  out[1] = wSteppe;
  out[2] = wFungal;
  out[3] = wBitter;
  out[4] = wAsh;
  out[5] = wBad;
  return out;
}

const scratchW: number[] = [0, 0, 0, 0, 0, 0];

/** Dominant biome id at a point. */
export function biomeAt(x: number, z: number): BiomeId {
  biomeWeightsAt(x, z, scratchW);
  let best = 0;
  for (let i = 1; i < N_BIOMES; i++) {
    if ((scratchW[i] as number) > (scratchW[best] as number)) best = i;
  }
  return BIOME_ORDER[best] as BiomeId;
}

/** Dominant + secondary biome indices and the secondary's relative share. */
export function biomePairAt(
  x: number,
  z: number,
  out: { dom: number; sub: number; blend: number },
): void {
  biomeWeightsAt(x, z, scratchW);
  let dom = 0;
  let sub = 1;
  if ((scratchW[1] as number) > (scratchW[0] as number)) {
    dom = 1;
    sub = 0;
  }
  for (let i = 2; i < N_BIOMES; i++) {
    const w = scratchW[i] as number;
    if (w > (scratchW[dom] as number)) {
      sub = dom;
      dom = i;
    } else if (w > (scratchW[sub] as number)) {
      sub = i;
    }
  }
  const wd = scratchW[dom] as number;
  const ws = scratchW[sub] as number;
  out.dom = dom;
  out.sub = sub;
  out.blend = wd + ws > 0 ? ws / (wd + ws) : 0;
}

// ----- height ----------------------------------------------------------------

/** Road carving hook — installed by world/roads.ts in P2. */
export type HeightModifier = (x: number, z: number, h: number) => number;
let roadModifier: HeightModifier | null = null;

export function installRoadModifier(mod: HeightModifier): void {
  roadModifier = mod;
}

export function worldHeight(x: number, z: number): number {
  ensureSeeds();

  // Blended biome base/amplitude.
  biomeWeightsAt(x, z, scratchW);
  let base = 0;
  let amp = 0;
  for (let i = 0; i < N_BIOMES; i++) {
    const w = scratchW[i] as number;
    const def = BIOMES[BIOME_ORDER[i] as BiomeId];
    base += w * def.base;
    amp += w * def.amp;
  }

  // Continental relief: warped fBm, wavelength ~1400 m, warp ~60 m.
  const n = warpedFbm(x / 1400, z / 1400, S_HEIGHT, 5, 60 / 1400, 2);
  let h = base + n * amp;

  // Edge-ring mountains (north/south/east edges).
  const edgeDist = Math.min(z, WORLD_SIZE - z, WORLD_SIZE - x);
  const rm = smoothstep(1500, 150, edgeDist);
  h += rm * rm * 300 + rm * ridged(x / 380, z / 380, S_VOLC ^ 0x55aa, 3) * 90;

  // Western ocean shelf.
  const ocean = smoothstep(1500, 250, x);
  h = lerp(h, -38, ocean);

  // The Ember Tooth: analytic cone max-blended with ridged rock detail.
  const dvx = x - VOLCANO_X;
  const dvz = z - VOLCANO_Z;
  const dv = Math.sqrt(dvx * dvx + dvz * dvz);
  const coneT = clamp01(1 - dv / 2600);
  if (coneT > 0) {
    const detail = ridged(x / 420, z / 420, S_VOLC, 4) * 110 * smoothstep(0.08, 0.7, coneT);
    let vol = Math.pow(coneT, 1.7) * VOLCANO_HEIGHT + detail;
    // Crater bowl.
    vol -= smoothstep(220, 70, dv) * 130;
    h = Math.max(h, vol);
  }

  // Roads (P2+) carve before town plateaus so plazas stay perfectly flat.
  if (roadModifier) h = roadModifier(x, z, h);

  // Town plateaus.
  for (let i = 0; i < TOWNS.length; i++) {
    const t = TOWNS[i] as (typeof TOWNS)[number];
    const dx = x - t.pos[0];
    const dz = z - t.pos[1];
    const d2 = dx * dx + dz * dz;
    const outer = t.radius + 34;
    if (d2 < outer * outer) {
      const d = Math.sqrt(d2);
      const f = 1 - smoothstep(t.radius, outer, d);
      h = lerp(h, t.plateauHeight, f);
    }
  }

  return h;
}

/** Terrain normal via central differences (eps 2 m, matches the mesh grid). */
export function terrainNormal(
  x: number,
  z: number,
  out: { x: number; y: number; z: number },
): void {
  const e = 2;
  const hx = worldHeight(x + e, z) - worldHeight(x - e, z);
  const hz = worldHeight(x, z + e) - worldHeight(x, z - e);
  const nx = -hx / (2 * e);
  const nz = -hz / (2 * e);
  const len = Math.sqrt(nx * nx + 1 + nz * nz);
  out.x = nx / len;
  out.y = 1 / len;
  out.z = nz / len;
}
