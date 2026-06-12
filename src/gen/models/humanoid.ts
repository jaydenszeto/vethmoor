/**
 * Boxy humanoid figures — villagers, guards, traders, priests. P3: merged
 * static geometry (1 draw per NPC). P5 swaps combat actors to pivoted limb
 * groups for animation; this module provides both paths' palette logic.
 */

import type * as THREE from 'three';
import type { Sfc32 } from '@/engine/rng';
import { box, merge, paint, paintGradient } from './primitives';
import type { Culture } from '@/gen/names';

export type NpcRole = 'villager' | 'guard' | 'trader' | 'innkeep' | 'priest' | 'noble' | 'nomad';

const SKIN: Record<Culture, number> = {
  karthi: 0xb98e6a,
  veldrun: 0x9aa0b8, // ash-pale with a violet cast
  sutherai: 0x8a5f3c,
  morchai: 0x7a8a64, // grey-green
  grimmwold: 0xc9a182,
};

const TUNICS: Record<NpcRole, readonly number[]> = {
  villager: [0x5d5440, 0x4a5248, 0x5a4636, 0x49545c],
  guard: [0x3c4248, 0x434a52],
  trader: [0x5d4a2e, 0x4f5a40],
  innkeep: [0x5e4936, 0x594a3c],
  priest: [0x4a4456, 0x3f3b4d],
  noble: [0x4f3a4a, 0x35495a],
  nomad: [0x6b5a42, 0x5d5038],
};

const HAIR = [0x2c2118, 0x4a3826, 0x6e5a3a, 0x8a8a86, 0x1c1a16] as const;

export function makeHumanoidGeo(
  rng: Sfc32,
  role: NpcRole,
  culture: Culture,
): THREE.BufferGeometry {
  const skin = SKIN[culture];
  const tunic = rng.pick(TUNICS[role]);
  const pants = (tunic & 0xfefefe) >> 1;
  const hair = rng.pick(HAIR);
  const parts: THREE.BufferGeometry[] = [];

  // Legs.
  for (const sx of [-1, 1]) {
    const leg = box(0.17, 0.78, 0.2);
    leg.translate(sx * 0.11, 0, 0);
    parts.push(paint(leg, pants));
  }
  // Torso (tunic) — slight gradient for cloth depth.
  const torso = box(0.46, 0.62, 0.26);
  torso.translate(0, 0.78, 0);
  parts.push(paintGradient(torso, (tunic & 0xfefefe) >> 1, tunic));
  // Belt.
  const belt = box(0.48, 0.08, 0.28);
  belt.translate(0, 0.78, 0);
  parts.push(paint(belt, 0x2e2318));
  // Arms.
  for (const sx of [-1, 1]) {
    const arm = box(0.13, 0.58, 0.16);
    arm.translate(sx * 0.31, 0.8, 0);
    parts.push(paint(arm, tunic));
    const hand = box(0.12, 0.12, 0.14);
    hand.translate(sx * 0.31, 0.69, 0);
    parts.push(paint(hand, skin));
  }
  // Head.
  const head = box(0.26, 0.28, 0.26);
  head.translate(0, 1.46, 0);
  parts.push(paint(head, skin));

  if (role === 'guard') {
    // Iron half-helm + tabard stripe.
    const helm = box(0.3, 0.14, 0.3);
    helm.translate(0, 1.62, 0);
    parts.push(paint(helm, 0x5d6168));
    const tabard = box(0.2, 0.55, 0.02);
    tabard.translate(0, 0.8, -0.15);
    parts.push(paint(tabard, 0x6e3a2a)); // Iron Vigil rust-red
  } else if (role === 'priest') {
    const hood = box(0.3, 0.2, 0.3);
    hood.translate(0, 1.56, 0);
    parts.push(paint(hood, tunic));
  } else {
    const hairCap = box(0.28, 0.1, 0.28);
    hairCap.translate(0, 1.62, 0);
    parts.push(paint(hairCap, hair));
  }
  if (role === 'trader' || role === 'innkeep') {
    const apron = box(0.34, 0.5, 0.02);
    apron.translate(0, 0.62, -0.15);
    parts.push(paint(apron, 0x77684e));
  }

  return merge(parts);
}
