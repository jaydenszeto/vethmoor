/**
 * Soft wayfinding geometry — pure helpers for the compass objective tick.
 *
 * The compass and camera share one bearing convention: forward is
 * (-sin yaw, -cos yaw), so facing a target means yaw equals the target's
 * bearing. Keeping this math pure makes it testable without a live Game.
 */

export type Vec2 = readonly [number, number];

/** Absolute compass-convention bearing from (px,pz) toward (tx,tz). */
export function bearingTo(px: number, pz: number, tx: number, tz: number): number {
  return Math.atan2(-(tx - px), -(tz - pz));
}

/** Squared distance — cheap nearest-of comparisons, no sqrt. */
export function dist2(px: number, pz: number, tx: number, tz: number): number {
  return (tx - px) ** 2 + (tz - pz) ** 2;
}

/**
 * Bearing to the nearest of several targets, or null when there are none or the
 * player is already within `arriveR` of the closest (stop nagging on arrival).
 */
export function nearestBearing(
  px: number,
  pz: number,
  targets: readonly Vec2[],
  arriveR = 45,
): number | null {
  let best: Vec2 | null = null;
  let bestD = Infinity;
  for (const t of targets) {
    const d = dist2(px, pz, t[0], t[1]);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  if (!best || bestD < arriveR * arriveR) return null;
  return bearingTo(px, pz, best[0], best[1]);
}
