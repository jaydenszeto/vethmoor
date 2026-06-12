/**
 * Weather: clear / overcast / rain / ash storm. Transitions roll
 * deterministically every 3 game hours from seedOf('weather', day, slot);
 * ash storms only occur under the volcano's influence. Precipitation is two
 * GPU-animated point clouds cycling through a box around the camera — zero
 * per-frame CPU work.
 */

import * as THREE from 'three';
import { Sfc32, seedOf } from '@/engine/rng';
import { clamp01, expDamp, lerp } from '@/engine/math';
import { volcanism } from '@/world/terrain';

export type WeatherKind = 'clear' | 'overcast' | 'rain' | 'ashstorm';

interface WeatherParams {
  fogMult: number;
  lightMult: number;
  /** Fog tint pushed toward this color by `tintAmt`. */
  tint: THREE.Color;
  tintAmt: number;
}

const PARAMS: Record<WeatherKind, WeatherParams> = {
  clear: { fogMult: 1, lightMult: 1, tint: new THREE.Color(0x000000), tintAmt: 0 },
  overcast: { fogMult: 1.35, lightMult: 0.72, tint: new THREE.Color(0x8a8f8e), tintAmt: 0.35 },
  rain: { fogMult: 1.75, lightMult: 0.55, tint: new THREE.Color(0x6f7d84), tintAmt: 0.45 },
  ashstorm: { fogMult: 2.3, lightMult: 0.48, tint: new THREE.Color(0x8a5535), tintAmt: 0.62 },
};

function makeParticles(
  count: number,
  box: THREE.Vector3,
  velocity: THREE.Vector3,
  turbulence: number,
  color: number,
  size: number,
  opacity: number,
): { points: THREE.Points; mat: THREE.ShaderMaterial } {
  const rng = new Sfc32(seedOf('weather-particles', count));
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) seeds[i] = rng.float();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(seeds, 3)); // abused as seed
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10000); // never cull

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uBox: { value: box },
      uVel: { value: velocity },
      uTurb: { value: turbulence },
      uColor: { value: new THREE.Color(color) },
      uSize: { value: size },
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uCam;
      uniform vec3 uBox;
      uniform vec3 uVel;
      uniform float uTurb;
      uniform float uSize;
      void main() {
        vec3 seed = position;
        vec3 p = seed * uBox + uVel * uTime;
        p.x += sin(uTime * 1.3 + seed.y * 40.0) * uTurb;
        p.z += cos(uTime * 1.1 + seed.x * 40.0) * uTurb;
        p = mod(p, uBox) - uBox * 0.5;
        vec4 mv = viewMatrix * vec4(p + uCam, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * clamp(28.0 / -mv.z, 0.5, 2.2);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.18, length(q)) * uOpacity;
        if (a < 0.02) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  return { points, mat };
}

export class WeatherSystem {
  kind: WeatherKind = 'clear';
  private targetKind: WeatherKind = 'clear';
  private blend = 1; // 1 = fully at kind
  private lastSlot = -1;

  fogMult = 1;
  lightMult = 1;
  readonly fogTint = new THREE.Color(0x000000);
  tintAmt = 0;
  /** 0..1 strength of the active precipitation. */
  rainAmt = 0;
  ashAmt = 0;

  private rain: { points: THREE.Points; mat: THREE.ShaderMaterial };
  private ash: { points: THREE.Points; mat: THREE.ShaderMaterial };

  constructor(scene: THREE.Scene) {
    this.rain = makeParticles(
      900,
      new THREE.Vector3(34, 22, 34),
      new THREE.Vector3(-1.6, -19, -1.1),
      0.12,
      0xaebfc8,
      2.4,
      0.5,
    );
    this.ash = makeParticles(
      550,
      new THREE.Vector3(40, 18, 40),
      new THREE.Vector3(-7.5, -1.6, -4.5),
      1.6,
      0xb06a38,
      2.8,
      0.55,
    );
    scene.add(this.rain.points, this.ash.points);
  }

  /** Dev/test: force a weather kind immediately. */
  force(kind: WeatherKind): void {
    this.targetKind = kind;
    this.lastSlot = -2; // pin until next natural slot roll
  }

  /** Roll the schedule (3-game-hour slots, deterministic per day+slot). */
  private rollWeather(day: number, hour: number, vx: number, vz: number): void {
    const slot = day * 8 + Math.floor(hour / 3);
    if (slot === this.lastSlot || this.lastSlot === -2) return;
    this.lastSlot = slot;
    const rng = new Sfc32(seedOf('weather', slot));
    const v = volcanism(vx, vz);
    // Weight table shifts with volcanism.
    const roll = rng.float();
    let next: WeatherKind;
    if (v > 0.3) {
      next = roll < 0.34 ? 'ashstorm' : roll < 0.55 ? 'overcast' : roll < 0.62 ? 'rain' : 'clear';
    } else {
      next = roll < 0.16 ? 'rain' : roll < 0.42 ? 'overcast' : 'clear';
    }
    if (next !== this.targetKind) {
      this.targetKind = next;
    }
  }

  update(
    dt: number,
    day: number,
    hour: number,
    camX: number,
    camZ: number,
    camPos: THREE.Vector3,
    timeS: number,
  ): void {
    this.rollWeather(day, hour, camX, camZ);

    // Ash storms only make sense near the volcano — override en route.
    if (this.targetKind === 'ashstorm' && volcanism(camX, camZ) < 0.18) {
      this.targetKind = 'overcast';
    }

    if (this.targetKind !== this.kind) {
      this.blend = expDamp(this.blend, 0, 0.35, dt);
      if (this.blend < 0.04) {
        this.kind = this.targetKind;
      }
    } else {
      this.blend = expDamp(this.blend, 1, 0.35, dt);
    }

    const p = PARAMS[this.kind];
    const t = this.blend;
    this.fogMult = lerp(1, p.fogMult, t);
    this.lightMult = lerp(1, p.lightMult, t);
    this.fogTint.copy(p.tint);
    this.tintAmt = p.tintAmt * t;

    this.rainAmt = this.kind === 'rain' ? clamp01(t) : 0;
    this.ashAmt = this.kind === 'ashstorm' ? clamp01(t) : 0;

    // Particle uniforms.
    const ru = this.rain.mat.uniforms;
    ru.uTime!.value = timeS;
    (ru.uCam!.value as THREE.Vector3).copy(camPos);
    ru.uOpacity!.value = 0.5 * this.rainAmt;
    this.rain.points.visible = this.rainAmt > 0.02;

    const au = this.ash.mat.uniforms;
    au.uTime!.value = timeS;
    (au.uCam!.value as THREE.Vector3).copy(camPos);
    au.uOpacity!.value = 0.55 * this.ashAmt;
    this.ash.points.visible = this.ashAmt > 0.02;
  }
}
