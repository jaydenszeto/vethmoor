/**
 * The western ocean — a camera-following plane at sea level with a scrolling
 * dual-layer noise shader. Cheap, moody, very 2002.
 */

import * as THREE from 'three';
import { waterNoiseTexture } from '@/gen/textures';

const WATER_VERT = /* glsl */ `
varying vec3 vWorld;
varying float vDist;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mv = viewMatrix * wp;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const WATER_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uNoise;
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSunColor;
uniform float uSunI;
uniform vec3 uFogColor;
uniform float uFogDensity;
varying vec3 vWorld;
varying float vDist;

void main() {
  vec2 uv1 = vWorld.xz / 41.0 + vec2(uTime * 0.014, uTime * 0.011);
  vec2 uv2 = vWorld.xz / 16.0 - vec2(uTime * 0.009, -uTime * 0.013);
  float n1 = texture2D(uNoise, uv1).r;
  float n2 = texture2D(uNoise, uv2).r;
  float ripple = n1 * 0.6 + n2 * 0.4;

  vec3 col = mix(uDeep, uShallow, smoothstep(0.35, 0.78, ripple));
  // Sparse sun glints on ripple crests.
  float glint = smoothstep(0.78, 0.95, n1 * n2 * 1.7);
  col += uSunColor * glint * 0.35 * uSunI;

  float f = 1.0 - exp(-uFogDensity * uFogDensity * vDist * vDist);
  col = mix(col, uFogColor, clamp(f, 0.0, 1.0));
  gl_FragColor = vec4(col, 0.93);
}
`;

export class Ocean {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: {
        uNoise: { value: waterNoiseTexture() },
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(0x14242a) },
        uShallow: { value: new THREE.Color(0x2c4a4c) },
        uSunColor: { value: new THREE.Color(0xfff0d8) },
        uSunI: { value: 1 },
        uFogColor: { value: new THREE.Color(0x9aa49a) },
        uFogDensity: { value: 0.003 },
      },
      transparent: true,
      depthWrite: false,
    });
    const geo = new THREE.PlaneGeometry(4200, 4200, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 2;
    this.mesh.name = 'ocean';
    this.mesh.frustumCulled = false;
  }

  update(
    camX: number,
    camZ: number,
    timeS: number,
    sunColor: THREE.Color,
    sunI: number,
    fogColor: THREE.Color,
    fogDensity: number,
  ): void {
    // Snap to a coarse grid so the plane never visibly swims.
    this.mesh.position.set(Math.round(camX / 64) * 64, 0, Math.round(camZ / 64) * 64);
    const u = this.mat.uniforms;
    u.uTime!.value = timeS;
    (u.uSunColor!.value as THREE.Color).copy(sunColor);
    u.uSunI!.value = sunI;
    (u.uFogColor!.value as THREE.Color).copy(fogColor);
    u.uFogDensity!.value = fogDensity;
  }
}
