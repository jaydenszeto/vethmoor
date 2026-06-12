/**
 * Spawn management. Wilderness: deterministic per-chunk rolls in 3-day
 * respawn buckets, biome-tabled, capped. Dungeons: spawn markers from the
 * cell layout; the dead stay dead (killed set persists into saves).
 */

import * as THREE from 'three';
import { Sfc32, seedOf } from '@/engine/rng';
import { seedPathId, type EnemyId } from '@/data/ids';
import type { BiomeId } from '@/data/ids';
import { CHUNK_SIZE } from '@/data/world';
import { TOWNS } from '@/data/towns';
import { EnemyActor } from '@/entities/actor';
import { makeEntity, type Entity } from '@/entities/entity';
import type { CollisionQuery } from '@/engine/collision';
import { biomeAt } from '@/world/terrain';
import { roadDistance } from '@/world/roads';
import type { BuiltCell } from '@/world/cells';
import { setContainerContents } from './loot';
import type { ItemStack } from '@/data/items';
import { itemId } from '@/data/ids';

const MAX_WILD = 12;
const RESPAWN_DAYS = 3;

const WILD_TABLE: Record<BiomeId, readonly string[]> = {
  coastalMarsh: ['marsh-crab', 'giant-rat'],
  steppe: ['giant-rat', 'rift-shrike', 'bandit'],
  fungalForest: ['fungal-shambler', 'giant-rat'],
  bittermarsh: ['marsh-crab', 'fungal-shambler'],
  ashlands: ['ash-risen', 'rift-shrike', 'ember-wisp'],
  badlands: ['ember-wisp', 'ash-risen'],
};

const DUNGEON_TABLE: Record<string, readonly string[]> = {
  crypt: ['skeleton-warden', 'giant-rat'],
  mine: ['bandit', 'giant-rat'],
  cave: ['giant-rat', 'marsh-crab', 'bandit'],
  ruin: ['skeleton-warden', 'bandit', 'ember-wisp'],
};

const BOSS_TABLE: Record<string, string> = {
  crypt: 'skeleton-warden',
  mine: 'bandit',
  cave: 'fungal-shambler',
  ruin: 'ash-risen',
};

export class SpawnManager {
  readonly group = new THREE.Group();
  actors: EnemyActor[] = [];
  /** Corpse interactables for the current cell context. */
  corpses: Entity[] = [];
  private killed = new Set<string>();
  private scanT = 0;

  constructor() {
    this.group.name = 'actors';
  }

  serialize(): string[] {
    return [...this.killed];
  }

  restore(killed: string[]): void {
    this.killed = new Set(killed);
    this.clearAll();
  }

  clearAll(): void {
    for (const a of this.actors) {
      this.group.remove(a.rig.group);
      a.dispose();
    }
    this.actors = [];
    this.corpses = [];
  }

  /** Exterior periodic spawn scan around the player. */
  updateExterior(dt: number, px: number, pz: number, q: CollisionQuery, day: number): void {
    this.scanT += dt;
    if (this.scanT < 1.5) return;
    this.scanT = 0;
    const alive = this.actors.filter((a) => a.alive && !a.friendly).length;
    if (alive >= MAX_WILD) return;
    const bucket = Math.floor(day / RESPAWN_DAYS);
    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);

    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const id = `wspawn:${cx},${cz}:${bucket}`;
        if (this.killed.has(id)) continue;
        if (this.actors.some((a) => a.spawnId.startsWith(`wspawn:${cx},${cz}:`))) continue;
        const rng = new Sfc32(seedOf('wspawn', cx, cz, bucket));
        if (!rng.chance(0.16)) {
          this.killed.add(id); // empty roll this bucket — mark so we stop re-rolling
          continue;
        }
        const x = cx * CHUNK_SIZE + rng.range(12, CHUNK_SIZE - 12);
        const z = cz * CHUNK_SIZE + rng.range(12, CHUNK_SIZE - 12);
        const dPlayer = Math.hypot(x - px, z - pz);
        if (dPlayer < 30 || dPlayer > 220) continue; // try again later (don't mark)
        if (q.heightAt(x, z) < 0.6) continue;
        if (roadDistance(x, z) < 9) continue;
        if (TOWNS.some((t) => Math.hypot(x - t.pos[0], z - t.pos[1]) < t.radius + 90)) continue;
        const table = WILD_TABLE[biomeAt(x, z)];
        const kind = rng.pick(table);
        const n = rng.chance(0.3) ? 2 : 1;
        for (let i = 0; i < n; i++) {
          this.spawn(kind as EnemyId, x + i * 1.8, z + i * 1.4, q, `${id}:${i}`);
        }
        return; // at most one group per scan
      }
    }
  }

  /** Dungeon/interior population from spawn markers. */
  populateCell(cell: BuiltCell, q: CollisionQuery): void {
    cell.entitySpecs.forEach((spec, i) => {
      if (spec.kind !== 'marker' || !spec.tag.startsWith('spawn:')) return;
      const id = `${cell.id}:spawn${i}`;
      if (this.killed.has(id)) return;
      const parts = spec.tag.split(':'); // spawn:theme:tier[:boss]
      const theme = parts[1] ?? 'cave';
      const isBoss = parts[3] === 'boss';
      const rng = new Sfc32(seedOf('dspawn', i, cell.id.length));
      const kind = isBoss
        ? (BOSS_TABLE[theme] ?? 'skeleton-warden')
        : rng.pick(DUNGEON_TABLE[theme] ?? DUNGEON_TABLE.cave as readonly string[]);
      this.spawn(kind as EnemyId, spec.x, spec.z, q, id);
    });
  }

  spawn(kind: EnemyId, x: number, z: number, q: CollisionQuery, spawnId: string, friendly = false): EnemyActor {
    const a = new EnemyActor(kind, x, z, q, spawnId, friendly);
    this.actors.push(a);
    this.group.add(a.rig.group);
    return a;
  }

  /** Kill bookkeeping: corpse container + persistence. */
  onDeath(a: EnemyActor, addCorpse: (e: Entity) => void): void {
    this.killed.add(a.spawnId.split(':').slice(0, -1).join(':') || a.spawnId);
    this.killed.add(a.spawnId);
    if (a.friendly) return;
    // Corpse container with rolled drops.
    const corpseId = seedPathId(`corpse:${a.spawnId}`);
    const rng = new Sfc32(seedOf('drops', a.spawnId.length, a.def.hp));
    const items: ItemStack[] = [];
    for (const d of a.def.drops) {
      if (rng.chance(d.chance)) items.push({ id: d.id, n: rng.int(d.n[0], d.n[1]) });
    }
    if (rng.chance(0.35)) items.push({ id: itemId('gold'), n: rng.int(1, 6) * a.def.tier });
    setContainerContents(corpseId as string, items);
    const ent = makeEntity({
      id: corpseId,
      kind: 'container',
      x: a.body.x,
      y: a.body.y,
      z: a.body.z,
      radius: 0.9,
      height: 0.8,
      prompt: `${a.def.name} (dead)`,
      data: { tag: 'corpse' },
    });
    // The caller (Game) wires onInteract to the shared container-open flow.
    this.corpses.push(ent);
    addCorpse(ent);
  }

  /** Despawn far wilderness actors + clean dead rigs after their corpse drops. */
  cull(px: number, pz: number, isExterior: boolean): void {
    for (let i = this.actors.length - 1; i >= 0; i--) {
      const a = this.actors[i] as EnemyActor;
      const far = isExterior && Math.hypot(a.body.x - px, a.body.z - pz) > 260;
      const doneDead = !a.alive && a.rig.body.rotation.z >= Math.PI / 2 - 0.01;
      if (far || doneDead) {
        this.group.remove(a.rig.group);
        a.dispose();
        this.actors.splice(i, 1);
      }
    }
  }

  nearestEnemy(x: number, z: number, range: number): EnemyActor | null {
    let best: EnemyActor | null = null;
    let bestD = range;
    for (const a of this.actors) {
      if (!a.alive || a.friendly) continue;
      const d = Math.hypot(a.body.x - x, a.body.z - z);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }
}
