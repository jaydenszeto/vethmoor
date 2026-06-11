# lessons

<!-- append a project-specific rule whenever something bites; read before related work -->

- Determinism is a save-compat contract: never edit `seedOf`/`sfc32`/noise lattice math after content exists on top of it. Structure-hash tests in `src/**/*.test.ts` are the tripwire — if one fails after a gen edit, the edit broke every save.
- No `Math.random` outside `src/ui/` — all simulation randomness flows through seeded `Sfc32` instances created from `seedOf(scope, ...nums)`. A grep test enforces this.
- Three.js objects (geometries, materials, textures) must be explicitly `.dispose()`d on chunk/cell teardown — GC does not reclaim GPU memory.
