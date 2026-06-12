# todo — Vethmoor

Build phases per the approved plan (each ends runnable + verified + committed).

- [completed] P0 — Scaffold + toolchain proof (loop, 640×360 RT pipeline, menu shell, pointer lock)
- [completed] P1 — Walkable foggy world at dusk (noise, terrain streaming + LOD, capsule controller, sky/day-night, ocean)
- [completed] P2 — Living wilderness (6 biomes dressed, weather FSM, roads, POIs, audio beds; blob shadows deferred to P5 with actors)
- [completed] P3 — Towns, interiors, dungeons (towngen, load doors, room kit, dungeongen, interactables)
- [completed] P4 — Character, items, saves, core UI (chargen, inventory/paper-doll, HUD, IndexedDB saves)
- [completed] P5 — Combat, magic, AI, leveling (viewmodel, 8 enemies, 14 spells, use-based skills)
- [completed] P6 — Dialogue, barter, schedules, travel, alchemy (topic hyperlinks, merchants, dune-striders, books, rest/level-up rite)
- [completed] P7 — Quests, factions, journal, maps (main quest 10–70 + both endings, 3 factions ×4 authored quests + radiant duties, journal/map windows, Conclave portal)
- [completed] P8 — Polish, balance, music, ship (generative soundtrack with 5 crossfading states, post-ending climate bias persisted in saves, perf audit 104/88/62 draws vs 280 budget, README, scripted smoke flow with screenshots)

## hero moments (budgeted, restraint elsewhere)

1. Title screen: slow drift over fog-drowned terrain, ember-lit bitmap logo reveal with staggered letter entrance.
2. Load-door transitions: 200 ms ash-fade — the heartbeat of the Morrowind cell feel.
3. The first ash storm near The Ember Tooth: fog closes in, palette shifts, wind howls (weather as drama, not particle spam).

# review

<!-- root causes recorded here as phases complete -->

- P0–P1: vitest inline snapshots must be generated (`vitest run -u`), never hand-written — fabricated values fail and then get silently "fixed" into meaninglessness.
- P2: terrain road-grade limit could not be met by smoothing alone — A* paths take steep shortcuts; the fix was a forward/backward grade-clamping pass that guarantees the limit by construction.
- P3: `mergeGeometries` requires identical attribute sets — hand-built prisms (no UV) vs Box/Cylinder (UV) broke town merges. Root cause: implicit attribute contracts; fix: merge() strips UVs (all procedural models are vertex-colored).
- P3: interact ray failed silently when the pause stack was open (sim gated on uiOpen) — debugging UI-gated systems needs the gate state surfaced first (added dbg.closeUi).
- P4: pointer-lock requests fail under CDP automation and the resulting lock-loss pushed the pause menu in a loop. Root cause: lock policy assumed a human Esc; fix: `input.headless` flag that disables acquisition + pause-on-loss for verification runs.
- P5: melee hits missed short creatures — the vertical hit window was authored for humanoids. Root cause: hit volumes derived from attacker, not target proportions; widened to target-relative [y−0.7, y+h+1.0].
- P6: NPC dialogue identity (role/town/npcKey/name) initially existed only on towngen's exterior NPCs — interior staff are materialized on a second path (WorldManager.materializeCellEntities) and silently lacked it. Root cause: two entity-creation seams, one wired. Rule: stamp identity at every materialization point; the cell id (`int:<town>:<n>`) is the seam for deriving town + stable npcKey indoors.
- P7: `dbg.kill` set actor state to dead but skipped `onActorDeath`, so quest kill-triggers silently never fired under verification. Root cause: the real kill paths (combat/projectiles) call the death callback explicitly after `takeDamage`; any new damage source must do the same.
- P7: CDP page-level `import('/src/...')` returns a DIFFERENT module instance than the app's `?t=`-stamped HMR modules — state read through it is a phantom. Verify only through `window.dbg`/the UI.
- P7: starting a New Game while the previous session sat inside an interior left the world in interior mode under the fresh character — `finishChargen` now exits the cell first (loadSlot already did).
- P8: music state set before the AudioContext unlocks would never apply its gain ramps (setState early-returned but recorded the state). Root cause: conflating "requested state" with "applied state"; fix: separate `applied` tracker re-checked every update() so a late unlock catches up.
- P8: `weather.force` pinned the FSM forever (-2 sentinel never cleared) — fine for a dev helper, wrong once endings drive climate. Fix: forced weather owns only the current 3-hour slot; the post-ending `bias` reshapes the natural roll table instead.
