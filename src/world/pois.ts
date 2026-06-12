/**
 * Wilderness points of interest — shrines, camps, ruined towers, stone
 * circles, boulder fields. One candidate per 512 m cell, deterministically
 * accepted/rejected and typed by biome. P3 attaches interactables/loot.
 */

import { Sfc32, seedOf } from '@/engine/rng';
import { CHUNK_SIZE, SEA_LEVEL, WORLD_SIZE } from '@/data/world';
import { TOWNS } from '@/data/towns';
import { biomeAt, volcanism, worldHeight } from './terrain';
import { roadDistance } from './roads';
import type { PoiType } from '@/gen/models/props';
import type { BiomeId } from '@/data/ids';

export interface PoiInstance {
  type: PoiType;
  x: number;
  y: number;
  z: number;
  rotY: number;
  seed: number;
  cellKey: string;
}

const POI_CELL = 512;

const TYPE_BY_BIOME: Record<BiomeId, readonly PoiType[]> = {
  coastalMarsh: ['camp', 'stones', 'shrine'],
  steppe: ['watchtower', 'camp', 'stones', 'boulders'],
  fungalForest: ['shrine', 'stones', 'camp'],
  bittermarsh: ['shrine', 'stones'],
  ashlands: ['shrine', 'watchtower', 'boulders', 'camp'],
  badlands: ['boulders', 'shrine'],
};

const cache = new Map<string, PoiInstance | null>();

/** The POI (if any) owned by a 512 m cell. */
function poiForCell(gx: number, gz: number): PoiInstance | null {
  const key = `${gx},${gz}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const rng = new Sfc32(seedOf('poi', gx, gz));
  let result: PoiInstance | null = null;

  if (rng.chance(0.3)) {
    const x = gx * POI_CELL + rng.range(60, POI_CELL - 60);
    const z = gz * POI_CELL + rng.range(60, POI_CELL - 60);
    if (x > 150 && z > 150 && x < WORLD_SIZE - 150 && z < WORLD_SIZE - 150) {
      const h = worldHeight(x, z);
      const okWater = h > SEA_LEVEL + 0.8;
      const slope =
        Math.abs(worldHeight(x + 3, z) - h) + Math.abs(worldHeight(x, z + 3) - h);
      const nearTown = TOWNS.some((t) => {
        const dx = x - t.pos[0];
        const dz = z - t.pos[1];
        return dx * dx + dz * dz < (t.radius + 220) ** 2;
      });
      const v = volcanism(x, z);
      if (okWater && slope < 1.6 && !nearTown && roadDistance(x, z) > 28 && v < 0.62) {
        const types = TYPE_BY_BIOME[biomeAt(x, z)];
        result = {
          type: rng.pick(types),
          x,
          y: h,
          z,
          rotY: rng.range(0, Math.PI * 2),
          seed: seedOf('poi-build', gx, gz),
          cellKey: key,
        };
      }
    }
  }

  cache.set(key, result);
  return result;
}

/** POIs whose anchor lands inside the given chunk. */
export function poisInChunk(cx: number, cz: number): PoiInstance[] {
  const minX = cx * CHUNK_SIZE;
  const minZ = cz * CHUNK_SIZE;
  const out: PoiInstance[] = [];
  // A chunk (128 m) can overlap at most 2×2 POI cells.
  const g0x = Math.floor(minX / POI_CELL);
  const g0z = Math.floor(minZ / POI_CELL);
  for (let gz = g0z; gz <= Math.floor((minZ + CHUNK_SIZE - 1) / POI_CELL); gz++) {
    for (let gx = g0x; gx <= Math.floor((minX + CHUNK_SIZE - 1) / POI_CELL); gx++) {
      const poi = poiForCell(gx, gz);
      if (
        poi &&
        poi.x >= minX &&
        poi.x < minX + CHUNK_SIZE &&
        poi.z >= minZ &&
        poi.z < minZ + CHUNK_SIZE
      ) {
        out.push(poi);
      }
    }
  }
  return out;
}

/** All POIs in a radius (map markers, quest target pools). */
export function poisNear(x: number, z: number, radius: number): PoiInstance[] {
  const out: PoiInstance[] = [];
  const g0x = Math.floor((x - radius) / POI_CELL);
  const g1x = Math.floor((x + radius) / POI_CELL);
  const g0z = Math.floor((z - radius) / POI_CELL);
  const g1z = Math.floor((z + radius) / POI_CELL);
  for (let gz = g0z; gz <= g1z; gz++) {
    for (let gx = g0x; gx <= g1x; gx++) {
      const poi = poiForCell(gx, gz);
      if (poi && Math.hypot(poi.x - x, poi.z - z) <= radius) out.push(poi);
    }
  }
  return out;
}
