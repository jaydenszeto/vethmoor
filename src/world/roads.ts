/**
 * The road network. Computed once at boot: A* over a 64 m cost grid (slope,
 * water and volcanism penalized) between towns, smoothed, then installed as
 * a height modifier so the carriageway is gently graded into the terrain.
 * roadDistance() feeds the splat layer, flora rejection and POI placement.
 */

import { clamp, lerp, smoothstep } from '@/engine/math';
import { TOWNS } from '@/data/towns';
import { WORLD_SIZE } from '@/data/world';
import { installRoadModifier, volcanism, worldHeight } from './terrain';

const CELL = 64;
const GRID_N = WORLD_SIZE / CELL; // 192

interface RoadPoint {
  x: number;
  z: number;
  h: number; // smoothed roadway height
}

interface Segment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  ah: number;
  bh: number;
  len: number;
}

const segments: Segment[] = [];
/** Spatial buckets (256 m cells) of segment indices. */
const buckets = new Map<number, number[]>();
const BUCKET = 256;
let ready = false;

function bucketKey(bx: number, bz: number): number {
  return bx * 4096 + bz;
}

// ----- A* over the cost grid ----------------------------------------------------

function cellCost(cx: number, cz: number): number {
  const x = cx * CELL + CELL / 2;
  const z = cz * CELL + CELL / 2;
  const h = worldHeight(x, z);
  if (h < 0.4) return 60; // water — bridges are for later eras
  const h2 = worldHeight(x + CELL, z);
  const h3 = worldHeight(x, z + CELL);
  const slope = (Math.abs(h2 - h) + Math.abs(h3 - h)) / CELL;
  let cost = 1 + slope * 34;
  cost += smoothstep(0.35, 0.7, volcanism(x, z)) * 40; // skirt the Ember Tooth
  return cost;
}

function astar(
  sx: number,
  sz: number,
  tx: number,
  tz: number,
  costCache: Float32Array,
): Array<[number, number]> {
  const scx = clamp(Math.floor(sx / CELL), 0, GRID_N - 1);
  const scz = clamp(Math.floor(sz / CELL), 0, GRID_N - 1);
  const tcx = clamp(Math.floor(tx / CELL), 0, GRID_N - 1);
  const tcz = clamp(Math.floor(tz / CELL), 0, GRID_N - 1);

  const open: number[] = [scz * GRID_N + scx];
  const g = new Float32Array(GRID_N * GRID_N).fill(Infinity);
  const f = new Float32Array(GRID_N * GRID_N).fill(Infinity);
  const came = new Int32Array(GRID_N * GRID_N).fill(-1);
  const closed = new Uint8Array(GRID_N * GRID_N);
  const start = scz * GRID_N + scx;
  const goal = tcz * GRID_N + tcx;
  g[start] = 0;
  f[start] = Math.hypot(tcx - scx, tcz - scz);

  const costAt = (idx: number): number => {
    let c = costCache[idx] as number;
    if (c === 0) {
      c = cellCost(idx % GRID_N, Math.floor(idx / GRID_N));
      costCache[idx] = c;
    }
    return c;
  };

  while (open.length) {
    // Linear min-extract: open stays small relative to grid; fine at boot.
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      if ((f[open[i] as number] as number) < (f[open[bi] as number] as number)) bi = i;
    }
    const cur = open[bi] as number;
    open[bi] = open[open.length - 1] as number;
    open.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;

    const cx = cur % GRID_N;
    const cz = Math.floor(cur / GRID_N);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 1 || nx >= GRID_N - 1 || nz < 1 || nz >= GRID_N - 1) continue;
        const ni = nz * GRID_N + nx;
        if (closed[ni]) continue;
        const step = Math.hypot(dx, dz);
        const ng = (g[cur] as number) + step * costAt(ni);
        if (ng < (g[ni] as number)) {
          g[ni] = ng;
          f[ni] = ng + Math.hypot(tcx - nx, tcz - nz);
          came[ni] = cur;
          open.push(ni);
        }
      }
    }
  }

  // Reconstruct.
  const path: Array<[number, number]> = [];
  let cur = goal;
  if (came[goal] === -1 && goal !== start) return path; // unreachable (shouldn't happen)
  while (cur !== -1) {
    path.push([(cur % GRID_N) * CELL + CELL / 2, Math.floor(cur / GRID_N) * CELL + CELL / 2]);
    cur = came[cur] as number;
  }
  path.reverse();
  return path;
}

function chaikin(points: Array<[number, number]>): Array<[number, number]> {
  if (points.length < 3) return points;
  const out: Array<[number, number]> = [points[0] as [number, number]];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i] as [number, number];
    const [bx, bz] = points[i + 1] as [number, number];
    out.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25]);
    out.push([ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
  }
  out.push(points[points.length - 1] as [number, number]);
  return out;
}

// ----- build ----------------------------------------------------------------------

/** Town graph: each town connects to its 2 nearest neighbors (deduped). */
function townEdges(): Array<[number, number]> {
  const edges = new Set<string>();
  const out: Array<[number, number]> = [];
  for (let i = 0; i < TOWNS.length; i++) {
    const a = TOWNS[i]!;
    const dists = TOWNS.map((b, j) => ({
      j,
      d: Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1]),
    }))
      .filter((e) => e.j !== i)
      .sort((p, q) => p.d - q.d);
    for (const { j } of dists.slice(0, 2)) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!edges.has(key)) {
        edges.add(key);
        out.push(i < j ? [i, j] : [j, i]);
      }
    }
  }
  return out;
}

export function initRoads(): void {
  if (ready) return;
  const costCache = new Float32Array(GRID_N * GRID_N);

  for (const [i, j] of townEdges()) {
    const a = TOWNS[i]!;
    const b = TOWNS[j]!;
    let pts = astar(a.pos[0], a.pos[1], b.pos[0], b.pos[1], costCache);
    if (pts.length < 2) continue;
    pts = chaikin(chaikin(pts));

    // Heights along the way: rolling average, then forward/backward grade
    // clamping so the carriageway never exceeds MAX_GRADE by construction
    // (cuttings/embankments emerge naturally from the carve blend).
    const MAX_GRADE = 0.17;
    const raw = pts.map(([x, z]) => worldHeight(x, z));
    const hs = pts.map((_, k) => {
      let sum = 0;
      let n = 0;
      for (let o = -5; o <= 5; o++) {
        const idx = clamp(k + o, 0, raw.length - 1);
        sum += raw[idx] as number;
        n++;
      }
      return Math.max(sum / n, 0.7);
    });
    for (let k = 1; k < hs.length; k++) {
      const d = Math.hypot(
        (pts[k] as [number, number])[0] - (pts[k - 1] as [number, number])[0],
        (pts[k] as [number, number])[1] - (pts[k - 1] as [number, number])[1],
      );
      const maxD = MAX_GRADE * Math.max(d, 0.001);
      hs[k] = clamp(hs[k] as number, (hs[k - 1] as number) - maxD, (hs[k - 1] as number) + maxD);
    }
    for (let k = hs.length - 2; k >= 0; k--) {
      const d = Math.hypot(
        (pts[k] as [number, number])[0] - (pts[k + 1] as [number, number])[0],
        (pts[k] as [number, number])[1] - (pts[k + 1] as [number, number])[1],
      );
      const maxD = MAX_GRADE * Math.max(d, 0.001);
      hs[k] = clamp(hs[k] as number, (hs[k + 1] as number) - maxD, (hs[k + 1] as number) + maxD);
    }
    const road: RoadPoint[] = pts.map(([x, z], k) => ({ x, z, h: hs[k] as number }));

    for (let k = 0; k < road.length - 1; k++) {
      const p = road[k]!;
      const q = road[k + 1]!;
      const seg: Segment = {
        ax: p.x,
        az: p.z,
        bx: q.x,
        bz: q.z,
        ah: p.h,
        bh: q.h,
        len: Math.hypot(q.x - p.x, q.z - p.z),
      };
      const si = segments.length;
      segments.push(seg);
      // Register in overlapping buckets.
      const minBx = Math.floor(Math.min(p.x, q.x) - 40);
      const maxBx = Math.floor(Math.max(p.x, q.x) + 40);
      const minBz = Math.floor(Math.min(p.z, q.z) - 40);
      const maxBz = Math.floor(Math.max(p.z, q.z) + 40);
      for (let bz = Math.floor(minBz / BUCKET); bz <= Math.floor(maxBz / BUCKET); bz++) {
        for (let bx = Math.floor(minBx / BUCKET); bx <= Math.floor(maxBx / BUCKET); bx++) {
          const key = bucketKey(bx, bz);
          let arr = buckets.get(key);
          if (!arr) {
            arr = [];
            buckets.set(key, arr);
          }
          arr.push(si);
        }
      }
    }
  }

  ready = true;
  installRoadModifier((x, z, h) => {
    const q = roadQuery(x, z);
    if (!q) return h;
    const t = smoothstep(7.5, 2.6, q.dist);
    return t > 0 ? lerp(h, q.h, t * 0.92) : h;
  });
}

const queryResult = { dist: Infinity, h: 0 };

/** Distance to the nearest road centreline + roadway height there (≤ 40 m). */
export function roadQuery(x: number, z: number): { dist: number; h: number } | null {
  if (!ready) return null;
  const arr = buckets.get(bucketKey(Math.floor(x / BUCKET), Math.floor(z / BUCKET)));
  if (!arr) return null;
  let best = Infinity;
  let bestH = 0;
  for (const si of arr) {
    const s = segments[si] as Segment;
    const dx = s.bx - s.ax;
    const dz = s.bz - s.az;
    const t = clamp(((x - s.ax) * dx + (z - s.az) * dz) / (s.len * s.len || 1), 0, 1);
    const px = s.ax + dx * t;
    const pz = s.az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) {
      best = d;
      bestH = s.ah + (s.bh - s.ah) * t;
    }
  }
  if (best > 40) return null;
  queryResult.dist = best;
  queryResult.h = bestH;
  return queryResult;
}

export function roadDistance(x: number, z: number): number {
  const q = roadQuery(x, z);
  return q ? q.dist : Infinity;
}

/** Test hook. */
export function resetRoads(): void {
  segments.length = 0;
  buckets.clear();
  ready = false;
}

/** Test/inspection: the built segment list (read-only). */
export function roadSegments(): ReadonlyArray<{
  ax: number;
  az: number;
  bx: number;
  bz: number;
  ah: number;
  bh: number;
  len: number;
}> {
  return segments;
}
