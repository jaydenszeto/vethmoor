/**
 * Town generation: places parametric buildings around a plaza on the
 * flattened plateau, walls + gates for walled towns, a dock where the
 * registry says so, named NPCs, and registers an interior cell factory for
 * every enterable building. Deterministic from seedOf('town', index).
 * Axis-aligned constraint: buildings rotate in 90° steps only, keeping
 * every collider an AABB.
 */

import * as THREE from 'three';
import { Sfc32, seedOf } from '@/engine/rng';
import { aabb, type Aabb } from '@/engine/math';
import { cellId as asCellId, seedPathId, type CellId } from '@/data/ids';
import { TOWNS, type TownDef } from '@/data/towns';
import { SEA_LEVEL } from '@/data/world';
import { worldHeight } from '@/world/terrain';
import { roadDistance } from '@/world/roads';
import { registerCellFactory } from '@/world/cells';
import { buildShell, type BuildingKind } from './models/buildings';
import {
  THEME_STONE,
  THEME_TIMBER,
  addBarrel,
  addBed,
  addChair,
  addChestGeo,
  addCounter,
  addLantern,
  addPillar,
  addRoomShell,
  addRug,
  addShelf,
  addTable,
  addWall,
  newBuild,
  type InteriorBuild,
} from './models/interiors';
import { makeHumanoidGeo, type NpcRole } from './models/humanoid';
import { box, limb, merge, paint, paintGradient, vertexColorMaterial } from './models/primitives';
import { makeName, rollCulture, type Culture } from './names';
import { makeEntity, type Entity } from '@/entities/entity';

export interface NpcSpec {
  name: string;
  role: NpcRole;
  culture: Culture;
  x: number;
  y: number;
  z: number;
  rotY: number;
  id: string;
}

export interface TownBuild {
  group: THREE.Group;
  colliders: Aabb[];
  entities: Entity[];
  npcSpecs: NpcSpec[];
}

interface PlacedBuilding {
  kind: BuildingKind;
  // world-space footprint
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  cx: number;
  cz: number;
  rotK: number; // 0..3 — 90° steps
  cell: CellId;
  doorX: number;
  doorZ: number;
  name: string;
}

/** Rotate a local AABB by k·90° (CCW around Y) about the origin, then translate. */
function placeAabb(b: Aabb, k: number, tx: number, ty: number, tz: number): Aabb {
  let { minX, minZ, maxX, maxZ } = b;
  for (let i = 0; i < k; i++) {
    // (x, z) → (z, -x)
    const a = { minX, minZ, maxX, maxZ };
    minX = Math.min(a.minZ, a.maxZ);
    maxX = Math.max(a.minZ, a.maxZ);
    minZ = Math.min(-a.maxX, -a.minX);
    maxZ = Math.max(-a.maxX, -a.minX);
  }
  return aabb(minX + tx, b.minY + ty, minZ + tz, maxX + tx, b.maxY + ty, maxZ + tz);
}

function rotPoint(x: number, z: number, k: number): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (let i = 0; i < k; i++) {
    const nx = pz;
    const nz = -px;
    px = nx;
    pz = nz;
  }
  return { x: px, z: pz };
}

// ----- interior plans -------------------------------------------------------------

type PlanFn = (rng: Sfc32, w: number, d: number, town: TownDef, bName: string) => InteriorBuild;

function shellRooms(b: InteriorBuild, w: number, d: number, theme: typeof THEME_TIMBER, ceil = 2.9): { x0: number; z0: number; x1: number; z1: number } {
  const room = { x0: -w / 2, z0: -d / 2, x1: w / 2, z1: d / 2, floorY: 0, ceilY: ceil };
  addRoomShell(b, room, theme);
  return room;
}

/** Door opening is always centered on the -Z wall (entry from the street). */
function entryWalls(
  b: InteriorBuild,
  r: { x0: number; z0: number; x1: number; z1: number },
  theme: typeof THEME_TIMBER,
  ceil: number,
  innerWallAt?: number,
  innerDoorCenter?: number,
): void {
  addWall(b, 'x', r.x0, r.x1, r.z0, 0, ceil, theme, [{ center: (r.x0 + r.x1) / 2, width: 1.5 }]);
  addWall(b, 'x', r.x0, r.x1, r.z1, 0, ceil, theme);
  addWall(b, 'z', r.z0, r.z1, r.x0, 0, ceil, theme);
  addWall(b, 'z', r.z0, r.z1, r.x1, 0, ceil, theme);
  if (innerWallAt !== undefined && innerDoorCenter !== undefined) {
    addWall(b, 'x', r.x0, r.x1, innerWallAt, 0, ceil, theme, [
      { center: innerDoorCenter, width: 1.5 },
    ]);
  }
}

const innPlan: PlanFn = (rng, w, d) => {
  const b = newBuild();
  const W = Math.max(w, 9.5);
  const D = Math.max(d + 3, 12);
  const theme = THEME_TIMBER;
  const ceil = 3.1;
  const r = shellRooms(b, W, D, theme, ceil);
  const backZ = r.z1 - 3.6;
  entryWalls(b, r, theme, ceil, backZ, r.x0 + 2.2);
  // Bedroom divider in the back strip.
  addWall(b, 'z', backZ, r.z1, (r.x0 + r.x1) / 2, 0, ceil, theme, [
    { center: backZ + 1.0, width: 1.45 },
  ]);

  // Common room: counter along +X wall, tables, hearth rug.
  addCounter(b, r.x1 - 1.4, 0, r.z0 + D * 0.42, 3.4, Math.PI / 2);
  for (let i = 0; i < 3; i++) {
    const tx = r.x0 + 2 + (i % 2) * 3.4;
    const tz = r.z0 + 2.4 + i * 2.6;
    addTable(b, rng, tx, 0, tz);
    addChair(b, tx - 1, 0, tz, Math.PI / 2);
    addChair(b, tx + 1, 0, tz + 0.2, -Math.PI / 2);
  }
  addRug(b, rng, (r.x0 + r.x1) / 2, 0, r.z0 + 3, 2.6, 1.8);
  addShelf(b, r.x1 - 0.55, 0, r.z0 + 1.4, -Math.PI / 2);
  addLantern(b, (r.x0 + r.x1) / 2, ceil - 0.55, r.z0 + D * 0.35, true);
  addLantern(b, r.x1 - 1.5, ceil - 0.55, backZ - 1.5, true);

  // Bedrooms.
  for (const side of [0, 1]) {
    const bx0 = side === 0 ? r.x0 : (r.x0 + r.x1) / 2;
    const bx1 = side === 0 ? (r.x0 + r.x1) / 2 : r.x1;
    addBed(b, rng, bx0 + 1.1, 0, r.z1 - 1.3, 0);
    if (rng.chance(0.7)) {
      addChestGeo(b, bx1 - 0.8, 0, r.z1 - 0.7, 0);
      b.entities.push({ kind: 'container', x: bx1 - 0.8, y: 0, z: r.z1 - 0.7, rotY: 0, tag: 'chest:room' });
    }
  }

  b.entities.push({ kind: 'door', x: (r.x0 + r.x1) / 2, y: 0, z: r.z0 + 0.4, rotY: Math.PI, tag: 'exit' });
  b.entities.push({ kind: 'npc', x: r.x1 - 2.4, y: 0, z: r.z0 + D * 0.42, rotY: -Math.PI / 2, tag: 'npc:innkeep' });
  b.entities.push({ kind: 'marker', x: r.x0 + 2, y: 0, z: r.z1 - 1.4, rotY: 0, tag: 'restbed' });
  return b;
};

const traderPlan: PlanFn = (rng, w, d) => {
  const b = newBuild();
  const W = Math.max(w, 8);
  const D = Math.max(d + 2, 9);
  const theme = THEME_TIMBER;
  const ceil = 2.9;
  const r = shellRooms(b, W, D, theme, ceil);
  const backZ = r.z1 - 2.8;
  entryWalls(b, r, theme, ceil, backZ, r.x1 - 1.6);

  addCounter(b, (r.x0 + r.x1) / 2, 0, r.z0 + D * 0.5, Math.min(4, W - 3), 0);
  addShelf(b, r.x0 + 0.55, 0, r.z0 + 2, Math.PI / 2);
  addShelf(b, r.x0 + 0.55, 0, r.z0 + 3.8, Math.PI / 2);
  addBarrel(b, rng, r.x1 - 0.7, 0, r.z0 + 1.1);
  addBarrel(b, rng, r.x1 - 0.7, 0, r.z0 + 2.0);
  addTable(b, rng, r.x1 - 1.6, 0, r.z0 + 4.4);
  addLantern(b, (r.x0 + r.x1) / 2, ceil - 0.55, r.z0 + 3, true);

  // Stockroom.
  addChestGeo(b, r.x0 + 0.9, 0, r.z1 - 0.8, 0);
  b.entities.push({ kind: 'container', x: r.x0 + 0.9, y: 0, z: r.z1 - 0.8, rotY: 0, tag: 'chest:stock' });
  addBarrel(b, rng, r.x0 + 2.2, 0, r.z1 - 0.8);
  addShelf(b, r.x1 - 0.55, 0, r.z1 - 1.2, -Math.PI / 2);

  b.entities.push({ kind: 'door', x: (r.x0 + r.x1) / 2, y: 0, z: r.z0 + 0.4, rotY: Math.PI, tag: 'exit' });
  b.entities.push({ kind: 'npc', x: (r.x0 + r.x1) / 2, y: 0, z: r.z0 + D * 0.5 + 1.1, rotY: Math.PI, tag: 'npc:trader' });
  return b;
};

const housePlan: PlanFn = (rng, w, d) => {
  const b = newBuild();
  const W = Math.max(w, 6.5);
  const D = Math.max(d, 7);
  const theme = THEME_TIMBER;
  const ceil = 2.7;
  const r = shellRooms(b, W, D, theme, ceil);
  entryWalls(b, r, theme, ceil);
  addBed(b, rng, r.x1 - 1.2, 0, r.z1 - 1.4, 0);
  addTable(b, rng, r.x0 + 1.8, 0, r.z0 + 2.2);
  addChair(b, r.x0 + 1.8, 0, r.z0 + 3.3, Math.PI);
  if (rng.chance(0.8)) {
    addChestGeo(b, r.x0 + 0.8, 0, r.z1 - 0.8, 0);
    b.entities.push({ kind: 'container', x: r.x0 + 0.8, y: 0, z: r.z1 - 0.8, rotY: 0, tag: 'chest:home' });
  }
  if (rng.chance(0.6)) addBarrel(b, rng, r.x1 - 0.7, 0, r.z0 + 1.0);
  addRug(b, rng, (r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2, 2, 1.5);
  addLantern(b, (r.x0 + r.x1) / 2, ceil - 0.5, (r.z0 + r.z1) / 2, true);
  b.entities.push({ kind: 'door', x: (r.x0 + r.x1) / 2, y: 0, z: r.z0 + 0.4, rotY: Math.PI, tag: 'exit' });
  return b;
};

const templePlan: PlanFn = (rng, w, d, town) => {
  const b = newBuild();
  const W = Math.max(w, 9);
  const D = Math.max(d + 4, 13);
  const theme = THEME_STONE;
  const ceil = 4.4;
  const r = shellRooms(b, W, D, theme, ceil);
  entryWalls(b, r, theme, ceil);
  for (const sx of [-1, 1]) {
    addPillar(b, theme, sx * (W / 2 - 1.5), 0, ceil, r.z0 + D * 0.3);
    addPillar(b, theme, sx * (W / 2 - 1.5), 0, ceil, r.z0 + D * 0.62);
  }
  addRug(b, rng, (r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2 - 0.5, 1.8, D - 4);
  // Altar: stone counter + votive ember.
  addCounter(b, (r.x0 + r.x1) / 2, 0, r.z1 - 1.6, 3, 0);
  const ember = new THREE.OctahedronGeometry(0.22, 0);
  ember.translate((r.x0 + r.x1) / 2, 1.35, r.z1 - 1.6);
  b.geos.push(paint(ember.toNonIndexed(), 0xff8a3c));
  b.lights.push({ x: (r.x0 + r.x1) / 2, y: 1.8, z: r.z1 - 1.8, color: 0xff8a3c, intensity: 13, flicker: true });
  addLantern(b, r.x0 + 1.2, ceil - 0.6, r.z0 + 2, true);
  b.entities.push({ kind: 'door', x: (r.x0 + r.x1) / 2, y: 0, z: r.z0 + 0.4, rotY: Math.PI, tag: 'exit' });
  b.entities.push({ kind: 'npc', x: (r.x0 + r.x1) / 2 + 1.3, y: 0, z: r.z1 - 2.6, rotY: Math.PI, tag: 'npc:priest' });
  b.entities.push({ kind: 'marker', x: (r.x0 + r.x1) / 2, y: 0, z: (r.z0 + r.z1) / 2, rotY: 0, tag: `respawn:${town.id}` });
  return b;
};

const lodgePlan: PlanFn = (rng, w, d) => {
  const b = newBuild();
  const W = Math.max(w, 6);
  const D = Math.max(d, 6);
  const theme = THEME_TIMBER;
  const ceil = 3.4;
  const r = shellRooms(b, W, D, theme, ceil);
  entryWalls(b, r, theme, ceil);
  addRug(b, rng, 0, 0, 0, W - 2, D - 2);
  addRug(b, rng, r.x1 - 1.3, 0, r.z1 - 1.6, 1.1, 2); // bedroll
  addTable(b, rng, r.x0 + 1.5, 0, r.z0 + 1.8);
  if (rng.chance(0.7)) {
    addChestGeo(b, r.x0 + 0.8, 0, r.z1 - 0.8, 0);
    b.entities.push({ kind: 'container', x: r.x0 + 0.8, y: 0, z: r.z1 - 0.8, rotY: 0, tag: 'chest:home' });
  }
  addLantern(b, 0, ceil - 0.6, 0, true);
  b.entities.push({ kind: 'door', x: (r.x0 + r.x1) / 2, y: 0, z: r.z0 + 0.4, rotY: Math.PI, tag: 'exit' });
  return b;
};

const PLANS: Record<BuildingKind, PlanFn> = {
  inn: innPlan,
  trader: traderPlan,
  temple: templePlan,
  house: housePlan,
  lodge: lodgePlan,
  hall: innPlan, // chapterhouse interiors get bespoke treatment in P7
};

// ----- town assembly ----------------------------------------------------------------

export function buildTown(townIndex: number): TownBuild {
  const town = TOWNS[townIndex] as TownDef;
  const rng = new Sfc32(seedOf('town', townIndex));
  const [tx, tz] = town.pos;
  const baseY = town.plateauHeight;
  const plazaR = Math.max(10, town.radius * 0.2);

  const geos: THREE.BufferGeometry[] = [];
  const colliders: Aabb[] = [];
  const entities: Entity[] = [];
  const npcSpecs: NpcSpec[] = [];
  const placed: PlacedBuilding[] = [];

  // Building roster.
  const kinds: BuildingKind[] = ['inn', 'trader', 'temple'];
  const houseCount = town.size === 'village' ? rng.int(4, 6) : town.size === 'town' ? rng.int(7, 9) : rng.int(10, 12);
  if (town.size !== 'village') kinds.push('hall');
  for (let i = 0; i < houseCount; i++) kinds.push(town.style === 'nomad' ? 'lodge' : 'house');

  // Place each on rings facing the plaza.
  for (let bi = 0; bi < kinds.length; bi++) {
    const kind = kinds[bi] as BuildingKind;
    const w = kind === 'inn' ? rng.range(9, 11) : kind === 'temple' ? rng.range(8.5, 10) : kind === 'hall' ? rng.range(9, 11) : kind === 'trader' ? rng.range(7, 8.5) : rng.range(5.5, 7.5);
    const d = w * rng.range(0.75, 1.0);
    let ok = false;
    for (let attempt = 0; attempt < 60 && !ok; attempt++) {
      const ringR = rng.range(plazaR + Math.max(w, d) / 2 + 2, town.radius - Math.max(w, d) / 2 - 6);
      const ang = rng.range(0, Math.PI * 2);
      const cx = tx + Math.cos(ang) * ringR;
      const cz = tz + Math.sin(ang) * ringR;
      // Face the plaza, snapped to 90°.
      const theta = Math.atan2(-(tx - cx), -(tz - cz));
      const k = ((Math.round(theta / (Math.PI / 2)) % 4) + 4) % 4;
      const hw = (k % 2 === 0 ? w : d) / 2 + 2.2;
      const hd = (k % 2 === 0 ? d : w) / 2 + 2.2;
      const rect = { minX: cx - hw, minZ: cz - hd, maxX: cx + hw, maxZ: cz + hd };
      // Overlap checks.
      let bad = false;
      for (const p of placed) {
        if (rect.minX < p.maxX && rect.maxX > p.minX && rect.minZ < p.maxZ && rect.maxZ > p.minZ) {
          bad = true;
          break;
        }
      }
      if (bad) continue;
      // Keep building corners off roads.
      if (
        roadDistance(rect.minX, rect.minZ) < 4 ||
        roadDistance(rect.maxX, rect.minZ) < 4 ||
        roadDistance(rect.minX, rect.maxZ) < 4 ||
        roadDistance(rect.maxX, rect.maxZ) < 4
      ) {
        continue;
      }

      // Build shell.
      const shell = buildShell(rng, kind, town.style, w, d);
      const rotY = (k * Math.PI) / 2;
      shell.geo.rotateY(rotY);
      shell.geo.translate(cx - tx, baseY, cz - tz); // group-local (group sits at town origin)
      geos.push(shell.geo);
      for (const c of shell.colliders) {
        colliders.push(placeAabb(c, k, cx, baseY, cz));
      }
      const doorWorld = rotPoint(shell.door.x, shell.door.z, k);
      const dx = cx + doorWorld.x;
      const dz = cz + doorWorld.z;

      const cell = asCellId(`int:${town.id}:${bi}`);
      const bName =
        kind === 'inn'
          ? rng.pick(['The Brined Eel', 'The Ash & Anchor', 'The Drowned Lantern', 'The Grey Gull', 'The Ember Hearth'] as const)
          : kind === 'trader'
            ? `${makeName(rng, rollCulture(rng)).split(' ')[0]}'s Goods`
            : kind === 'temple'
              ? 'Temple of the Tides Below'
              : kind === 'hall'
                ? `${town.name} Hall`
                : `${town.name} home`;

      placed.push({
        kind,
        ...rect,
        cx,
        cz,
        rotK: k,
        cell,
        doorX: dx,
        doorZ: dz,
        name: bName,
      });

      // Register interior factory.
      const planFn = PLANS[kind];
      const planSeed = seedOf('interior', townIndex, bi);
      registerCellFactory(cell, () => {
        const prng = new Sfc32(planSeed);
        return { build: planFn(prng, w, d, town, bName), theme: 'town', label: bName };
      });

      // Exterior door entity.
      const doorEnt = makeEntity({
        id: seedPathId(`town:${town.id}:door${bi}`),
        kind: 'door',
        x: dx,
        y: baseY,
        z: dz,
        rotY,
        radius: 0.85,
        height: 2.3,
        prompt: bName,
        data: { cell, returnX: dx + Math.sin(rotY) * 1.6 * -1, returnZ: dz + Math.cos(rotY) * -1 * 1.6 * -1 },
      });
      // Return point: 1.6 m outside the door along its facing.
      const face = rotPoint(0, -1, k);
      doorEnt.data.returnX = dx + face.x * 1.6;
      doorEnt.data.returnZ = dz + face.z * 1.6;
      doorEnt.data.returnYaw = Math.atan2(-face.x, -face.z);
      entities.push(doorEnt);
      ok = true;
    }
  }

  // Plaza well.
  {
    const ring = new THREE.CylinderGeometry(1.2, 1.35, 0.8, 9, 1, true);
    ring.translate(0, 0.4, 0);
    const ringG = paintGradient(ring.toNonIndexed(), 0x39362f, 0x57534a);
    const postA = limb(-0.9, 0.8, 0, -0.9, 2.3, 0, 0.07, 0.06, 4);
    const postB = limb(0.9, 0.8, 0, 0.9, 2.3, 0, 0.07, 0.06, 4);
    const roof = box(2.4, 0.12, 1.4);
    roof.translate(0, 2.35, 0);
    const wellG = merge([ringG, paint(postA, 0x3a2c1c), paint(postB, 0x3a2c1c), paintGradient(roof, 0x3d3833, 0x4d473e)]);
    wellG.translate(0, baseY, 0);
    geos.push(wellG);
    colliders.push(aabb(tx - 1.35, baseY, tz - 1.35, tx + 1.35, baseY + 1.0, tz + 1.35));
  }

  // Walls + gates (square, axis-aligned).
  if (town.walled) {
    const s = town.radius - 3;
    const wallH = 5;
    const wallT = 1.4;
    // Find the two best gate sides by sampling road proximity at side centers.
    const sides = [
      { id: 'n', x: tx, z: tz - s },
      { id: 's', x: tx, z: tz + s },
      { id: 'w', x: tx - s, z: tz },
      { id: 'e', x: tx + s, z: tz },
    ].map((side) => ({ ...side, rd: roadDistance(side.x, side.z) }));
    sides.sort((a, b) => a.rd - b.rd);
    const gates = new Set([sides[0]!.id, sides[1]!.id]);

    const addWallBox = (minX: number, minZ: number, maxX: number, maxZ: number): void => {
      const g = box(maxX - minX, wallH, maxZ - minZ);
      g.translate((minX + maxX) / 2 - tx, baseY, (minZ + maxZ) / 2 - tz);
      geos.push(paintGradient(g, 0x33312c, 0x52504a));
      colliders.push(aabb(minX, baseY, minZ, maxX, baseY + wallH, maxZ));
    };
    const GATE_W = 7;
    for (const side of ['n', 's', 'w', 'e']) {
      const gap = gates.has(side) ? GATE_W : 0;
      if (side === 'n' || side === 's') {
        const z = side === 'n' ? tz - s : tz + s;
        if (gap) {
          addWallBox(tx - s, z - wallT / 2, tx - gap / 2, z + wallT / 2);
          addWallBox(tx + gap / 2, z - wallT / 2, tx + s, z + wallT / 2);
          // Gate pillars.
          addWallBox(tx - gap / 2 - 1.2, z - wallT, tx - gap / 2, z + wallT);
          addWallBox(tx + gap / 2, z - wallT, tx + gap / 2 + 1.2, z + wallT);
        } else {
          addWallBox(tx - s, z - wallT / 2, tx + s, z + wallT / 2);
        }
      } else {
        const x = side === 'w' ? tx - s : tx + s;
        if (gap) {
          addWallBox(x - wallT / 2, tz - s, x + wallT / 2, tz - gap / 2);
          addWallBox(x - wallT / 2, tz + gap / 2, x + wallT / 2, tz + s);
          addWallBox(x - wallT, tz - gap / 2 - 1.2, x + wallT, tz - gap / 2);
          addWallBox(x - wallT, tz + gap / 2, x + wallT, tz + gap / 2 + 1.2);
        } else {
          addWallBox(x - wallT / 2, tz - s, x + wallT / 2, tz + s);
        }
      }
    }
  }

  // Dock westward into the sea.
  if (town.dock) {
    let sx = tx - town.radius * 0.7;
    for (let i = 0; i < 60; i++) {
      if (worldHeight(sx, tz) < SEA_LEVEL - 0.6) break;
      sx -= 4;
    }
    const dockY = SEA_LEVEL + 1.0;
    const startX = sx + 18;
    const endX = sx - 10;
    // Group-local coords: group origin sits at (tx, 0, tz).
    const plank = box(startX - endX, 0.22, 2.6);
    plank.translate((startX + endX) / 2 - tx, dockY, 0);
    geos.push(paintGradient(plank, 0x4a3b2a, 0x6b5940));
    colliders.push(aabb(endX, dockY - 0.25, tz - 1.3, startX, dockY, tz + 1.3));
    for (let px = endX + 2; px < startX; px += 5) {
      const postA = limb(px - tx, worldHeight(px, tz - 1.1), -1.1, px - tx, dockY, -1.1, 0.12, 0.1, 4);
      const postB = limb(px - tx, worldHeight(px, tz + 1.1), 1.1, px - tx, dockY, 1.1, 0.12, 0.1, 4);
      geos.push(paint(postA, 0x3a2e20), paint(postB, 0x3a2e20));
    }
  }

  // Strider station: raised platform at the town edge facing the volcano-ish.
  if (town.striderStation) {
    const ang = Math.atan2(tz - 6144, tx - 6144) + Math.PI; // toward volcano side
    const px = tx + Math.cos(ang) * (town.radius - 8);
    const pz = tz + Math.sin(ang) * (town.radius - 8);
    const plat = box(5, 1.6, 5);
    plat.translate(px - tx, baseY, pz - tz);
    geos.push(paintGradient(plat, 0x3c2f20, 0x5d4a33));
    colliders.push(aabb(px - 2.5, baseY, pz - 2.5, px + 2.5, baseY + 1.6, pz + 2.5));
    const pole = limb(px - tx + 2, baseY + 1.6, pz - tz, px - tx + 2, baseY + 5.4, pz - tz, 0.1, 0.07, 4);
    geos.push(paint(pole, 0x3a2c1c));
    const banner = box(0.06, 1.4, 0.9);
    banner.translate(px - tx + 2, baseY + 3.6, pz - tz + 0.45);
    geos.push(paint(banner, 0x6e3a2a));
    entities.push(
      makeEntity({
        id: seedPathId(`town:${town.id}:strider`),
        kind: 'marker',
        x: px,
        y: baseY + 1.6,
        z: pz,
        radius: 2.2,
        height: 2.5,
        prompt: 'Dune-strider caravan',
        data: { travel: town.id },
      }),
    );
  }

  // NPCs: keepers at their doors + plaza folk + gate guards.
  const npcRng = new Sfc32(seedOf('town-npcs', townIndex));
  let npcIdx = 0;
  const pushNpc = (role: NpcRole, x: number, z: number, rotY: number): void => {
    const culture = rollCulture(npcRng);
    npcSpecs.push({
      name: makeName(npcRng, culture),
      role,
      culture,
      x,
      y: baseY,
      z,
      rotY,
      id: `town:${town.id}:npc${npcIdx++}`,
    });
  };
  for (const p of placed) {
    if (p.kind === 'inn') pushNpc('innkeep', p.doorX + 1.2, p.doorZ + 1.2, npcRng.range(0, 6.28));
    if (p.kind === 'trader') pushNpc('trader', p.doorX - 1.1, p.doorZ + 1.0, npcRng.range(0, 6.28));
    if (p.kind === 'temple') pushNpc('priest', p.doorX + 0.8, p.doorZ - 1.4, npcRng.range(0, 6.28));
  }
  const plazaFolk = town.size === 'city' ? 5 : town.size === 'town' ? 4 : 3;
  for (let i = 0; i < plazaFolk; i++) {
    const a = npcRng.range(0, Math.PI * 2);
    const r = npcRng.range(3, plazaR - 1);
    pushNpc(town.style === 'nomad' ? 'nomad' : 'villager', tx + Math.cos(a) * r, tz + Math.sin(a) * r, npcRng.range(0, 6.28));
  }
  if (town.walled) {
    pushNpc('guard', tx + 4, tz - (town.radius - 6), Math.PI);
    pushNpc('guard', tx - 4, tz + (town.radius - 6), 0);
  }

  // Build NPC meshes + entities.
  const group = new THREE.Group();
  group.name = `town:${town.id}`;
  const merged = merge(geos);
  const mesh = new THREE.Mesh(merged, vertexColorMaterial());
  mesh.position.set(tx, 0, tz);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  group.add(mesh);

  for (const spec of npcSpecs) {
    const g = makeHumanoidGeo(new Sfc32(seedOf('npc-body', townIndex, npcSpecs.indexOf(spec))), spec.role, spec.culture);
    const m = new THREE.Mesh(g, vertexColorMaterial());
    m.position.set(spec.x, spec.y, spec.z);
    m.rotation.y = spec.rotY;
    group.add(m);
    entities.push(
      makeEntity({
        id: seedPathId(spec.id),
        kind: 'npc',
        x: spec.x,
        y: spec.y,
        z: spec.z,
        rotY: spec.rotY,
        radius: 0.55,
        height: 1.78,
        prompt: spec.name,
        mesh: m,
        data: { role: spec.role, culture: spec.culture, town: town.id },
      }),
    );
  }

  return { group, colliders, entities, npcSpecs };
}
