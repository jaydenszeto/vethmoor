import { beforeAll, describe, expect, it } from 'vitest';
import { Sfc32, hash2, mix32, seedOf, setWorldSeed, xmur3 } from './rng';

describe('rng determinism contract', () => {
  beforeAll(() => {
    setWorldSeed('VETHMOOR-1');
  });

  it('xmur3 is stable for the canonical world seed', () => {
    const h = xmur3('VETHMOOR-1');
    const first = h();
    const second = h();
    expect(first).toBe(xmur3('VETHMOOR-1')());
    expect(first).not.toBe(second);
    expect(Number.isInteger(first)).toBe(true);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(0xffffffff);
  });

  it('mix32 avalanches and is stable', () => {
    expect(mix32(0)).toBe(mix32(0));
    expect(mix32(1)).not.toBe(mix32(2));
    // Snapshot: pins exact numeric behavior (save-compat contract).
    expect([mix32(1), mix32(12345), mix32(-7)]).toMatchInlineSnapshot(`
      [
        1364076727,
        1011272156,
        214441827,
      ]
    `);
  });

  it('seedOf same inputs → same seed; different inputs → different seeds', () => {
    const a = seedOf('chunk-flora', 10, 20);
    const b = seedOf('chunk-flora', 10, 20);
    const c = seedOf('chunk-flora', 10, 21);
    const d = seedOf('chunk-spawn', 10, 20);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
  });

  it('seedOf handles negative coordinates distinctly', () => {
    const set = new Set([
      seedOf('t', -1, -1),
      seedOf('t', -1, 1),
      seedOf('t', 1, -1),
      seedOf('t', 1, 1),
      seedOf('t', 0, 0),
    ]);
    expect(set.size).toBe(5);
  });

  it('Sfc32 sequences are reproducible and seed-sensitive', () => {
    const r1 = new Sfc32(seedOf('test-seq', 1));
    const r2 = new Sfc32(seedOf('test-seq', 1));
    const r3 = new Sfc32(seedOf('test-seq', 2));
    const s1 = Array.from({ length: 16 }, () => r1.next());
    const s2 = Array.from({ length: 16 }, () => r2.next());
    const s3 = Array.from({ length: 16 }, () => r3.next());
    expect(s1).toEqual(s2);
    expect(s1).not.toEqual(s3);
  });

  it('Sfc32 float/int/pick stay in bounds', () => {
    const r = new Sfc32(42);
    for (let i = 0; i < 5000; i++) {
      const f = r.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(3, 9);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(9);
    }
    const arr = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i++) expect(arr).toContain(r.pick(arr));
  });

  it('Sfc32 float distribution is roughly uniform', () => {
    const r = new Sfc32(7);
    const buckets = new Array<number>(10).fill(0);
    const N = 50_000;
    for (let i = 0; i < N; i++) buckets[Math.floor(r.float() * 10)]!++;
    for (const b of buckets) {
      expect(b).toBeGreaterThan(N / 10 - N * 0.01);
      expect(b).toBeLessThan(N / 10 + N * 0.01);
    }
  });

  it('hash2 is stable and position-sensitive', () => {
    expect(hash2(0, 0, 1)).toBe(hash2(0, 0, 1));
    expect(hash2(1, 0, 1)).not.toBe(hash2(0, 1, 1));
    expect(hash2(5, 5, 1)).not.toBe(hash2(5, 5, 2));
  });
});
