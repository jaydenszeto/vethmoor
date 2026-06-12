/**
 * Budgeted build scheduler. One keyed task per chunk; pump() runs at most one
 * task per call (a grid+mesh build is the budget unit). Lower prio = sooner.
 */

export interface BuildTask {
  key: string;
  prio: number;
  run: () => void;
}

export class Streamer {
  private tasks = new Map<string, BuildTask>();

  enqueue(task: BuildTask): void {
    this.tasks.set(task.key, task);
  }

  cancel(key: string): void {
    this.tasks.delete(key);
  }

  get pending(): number {
    return this.tasks.size;
  }

  /** Run the highest-priority task. Returns true if something ran. */
  pump(): boolean {
    if (this.tasks.size === 0) return false;
    let best: BuildTask | null = null;
    for (const t of this.tasks.values()) {
      if (!best || t.prio < best.prio) best = t;
    }
    if (!best) return false;
    this.tasks.delete(best.key);
    best.run();
    return true;
  }
}
