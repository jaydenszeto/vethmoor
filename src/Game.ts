/**
 * Game orchestrator: owns the loop, renderer, world systems and mode state.
 * P1: streamed terrain, day/night atmosphere, ocean, first-person player.
 */

import * as THREE from 'three';
import { installAudioUnlock } from '@/audio/engine';
import { Ambience } from '@/audio/ambience';
import { footstep, landThump, type Surface } from '@/audio/sfx';
import { config } from '@/engine/config';
import { events, type GameMode } from '@/engine/events';
import { input } from '@/engine/input';
import { GameLoop } from '@/engine/loop';
import { GameClock } from '@/engine/time';
import { clamp } from '@/engine/math';
import { bakeTextures } from '@/gen/textures';
import { Player } from '@/entities/player';
import { GameRenderer, type RenderHeight } from '@/render/renderer';
import { Sky, computeAtmosphere, makeAtmosphere } from '@/render/sky';
import { WeatherSystem } from '@/render/weather';
import { BIOMES, BIOME_ORDER, GROUND } from '@/data/biomes';
import type { BiomeId } from '@/data/ids';
import { CAMERA_FAR, NEW_GAME_HOUR, VOLCANO_X, VOLCANO_Z, WORLD_SIZE } from '@/data/world';
import { ChunkManager } from '@/world/chunks';
import { initRoads, roadDistance } from '@/world/roads';
import { Streamer } from '@/world/streaming';
import { biomeWeightsAt, biomeAt, volcanism, worldHeight } from '@/world/terrain';
import { terrainMaterial } from '@/world/terrainMesh';
import { Ocean } from '@/world/water';
import { WorldManager } from '@/world/WorldManager';
import { updateInteract } from '@/systems/interact';
import { itemId } from '@/data/ids';
import { validateItems } from '@/data/items';
import {
  createCharacter,
  maxCarry,
  recalcDerived,
  regenTick,
  levelUpReady,
  walkSpeed,
  type BirthStone,
  type Character,
} from '@/systems/stats';
import { trackTravel } from '@/systems/skills';
import { addItem, encumbrance } from '@/systems/inventory';
import { containerContents, restoreContainers, clearContainers, serializeContainers } from '@/systems/loot';
import {
  latestSave,
  readSave,
  writeSave,
  SAVE_VERSION,
  type SaveGame,
  type SlotId,
} from '@/engine/saves';
import { getWorldSeedStr } from '@/engine/rng';
import type { Culture } from '@/gen/names';
import type { Entity } from '@/entities/entity';

const MENU_HOUR = 18.15;
const SPAWN = { x: 1825, z: 9745, yaw: -Math.PI * 0.38 };

const biomeW: number[] = [0, 0, 0, 0, 0, 0];

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: GameRenderer;
  readonly loop: GameLoop;
  readonly clock = new GameClock();

  mode: GameMode = 'boot';

  private readonly streamer = new Streamer();
  readonly chunks = new ChunkManager(this.streamer);
  readonly world = new WorldManager(this.chunks);
  private sky!: Sky;
  private ocean!: Ocean;
  private weather!: WeatherSystem;
  private readonly ambience = new Ambience();
  readonly player = new Player();
  private readonly interiorAmbient = new THREE.AmbientLight(0x141210, 1);

  private readonly atmo = makeAtmosphere();
  private readonly fogColor = new THREE.Color(0x9aa49a);
  private fogDensity = 0.003;
  private readonly hemi = new THREE.HemisphereLight(0x46595f, 0x241f1b, 1);
  private readonly sun = new THREE.DirectionalLight(0xffffff, 1);

  private timeS = 0;
  private menuDrift = 0;

  character: Character | null = null;
  /** Open container (entity + live contents reference). */
  private openContainer: Entity | null = null;
  private hudTick = 0;
  private restoring = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new GameRenderer(canvas);
    this.camera = new THREE.PerspectiveCamera(71, this.renderer.aspect, 0.08, CAMERA_FAR);
    input.attach(canvas);
    this.loop = new GameLoop(this.sim, this.renderFrame);
  }

  async boot(): Promise<void> {
    if (import.meta.env.DEV) validateItems();
    bakeTextures();
    initRoads(); // must precede any height-grid builds
    installAudioUnlock();
    this.sky = new Sky();
    this.ocean = new Ocean();
    this.weather = new WeatherSystem(this.scene);
    this.scene.add(
      this.sky.mesh,
      this.ocean.mesh,
      this.chunks.group,
      this.world.sitesGroup,
      this.world.interiorGroup,
      this.hemi,
      this.sun,
      this.interiorAmbient,
    );
    this.interiorAmbient.visible = false;
    this.scene.fog = new THREE.FogExp2(this.fogColor, this.fogDensity);

    this.world.onPlayerPlace = (x, y, z, yaw) => {
      this.player.body.x = x;
      this.player.body.y = y;
      this.player.body.z = z;
      this.player.body.vx = this.player.body.vy = this.player.body.vz = 0;
      this.player.prevX = x;
      this.player.prevY = y;
      this.player.prevZ = z;
      this.player.yaw = yaw;
    };
    this.world.onCellChanged = (cell) => {
      const inside = cell !== null;
      this.sky.mesh.visible = !inside;
      this.ocean.mesh.visible = !inside;
      this.interiorAmbient.visible = inside;
      if (inside && cell) this.interiorAmbient.color.setHex(cell.ambient).multiplyScalar(2.4);
      // Autosave on every cell transition (the Morrowind safety net).
      if (!this.restoring && this.character && this.mode === 'play') {
        void this.saveSlot('auto', 'Autosave');
      }
    };
    this.world.onContainerOpen = (e) => {
      this.openContainer = e;
      events.emit('container:open', {
        label: e.prompt ?? 'Container',
        items: containerContents(e.id as string, (e.data.tag as string) ?? 'chest:home'),
      });
      input.pushMode('container');
    };

    events.on('input:hotkey', ({ slot }) => {
      if (this.mode !== 'play') return;
      if (slot === -1) void this.saveSlot('quick', 'Quicksave');
      else if (slot === -2) void this.loadSlot('quick');
    });

    // Warm the menu vista before first paint.
    const cam = this.menuCamPos(0);
    this.warmup(cam.x, cam.z, 900);
    this.setMode('menu');
    this.loop.start();
  }

  setMode(mode: GameMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    input.onGameMode(mode);
    events.emit('game:mode', { mode });
  }

  /** New Game → character creation (menu vista keeps drifting behind). */
  newGame(): void {
    this.setMode('chargen');
  }

  finishChargen(name: string, race: Culture, classId: string, stone: BirthStone): void {
    this.character = createCharacter(name || 'The Writ-Bearer', race, classId, stone);
    clearContainers();
    this.clock.set(1, NEW_GAME_HOUR * 60);
    this.player.spawnAt(SPAWN.x, SPAWN.z, SPAWN.yaw, this.world.query);
    this.warmup(SPAWN.x, SPAWN.z, 1500);
    this.world.update(SPAWN.x, SPAWN.z);
    this.setMode('play');
    events.emit('toast', { text: 'Saltmere. The seer’s summons is three weeks old already.', kind: 'quest' });
    this.pushHudStats();
  }

  async continueGame(): Promise<void> {
    const slot = await latestSave();
    if (slot) await this.loadSlot(slot);
  }

  toMenu(): void {
    input.clearModes();
    this.setMode('menu');
  }

  // ----- saves -----------------------------------------------------------------

  captureSave(label: string): SaveGame | null {
    const c = this.character;
    if (!c) return null;
    const b = this.player.body;
    const ret = this.world.returnPoint;
    return {
      version: SAVE_VERSION,
      seedStr: getWorldSeedStr(),
      savedAt: Date.now(),
      label,
      playerLabel: `${c.name}, level ${c.level} — ${this.clock.label}`,
      clock: { day: this.clock.day, minOfDay: this.clock.minOfDay },
      player: {
        x: b.x,
        y: b.y,
        z: b.z,
        yaw: this.player.yaw,
        cell: this.world.interior ? (this.world.interior.id as string) : null,
        returnX: ret.x,
        returnZ: ret.z,
        returnYaw: ret.yaw,
        character: JSON.parse(JSON.stringify(c)) as Character,
      },
      containers: serializeContainers(),
      ext: {},
    };
  }

  async saveSlot(slot: SlotId, label: string): Promise<boolean> {
    const save = this.captureSave(label);
    if (!save) return false;
    const ok = await writeSave(slot, save);
    if (ok) events.emit('toast', { text: `Saved — ${label}`, kind: 'info' });
    return ok;
  }

  async loadSlot(slot: SlotId): Promise<boolean> {
    const save = await readSave(slot);
    if (!save) return false;
    this.restoring = true;
    input.clearModes();
    this.character = save.player.character;
    recalcDerived(this.character);
    restoreContainers(save.containers);
    this.clock.set(save.clock.day, save.clock.minOfDay);
    if (this.world.isInterior) await this.world.exitInterior();

    const p = save.player;
    if (p.cell) {
      // Load the site (registers factories), then walk through the door.
      this.player.spawnAt(p.returnX, p.returnZ, p.returnYaw, this.world.query);
      this.warmup(p.returnX, p.returnZ, 1500);
      this.world.update(p.returnX, p.returnZ);
      await this.world.enterInterior({
        cell: p.cell as never,
        returnX: p.returnX,
        returnZ: p.returnZ,
        returnYaw: p.returnYaw,
      });
      this.player.body.x = p.x;
      this.player.body.y = p.y;
      this.player.body.z = p.z;
      this.player.prevX = p.x;
      this.player.prevY = p.y;
      this.player.prevZ = p.z;
      this.player.yaw = p.yaw;
    } else {
      this.player.spawnAt(p.x, p.z, p.yaw, this.world.query);
      this.player.body.y = p.y;
      this.player.prevY = p.y;
      this.warmup(p.x, p.z, 1500);
      this.world.update(p.x, p.z);
    }
    this.setMode('play');
    this.pushHudStats();
    events.emit('toast', { text: `Loaded — ${save.label}`, kind: 'info' });
    this.restoring = false;
    return true;
  }

  setRenderHeight(h: RenderHeight): void {
    this.renderer.setRenderHeight(h);
  }

  /** Synchronously build nearby chunks (blocking, behind fades/loading). */
  private warmup(x: number, z: number, maxMs: number): void {
    const t0 = performance.now();
    this.chunks.update(x, z, this.timeS);
    while (performance.now() - t0 < maxMs) {
      if (!this.streamer.pump()) break;
    }
  }

  // ----- simulation ----------------------------------------------------------

  private sim = (dt: number): void => {
    this.timeS += dt;
    if (this.mode === 'play') {
      if (!input.uiOpen) {
        this.clock.advance(dt);
        const c = this.character;
        if (c) {
          // Movement parameters from the sheet.
          const enc = encumbrance(c);
          const over = enc > maxCarry(c);
          this.player.walkSpeedBase = walkSpeed(c) * (over ? 0.5 : 1);
          this.player.sprintAllowed = !over && c.fat > 1;
          this.player.jumpAllowed = !over && c.fat > 4;
        }

        this.player.update(dt, this.world.query);
        const b = this.player.body;
        if (!this.world.isInterior) {
          b.x = clamp(b.x, 60, WORLD_SIZE - 60);
          b.z = clamp(b.z, 60, WORLD_SIZE - 60);
        }

        if (c) {
          regenTick(c, dt, this.player.sprinting);
          const moved = Math.hypot(b.x - this.player.prevX, b.z - this.player.prevZ);
          if (moved > 0.001) trackTravel(c, moved, b.mode === 'swim');
          if (this.player.jumped) c.fat = Math.max(0, c.fat - 5);
          this.hudTick++;
          if (this.hudTick >= 6) {
            this.hudTick = 0;
            this.pushHudStats();
          }
        }

        updateInteract(this.player, this.world);
        if (this.player.stepped) {
          footstep(
            this.world.isInterior ? 'rock' : this.surfaceAt(b.x, b.z, b.mode === 'swim'),
            this.player.sneaking,
          );
        }
        if (b.landImpact > 7) landThump(Math.min(1, (b.landImpact - 7) / 14));
      }
    }
    input.postSimClear();
  };

  pushHudStats(): void {
    const c = this.character;
    if (!c) return;
    events.emit('hud:stats', {
      hp: c.hp,
      hpMax: c.hpMax,
      mp: c.mp,
      mpMax: c.mpMax,
      fat: c.fat,
      fatMax: c.fatMax,
      enc: encumbrance(c),
      encMax: maxCarry(c),
      levelReady: levelUpReady(c),
    });
  }

  /** Loot-take from the open container. index -1 = take all. */
  lootTake(index: number): void {
    const c = this.character;
    const cont = this.openContainer;
    if (!c || !cont) return;
    const items = containerContents(cont.id as string, (cont.data.tag as string) ?? 'chest:home');
    const takeOne = (i: number): void => {
      const stack = items[i];
      if (!stack) return;
      if (stack.id === itemId('gold')) {
        c.gold += stack.n;
        events.emit('toast', { text: `${stack.n} gold`, kind: 'item' });
      } else {
        addItem(c, stack.id, stack.n);
      }
      items.splice(i, 1);
    };
    if (index < 0) {
      while (items.length) takeOne(0);
    } else {
      takeOne(index);
    }
    events.emit('container:open', { label: cont.prompt ?? 'Container', items: [...items] });
    events.emit('char:changed', {});
    this.pushHudStats();
  }

  /** Dominant ground layer → footstep surface. */
  private surfaceAt(x: number, z: number, swimming: boolean): Surface {
    if (swimming) return 'water';
    if (roadDistance(x, z) < 3.2) return 'dirt';
    biomeWeightsAt(x, z, biomeW);
    let dom = 0;
    for (let i = 1; i < 6; i++) {
      if ((biomeW[i] as number) > (biomeW[dom] as number)) dom = i;
    }
    const layer = BIOMES[BIOME_ORDER[dom] as BiomeId].groundA;
    const h = this.chunks.heightAt(x, z);
    if (h < 0.5) return 'water';
    switch (layer) {
      case GROUND.rock:
        return 'rock';
      case GROUND.ash:
      case GROUND.sand:
        return 'sand';
      case GROUND.mud:
        return 'mud';
      case GROUND.road:
        return 'dirt';
      default:
        return 'grass';
    }
  }

  // ----- render --------------------------------------------------------------

  private menuCamTarget = new THREE.Vector3();

  private menuCamPos(t: number): { x: number; y: number; z: number } {
    const x = 2380 + Math.sin(t * 0.021) * 150;
    const z = 9120 + Math.cos(t * 0.016) * 190;
    const y = Math.max(worldHeight(x, z), 4) + 30;
    return { x, y, z };
  }

  private renderFrame = (alpha: number, _frameDt: number): void => {
    if (this.camera.aspect !== this.renderer.aspect) {
      this.camera.aspect = this.renderer.aspect;
      this.camera.updateProjectionMatrix();
    }

    // Camera placement.
    let camX: number;
    let camZ: number;
    if (this.mode === 'play' || this.mode === 'dead') {
      camX = this.player.eyeX(alpha);
      camZ = this.player.eyeZ(alpha);
      this.camera.position.set(camX, this.player.eyeY(alpha), camZ);
      this.camera.rotation.set(0, 0, 0);
      this.camera.rotateY(this.player.yaw);
      this.camera.rotateX(this.player.pitch);
    } else {
      this.menuDrift += 1 / 144;
      const p = this.menuCamPos(this.menuDrift);
      camX = p.x;
      camZ = p.z;
      this.camera.position.set(p.x, p.y, p.z);
      this.menuCamTarget.set(VOLCANO_X, 430, VOLCANO_Z);
      this.camera.lookAt(this.menuCamTarget);
    }

    const hour = this.mode === 'play' || this.mode === 'dead' ? this.clock.hour : MENU_HOUR;

    if (this.world.isInterior) {
      // Interior gloom: short dark fog, lights carried by the cell.
      const cell = this.world.interior;
      const fog = this.scene.fog as THREE.FogExp2;
      fog.color.setHex(cell ? cell.ambient : 0x0b0a0c);
      fog.density = 0.05;
      this.scene.background = fog.color;
      this.sun.intensity = 0;
      this.hemi.intensity = 0.25;
      this.hemi.color.setHex(0x6a6258);
      this.hemi.groundColor.setHex(0x14110e);
    } else {
      // Atmosphere drives everything.
      computeAtmosphere(hour, this.atmo);
      this.weather.update(1 / 60, this.clock.day, hour, camX, camZ, this.camera.position, this.timeS);
      this.updateAtmosphereUniforms(camX, camZ);

      // Ambient beds follow the camera.
      biomeWeightsAt(camX, camZ, biomeW);
      this.ambience.update(
        biomeW,
        volcanism(camX, camZ),
        Math.max(0, 1 - camX / 900),
        this.weather.rainAmt,
        this.weather.ashAmt,
        hour,
        this.timeS,
      );

      // Streaming around the camera anchor.
      this.chunks.update(camX, camZ, this.timeS);
      this.world.update(camX, camZ);
      this.streamer.pump();
    }

    this.renderer.renderFrame(this.scene, this.camera);
  };

  private updateAtmosphereUniforms(camX: number, camZ: number): void {
    const a = this.atmo;

    // Per-biome fog blended at the camera.
    biomeWeightsAt(camX, camZ, biomeW);
    let density = 0;
    let tintR = 0;
    let tintG = 0;
    let tintB = 0;
    for (let i = 0; i < 6; i++) {
      const def = BIOMES[BIOME_ORDER[i] as BiomeId];
      const w = biomeW[i] as number;
      density += w * def.fogDensity;
      tintR += w * def.fogTint[0];
      tintG += w * def.fogTint[1];
      tintB += w * def.fogTint[2];
    }
    this.fogDensity = density * config.fogMult * this.weather.fogMult;
    this.fogColor.copy(a.horizon);
    this.fogColor.r *= tintR;
    this.fogColor.g *= tintG;
    this.fogColor.b *= tintB;
    this.fogColor.lerp(this.weather.fogTint, this.weather.tintAmt);

    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(this.fogColor);
    fog.density = this.fogDensity;
    this.scene.background = this.fogColor;

    // Weather dims the world.
    const lm = this.weather.lightMult;

    // Lights for Lambert-lit props/entities.
    this.hemi.color.copy(a.hemiSky).multiplyScalar(0.6 + 0.4 * lm);
    this.hemi.groundColor.copy(a.hemiGround);
    this.hemi.intensity = 1;
    this.sun.color.copy(a.sunColor);
    this.sun.intensity = a.sunI * 1.1 * lm;
    this.sun.position.set(a.sunDir.x * 100, a.sunDir.y * 100, a.sunDir.z * 100);

    // Terrain shader.
    const tu = terrainMaterial().uniforms;
    (tu.uSunDir!.value as THREE.Vector3).copy(a.sunDir);
    (tu.uSunColor!.value as THREE.Color).copy(a.sunColor).multiplyScalar(a.sunI * lm);
    (tu.uHemiSky!.value as THREE.Color).copy(a.hemiSky).multiplyScalar(0.6 + 0.4 * lm);
    (tu.uHemiGround!.value as THREE.Color).copy(a.hemiGround);
    (tu.uFogColor!.value as THREE.Color).copy(this.fogColor);
    tu.uFogDensity!.value = this.fogDensity;

    this.sky.update(this.camera.position, a, this.fogColor, this.timeS);
    this.ocean.update(camX, camZ, this.timeS, a.sunColor, a.sunI, this.fogColor, this.fogDensity);
  }

  // ----- dev helpers -----------------------------------------------------------

  tp(x: number, z: number): void {
    if (this.world.isInterior) void this.world.exitInterior();
    this.player.spawnAt(x, z, this.player.yaw, this.world.query);
    this.warmup(x, z, 2000);
    this.world.update(x, z);
  }

  setHour(h: number): void {
    this.clock.set(this.clock.day, ((h % 24) + 24) % 24 * 60);
  }

  setWeather(kind: 'clear' | 'overcast' | 'rain' | 'ashstorm'): void {
    this.weather.force(kind);
  }

  stats(): Record<string, unknown> {
    const b = this.player.body;
    return {
      fps: Math.round(this.loop.fps),
      draws: this.renderer.drawCalls,
      tris: this.renderer.triangles,
      chunks: this.chunks.loadedCount,
      queued: this.streamer.pending,
      pos: `${b.x.toFixed(0)}, ${b.y.toFixed(1)}, ${b.z.toFixed(0)}`,
      mode: b.mode,
      hour: this.clock.hour.toFixed(2),
      biome: biomeAt(b.x, b.z),
    };
  }
}
