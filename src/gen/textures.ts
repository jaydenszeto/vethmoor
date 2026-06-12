/**
 * Boot-time texture bakery. Everything visual is synthesized here once,
 * behind the loading screen, and registered on module singletons.
 */

import * as THREE from 'three';
import { Sfc32, seedOf } from '@/engine/rng';
import { clamp01 } from '@/engine/math';
import { tiledFbm } from './noise';
import { noiseBase, rgb, shadePixels, speckle, strokes } from './texgen';

export const GROUND_TEX_SIZE = 256;
export const GROUND_LAYERS = 8;

let groundArray: THREE.DataArrayTexture | null = null;
let waterTex: THREE.CanvasTexture | null = null;

export function groundArrayTexture(): THREE.DataArrayTexture {
  if (!groundArray) throw new Error('textures not baked yet');
  return groundArray;
}

export function waterNoiseTexture(): THREE.CanvasTexture {
  if (!waterTex) throw new Error('textures not baked yet');
  return waterTex;
}

// ----- individual tile recipes ------------------------------------------------

function tileGrass(seed: number): Uint8Array {
  const data = noiseBase(GROUND_TEX_SIZE, seed, rgb(0x35402c), rgb(0x4d5a39), 8, 4, 1.25);
  const rng = new Sfc32(seed ^ 0xa1);
  strokes(data, GROUND_TEX_SIZE, rng, 2600, rgb(0x5d6b42), 0.5, [2, 5], true);
  strokes(data, GROUND_TEX_SIZE, rng, 1400, rgb(0x2a3322), 0.45, [2, 4], true);
  speckle(data, GROUND_TEX_SIZE, rng, 300, rgb(0x6e7a50), 0.5);
  return data;
}

function tileDryGrass(seed: number): Uint8Array {
  const data = noiseBase(GROUND_TEX_SIZE, seed, rgb(0x55523a), rgb(0x6e6947), 8, 4, 1.15);
  const rng = new Sfc32(seed ^ 0xa2);
  strokes(data, GROUND_TEX_SIZE, rng, 2200, rgb(0x7d7651), 0.45, [2, 6], true);
  strokes(data, GROUND_TEX_SIZE, rng, 1200, rgb(0x44422f), 0.4, [2, 4], true);
  speckle(data, GROUND_TEX_SIZE, rng, 220, rgb(0x8a8259), 0.4);
  return data;
}

function tileAsh(seed: number): Uint8Array {
  const data = noiseBase(GROUND_TEX_SIZE, seed, rgb(0x474340), rgb(0x5c5752), 10, 5, 1.1);
  const rng = new Sfc32(seed ^ 0xa3);
  speckle(data, GROUND_TEX_SIZE, rng, 2400, rgb(0x6b655f), 0.35);
  speckle(data, GROUND_TEX_SIZE, rng, 1600, rgb(0x36322f), 0.4);
  // Rare cooling embers caught in the ash.
  speckle(data, GROUND_TEX_SIZE, rng, 26, rgb(0xb4541e), 0.55);
  speckle(data, GROUND_TEX_SIZE, rng, 8, rgb(0xe07a2a), 0.6);
  return data;
}

function tileMud(seed: number): Uint8Array {
  const size = GROUND_TEX_SIZE;
  const dark = rgb(0x2f2a22);
  const light = rgb(0x4a4234);
  const sheen = rgb(0x5a5648);
  const tmp = { r: 0, g: 0, b: 0 };
  const data = shadePixels(size, (x, y, out) => {
    const n = tiledFbm((x / size) * 6, (y / size) * 6, 6, seed, 4) * 0.5 + 0.5;
    const wet = tiledFbm((x / size) * 3 + 9, (y / size) * 3, 3, seed ^ 7, 2) * 0.5 + 0.5;
    tmp.r = dark.r + (light.r - dark.r) * n;
    tmp.g = dark.g + (light.g - dark.g) * n;
    tmp.b = dark.b + (light.b - dark.b) * n;
    const w = clamp01((wet - 0.62) * 3);
    out.r = tmp.r + (sheen.r - tmp.r) * w * 0.6;
    out.g = tmp.g + (sheen.g - tmp.g) * w * 0.6;
    out.b = tmp.b + (sheen.b - tmp.b) * w * 0.6;
  });
  const rng = new Sfc32(seed ^ 0xa4);
  speckle(data, size, rng, 500, rgb(0x1f1b15), 0.5);
  return data;
}

function tileSand(seed: number): Uint8Array {
  const size = GROUND_TEX_SIZE;
  const dark = rgb(0x6b5e44);
  const light = rgb(0x8a7a58);
  const data = shadePixels(size, (x, y, out) => {
    const ripple = Math.sin((y / size) * Math.PI * 14 + tiledFbm((x / size) * 4, (y / size) * 4, 4, seed, 3) * 4) * 0.5 + 0.5;
    const n = tiledFbm((x / size) * 9, (y / size) * 9, 9, seed ^ 3, 3) * 0.5 + 0.5;
    const t = clamp01(n * 0.65 + ripple * 0.35);
    out.r = dark.r + (light.r - dark.r) * t;
    out.g = dark.g + (light.g - dark.g) * t;
    out.b = dark.b + (light.b - dark.b) * t;
  });
  const rng = new Sfc32(seed ^ 0xa5);
  speckle(data, size, rng, 900, rgb(0x9c8c66), 0.4);
  speckle(data, size, rng, 500, rgb(0x55492f), 0.4);
  return data;
}

function tileRock(seed: number): Uint8Array {
  const size = GROUND_TEX_SIZE;
  const dark = rgb(0x37342f);
  const light = rgb(0x5b5750);
  const data = shadePixels(size, (x, y, out) => {
    const n = tiledFbm((x / size) * 7, (y / size) * 7, 7, seed, 5) * 0.5 + 0.5;
    // Crack lines: thresholded ridge of a second field.
    const c = Math.abs(tiledFbm((x / size) * 5 + 3, (y / size) * 5, 5, seed ^ 11, 3));
    const crack = c < 0.05 ? 0.55 : 1;
    const t = clamp01(n) * crack;
    out.r = dark.r + (light.r - dark.r) * t;
    out.g = dark.g + (light.g - dark.g) * t;
    out.b = dark.b + (light.b - dark.b) * t;
  });
  const rng = new Sfc32(seed ^ 0xa6);
  speckle(data, size, rng, 700, rgb(0x6e6a62), 0.35);
  return data;
}

function tileRoad(seed: number): Uint8Array {
  const data = noiseBase(GROUND_TEX_SIZE, seed, rgb(0x43392c), rgb(0x5c5142), 7, 4, 1.05);
  const rng = new Sfc32(seed ^ 0xa7);
  // Packed stones.
  speckle(data, GROUND_TEX_SIZE, rng, 1100, rgb(0x6a6157), 0.5, true);
  speckle(data, GROUND_TEX_SIZE, rng, 700, rgb(0x332c21), 0.5, true);
  strokes(data, GROUND_TEX_SIZE, rng, 300, rgb(0x39301f), 0.3, [3, 8], false);
  return data;
}

function tileFungalLoam(seed: number): Uint8Array {
  const data = noiseBase(GROUND_TEX_SIZE, seed, rgb(0x35382b), rgb(0x4c4d38), 8, 4, 1.2);
  const rng = new Sfc32(seed ^ 0xa8);
  // Spore motes — the Morrowind-weird signature: faint teal + violet.
  speckle(data, GROUND_TEX_SIZE, rng, 420, rgb(0x4f7d6d), 0.45);
  speckle(data, GROUND_TEX_SIZE, rng, 200, rgb(0x6b5a78), 0.35);
  speckle(data, GROUND_TEX_SIZE, rng, 800, rgb(0x2a2d20), 0.4);
  strokes(data, GROUND_TEX_SIZE, rng, 500, rgb(0x5a5c41), 0.35, [2, 4], false);
  return data;
}

// ----- bake ---------------------------------------------------------------------

/** Bake every texture. Call once during boot, before any chunk builds. */
export function bakeTextures(): void {
  const size = GROUND_TEX_SIZE;
  const layers: Uint8Array[] = [
    tileGrass(seedOf('tex-grass')),
    tileDryGrass(seedOf('tex-drygrass')),
    tileAsh(seedOf('tex-ash')),
    tileMud(seedOf('tex-mud')),
    tileSand(seedOf('tex-sand')),
    tileRock(seedOf('tex-rock')),
    tileRoad(seedOf('tex-road')),
    tileFungalLoam(seedOf('tex-loam')),
  ];
  const all = new Uint8Array(size * size * 4 * GROUND_LAYERS);
  layers.forEach((layer, i) => all.set(layer, i * size * size * 4));

  const tex = new THREE.DataArrayTexture(all, size, size, GROUND_LAYERS);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 1;
  tex.needsUpdate = true;
  groundArray = tex;

  // Water scroll-noise tile (128², greyscale in RGB).
  const wsize = 128;
  const wseed = seedOf('tex-water');
  const wdata = shadePixels(wsize, (x, y, out) => {
    const n = tiledFbm((x / wsize) * 5, (y / wsize) * 5, 5, wseed, 4) * 0.5 + 0.5;
    const v = 120 + n * 135;
    out.r = v;
    out.g = v;
    out.b = v;
  });
  const wcanvas = document.createElement('canvas');
  wcanvas.width = wsize;
  wcanvas.height = wsize;
  const wctx = wcanvas.getContext('2d') as CanvasRenderingContext2D;
  const img = wctx.createImageData(wsize, wsize);
  img.data.set(wdata);
  wctx.putImageData(img, 0, 0);
  const wt = new THREE.CanvasTexture(wcanvas);
  wt.wrapS = THREE.RepeatWrapping;
  wt.wrapT = THREE.RepeatWrapping;
  wt.magFilter = THREE.LinearFilter;
  wt.minFilter = THREE.LinearMipmapLinearFilter;
  waterTex = wt;
}
