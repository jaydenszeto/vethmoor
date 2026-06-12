/**
 * Handcrafted town registry — the Morrowind soul layered onto procedural
 * terrain. Positions are world meters; the west edge (low x) is ocean.
 * Terrain flattens to plateauHeight inside `radius` (blend band outside it).
 */

import type { BiomeId, TownId } from './ids';
import { townId } from './ids';

export type TownStyle = 'fishing' | 'port' | 'market' | 'stilt' | 'mining' | 'nomad';
export type TownSize = 'village' | 'town' | 'city';

export interface TownDef {
  id: TownId;
  name: string;
  pos: readonly [number, number]; // world x, z (center plaza)
  radius: number; // flattened footprint
  plateauHeight: number; // terrain height inside footprint
  size: TownSize;
  style: TownStyle;
  biome: BiomeId;
  walled: boolean;
  dock: boolean;
  striderStation: boolean;
  tagline: string;
}

export const TOWNS: readonly TownDef[] = [
  {
    id: townId('saltmere'),
    name: 'Saltmere',
    pos: [1900, 9700],
    radius: 105,
    plateauHeight: 5,
    size: 'village',
    style: 'fishing',
    biome: 'coastalMarsh',
    walled: false,
    dock: true,
    striderStation: true,
    tagline: 'brine, gulls, and the smell of the writ that brought you here',
  },
  {
    id: townId('greyharbor'),
    name: 'Greyharbor',
    pos: [1450, 4300],
    radius: 150,
    plateauHeight: 9,
    size: 'city',
    style: 'port',
    biome: 'coastalMarsh',
    walled: true,
    dock: true,
    striderStation: true,
    tagline: "the Margrave's stone teeth against the western sea",
  },
  {
    id: townId('vornstead'),
    name: 'Vornstead',
    pos: [8900, 8100],
    radius: 120,
    plateauHeight: 24,
    size: 'town',
    style: 'market',
    biome: 'steppe',
    walled: false,
    dock: false,
    striderStation: true,
    tagline: 'where every road in the March crosses every other',
  },
  {
    id: townId('thornmoor'),
    name: 'Thornmoor',
    pos: [9800, 10700],
    radius: 95,
    plateauHeight: 4,
    size: 'village',
    style: 'stilt',
    biome: 'bittermarsh',
    walled: false,
    dock: false,
    striderStation: true,
    tagline: 'houses on heron legs above the bitter water',
  },
  {
    id: townId('kraghold'),
    name: 'Kraghold',
    pos: [8500, 5400],
    radius: 110,
    plateauHeight: 58,
    size: 'town',
    style: 'mining',
    biome: 'ashlands',
    walled: true,
    dock: false,
    striderStation: true,
    tagline: 'House Skarn picks duskglass from the mountain’s cooling veins',
  },
  {
    id: townId('veskar'),
    name: 'Veskar',
    pos: [5800, 3500],
    radius: 90,
    plateauHeight: 40,
    size: 'village',
    style: 'nomad',
    biome: 'ashlands',
    walled: false,
    dock: false,
    striderStation: true,
    tagline: 'bone-frame lodges leaning into the ash wind',
  },
];

export function townByIndex(i: number): TownDef {
  return TOWNS[i] as TownDef;
}
