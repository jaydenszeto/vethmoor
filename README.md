# VETHMOOR — The Ashen March

A browser open-world RPG in the spirit of **Daggerfall** and **Morrowind**: a 12 km² seeded
continent you can walk every meter of, topic-hyperlink dialogue, use-based skills, joinable
factions, load-door dungeons, dune-strider caravans, and a main quest that ends with a choice
the sky remembers.

**Every asset is procedural.** There are no model files, no textures, no fonts, no audio
files — the whole world (meshes, ground atlas, bitmap display font, books, soundtrack) is
synthesized from code and one seed string at boot.

## Quick start

Needs [Node.js](https://nodejs.org) 20+. Then:

```bash
git clone https://github.com/jaydenszeto/vethmoor.git
cd vethmoor
npm install
npm start          # builds nothing, opens http://localhost:5173 in your browser
```

That's it — `npm start` launches the dev server and pops the game open in your default
browser. (`npm run dev` does the same without auto-opening.) Click the canvas to capture the
mouse, roll a character, and walk out the gate.

`npm run typecheck` and `npm test` (62 tests) must both be green before any commit.

---

## The pitch

Beneath the volcano called the **Ember Tooth** sleeps **Ulmoth, the Drowned King**, whose
dreaming ash makes Vethmoor's grotesque life possible. The dreams are curdling. You arrive
as a *writ-bearer* — a pardoned exile whose pardon was always a summons — and the dying seer
of Saltmere needs someone who can walk where she only dreamt. The main quest runs from a
sealed writ to the **Drowned Throne**, where you either **sever** the dream (end the storms,
end the wonder) or **re-bind** the sleeper (keep the wonder, and what it costs). The weather
carries your verdict for the rest of the save.

- **6 towns** — Saltmere, Greyharbor, Vornstead, Thornmoor, Kraghold, Veskar — each with
  load-door interiors, schedules (shops lock at 20:00, villagers sleep), merchants, an inn.
- **15 dungeons** in 4 themes (crypt / mine / cave / ruin), 3 hand-authored: the Smugglers'
  Cave, the Weeping Barrow, the Undertooth.
- **3 joinable factions** — the Iron Vigil, the Cindral Conclave, House Skarn — 5 ranks each,
  4 authored quests each, seeded radiant duties (bounty / harvest / delivery), rank-based
  disposition bonuses, and Conclave hall portals for members.
- **9 enemies** with FSM AI (chase, flee, flying dive-bombs, casters that keep distance),
  ending in the 350 HP Herald of the Drowned King.
- **14 spells** across five schools, including `Skyward` (levitation is non-negotiable),
  Mark/Recall, summons and a bound blade.
- **~130 items** in five material tiers (iron → voidstone), 16 alchemy ingredients with
  skill-gated effect reveal, 10 fully written books (3 lore, 7 skill-teaching).

## Controls

| Input | Action |
|---|---|
| WASD / mouse | move / look (pointer lock) |
| LMB hold–release | charged melee attack / bow draw |
| RMB | cast the readied spell |
| E | interact (doors, NPCs, chests, pedestals, thrones) |
| Space / Shift / C | jump / sprint / sneak |
| Tab or I · V · K | inventory · character sheet · spellbook |
| J · M | journal (quests/factions/topics) · map (world / local automap) |
| T · B | rest (heals, levels you up) · alchemy bench |
| 1–8 | spell hotkeys · F5 / F9 quicksave / quickload |
| Esc | pause |

## Architecture (src/)

```
engine/   fixed 60 Hz loop · typed event bus · pointer-lock input authority (uiMode stack)
          seeded rng (xmur3→seedOf→sfc32, FROZEN) · capsule collision · IndexedDB saves
render/   640×360 render target → nearest blit + 4×4 Bayer dither + vignette · sky dome
          day/night atmosphere · weather FSM (+ post-ending climate bias) · viewmodel
world/    worldHeight(x,z): ONE continuous seeded function (biome fBm → volcano → town
          plateaus → road carve) — seams are impossible by construction · chunk streaming
          with LOD rings + edge skirts · WorldManager: the exterior↔interior spine
gen/      noise · canvas texgen → ground atlas · 5×7 bitmap font · towngen · dungeongen
          (room graphs, structure-hash tested) · humanoid/creature/weapon mesh generators
systems/  stats (Daggerfall-style attrs/skills, use-based XP) · combat · magic · AI spawns
          dialogue (topic scope ranking: npc > role+town > role > town > generic) ·
          disposition/persuasion · barter · alchemy · quests (forward-only stage machine)
          factions (ranks, rep, seeded radiant duties)
audio/    WebAudio synthesis only: footsteps, combat, biome ambience beds, and a seeded
          generative soundtrack (drone + FM bells + combat pulse; explore/night/dungeon/
          combat/menu states crossfade on one voice set)
data/     branded-ID typed content: items, enemies, spells, towns, dungeons, topics
          (~40 quest-wired defs with conds + effects), quests, factions, books
ui/       React + zustand overlays ONLY — sim→UI via typed events bridged into the store,
          UI→sim via the frozen GameAPI. React never touches Three objects or entities.
```

### The two contracts that hold it together

1. **Determinism.** World seed string → `seedOf(scope, ...nums)` → `Sfc32`. Every generator
   is a pure `(seed, params) => output`. `Math.random` is banned outside `src/ui/` by a
   comment-stripping grep test; town and dungeon layouts are pinned by structure-hash
   snapshots. Saves store *diffs only* (killed spawns, container deltas, quest/faction
   state, dispositions, merchant stock, map discovery) — the world itself is regenerated.
2. **The sim/UI boundary.** One doorway each direction: typed events into zustand, the
   frozen `GameAPI` back. Pointer lock has a single authority (`engine/input.ts`).

## Verification

- `npm test` — 62 unit tests: rng/seedOf snapshots, terrain continuity + road grade,
  structure hashes, character/combat math, barter inequalities, alchemy matching, dialogue
  scope/cond gating, quest machine transitions, radiant determinism, save round-trips.
- In-browser smoke (Chrome DevTools MCP): every phase was verified live — chargen,
  streaming walk, dialogue hyperlink learning, admire→price drop, night schedules, strider
  travel, brewing, skill books, rest→level-up, the full main quest to both endings, journal,
  world map and save/reload state matches. `window.dbg` (dev builds only) exposes
  `tp / give / spawn / kill / setHour / setWeather / quest / godmode / headless / stats`.
- Perf at the stress points (M-series, budget ≤280 draws / ≤450k tris @ 60 fps):
  town-at-dusk-in-rain **104 draws / 128k tris**, fungal wilderness **88 / 95k**, volcano
  ash storm **62 / 66k** — all at the 120 fps cap.

## v1.5 roadmap (deliberate v1 cuts)

- Crime & bounty (theft, witnesses, guards that arrest rather than ignore)
- Item condition + repair hammers
- Escort radiant template (pathful NPC followers)
- Shadow maps (the blob-shadow look is a choice, but a toggle would be kind)
- NPC cross-country pathfinding (chase is steering-based)
- Spellmaking and enchanting at Conclave halls
- Lore month names on the clock, holiday schedules

---

*Vethmoor is original IP — an homage to the Bethesda classics, sharing zero proper nouns
with them. Tend the fire. Tend the sleeper.*
