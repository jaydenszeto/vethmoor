/**
 * Game orchestrator: owns the loop, renderer, world systems and mode state.
 * P1: streamed terrain, day/night atmosphere, ocean, first-person player.
 */

import * as THREE from 'three';
import { installAudioUnlock } from '@/audio/engine';
import { Ambience } from '@/audio/ambience';
import {
  arrowImpact,
  bowRelease,
  castDud,
  castWhoosh,
  enemyDie,
  footstep,
  hurtGrunt,
  landThump,
  meleeHit,
  spellImpact,
  swingWhoosh,
  type Surface,
} from '@/audio/sfx';
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
  applyLevelUp as applyLevelUpStats,
  createCharacter,
  maxCarry,
  recalcDerived,
  regenTick,
  levelUpReady,
  walkSpeed,
  type BirthStone,
  type Character,
} from '@/systems/stats';
import { bumpSkill, trackTravel } from '@/systems/skills';
import { linkedTopics, topicText, visibleTopics, type NpcIdentity } from '@/systems/dialogue';
import {
  getDisposition,
  persuade as persuadeNpc,
  restoreDispositions,
  serializeDispositions,
  type PersuadeKind,
} from '@/systems/disposition';
import {
  buyFrom,
  buyPrice,
  merchantState,
  restoreMerchants,
  sellPrice,
  sellTo,
  serializeMerchants,
  type MerchantState,
} from '@/systems/barter';
import { brew } from '@/systems/alchemy';
import { BOOK_TEXTS } from '@/data/books';
import { TOPICS, type GameView } from '@/data/topics';
import { skillName, type AttrId } from '@/data/skillsDef';
import type { NpcRole } from '@/gen/models/humanoid';
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
import { PlayerCombat, applyPlayerDamage } from '@/systems/combat';
import { Effects } from '@/systems/magic';
import { Projectiles } from '@/systems/projectiles';
import { SpawnManager } from '@/systems/spawns';
import type { ActorContext, EnemyActor } from '@/entities/actor';
import { enemyId, type SpellId } from '@/data/ids';
import { ViewModel } from '@/render/viewmodel';
import { BlobShadows } from '@/render/blobShadow';
import { itemDef } from '@/data/items';
import { TOWNS } from '@/data/towns';

const MENU_HOUR = 18.15;
const SPAWN = { x: 1825, z: 9745, yaw: -Math.PI * 0.38 };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

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

  // Combat stack.
  readonly combat = new PlayerCombat();
  readonly effects = new Effects();
  readonly projectiles = new Projectiles();
  readonly spawns = new SpawnManager();
  private viewModel!: ViewModel;
  private blobShadows!: BlobShadows;
  private casterLight = new THREE.PointLight(0xffd9a0, 0, 16, 1.6);
  private shakeT = 0;
  private deadT = 0;
  private actorCtx!: ActorContext;

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
      // Actors don't cross cell boundaries.
      this.spawns.clearAll();
      if (cell) this.spawns.populateCell(cell, this.world.query);
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
    this.world.onNpcTalk = (e) => this.openDialogue(e);
    this.world.onTravel = (e) => this.openTravel(e);
    events.on('time:hour', ({ hour }) => this.world.applySchedules(hour));

    events.on('input:hotkey', ({ slot }) => {
      if (this.mode !== 'play') return;
      if (slot === -1) void this.saveSlot('quick', 'Quicksave');
      else if (slot === -2) void this.loadSlot('quick');
      else if (slot >= 1 && slot <= 8 && this.character) {
        const id = this.character.hotkeys[slot - 1];
        if (id) {
          this.combat.readySpell(id as SpellId);
          events.emit('toast', { text: `Readied: ${id}`, kind: 'info' });
        }
      }
    });

    events.on('summon:request', ({ duration }) => {
      const b = this.player.body;
      const a = this.spawns.spawn(
        enemyId('skeleton-warden'),
        b.x + Math.sin(this.player.yaw) * -2,
        b.z + Math.cos(this.player.yaw) * -2,
        this.world.query,
        `summon:${Math.floor(this.timeS * 10)}`,
        true,
      );
      a.ttl = duration;
    });

    this.viewModel = new ViewModel(this.camera);
    this.blobShadows = new BlobShadows();
    this.scene.add(this.camera, this.projectiles.group, this.spawns.group, this.blobShadows.group, this.casterLight);

    this.actorCtx = {
      q: this.world.query,
      playerX: 0,
      playerY: 0,
      playerZ: 0,
      stealthFactor: 1,
      hurtPlayer: (dmg) => this.hurtPlayer(dmg),
      fireBolt: (x, y, z, tx, ty, tz, dmg) => {
        this.projectiles.fire('bolt', true, x, y, z, tx - x, ty - y, tz - z, 16, dmg, 0, 0xff7030);
      },
      nearestEnemy: (x, z, range) => this.spawns.nearestEnemy(x, z, range),
      onDeath: (a) => this.onActorDeath(a),
      timeS: 0,
    };

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
    restoreDispositions({});
    restoreMerchants({});
    this.clock.set(1, NEW_GAME_HOUR * 60);
    this.world.applySchedules(Math.floor(this.clock.hour));
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
      ext: {
        killed: this.spawns.serialize(),
        disp: serializeDispositions(),
        merchants: serializeMerchants(),
      },
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
    // Pre-P6 saves predate dialogue/book tracking.
    this.character.topicsKnown ??= [];
    this.character.booksRead ??= [];
    recalcDerived(this.character);
    restoreContainers(save.containers);
    this.spawns.restore((save.ext.killed as string[] | undefined) ?? []);
    restoreDispositions((save.ext.disp as Record<string, number> | undefined) ?? {});
    restoreMerchants((save.ext.merchants as Record<string, MerchantState> | undefined) ?? {});
    this.effects.clear();
    this.combat.readySpell(null);
    this.clock.set(save.clock.day, save.clock.minOfDay);
    this.world.applySchedules(Math.floor(this.clock.hour));
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

          // ----- combat stack -----
          this.effects.tick(dt);
          // Skyward levitation.
          if (this.effects.skyward && b.mode === 'walk') b.mode = 'levitate';
          else if (!this.effects.skyward && b.mode === 'levitate') b.mode = 'walk';

          this.combat.update(dt, {
            player: this.player,
            c,
            actors: this.spawns.actors,
            projectiles: this.projectiles,
            effects: this.effects,
            isExterior: !this.world.isInterior,
            onKill: (a) => this.onActorDeath(a),
            playSfx: (kind) => {
              if (kind === 'whoosh') swingWhoosh();
              else if (kind === 'hit') meleeHit();
              else if (kind === 'bow') bowRelease();
              else if (kind === 'cast') castWhoosh();
              else castDud();
            },
            teleport: (x, z) => this.tp(x, z),
          });

          // Actors.
          const ctx = this.actorCtx;
          ctx.playerX = b.x;
          ctx.playerY = b.y;
          ctx.playerZ = b.z;
          ctx.timeS = this.timeS;
          const sneakBase = this.player.sneaking ? Math.max(0.3, 0.55 - c.skills.sneak * 0.002) : 1;
          ctx.stealthFactor = sneakBase * this.effects.stealthMult * (this.atmo.nightAmt > 0.5 ? 0.75 : 1);
          for (const a of this.spawns.actors) a.update(dt, ctx);
          this.spawns.cull(b.x, b.z, !this.world.isInterior);
          if (!this.world.isInterior) {
            this.spawns.updateExterior(dt, b.x, b.z, this.world.query, this.clock.day);
          }

          // Projectiles.
          this.projectiles.tick(dt, {
            q: this.world.query,
            actors: this.spawns.actors,
            playerX: b.x,
            playerY: b.y,
            playerZ: b.z,
            hurtPlayer: (dmg) => this.hurtPlayer(dmg),
            hurtActor: (a, dmg, fx, fz) => {
              a.takeDamage(dmg, fx, fz);
              events.emit('hud:target', { name: a.def.name, frac: Math.max(0, a.hp / a.def.hp) });
              if (!a.alive) this.onActorDeath(a);
            },
            impact: (_x, _y, _z, kind) => (kind === 'arrow' ? arrowImpact() : spellImpact()),
          });

          // Death.
          if (c.hp <= 0 && this.mode === 'play') this.die();
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
    } else if (this.mode === 'dead') {
      this.deadT += dt;
      if (this.deadT > 3.2) this.respawn();
    }
    input.postSimClear();
  };

  // ----- combat callbacks ---------------------------------------------------------

  private hurtPlayer(raw: number): void {
    const c = this.character;
    if (!c || this.mode !== 'play') return;
    const died = applyPlayerDamage(c, this.effects, raw, c.equipment.shield !== null);
    hurtGrunt();
    this.shakeT = 0.3;
    this.pushHudStats();
    if (died) this.die();
  }

  private onActorDeath(a: EnemyActor): void {
    enemyDie(a.def.voice);
    this.spawns.onDeath(a, (ent) => {
      ent.onInteract = () => this.world.onContainerOpen?.(ent);
      this.world.dynamicEntities.push(ent);
    });
    events.emit('hud:target', { name: null, frac: 0 });
  }

  private die(): void {
    this.deadT = 0;
    this.setMode('dead');
    events.emit('toast', { text: 'The March takes another.', kind: 'warn' });
  }

  private respawn(): void {
    const c = this.character;
    if (!c) return;
    // Nearest town's temple takes you in.
    const b = this.player.body;
    let best = TOWNS[0]!;
    let bestD = Infinity;
    for (const t of TOWNS) {
      const d = Math.hypot(b.x - t.pos[0], b.z - t.pos[1]);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    c.hp = Math.round(c.hpMax * 0.5);
    c.fat = Math.round(c.fatMax * 0.25);
    c.mp = Math.round(c.mpMax * 0.5);
    if (this.world.isInterior) void this.world.exitInterior();
    this.player.spawnAt(best.pos[0] + 6, best.pos[1] + 6, 0, this.world.query);
    this.warmup(best.pos[0], best.pos[1], 1200);
    this.world.update(best.pos[0], best.pos[1]);
    this.setMode('play');
    this.pushHudStats();
    events.emit('toast', { text: `You wake at the temple in ${best.name}.`, kind: 'quest' });
  }

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

  // ----- dialogue ----------------------------------------------------------------

  /** Live dialogue session (null when the window is closed). */
  private dlg: { npc: NpcIdentity; log: { topic: string | null; text: string }[] } | null = null;

  private gameView(): GameView {
    return { day: this.clock.day, hour: this.clock.hour, questStage: () => 0 };
  }

  private npcIdentityOf(e: Entity): NpcIdentity {
    return {
      key: (e.data.npcKey as string) ?? (e.id as string),
      name: (e.data.name as string) ?? e.prompt ?? 'Stranger',
      role: (e.data.role as NpcRole) ?? 'villager',
      town: (e.data.town as string) ?? null,
    };
  }

  openDialogue(e: Entity): void {
    if (!this.character || this.mode !== 'play') return;
    const npc = this.npcIdentityOf(e);
    this.dlg = { npc, log: [] };
    const greet = topicText(npc, 'greeting', this.gameView()) ?? '“…”';
    this.appendDialogue(null, greet);
    input.pushMode('dialogue');
    this.pushDialogueState();
  }

  /** Add a line to the log; topics linked in it become known (Morrowind rule). */
  private appendDialogue(topic: string | null, text: string): void {
    const dlg = this.dlg;
    const c = this.character;
    if (!dlg || !c) return;
    dlg.log.push({ topic, text });
    for (const id of linkedTopics(text)) {
      if (!c.topicsKnown.includes(id)) {
        c.topicsKnown.push(id);
        const kw = TOPICS.find((t) => t.id === id)?.keyword ?? id;
        events.emit('toast', { text: `Topic noted: ${kw}`, kind: 'quest' });
      }
    }
  }

  private pushDialogueState(): void {
    const dlg = this.dlg;
    const c = this.character;
    if (!dlg || !c) return;
    const ids = visibleTopics(dlg.npc, c.topicsKnown, this.gameView());
    events.emit('dialogue:state', {
      npcKey: dlg.npc.key,
      name: dlg.npc.name,
      role: dlg.npc.role,
      disposition: getDisposition(dlg.npc.key),
      log: [...dlg.log],
      topics: ids.map((id) => ({ id, keyword: TOPICS.find((t) => t.id === id)?.keyword ?? id })),
      canBarter: dlg.npc.role === 'trader' || dlg.npc.role === 'innkeep' || dlg.npc.role === 'priest',
    });
  }

  chooseTopic(topicId: string): void {
    const dlg = this.dlg;
    const c = this.character;
    if (!dlg || !c) return;
    if (!c.topicsKnown.includes(topicId)) c.topicsKnown.push(topicId);
    const text =
      topicText(dlg.npc, topicId, this.gameView()) ??
      `${dlg.npc.name} shrugs. “Couldn’t tell you. Ask around.”`;
    this.appendDialogue(topicId, text);
    this.pushDialogueState();
  }

  persuadeWith(kind: PersuadeKind): void {
    const dlg = this.dlg;
    const c = this.character;
    if (!dlg || !c) return;
    const r = persuadeNpc(c, dlg.npc.key, kind);
    this.dlg?.log.push({ topic: null, text: `— ${r.line}` });
    this.pushDialogueState();
    this.pushHudStats();
  }

  // ----- barter ------------------------------------------------------------------

  openBarter(): void {
    if (!this.dlg) return;
    input.pushMode('barter'); // stacked over dialogue; closing returns to talk
    this.pushBarterState(null);
  }

  private pushBarterState(line: string | null): void {
    const dlg = this.dlg;
    const c = this.character;
    if (!dlg || !c) return;
    const m = merchantState(dlg.npc.key, dlg.npc.role, this.clock.day);
    const disp = getDisposition(dlg.npc.key);
    const sp = c.skills.speechcraft;
    events.emit('barter:state', {
      npcKey: dlg.npc.key,
      name: dlg.npc.name,
      merchantGold: m.gold,
      playerGold: c.gold,
      stock: m.stock.map((s) => ({
        id: s.id as string,
        n: s.n,
        price: buyPrice(itemDef(s.id).value, disp, sp),
      })),
      goods: c.inventory.map((s) => ({
        id: s.id as string,
        n: s.n,
        price: sellPrice(itemDef(s.id).value, disp, sp),
      })),
      line,
    });
  }

  barterBuy(id: Parameters<typeof itemDef>[0]): void {
    const dlg = this.dlg;
    const c = this.character;
    if (!dlg || !c) return;
    const r = buyFrom(c, dlg.npc.key, dlg.npc.role, this.clock.day, id);
    this.pushBarterState(r.line);
    this.pushHudStats();
  }

  barterSell(id: Parameters<typeof itemDef>[0]): void {
    const dlg = this.dlg;
    const c = this.character;
    if (!dlg || !c) return;
    const r = sellTo(c, dlg.npc.key, dlg.npc.role, this.clock.day, id);
    this.pushBarterState(r.line);
    this.pushHudStats();
  }

  // ----- travel ------------------------------------------------------------------

  openTravel(e: Entity): void {
    if (this.mode !== 'play') return;
    const from = TOWNS.find((t) => (t.id as string) === (e.data.travel as string));
    if (!from) return;
    const options = TOWNS.filter((t) => t.striderStation && t.id !== from.id).map((t) => {
      const km = Math.hypot(t.pos[0] - from.pos[0], t.pos[1] - from.pos[1]) / 1000;
      return {
        id: t.id as string,
        name: t.name,
        km: Math.round(km * 10) / 10,
        fare: Math.round(10 + 4 * km),
        hours: Math.max(1, Math.round(km / 1.5)),
        tagline: t.tagline,
      };
    });
    input.pushMode('travel');
    events.emit('travel:open', { from: from.name, options });
  }

  async travelTo(townId: string): Promise<void> {
    const c = this.character;
    const t = TOWNS.find((x) => (x.id as string) === townId);
    if (!c || !t || this.mode !== 'play') return;
    const b = this.player.body;
    const km = Math.hypot(t.pos[0] - b.x, t.pos[1] - b.z) / 1000;
    const fare = Math.round(10 + 4 * km);
    const hours = Math.max(1, Math.round(km / 1.5));
    if (c.gold < fare) {
      events.emit('toast', { text: `The fare is ${fare} gold. Your purse says no.`, kind: 'warn' });
      return;
    }
    c.gold -= fare;
    input.clearModes();
    events.emit('screen:fade', { on: true });
    await sleep(220);
    this.clock.skipHours(hours); // emits time:hour → schedules follow
    // Arrive just inside the destination's strider platform (same angle math
    // as towngen: stations face the volcano).
    const ang = Math.atan2(t.pos[1] - VOLCANO_Z, t.pos[0] - VOLCANO_X) + Math.PI;
    const ax = t.pos[0] + Math.cos(ang) * (t.radius - 14);
    const az = t.pos[1] + Math.sin(ang) * (t.radius - 14);
    this.tp(ax, az);
    await sleep(80);
    events.emit('screen:fade', { on: false });
    events.emit('toast', {
      text: `${hours} swaying hours on the strider’s back. ${t.name}.`,
      kind: 'quest',
    });
    events.emit('char:changed', {});
    this.pushHudStats();
    void this.saveSlot('auto', 'Autosave');
  }

  // ----- rest + level-up -----------------------------------------------------------

  canRest(): { ok: boolean; reason: string } {
    const b = this.player.body;
    if (b.mode === 'swim') return { ok: false, reason: 'The sea is no bed.' };
    if (this.spawns.nearestEnemy(b.x, b.z, 28)) {
      return { ok: false, reason: 'Something hostile is too close to sleep through.' };
    }
    return { ok: true, reason: '' };
  }

  rest(hours: number): void {
    const c = this.character;
    if (!c || this.mode !== 'play') return;
    const gate = this.canRest();
    if (!gate.ok) {
      events.emit('toast', { text: gate.reason, kind: 'warn' });
      input.popMode();
      return;
    }
    const h = clamp(Math.round(hours), 1, 24);
    for (let i = 0; i < h; i++) {
      c.hp = Math.min(c.hpMax, c.hp + 1 + c.attrs.end / 20);
      c.mp = Math.min(c.mpMax, c.mp + c.mpMax / 8);
    }
    c.hp = Math.round(c.hp);
    c.mp = Math.round(c.mp);
    c.fat = c.fatMax;
    this.clock.skipHours(h);
    input.popMode();
    if (levelUpReady(c)) {
      input.pushMode('levelup');
    } else {
      events.emit('toast', { text: `You rest ${h} hour${h > 1 ? 's' : ''}.`, kind: 'info' });
    }
    events.emit('char:changed', {});
    this.pushHudStats();
    void this.saveSlot('auto', 'Autosave');
  }

  applyLevelUpPicks(picks: readonly [string, string, string]): void {
    const c = this.character;
    if (!c || !levelUpReady(c)) return;
    if (new Set(picks).size !== 3) return;
    applyLevelUpStats(c, picks as unknown as readonly [AttrId, AttrId, AttrId]);
    input.popMode();
    events.emit('toast', { text: `You are now level ${c.level}.`, kind: 'quest' });
    events.emit('char:changed', {});
    this.pushHudStats();
  }

  // ----- books + alchemy ------------------------------------------------------------

  readBook(id: Parameters<typeof itemDef>[0]): void {
    const c = this.character;
    if (!c) return;
    const meta = itemDef(id).book;
    if (!meta) return;
    const bt = BOOK_TEXTS.find((t) => t.id === meta.textId);
    if (!bt) return;
    let note: string | null = null;
    if (!c.booksRead.includes(id as string)) {
      c.booksRead.push(id as string);
      if (meta.teaches && bumpSkill(c, meta.teaches)) {
        note = `The pages teach — ${skillName(meta.teaches)} +1.`;
      }
      events.emit('char:changed', {});
    }
    input.pushMode('book');
    events.emit('book:open', { title: bt.title, text: bt.text, note });
  }

  brewPotion(ids: Parameters<typeof itemDef>[0][]): string {
    const c = this.character;
    if (!c) return '';
    const r = brew(c, ids);
    events.emit('char:changed', {});
    this.pushHudStats();
    return r.line;
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
      let eyeY = this.player.eyeY(alpha);
      // Hit shake + death slump.
      this.shakeT = Math.max(0, this.shakeT - 1 / 144);
      if (this.shakeT > 0) {
        camX += Math.sin(this.timeS * 70) * 0.04 * this.shakeT;
        eyeY += Math.cos(this.timeS * 90) * 0.03 * this.shakeT;
      }
      if (this.mode === 'dead') {
        eyeY = Math.max(this.player.body.y + 0.4, eyeY - this.deadT * 0.6);
      }
      this.camera.position.set(camX, eyeY, camZ);
      this.camera.rotation.set(0, 0, 0);
      this.camera.rotateY(this.player.yaw);
      this.camera.rotateX(this.player.pitch);
      if (this.mode === 'dead') this.camera.rotateZ(Math.min(this.deadT * 0.4, 0.5));

      // Viewmodel + caster light + actor shadows.
      const c = this.character;
      if (c) {
        this.viewModel.setWeapon(c.equipment.weapon, this.effects.boundBladeDmg > 0);
        const isBow = c.equipment.weapon ? (itemDef(c.equipment.weapon).weapon?.ranged ?? false) : false;
        this.viewModel.update(1 / 144, this.combat.pose, this.combat.poseT, this.combat.chargeT, this.player.bobPhase, isBow);
      }
      this.casterLight.intensity = this.effects.lightOn ? 26 : 0;
      this.casterLight.position.set(camX, this.camera.position.y + 0.4, camZ);
      this.blobShadows.sync(this.spawns.actors, this.world.query);
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
