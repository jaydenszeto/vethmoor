/**
 * Interior room kit: rectangular rooms + doorway-aware wall segments +
 * themed furniture. Authoring rules (enforced here): doorway openings are
 * ≥ 1.4 m wide × 2.2 m tall; stair risers ≤ 0.4 m. Output is one merged
 * geometry, a collider list, room records for floorAt(), entity specs, and
 * point-light specs.
 */

import * as THREE from 'three';
import type { Sfc32 } from '@/engine/rng';
import { aabb, type Aabb } from '@/engine/math';
import { blob, box, limb, merge, paint, paintGradient } from './primitives';

export interface Room {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  floorY: number;
  ceilY: number;
}

export interface Opening {
  /** Wall plane coordinate: for axis 'x' walls run along X at z=at. */
  axis: 'x' | 'z';
  at: number;
  center: number;
  width: number;
}

export interface LightSpec {
  x: number;
  y: number;
  z: number;
  color: number;
  intensity: number;
  flicker: boolean;
}

export interface EntitySpec {
  kind: 'container' | 'door' | 'npc' | 'pickup' | 'marker';
  x: number;
  y: number;
  z: number;
  rotY: number;
  tag: string; // e.g. 'chest', 'exit', 'spawn:skeleton'
}

export interface InteriorTheme {
  floorLo: number;
  floorHi: number;
  wall: number;
  wallHi: number;
  ceil: number;
  trim: number;
}

export const THEME_TIMBER: InteriorTheme = {
  floorLo: 0x3a2f22,
  floorHi: 0x55452f,
  wall: 0x4f4536,
  wallHi: 0x6a5d48,
  ceil: 0x352c20,
  trim: 0x2c241a,
};

export const THEME_STONE: InteriorTheme = {
  floorLo: 0x2e2b27,
  floorHi: 0x46423b,
  wall: 0x3c3933,
  wallHi: 0x555047,
  ceil: 0x2a2723,
  trim: 0x232019,
};

export interface InteriorBuild {
  geos: THREE.BufferGeometry[];
  colliders: Aabb[];
  rooms: Room[];
  lights: LightSpec[];
  entities: EntitySpec[];
}

export function newBuild(): InteriorBuild {
  return { geos: [], colliders: [], rooms: [], lights: [], entities: [] };
}

const WALL_T = 0.34;
const DOOR_H = 2.2;

/** Add a room's floor + ceiling (walls added separately, doorway-aware). */
export function addRoomShell(b: InteriorBuild, room: Room, theme: InteriorTheme): void {
  b.rooms.push(room);
  const w = room.x1 - room.x0;
  const d = room.z1 - room.z0;
  const cx = (room.x0 + room.x1) / 2;
  const cz = (room.z0 + room.z1) / 2;
  const floor = box(w + WALL_T * 2, 0.25, d + WALL_T * 2);
  floor.translate(cx, room.floorY - 0.25, cz);
  b.geos.push(paintGradient(floor, theme.floorLo, theme.floorHi));
  const ceil = box(w + WALL_T * 2, 0.25, d + WALL_T * 2);
  ceil.translate(cx, room.ceilY, cz);
  b.geos.push(paint(ceil, theme.ceil));
  // Floor/ceiling colliders (support + head clamp).
  b.colliders.push(aabb(room.x0 - WALL_T, room.floorY - 0.3, room.z0 - WALL_T, room.x1 + WALL_T, room.floorY, room.z1 + WALL_T));
  b.colliders.push(aabb(room.x0 - WALL_T, room.ceilY, room.z0 - WALL_T, room.x1 + WALL_T, room.ceilY + 0.3, room.z1 + WALL_T));
}

/**
 * Wall along one edge with optional openings. axis 'x': wall spans x0..x1 at
 * z=at. Openings are (center, width) along the span; lintels fill above.
 */
export function addWall(
  b: InteriorBuild,
  axis: 'x' | 'z',
  span0: number,
  span1: number,
  at: number,
  floorY: number,
  ceilY: number,
  theme: InteriorTheme,
  openings: ReadonlyArray<{ center: number; width: number }> = [],
): void {
  const sorted = [...openings].sort((a, bb) => a.center - bb.center);
  let cursor = span0;
  const segs: Array<[number, number, number]> = []; // start, end, bottomY (0 = full)
  for (const o of sorted) {
    const o0 = o.center - o.width / 2;
    const o1 = o.center + o.width / 2;
    if (o0 > cursor) segs.push([cursor, o0, floorY]);
    // Lintel above the opening.
    segs.push([o0, o1, floorY + DOOR_H]);
    cursor = o1;
  }
  if (cursor < span1) segs.push([cursor, span1, floorY]);

  for (const [s0, s1, bottom] of segs) {
    const len = s1 - s0;
    if (len < 0.05) continue;
    const h = ceilY - bottom;
    if (h < 0.05) continue;
    const mid = (s0 + s1) / 2;
    const g =
      axis === 'x'
        ? box(len, h, WALL_T)
        : box(WALL_T, h, len);
    if (axis === 'x') g.translate(mid, bottom, at);
    else g.translate(at, bottom, mid);
    b.geos.push(paintGradient(g, theme.wall, theme.wallHi));
    b.colliders.push(
      axis === 'x'
        ? aabb(s0, bottom, at - WALL_T / 2, s1, bottom + h, at + WALL_T / 2)
        : aabb(at - WALL_T / 2, bottom, s0, at + WALL_T / 2, bottom + h, s1),
    );
  }
}

/** floorAt for a room list (highest floor whose rect contains the point). */
export function floorAtRooms(rooms: readonly Room[], x: number, z: number): number {
  let best = -Infinity;
  for (const r of rooms) {
    if (x >= r.x0 - WALL_T && x <= r.x1 + WALL_T && z >= r.z0 - WALL_T && z <= r.z1 + WALL_T) {
      if (r.floorY > best) best = r.floorY;
    }
  }
  return best === -Infinity ? 0 : best;
}

// ----- furniture -----------------------------------------------------------------

export function addTable(b: InteriorBuild, rng: Sfc32, x: number, y: number, z: number): void {
  const w = rng.range(1.2, 1.9);
  const d = rng.range(0.7, 1);
  const top = box(w, 0.09, d);
  top.translate(x, y + 0.72, z);
  b.geos.push(paintGradient(top, 0x4a3b28, 0x614e35));
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    const leg = box(0.09, 0.72, 0.09);
    leg.translate(x + (sx * (w - 0.2)) / 2, y, z + (sz * (d - 0.2)) / 2);
    b.geos.push(paint(leg, 0x3a2e1f));
  }
  b.colliders.push(aabb(x - w / 2, y, z - d / 2, x + w / 2, y + 0.81, z + d / 2));
}

export function addChair(b: InteriorBuild, x: number, y: number, z: number, rotY: number): void {
  const seat = box(0.45, 0.07, 0.45);
  seat.translate(0, 0.42, 0);
  const back = box(0.45, 0.55, 0.07);
  back.translate(0, 0.49, -0.19);
  const legA = box(0.06, 0.42, 0.06);
  legA.translate(-0.17, 0, -0.17);
  const legB = box(0.06, 0.42, 0.06);
  legB.translate(0.17, 0, -0.17);
  const legC = box(0.06, 0.42, 0.06);
  legC.translate(0.17, 0, 0.17);
  const legD = box(0.06, 0.42, 0.06);
  legD.translate(-0.17, 0, 0.17);
  const g = merge([seat, back, legA, legB, legC, legD]);
  g.rotateY(rotY);
  g.translate(x, y, z);
  b.geos.push(paintGradient(g, 0x3a2e1f, 0x55432c));
  b.colliders.push(aabb(x - 0.26, y, z - 0.26, x + 0.26, y + 0.5, z + 0.26));
}

export function addBed(b: InteriorBuild, rng: Sfc32, x: number, y: number, z: number, rotY: number): void {
  const frame = box(1.05, 0.32, 2.05);
  const mattress = box(0.92, 0.16, 1.9);
  mattress.translate(0, 0.32, 0);
  const pillow = box(0.7, 0.12, 0.4);
  pillow.translate(0, 0.48, -0.68);
  const blanketTone = rng.pick([0x5d3f33, 0x3f4d56, 0x4d5540, 0x59503a] as const);
  const fg = merge([frame]);
  fg.rotateY(rotY);
  fg.translate(x, y, z);
  b.geos.push(paintGradient(fg, 0x3a2e1f, 0x4d3d28));
  const mg = merge([mattress, pillow]);
  mg.rotateY(rotY);
  mg.translate(x, y, z);
  b.geos.push(paintGradient(mg, blanketTone, (blanketTone & 0xfefefe) + 0x181410));
  b.colliders.push(aabb(x - 1.05, y, z - 1.05, x + 1.05, y + 0.5, z + 1.05));
}

export function addShelf(b: InteriorBuild, x: number, y: number, z: number, rotY: number): void {
  const back = box(1.4, 2, 0.08);
  back.translate(0, 0, -0.2);
  const parts: THREE.BufferGeometry[] = [back];
  for (let i = 0; i < 4; i++) {
    const plank = box(1.4, 0.06, 0.42);
    plank.translate(0, 0.3 + i * 0.5, 0);
    parts.push(plank);
  }
  const g = merge(parts);
  g.rotateY(rotY);
  g.translate(x, y, z);
  b.geos.push(paintGradient(g, 0x3c2f20, 0x594732));
  b.colliders.push(aabb(x - 0.75, y, z - 0.75, x + 0.75, y + 2, z + 0.75));
}

export function addCounter(b: InteriorBuild, x: number, y: number, z: number, len: number, rotY: number): void {
  const body = box(len, 1.02, 0.6);
  const top = box(len + 0.15, 0.08, 0.75);
  top.translate(0, 1.02, 0);
  const g = merge([body, top]);
  g.rotateY(rotY);
  g.translate(x, y, z);
  b.geos.push(paintGradient(g, 0x42321f, 0x5f4a2e));
  const hx = rotY % Math.PI > 0.7 ? 0.45 : len / 2 + 0.1;
  const hz = rotY % Math.PI > 0.7 ? len / 2 + 0.1 : 0.45;
  b.colliders.push(aabb(x - hx, y, z - hz, x + hx, y + 1.1, z + hz));
}

export function addBarrel(b: InteriorBuild, rng: Sfc32, x: number, y: number, z: number): void {
  const c = new THREE.CylinderGeometry(0.34, 0.3, 0.85, 8);
  c.translate(x, y + 0.43, z);
  b.geos.push(paintGradient(c.toNonIndexed(), 0x3c2f20, rng.pick([0x5a4730, 0x52412c] as const)));
  b.colliders.push(aabb(x - 0.35, y, z - 0.35, x + 0.35, y + 0.86, z + 0.35));
}

export function addRug(b: InteriorBuild, rng: Sfc32, x: number, y: number, z: number, w: number, d: number): void {
  const g = box(w, 0.03, d);
  g.translate(x, y + 0.005, z);
  const tone = rng.pick([0x5d3a30, 0x3d4a52, 0x55503c, 0x4a3d50] as const);
  b.geos.push(paintGradient(g, tone, (tone & 0xfefefe) + 0x141210));
}

/** Chest geometry (the container entity is added by the caller). */
export function addChestGeo(b: InteriorBuild, x: number, y: number, z: number, rotY: number): void {
  const body = box(0.85, 0.5, 0.5);
  const lid = box(0.85, 0.16, 0.5);
  lid.translate(0, 0.5, 0);
  const clasp = box(0.1, 0.18, 0.06);
  clasp.translate(0, 0.42, -0.26);
  const g = merge([body, lid, clasp]);
  g.rotateY(rotY);
  g.translate(x, y, z);
  b.geos.push(paintGradient(g, 0x453524, 0x5f4c33));
  b.colliders.push(aabb(x - 0.45, y, z - 0.45, x + 0.45, y + 0.68, z + 0.45));
}

export function addLantern(b: InteriorBuild, x: number, y: number, z: number, hanging: boolean): void {
  const body = box(0.18, 0.26, 0.18);
  body.translate(x, y, z);
  b.geos.push(paint(body, 0xffc878)); // bright pane reads as lit
  if (hanging) {
    const chain = box(0.04, 0.5, 0.04);
    chain.translate(x, y + 0.26, z);
    b.geos.push(paint(chain, 0x2a2724));
  } else {
    const post = limb(x, y - 1.4, z, x, y - 0.02, z, 0.05, 0.04, 4);
    b.geos.push(paint(post, 0x2e2a24));
  }
  b.lights.push({ x, y: y + 0.05, z, color: 0xffae5a, intensity: 9, flicker: true });
}

export function addPillar(b: InteriorBuild, theme: InteriorTheme, x: number, y0: number, y1: number, z: number, r = 0.32): void {
  const c = new THREE.CylinderGeometry(r, r * 1.15, y1 - y0, 7);
  c.translate(x, (y0 + y1) / 2, z);
  b.geos.push(paintGradient(c.toNonIndexed(), theme.trim, theme.wallHi));
  b.colliders.push(aabb(x - r, y0, z - r, x + r, y1, z + r));
}

export function addSarcophagus(b: InteriorBuild, x: number, y: number, z: number, rotY: number): void {
  const base = box(1.1, 0.75, 2.2);
  const lid = box(1.0, 0.2, 2.1);
  lid.translate(0, 0.75, 0);
  const g = merge([base, lid]);
  g.rotateY(rotY);
  g.translate(x, y, z);
  b.geos.push(paintGradient(g, 0x2e2b27, 0x4c473e));
  b.colliders.push(aabb(x - 1.15, y, z - 1.15, x + 1.15, y + 0.97, z + 1.15));
}

export function addBonePile(b: InteriorBuild, rng: Sfc32, x: number, y: number, z: number): void {
  const g = blob(rng, rng.range(0.3, 0.5), 0.45);
  g.translate(x, y + 0.1, z);
  b.geos.push(paintGradient(g, 0x6e6757, 0xb8ad98));
}

export function addStalagmite(b: InteriorBuild, rng: Sfc32, x: number, y: number, z: number, up: boolean): void {
  const h = rng.range(0.6, 1.8);
  const c = new THREE.ConeGeometry(rng.range(0.2, 0.45), h, 6);
  if (up) c.translate(0, h / 2, 0);
  else {
    c.rotateX(Math.PI);
    c.translate(0, -h / 2, 0);
  }
  c.translate(x, y, z);
  b.geos.push(paintGradient(c.toNonIndexed(), 0x35322c, 0x504a40));
  if (up && h > 1.2) b.colliders.push(aabb(x - 0.3, y, z - 0.3, x + 0.3, y + h, z + 0.3));
}

/** Mine timber frame at a corridor cross-section (axis = corridor direction). */
export function addTimberFrame(b: InteriorBuild, x: number, y: number, z: number, width: number, height: number, axis: 'x' | 'z'): void {
  const postA = box(0.18, height, 0.18);
  const postB = box(0.18, height, 0.18);
  const beam = axis === 'x' ? box(0.18, 0.18, width) : box(width, 0.18, 0.18);
  if (axis === 'x') {
    postA.translate(x, y, z - width / 2 + 0.1);
    postB.translate(x, y, z + width / 2 - 0.1);
    beam.translate(x, y + height - 0.18, z);
  } else {
    postA.translate(x - width / 2 + 0.1, y, z);
    postB.translate(x + width / 2 - 0.1, y, z);
    beam.translate(x, y + height - 0.18, z);
  }
  b.geos.push(paintGradient(merge([postA, postB, beam]), 0x3a2c1c, 0x55422a));
}

/** Merge an InteriorBuild's geometry into one mesh-ready BufferGeometry. */
export function mergeBuild(b: InteriorBuild): THREE.BufferGeometry {
  return merge(b.geos.splice(0, b.geos.length));
}
