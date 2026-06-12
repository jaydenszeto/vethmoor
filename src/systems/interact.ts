/**
 * Crosshair interaction: ray from the eye along the look direction, nearest
 * interactable entity within reach (LOS-checked against static colliders),
 * prompt to HUD, E to activate.
 */

import { events } from '@/engine/events';
import { input } from '@/engine/input';
import type { Aabb } from '@/engine/math';
import { raycastBoxes, type RayHit } from '@/engine/raycast';
import { rayHitsEntity, type Entity } from '@/entities/entity';
import type { Player } from '@/entities/player';
import type { WorldManager } from '@/world/WorldManager';
import { EYE_HEIGHT } from '@/data/world';

const REACH = 3.0;
const losBoxes: Aabb[] = [];
const losHit: RayHit = { t: Infinity, box: null };

let lastPrompt: string | null = null;

export function updateInteract(player: Player, world: WorldManager): void {
  const ox = player.body.x;
  const oy = player.body.y + EYE_HEIGHT;
  const oz = player.body.z;
  const cp = Math.cos(player.pitch);
  const dx = -Math.sin(player.yaw) * cp;
  const dy = Math.sin(player.pitch);
  const dz = -Math.cos(player.yaw) * cp;

  let best: Entity | null = null;
  let bestT = Infinity;
  for (const e of world.activeEntities()) {
    if (!e.onInteract) continue;
    const t = rayHitsEntity(e, ox, oy, oz, dx, dy, dz, REACH);
    if (t < bestT) {
      bestT = t;
      best = e;
    }
  }

  // LOS: a wall between eye and target cancels it (doors sit in wall openings,
  // so shrink the test segment slightly).
  if (best) {
    world.query.aabbsNear(ox + (dx * bestT) / 2, oz + (dz * bestT) / 2, REACH, losBoxes);
    const tEnd = Math.max(0, bestT - 0.45);
    if (raycastBoxes(ox, oy, oz, ox + dx * tEnd, oy + dy * tEnd, oz + dz * tEnd, losBoxes, losHit)) {
      best = null;
    }
  }

  const prompt = best ? (best.prompt ?? null) : null;
  if (prompt !== lastPrompt) {
    lastPrompt = prompt;
    events.emit('hud:prompt', { text: prompt });
  }

  if (best && input.wasPressed('interact')) {
    best.onInteract?.(best);
  }
}
