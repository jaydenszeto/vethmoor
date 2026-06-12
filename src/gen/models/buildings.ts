/**
 * Parametric exterior building shells. Convention: building faces -Z (door
 * on the -Z face at local origin's edge), origin at floor center, y=0 at
 * ground. Towns rotate shells in 90° steps only, keeping colliders
 * axis-aligned. Returns merged vertex-colored geometry + local AABBs +
 * door/sign anchor points.
 */

import * as THREE from 'three';
import type { Sfc32 } from '@/engine/rng';
import { aabb, type Aabb } from '@/engine/math';
import { box, limb, merge, paint, paintGradient } from './primitives';
import type { TownStyle } from '@/data/towns';

export type BuildingKind = 'inn' | 'trader' | 'temple' | 'house' | 'lodge' | 'hall';

export interface BuildingShell {
  geo: THREE.BufferGeometry;
  colliders: Aabb[];
  /** Door center (local), on the -Z face. */
  door: { x: number; y: number; z: number };
  w: number;
  d: number;
  height: number;
}

interface Palette {
  wallLo: number;
  wallHi: number;
  roof: number;
  trim: number;
  base: number;
}

const PALETTES: Record<TownStyle, Palette> = {
  fishing: { wallLo: 0x4a3c2c, wallHi: 0x6b5940, roof: 0x3d3833, trim: 0x35291d, base: 0x44423c },
  port: { wallLo: 0x6e675a, wallHi: 0x8a8170, roof: 0x4a4039, trim: 0x3c372f, base: 0x504c44 },
  market: { wallLo: 0x6a6052, wallHi: 0x857a66, roof: 0x55402e, trim: 0x423a2e, base: 0x4e4a42 },
  stilt: { wallLo: 0x46443a, wallHi: 0x5d5a4a, roof: 0x3a4038, trim: 0x2e2c24, base: 0x3c3a32 },
  mining: { wallLo: 0x4c4842, wallHi: 0x5f5a52, roof: 0x39362f, trim: 0x2f2c27, base: 0x423f39 },
  nomad: { wallLo: 0x5d4f3c, wallHi: 0x77654c, roof: 0x4f4334, trim: 0x3a3127, base: 0x4a4239 },
};

/** Gable prism with ridge along X. Origin at eave base center. */
function gableRoof(w: number, d: number, rise: number, overhang: number, color: number): THREE.BufferGeometry {
  const hw = w / 2 + overhang;
  const hd = d / 2 + overhang;
  const pos: number[] = [];
  const push = (...verts: number[]): void => {
    pos.push(...verts);
  };
  // Two slopes (quads as two tris each) + two gable triangles + underside skip.
  // Slope -Z side: from (-hw,0,-hd)-(hw,0,-hd) up to ridge (-hw..hw, rise, 0).
  push(-hw, 0, -hd, hw, 0, -hd, hw, rise, 0);
  push(-hw, 0, -hd, hw, rise, 0, -hw, rise, 0);
  // Slope +Z.
  push(hw, 0, hd, -hw, 0, hd, -hw, rise, 0);
  push(hw, 0, hd, -hw, rise, 0, hw, rise, 0);
  // Gable triangles.
  push(-hw, 0, -hd, -hw, rise, 0, -hw, 0, hd);
  push(hw, 0, hd, hw, rise, 0, hw, 0, -hd);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.computeVertexNormals();
  return paintGradient(geo, color, (color & 0xfefefe) + 0x0a0a08);
}

export function buildShell(
  rng: Sfc32,
  kind: BuildingKind,
  style: TownStyle,
  w: number,
  d: number,
): BuildingShell {
  const pal = PALETTES[style];
  const parts: THREE.BufferGeometry[] = [];
  const colliders: Aabb[] = [];

  if (kind === 'lodge') {
    // Nomad bone-frame lodge: hide cone + protruding ribs.
    const r = Math.max(w, d) / 2;
    const h = r * 1.25;
    const cone = new THREE.ConeGeometry(r, h, 8, 1, false);
    cone.translate(0, h / 2, 0);
    parts.push(paintGradient(cone.toNonIndexed(), pal.wallLo, pal.wallHi));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.2;
      parts.push(
        paint(
          limb(Math.cos(a) * r * 0.8, h * 0.6, Math.sin(a) * r * 0.8, Math.cos(a) * r * 1.1, h * 1.18, Math.sin(a) * r * 1.1, 0.06, 0.04, 4),
          0xb8ad98,
        ),
      );
    }
    // Door gap faces -Z: dark inset triangle approximated by a dark box.
    const din = box(1.2, 1.9, 0.3);
    din.translate(0, 0, -r + 0.12);
    parts.push(paint(din, 0x16130f));
    colliders.push(aabb(-r * 0.82, 0, -r * 0.82, r * 0.82, h, r * 0.82));
    return {
      geo: merge(parts),
      colliders,
      door: { x: 0, y: 0, z: -r },
      w: r * 2,
      d: r * 2,
      height: h,
    };
  }

  const floors = kind === 'inn' || kind === 'hall' ? 2 : kind === 'temple' ? 1 : rng.chance(0.3) ? 2 : 1;
  const wallH = (kind === 'temple' ? 4.6 : 2.9) * floors - (floors > 1 ? 0.7 : 0);

  // Base plinth.
  const base = box(w + 0.5, 0.3, d + 0.5);
  parts.push(paintGradient(base, 0x2c2a26, pal.base));

  // Wall block.
  const walls = box(w, wallH, d);
  walls.translate(0, 0.3, 0);
  parts.push(paintGradient(walls, pal.wallLo, pal.wallHi));
  colliders.push(aabb(-w / 2, 0, -d / 2, w / 2, wallH + 0.3, d / 2));

  // Timber trim lines (corner posts).
  for (const [cx, cz] of [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ] as const) {
    const post = box(0.26, wallH, 0.26);
    post.translate(cx, 0.3, cz);
    parts.push(paint(post, pal.trim));
  }

  // Door recess on -Z face.
  const doorW = 1.3;
  const doorH = 2.15;
  const recess = box(doorW, doorH, 0.34);
  recess.translate(0, 0.3, -d / 2 - 0.05);
  parts.push(paint(recess, 0x191512));
  const frame = box(doorW + 0.34, doorH + 0.2, 0.22);
  frame.translate(0, 0.3, -d / 2 - 0.16);
  parts.push(paint(frame, pal.trim));
  // Step.
  const step = box(doorW + 0.6, 0.18, 0.9);
  step.translate(0, 0, -d / 2 - 0.55);
  parts.push(paintGradient(step, 0x2c2a26, pal.base));

  // Windows: dark insets with trim sills, spread on ±X faces and +Z.
  const winRows = floors;
  const winPerSide = Math.max(1, Math.floor(d / 3.2));
  for (let r = 0; r < winRows; r++) {
    const wy = 1.55 + r * 2.5;
    if (wy + 0.8 > wallH) break;
    for (let i = 0; i < winPerSide; i++) {
      const wz = -d / 2 + (i + 0.5) * (d / winPerSide);
      for (const sx of [-1, 1]) {
        const win = box(0.18, 0.85, 0.6);
        win.translate((sx * w) / 2, wy, wz);
        parts.push(paint(win, 0x141d20));
      }
    }
    const backWins = Math.max(1, Math.floor(w / 3.5));
    for (let i = 0; i < backWins; i++) {
      const wx = -w / 2 + (i + 0.5) * (w / backWins);
      const win = box(0.6, 0.85, 0.18);
      win.translate(wx, wy, d / 2);
      parts.push(paint(win, 0x141d20));
    }
  }

  // Roof.
  const roofRise = kind === 'temple' ? w * 0.5 : w * 0.34;
  if (style === 'mining') {
    const slab = box(w + 0.9, 0.35, d + 0.9);
    slab.translate(0, wallH + 0.3, 0);
    parts.push(paintGradient(slab, pal.roof, (pal.roof & 0xfefefe) + 0x0c0c0a));
  } else {
    const roof = gableRoof(w, d, roofRise, 0.45, pal.roof);
    roof.translate(0, wallH + 0.3, 0);
    parts.push(roof);
  }

  // Temple: ember finial; inn: sign bracket handled by towngen.
  if (kind === 'temple') {
    const fin = new THREE.OctahedronGeometry(0.35, 0);
    fin.translate(0, wallH + 0.3 + roofRise + 0.4, 0);
    parts.push(paint(fin.toNonIndexed(), 0xff8a3c));
  }

  return {
    geo: merge(parts),
    colliders,
    door: { x: 0, y: 0.3, z: -d / 2 },
    w,
    d,
    height: wallH + roofRise,
  };
}
