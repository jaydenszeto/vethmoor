/**
 * Dungeon generation: themed room-graph layouts built from the interior kit.
 * Procedural dungeons grow by frontier expansion (room → corridor → room);
 * authored layouts (smugglers' cave, Weeping Barrow, Undertooth shell) are
 * fixed room lists through the same kit. Spawn markers + containers are laid
 * here; P5/P7 bring them to life.
 */

import { Sfc32, seedOf } from '@/engine/rng';
import { cellId as asCellId } from '@/data/ids';
import { DUNGEONS, type DungeonDef, type DungeonTheme } from '@/data/dungeons';
import {
  addBarrel,
  addBonePile,
  addChestGeo,
  addLantern,
  addPillar,
  addRoomShell,
  addRug,
  addSarcophagus,
  addStalagmite,
  addTable,
  addTimberFrame,
  addWall,
  newBuild,
  type InteriorBuild,
  type InteriorTheme,
} from './models/interiors';
import { registerCellFactory } from '@/world/cells';

const THEMES: Record<DungeonTheme, InteriorTheme> = {
  crypt: { floorLo: 0x26241f, floorHi: 0x3a3731, wall: 0x33302a, wallHi: 0x4a463e, ceil: 0x211f1b, trim: 0x1c1a16 },
  mine: { floorLo: 0x2c261d, floorHi: 0x453c2e, wall: 0x3d362b, wallHi: 0x55493a, ceil: 0x241f18, trim: 0x1e1912 },
  cave: { floorLo: 0x272521, floorHi: 0x3a3830, wall: 0x32302a, wallHi: 0x45423a, ceil: 0x201e1a, trim: 0x191713 },
  ruin: { floorLo: 0x2c2a25, floorHi: 0x444038, wall: 0x3a372f, wallHi: 0x534e43, ceil: 0x262420, trim: 0x201d18 },
};

interface DRoom {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  depth: number; // graph distance from entry
}

interface DCorr {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  axis: 'x' | 'z';
}

function overlaps(a: { x0: number; z0: number; x1: number; z1: number }, rooms: readonly DRoom[], corrs: readonly DCorr[], pad: number): boolean {
  for (const r of rooms) {
    if (a.x0 - pad < r.x1 && a.x1 + pad > r.x0 && a.z0 - pad < r.z1 && a.z1 + pad > r.z0) return true;
  }
  for (const c of corrs) {
    if (a.x0 - pad < c.x1 && a.x1 + pad > c.x0 && a.z0 - pad < c.z1 && a.z1 + pad > c.z0) return true;
  }
  return false;
}

/** Wall a rect with openings where corridors meet it. */
function wallRect(
  b: InteriorBuild,
  rect: { x0: number; z0: number; x1: number; z1: number },
  ceil: number,
  theme: InteriorTheme,
  openings: Array<{ axis: 'x' | 'z'; at: number; center: number; width: number }>,
): void {
  const sideOpen = (axis: 'x' | 'z', at: number): Array<{ center: number; width: number }> =>
    openings.filter((o) => o.axis === axis && Math.abs(o.at - at) < 0.01).map((o) => ({ center: o.center, width: o.width }));
  addWall(b, 'x', rect.x0, rect.x1, rect.z0, 0, ceil, theme, sideOpen('x', rect.z0));
  addWall(b, 'x', rect.x0, rect.x1, rect.z1, 0, ceil, theme, sideOpen('x', rect.z1));
  addWall(b, 'z', rect.z0, rect.z1, rect.x0, 0, ceil, theme, sideOpen('z', rect.x0));
  addWall(b, 'z', rect.z0, rect.z1, rect.x1, 0, ceil, theme, sideOpen('z', rect.x1));
}

function genProcedural(def: DungeonDef): InteriorBuild {
  const rng = new Sfc32(seedOf('dungeon', DUNGEONS.indexOf(def)));
  const theme = THEMES[def.theme];
  const ceil = def.theme === 'crypt' ? 3.4 : def.theme === 'ruin' ? 4 : 3.0;
  const targetRooms = def.tier === 1 ? 6 : def.tier === 2 ? 9 : 12;
  const CORR_W = 2.0;

  const rooms: DRoom[] = [];
  const corrs: DCorr[] = [];
  const links: Array<{ axis: 'x' | 'z'; at: number; center: number; width: number }> = [];

  // Entry room at origin; the exterior door is on its -Z wall.
  const entryRoom: DRoom = { x0: -4, z0: -3, x1: 4, z1: 4, depth: 0 };
  rooms.push(entryRoom);

  let guard = 0;
  while (rooms.length < targetRooms && guard++ < 220) {
    const from = rng.pick(rooms);
    const dir = rng.int(0, 3); // 0:+x 1:-x 2:+z 3:-z
    const corrLen = rng.range(4, 9);
    const rw = rng.range(5, 10);
    const rd = rng.range(5, 10);

    let corr: DCorr;
    let room: DRoom;
    const fy = (from.z0 + from.z1) / 2 + rng.range(-1.5, 1.5);
    const fx = (from.x0 + from.x1) / 2 + rng.range(-1.5, 1.5);
    if (dir === 0) {
      corr = { x0: from.x1, z0: fy - CORR_W / 2, x1: from.x1 + corrLen, z1: fy + CORR_W / 2, axis: 'x' };
      room = { x0: corr.x1, z0: fy - rd / 2, x1: corr.x1 + rw, z1: fy + rd / 2, depth: from.depth + 1 };
    } else if (dir === 1) {
      corr = { x0: from.x0 - corrLen, z0: fy - CORR_W / 2, x1: from.x0, z1: fy + CORR_W / 2, axis: 'x' };
      room = { x0: corr.x0 - rw, z0: fy - rd / 2, x1: corr.x0, z1: fy + rd / 2, depth: from.depth + 1 };
    } else if (dir === 2) {
      corr = { x0: fx - CORR_W / 2, z0: from.z1, x1: fx + CORR_W / 2, z1: from.z1 + corrLen, axis: 'z' };
      room = { x0: fx - rw / 2, z0: corr.z1, x1: fx + rw / 2, z1: corr.z1 + rd, depth: from.depth + 1 };
    } else {
      corr = { x0: fx - CORR_W / 2, z0: from.z0 - corrLen, x1: fx + CORR_W / 2, z1: from.z0, axis: 'z' };
      room = { x0: fx - rw / 2, z0: corr.z0 - rd, x1: fx + rw / 2, z1: corr.z0, depth: from.depth + 1 };
    }
    // Entry's -Z face must stay clear (exterior door).
    if (room.z0 < entryRoom.z0 - 1 && room.x0 < entryRoom.x1 && room.x1 > entryRoom.x0) continue;
    if (overlaps(room, rooms, corrs, 1.2) || overlaps(corr, rooms.filter((r) => r !== from), corrs, 0.4)) continue;

    rooms.push(room);
    corrs.push(corr);
    // Door openings where the corridor meets each room.
    if (corr.axis === 'x') {
      links.push({ axis: 'z', at: corr.x0, center: (corr.z0 + corr.z1) / 2, width: CORR_W });
      links.push({ axis: 'z', at: corr.x1, center: (corr.z0 + corr.z1) / 2, width: CORR_W });
    } else {
      links.push({ axis: 'x', at: corr.z0, center: (corr.x0 + corr.x1) / 2, width: CORR_W });
      links.push({ axis: 'x', at: corr.z1, center: (corr.x0 + corr.x1) / 2, width: CORR_W });
    }
  }

  // Build geometry.
  const b = newBuild();
  for (const r of rooms) {
    addRoomShell(b, { ...r, floorY: 0, ceilY: ceil }, theme);
    wallRect(b, r, ceil, theme, links);
  }
  for (const c of corrs) {
    addRoomShell(b, { ...c, floorY: 0, ceilY: Math.min(ceil, 2.6) }, theme);
    wallRect(b, c, Math.min(ceil, 2.6), theme, links);
  }

  // Entry door opening on entry room's -Z wall + exit entity.
  addWall(b, 'x', entryRoom.x0, entryRoom.x1, entryRoom.z0, 0, ceil, theme, [
    { center: 0, width: 1.6 },
  ]);
  b.entities.push({ kind: 'door', x: 0, y: 0, z: entryRoom.z0 + 0.4, rotY: Math.PI, tag: 'exit' });

  // Theme dressing + loot + spawns.
  const deepest = rooms.reduce((a, r) => (r.depth > a.depth ? r : a), rooms[0] as DRoom);
  for (const r of rooms) {
    const cx = (r.x0 + r.x1) / 2;
    const cz = (r.z0 + r.z1) / 2;
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    const isEntry = r === rooms[0];
    const isBoss = r === deepest;

    if (def.theme === 'crypt') {
      if (!isEntry && rng.chance(0.8)) addSarcophagus(b, cx + rng.range(-w / 4, w / 4), 0, cz + rng.range(-d / 4, d / 4), rng.int(0, 1) * (Math.PI / 2));
      if (rng.chance(0.7)) addBonePile(b, rng, r.x0 + rng.range(0.8, 1.6), 0, r.z0 + rng.range(0.8, 1.6));
      if (w > 6 && d > 6) {
        addPillar(b, theme, r.x0 + 1.5, 0, ceil, r.z0 + 1.5);
        addPillar(b, theme, r.x1 - 1.5, 0, ceil, r.z1 - 1.5);
      }
    } else if (def.theme === 'mine') {
      if (rng.chance(0.8)) addBarrel(b, rng, r.x0 + rng.range(0.7, 1.4), 0, r.z1 - rng.range(0.7, 1.4));
      if (rng.chance(0.6)) addTable(b, rng, cx + rng.range(-1, 1), 0, cz + rng.range(-1, 1));
    } else if (def.theme === 'cave') {
      const n = rng.int(2, 5);
      for (let i = 0; i < n; i++) {
        addStalagmite(b, rng, r.x0 + rng.range(0.6, w - 0.6), 0, r.z0 + rng.range(0.6, d - 0.6), rng.chance(0.7));
      }
    } else {
      if (rng.chance(0.7)) addPillar(b, theme, cx + rng.range(-w / 3, w / 3), 0, ceil * rng.range(0.4, 1), cz + rng.range(-d / 3, d / 3));
      if (rng.chance(0.5)) addBonePile(b, rng, cx, 0, cz);
    }

    // Light: entry + every other room gets a flame.
    if (isEntry || rng.chance(0.55)) {
      addLantern(b, cx, Math.min(ceil, 2.6) - 0.5, cz, true);
    }

    // Containers.
    if (isBoss) {
      addChestGeo(b, cx, 0, r.z1 - 1, 0);
      b.entities.push({ kind: 'container', x: cx, y: 0, z: r.z1 - 1, rotY: 0, tag: `chest:boss:${def.tier}` });
    } else if (!isEntry && rng.chance(0.4)) {
      const chx = r.x0 + 0.9;
      const chz = r.z0 + 0.9;
      addChestGeo(b, chx, 0, chz, rng.range(0, Math.PI));
      b.entities.push({ kind: 'container', x: chx, y: 0, z: chz, rotY: 0, tag: `chest:tier:${def.tier}` });
    }

    // Spawn markers (P5).
    if (!isEntry) {
      const n = isBoss ? 2 : rng.chance(0.75) ? rng.int(1, 2) : 0;
      for (let i = 0; i < n; i++) {
        b.entities.push({
          kind: 'marker',
          x: cx + rng.range(-w / 4, w / 4),
          y: 0,
          z: cz + rng.range(-d / 4, d / 4),
          rotY: rng.range(0, Math.PI * 2),
          tag: `spawn:${def.theme}:${def.tier}${isBoss ? ':boss' : ''}`,
        });
      }
    }
  }

  // Mine timber frames along corridors.
  if (def.theme === 'mine') {
    for (const c of corrs) {
      const mid = c.axis === 'x' ? (c.x0 + c.x1) / 2 : (c.z0 + c.z1) / 2;
      if (c.axis === 'x') addTimberFrame(b, mid, 0, (c.z0 + c.z1) / 2, CORR_W, 2.5, 'x');
      else addTimberFrame(b, (c.x0 + c.x1) / 2, 0, mid, CORR_W, 2.5, 'z');
    }
  }

  return b;
}

// ----- authored layouts --------------------------------------------------------

function genSmugglers(): InteriorBuild {
  const rng = new Sfc32(seedOf('dungeon-authored', 1));
  const theme = THEMES.cave;
  const b = newBuild();
  const ceil = 2.9;
  const rooms = [
    { x0: -3.5, z0: -3, x1: 3.5, z1: 3, floorY: 0, ceilY: ceil }, // entry grotto
    { x0: -1.1, z0: 3, x1: 1.1, z1: 11, floorY: 0, ceilY: 2.4 }, // tunnel
    { x0: -6, z0: 11, x1: 6, z1: 19, floorY: 0, ceilY: 3.4 }, // main chamber
    { x0: 6, z0: 13.5, x1: 12, z1: 18, floorY: 0, ceilY: 2.8 }, // stash room
  ] as const;
  for (const r of rooms) addRoomShell(b, { ...r }, theme);
  const links = [
    { axis: 'x' as const, at: 3, center: 0, width: 2.2 },
    { axis: 'x' as const, at: 11, center: 0, width: 2.2 },
    { axis: 'z' as const, at: 6, center: 15.75, width: 2 },
  ];
  wallRect(b, rooms[0], ceil, theme, links);
  wallRect(b, rooms[1], 2.4, theme, links);
  wallRect(b, rooms[2], 3.4, theme, links);
  wallRect(b, rooms[3], 2.8, theme, links);
  addWall(b, 'x', -3.5, 3.5, -3, 0, ceil, theme, [{ center: 0, width: 1.6 }]);
  b.entities.push({ kind: 'door', x: 0, y: 0, z: -2.6, rotY: Math.PI, tag: 'exit' });

  for (let i = 0; i < 6; i++) addStalagmite(b, rng, rng.range(-3, 3), 0, rng.range(-2, 2.4), rng.chance(0.6));
  // Main chamber: smuggler camp.
  addTable(b, rng, -2, 0, 15);
  addBarrel(b, rng, -4.6, 0, 12.2);
  addBarrel(b, rng, -3.8, 0, 12.6);
  addBarrel(b, rng, 4.6, 0, 17.8);
  addRug(b, rng, 0, 0, 15.5, 2.4, 1.8);
  addLantern(b, 0, 2.6, 15, true);
  addLantern(b, 9, 2.3, 15.75, true);
  b.entities.push({ kind: 'marker', x: -2, y: 0, z: 16.5, rotY: 0, tag: 'spawn:cave:1' });
  b.entities.push({ kind: 'marker', x: 2.5, y: 0, z: 13.5, rotY: 2, tag: 'spawn:cave:1' });
  // Stash: the good stuff.
  addChestGeo(b, 10.8, 0, 14.5, -Math.PI / 2);
  b.entities.push({ kind: 'container', x: 10.8, y: 0, z: 14.5, rotY: 0, tag: 'chest:boss:1' });
  addChestGeo(b, 10.8, 0, 17, -Math.PI / 2);
  b.entities.push({ kind: 'container', x: 10.8, y: 0, z: 17, rotY: 0, tag: 'chest:tier:1' });
  addBarrel(b, rng, 7, 0, 17.2);
  return b;
}

function genBarrow(): InteriorBuild {
  const rng = new Sfc32(seedOf('dungeon-authored', 2));
  const theme = THEMES.crypt;
  const b = newBuild();
  const ceil = 3.6;
  // Entry hall → ring corridor → 4 alcoves → sanctum at far end.
  const entry = { x0: -3, z0: -3, x1: 3, z1: 4, floorY: 0, ceilY: ceil };
  const ringW = { x0: -8, z0: 4, x1: -5.5, z1: 16, floorY: 0, ceilY: 2.8 };
  const ringE = { x0: 5.5, z0: 4, x1: 8, z1: 16, floorY: 0, ceilY: 2.8 };
  const ringN = { x0: -8, z0: 16, x1: 8, z1: 18.5, floorY: 0, ceilY: 2.8 };
  const sanctum = { x0: -4.5, z0: 18.5, x1: 4.5, z1: 26, floorY: 0, ceilY: 4.2 };
  const alcoveW1 = { x0: -12, z0: 6, x1: -8, z1: 10, floorY: 0, ceilY: 2.6 };
  const alcoveW2 = { x0: -12, z0: 11, x1: -8, z1: 15, floorY: 0, ceilY: 2.6 };
  const alcoveE1 = { x0: 8, z0: 6, x1: 12, z1: 10, floorY: 0, ceilY: 2.6 };
  const alcoveE2 = { x0: 8, z0: 11, x1: 12, z1: 15, floorY: 0, ceilY: 2.6 };
  const all = [entry, ringW, ringE, ringN, sanctum, alcoveW1, alcoveW2, alcoveE1, alcoveE2];
  for (const r of all) addRoomShell(b, r, theme);
  const links = [
    { axis: 'x' as const, at: 4, center: -6.75, width: 2 },
    { axis: 'x' as const, at: 4, center: 6.75, width: 2 },
    { axis: 'z' as const, at: -8, center: 8, width: 1.8 },
    { axis: 'z' as const, at: -8, center: 13, width: 1.8 },
    { axis: 'z' as const, at: 8, center: 8, width: 1.8 },
    { axis: 'z' as const, at: 8, center: 13, width: 1.8 },
    { axis: 'x' as const, at: 16, center: -6.75, width: 2 },
    { axis: 'x' as const, at: 16, center: 6.75, width: 2 },
    { axis: 'x' as const, at: 18.5, center: 0, width: 2.2 },
  ];
  for (const r of all) wallRect(b, r, r.ceilY, theme, links);
  addWall(b, 'x', -3, 3, -3, 0, ceil, theme, [{ center: 0, width: 1.6 }]);
  b.entities.push({ kind: 'door', x: 0, y: 0, z: -2.6, rotY: Math.PI, tag: 'exit' });

  addPillar(b, theme, -1.8, 0, ceil, 0.5);
  addPillar(b, theme, 1.8, 0, ceil, 0.5);
  for (const a of [alcoveW1, alcoveW2, alcoveE1, alcoveE2]) {
    addSarcophagus(b, (a.x0 + a.x1) / 2, 0, (a.z0 + a.z1) / 2, a.x0 < 0 ? Math.PI / 2 : -Math.PI / 2);
    if (rng.chance(0.6)) addBonePile(b, rng, a.x0 + 0.8, 0, a.z0 + 0.8);
    b.entities.push({ kind: 'marker', x: (a.x0 + a.x1) / 2, y: 0, z: (a.z0 + a.z1) / 2 + 1.2, rotY: 0, tag: 'spawn:crypt:2' });
  }
  // Sanctum: tablet pedestal (quest item arrives in P7) + boss spawn.
  addPillar(b, theme, -3, 0, 4.2, 19.5);
  addPillar(b, theme, 3, 0, 4.2, 19.5);
  addPillar(b, theme, -3, 0, 4.2, 24.5);
  addPillar(b, theme, 3, 0, 4.2, 24.5);
  // Stone altar — the tablets rest here (quest pickup arrives in P7).
  addSarcophagus(b, 0, 0, 23.5, Math.PI / 2);
  b.entities.push({ kind: 'marker', x: 0, y: 0, z: 22, rotY: 0, tag: 'spawn:crypt:2:boss' });
  b.entities.push({ kind: 'marker', x: 0, y: 1.1, z: 23.5, rotY: 0, tag: 'quest:tablets' });
  addChestGeo(b, -3.5, 0, 25, 0);
  b.entities.push({ kind: 'container', x: -3.5, y: 0, z: 25, rotY: 0, tag: 'chest:boss:2' });
  addLantern(b, 0, 3.4, 21, true);
  addLantern(b, 0, 2.4, 10, true);
  return b;
}

function genUndertooth(): InteriorBuild {
  // P3: shell only (entry chamber + descending halls); P7 authors the finale.
  const rng = new Sfc32(seedOf('dungeon-authored', 3));
  const theme = THEMES.cave;
  const b = newBuild();
  const ceil = 4.5;
  const rooms = [
    { x0: -4, z0: -3, x1: 4, z1: 5, floorY: 0, ceilY: ceil },
    { x0: -1.2, z0: 5, x1: 1.2, z1: 14, floorY: 0, ceilY: 3 },
    { x0: -9, z0: 14, x1: 9, z1: 30, floorY: 0, ceilY: 6 }, // the Drowned Throne cavern
  ] as const;
  for (const r of rooms) addRoomShell(b, { ...r }, theme);
  const links = [
    { axis: 'x' as const, at: 5, center: 0, width: 2.4 },
    { axis: 'x' as const, at: 14, center: 0, width: 2.4 },
  ];
  for (const r of rooms) wallRect(b, { ...r }, r.ceilY, theme, links);
  addWall(b, 'x', -4, 4, -3, 0, ceil, theme, [{ center: 0, width: 1.6 }]);
  b.entities.push({ kind: 'door', x: 0, y: 0, z: -2.6, rotY: Math.PI, tag: 'exit' });
  for (let i = 0; i < 10; i++) {
    addStalagmite(b, rng, rng.range(-8, 8), 0, rng.range(15, 29), rng.chance(0.5));
  }
  addLantern(b, 0, 3.6, 2, true);
  b.entities.push({ kind: 'marker', x: 0, y: 0, z: 26, rotY: 0, tag: 'quest:throne' });
  b.entities.push({ kind: 'marker', x: 0, y: 0, z: 22, rotY: 0, tag: 'spawn:cave:3:boss' });
  return b;
}

// ----- registration ---------------------------------------------------------------

/** Register every dungeon's interior cell factory. Call once at boot. */
export function registerDungeons(): void {
  for (const def of DUNGEONS) {
    const cid = asCellId(`dgn:${def.id}`);
    registerCellFactory(cid, () => {
      const build =
        def.authored === 'smugglers'
          ? genSmugglers()
          : def.authored === 'barrow'
            ? genBarrow()
            : def.authored === 'undertooth'
              ? genUndertooth()
              : genProcedural(def);
      return {
        build,
        theme: def.theme,
        label: def.name,
      };
    });
  }
}
