/**
 * Generative soundtrack — fully synthesized, seeded (no Math.random; the
 * determinism contract covers audio too). One morphing voice set:
 *   drone   — 3 detuned oscillators on chord tones through a slow lowpass
 *   bells   — sparse FM plucks walking the aeolian scale
 *   pulse   — combat-only low heartbeat
 * States crossfade by ramping the same nodes, never rebuilding the graph.
 */

import { Sfc32, seedOf } from '@/engine/rng';
import { audio } from './engine';

export type MusicState = 'off' | 'menu' | 'explore' | 'night' | 'dungeon' | 'combat';

const AEOLIAN = [0, 2, 3, 5, 7, 8, 10] as const;
const ROOT = 110; // A2

/** Chord walk over i, VI, III, VII (aeolian degrees as semitone offsets). */
const CHORDS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 3, 7], // i
  [8, 12, 15], // VI
  [3, 7, 10], // III
  [10, 14, 17], // VII
];

interface StateParams {
  drone: number; // gain
  filterHz: number;
  bellGain: number;
  bellMin: number; // seconds between bells
  bellMax: number;
  octave: number; // drone register shift (semitones)
  pulse: number; // combat heartbeat gain
  chordEvery: number;
}

const PARAMS: Record<Exclude<MusicState, 'off'>, StateParams> = {
  menu: { drone: 0.16, filterHz: 420, bellGain: 0.1, bellMin: 7, bellMax: 14, octave: 0, pulse: 0, chordEvery: 26 },
  explore: { drone: 0.12, filterHz: 760, bellGain: 0.16, bellMin: 5, bellMax: 11, octave: 0, pulse: 0, chordEvery: 18 },
  night: { drone: 0.1, filterHz: 360, bellGain: 0.1, bellMin: 9, bellMax: 18, octave: -12, pulse: 0, chordEvery: 24 },
  dungeon: { drone: 0.15, filterHz: 240, bellGain: 0.08, bellMin: 11, bellMax: 22, octave: -12, pulse: 0, chordEvery: 30 },
  combat: { drone: 0.17, filterHz: 1400, bellGain: 0.2, bellMin: 1.2, bellMax: 2.6, octave: 0, pulse: 0.3, chordEvery: 8 },
};

function freqOf(semitone: number): number {
  return ROOT * Math.pow(2, semitone / 12);
}

class MusicSystem {
  private state: MusicState = 'off';
  private built = false;
  private rng = new Sfc32(seedOf('music', 9));

  private droneOscs: OscillatorNode[] = [];
  private droneGain!: GainNode;
  private filter!: BiquadFilterNode;
  private bellBus!: GainNode;
  private pulseGain!: GainNode;

  private chordIdx = 0;
  private nextChordT = 0;
  private nextBellT = 0;
  private nextPulseT = 0;
  private lastMelodic = 0;

  private build(): void {
    const ctx = audio.ctx;
    if (!ctx || this.built) return;
    this.built = true;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 500;
    this.filter.Q.value = 0.6;

    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    this.filter.connect(this.droneGain);
    this.droneGain.connect(audio.music);

    // Three voices on chord tones, gently detuned against each other.
    const chord = CHORDS[0] as readonly [number, number, number];
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 2 ? 'triangle' : 'sawtooth';
      osc.frequency.value = freqOf(chord[i] as number);
      osc.detune.value = (i - 1) * 6;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.5 : 0.3;
      osc.connect(g);
      g.connect(this.filter);
      osc.start();
      this.droneOscs.push(osc);
    }

    this.bellBus = ctx.createGain();
    this.bellBus.gain.value = 0;
    this.bellBus.connect(audio.music);

    this.pulseGain = ctx.createGain();
    this.pulseGain.gain.value = 0;
    this.pulseGain.connect(audio.music);
  }

  /** Last state whose ramps actually reached the nodes (audio may unlock late). */
  private applied: MusicState = 'off';

  setState(s: MusicState): void {
    this.state = s;
    this.apply();
  }

  private apply(): void {
    const s = this.state;
    const ctx = audio.ctx;
    if (s === this.applied || !ctx || !audio.ready) return;
    this.applied = s;
    this.build();
    const t = ctx.currentTime;
    if (s === 'off') {
      this.droneGain.gain.setTargetAtTime(0, t, 1.2);
      this.bellBus.gain.setTargetAtTime(0, t, 1.2);
      this.pulseGain.gain.setTargetAtTime(0, t, 0.4);
      return;
    }
    const p = PARAMS[s];
    // Combat enters fast; everything else breathes in slowly.
    const tc = s === 'combat' ? 0.5 : 2.4;
    this.droneGain.gain.setTargetAtTime(p.drone, t, tc);
    this.bellBus.gain.setTargetAtTime(p.bellGain, t, tc);
    this.pulseGain.gain.setTargetAtTime(p.pulse, t, 0.6);
    this.filter.frequency.setTargetAtTime(p.filterHz, t, tc);
    this.retune(t, 1.4);
    this.nextBellT = t + this.rng.range(0.5, 2);
  }

  /** Glide the drone voices to the current chord in the state's register. */
  private retune(t: number, glide: number): void {
    if (this.state === 'off') return;
    const p = PARAMS[this.state];
    const chord = CHORDS[this.chordIdx % CHORDS.length] as readonly [number, number, number];
    for (let i = 0; i < 3; i++) {
      this.droneOscs[i]?.frequency.setTargetAtTime(freqOf((chord[i] as number) + p.octave), t, glide);
    }
  }

  /** FM bell pluck on a scale tone. */
  private bell(t: number): void {
    const ctx = audio.ctx;
    if (!ctx) return;
    // Melodic walk: drift at most 2 scale steps from the last note.
    const step = this.lastMelodic + this.rng.int(-2, 2);
    this.lastMelodic = Math.max(0, Math.min(13, step));
    const deg = AEOLIAN[this.lastMelodic % 7] as number;
    const oct = this.lastMelodic >= 7 ? 24 : 12;
    const f = freqOf(deg + oct + (this.state === 'dungeon' ? -12 : 0));

    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = f * (this.state === 'dungeon' ? 1.41 : 2.001); // dungeons ring inharmonic
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(f * 1.4, t);
    modGain.gain.exponentialRampToValueAtTime(0.5, t + 1.6);
    mod.connect(modGain);
    modGain.connect(carrier.frequency);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.7, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + (this.state === 'combat' ? 1.1 : 3.2));
    const pan = ctx.createStereoPanner();
    pan.pan.value = this.rng.range(-0.55, 0.55);
    carrier.connect(env);
    env.connect(pan);
    pan.connect(this.bellBus);
    carrier.start(t);
    mod.start(t);
    carrier.stop(t + 4);
    mod.stop(t + 4);
  }

  /** Combat heartbeat: pitched-down sine thump. */
  private pulse(t: number): void {
    const ctx = audio.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(82, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(env);
    env.connect(this.pulseGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  /** Drive from the frame loop; schedules ahead off ctx.currentTime. */
  update(): void {
    this.apply(); // audio may have unlocked since the last setState
    const ctx = audio.ctx;
    if (!ctx || !audio.ready || this.state === 'off') return;
    const t = ctx.currentTime;
    const p = PARAMS[this.state as Exclude<MusicState, 'off'>];

    if (t >= this.nextChordT) {
      this.chordIdx = (this.chordIdx + (this.rng.chance(0.25) ? 2 : 1)) % CHORDS.length;
      this.retune(t, 2.2);
      this.nextChordT = t + p.chordEvery * this.rng.range(0.8, 1.25);
    }
    if (t >= this.nextBellT) {
      this.bell(t);
      this.nextBellT = t + this.rng.range(p.bellMin, p.bellMax);
    }
    if (p.pulse > 0 && t >= this.nextPulseT) {
      this.pulse(t);
      this.nextPulseT = t + 0.62;
    }
  }
}

export const music = new MusicSystem();
