/**
 * Entity model — lightweight typed game objects, not an ECS. Entities live
 * in cells (the exterior site set, or one interior). Interactables expose a
 * prompt + onInteract; the interact system raycasts against their bodies.
 */

import type * as THREE from 'three';
import type { SeedPathId } from '@/data/ids';

export type EntityKind = 'door' | 'container' | 'pickup' | 'npc' | 'prop' | 'marker';

export interface Entity {
  id: SeedPathId;
  kind: EntityKind;
  x: number;
  y: number;
  z: number;
  rotY: number;
  /** Interaction body: vertical cylinder. */
  radius: number;
  height: number;
  /** Crosshair prompt, e.g. "Weathered Chest" / "Maren Velt". */
  prompt: string | null;
  mesh: THREE.Object3D | null;
  onInteract: ((e: Entity) => void) | null;
  /** Free-form payload (door target, container loot seed, npc identity…). */
  data: Record<string, unknown>;
}

export function makeEntity(partial: Partial<Entity> & Pick<Entity, 'id' | 'kind'>): Entity {
  return {
    x: 0,
    y: 0,
    z: 0,
    rotY: 0,
    radius: 0.5,
    height: 1.6,
    prompt: null,
    mesh: null,
    onInteract: null,
    data: {},
    ...partial,
  };
}

/** Ray vs entity cylinder — coarse but ideal for chunky interact targets. */
export function rayHitsEntity(
  e: Entity,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
): number {
  // Sample along the ray; entities are fat targets, sampling is robust.
  const steps = Math.ceil(maxDist / 0.25);
  for (let i = 1; i <= steps; i++) {
    const t = (i * 0.25);
    if (t > maxDist) break;
    const px = ox + dx * t;
    const py = oy + dy * t;
    const pz = oz + dz * t;
    const ddx = px - e.x;
    const ddz = pz - e.z;
    if (ddx * ddx + ddz * ddz < e.radius * e.radius && py > e.y && py < e.y + e.height) {
      return t;
    }
  }
  return Infinity;
}
