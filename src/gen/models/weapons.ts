/** First-person weapon meshes, palette-swapped by material tier. */

import * as THREE from 'three';
import type { ItemId } from '@/data/ids';
import { itemDef } from '@/data/items';
import { box, limb, merge, paint, paintGradient, vertexColorMaterial } from './primitives';

interface TierPalette {
  metalLo: number;
  metalHi: number;
  grip: number;
}

const PALETTES: Record<string, TierPalette> = {
  iron: { metalLo: 0x4a4d52, metalHi: 0x787d84, grip: 0x3a2c1c },
  steel: { metalLo: 0x6a7078, metalHi: 0xa8aeb8, grip: 0x4a3826 },
  wyrmbronze: { metalLo: 0x6e4a28, metalHi: 0xb08048, grip: 0x2e2318 },
  duskglass: { metalLo: 0x4a3a66, metalHi: 0x8a6fc0, grip: 0x1c1822 },
  voidstone: { metalLo: 0x1c2026, metalHi: 0x3f6b62, grip: 0x2c2320 },
  leather: { metalLo: 0x4a4d52, metalHi: 0x787d84, grip: 0x3a2c1c },
  bound: { metalLo: 0x2a4a44, metalHi: 0x6fd0b0, grip: 0x1c2a26 },
};

function paletteFor(id: string): TierPalette {
  const tier = id.split('-')[0] ?? 'iron';
  return PALETTES[tier] ?? (PALETTES.iron as TierPalette);
}

/** Weapon geometry with grip at origin, blade along -Z. */
export function weaponGeometry(id: ItemId | 'fists' | 'bound'): THREE.BufferGeometry | null {
  if (id === 'fists') return null;
  const pal = id === 'bound' ? (PALETTES.bound as TierPalette) : paletteFor(id as string);
  const key = id === 'bound' ? 'sword' : ((id as string).split('-')[1] ?? 'sword');
  const parts: THREE.BufferGeometry[] = [];

  const grip = (len = 0.16): void => {
    parts.push(paint(box(0.045, 0.045, len), pal.grip));
  };

  if (key === 'dagger') {
    grip(0.14);
    const blade = box(0.05, 0.015, 0.3);
    blade.translate(0, 0, -0.22);
    parts.push(paintGradient(blade, pal.metalLo, pal.metalHi));
  } else if (key === 'sword') {
    grip();
    const guard = box(0.16, 0.03, 0.035);
    guard.translate(0, 0, -0.09);
    parts.push(paint(guard, pal.metalLo));
    const blade = box(0.06, 0.018, 0.72);
    blade.translate(0, 0, -0.48);
    parts.push(paintGradient(blade, pal.metalLo, pal.metalHi));
  } else if (key === 'greatsword') {
    grip(0.26);
    const guard = box(0.2, 0.04, 0.045);
    guard.translate(0, 0, -0.15);
    parts.push(paint(guard, pal.metalLo));
    const blade = box(0.075, 0.02, 0.95);
    blade.translate(0, 0, -0.66);
    parts.push(paintGradient(blade, pal.metalLo, pal.metalHi));
  } else if (key === 'mace') {
    grip(0.3);
    const head = new THREE.IcosahedronGeometry(0.085, 0);
    head.translate(0, 0, -0.42);
    parts.push(paintGradient(head.toNonIndexed(), pal.metalLo, pal.metalHi));
  } else if (key === 'warhammer') {
    grip(0.42);
    const head = box(0.13, 0.13, 0.2);
    head.translate(0, 0, -0.58);
    parts.push(paintGradient(head, pal.metalLo, pal.metalHi));
  } else if (key === 'bow') {
    // Curved bow: three limb segments + string.
    parts.push(paint(limb(0, -0.34, 0.07, 0, -0.12, -0.04, 0.018, 0.022, 4), pal.grip));
    parts.push(paint(limb(0, -0.12, -0.04, 0, 0.12, -0.04, 0.024, 0.024, 4), pal.grip));
    parts.push(paint(limb(0, 0.12, -0.04, 0, 0.34, 0.07, 0.022, 0.018, 4), pal.grip));
    const str = box(0.006, 0.66, 0.006);
    str.translate(0, 0, 0.075);
    parts.push(paint(str, 0xd8d0c0));
  } else {
    return null;
  }
  return merge(parts);
}

export function weaponMesh(id: ItemId | 'fists' | 'bound'): THREE.Mesh | null {
  const geo = weaponGeometry(id);
  if (!geo) return null;
  const mesh = new THREE.Mesh(geo, vertexColorMaterial());
  return mesh;
}

/** Picks the right viewmodel source for the equipped state. */
export function viewmodelWeaponId(equipped: ItemId | null, boundActive: boolean): ItemId | 'fists' | 'bound' {
  if (boundActive) return 'bound';
  if (!equipped) return 'fists';
  return itemDef(equipped).weapon ? equipped : 'fists';
}
