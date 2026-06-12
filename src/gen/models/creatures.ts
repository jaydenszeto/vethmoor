/**
 * Enemy meshes from primitives. Each creature is a Group with named parts
 * so the AI can drive procedural animation: 'body' (bob/lunge), optional
 * 'legsL'/'legsR' (walk swing), 'wingL'/'wingR' (flap), 'head'.
 */

import * as THREE from 'three';
import { Sfc32, seedOf } from '@/engine/rng';
import type { EnemyId } from '@/data/ids';
import { blob, box, crossedQuads, limb, paint, paintGradient, vertexColorMaterial } from './primitives';
import { makeHumanoidGeo } from './humanoid';

export interface CreatureRig {
  group: THREE.Group;
  body: THREE.Object3D;
  legsL: THREE.Object3D | null;
  legsR: THREE.Object3D | null;
  wingL: THREE.Object3D | null;
  wingR: THREE.Object3D | null;
  /** Eye/strike height. */
  height: number;
  radius: number;
}

function meshOf(geo: THREE.BufferGeometry): THREE.Mesh {
  return new THREE.Mesh(geo, vertexColorMaterial());
}

export function buildCreature(kind: EnemyId, seedExtra: number, scale: number): CreatureRig {
  const rng = new Sfc32(seedOf('creature', seedExtra));
  const group = new THREE.Group();
  let body: THREE.Object3D = group;
  let legsL: THREE.Object3D | null = null;
  let legsR: THREE.Object3D | null = null;
  let wingL: THREE.Object3D | null = null;
  let wingR: THREE.Object3D | null = null;
  let height = 1.6;
  let radius = 0.5;
  const k = kind as string;

  if (k === 'marsh-crab') {
    const shell = meshOf(paintGradient(blob(rng, 0.55, 0.5), 0x4a3528, 0x7a5a40));
    shell.position.y = 0.35;
    const clawL = meshOf(paintGradient(blob(rng, 0.22, 0.7), 0x5d4534, 0x8a6a4c));
    clawL.position.set(-0.5, 0.25, -0.35);
    const clawR = clawL.clone();
    clawR.position.x = 0.5;
    const bodyG = new THREE.Group();
    bodyG.add(shell, clawL, clawR);
    // Legs: thin boxes splayed.
    const lL = new THREE.Group();
    const lR = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const legA = meshOf(paint(box(0.06, 0.32, 0.06), 0x4a3528));
      legA.position.set(-0.45, 0.05, -0.25 + i * 0.25);
      legA.rotation.z = 0.6;
      lL.add(legA);
      const legB = legA.clone();
      legB.position.x = 0.45;
      legB.rotation.z = -0.6;
      lR.add(legB);
    }
    group.add(bodyG, lL, lR);
    body = bodyG;
    legsL = lL;
    legsR = lR;
    height = 0.7;
    radius = 0.6;
  } else if (k === 'giant-rat') {
    const bodyG = new THREE.Group();
    const torso = meshOf(paintGradient(blob(rng, 0.42, 0.75), 0x4a3c30, 0x6b5847));
    torso.position.y = 0.4;
    torso.scale.z = 1.5;
    const head = meshOf(paintGradient(new THREE.ConeGeometry(0.22, 0.5, 6).toNonIndexed(), 0x4a3c30, 0x73604e));
    head.rotation.x = -Math.PI / 2;
    head.position.set(0, 0.42, -0.62);
    const tail = meshOf(paint(limb(0, 0.35, 0.55, 0, 0.3, 1.25, 0.05, 0.01, 4), 0x8a6a5c));
    bodyG.add(torso, head, tail);
    const lL = new THREE.Group();
    const lR = new THREE.Group();
    for (const dz of [-0.3, 0.3]) {
      const a = meshOf(paint(box(0.08, 0.3, 0.08), 0x3a2f26));
      a.position.set(-0.22, 0.02, dz);
      lL.add(a);
      const b = a.clone();
      b.position.x = 0.22;
      lR.add(b);
    }
    group.add(bodyG, lL, lR);
    body = bodyG;
    legsL = lL;
    legsR = lR;
    height = 0.75;
    radius = 0.5;
  } else if (k === 'rift-shrike') {
    const bodyG = new THREE.Group();
    const torso = meshOf(paintGradient(blob(rng, 0.34, 0.8), 0x35383f, 0x4d525c));
    torso.scale.z = 1.4;
    const beak = meshOf(paint(new THREE.ConeGeometry(0.08, 0.35, 5).toNonIndexed(), 0xb89a4a));
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, 0.05, -0.5);
    bodyG.add(torso, beak);
    const mkWing = (sign: number): THREE.Group => {
      const w = new THREE.Group();
      const feather = meshOf(paintGradient(box(0.85, 0.04, 0.4), 0x2c2f35, 0x4d525c));
      feather.position.x = sign * 0.5;
      w.add(feather);
      w.position.set(sign * 0.2, 0.1, 0);
      return w;
    };
    wingL = mkWing(-1);
    wingR = mkWing(1);
    bodyG.add(wingL, wingR);
    bodyG.position.y = 1.0;
    group.add(bodyG);
    body = bodyG;
    height = 1.2;
    radius = 0.55;
  } else if (k === 'skeleton-warden' || k === 'ash-risen' || k === 'bandit' || k === 'herald') {
    // Humanoid frame; palette varies by kind.
    const role = k === 'bandit' ? 'villager' : 'guard';
    const geo = makeHumanoidGeo(rng, role, k === 'ash-risen' ? 'veldrun' : 'morchai');
    if (k === 'skeleton-warden') {
      // Recolor to bone.
      const colors = geo.getAttribute('color') as THREE.BufferAttribute;
      for (let i = 0; i < colors.count; i++) {
        const v = 0.62 + (colors.getX(i) % 0.12);
        colors.setXYZ(i, v, v * 0.96, v * 0.84);
      }
    } else if (k === 'ash-risen') {
      const colors = geo.getAttribute('color') as THREE.BufferAttribute;
      for (let i = 0; i < colors.count; i++) {
        const v = 0.25 + (colors.getX(i) % 0.1);
        colors.setXYZ(i, v * 1.15, v, v * 0.9);
      }
    }
    const bodyMesh = meshOf(geo);
    const bodyG = new THREE.Group();
    bodyG.add(bodyMesh);
    if (k !== 'ash-risen') {
      // A weapon in hand.
      const blade = meshOf(paintGradient(box(0.07, 0.95, 0.14), 0x55524c, 0x8a877e));
      blade.position.set(0.36, 0.95, -0.2);
      blade.rotation.x = 0.5;
      bodyG.add(blade);
    }
    if (k === 'herald') {
      const crown = meshOf(paint(new THREE.ConeGeometry(0.22, 0.4, 5).toNonIndexed(), 0x4a7a8a));
      crown.position.y = 1.78;
      bodyG.add(crown);
      // Drowned-king aura tendrils.
      const weed = meshOf(paintGradient(crossedQuads(0.8, 1.4, 3, 0.3), 0x1d3b38, 0x3f6b62));
      weed.position.y = 0.2;
      bodyG.add(weed);
    }
    group.add(bodyG);
    body = bodyG;
    height = 1.78;
    radius = 0.5;
  } else if (k === 'fungal-shambler') {
    const bodyG = new THREE.Group();
    const trunk = meshOf(paintGradient(blob(rng, 0.6, 1.3), 0x3a3d2c, 0x5d5c41));
    trunk.position.y = 0.9;
    const cap = meshOf(
      paintGradient(new THREE.SphereGeometry(0.65, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.45).toNonIndexed(), 0x4f7d6d, 0x77a08c),
    );
    cap.position.y = 1.7;
    const armL = meshOf(paintGradient(limb(-0.5, 1.3, 0, -1.1, 0.6, -0.3, 0.16, 0.08, 5), 0x3a3d2c, 0x55543c));
    const armR = meshOf(paintGradient(limb(0.5, 1.3, 0, 1.1, 0.7, -0.2, 0.16, 0.08, 5), 0x3a3d2c, 0x55543c));
    bodyG.add(trunk, cap, armL, armR);
    group.add(bodyG);
    body = bodyG;
    height = 2.1;
    radius = 0.75;
  } else if (k === 'ember-wisp') {
    const bodyG = new THREE.Group();
    const core = meshOf(paint(new THREE.OctahedronGeometry(0.28, 0).toNonIndexed(), 0xffb060));
    const halo = meshOf(paint(new THREE.OctahedronGeometry(0.45, 0).toNonIndexed(), 0xc25f1d));
    (halo.material as THREE.Material).transparent = true;
    halo.material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.35,
    });
    bodyG.add(core, halo);
    bodyG.position.y = 1.3;
    group.add(bodyG);
    body = bodyG;
    height = 1.5;
    radius = 0.45;
  }

  group.scale.setScalar(scale);
  height *= scale;
  radius *= scale;
  return { group, body, legsL, legsR, wingL, wingR, height, radius };
}
