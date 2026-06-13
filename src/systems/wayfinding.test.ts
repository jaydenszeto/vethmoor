/**
 * Soft wayfinding: bearing-convention math + the quest-target data tripwire
 * (every stage `targets` id must resolve to a real town or dungeon).
 */

import { describe, expect, it } from 'vitest';
import { bearingTo, nearestBearing } from './wayfinding';
import { QUESTS } from '@/data/quests';
import { TOWNS } from '@/data/towns';
import { DUNGEONS } from '@/data/dungeons';

const TAU = Math.PI * 2;
// Wrap to (-π, π] so e.g. -π and +π compare equal.
const norm = (a: number): number => {
  let x = a % TAU;
  if (x > Math.PI) x -= TAU;
  if (x <= -Math.PI) x += TAU;
  return x;
};

describe('wayfinding bearings', () => {
  it('matches the compass cardinal convention (forward = -sin/-cos yaw)', () => {
    // From the origin: N is -z, S is +z, E is +x, W is -x.
    expect(norm(bearingTo(0, 0, 0, -100))).toBeCloseTo(0); // North
    expect(Math.abs(norm(bearingTo(0, 0, 0, 100)))).toBeCloseTo(Math.PI); // South
    expect(norm(bearingTo(0, 0, 100, 0))).toBeCloseTo(-Math.PI / 2); // East (≡ 3π/2)
    expect(norm(bearingTo(0, 0, -100, 0))).toBeCloseTo(Math.PI / 2); // West
  });

  it('aims at the nearest of several targets', () => {
    const far: [number, number] = [1000, 0];
    const near: [number, number] = [0, -50];
    // Nearest is `near` (50 away) → bearing North; arriveR default 45 doesn't trip.
    expect(norm(nearestBearing(0, 0, [far, near]) ?? NaN)).toBeCloseTo(0);
  });

  it('goes quiet on arrival and with no targets', () => {
    expect(nearestBearing(0, 0, [])).toBeNull();
    expect(nearestBearing(0, 0, [[10, 10]])).toBeNull(); // within arriveR (45)
    expect(nearestBearing(0, 0, [[100, 0]])).not.toBeNull(); // outside arriveR
  });
});

describe('quest objective targets', () => {
  it('every stage target resolves to a real town or dungeon', () => {
    const townIds = new Set(TOWNS.map((t) => t.id as string));
    const dungeonIds = new Set(DUNGEONS.map((d) => d.id as string));
    for (const q of QUESTS) {
      for (const s of q.stages) {
        for (const id of s.targets ?? []) {
          expect(townIds.has(id) || dungeonIds.has(id), `${q.id}@${s.at} → "${id}"`).toBe(true);
        }
        // A target without an objective line would point silently — disallow.
        if (s.targets?.length) expect(s.objective, `${q.id}@${s.at}`).toBeTruthy();
      }
    }
  });
});
