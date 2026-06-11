# Vethmoor — project instructions

Browser open-world RPG (Daggerfall × Morrowind homage). TypeScript strict + Three.js + Vite; React + zustand for UI overlays ONLY. 100% procedural assets — no binary files, no font downloads, no asset packs. The full architecture/spec lives in the approved plan; key contracts below.

## Working loop

- Track work in `tasks/todo.md`; record ROOT CAUSES in its `# review` section as phases complete.
- Append hard-won rules to `tasks/lessons.md`; read it before related work.
- Docs + `npm run dev` run story + debug overlay observability are part of "done".

## Hard contracts (do not break)

- **Determinism**: world seed → `seedOf(scope, ...nums)` → `Sfc32`. Generators are pure `(seed, params) => output`. No `Math.random` outside `src/ui/`. Never change rng/noise math once content depends on it — structure-hash tests are the tripwire.
- **Sim/UI boundary**: React never touches Three objects or entities. Game → UI via typed events bridged into zustand; UI → Game via the frozen `GameAPI` object in `src/ui/store.ts`.
- **Pointer lock**: `src/engine/input.ts` is the single authority (uiMode stack). Never request/exit lock elsewhere.
- **Hot paths allocate nothing**: module-level scratch vectors, pooled projectiles/particles. Check `renderer.info` in the debug overlay after render changes.
- **Dispose GPU resources** on chunk/cell teardown.

## Design

- Design tokens live in `src/ui/theme.css`. Build on them; never hardcode colors/spacing in components.
- Aesthetic: **weathered grimoire** — ash-dark iron panels, verdigris edges, ember-orange accents, parchment reading surfaces, procedural 5×7 bitmap display font (`src/gen/pixelFont.ts`), serif manuscript body stack. Hard corners (`--radius: 0`), bevels via inset shadows. 3D look: 640×360 nearest-upscale, Bayer dither, heavy fog, blob shadows.
- Invoke `frontend-design` for any new UI surface. Verify rendered output with the chrome-devtools MCP (screenshot) before calling UI done.

## Commands

- `npm run dev` — dev server (vite, port 5173)
- `npm run typecheck` · `npm test` — must both be green before any commit
- Dev console helpers: `window.dbg = { tp, give, setHour, quest, kill, godmode, stats }` (dev builds only)

## Skill routing

UI work → `frontend-design` first. React patterns/review → `react-best-practices`. Library docs → context7 MCP before relying on memory. Verifying behavior in the running app → `verify` / chrome-devtools MCP.
