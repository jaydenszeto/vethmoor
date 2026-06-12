import { beforeAll, describe, expect, it } from 'vitest';
import { setWorldSeed, Sfc32 } from '@/engine/rng';
import { DEFAULT_WORLD_SEED, GRID_STEP, WORLD_SIZE } from '@/data/world';
import { TOWNS } from '@/data/towns';
import {
  biomeAt,
  biomeWeightsAt,
  resetTerrainSeeds,
  worldHeight,
} from './terrain';
import { GRID_SIDE, buildHeightGrid, gridHeight } from './terrainMesh';

beforeAll(() => {
  setWorldSeed(DEFAULT_WORLD_SEED);
  resetTerrainSeeds();
});

describe('worldHeight', () => {
  it('is deterministic (snapshot pins the field — save-compat contract)', () => {
    const samples = [
      worldHeight(1825, 9745),
      worldHeight(6144, 6144),
      worldHeight(3000, 3000),
      worldHeight(9000, 9000),
      worldHeight(500, 6000),
    ].map((h) => Math.round(h * 1000) / 1000);
    expect(samples).toMatchInlineSnapshot(`
      [
        5,
        565.105,
        6.774,
        4.275,
        -33.565,
      ]
    `);
  });

  it('is continuous: no cliffs steeper than physical plausibility at 0.5 m', () => {
    const rng = new Sfc32(99);
    for (let i = 0; i < 1500; i++) {
      const x = rng.range(300, WORLD_SIZE - 300);
      const z = rng.range(300, WORLD_SIZE - 300);
      const h0 = worldHeight(x, z);
      const h1 = worldHeight(x + 0.5, z);
      const h2 = worldHeight(x, z + 0.5);
      expect(Math.abs(h1 - h0)).toBeLessThan(6);
      expect(Math.abs(h2 - h0)).toBeLessThan(6);
    }
  });

  it('west edge is ocean floor, volcano peak towers, edges ring up', () => {
    expect(worldHeight(200, 6000)).toBeLessThan(-20);
    expect(worldHeight(6144, 6144)).toBeGreaterThan(350);
    expect(worldHeight(6000, 250)).toBeGreaterThan(120); // north ring
  });

  it('town plateaus are flat at plateauHeight', () => {
    for (const t of TOWNS) {
      for (const [dx, dz] of [
        [0, 0],
        [t.radius * 0.5, 0],
        [0, -t.radius * 0.5],
        [-t.radius * 0.4, t.radius * 0.4],
      ] as const) {
        const h = worldHeight(t.pos[0] + dx, t.pos[1] + dz);
        expect(Math.abs(h - t.plateauHeight)).toBeLessThan(0.01);
      }
    }
  });
});

describe('biomes', () => {
  it('weights are a partition of unity', () => {
    const w: number[] = [0, 0, 0, 0, 0, 0];
    const rng = new Sfc32(7);
    for (let i = 0; i < 2000; i++) {
      biomeWeightsAt(rng.range(0, WORLD_SIZE), rng.range(0, WORLD_SIZE), w);
      let sum = 0;
      for (const v of w) {
        expect(v).toBeGreaterThanOrEqual(-1e-9);
        sum += v;
      }
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  it('volcano flank is badlands, coast is coastal marsh', () => {
    expect(biomeAt(6144, 6144 - 900)).toBe('badlands');
    expect(biomeAt(900, 9500)).toBe('coastalMarsh');
  });
});

describe('height grids (collision/mesh share)', () => {
  it('adjacent chunk grids agree exactly on their shared edge', () => {
    const a = buildHeightGrid(14, 75);
    const b = buildHeightGrid(15, 75);
    for (let j = 0; j < GRID_SIDE; j++) {
      // a's local x=128 column == b's local x=0 column.
      const ai = j * GRID_SIDE + (1 + 128 / GRID_STEP);
      const bi = j * GRID_SIDE + 1;
      expect(a[ai]).toBe(b[bi]);
    }
  });

  it('bilinear gridHeight matches worldHeight at grid nodes', () => {
    const g = buildHeightGrid(20, 20);
    expect(gridHeight(g, 64, 64)).toBeCloseTo(worldHeight(20 * 128 + 64, 20 * 128 + 64), 4);
    expect(gridHeight(g, 0, 0)).toBeCloseTo(worldHeight(20 * 128, 20 * 128), 4);
    expect(gridHeight(g, 128, 128)).toBeCloseTo(worldHeight(21 * 128, 21 * 128), 4);
  });
});
