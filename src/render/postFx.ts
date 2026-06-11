/**
 * Final blit pass: nearest-neighbor upscale of the low-res render target to
 * the full-resolution canvas, with ordered 4x4 Bayer dithering (applied per
 * source texel, in the retro spirit) and a soft vignette. Also performs the
 * explicit linear → sRGB encode: the scene RT is linear half-float and this
 * shader is the only place gamma happens.
 */

import * as THREE from 'three';

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function makeBayerTexture(): THREE.DataTexture {
  const data = new Float32Array(16);
  for (let i = 0; i < 16; i++) data[i] = ((BAYER4[i] as number) + 0.5) / 16;
  const tex = new THREE.DataTexture(data, 4, 4, THREE.RedFormat, THREE.FloatType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tSrc;
uniform sampler2D tBayer;
uniform vec2 uSrcSize;
uniform float uDither;
uniform float uVignette;

vec3 linearToSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

void main() {
  vec3 c = texture2D(tSrc, vUv).rgb;
  c = linearToSrgb(c);

  // Dither in the low-res pixel grid so noise pixels match scene pixels.
  vec2 cell = (floor(vUv * uSrcSize) + 0.5) / 4.0;
  float d = texture2D(tBayer, cell).r - 0.5;
  c += d * uDither;

  vec2 q = vUv - 0.5;
  float vig = 1.0 - uVignette * smoothstep(0.3, 0.78, length(q));
  c *= vig;

  gl_FragColor = vec4(c, 1.0);
}
`;

export class PostBlit {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: THREE.ShaderMaterial;

  constructor() {
    // Single fullscreen triangle (covers NDC with overdraw clipped away).
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        tSrc: { value: null },
        tBayer: { value: makeBayerTexture() },
        uSrcSize: { value: new THREE.Vector2(640, 360) },
        uDither: { value: 0.035 },
        uVignette: { value: 0.32 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  setSource(texture: THREE.Texture, width: number, height: number): void {
    this.material.uniforms.tSrc!.value = texture;
    (this.material.uniforms.uSrcSize!.value as THREE.Vector2).set(width, height);
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }
}
