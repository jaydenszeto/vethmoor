/**
 * Sky dome + the atmosphere model. computeAtmosphere(hour) is the single
 * source of light/color truth — sky shader, terrain uniforms, scene lights,
 * fog and water all read from it, so dusk is dusk everywhere.
 */

import * as THREE from 'three';
import { clamp01, lerp, smoothstep } from '@/engine/math';
import { DAWN_HOUR, DUSK_HOUR } from '@/data/world';

export interface Atmosphere {
  sunDir: THREE.Vector3; // also moon at night (the active light)
  sunColor: THREE.Color;
  sunI: number;
  zenith: THREE.Color;
  horizon: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  nightAmt: number; // 0 day → 1 deep night (stars)
  elev: number; // sun elevation -1..1
}

export function makeAtmosphere(): Atmosphere {
  return {
    sunDir: new THREE.Vector3(0, 1, 0),
    sunColor: new THREE.Color(),
    sunI: 1,
    zenith: new THREE.Color(),
    horizon: new THREE.Color(),
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    nightAmt: 0,
    elev: 1,
  };
}

interface Stop {
  e: number;
  zenith: number;
  horizon: number;
  sun: number;
  sunI: number;
}

const STOPS: readonly Stop[] = [
  { e: -0.5, zenith: 0x04070d, horizon: 0x0e151d, sun: 0x8fa6c8, sunI: 0.16 },
  { e: -0.12, zenith: 0x070b12, horizon: 0x16202b, sun: 0xa9b8d0, sunI: 0.18 },
  { e: 0.0, zenith: 0x111722, horizon: 0xb35430, sun: 0xff7634, sunI: 0.5 },
  { e: 0.12, zenith: 0x2a3742, horizon: 0xc98548, sun: 0xffb070, sunI: 0.85 },
  { e: 0.38, zenith: 0x44606d, horizon: 0x9fab9d, sun: 0xffe2bb, sunI: 1.0 },
  { e: 1.0, zenith: 0x53727f, horizon: 0xb4bfae, sun: 0xfff0d8, sunI: 1.0 },
];

const cA = new THREE.Color();
const cB = new THREE.Color();

function lerpStops(e: number, out: Atmosphere): void {
  let i = 0;
  while (i < STOPS.length - 2 && e > (STOPS[i + 1] as Stop).e) i++;
  const a = STOPS[i] as Stop;
  const b = STOPS[i + 1] as Stop;
  const t = clamp01((e - a.e) / (b.e - a.e));
  out.zenith.copy(cA.setHex(a.zenith)).lerp(cB.setHex(b.zenith), t);
  out.horizon.copy(cA.setHex(a.horizon)).lerp(cB.setHex(b.horizon), t);
  out.sunColor.copy(cA.setHex(a.sun)).lerp(cB.setHex(b.sun), t);
  out.sunI = lerp(a.sunI, b.sunI, t);
}

const DAY_LEN = DUSK_HOUR - DAWN_HOUR; // 14h
const NIGHT_LEN = 24 - DAY_LEN;

export function computeAtmosphere(hour: number, out: Atmosphere): void {
  const h = ((hour % 24) + 24) % 24;
  const isDay = h >= DAWN_HOUR && h <= DUSK_HOUR;

  if (isDay) {
    const t = (h - DAWN_HOUR) / DAY_LEN; // 0..1 dawn→dusk
    const elev = Math.sin(t * Math.PI);
    out.elev = elev;
    const az = Math.PI * t; // east → west
    out.sunDir.set(Math.cos(az), Math.max(elev, 0.02) * 1.1, 0.32).normalize();
  } else {
    // Moon arc across the night.
    const t = h > DUSK_HOUR ? (h - DUSK_HOUR) / NIGHT_LEN : (h + 24 - DUSK_HOUR) / NIGHT_LEN;
    const elev = Math.sin(t * Math.PI);
    out.elev = -elev; // negative = night depth for the stop table
    const az = Math.PI * t;
    out.sunDir.set(Math.cos(az), Math.max(elev, 0.02) * 0.9, -0.4).normalize();
  }

  lerpStops(out.elev, out);
  out.nightAmt = smoothstep(-0.04, -0.3, out.elev);

  // Hemisphere lighting derived from the sky.
  out.hemiSky.copy(out.zenith).lerp(out.horizon, 0.45).multiplyScalar(isDay ? 1.05 : 0.8);
  out.hemiGround.copy(out.horizon).multiplyScalar(0.22);
  out.hemiGround.r += 0.012;
}

// ----- dome ------------------------------------------------------------------

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uFogColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunI;
uniform float uNight;
uniform float uTime;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

void main() {
  vec3 d = normalize(vDir);
  float hgt = d.y;

  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.02, 0.5, hgt));
  // Blend into terrain fog at the horizon line.
  sky = mix(uFogColor, sky, smoothstep(-0.06, 0.14, hgt));

  // Sun / moon disc + glow.
  float s = dot(d, uSunDir);
  float disc = smoothstep(0.9993, 0.9998, s);
  float glow = smoothstep(0.94, 0.9993, s);
  sky += uSunColor * (disc * 1.6 + glow * 0.16) * uSunI;

  // Stars (cell-hashed, twinkling) fade in with night, only above horizon.
  if (uNight > 0.01 && hgt > 0.03) {
    vec3 cell = floor(d * 220.0);
    float hs = hash13(cell);
    float star = step(0.9982, hs);
    float tw = 0.6 + 0.4 * sin(uTime * (1.5 + hs * 4.0) + hs * 40.0);
    sky += vec3(0.9, 0.93, 1.0) * star * tw * uNight * smoothstep(0.03, 0.2, hgt) * 0.85;
  }

  gl_FragColor = vec4(sky, 1.0);
}
`;

export class Sky {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: {
        uZenith: { value: new THREE.Color(0x53727f) },
        uHorizon: { value: new THREE.Color(0xb4bfae) },
        uFogColor: { value: new THREE.Color(0x9aa49a) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color(0xfff0d8) },
        uSunI: { value: 1 },
        uNight: { value: 0 },
        uTime: { value: 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(940, 28, 14), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    this.mesh.name = 'sky';
  }

  update(camPos: THREE.Vector3, atmo: Atmosphere, fogColor: THREE.Color, timeS: number): void {
    this.mesh.position.copy(camPos);
    const u = this.mat.uniforms;
    (u.uZenith!.value as THREE.Color).copy(atmo.zenith);
    (u.uHorizon!.value as THREE.Color).copy(atmo.horizon);
    (u.uFogColor!.value as THREE.Color).copy(fogColor);
    (u.uSunDir!.value as THREE.Vector3).copy(atmo.sunDir);
    (u.uSunColor!.value as THREE.Color).copy(atmo.sunColor);
    u.uSunI!.value = atmo.sunI;
    u.uNight!.value = atmo.nightAmt;
    u.uTime!.value = timeS;
  }
}
