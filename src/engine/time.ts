/**
 * Game clock — 30:1 timescale (48-minute day). Emits 'time:hour' on hour
 * boundaries for schedules, ambience and shop locks.
 */

import { TIMESCALE } from '@/data/world';
import { events } from './events';

export class GameClock {
  day = 1;
  /** Minutes since 00:00, 0..1440. */
  minOfDay = 17 * 60;

  get hour(): number {
    return this.minOfDay / 60;
  }

  advance(dtRealSeconds: number): void {
    const prevHour = Math.floor(this.hour);
    this.minOfDay += (dtRealSeconds * TIMESCALE) / 60;
    while (this.minOfDay >= 1440) {
      this.minOfDay -= 1440;
      this.day++;
    }
    const nowHour = Math.floor(this.hour);
    if (nowHour !== prevHour) {
      events.emit('time:hour', { hour: nowHour, day: this.day });
    }
  }

  /** Jump forward by whole game hours (rest/wait/travel). */
  skipHours(h: number): void {
    for (let i = 0; i < h; i++) {
      this.minOfDay += 60;
      if (this.minOfDay >= 1440) {
        this.minOfDay -= 1440;
        this.day++;
      }
      events.emit('time:hour', { hour: Math.floor(this.hour), day: this.day });
    }
  }

  set(day: number, minOfDay: number): void {
    this.day = day;
    this.minOfDay = minOfDay;
  }

  /** "Morndas, 18:24" style display string (lore month names arrive in P8). */
  get label(): string {
    const h = Math.floor(this.hour);
    const m = Math.floor(this.minOfDay % 60);
    return `Day ${this.day}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
