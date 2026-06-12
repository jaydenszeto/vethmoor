# todo — Vethmoor

Build phases per the approved plan (each ends runnable + verified + committed).

- [completed] P0 — Scaffold + toolchain proof (loop, 640×360 RT pipeline, menu shell, pointer lock)
- [completed] P1 — Walkable foggy world at dusk (noise, terrain streaming + LOD, capsule controller, sky/day-night, ocean)
- [completed] P2 — Living wilderness (6 biomes dressed, weather FSM, roads, POIs, audio beds; blob shadows deferred to P5 with actors)
- [completed] P3 — Towns, interiors, dungeons (towngen, load doors, room kit, dungeongen, interactables)
- [pending] P4 — Character, items, saves, core UI (chargen, inventory/paper-doll, HUD, IndexedDB saves)
- [pending] P5 — Combat, magic, AI, leveling (viewmodel, 8 enemies, 14 spells, use-based skills)
- [pending] P6 — Dialogue, barter, schedules, travel, alchemy (topic hyperlinks, merchants, dune-striders)
- [pending] P7 — Quests, factions, journal, maps (main quest 10–70, 3 factions, radiant duties)
- [pending] P8 — Polish, balance, music, ship (generative soundtrack, title flourish, perf audit, README, smoke flow)

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
