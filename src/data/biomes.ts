/**
 * Biome definitions — terrain amplitude, atmosphere and ground layers.
 * Flora/spawn tables join in P2/P5. Indexed by BIOME_ORDER for splat weights.
 */

import type { BiomeId } from './ids';

/** Ground texture array layers (see gen/textures.ts). */
export const GROUND = {
  grass: 0,
  dryGrass: 1,
  ash: 2,
  mud: 3,
  sand: 4,
  rock: 5,
  road: 6,
  fungalLoam: 7,
} as const;

export interface BiomeDef {
  id: BiomeId;
  name: string;
  /** fBm amplitude in meters. */
  amp: number;
  /** base elevation offset in meters. */
  base: number;
  /** FogExp2 density (clear weather). */
  fogDensity: number;
  /** Fog/atmosphere tint multiplied onto the sky horizon color. */
  fogTint: readonly [number, number, number];
  groundA: number;
  groundB: number;
  /** Ambient ground color fallback (minimap, etc.). */
  mapColor: number;
}

export const BIOME_ORDER: readonly BiomeId[] = [
  'coastalMarsh',
  'steppe',
  'fungalForest',
  'bittermarsh',
  'ashlands',
  'badlands',
];

export const BIOMES: Record<BiomeId, BiomeDef> = {
  coastalMarsh: {
    id: 'coastalMarsh',
    name: 'Coastal Marsh',
    amp: 7,
    base: 4,
    fogDensity: 0.0035,
    fogTint: [0.82, 0.93, 0.92],
    groundA: GROUND.mud,
    groundB: GROUND.grass,
    mapColor: 0x4a5d4e,
  },
  steppe: {
    id: 'steppe',
    name: 'Grey Steppe',
    amp: 19,
    base: 14,
    fogDensity: 0.0028,
    fogTint: [0.95, 0.97, 0.9],
    groundA: GROUND.dryGrass,
    groundB: GROUND.grass,
    mapColor: 0x6a6f52,
  },
  fungalForest: {
    id: 'fungalForest',
    name: 'Fungal Forest',
    amp: 24,
    base: 18,
    fogDensity: 0.004,
    fogTint: [0.78, 0.88, 0.8],
    groundA: GROUND.fungalLoam,
    groundB: GROUND.mud,
    mapColor: 0x575c4a,
  },
  bittermarsh: {
    id: 'bittermarsh',
    name: 'Bittermarsh',
    amp: 8,
    base: 3,
    fogDensity: 0.0045,
    fogTint: [0.72, 0.82, 0.74],
    groundA: GROUND.mud,
    groundB: GROUND.fungalLoam,
    mapColor: 0x44503f,
  },
  ashlands: {
    id: 'ashlands',
    name: 'Ashlands',
    amp: 26,
    base: 26,
    fogDensity: 0.005,
    fogTint: [0.85, 0.78, 0.72],
    groundA: GROUND.ash,
    groundB: GROUND.rock,
    mapColor: 0x5c5651,
  },
  badlands: {
    id: 'badlands',
    name: 'Volcanic Badlands',
    amp: 40,
    base: 40,
    fogDensity: 0.0055,
    fogTint: [0.8, 0.68, 0.6],
    groundA: GROUND.rock,
    groundB: GROUND.ash,
    mapColor: 0x4f433c,
  },
};
