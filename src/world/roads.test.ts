import { beforeAll, describe, expect, it } from 'vitest';
import { setWorldSeed } from '@/engine/rng';
import { DEFAULT_WORLD_SEED } from '@/data/world';
import { TOWNS } from '@/data/towns';
import { resetTerrainSeeds, worldHeight } from './terrain';
import { initRoads, roadDistance, roadSegments } from './roads';

beforeAll(() => {
  setWorldSeed(DEFAULT_WORLD_SEED);
  resetTerrainSeeds();
});

describe('roads', () => {
  it('builds within a sane boot budget', () => {
    const t0 = performance.now();
    initRoads();
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(3000);
  });

  it('every town has a road at its doorstep', () => {
    for (const t of TOWNS) {
      // Sample a ring just outside the town radius; at least one point near road.
      let best = Infinity;
      for (let a = 0; a < 32; a++) {
        const ang = (a / 32) * Math.PI * 2;
        const d = roadDistance(
          t.pos[0] + Math.cos(ang) * (t.radius + 30),
          t.pos[1] + Math.sin(ang) * (t.radius + 30),
        );
        best = Math.min(best, d);
      }
      expect(best).toBeLessThan(60);
    }
  });

  it('roadway grade stays gentle along the carriageway', () => {
    const segs = roadSegments();
    expect(segs.length).toBeGreaterThan(100);
    let worst = 0;
    for (const s of segs) {
      if (s.len < 0.5) continue;
      worst = Math.max(worst, Math.abs(s.bh - s.ah) / s.len);
    }
    expect(worst).toBeLessThan(0.22); // ≤ 22% grade after smoothing
  });

  it('carved terrain matches the roadway height on the centreline', () => {
    const segs = roadSegments();
    for (let i = 100; i < segs.length; i += 97) {
      const s = segs[i]!;
      const h = worldHeight((s.ax + s.bx) / 2, (s.az + s.bz) / 2);
      const roadH = (s.ah + s.bh) / 2;
      // Towns flatten over roads, so allow outliers near plateaus.
      const nearTown = TOWNS.some(
        (t) => Math.hypot((s.ax + s.bx) / 2 - t.pos[0], (s.az + s.bz) / 2 - t.pos[1]) < t.radius + 40,
      );
      if (!nearTown) expect(Math.abs(h - roadH)).toBeLessThan(2.5);
    }
  });
});
