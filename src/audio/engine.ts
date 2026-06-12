/**
 * Audio engine: lazy AudioContext (browsers require a user gesture), bus
 * graph master → { sfx, ambient, music }. All sound is synthesized — there
 * are no audio files anywhere in the project.
 */

import { config } from '@/engine/config';

class AudioEngine {
  private _ctx: AudioContext | null = null;
  master!: GainNode;
  sfx!: GainNode;
  ambient!: GainNode;
  music!: GainNode;
  private unlocked = false;

  get ctx(): AudioContext | null {
    return this._ctx;
  }

  /** Create + resume on first user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (!this._ctx) {
      this._ctx = new AudioContext();
      this.master = this._ctx.createGain();
      this.master.connect(this._ctx.destination);
      this.sfx = this._ctx.createGain();
      this.ambient = this._ctx.createGain();
      this.music = this._ctx.createGain();
      this.sfx.connect(this.master);
      this.ambient.connect(this.master);
      this.music.connect(this.master);
      this.applyVolumes();
    }
    if (this._ctx.state === 'suspended') {
      void this._ctx.resume();
    }
    this.unlocked = true;
  }

  get ready(): boolean {
    return this.unlocked && this._ctx !== null && this._ctx.state === 'running';
  }

  applyVolumes(): void {
    if (!this._ctx) return;
    const t = this._ctx.currentTime;
    this.master.gain.setTargetAtTime(config.volMaster, t, 0.05);
    this.sfx.gain.setTargetAtTime(config.volSfx, t, 0.05);
    this.ambient.gain.setTargetAtTime(config.volAmbient, t, 0.05);
    this.music.gain.setTargetAtTime(config.volMusic, t, 0.05);
  }
}

export const audio = new AudioEngine();

/** Wire the one-time unlock to any first gesture. */
export function installAudioUnlock(): void {
  const unlock = (): void => {
    audio.unlock();
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
  };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
}
