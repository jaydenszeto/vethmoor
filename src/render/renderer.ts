/**
 * Render orchestration: WebGL renderer + the low-resolution scene render
 * target. The 3D world is always rendered at ~360p into `rt`, then PostBlit
 * upscales to the full-resolution canvas. UI never enters this pipeline —
 * React DOM composites on top at native resolution.
 */

import * as THREE from 'three';
import { PostBlit } from './postFx';

export type RenderHeight = 270 | 360 | 450;

export class GameRenderer {
  readonly gl: THREE.WebGLRenderer;
  private rt: THREE.WebGLRenderTarget;
  private readonly blit = new PostBlit();
  private renderHeight: RenderHeight = 360;
  rtWidth = 640;
  rtHeight = 360;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.NoToneMapping;
    this.gl.autoClear = true;

    this.rt = this.createTarget(this.rtWidth, this.rtHeight);
    this.onResize();
    window.addEventListener('resize', this.onResize);
  }

  private createTarget(w: number, h: number): THREE.WebGLRenderTarget {
    const rt = new THREE.WebGLRenderTarget(w, h, {
      magFilter: THREE.NearestFilter,
      minFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType, // linear HDR-ish; gamma happens in the blit
      depthBuffer: true,
      stencilBuffer: false,
      generateMipmaps: false,
      colorSpace: THREE.NoColorSpace,
    });
    return rt;
  }

  setRenderHeight(h: RenderHeight): void {
    this.renderHeight = h;
    this.onResize();
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.gl.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    this.rtHeight = this.renderHeight;
    this.rtWidth = Math.max(2, Math.round((this.renderHeight * aspect) / 2) * 2);
    this.rt.setSize(this.rtWidth, this.rtHeight);
  };

  get aspect(): number {
    return this.rtWidth / this.rtHeight;
  }

  /** Render one frame: scene → low-res RT → dithered blit to canvas. */
  renderFrame(scene: THREE.Scene, camera: THREE.Camera): void {
    this.gl.setRenderTarget(this.rt);
    this.gl.render(scene, camera);
    this.gl.setRenderTarget(null);
    this.blit.setSource(this.rt.texture, this.rtWidth, this.rtHeight);
    this.blit.render(this.gl);
  }

  get drawCalls(): number {
    return this.gl.info.render.calls;
  }

  get triangles(): number {
    return this.gl.info.render.triangles;
  }
}
