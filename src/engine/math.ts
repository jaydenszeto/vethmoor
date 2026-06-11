/** Small math toolkit. Allocation-free; safe for sim hot paths. */

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function invLerp(a: number, b: number, v: number): number {
  return a === b ? 0 : clamp01((v - a) / (b - a));
}

export function remap(v: number, inLo: number, inHi: number, outLo: number, outHi: number): number {
  return lerp(outLo, outHi, invLerp(inLo, inHi, v));
}

export function smoothstep(edge0: number, edge1: number, v: number): number {
  const t = clamp01((v - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function smootherstep(edge0: number, edge1: number, v: number): number {
  const t = clamp01((v - edge0) / (edge1 - edge0));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Frame-rate independent exponential damping toward target. */
export function expDamp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Wrap angle to (-PI, PI]. */
export function wrapAngle(a: number): number {
  a = a % TAU;
  if (a > Math.PI) a -= TAU;
  if (a <= -Math.PI) a += TAU;
  return a;
}

/** Shortest-path angular lerp. */
export function angleLerp(a: number, b: number, t: number): number {
  return a + wrapAngle(b - a) * t;
}

/** Euclidean modulo (always >= 0). */
export function emod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function dist2D(x0: number, z0: number, x1: number, z1: number): number {
  const dx = x1 - x0;
  const dz = z1 - z0;
  return Math.sqrt(dx * dx + dz * dz);
}

export function distSq2D(x0: number, z0: number, x1: number, z1: number): number {
  const dx = x1 - x0;
  const dz = z1 - z0;
  return dx * dx + dz * dz;
}

/** Axis-aligned box, flat fields to avoid nested allocation. */
export interface Aabb {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export function aabb(
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): Aabb {
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

export function aabbFromCenter(
  cx: number,
  cy: number,
  cz: number,
  halfX: number,
  halfY: number,
  halfZ: number,
): Aabb {
  return {
    minX: cx - halfX,
    minY: cy - halfY,
    minZ: cz - halfZ,
    maxX: cx + halfX,
    maxY: cy + halfY,
    maxZ: cz + halfZ,
  };
}

export function aabbOverlaps(a: Aabb, b: Aabb): boolean {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minY < b.maxY &&
    a.maxY > b.minY &&
    a.minZ < b.maxZ &&
    a.maxZ > b.minZ
  );
}

export function aabbContainsPoint(a: Aabb, x: number, y: number, z: number): boolean {
  return x >= a.minX && x <= a.maxX && y >= a.minY && y <= a.maxY && z >= a.minZ && z <= a.maxZ;
}
