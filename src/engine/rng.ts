/**
 * Deterministic randomness — the save-compatibility contract.
 *
 * FROZEN: the numeric behavior of xmur3, mix32, hash2, seedOf and Sfc32 must
 * never change once world content exists on top of them. Snapshot tests in
 * rng.test.ts pin exact outputs; if one fails after an edit, the edit broke
 * every existing save and every authored placement.
 *
 * Convention: every generator is a pure function (seed, params) => output that
 * creates its own local Sfc32. No Math.random outside src/ui/.
 */

/** xmur3 string hash — produces a stream of well-mixed 32-bit seeds from a string. */
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** murmur3 finalizer — full-avalanche mix of a 32-bit value. */
export function mix32(n: number): number {
  let h = n | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Fast 2D lattice hash → uint32. Hot path for noise; keep allocation-free. */
export function hash2(x: number, y: number, seed: number): number {
  let h = (seed | 0) ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/** hash2 as float in [0, 1). */
export function hash2f(x: number, y: number, seed: number): number {
  return hash2(x, y, seed) / 4294967296;
}

let masterSeed = 0;
let worldSeedStr = '';

/** Set once at world creation / save load, before any generation runs. */
export function setWorldSeed(seedStr: string): void {
  worldSeedStr = seedStr;
  masterSeed = xmur3(seedStr)();
}

export function getWorldSeedStr(): string {
  return worldSeedStr;
}

/**
 * Derive a stable 32-bit seed for a named scope + integer coordinates.
 * Examples: seedOf('chunk-flora', cx, cz), seedOf('dungeon', index),
 * seedOf('town-npc', townIndex, lotIndex). Numbers are truncated to int32.
 */
export function seedOf(scope: string, ...nums: number[]): number {
  // FNV-1a over the scope string.
  let h = 0x811c9dc5;
  for (let i = 0; i < scope.length; i++) {
    h ^= scope.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h = mix32(h ^ masterSeed);
  for (let i = 0; i < nums.length; i++) {
    h = mix32(h ^ mix32(((nums[i] as number) | 0) + 0x9e3779b9 + i));
  }
  return h >>> 0;
}

/** sfc32 — small fast counter PRNG. Good quality, 128-bit state, deterministic. */
export class Sfc32 {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    this.a = mix32(seed ^ 0x9e3779b9);
    this.b = mix32(seed ^ 0x85ebca6b);
    this.c = mix32(seed ^ 0xc2b2ae35);
    this.d = (seed >>> 0) || 0x1f123bb5;
    for (let i = 0; i < 8; i++) this.next(); // warm up state mixing
  }

  /** Next uint32. */
  next(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Float in [0, 1). */
  float(): number {
    return this.next() / 4294967296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.float() * (max - min);
  }

  /** Integer in [min, maxIncl] (both inclusive). */
  int(min: number, maxIncl: number): number {
    return min + (this.next() % (maxIncl - min + 1 || 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.float() < p;
  }

  /** Uniform pick. Array must be non-empty. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.next() % arr.length] as T;
  }

  /** Weighted pick: weights parallel to items, sum > 0. */
  pickWeighted<T>(items: readonly T[], weights: readonly number[]): T {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i] as number;
    let roll = this.float() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i] as number;
      if (roll <= 0) return items[i] as T;
    }
    return items[items.length - 1] as T;
  }

  /** Approximate gaussian in [-1, 1] (sum of 3, centered). */
  gauss(): number {
    return (this.float() + this.float() + this.float()) / 1.5 - 1;
  }

  /** In-place Fisher–Yates shuffle. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.next() % (i + 1);
      const tmp = arr[i] as T;
      arr[i] = arr[j] as T;
      arr[j] = tmp;
    }
    return arr;
  }
}
