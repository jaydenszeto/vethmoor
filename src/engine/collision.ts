/**
 * Kinematic capsule mover: terrain/floor clamp + axis-separated AABB
 * resolution with step-up, slope slide, jump, swim, levitate. The capsule is
 * treated as a vertical box (r × height) for statics — at our scales and
 * 60 Hz steps the difference from a true capsule is imperceptible, and the
 * axis-separated resolve is corner-safe by construction.
 */

import {
  GRAVITY,
  JUMP_V0,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  SEA_LEVEL,
  STEP_UP,
  SWIM_DEPTH,
  TERMINAL_V,
} from '@/data/world';
import type { Aabb } from './math';

export type MoveMode = 'walk' | 'swim' | 'levitate';

export interface BodyState {
  x: number;
  y: number; // feet
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  mode: MoveMode;
  landImpact: number;
}

export interface MoveInput {
  ax: number;
  az: number;
  ay: number;
  jump: boolean;
}

export interface CollisionQuery {
  /** Base support height (terrain outdoors, room floor indoors). */
  heightAt(x: number, z: number): number;
  normalAt(x: number, z: number, out: { x: number; y: number; z: number }): void;
  /** Static AABBs near a point (radius ~2 m). */
  aabbsNear(x: number, z: number, radius: number, out: Aabb[]): readonly Aabb[];
  /** True outdoors (enables swim transitions + slope slide). */
  isExterior(): boolean;
}

const SLOPE_LIMIT_NY = 0.62;
const GROUND_ACCEL = 38;
const AIR_ACCEL = 9;
const SWIM_ACCEL = 14;
const R = PLAYER_RADIUS;
const H = PLAYER_HEIGHT;

const scratchN = { x: 0, y: 1, z: 0 };
const boxes: Aabb[] = [];

function approach(v: number, target: number, maxDelta: number): number {
  const d = target - v;
  if (d > maxDelta) return v + maxDelta;
  if (d < -maxDelta) return v - maxDelta;
  return target;
}

function overlapsY(st: BodyState, b: Aabb): boolean {
  return st.y + 0.02 < b.maxY && st.y + H > b.minY;
}

function overlapsXZ(x: number, z: number, b: Aabb): boolean {
  return x + R > b.minX && x - R < b.maxX && z + R > b.minZ && z - R < b.maxZ;
}

/** Can the body stand at height y (no box blocks the capsule)? */
function spaceFreeAt(x: number, y: number, z: number): boolean {
  for (const b of boxes) {
    if (overlapsXZ(x, z, b) && y + 0.02 < b.maxY && y + H > b.minY) return false;
  }
  return true;
}

/** Resolve one horizontal axis against static boxes (with step-up). */
function resolveAxis(st: BodyState, axis: 'x' | 'z'): void {
  for (const b of boxes) {
    if (!overlapsXZ(st.x, st.z, b) || !overlapsY(st, b)) continue;
    // Step-up: low obstacle with free space on top.
    const rise = b.maxY - st.y;
    if (rise > 0 && rise <= STEP_UP && spaceFreeAt(st.x, b.maxY, st.z)) {
      st.y = b.maxY;
      st.onGround = true;
      if (st.vy < 0) st.vy = 0;
      continue;
    }
    if (axis === 'x') {
      const penL = st.x + R - b.minX;
      const penR = b.maxX - (st.x - R);
      st.x += penL < penR ? -penL : penR;
      st.vx = 0;
    } else {
      const penL = st.z + R - b.minZ;
      const penR = b.maxZ - (st.z - R);
      st.z += penL < penR ? -penL : penR;
      st.vz = 0;
    }
  }
}

/** Highest support top under the feet (boxes only). */
function boxSupport(st: BodyState): number {
  let support = -Infinity;
  for (const b of boxes) {
    if (!overlapsXZ(st.x, st.z, b)) continue;
    if (b.maxY <= st.y + STEP_UP + 0.01 && b.maxY > support) {
      // Only count tops that are below (or barely above) the feet.
      support = b.maxY;
    }
  }
  return support;
}

/** Lowest ceiling above the head. */
function ceilingAbove(st: BodyState): number {
  let ceil = Infinity;
  for (const b of boxes) {
    if (!overlapsXZ(st.x, st.z, b)) continue;
    if (b.minY >= st.y + H * 0.5 && b.minY < ceil) ceil = b.minY;
  }
  return ceil;
}

export function stepBody(st: BodyState, inp: MoveInput, dt: number, q: CollisionQuery): void {
  st.landImpact = 0;
  q.aabbsNear(st.x, st.z, 2.5, boxes);

  if (st.mode === 'swim') {
    stepSwim(st, inp, dt, q);
    return;
  }
  if (st.mode === 'levitate') {
    stepFly(st, inp, dt, q);
    return;
  }

  const accel = st.onGround ? GROUND_ACCEL : AIR_ACCEL;
  st.vx = approach(st.vx, inp.ax, accel * dt);
  st.vz = approach(st.vz, inp.az, accel * dt);

  if (st.onGround && inp.jump) {
    st.vy = JUMP_V0;
    st.onGround = false;
  }

  st.vy -= GRAVITY * dt;
  if (st.vy < -TERMINAL_V) st.vy = -TERMINAL_V;

  // Horizontal, axis-separated.
  st.x += st.vx * dt;
  resolveAxis(st, 'x');
  st.z += st.vz * dt;
  resolveAxis(st, 'z');

  // Vertical.
  st.y += st.vy * dt;

  // Ceiling.
  const ceil = ceilingAbove(st);
  if (st.y + H > ceil) {
    st.y = ceil - H;
    if (st.vy > 0) st.vy = 0;
  }

  // Support: terrain/floor or box top.
  const groundH = q.heightAt(st.x, st.z);
  const support = Math.max(groundH, boxSupport(st));
  const wasGround = st.onGround;

  if (st.y <= support) {
    let steep = false;
    if (q.isExterior() && support === groundH) {
      q.normalAt(st.x, st.z, scratchN);
      steep = scratchN.y < SLOPE_LIMIT_NY;
    }
    if (steep) {
      st.y = support;
      st.onGround = false;
      st.vx += scratchN.x * 35 * dt;
      st.vz += scratchN.z * 35 * dt;
      if (st.vy < 0) st.vy *= 0.6;
    } else {
      if (!wasGround && st.vy < -6) st.landImpact = -st.vy;
      st.y = support;
      st.vy = 0;
      st.onGround = true;
    }
  } else if (st.y > support + 0.02) {
    st.onGround = false;
  }

  // Deep water → swim (exterior only).
  if (q.isExterior()) {
    const depthHere = SEA_LEVEL - groundH;
    if (depthHere > SWIM_DEPTH && st.y < SEA_LEVEL - SWIM_DEPTH) {
      st.mode = 'swim';
      st.onGround = false;
      st.vy *= 0.3;
    }
  }
}

function stepSwim(st: BodyState, inp: MoveInput, dt: number, q: CollisionQuery): void {
  st.vx = approach(st.vx, inp.ax, SWIM_ACCEL * dt);
  st.vz = approach(st.vz, inp.az, SWIM_ACCEL * dt);
  st.vy = approach(st.vy, inp.ay - 0.3, SWIM_ACCEL * dt);

  st.x += st.vx * dt;
  resolveAxis(st, 'x');
  st.z += st.vz * dt;
  resolveAxis(st, 'z');
  st.y += st.vy * dt;

  const gh = q.heightAt(st.x, st.z);
  if (st.y < gh + 0.25) st.y = gh + 0.25;

  const surfaceY = SEA_LEVEL - 0.55;
  if (st.y > surfaceY) {
    st.y = surfaceY;
    if (st.vy > 0) st.vy = 0;
  }

  if (SEA_LEVEL - gh < SWIM_DEPTH * 0.8) {
    st.mode = 'walk';
    st.y = Math.max(st.y, gh);
  }
}

function stepFly(st: BodyState, inp: MoveInput, dt: number, q: CollisionQuery): void {
  st.vx = approach(st.vx, inp.ax, 18 * dt);
  st.vz = approach(st.vz, inp.az, 18 * dt);
  st.vy = approach(st.vy, inp.ay, 18 * dt);
  st.x += st.vx * dt;
  resolveAxis(st, 'x');
  st.z += st.vz * dt;
  resolveAxis(st, 'z');
  st.y += st.vy * dt;
  const ceil = ceilingAbove(st);
  if (st.y + H > ceil) {
    st.y = ceil - H;
    if (st.vy > 0) st.vy = 0;
  }
  const gh = Math.max(q.heightAt(st.x, st.z), boxSupport(st));
  if (st.y < gh) {
    st.y = gh;
    st.onGround = true;
  } else {
    st.onGround = false;
  }
}
