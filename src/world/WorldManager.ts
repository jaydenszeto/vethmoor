/**
 * WorldManager — the architectural spine. Owns:
 *  - exterior sites (towns, dungeon entrances) loaded by proximity,
 *  - the active cell (exterior | one interior) + Morrowind load-door swaps,
 *  - the CollisionQuery facade every mover uses,
 *  - the active interactable set + entity behavior wiring.
 */

import * as THREE from 'three';
import { events } from '@/engine/events';
import { aabb, type Aabb } from '@/engine/math';
import type { CollisionQuery } from '@/engine/collision';
import { StaticColliders } from '@/engine/spatialHash';
import { Sfc32, seedOf } from '@/engine/rng';
import { cellId as asCellId, seedPathId, type CellId } from '@/data/ids';
import { DUNGEONS } from '@/data/dungeons';
import { TOWNS } from '@/data/towns';
import { makeEntity, type Entity } from '@/entities/entity';
import { box, limb, merge, paint, paintGradient, vertexColorMaterial } from '@/gen/models/primitives';
import { blob } from '@/gen/models/primitives';
import { buildTown } from '@/gen/towngen';
import { registerDungeons } from '@/gen/dungeongen';
import { buildCell, cellFloorAt, hasCellFactory, specToEntity, type BuiltCell } from './cells';
import type { ChunkManager } from './chunks';
import { worldHeight } from './terrain';

const SITE_LOAD_DIST = 700;
const SITE_UNLOAD_DIST = 900;

interface Site {
  key: string;
  x: number;
  z: number;
  kind: 'town' | 'dungeon';
  index: number;
  group: THREE.Group | null;
  entities: Entity[];
}

export interface DoorTarget {
  cell: CellId;
  returnX: number;
  returnZ: number;
  returnYaw: number;
}

export class WorldManager {
  /** Parent for sites; chunks group stays separate. */
  readonly sitesGroup = new THREE.Group();
  readonly interiorGroup = new THREE.Group();

  private readonly exteriorColliders = new StaticColliders();
  private readonly sites: Site[] = [];
  private activeCellData: BuiltCell | null = null;
  private exteriorReturn = { x: 0, y: 0, z: 0, yaw: 0 };
  private transitioning = false;

  /** Set by Game so door interactions can move the player. */
  onPlayerPlace: ((x: number, y: number, z: number, yaw: number) => void) | null = null;
  onCellChanged: ((interior: BuiltCell | null) => void) | null = null;
  /** Game opens the loot UI; falls back to a toast if unset. */
  onContainerOpen: ((e: Entity) => void) | null = null;

  /** Last exterior door position (for saves while inside). */
  get returnPoint(): { x: number; z: number; yaw: number } {
    return { x: this.exteriorReturn.x, z: this.exteriorReturn.z, yaw: this.exteriorReturn.yaw };
  }

  constructor(private readonly chunks: ChunkManager) {
    this.sitesGroup.name = 'sites';
    this.interiorGroup.name = 'interior';
    this.interiorGroup.visible = false;
    registerDungeons();
    TOWNS.forEach((t, i) =>
      this.sites.push({ key: `town:${t.id}`, x: t.pos[0], z: t.pos[1], kind: 'town', index: i, group: null, entities: [] }),
    );
    DUNGEONS.forEach((d, i) =>
      this.sites.push({ key: `dgn:${d.id}`, x: d.pos[0], z: d.pos[1], kind: 'dungeon', index: i, group: null, entities: [] }),
    );
  }

  get interior(): BuiltCell | null {
    return this.activeCellData;
  }

  get isInterior(): boolean {
    return this.activeCellData !== null;
  }

  /** All interactables in the player's current cell. */
  activeEntities(): readonly Entity[] {
    if (this.activeCellData) return this.activeCellData.entities;
    const out: Entity[] = [];
    for (const s of this.sites) {
      if (s.group) out.push(...s.entities);
    }
    return out;
  }

  // ----- site streaming -------------------------------------------------------

  update(px: number, pz: number): void {
    if (this.isInterior) return;
    for (const s of this.sites) {
      const d = Math.hypot(px - s.x, pz - s.z);
      if (!s.group && d < SITE_LOAD_DIST) this.loadSite(s);
      else if (s.group && d > SITE_UNLOAD_DIST) this.unloadSite(s);
    }
  }

  private loadSite(s: Site): void {
    if (s.kind === 'town') {
      const built = buildTown(s.index);
      s.group = built.group;
      s.entities = built.entities;
      for (const c of built.colliders) this.exteriorColliders.add(c, s.key);
      this.wireEntities(s.entities);
    } else {
      const built = buildDungeonEntrance(s.index);
      s.group = built.group;
      s.entities = built.entities;
      for (const c of built.colliders) this.exteriorColliders.add(c, s.key);
      this.wireEntities(s.entities);
    }
    this.sitesGroup.add(s.group as THREE.Group);
  }

  private unloadSite(s: Site): void {
    if (!s.group) return;
    this.sitesGroup.remove(s.group);
    s.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    s.group = null;
    s.entities = [];
    this.exteriorColliders.removeSite(s.key);
  }

  // ----- entity behaviors -------------------------------------------------------

  private wireEntities(ents: Entity[]): void {
    for (const e of ents) {
      if (e.kind === 'door' && e.data.cell) {
        e.onInteract = () => {
          const t: DoorTarget = {
            cell: e.data.cell as CellId,
            returnX: (e.data.returnX as number) ?? e.x,
            returnZ: (e.data.returnZ as number) ?? e.z,
            returnYaw: (e.data.returnYaw as number) ?? e.rotY,
          };
          void this.enterInterior(t);
        };
      } else if (e.kind === 'container') {
        e.prompt ??= 'Weathered chest';
        e.onInteract = () => {
          if (this.onContainerOpen) this.onContainerOpen(e);
          else events.emit('toast', { text: 'It will not open.', kind: 'info' });
        };
      } else if (e.kind === 'npc') {
        e.onInteract = () => {
          const rng = new Sfc32(seedOf('npc-greet', e.id.length, (e.x | 0) + (e.z | 0)));
          const line = rng.pick(GREETINGS);
          events.emit('toast', { text: `${e.prompt}: “${line}”`, kind: 'info' });
        };
      } else if (e.kind === 'marker' && e.data.travel) {
        e.onInteract = () => {
          events.emit('toast', { text: 'The dune-strider snorts. Caravans run in P6.', kind: 'info' });
        };
      }
    }
  }

  // ----- interior swap -----------------------------------------------------------

  async enterInterior(target: DoorTarget): Promise<void> {
    if (this.transitioning || !hasCellFactory(target.cell)) return;
    this.transitioning = true;
    this.exteriorReturn = {
      x: target.returnX,
      y: 0,
      z: target.returnZ,
      yaw: target.returnYaw,
    };
    events.emit('screen:fade', { on: true });
    await wait(210);

    const cell = buildCell(target.cell);
    this.materializeCellEntities(cell);
    this.interiorGroup.add(cell.group);
    this.activeCellData = cell;
    this.interiorGroup.visible = true;
    this.sitesGroup.visible = false;
    this.chunks.group.visible = false;
    this.onPlayerPlace?.(cell.entry.x, cellFloorAt(cell, cell.entry.x, cell.entry.z) + 0.05, cell.entry.z, cell.entry.yaw);
    this.onCellChanged?.(cell);

    await wait(80);
    events.emit('screen:fade', { on: false });
    this.transitioning = false;
  }

  async exitInterior(): Promise<void> {
    const cell = this.activeCellData;
    if (this.transitioning || !cell) return;
    this.transitioning = true;
    events.emit('screen:fade', { on: true });
    await wait(210);

    this.interiorGroup.remove(cell.group);
    cell.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.activeCellData = null;
    this.interiorGroup.visible = false;
    this.sitesGroup.visible = true;
    this.chunks.group.visible = true;
    const ry = this.exteriorReturn;
    const gy = this.chunks.heightAt(ry.x, ry.z);
    this.onPlayerPlace?.(ry.x, gy + 0.05, ry.z, ry.yaw);
    this.onCellChanged?.(null);

    await wait(80);
    events.emit('screen:fade', { on: false });
    this.transitioning = false;
  }

  private materializeCellEntities(cell: BuiltCell): void {
    cell.entities = cell.entitySpecs.map((spec, i) => {
      const e = specToEntity(cell.id as string, spec, i);
      const tag = spec.tag;
      if (spec.kind === 'door' && tag === 'exit') {
        e.prompt = 'Leave';
        e.onInteract = () => void this.exitInterior();
      } else if (spec.kind === 'container') {
        e.prompt = tag.startsWith('chest:boss') ? 'Heavy chest' : 'Chest';
        e.onInteract = () => {
          if (this.onContainerOpen) this.onContainerOpen(e);
          else events.emit('toast', { text: 'It will not open.', kind: 'info' });
        };
      } else if (spec.kind === 'npc') {
        e.prompt = tag === 'npc:innkeep' ? 'Innkeeper' : tag === 'npc:trader' ? 'Trader' : tag === 'npc:priest' ? 'Priest' : 'Stranger';
        e.onInteract = () => {
          events.emit('toast', { text: `${e.prompt}: “Welcome, traveler.”`, kind: 'info' });
        };
      }
      return e;
    });
  }

  // ----- collision facade ---------------------------------------------------------

  readonly query: CollisionQuery = {
    heightAt: (x, z) => {
      if (this.activeCellData) return cellFloorAt(this.activeCellData, x, z);
      return this.chunks.heightAt(x, z);
    },
    normalAt: (x, z, out) => {
      if (this.activeCellData) {
        out.x = 0;
        out.y = 1;
        out.z = 0;
        return;
      }
      this.chunks.normalAt(x, z, out);
    },
    aabbsNear: (x, z, radius, out) => {
      const set = this.activeCellData ? this.activeCellData.colliders : this.exteriorColliders;
      return set.query(x, z, radius, out as Aabb[]);
    },
    isExterior: () => !this.activeCellData,
  };
}

const GREETINGS = [
  'Storms are getting worse, writ-bearer.',
  'Mind the ash on the east road.',
  'We all dream of the drowned throne now.',
  'Keep your blade dry and your boots drier.',
  'The Vigil pays coin for bandit ears, I hear.',
] as const;

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ----- dungeon entrance structures ------------------------------------------------

function buildDungeonEntrance(index: number): {
  group: THREE.Group;
  colliders: Aabb[];
  entities: Entity[];
} {
  const def = DUNGEONS[index]!;
  const [dx, dz] = def.pos;
  const baseY = worldHeight(dx, dz);
  const rng = new Sfc32(seedOf('dgn-entrance', index));
  const geos: THREE.BufferGeometry[] = [];
  const colliders: Aabb[] = [];

  if (def.theme === 'crypt' || def.theme === 'ruin') {
    // Stone doorframe set into a mound.
    const mound = blob(rng, 4.2, 0.62);
    mound.translate(0, 0.4, 2.6);
    geos.push(paintGradient(mound, 0x2c2e29, 0x4a4c44));
    const pillarL = box(0.7, 3.2, 0.7);
    pillarL.translate(-1.2, 0, 0);
    const pillarR = box(0.7, 3.2, 0.7);
    pillarR.translate(1.2, 0, 0);
    const lintel = box(3.4, 0.6, 0.8);
    lintel.translate(0, 3.2, 0);
    geos.push(paintGradient(merge([pillarL, pillarR, lintel]), 0x33312c, 0x57534a));
    const dark = box(1.7, 2.9, 0.4);
    dark.translate(0, 0.1, 0.3);
    geos.push(paint(dark, 0x0a0908));
    colliders.push(aabb(dx - 1.55 - 0.35, baseY, dz - 0.35, dx - 1.55 + 1.9, baseY + 3.4, dz + 0.35));
    colliders.push(aabb(dx + 1.55 - 1.9, baseY, dz - 0.35, dx + 1.55 + 0.35, baseY + 3.4, dz + 0.35));
  } else {
    // Cave/mine mouth: rock arch (+ timber frame for mines).
    const rockL = blob(rng, 2.2, 1.1);
    rockL.translate(-2, 0.4, 0.4);
    const rockR = blob(rng, 2.4, 1.05);
    rockR.translate(2.1, 0.4, 0.2);
    const rockTop = blob(rng, 2.1, 0.7);
    rockTop.translate(0, 2.9, 0.5);
    geos.push(paintGradient(merge([rockL, rockR, rockTop]), 0x2b2925, 0x4c4840));
    const dark = box(1.9, 2.5, 0.5);
    dark.translate(0, 0, 0.4);
    geos.push(paint(dark, 0x0a0908));
    if (def.theme === 'mine') {
      const postA = limb(-1.1, 0, -0.2, -1.1, 2.5, -0.2, 0.14, 0.12, 4);
      const postB = limb(1.1, 0, -0.2, 1.1, 2.5, -0.2, 0.14, 0.12, 4);
      const beam = box(2.6, 0.2, 0.2);
      beam.translate(0, 2.5, -0.2);
      geos.push(paint(merge([postA, postB, beam]), 0x4a3826));
    }
    colliders.push(aabb(dx - 3.4, baseY, dz - 0.8, dx - 1.0, baseY + 3.2, dz + 1.4));
    colliders.push(aabb(dx + 1.0, baseY, dz - 0.8, dx + 3.6, baseY + 3.2, dz + 1.4));
  }

  const merged = merge(geos);
  const mesh = new THREE.Mesh(merged, vertexColorMaterial());
  mesh.position.set(dx, baseY, dz);
  const group = new THREE.Group();
  group.name = `dgn-entrance:${def.id}`;
  group.add(mesh);

  const door = makeEntity({
    id: seedPathId(`dgn:${def.id}:entrance`),
    kind: 'door',
    x: dx,
    y: baseY,
    z: dz,
    rotY: 0,
    radius: 1.0,
    height: 2.6,
    prompt: def.name,
    data: {
      cell: asCellId(`dgn:${def.id}`),
      returnX: dx,
      returnZ: dz - 2.6,
      returnYaw: Math.PI,
    },
  });

  return { group, colliders, entities: [door] };
}
