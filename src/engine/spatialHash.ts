/**
 * Static collider store — a 2D uniform grid (8 m cells) of AABBs. One
 * instance for the exterior (per-site registration), one per interior cell.
 */

import type { Aabb } from './math';

const CELL = 8;

export class StaticColliders {
  private map = new Map<number, Aabb[]>();
  /** Site key → boxes, so sites can unregister wholesale. */
  private bySite = new Map<string, Aabb[]>();

  private key(cx: number, cz: number): number {
    return cx * 100000 + cz;
  }

  add(box: Aabb, site = ''): void {
    const c0x = Math.floor(box.minX / CELL);
    const c1x = Math.floor(box.maxX / CELL);
    const c0z = Math.floor(box.minZ / CELL);
    const c1z = Math.floor(box.maxZ / CELL);
    for (let cz = c0z; cz <= c1z; cz++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const k = this.key(cx, cz);
        let arr = this.map.get(k);
        if (!arr) {
          arr = [];
          this.map.set(k, arr);
        }
        arr.push(box);
      }
    }
    if (site) {
      let arr = this.bySite.get(site);
      if (!arr) {
        arr = [];
        this.bySite.set(site, arr);
      }
      arr.push(box);
    }
  }

  removeSite(site: string): void {
    const boxes = this.bySite.get(site);
    if (!boxes) return;
    const set = new Set(boxes);
    for (const [k, arr] of this.map) {
      const filtered = arr.filter((b) => !set.has(b));
      if (filtered.length === 0) this.map.delete(k);
      else if (filtered.length !== arr.length) this.map.set(k, filtered);
    }
    this.bySite.delete(site);
  }

  clear(): void {
    this.map.clear();
    this.bySite.clear();
  }

  /** Collect boxes near a vertical capsule/point into out (deduped). */
  query(x: number, z: number, radius: number, out: Aabb[]): Aabb[] {
    out.length = 0;
    const c0x = Math.floor((x - radius) / CELL);
    const c1x = Math.floor((x + radius) / CELL);
    const c0z = Math.floor((z - radius) / CELL);
    const c1z = Math.floor((z + radius) / CELL);
    for (let cz = c0z; cz <= c1z; cz++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const arr = this.map.get(this.key(cx, cz));
        if (!arr) continue;
        for (const b of arr) {
          if (out.indexOf(b) === -1) out.push(b);
        }
      }
    }
    return out;
  }
}
