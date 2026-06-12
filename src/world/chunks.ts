/**
 * Chunk lifecycle: LOD ring assignment with hysteresis, build queueing, and
 * the live height-grid cache shared with collision.
 */

import * as THREE from 'three';
import {
  CHUNK_SIZE,
  LOAD_RADIUS,
  LOD_BY_RING,
  UNLOAD_RADIUS,
  WORLD_CHUNKS,
} from '@/data/world';
import { worldHeight } from './terrain';
import {
  buildChunkGeometry,
  buildHeightGrid,
  gridHeight,
  terrainMaterial,
} from './terrainMesh';
import { buildChunkFlora, disposeFlora, type ChunkFlora } from './flora';
import type { Streamer } from './streaming';

const LOD_DEBOUNCE_S = 0.5;
const BIG_FLORA_RING = 3;
const SMALL_FLORA_RING = 2;

/** Variant encodes LOD + flora tiers so ring crossings trigger rebuilds. */
function variantOf(ring: number): number {
  const lod = LOD_BY_RING[Math.min(ring, LOD_BY_RING.length - 1)] as number;
  return lod * 4 + (ring <= BIG_FLORA_RING ? 2 : 0) + (ring <= SMALL_FLORA_RING ? 1 : 0);
}

interface ChunkRec {
  cx: number;
  cz: number;
  key: string;
  variant: number; // -1 = no mesh yet
  wantVariant: number;
  wantSince: number;
  mesh: THREE.Mesh | null;
  grid: Float32Array | null;
  flora: ChunkFlora | null;
}

const keyOf = (cx: number, cz: number): string => `${cx},${cz}`;

export class ChunkManager {
  readonly group = new THREE.Group();
  private recs = new Map<string, ChunkRec>();

  constructor(private readonly streamer: Streamer) {
    this.group.name = 'terrain';
  }

  get loadedCount(): number {
    return this.recs.size;
  }

  /** Per-frame: mark desired set around the anchor, queue work, unload far. */
  update(ax: number, az: number, nowS: number): void {
    const acx = Math.floor(ax / CHUNK_SIZE);
    const acz = Math.floor(az / CHUNK_SIZE);

    for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
      const cz = acz + dz;
      if (cz < 0 || cz >= WORLD_CHUNKS) continue;
      for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
        const cx = acx + dx;
        if (cx < 0 || cx >= WORLD_CHUNKS) continue;
        const ring = Math.max(Math.abs(dx), Math.abs(dz));
        const variant = variantOf(ring);
        const key = keyOf(cx, cz);
        let rec = this.recs.get(key);
        if (!rec) {
          rec = {
            cx,
            cz,
            key,
            variant: -1,
            wantVariant: variant,
            wantSince: nowS,
            mesh: null,
            grid: null,
            flora: null,
          };
          this.recs.set(key, rec);
          this.enqueueBuild(rec, ring);
        } else if (rec.variant !== variant) {
          if (rec.wantVariant !== variant) {
            rec.wantVariant = variant;
            rec.wantSince = nowS;
          } else if (rec.mesh === null || nowS - rec.wantSince >= LOD_DEBOUNCE_S) {
            this.enqueueBuild(rec, ring);
          }
        } else {
          rec.wantVariant = variant;
          this.streamer.cancel(key);
        }
      }
    }

    // Unload far chunks (hysteresis band).
    for (const rec of this.recs.values()) {
      const cheb = Math.max(Math.abs(rec.cx - acx), Math.abs(rec.cz - acz));
      if (cheb > UNLOAD_RADIUS) {
        this.dispose(rec);
      }
    }
  }

  private enqueueBuild(rec: ChunkRec, ring: number): void {
    const variant = variantOf(ring);
    const lod = Math.floor(variant / 4);
    const withBig = (variant & 2) !== 0;
    const withSmall = (variant & 1) !== 0;
    this.streamer.enqueue({
      key: rec.key,
      prio: ring,
      run: () => {
        if (!this.recs.has(rec.key)) return; // unloaded while queued
        rec.grid ??= buildHeightGrid(rec.cx, rec.cz);
        const geo = buildChunkGeometry(rec.cx, rec.cz, lod, rec.grid);
        if (rec.mesh) {
          rec.mesh.geometry.dispose();
          rec.mesh.geometry = geo;
        } else {
          const mesh = new THREE.Mesh(geo, terrainMaterial());
          mesh.position.set(rec.cx * CHUNK_SIZE, 0, rec.cz * CHUNK_SIZE);
          mesh.matrixAutoUpdate = false;
          mesh.updateMatrix();
          mesh.name = `chunk:${rec.key}`;
          rec.mesh = mesh;
          this.group.add(mesh);
        }
        // Flora tiers.
        if (rec.flora) {
          this.removeFlora(rec);
        }
        if (withBig || withSmall) {
          rec.flora = buildChunkFlora(rec.cx, rec.cz, rec.grid, withBig, withSmall);
          if (rec.flora.big) this.group.add(rec.flora.big);
          for (const im of rec.flora.small) this.group.add(im);
        }
        rec.variant = variant;
      },
    });
  }

  private removeFlora(rec: ChunkRec): void {
    if (!rec.flora) return;
    if (rec.flora.big) this.group.remove(rec.flora.big);
    for (const im of rec.flora.small) this.group.remove(im);
    disposeFlora(rec.flora);
    rec.flora = null;
  }

  private dispose(rec: ChunkRec): void {
    this.streamer.cancel(rec.key);
    if (rec.mesh) {
      this.group.remove(rec.mesh);
      rec.mesh.geometry.dispose();
    }
    this.removeFlora(rec);
    this.recs.delete(rec.key);
  }

  /** Collision height: cached grid when available, else the pure function. */
  heightAt(x: number, z: number): number {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const rec = this.recs.get(keyOf(cx, cz));
    if (rec?.grid) {
      return gridHeight(rec.grid, x - cx * CHUNK_SIZE, z - cz * CHUNK_SIZE);
    }
    return worldHeight(x, z);
  }

  /** Ground normal from the same height source as heightAt (2 m differences). */
  normalAt(x: number, z: number, out: { x: number; y: number; z: number }): void {
    const e = 2;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    const nx = -hx / (2 * e);
    const nz = -hz / (2 * e);
    const len = Math.sqrt(nx * nx + 1 + nz * nz);
    out.x = nx / len;
    out.y = 1 / len;
    out.z = nz / len;
  }
}
