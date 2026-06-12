/** Pooled blob shadows — soft dark discs under actors. The 1996 solution. */

import * as THREE from 'three';
import type { EnemyActor } from '@/entities/actor';
import type { CollisionQuery } from '@/engine/collision';

const POOL = 16;

function shadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class BlobShadows {
  readonly group = new THREE.Group();
  private pool: THREE.Mesh[] = [];

  constructor() {
    this.group.name = 'blob-shadows';
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: shadowTexture(),
      transparent: true,
      depthWrite: false,
    });
    for (let i = 0; i < POOL; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.renderOrder = 1;
      this.pool.push(m);
      this.group.add(m);
    }
  }

  sync(actors: readonly EnemyActor[], q: CollisionQuery): void {
    let i = 0;
    for (const a of actors) {
      if (i >= POOL) break;
      if (!a.alive) continue;
      const m = this.pool[i++] as THREE.Mesh;
      const gy = q.heightAt(a.body.x, a.body.z);
      const heightAbove = a.body.y - gy;
      m.visible = heightAbove < 6;
      m.position.set(a.body.x, gy + 0.04, a.body.z);
      const s = a.rig.radius * 2.4;
      m.scale.setScalar(s);
      (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0.15, 1 - heightAbove * 0.18);
    }
    for (; i < POOL; i++) (this.pool[i] as THREE.Mesh).visible = false;
  }
}
