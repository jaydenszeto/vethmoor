/**
 * First-person player: input → desired velocity → kinematic capsule, plus
 * the camera-feel state (head bob, landing dip). Stats hook in at P4/P5;
 * until then speeds are baseline-human.
 */

import { config } from '@/engine/config';
import { clamp } from '@/engine/math';
import { input } from '@/engine/input';
import {
  stepBody,
  type BodyState,
  type CollisionQuery,
  type MoveInput,
} from '@/engine/collision';
import { EYE_HEIGHT, SEA_LEVEL } from '@/data/world';

const WALK_SPEED = 4.3;
const SPRINT_MULT = 1.65;
const SNEAK_MULT = 0.45;
const SWIM_SPEED = 3.1;

const scratchMouse = { dx: 0, dy: 0 };
const moveInput: MoveInput = { ax: 0, az: 0, ay: 0, jump: false };

export class Player {
  readonly body: BodyState = {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
    mode: 'walk',
    landImpact: 0,
  };

  prevX = 0;
  prevY = 0;
  prevZ = 0;

  yaw = 0;
  pitch = 0;

  bobPhase = 0;
  landDip = 0;
  sneaking = false;

  spawnAt(x: number, z: number, yaw: number, q: CollisionQuery): void {
    this.body.x = x;
    this.body.z = z;
    this.body.y = q.heightAt(x, z);
    this.body.vx = this.body.vy = this.body.vz = 0;
    this.body.onGround = true;
    this.body.mode = 'walk';
    this.yaw = yaw;
    this.pitch = 0;
    this.prevX = x;
    this.prevY = this.body.y;
    this.prevZ = z;
  }

  update(dt: number, q: CollisionQuery): void {
    // Look.
    input.consumeMouse(scratchMouse);
    const sens = config.mouseSens;
    const ySign = config.invertY ? -1 : 1;
    this.yaw -= scratchMouse.dx * sens;
    this.pitch = clamp(this.pitch - scratchMouse.dy * sens * ySign, -1.55, 1.55);

    // Desired velocity in world space.
    if (input.wasPressed('sneak')) this.sneaking = !this.sneaking;
    let fx = 0;
    let fz = 0;
    if (input.held('forward')) fz += 1;
    if (input.held('back')) fz -= 1;
    if (input.held('left')) fx -= 1;
    if (input.held('right')) fx += 1;
    const len = Math.hypot(fx, fz) || 1;
    fx /= len;
    fz /= len;

    const swimming = this.body.mode === 'swim';
    let speed = swimming ? SWIM_SPEED : WALK_SPEED;
    if (!swimming && input.held('sprint') && !this.sneaking) speed *= SPRINT_MULT;
    if (this.sneaking) speed *= SNEAK_MULT;

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    moveInput.ax = (fz * -sin + fx * cos) * speed;
    moveInput.az = (fz * -cos + fx * -sin) * speed;
    // Swim vertical: follow look pitch when moving forward, plus jump key up.
    moveInput.ay = swimming
      ? fz * Math.sin(this.pitch) * speed + (input.held('jump') ? 2.2 : 0)
      : 0;
    moveInput.jump = input.wasPressed('jump');

    this.prevX = this.body.x;
    this.prevY = this.body.y;
    this.prevZ = this.body.z;

    stepBody(this.body, moveInput, dt, q);

    // Camera feel.
    if (this.body.landImpact > 0) {
      this.landDip = Math.min(0.18, this.body.landImpact * 0.014);
    }
    this.landDip *= Math.exp(-7 * dt);

    const hSpeed = Math.hypot(this.body.vx, this.body.vz);
    if (this.body.onGround && hSpeed > 0.6) {
      this.bobPhase += dt * hSpeed * 1.45;
    }
  }

  /** Interpolated eye position parts for the render camera. */
  eyeX(alpha: number): number {
    return this.prevX + (this.body.x - this.prevX) * alpha;
  }
  eyeZ(alpha: number): number {
    return this.prevZ + (this.body.z - this.prevZ) * alpha;
  }
  eyeY(alpha: number): number {
    const base = this.prevY + (this.body.y - this.prevY) * alpha + EYE_HEIGHT;
    const bob = this.body.onGround ? Math.sin(this.bobPhase * 2) * 0.045 : 0;
    const sneakDrop = this.sneaking ? 0.35 : 0;
    return base + bob - this.landDip - sneakDrop;
  }

  get underwater(): boolean {
    return this.body.mode === 'swim' && this.body.y + EYE_HEIGHT < SEA_LEVEL - 0.1;
  }
}
