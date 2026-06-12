# lessons

<!-- append a project-specific rule whenever something bites; read before related work -->

- Determinism is a save-compat contract: never edit `seedOf`/`sfc32`/noise lattice math after content exists on top of it. Structure-hash tests in `src/**/*.test.ts` are the tripwire — if one fails after a gen edit, the edit broke every save.
- No `Math.random` outside `src/ui/` — all simulation randomness flows through seeded `Sfc32` instances created from `seedOf(scope, ...nums)`. A grep test enforces this.
- Three.js objects (geometries, materials, textures) must be explicitly `.dispose()`d on chunk/cell teardown — GC does not reclaim GPU memory.
- `mergeGeometries` demands identical attribute sets across parts. All procedural models are vertex-colored with NO UVs — `primitives.merge()` strips uv/uv1; never rely on a geometry's default attributes matching.
- Buildings/walls only ever rotate in 90° steps so every static collider stays an axis-aligned AABB. Never place a rotated box collider.
- Never mutate shared/pooled geometry (e.g. bounds on instanced flora variants) — set instance-aware bounds on the InstancedMesh (`computeBoundingSphere()`).
- Anything gated on `input.uiOpen` is invisible while a window is up — when an in-world interaction "doesn't fire," check the uiMode stack before debugging the ray.
- Entities are materialized at TWO seams — towngen/dungeongen (exterior) and `WorldManager.materializeCellEntities` (interiors). Any per-entity data contract (npc identity, lock flags, loot tags) must be stamped at both, or interiors silently miss the feature.
- `PixelHeading` renders to canvas — CDP/DOM assertions must target buttons/spans, never heading text content.
- Per-NPC persistent state (disposition, merchant stock/gold) keys off `npcKey` (seed-path id) and serializes into the save `ext` blob — new runtime maps need restore-on-load AND clear-on-new-game or state leaks across games.
- `time:hour` only fires on hour boundaries; anything schedule-driven must also be applied explicitly after clock.set (new game / load) and on site load, or freshly loaded towns ignore the hour.
