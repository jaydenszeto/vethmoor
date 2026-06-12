/**
 * Kinematic capsule mover. P1: terrain clamp + slope slide + jump + swim.
 * P3 adds axis-separated AABB resolution + step-up against building/prop
 * colliders (the hooks are in place: moveX/moveZ are already separate).
 *
 * At 60 Hz fixed step and ≤ 9 m/s the per-tick displacement (≤ 0.15 m) is far
 * below the capsule radius — tunneling is impossible by construction.
 */

import { GRAVITY, JUMP_V0, SEA_LEVEL, SWIM_DEPTH, TERMINAL_V } from '@/data/world';
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
  /** Vertical speed at the moment of the last landing (for camera dip / fall damage). */
  landImpact: number;
}

export interface MoveInput {
  /** Desired horizontal velocity (already speed-scaled). */
  ax: number;
  az: number;
  /** Desired vertical velocity for swim/levitate. */
  ay: number;
  jump: boolean;
}

export interface CollisionQuery {
  heightAt(x: number, z: number): number;
  normalAt(x: number, z: number, out: { x: number; y: number; z: number }): void;
  /** Static colliders near a point (P3+; empty for now). */
  aabbsNear?(x: number, z: number, radius: number): readonly Aabb[];
}

const SLOPE_LIMIT_NY = 0.62; // cos ~52°
const GROUND_ACCEL = 38;
const AIR_ACCEL = 9;
const SWIM_ACCEL = 14;

const scratchN = { x: 0, y: 1, z: 0 };

function approach(v: number, target: number, maxDelta: number): number {
  const d = target - v;
  if (d > maxDelta) return v + maxDelta;
  if (d < -maxDelta) return v - maxDelta;
  return target;
}

export function stepBody(st: BodyState, inp: MoveInput, dt: number, q: CollisionQuery): void {
  st.landImpact = 0;

  if (st.mode === 'swim') {
    stepSwim(st, inp, dt, q);
    return;
  }
  if (st.mode === 'levitate') {
    stepLevitate(st, inp, dt, q);
    return;
  }

  // ---- walk ----
  const accel = st.onGround ? GROUND_ACCEL : AIR_ACCEL;
  st.vx = approach(st.vx, inp.ax, accel * dt);
  st.vz = approach(st.vz, inp.az, accel * dt);

  if (st.onGround && inp.jump) {
    st.vy = JUMP_V0;
    st.onGround = false;
  }

  st.vy -= GRAVITY * dt;
  if (st.vy < -TERMINAL_V) st.vy = -TERMINAL_V;

  // Horizontal axes move separately (AABB resolution slots in here in P3).
  st.x += st.vx * dt;
  st.z += st.vz * dt;
  st.y += st.vy * dt;

  const gh = q.heightAt(st.x, st.z);
  const wasGround = st.onGround;
  if (st.y <= gh) {
    q.normalAt(st.x, st.z, scratchN);
    if (scratchN.y < SLOPE_LIMIT_NY) {
      // Too steep: stand on it but slide downhill, no jumping.
      st.y = gh;
      st.onGround = false;
      const push = 16 * dt;
      st.vx += scratchN.x * push * 2.2;
      st.vz += scratchN.z * push * 2.2;
      if (st.vy < 0) st.vy *= 0.6;
    } else {
      if (!wasGround && st.vy < -6) st.landImpact = -st.vy;
      st.y = gh;
      st.vy = 0;
      st.onGround = true;
    }
  } else if (st.y > gh + 0.02) {
    st.onGround = false;
  }

  // Deep water → swim.
  const depthHere = SEA_LEVEL - gh;
  if (depthHere > SWIM_DEPTH && st.y < SEA_LEVEL - SWIM_DEPTH) {
    st.mode = 'swim';
    st.onGround = false;
    st.vy *= 0.3;
  }
}

function stepSwim(st: BodyState, inp: MoveInput, dt: number, q: CollisionQuery): void {
  st.vx = approach(st.vx, inp.ax, SWIM_ACCEL * dt);
  st.vz = approach(st.vz, inp.az, SWIM_ACCEL * dt);
  st.vy = approach(st.vy, inp.ay - 0.3, SWIM_ACCEL * dt); // slight sink

  st.x += st.vx * dt;
  st.z += st.vz * dt;
  st.y += st.vy * dt;

  const gh = q.heightAt(st.x, st.z);
  if (st.y < gh + 0.25) st.y = gh + 0.25;

  // Don't float above the surface.
  const surfaceY = SEA_LEVEL - 0.55;
  if (st.y > surfaceY) {
    st.y = surfaceY;
    if (st.vy > 0) st.vy = 0;
  }

  // Ground rose to meet us (walking out of the water).
  if (SEA_LEVEL - gh < SWIM_DEPTH * 0.8) {
    st.mode = 'walk';
    st.y = Math.max(st.y, gh);
  }
}

function stepLevitate(st: BodyState, inp: MoveInput, dt: number, q: CollisionQuery): void {
  st.vx = approach(st.vx, inp.ax, 18 * dt);
  st.vz = approach(st.vz, inp.az, 18 * dt);
  st.vy = approach(st.vy, inp.ay, 18 * dt);
  st.x += st.vx * dt;
  st.z += st.vz * dt;
  st.y += st.vy * dt;
  const gh = q.heightAt(st.x, st.z);
  if (st.y < gh) {
    st.y = gh;
    st.onGround = true;
  } else {
    st.onGround = false;
  }
}
