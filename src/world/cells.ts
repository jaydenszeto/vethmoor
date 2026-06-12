/**
 * Interior cell construction. Factories (registered by towngen/dungeongen)
 * return an InteriorBuild + metadata; this module turns one into live scene
 * content: merged mesh, point lights, colliders, floor lookup, entities.
 */

import * as THREE from 'three';
import type { CellId } from '@/data/ids';
import { seedPathId } from '@/data/ids';
import { StaticColliders } from '@/engine/spatialHash';
import { makeEntity, type Entity } from '@/entities/entity';
import {
  floorAtRooms,
  mergeBuild,
  type EntitySpec,
  type InteriorBuild,
  type LightSpec,
  type Room,
} from '@/gen/models/interiors';
import { vertexColorMaterial } from '@/gen/models/primitives';

export interface CellFactoryResult {
  build: InteriorBuild;
  theme: 'town' | 'crypt' | 'mine' | 'cave' | 'ruin';
  label: string;
}

export interface BuiltCell {
  id: CellId;
  label: string;
  theme: CellFactoryResult['theme'];
  group: THREE.Group;
  colliders: StaticColliders;
  rooms: Room[];
  entities: Entity[];
  entitySpecs: EntitySpec[];
  lights: LightSpec[];
  /** Player placement on entry. */
  entry: { x: number; y: number; z: number; yaw: number };
  /** Ambient base for the cell (interior "fog"/clear color). */
  ambient: number;
}

const factories = new Map<CellId, () => CellFactoryResult>();

export function registerCellFactory(id: CellId, fn: () => CellFactoryResult): void {
  factories.set(id, fn);
}

export function hasCellFactory(id: CellId): boolean {
  return factories.has(id);
}

const CELL_AMBIENT: Record<CellFactoryResult['theme'], number> = {
  town: 0x141210,
  crypt: 0x0b0a0c,
  mine: 0x0e0c09,
  cave: 0x0a0b0c,
  ruin: 0x100e0c,
};

export function buildCell(id: CellId): BuiltCell {
  const factory = factories.get(id);
  if (!factory) throw new Error(`no cell factory for ${id}`);
  const { build, theme, label } = factory();

  const group = new THREE.Group();
  group.name = `cell:${id}`;
  const mesh = new THREE.Mesh(mergeBuild(build), vertexColorMaterial());
  group.add(mesh);

  // Point lights (interiors only — exteriors use sun/hemi).
  for (const l of build.lights) {
    const pl = new THREE.PointLight(l.color, l.intensity, 14, 1.8);
    pl.position.set(l.x, l.y, l.z);
    group.add(pl);
  }

  const colliders = new StaticColliders();
  for (const c of build.colliders) colliders.add(c);

  // Entry: the exit door spec (player appears just inside it).
  let entry = { x: 0, y: 0.05, z: 0, yaw: Math.PI };
  for (const e of build.entities) {
    if (e.kind === 'door' && e.tag === 'exit') {
      // Step 1.2 m inward along the door's facing (rotY points into the room;
      // forward for yaw θ is (−sinθ, −cosθ)).
      entry = {
        x: e.x - Math.sin(e.rotY) * 1.2,
        y: 0.05,
        z: e.z - Math.cos(e.rotY) * 1.2,
        yaw: e.rotY,
      };
      break;
    }
  }

  // Entities are materialized by the WorldManager (it wires behaviors).
  return {
    id,
    label,
    theme,
    group,
    colliders,
    rooms: build.rooms,
    entities: [],
    entitySpecs: build.entities,
    lights: build.lights,
    entry,
    ambient: CELL_AMBIENT[theme],
  };
}

export function cellFloorAt(cell: BuiltCell, x: number, z: number): number {
  return floorAtRooms(cell.rooms, x, z);
}

/** Helper for specs → entity shells (behavior wiring happens in WorldManager). */
export function specToEntity(cellIdStr: string, spec: EntitySpec, index: number): Entity {
  return makeEntity({
    id: seedPathId(`${cellIdStr}:e${index}:${spec.tag}`),
    kind: spec.kind === 'marker' ? 'marker' : spec.kind,
    x: spec.x,
    y: spec.y,
    z: spec.z,
    rotY: spec.rotY,
    radius: spec.kind === 'door' ? 0.9 : 0.55,
    height: spec.kind === 'door' ? 2.3 : 1.2,
    data: { tag: spec.tag },
  });
}
