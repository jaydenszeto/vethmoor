/**
 * Continuous ambient beds, crossfaded by biome weights, weather and hour:
 * coastal wind, harsher ash wind, rain wash, the Ember Tooth's sub-bass
 * rumble, and seeded insect chirps in the marshes at dusk.
 */

import { mix32 } from '@/engine/rng';
import { audio } from './engine';
import { noiseBuffer, tone } from './synth';

interface Bed {
  gain: GainNode;
  target: number;
}

export class Ambience {
  private beds = new Map<string, Bed>();
  private built = false;
  private lastChirpSlot = -1;

  private ensureBuilt(): boolean {
    const ctx = audio.ctx;
    if (!ctx || !audio.ready) return false;
    if (this.built) return true;

    const mkBed = (
      key: string,
      kind: 'white' | 'brown',
      type: BiquadFilterType,
      freq: number,
      q = 0.8,
    ): void => {
      const buf = noiseBuffer(kind, 4);
      if (!buf) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(audio.ambient);
      src.start(0, (mix32(freq) % 4000) / 1000);
      this.beds.set(key, { gain, target: 0 });
    };

    mkBed('wind', 'brown', 'lowpass', 360);
    mkBed('ashwind', 'white', 'bandpass', 760, 0.5);
    mkBed('rain', 'white', 'bandpass', 1500, 0.4);
    mkBed('surf', 'brown', 'lowpass', 200);

    // Volcano rumble: dedicated sub oscillator.
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 36;
    const og = ctx.createGain();
    og.gain.value = 0;
    osc.connect(og);
    og.connect(audio.ambient);
    osc.start();
    this.beds.set('rumble', { gain: og, target: 0 });

    this.built = true;
    return true;
  }

  /**
   * @param w biome weights (BIOME_ORDER)
   * @param coastAmt 0..1 proximity to open water
   */
  update(
    w: readonly number[],
    volc: number,
    coastAmt: number,
    rainAmt: number,
    ashAmt: number,
    hour: number,
    timeS: number,
  ): void {
    if (!this.ensureBuilt()) return;
    const ctx = audio.ctx as AudioContext;

    const marsh = (w[0] as number) + (w[3] as number);
    const open = (w[1] as number) + (w[4] as number) + (w[5] as number);

    this.setTarget('wind', 0.16 + open * 0.2 + ashAmt * 0.1);
    this.setTarget('ashwind', ((w[4] as number) + (w[5] as number)) * 0.12 + ashAmt * 0.4);
    this.setTarget('rain', rainAmt * 0.5);
    this.setTarget('surf', coastAmt * 0.3);
    this.setTarget('rumble', volc * 0.5);

    for (const bed of this.beds.values()) {
      bed.gain.gain.setTargetAtTime(bed.target, ctx.currentTime, 0.6);
    }

    // Insect chirps: marsh + fungal, dusk through night, seeded pattern.
    const night = hour < 6.5 || hour > 18.5 ? 1 : 0;
    const insectAmt = (marsh + (w[2] as number) * 0.6) * night;
    if (insectAmt > 0.25) {
      const slot = Math.floor(timeS * 2.4);
      if (slot !== this.lastChirpSlot) {
        this.lastChirpSlot = slot;
        const h = mix32(slot);
        if ((h & 7) < 3) {
          const f = 2400 + (h % 1400);
          tone({ freq: f, dur: 0.04, gain: 0.018 * insectAmt, type: 'sine', bus: 'ambient' });
          if ((h & 16) === 0) {
            tone({ freq: f * 1.02, dur: 0.04, gain: 0.014 * insectAmt, when: 0.07, bus: 'ambient' });
          }
        }
      }
    }
  }

  private setTarget(key: string, v: number): void {
    const bed = this.beds.get(key);
    if (bed) bed.target = Math.min(v, 1);
  }
}
