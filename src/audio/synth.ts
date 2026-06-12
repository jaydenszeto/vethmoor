/**
 * Synthesis primitives: seeded noise buffers, enveloped noise bursts and
 * tones. Determinism here is aesthetic, not save-critical — but we stay
 * seeded anyway to honor the no-Math.random rule.
 */

import { Sfc32, seedOf } from '@/engine/rng';
import { audio } from './engine';

const noiseBuffers = new Map<string, AudioBuffer>();

/** Looping noise buffer. kind: 'white' | 'brown'. */
export function noiseBuffer(kind: 'white' | 'brown', seconds = 4): AudioBuffer | null {
  const ctx = audio.ctx;
  if (!ctx) return null;
  const key = `${kind}-${seconds}`;
  const hit = noiseBuffers.get(key);
  if (hit) return hit;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  const rng = new Sfc32(seedOf('noise', kind === 'white' ? 1 : 2));
  if (kind === 'white') {
    for (let i = 0; i < len; i++) data[i] = rng.float() * 2 - 1;
  } else {
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + (rng.float() * 2 - 1) * 0.04) / 1.02;
      data[i] = last * 10;
    }
  }
  noiseBuffers.set(key, buf);
  return buf;
}

export interface BurstOpts {
  /** 'lowpass' | 'bandpass' | 'highpass' */
  filter: BiquadFilterType;
  freq: number;
  q?: number;
  dur: number;
  gain: number;
  attack?: number;
  /** Multiply filter freq over the burst (squelch drops, hisses rise). */
  freqEnd?: number;
  when?: number;
}

/** Short filtered-noise burst — footsteps, hits, impacts, doors. */
export function noiseBurst(opts: BurstOpts): void {
  const ctx = audio.ctx;
  if (!ctx || !audio.ready) return;
  const buf = noiseBuffer('white');
  if (!buf) return;
  const t0 = ctx.currentTime + (opts.when ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  // Randomize start offset so repeated bursts don't phase.
  src.loopStart = 0;

  const filter = ctx.createBiquadFilter();
  filter.type = opts.filter;
  filter.frequency.setValueAtTime(opts.freq, t0);
  if (opts.freqEnd) filter.frequency.exponentialRampToValueAtTime(opts.freqEnd, t0 + opts.dur);
  filter.Q.value = opts.q ?? 0.9;

  const g = ctx.createGain();
  const attack = opts.attack ?? 0.005;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(opts.gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + opts.dur);

  src.connect(filter);
  filter.connect(g);
  g.connect(audio.sfx);
  src.start(t0, (t0 * 7.13) % 3);
  src.stop(t0 + opts.dur + 0.05);
}

export interface ToneOpts {
  freq: number;
  type?: OscillatorType;
  dur: number;
  gain: number;
  attack?: number;
  /** Optional pitch slide target. */
  freqEnd?: number;
  when?: number;
  bus?: 'sfx' | 'music' | 'ambient';
}

export function tone(opts: ToneOpts): void {
  const ctx = audio.ctx;
  if (!ctx || !audio.ready) return;
  const t0 = ctx.currentTime + (opts.when ?? 0);
  const osc = ctx.createOscillator();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t0 + opts.dur);
  const g = ctx.createGain();
  const attack = opts.attack ?? 0.008;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(opts.gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + opts.dur);
  osc.connect(g);
  g.connect(audio[opts.bus ?? 'sfx']);
  osc.start(t0);
  osc.stop(t0 + opts.dur + 0.05);
}
