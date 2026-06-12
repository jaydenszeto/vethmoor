/**
 * Per-chunk vegetation + wilderness props. Two tiers:
 *  - BIG (trees, giant fungus, dead trees, spikes, rocks, POI structures):
 *    merged into ONE static mesh per chunk (1 draw call), rings 0–3.
 *  - SMALL (grass, reeds, mushrooms): InstancedMesh per type, rings 0–2.
 * Everything deterministic from seedOf('flora', cx, cz).
 */

import * as THREE from 'three';
import { Sfc32, seedOf } from '@/engine/rng';
import { BIOME_ORDER } from '@/data/biomes';
import type { BiomeId } from '@/data/ids';
import { CHUNK_SIZE, SEA_LEVEL } from '@/data/world';
import { TOWNS } from '@/data/towns';
import { biomeWeightsAt } from './terrain';
import { gridHeight } from './terrainMesh';
import { roadDistance } from './roads';
import { poisInChunk } from './pois';
import { floraGeometry, poiGeometry, type FloraType } from '@/gen/models/props';
import { vertexColorMaterial } from '@/gen/models/primitives';

interface FloraSpec {
  type: FloraType;
  /** Expected instances per chunk at weight 1. */
  density: number;
  big: boolean;
  minH: number; // above this terrain height
  maxSlopeDrop: number; // max |Δh| over 2 m probe
  scale: [number, number];
}

/** Per-biome flora tables (index = BIOME_ORDER). */
const TABLES: Record<BiomeId, FloraSpec[]> = {
  coastalMarsh: [
    { type: 'reed', density: 60, big: false, minH: 0.15, maxSlopeDrop: 1.2, scale: [0.8, 1.3] },
    { type: 'grass', density: 40, big: false, minH: 0.5, maxSlopeDrop: 1.4, scale: [0.9, 1.4] },
    { type: 'rock', density: 4, big: true, minH: 0.4, maxSlopeDrop: 2, scale: [0.7, 1.4] },
    { type: 'twistedTree', density: 3, big: true, minH: 1, maxSlopeDrop: 1.2, scale: [0.7, 1.1] },
  ],
  steppe: [
    { type: 'grass', density: 70, big: false, minH: 0.6, maxSlopeDrop: 1.6, scale: [0.9, 1.5] },
    { type: 'rock', density: 6, big: true, minH: 0.6, maxSlopeDrop: 2.4, scale: [0.6, 1.6] },
    { type: 'twistedTree', density: 4, big: true, minH: 1, maxSlopeDrop: 1.3, scale: [0.8, 1.3] },
  ],
  fungalForest: [
    { type: 'giantFungus', density: 7, big: true, minH: 1, maxSlopeDrop: 1.5, scale: [0.8, 1.4] },
    { type: 'mushrooms', density: 26, big: false, minH: 0.7, maxSlopeDrop: 1.4, scale: [0.8, 1.6] },
    { type: 'grass', density: 36, big: false, minH: 0.6, maxSlopeDrop: 1.5, scale: [0.8, 1.3] },
    { type: 'twistedTree', density: 5, big: true, minH: 1, maxSlopeDrop: 1.3, scale: [0.9, 1.4] },
  ],
  bittermarsh: [
    { type: 'reed', density: 70, big: false, minH: 0.1, maxSlopeDrop: 1.2, scale: [0.9, 1.5] },
    { type: 'mushrooms', density: 14, big: false, minH: 0.4, maxSlopeDrop: 1.3, scale: [0.8, 1.4] },
    { type: 'deadTree', density: 4, big: true, minH: 0.5, maxSlopeDrop: 1.2, scale: [0.8, 1.2] },
    { type: 'giantFungus', density: 2, big: true, minH: 0.8, maxSlopeDrop: 1.3, scale: [0.6, 1] },
  ],
  ashlands: [
    { type: 'deadTree', density: 5, big: true, minH: 1, maxSlopeDrop: 1.8, scale: [0.8, 1.3] },
    { type: 'ashSpike', density: 8, big: true, minH: 1, maxSlopeDrop: 2.6, scale: [0.7, 1.6] },
    { type: 'rock', density: 7, big: true, minH: 0.8, maxSlopeDrop: 2.6, scale: [0.8, 1.8] },
    { type: 'grass', density: 9, big: false, minH: 1, maxSlopeDrop: 1.6, scale: [0.6, 1] },
  ],
  badlands: [
    { type: 'ashSpike', density: 12, big: true, minH: 1, maxSlopeDrop: 3, scale: [0.9, 2] },
    { type: 'rock', density: 10, big: true, minH: 0.8, maxSlopeDrop: 3, scale: [0.9, 2.2] },
    { type: 'deadTree', density: 2, big: true, minH: 1, maxSlopeDrop: 1.8, scale: [0.7, 1.1] },
  ],
};

export interface ChunkFlora {
  big: THREE.Mesh | null;
  small: THREE.InstancedMesh[];
}

const wScratch: number[] = [0, 0, 0, 0, 0, 0];
const mat4 = new THREE.Matrix4();
const quat = new THREE.Quaternion();
const eul = new THREE.Euler();
const posV = new THREE.Vector3();
const sclV = new THREE.Vector3();

function nearTown(x: number, z: number): boolean {
  for (const t of TOWNS) {
    const dx = x - t.pos[0];
    const dz = z - t.pos[1];
    const r = t.radius + 26;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

/** Build the flora set for a chunk. Caller owns disposal. */
export function buildChunkFlora(
  cx: number,
  cz: number,
  grid: Float32Array,
  withBig: boolean,
  withSmall: boolean,
): ChunkFlora {
  const rng = new Sfc32(seedOf('flora', cx, cz));
  const ox = cx * CHUNK_SIZE;
  const oz = cz * CHUNK_SIZE;

  const bigParts: THREE.BufferGeometry[] = [];
  const smallByType = new Map<FloraType, THREE.Matrix4[]>();
  let minY = Infinity;
  let maxY = -Infinity;

  // Probe biome once per chunk center; per-spec probability re-weighted by
  // local biome weight at each candidate point.
  const attempts = 110;
  for (let a = 0; a < attempts; a++) {
    const lx = rng.range(3, CHUNK_SIZE - 3);
    const lz = rng.range(3, CHUNK_SIZE - 3);
    const x = ox + lx;
    const z = oz + lz;
    const h = gridHeight(grid, lx, lz);
    if (h < SEA_LEVEL + 0.1) continue;

    biomeWeightsAt(x, z, wScratch);
    // Pick the biome table by sampled weight (stochastic blend at borders).
    let roll = rng.float();
    let bi = 0;
    for (let i = 0; i < 6; i++) {
      roll -= wScratch[i] as number;
      if (roll <= 0) {
        bi = i;
        break;
      }
    }
    const table = TABLES[BIOME_ORDER[bi] as BiomeId];
    const spec = table[rng.int(0, table.length - 1)] as FloraSpec;
    if ((!spec.big && !withSmall) || (spec.big && !withBig)) continue;
    // Density: expected instances/chunk ÷ attempts ÷ table dilution.
    const p = (spec.density * table.length) / attempts / 2.2;
    if (!rng.chance(Math.min(0.95, p))) continue;

    if (h < spec.minH) continue;
    const slopeDrop = Math.abs(gridHeight(grid, lx + 2, lz) - h) + Math.abs(gridHeight(grid, lx, lz + 2) - h);
    if (slopeDrop > spec.maxSlopeDrop) continue;
    if (nearTown(x, z)) continue;
    if (roadDistance(x, z) < 7) continue;

    const variant = rng.int(0, 3);
    const scale = rng.range(spec.scale[0], spec.scale[1]);
    const rotY = rng.range(0, Math.PI * 2);
    const sink = spec.big ? 0.12 : 0.05;

    if (spec.big) {
      const src = floraGeometry(spec.type, variant).clone();
      eul.set(0, rotY, 0);
      quat.setFromEuler(eul);
      posV.set(lx, h - sink, lz);
      sclV.setScalar(scale);
      mat4.compose(posV, quat, sclV);
      src.applyMatrix4(mat4);
      bigParts.push(src);
      minY = Math.min(minY, h - 1);
      maxY = Math.max(maxY, h + 12 * scale);
    } else {
      let arr = smallByType.get(spec.type);
      if (!arr) {
        arr = [];
        smallByType.set(spec.type, arr);
      }
      eul.set(0, rotY, 0);
      quat.setFromEuler(eul);
      posV.set(lx, h - sink, lz);
      sclV.setScalar(scale);
      arr.push(new THREE.Matrix4().compose(posV, quat, sclV));
      minY = Math.min(minY, h - 1);
      maxY = Math.max(maxY, h + 3);
    }
  }

  // POI structures merge into the big mesh.
  if (withBig) {
    for (const poi of poisInChunk(cx, cz)) {
      const g = poiGeometry(poi.type, poi.seed).clone();
      eul.set(0, poi.rotY, 0);
      quat.setFromEuler(eul);
      posV.set(poi.x - ox, poi.y - 0.08, poi.z - oz);
      sclV.setScalar(1);
      mat4.compose(posV, quat, sclV);
      g.applyMatrix4(mat4);
      bigParts.push(g);
      minY = Math.min(minY, poi.y - 1);
      maxY = Math.max(maxY, poi.y + 10);
    }
  }

  const out: ChunkFlora = { big: null, small: [] };
  const material = vertexColorMaterial();

  if (bigParts.length) {
    const merged = mergeAll(bigParts);
    const mesh = new THREE.Mesh(merged, material);
    mesh.position.set(ox, 0, oz);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    merged.boundingBox = new THREE.Box3(
      new THREE.Vector3(0, minY, 0),
      new THREE.Vector3(CHUNK_SIZE, maxY, CHUNK_SIZE),
    );
    merged.boundingSphere = new THREE.Sphere();
    merged.boundingBox.getBoundingSphere(merged.boundingSphere);
    out.big = mesh;
  }

  for (const [type, mats] of smallByType) {
    const im = new THREE.InstancedMesh(floraGeometry(type, 0), material, mats.length);
    for (let i = 0; i < mats.length; i++) im.setMatrixAt(i, mats[i] as THREE.Matrix4);
    im.instanceMatrix.needsUpdate = true;
    im.position.set(ox, 0, oz);
    im.matrixAutoUpdate = false;
    im.updateMatrix();
    im.frustumCulled = true;
    // Instance-aware bounds (never mutate the shared pooled geometry).
    im.computeBoundingSphere();
    out.small.push(im);
  }

  return out;
}

function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Local import to avoid a hard dependency cycle with primitives.merge
  // (which disposes inputs — we want that here too).
  const nonIndexed = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  let total = 0;
  for (const p of nonIndexed) total += p.getAttribute('position').count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let off = 0;
  for (const p of nonIndexed) {
    const pp = p.getAttribute('position').array as Float32Array;
    const pn = p.getAttribute('normal').array as Float32Array;
    const pc = p.getAttribute('color').array as Float32Array;
    pos.set(pp, off * 3);
    nor.set(pn, off * 3);
    col.set(pc, off * 3);
    off += p.getAttribute('position').count;
    p.dispose();
  }
  for (const p of parts) p.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

export function disposeFlora(f: ChunkFlora): void {
  if (f.big) f.big.geometry.dispose();
  for (const im of f.small) {
    // Instanced geometry is shared from the variant pool — only release the
    // per-mesh bounds we attached, never dispose the pooled geometry.
    im.dispose();
  }
}
