/** Segment raycasts against AABB sets — interaction, projectiles, AI sight. */

import type { Aabb } from './math';

export interface RayHit {
  t: number; // 0..1 along the segment
  box: Aabb | null;
}

/** Slab test: segment (ox,oy,oz)→(ex,ey,ez) vs one box. Returns t or Infinity. */
export function segmentVsAabb(
  ox: number,
  oy: number,
  oz: number,
  ex: number,
  ey: number,
  ez: number,
  b: Aabb,
): number {
  const dx = ex - ox;
  const dy = ey - oy;
  const dz = ez - oz;
  let tmin = 0;
  let tmax = 1;

  for (let axis = 0; axis < 3; axis++) {
    const o = axis === 0 ? ox : axis === 1 ? oy : oz;
    const d = axis === 0 ? dx : axis === 1 ? dy : dz;
    const lo = axis === 0 ? b.minX : axis === 1 ? b.minY : b.minZ;
    const hi = axis === 0 ? b.maxX : axis === 1 ? b.maxY : b.maxZ;
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return Infinity;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

/** Nearest hit against a set of boxes. */
export function raycastBoxes(
  ox: number,
  oy: number,
  oz: number,
  ex: number,
  ey: number,
  ez: number,
  set: readonly Aabb[],
  out: RayHit,
): boolean {
  out.t = Infinity;
  out.box = null;
  for (const b of set) {
    const t = segmentVsAabb(ox, oy, oz, ex, ey, ez, b);
    if (t < out.t) {
      out.t = t;
      out.box = b;
    }
  }
  return out.t <= 1;
}

/**
 * March a segment against a heightfield: returns t of first below-ground
 * sample (coarse, stepLen metres) or Infinity. Good enough for arrows/sight.
 */
export function segmentVsHeightfield(
  ox: number,
  oy: number,
  oz: number,
  ex: number,
  ey: number,
  ez: number,
  heightAt: (x: number, z: number) => number,
  stepLen = 1.5,
): number {
  const dx = ex - ox;
  const dy = ey - oy;
  const dz = ez - oz;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const steps = Math.max(2, Math.ceil(len / stepLen));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const y = oy + dy * t;
    if (y < heightAt(ox + dx * t, oz + dz * t)) return (i - 0.5) / steps;
  }
  return Infinity;
}
