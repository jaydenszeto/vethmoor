/**
 * Chunk geometry builder. Each chunk owns a 2 m height grid (67×67 including
 * a 1-sample margin) shared by collision; meshes at any LOD sample that grid.
 * A skirt ring drops 1.5 m around every chunk so LOD T-junctions never crack.
 * Ground blending uses 8 per-vertex layer weights (two vec4 attributes) —
 * correct everywhere, no index-interpolation artifacts.
 */

import * as THREE from 'three';
import { clamp, clamp01, smoothstep } from '@/engine/math';
import { seedOf } from '@/engine/rng';
import { fbm } from '@/gen/noise';
import { groundArrayTexture } from '@/gen/textures';
import { BIOMES, BIOME_ORDER, GROUND } from '@/data/biomes';
import type { BiomeId } from '@/data/ids';
import {
  CHUNK_SIZE,
  GRID_STEP,
  LOD_STEP,
  SKIRT_DROP,
} from '@/data/world';
import { biomeWeightsAt, worldHeight } from './terrain';

export const GRID_SIDE = CHUNK_SIZE / GRID_STEP + 3; // 67 (margin sample each side)

/** Height grid covering local [-2, 130] at 2 m. Index (i,j) → local ((i-1)*2, (j-1)*2). */
export function buildHeightGrid(cx: number, cz: number): Float32Array {
  const grid = new Float32Array(GRID_SIDE * GRID_SIDE);
  const ox = cx * CHUNK_SIZE;
  const oz = cz * CHUNK_SIZE;
  let p = 0;
  for (let j = 0; j < GRID_SIDE; j++) {
    const z = oz + (j - 1) * GRID_STEP;
    for (let i = 0; i < GRID_SIDE; i++) {
      grid[p++] = worldHeight(ox + (i - 1) * GRID_STEP, z);
    }
  }
  return grid;
}

/** Bilinear height from a chunk grid; lx/lz local meters in [0, 128]. */
export function gridHeight(grid: Float32Array, lx: number, lz: number): number {
  const gx = clamp(lx / GRID_STEP + 1, 0, GRID_SIDE - 1.001);
  const gz = clamp(lz / GRID_STEP + 1, 0, GRID_SIDE - 1.001);
  const i0 = Math.floor(gx);
  const j0 = Math.floor(gz);
  const fx = gx - i0;
  const fz = gz - j0;
  const a = grid[j0 * GRID_SIDE + i0] as number;
  const b = grid[j0 * GRID_SIDE + i0 + 1] as number;
  const c = grid[(j0 + 1) * GRID_SIDE + i0] as number;
  const d = grid[(j0 + 1) * GRID_SIDE + i0 + 1] as number;
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}

// ----- shared index buffers per LOD -------------------------------------------

const indexCache = new Map<number, THREE.BufferAttribute>();

function sharedIndex(side: number): THREE.BufferAttribute {
  let idx = indexCache.get(side);
  if (idx) return idx;
  const quads = side - 1;
  const arr = new Uint32Array(quads * quads * 6);
  let p = 0;
  for (let j = 0; j < quads; j++) {
    for (let i = 0; i < quads; i++) {
      const a = j * side + i;
      const b = a + 1;
      const c = a + side;
      const d = c + 1;
      arr[p++] = a;
      arr[p++] = c;
      arr[p++] = b;
      arr[p++] = b;
      arr[p++] = c;
      arr[p++] = d;
    }
  }
  idx = new THREE.BufferAttribute(arr, 1);
  indexCache.set(side, idx);
  return idx;
}

// ----- splat weights ------------------------------------------------------------

const wBiome: number[] = [0, 0, 0, 0, 0, 0];
const wLayer = new Float32Array(8);
let microSeed = 0;
let microSeedReady = false;

function layerWeightsAt(
  wx: number,
  wz: number,
  h: number,
  normalY: number,
  out0: Float32Array,
  outIdx: number,
): void {
  if (!microSeedReady) {
    microSeed = seedOf('splat-micro');
    microSeedReady = true;
  }
  wLayer.fill(0);
  biomeWeightsAt(wx, wz, wBiome);
  // Intra-biome A↔B variation from medium-frequency noise.
  const micro = clamp01(fbm(wx / 21, wz / 21, microSeed, 2) * 0.5 + 0.5);
  const intra = micro * 0.55;
  for (let i = 0; i < 6; i++) {
    const def = BIOMES[BIOME_ORDER[i] as BiomeId];
    const w = wBiome[i] as number;
    wLayer[def.groundA] = (wLayer[def.groundA] as number) + w * (1 - intra);
    wLayer[def.groundB] = (wLayer[def.groundB] as number) + w * intra;
  }
  // Shore sand.
  const shore = smoothstep(2.2, 0.6, h) * smoothstep(-5, -0.5, h);
  if (shore > 0) {
    for (let i = 0; i < 8; i++) wLayer[i] = (wLayer[i] as number) * (1 - shore);
    wLayer[GROUND.sand] = (wLayer[GROUND.sand] as number) + shore;
  }
  // Steep slopes turn to rock.
  const rock = smoothstep(0.82, 0.58, normalY);
  if (rock > 0) {
    for (let i = 0; i < 8; i++) wLayer[i] = (wLayer[i] as number) * (1 - rock);
    wLayer[GROUND.rock] = (wLayer[GROUND.rock] as number) + rock;
  }
  // Normalize (defensive) and write.
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += wLayer[i] as number;
  const inv = sum > 0 ? 1 / sum : 0;
  for (let i = 0; i < 8; i++) out0[outIdx + i] = (wLayer[i] as number) * inv;
}

// ----- geometry -------------------------------------------------------------------

export function buildChunkGeometry(
  cx: number,
  cz: number,
  lod: number,
  grid: Float32Array,
): THREE.BufferGeometry {
  const step = LOD_STEP[lod] as number;
  const stride = step / GRID_STEP;
  const coreVerts = CHUNK_SIZE / step + 1;
  const side = coreVerts + 2; // skirt ring
  const count = side * side;

  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const w0 = new Float32Array(count * 4);
  const w1 = new Float32Array(count * 4);
  const weights = new Float32Array(8);

  const ox = cx * CHUNK_SIZE;
  const oz = cz * CHUNK_SIZE;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let vj = 0; vj < side; vj++) {
    const cj = clamp(vj - 1, 0, coreVerts - 1);
    const isSkirtJ = vj === 0 || vj === side - 1;
    const lz = cj * step;
    const gj = cj * stride + 1;
    for (let vi = 0; vi < side; vi++) {
      const ci = clamp(vi - 1, 0, coreVerts - 1);
      const isSkirt = isSkirtJ || vi === 0 || vi === side - 1;
      const lx = ci * step;
      const gi = ci * stride + 1;
      const g = gj * GRID_SIDE + gi;
      let y = grid[g] as number;

      // Normal from the 2 m grid (consistent across LODs → no lighting pop).
      const hL = grid[g - 1] as number;
      const hR = grid[g + 1] as number;
      const hD = grid[g - GRID_SIDE] as number;
      const hU = grid[g + GRID_SIDE] as number;
      let nx = (hL - hR) / (2 * GRID_STEP);
      let nz = (hD - hU) / (2 * GRID_STEP);
      const nlen = Math.sqrt(nx * nx + 1 + nz * nz);
      nx /= nlen;
      nz /= nlen;
      const ny = 1 / nlen;

      if (isSkirt) y -= SKIRT_DROP;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      const v = vj * side + vi;
      positions[v * 3] = lx;
      positions[v * 3 + 1] = y;
      positions[v * 3 + 2] = lz;
      normals[v * 3] = nx;
      normals[v * 3 + 1] = ny;
      normals[v * 3 + 2] = nz;

      layerWeightsAt(ox + lx, oz + lz, grid[g] as number, ny, weights, 0);
      // AO from concavity: pits darken slightly.
      const avg = (hL + hR + hD + hU) * 0.25;
      const ao = clamp(1 + ((grid[g] as number) - avg) * 0.1, 0.8, 1.1);
      w0[v * 4] = (weights[0] as number) * ao;
      w0[v * 4 + 1] = (weights[1] as number) * ao;
      w0[v * 4 + 2] = (weights[2] as number) * ao;
      w0[v * 4 + 3] = (weights[3] as number) * ao;
      w1[v * 4] = (weights[4] as number) * ao;
      w1[v * 4 + 1] = (weights[5] as number) * ao;
      w1[v * 4 + 2] = (weights[6] as number) * ao;
      w1[v * 4 + 3] = (weights[7] as number) * ao;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('aW0', new THREE.BufferAttribute(w0, 4));
  geo.setAttribute('aW1', new THREE.BufferAttribute(w1, 4));
  geo.setIndex(sharedIndex(side));
  geo.boundingBox = new THREE.Box3(
    new THREE.Vector3(0, minY - 0.5, 0),
    new THREE.Vector3(CHUNK_SIZE, maxY + 0.5, CHUNK_SIZE),
  );
  geo.boundingSphere = new THREE.Sphere();
  geo.boundingBox.getBoundingSphere(geo.boundingSphere);
  return geo;
}

// ----- material --------------------------------------------------------------------

const TERRAIN_VERT = /* glsl */ `
attribute vec4 aW0;
attribute vec4 aW1;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec4 vW0;
varying vec4 vW1;
varying float vDist;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormal = normal;
  vW0 = aW0;
  vW1 = aW1;
  vec4 mv = viewMatrix * wp;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const TERRAIN_FRAG = /* glsl */ `
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uGround;
uniform float uTileScale;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uHemiSky;
uniform vec3 uHemiGround;
uniform vec3 uFogColor;
uniform float uFogDensity;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec4 vW0;
varying vec4 vW1;
varying float vDist;

void main() {
  vec2 uv = vWorld.xz / uTileScale;
  vec3 albedo =
    texture(uGround, vec3(uv, 0.0)).rgb * vW0.x +
    texture(uGround, vec3(uv, 1.0)).rgb * vW0.y +
    texture(uGround, vec3(uv, 2.0)).rgb * vW0.z +
    texture(uGround, vec3(uv, 3.0)).rgb * vW0.w +
    texture(uGround, vec3(uv, 4.0)).rgb * vW1.x +
    texture(uGround, vec3(uv, 5.0)).rgb * vW1.y +
    texture(uGround, vec3(uv, 6.0)).rgb * vW1.z +
    texture(uGround, vec3(uv, 7.0)).rgb * vW1.w;

  vec3 n = normalize(vNormal);
  vec3 hemi = mix(uHemiGround, uHemiSky, n.y * 0.5 + 0.5);
  float nd = max(dot(n, uSunDir), 0.0);
  vec3 col = albedo * (hemi + uSunColor * nd);

  float f = 1.0 - exp(-uFogDensity * uFogDensity * vDist * vDist);
  col = mix(col, uFogColor, clamp(f, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

let terrainMat: THREE.ShaderMaterial | null = null;

export function terrainMaterial(): THREE.ShaderMaterial {
  if (terrainMat) return terrainMat;
  terrainMat = new THREE.ShaderMaterial({
    vertexShader: TERRAIN_VERT,
    fragmentShader: TERRAIN_FRAG,
    uniforms: {
      uGround: { value: groundArrayTexture() },
      uTileScale: { value: 4.0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 0.9, 0.7) },
      uHemiSky: { value: new THREE.Color(0.4, 0.48, 0.52) },
      uHemiGround: { value: new THREE.Color(0.16, 0.14, 0.12) },
      uFogColor: { value: new THREE.Color(0.1, 0.12, 0.13) },
      uFogDensity: { value: 0.003 },
    },
  });
  return terrainMat;
}
