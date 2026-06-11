/**
 * Game orchestrator: owns the loop, renderer, scene graph and mode state.
 * P0 scope — menu backdrop (ember monolith among standing stones in dusk fog)
 * and a pointer-locked glide stub proving the input/render contracts. The
 * world systems replace the demo scene in P1.
 */

import * as THREE from 'three';
import { config } from '@/engine/config';
import { events, type GameMode } from '@/engine/events';
import { input } from '@/engine/input';
import { GameLoop } from '@/engine/loop';
import { clamp } from '@/engine/math';
import { Sfc32, seedOf } from '@/engine/rng';
import { GameRenderer, type RenderHeight } from '@/render/renderer';

const EYE_HEIGHT = 1.7;

const scratchMouse = { dx: 0, dy: 0 };

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: GameRenderer;
  readonly loop: GameLoop;

  mode: GameMode = 'boot';

  private yaw = 0;
  private pitch = 0;
  private readonly pos = new THREE.Vector3(0, EYE_HEIGHT, 9);
  private readonly prevPos = this.pos.clone();
  private readonly vel = new THREE.Vector3();

  private menuTime = 0;
  private monolith!: THREE.Mesh;
  private emberLight!: THREE.PointLight;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new GameRenderer(canvas);
    this.camera = new THREE.PerspectiveCamera(71, this.renderer.aspect, 0.08, 1200);
    input.attach(canvas);
    this.buildDemoScene();
    this.loop = new GameLoop(this.sim, this.renderFrame);
  }

  /** Async boot: later phases bake textures here behind the loading screen. */
  async boot(): Promise<void> {
    this.setMode('menu');
    this.loop.start();
  }

  setMode(mode: GameMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    input.onGameMode(mode);
    events.emit('game:mode', { mode });
  }

  newGame(): void {
    this.pos.set(0, EYE_HEIGHT, 9);
    this.prevPos.copy(this.pos);
    this.yaw = 0;
    this.pitch = 0;
    this.setMode('play');
  }

  toMenu(): void {
    input.clearModes();
    this.setMode('menu');
  }

  setRenderHeight(h: RenderHeight): void {
    this.renderer.setRenderHeight(h);
  }

  // ----- P0 demo scene ------------------------------------------------------

  private buildDemoScene(): void {
    const fogColor = new THREE.Color(0x131a1c);
    this.scene.fog = new THREE.FogExp2(fogColor, 0.026);
    this.scene.background = fogColor;

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshLambertMaterial({ color: 0x2c352f }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    // Ember-lit monolith — placeholder hero object proving lighting + fog.
    this.monolith = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 3.4, 1.4),
      new THREE.MeshLambertMaterial({
        color: 0x4d4844,
        emissive: new THREE.Color(0xff7b29),
        emissiveIntensity: 0.12,
      }),
    );
    this.monolith.position.set(0, 1.7, 0);
    this.scene.add(this.monolith);

    // Ring of standing stones, deterministically placed.
    const rng = new Sfc32(seedOf('demo-stones'));
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x3b403c });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rng.range(-0.1, 0.1);
      const r = rng.range(7, 26);
      const h = rng.range(1.2, 3.2);
      const stone = new THREE.Mesh(new THREE.BoxGeometry(rng.range(0.5, 1.1), h, rng.range(0.4, 0.9)), stoneMat);
      stone.position.set(Math.cos(a) * r, h / 2 - 0.05, Math.sin(a) * r);
      stone.rotation.y = rng.range(0, Math.PI);
      stone.rotation.z = rng.range(-0.06, 0.06);
      this.scene.add(stone);
    }

    const hemi = new THREE.HemisphereLight(0x46595f, 0x241f1b, 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xff9a55, 0.75);
    sun.position.set(-40, 14, -28);
    this.scene.add(sun);
    this.emberLight = new THREE.PointLight(0xff8030, 14, 22, 2);
    this.emberLight.position.set(0, 2.4, 0);
    this.scene.add(this.emberLight);
  }

  // ----- simulation ---------------------------------------------------------

  private sim = (dt: number): void => {
    this.menuTime += dt;
    if (this.mode === 'play' && !input.uiOpen) {
      this.simPlay(dt);
    }
    // Ember pulse runs in every mode (visible behind menu).
    const flicker =
      0.12 + 0.05 * Math.sin(this.menuTime * 2.1) + 0.02 * Math.sin(this.menuTime * 9.7);
    (this.monolith.material as THREE.MeshLambertMaterial).emissiveIntensity = flicker;
    this.emberLight.intensity = 12 + 22 * flicker;
    input.postSimClear();
  };

  private simPlay(dt: number): void {
    input.consumeMouse(scratchMouse);
    const sens = config.mouseSens;
    const ySign = config.invertY ? -1 : 1;
    this.yaw -= scratchMouse.dx * sens;
    this.pitch = clamp(this.pitch - scratchMouse.dy * sens * ySign, -1.55, 1.55);

    const speed = input.held('sprint') ? 9 : 4.5;
    let fx = 0;
    let fz = 0;
    if (input.held('forward')) fz += 1;
    if (input.held('back')) fz -= 1;
    if (input.held('left')) fx -= 1;
    if (input.held('right')) fx += 1;
    const len = Math.hypot(fx, fz) || 1;
    fx /= len;
    fz /= len;

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    this.vel.x = (fz * -sin + fx * cos) * speed;
    this.vel.z = (fz * -cos + fx * -sin) * speed;

    this.prevPos.copy(this.pos);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y = EYE_HEIGHT;
  }

  // ----- render -------------------------------------------------------------

  private renderFrame = (alpha: number, _frameDt: number): void => {
    if (this.camera.aspect !== this.renderer.aspect) {
      this.camera.aspect = this.renderer.aspect;
      this.camera.updateProjectionMatrix();
    }

    if (this.mode === 'menu' || this.mode === 'boot') {
      const t = this.menuTime * 0.07;
      const r = 11.5;
      this.camera.position.set(Math.cos(t) * r, 2.3 + Math.sin(this.menuTime * 0.18) * 0.4, Math.sin(t) * r);
      this.camera.lookAt(0, 1.5, 0);
    } else {
      this.camera.position.lerpVectors(this.prevPos, this.pos, alpha);
      this.camera.rotation.set(0, 0, 0);
      this.camera.rotateY(this.yaw);
      this.camera.rotateX(this.pitch);
    }

    this.renderer.renderFrame(this.scene, this.camera);
  };
}
