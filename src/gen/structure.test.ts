/**
 * Determinism tripwire: structure hashes for towns and dungeons. If one of
 * these snapshots changes, generation output changed — which breaks every
 * existing save and every authored placement. Bump intentionally only.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { setWorldSeed, xmur3 } from '@/engine/rng';
import { DEFAULT_WORLD_SEED } from '@/data/world';
import { resetTerrainSeeds } from '@/world/terrain';
import { initRoads } from '@/world/roads';
import { buildCell } from '@/world/cells';
import { cellId } from '@/data/ids';
import { buildTown } from './towngen';
import { registerDungeons } from './dungeongen';

function hashStr(s: string): number {
  return xmur3(s)();
}

beforeAll(() => {
  setWorldSeed(DEFAULT_WORLD_SEED);
  resetTerrainSeeds();
  initRoads();
  registerDungeons();
});

describe('generation structure hashes', () => {
  it('towns are stable', () => {
    const hashes = [0, 1, 2, 3, 4, 5].map((i) => {
      const t = buildTown(i);
      const summary = JSON.stringify({
        colliders: t.colliders.length,
        entities: t.entities.map((e) => `${e.kind}:${e.id}`).sort(),
        npcs: t.npcSpecs.map((n) => `${n.role}:${n.name}`).sort(),
      });
      // Free the geometry we just built.
      t.group.traverse((o) => {
        const mesh = o as { geometry?: { dispose(): void } };
        mesh.geometry?.dispose();
      });
      return hashStr(summary);
    });
    expect(hashes).toMatchInlineSnapshot(`
      [
        3781705134,
        512424689,
        378742282,
        2316771817,
        3006046125,
        290982633,
      ]
    `);
  });

  it('dungeon cells are stable and navigable', () => {
    const ids = ['smugglers-cave', 'weeping-barrow', 'fenwick-crypt', 'duskvein-shaft', 'hollow-of-teeth'];
    const hashes = ids.map((id) => {
      const cell = buildCell(cellId(`dgn:${id}`));
      expect(cell.rooms.length).toBeGreaterThan(2);
      // Every dungeon must have an exit door spec.
      expect(cell.entitySpecs.some((e) => e.tag === 'exit')).toBe(true);
      const summary = JSON.stringify({
        rooms: cell.rooms.map((r) => [r.x0, r.z0, r.x1, r.z1].map((v) => Math.round(v * 10)).join(',')),
        specs: cell.entitySpecs.map((e) => `${e.kind}:${e.tag}`).sort(),
      });
      cell.group.traverse((o) => {
        const mesh = o as { geometry?: { dispose(): void } };
        mesh.geometry?.dispose();
      });
      return hashStr(summary);
    });
    expect(hashes).toMatchInlineSnapshot(`
      [
        814406947,
        3884583180,
        3859986570,
        2817618942,
        286270434,
      ]
    `);
  });
});
