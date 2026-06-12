/**
 * Flora + wilderness prop geometries. Each maker is deterministic from its
 * seed and returns a vertex-colored geometry with origin at ground level.
 * Variants are pre-baked per type (small pools, indexed by seed) so chunks
 * can instance/merge them cheaply.
 */

import * as THREE from 'three';
import { Sfc32, seedOf } from '@/engine/rng';
import { blob, box, crossedQuads, limb, merge, paint, paintGradient, translate } from './primitives';

export type FloraType =
  | 'grass'
  | 'reed'
  | 'rock'
  | 'twistedTree'
  | 'giantFungus'
  | 'deadTree'
  | 'ashSpike'
  | 'mushrooms';

const VARIANTS = 4;
const pool = new Map<string, THREE.BufferGeometry[]>();

function variants(type: FloraType, make: (rng: Sfc32, i: number) => THREE.BufferGeometry): THREE.BufferGeometry[] {
  let arr = pool.get(type);
  if (!arr) {
    arr = [];
    for (let i = 0; i < VARIANTS; i++) {
      arr.push(make(new Sfc32(seedOf(`flora-${type}`, i)), i));
    }
    pool.set(type, arr);
  }
  return arr;
}

export function floraGeometry(type: FloraType, variant: number): THREE.BufferGeometry {
  const arr = variants(type, MAKERS[type]);
  return arr[variant % arr.length] as THREE.BufferGeometry;
}

const GRASS_TONES = [0x55603c, 0x4b5836, 0x5d6540, 0x515c3b];
const REED_TONES = [0x5c5a3b, 0x6a6446, 0x615e42, 0x575740];

const MAKERS: Record<FloraType, (rng: Sfc32, i: number) => THREE.BufferGeometry> = {
  grass(rng, i) {
    const g = crossedQuads(rng.range(0.5, 0.8), rng.range(0.35, 0.6), 3, rng.range(0.05, 0.16));
    return paintGradient(g, 0x39402a, GRASS_TONES[i % GRASS_TONES.length] as number);
  },

  reed(rng, i) {
    const g = crossedQuads(rng.range(0.25, 0.4), rng.range(1.2, 1.9), 3, rng.range(0.1, 0.25));
    return paintGradient(g, 0x3c4030, REED_TONES[i % REED_TONES.length] as number);
  },

  rock(rng) {
    const g = blob(rng, rng.range(0.5, 1.4), rng.range(0.55, 0.8));
    g.translate(0, rng.range(0.05, 0.25), 0);
    return paintGradient(g, 0x2e2c28, 0x575349);
  },

  twistedTree(rng) {
    const parts: THREE.BufferGeometry[] = [];
    // Gnarled trunk: stacked bent limbs.
    let x = 0;
    let y = 0;
    let z = 0;
    let r = rng.range(0.28, 0.4);
    const segs = 4;
    for (let s = 0; s < segs; s++) {
      const nx = x + rng.range(-0.7, 0.7);
      const ny = y + rng.range(1.1, 1.7);
      const nz = z + rng.range(-0.7, 0.7);
      const nr = r * 0.72;
      parts.push(paintGradient(limb(x, y, z, nx, ny, nz, r, nr, 5), 0x33291f, 0x4a3c2c));
      x = nx;
      y = ny;
      z = nz;
      r = nr;
    }
    // Two crooked branches.
    for (let b = 0; b < 2; b++) {
      const bx = x + rng.range(-1.6, 1.6);
      const by = y + rng.range(0.2, 1.1);
      const bz = z + rng.range(-1.6, 1.6);
      parts.push(paintGradient(limb(x, y, z, bx, by, bz, r * 0.8, r * 0.35, 4), 0x33291f, 0x52422f));
    }
    // Sparse moody canopy.
    const canopyTone = rng.chance(0.5) ? 0x46523a : 0x4e4d38;
    for (let c = 0; c < 3; c++) {
      const cg = blob(rng, rng.range(0.9, 1.5), 0.55, 0);
      cg.translate(x + rng.range(-1.2, 1.2), y + rng.range(0.3, 1), z + rng.range(-1.2, 1.2));
      parts.push(paintGradient(cg, 0x323a28, canopyTone));
    }
    return merge(parts);
  },

  giantFungus(rng) {
    // The Morrowind-weird landmark: a 7–11 m parasol mushroom.
    const h = rng.range(6.5, 10.5);
    const lean = rng.range(-0.12, 0.12);
    const parts: THREE.BufferGeometry[] = [];
    const stalkTone = rng.chance(0.5) ? 0xa89a7c : 0x9c8e74;
    parts.push(
      paintGradient(
        limb(0, 0, 0, lean * h, h, lean * h * 0.6, rng.range(0.45, 0.6), 0.28, 7),
        0x6b6150,
        stalkTone,
      ),
    );
    // Cap: squashed sphere, teal/violet underside-to-rim gradient.
    const capR = rng.range(2.6, 4.2);
    const cap = new THREE.SphereGeometry(capR, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.42);
    cap.scale(1, rng.range(0.55, 0.75), 1);
    cap.translate(lean * h, h - capR * 0.12, lean * h * 0.6);
    const capTone = rng.chance(0.5) ? 0x3f6b62 : 0x53527a;
    parts.push(paintGradient(cap, capTone, 0x77a08c));
    // Gills disc under the cap.
    const gills = new THREE.CircleGeometry(capR * 0.92, 10);
    gills.rotateX(Math.PI / 2);
    gills.translate(lean * h, h - capR * 0.1, lean * h * 0.6);
    parts.push(paint(gills, 0x84765a));
    return merge(parts);
  },

  deadTree(rng) {
    const parts: THREE.BufferGeometry[] = [];
    const h = rng.range(3, 5);
    parts.push(paintGradient(limb(0, 0, 0, rng.range(-0.5, 0.5), h, rng.range(-0.5, 0.5), 0.3, 0.12, 5), 0x231f1c, 0x3a332c));
    const tips = rng.int(2, 4);
    for (let b = 0; b < tips; b++) {
      const sy = h * rng.range(0.45, 0.85);
      const sx = rng.range(-0.3, 0.3);
      const sz = rng.range(-0.3, 0.3);
      parts.push(
        paintGradient(
          limb(sx, sy, sz, sx + rng.range(-1.8, 1.8), sy + rng.range(0.6, 1.6), sz + rng.range(-1.8, 1.8), 0.12, 0.03, 4),
          0x231f1c,
          0x423a30,
        ),
      );
    }
    return merge(parts);
  },

  ashSpike(rng) {
    // Sharp volcanic shard, tilted.
    const h = rng.range(1.6, 3.6);
    const g = new THREE.ConeGeometry(rng.range(0.4, 0.8), h, 5);
    g.translate(0, h / 2, 0);
    g.rotateZ(rng.range(-0.3, 0.3));
    g.rotateX(rng.range(-0.2, 0.2));
    const rough = g.toNonIndexed();
    g.dispose();
    return paintGradient(rough, 0x241f1e, 0x4d4340);
  },

  mushrooms(rng) {
    // Cluster of 3–5 knee-high toadstools.
    const parts: THREE.BufferGeometry[] = [];
    const n = rng.int(3, 5);
    for (let m = 0; m < n; m++) {
      const mh = rng.range(0.25, 0.6);
      const mx = rng.range(-0.5, 0.5);
      const mz = rng.range(-0.5, 0.5);
      parts.push(paintGradient(limb(mx, 0, mz, mx, mh, mz, 0.06, 0.045, 5), 0x8d8268, 0xaca185));
      const cap = new THREE.SphereGeometry(rng.range(0.12, 0.26), 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.5);
      cap.translate(mx, mh, mz);
      parts.push(paint(cap, rng.chance(0.5) ? 0x6f5a76 : 0x4f7d6d));
    }
    return merge(parts);
  },
};

// ----- wilderness POI structures ------------------------------------------------

export type PoiType = 'shrine' | 'camp' | 'watchtower' | 'stones' | 'boulders';

export function poiGeometry(type: PoiType, seed: number): THREE.BufferGeometry {
  const rng = new Sfc32(seed);
  switch (type) {
    case 'shrine': {
      const parts: THREE.BufferGeometry[] = [];
      parts.push(paintGradient(box(2.4, 0.5, 2.4), 0x2c2a26, 0x47433c)); // plinth
      parts.push(paintGradient(translate(box(0.7, 2.4, 0.7), 0, 0.5, 0), 0x35322c, 0x504a40)); // pillar
      const ember = new THREE.OctahedronGeometry(0.32, 0);
      ember.translate(0, 3.25, 0);
      parts.push(paint(ember, 0xff8a3c)); // votive ember (emissive feel via color)
      return merge(parts);
    }
    case 'camp': {
      const parts: THREE.BufferGeometry[] = [];
      const tent = new THREE.ConeGeometry(1.6, 2.1, 6, 1, true);
      tent.translate(0, 1.05, 0);
      parts.push(paintGradient(tent.toNonIndexed(), 0x4a3b2a, 0x6b573c));
      // Fire ring.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const s = blob(rng, 0.22, 0.7);
        s.translate(Math.cos(a) * 0.8 + 2.6, 0.05, Math.sin(a) * 0.8);
        parts.push(paintGradient(s, 0x26241f, 0x4a463e));
      }
      const log = limb(1.4, 0.12, 1.8, 3.8, 0.18, 2.4, 0.16, 0.13, 5);
      parts.push(paintGradient(log, 0x2e251c, 0x4a3b29));
      return merge(parts);
    }
    case 'watchtower': {
      const parts: THREE.BufferGeometry[] = [];
      // Ruined square tower: 4 corner piers of differing heights + wall stubs.
      const heights = [7.5, 5.8, 3.2, 6.4];
      const c = 2.2;
      const at = [
        [-c, -c],
        [c, -c],
        [c, c],
        [-c, c],
      ] as const;
      for (let i = 0; i < 4; i++) {
        const [px, pz] = at[i] as readonly [number, number];
        parts.push(
          paintGradient(translate(box(1.1, heights[i] as number, 1.1), px, 0, pz), 0x2e2c28, 0x57534a),
        );
      }
      parts.push(paintGradient(translate(box(c * 2 + 1.1, 2.2, 0.8), 0, 0, -c), 0x2e2c28, 0x514d44));
      parts.push(paintGradient(translate(box(0.8, 3.1, c * 2 + 1.1), c, 0, 0), 0x2e2c28, 0x514d44));
      return merge(parts);
    }
    case 'stones': {
      const parts: THREE.BufferGeometry[] = [];
      const n = rng.int(5, 7);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
        const r = rng.range(3, 4.5);
        const h = rng.range(1.6, 3.4);
        const s = box(rng.range(0.5, 0.9), h, rng.range(0.35, 0.6));
        s.rotateY(a + rng.range(-0.3, 0.3));
        s.rotateZ(rng.range(-0.08, 0.08));
        s.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
        parts.push(paintGradient(s, 0x2b2e2c, 0x4c5350));
      }
      return merge(parts);
    }
    case 'boulders': {
      const parts: THREE.BufferGeometry[] = [];
      const n = rng.int(4, 7);
      for (let i = 0; i < n; i++) {
        const s = blob(rng, rng.range(0.8, 2.2), rng.range(0.5, 0.75));
        s.translate(rng.range(-4, 4), rng.range(0, 0.3), rng.range(-4, 4));
        parts.push(paintGradient(s, 0x2e2c28, 0x59544a));
      }
      return merge(parts);
    }
  }
}
