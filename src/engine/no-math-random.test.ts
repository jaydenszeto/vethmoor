/**
 * Guard: simulation/gen code must never use Math.random — all randomness
 * flows through seeded Sfc32. UI-only files (src/ui/) are exempt.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
}

describe('determinism guard', () => {
  it('no Math.random outside src/ui/', () => {
    const root = join(process.cwd(), 'src');
    const files: string[] = [];
    walk(root, files);
    const offenders: string[] = [];
    for (const f of files) {
      const rel = relative(root, f);
      if (rel.startsWith('ui/') || rel.startsWith('ui\\')) continue;
      const src = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
      if (src.includes('Math.random')) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
