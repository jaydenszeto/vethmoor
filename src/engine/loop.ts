/**
 * Fixed-timestep game loop: simulation at 60 Hz, render every animation frame
 * with an interpolation alpha. Catches up at most MAX_CATCHUP steps per frame;
 * beyond that, time is dropped (slow-motion beats spiral-of-death).
 */

export const SIM_STEP = 1 / 60;
const MAX_CATCHUP = 5;
const MAX_FRAME_DT = 0.25;

export class GameLoop {
  private acc = 0;
  private last = -1;
  private rafId = 0;
  running = false;

  /** Render-frame stats for the debug overlay. */
  fps = 0;
  private fpsAcc = 0;
  private fpsFrames = 0;

  constructor(
    private readonly sim: (dt: number) => void,
    private readonly render: (alpha: number, frameDt: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = -1;
    this.acc = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    if (this.last < 0) this.last = now;
    let frameDt = (now - this.last) / 1000;
    this.last = now;
    if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT;

    this.fpsAcc += frameDt;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }

    this.acc += frameDt;
    let steps = 0;
    while (this.acc >= SIM_STEP && steps < MAX_CATCHUP) {
      this.sim(SIM_STEP);
      this.acc -= SIM_STEP;
      steps++;
    }
    if (steps === MAX_CATCHUP && this.acc >= SIM_STEP) {
      this.acc = 0; // drop unpayable time debt
    }

    this.render(this.acc / SIM_STEP, frameDt);
    this.rafId = requestAnimationFrame(this.tick);
  };
}
