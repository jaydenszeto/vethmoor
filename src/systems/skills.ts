/**
 * Use-based skill progression. XP rates (per use): melee hit 2 (+5 on kill),
 * block 3, cast = cost/3, 100 m travel = 1 Athletics, lock attempt 2,
 * potion brewed 4, barter deal 1+profit/20, persuasion 3.
 * Threshold to next point: 12 + 2·skill. Major ×1.5, minor ×1.0, misc ×0.6.
 */

import { events } from '@/engine/events';
import { SKILL_BY_ID, skillName, type SkillId } from '@/data/skillsDef';
import { levelUpReady, type Character } from './stats';

export function xpThreshold(skillLevel: number): number {
  return 12 + 2 * skillLevel;
}

export function rateFor(c: Character, skill: SkillId): number {
  if (c.major.includes(skill)) return 1.5;
  if (c.minor.includes(skill)) return 1.0;
  return 0.6;
}

export function awardSkillXp(c: Character, skill: SkillId, baseXp: number): void {
  if (c.skills[skill] >= 100) return;
  c.skillXp[skill] += baseXp * rateFor(c, skill);
  let leveled = false;
  while (c.skillXp[skill] >= xpThreshold(c.skills[skill]) && c.skills[skill] < 100) {
    c.skillXp[skill] -= xpThreshold(c.skills[skill]);
    c.skills[skill]++;
    leveled = true;
    events.emit('toast', {
      text: `${skillName(skill)} increased to ${c.skills[skill]}`,
      kind: 'skill',
    });
    if (c.major.includes(skill) || c.minor.includes(skill)) {
      c.levelProgress++;
      const governs = SKILL_BY_ID.get(skill)?.governs;
      if (governs) c.attrUps[governs]++;
    }
  }
  if (leveled && levelUpReady(c)) {
    events.emit('toast', { text: 'You feel stronger — rest to advance', kind: 'quest' });
  }
}

/** Direct +1 skill point (skill books, trainers) with level-progress credit. */
export function bumpSkill(c: Character, skill: SkillId): boolean {
  if (c.skills[skill] >= 100) return false;
  c.skills[skill]++;
  events.emit('toast', {
    text: `${skillName(skill)} increased to ${c.skills[skill]}`,
    kind: 'skill',
  });
  if (c.major.includes(skill) || c.minor.includes(skill)) {
    c.levelProgress++;
    const governs = SKILL_BY_ID.get(skill)?.governs;
    if (governs) c.attrUps[governs]++;
  }
  if (levelUpReady(c)) {
    events.emit('toast', { text: 'You feel stronger — rest to advance', kind: 'quest' });
  }
  return true;
}

/** Travel-distance accumulator for Athletics. */
let travelAcc = 0;

export function trackTravel(c: Character, meters: number, swimming: boolean): void {
  travelAcc += meters * (swimming ? 2 : 1);
  if (travelAcc >= 100) {
    travelAcc -= 100;
    awardSkillXp(c, 'athletics', 1);
  }
}

export function resetTravelAcc(): void {
  travelAcc = 0;
}
