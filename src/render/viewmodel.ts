/**
 * First-person viewmodel: the equipped weapon (and a casting hand-glow)
 * attached to the camera, posed by combat state with snappy lerps.
 * Lambert-lit like the world; fog disabled (it sits 0.5 m from the eye).
 */

import * as THREE from 'three';
import type { ItemId } from '@/data/ids';
import { weaponMesh, viewmodelWeaponId } from '@/gen/models/weapons';
import type { CombatPose } from '@/systems/combat';
import { clamp, lerp } from '@/engine/math';

interface PoseDef {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
}

const POSES: Record<string, PoseDef> = {
  idle: { x: 0.34, y: -0.34, z: -0.55, rx: 0.15, ry: -0.18, rz: 0.04 },
  windup: { x: 0.42, y: -0.18, z: -0.42, rx: 0.55, ry: -0.75, rz: 0.35 },
  swing: { x: -0.28, y: -0.4, z: -0.62, rx: -0.45, ry: 0.5, rz: -0.5 },
  cooldown: { x: 0.3, y: -0.42, z: -0.55, rx: 0.05, ry: -0.12, rz: 0 },
  cast: { x: 0.2, y: -0.26, z: -0.5, rx: -0.15, ry: 0.15, rz: 0 },
  bowdraw: { x: 0.1, y: -0.26, z: -0.5, rx: 0, ry: Math.PI / 2 - 0.12, rz: 0 },
  bowidle: { x: 0.26, y: -0.34, z: -0.52, rx: 0.1, ry: Math.PI / 2 - 0.3, rz: 0.1 },
};

export class ViewModel {
  readonly group = new THREE.Group();
  private weapon: THREE.Mesh | null = null;
  private currentId: ItemId | 'fists' | 'bound' | '__none' = '__none';
  private glow: THREE.Mesh;
  private cur: PoseDef = { ...(POSES.idle as PoseDef) };

  constructor(camera: THREE.Camera) {
    this.group.name = 'viewmodel';
    camera.add(this.group);
    // Cast glow: a small additive disc that pulses during 'cast'.
    const glowGeo = new THREE.CircleGeometry(0.09, 12);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffa050,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.glow = new THREE.Mesh(glowGeo, glowMat);
    this.glow.position.set(0.18, -0.24, -0.55);
    this.group.add(this.glow);
  }

  /** Swap the weapon mesh when equipment changes. */
  setWeapon(equipped: ItemId | null, boundActive: boolean): void {
    const want = viewmodelWeaponId(equipped, boundActive);
    if (want === this.currentId) return;
    this.currentId = want;
    if (this.weapon) {
      this.group.remove(this.weapon);
      this.weapon.geometry.dispose();
      this.weapon = null;
    }
    const mesh = weaponMesh(want);
    if (mesh) {
      mesh.frustumCulled = false;
      this.weapon = mesh;
      this.group.add(mesh);
    }
  }

  update(
    dt: number,
    pose: CombatPose,
    poseT: number,
    chargeT: number,
    bobPhase: number,
    isBow: boolean,
  ): void {
    let target: PoseDef;
    if (pose === 'idle' || pose === 'cooldown') {
      target = (isBow ? POSES.bowidle : POSES.idle) as PoseDef;
    } else if (pose === 'bowdraw') {
      target = POSES.bowdraw as PoseDef;
    } else {
      target = POSES[pose] as PoseDef;
    }

    // Swing sweeps fast; other transitions ease.
    const k = pose === 'swing' ? 22 : 10;
    const t = 1 - Math.exp(-k * dt);
    this.cur.x = lerp(this.cur.x, target.x, t);
    this.cur.y = lerp(this.cur.y, target.y, t);
    this.cur.z = lerp(this.cur.z, target.z, t);
    this.cur.rx = lerp(this.cur.rx, target.rx, t);
    this.cur.ry = lerp(this.cur.ry, target.ry, t);
    this.cur.rz = lerp(this.cur.rz, target.rz, t);

    if (this.weapon) {
      // Idle bob + charge tremble.
      const bobY = Math.sin(bobPhase * 2) * 0.012;
      const tremble = pose === 'windup' || pose === 'bowdraw' ? Math.sin(poseT * 40) * 0.004 * clamp(chargeT, 0, 1) : 0;
      const drawPull = pose === 'bowdraw' ? clamp(chargeT / 0.8, 0, 1) * 0.1 : 0;
      this.weapon.position.set(this.cur.x + tremble, this.cur.y + bobY, this.cur.z + drawPull);
      this.weapon.rotation.set(this.cur.rx, this.cur.ry, this.cur.rz);
    }

    // Cast glow pulse.
    const mat = this.glow.material as THREE.MeshBasicMaterial;
    if (pose === 'cast') {
      mat.opacity = Math.max(0, 0.85 - poseT * 2.6);
      this.glow.scale.setScalar(1 + poseT * 4);
    } else {
      mat.opacity = Math.max(0, mat.opacity - dt * 4);
    }
  }
}
