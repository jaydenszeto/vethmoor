/** The 8 attributes and 15 skills (Morrowind-style use-based progression). */

export type AttrId = 'str' | 'int' | 'wil' | 'agi' | 'spd' | 'end' | 'per' | 'luc';

export const ATTRS: readonly { id: AttrId; name: string; blurb: string }[] = [
  { id: 'str', name: 'Strength', blurb: 'melee damage, carry weight' },
  { id: 'int', name: 'Intellect', blurb: 'magicka pool, alchemy' },
  { id: 'wil', name: 'Will', blurb: 'magicka regen, resist' },
  { id: 'agi', name: 'Agility', blurb: 'sneak, evasion feel' },
  { id: 'spd', name: 'Speed', blurb: 'movement' },
  { id: 'end', name: 'Endurance', blurb: 'health, fatigue regen' },
  { id: 'per', name: 'Personality', blurb: 'prices, persuasion' },
  { id: 'luc', name: 'Luck', blurb: 'a thumb on every scale' },
];

export type SkillId =
  | 'blade'
  | 'blunt'
  | 'marksman'
  | 'block'
  | 'heavyArmor'
  | 'lightArmor'
  | 'athletics'
  | 'sneak'
  | 'security'
  | 'destruction'
  | 'restoration'
  | 'alteration'
  | 'conjuration'
  | 'alchemy'
  | 'speechcraft';

export interface SkillDef {
  id: SkillId;
  name: string;
  governs: AttrId;
}

export const SKILLS: readonly SkillDef[] = [
  { id: 'blade', name: 'Blade', governs: 'str' },
  { id: 'blunt', name: 'Blunt', governs: 'str' },
  { id: 'marksman', name: 'Marksman', governs: 'agi' },
  { id: 'block', name: 'Block', governs: 'agi' },
  { id: 'heavyArmor', name: 'Heavy Armor', governs: 'end' },
  { id: 'lightArmor', name: 'Light Armor', governs: 'spd' },
  { id: 'athletics', name: 'Athletics', governs: 'spd' },
  { id: 'sneak', name: 'Sneak', governs: 'agi' },
  { id: 'security', name: 'Security', governs: 'int' },
  { id: 'destruction', name: 'Destruction', governs: 'wil' },
  { id: 'restoration', name: 'Restoration', governs: 'wil' },
  { id: 'alteration', name: 'Alteration', governs: 'wil' },
  { id: 'conjuration', name: 'Conjuration', governs: 'int' },
  { id: 'alchemy', name: 'Alchemy', governs: 'int' },
  { id: 'speechcraft', name: 'Speechcraft', governs: 'per' },
];

export const SKILL_BY_ID: ReadonlyMap<SkillId, SkillDef> = new Map(SKILLS.map((s) => [s.id, s]));

export function skillName(id: SkillId): string {
  return SKILL_BY_ID.get(id)?.name ?? id;
}
