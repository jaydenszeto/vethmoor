/** Six premade classes — major skills ×1.5 XP, minor ×1.0, misc ×0.6. */

import type { ItemId } from './ids';
import { itemId } from './ids';
import type { AttrId, SkillId } from './skillsDef';

export interface ClassDef {
  id: string;
  name: string;
  blurb: string;
  major: readonly SkillId[]; // 5
  minor: readonly SkillId[]; // 5
  attrs: readonly [AttrId, AttrId]; // +10 each
  starterGear: readonly { id: ItemId; n: number }[];
  starterGold: number;
}

export const CLASSES: readonly ClassDef[] = [
  {
    id: 'sellsword',
    name: 'Sellsword',
    blurb: 'A blade for hire. The Vigil posts pay steady coin for steady hands.',
    major: ['blade', 'block', 'heavyArmor', 'athletics', 'restoration'],
    minor: ['blunt', 'marksman', 'lightArmor', 'speechcraft', 'security'],
    attrs: ['str', 'end'],
    starterGear: [
      { id: itemId('iron-sword'), n: 1 },
      { id: itemId('iron-cuirass'), n: 1 },
      { id: itemId('iron-shield'), n: 1 },
      { id: itemId('potion-mend-small'), n: 2 },
      { id: itemId('shirt-rough'), n: 1 },
      { id: itemId('pants-rough'), n: 1 },
    ],
    starterGold: 40,
  },
  {
    id: 'ashwalker',
    name: 'Ashwalker',
    blurb: 'A scout of the grey wastes. Sees first, strikes once, is gone.',
    major: ['marksman', 'sneak', 'lightArmor', 'athletics', 'blade'],
    minor: ['security', 'alchemy', 'block', 'speechcraft', 'alteration'],
    attrs: ['agi', 'spd'],
    starterGear: [
      { id: itemId('iron-bow'), n: 1 },
      { id: itemId('arrow'), n: 40 },
      { id: itemId('iron-dagger'), n: 1 },
      { id: itemId('leather-cuirass'), n: 1 },
      { id: itemId('leather-boots'), n: 1 },
      { id: itemId('shirt-rough'), n: 1 },
      { id: itemId('pants-rough'), n: 1 },
    ],
    starterGold: 35,
  },
  {
    id: 'cinderscribe',
    name: 'Cinderscribe',
    blurb: 'A scholar of the Conclave’s outer circle. The volcano dreams; you take notes.',
    major: ['destruction', 'alteration', 'conjuration', 'restoration', 'alchemy'],
    minor: ['speechcraft', 'security', 'blade', 'sneak', 'athletics'],
    attrs: ['int', 'wil'],
    starterGear: [
      { id: itemId('iron-dagger'), n: 1 },
      { id: itemId('robe-grey'), n: 1 },
      { id: itemId('potion-magicka-small'), n: 3 },
      { id: itemId('ingredient-ashcap'), n: 3 },
      { id: itemId('pants-rough'), n: 1 },
    ],
    starterGold: 30,
  },
  {
    id: 'tidepriest',
    name: 'Tide-Priest',
    blurb: 'A mendicant of the drowned liturgy. Heals the March; hears its bad dreams.',
    major: ['restoration', 'blunt', 'alteration', 'speechcraft', 'alchemy'],
    minor: ['heavyArmor', 'block', 'destruction', 'athletics', 'security'],
    attrs: ['wil', 'per'],
    starterGear: [
      { id: itemId('iron-mace'), n: 1 },
      { id: itemId('robe-grey'), n: 1 },
      { id: itemId('potion-mend-small'), n: 3 },
      { id: itemId('shirt-rough'), n: 1 },
      { id: itemId('pants-rough'), n: 1 },
    ],
    starterGold: 35,
  },
  {
    id: 'duskrunner',
    name: 'Duskrunner',
    blurb: 'Locks, ledgers, other people’s pockets. The March forgives little; you forgive less.',
    major: ['security', 'sneak', 'speechcraft', 'lightArmor', 'blade'],
    minor: ['marksman', 'alchemy', 'athletics', 'block', 'alteration'],
    attrs: ['agi', 'per'],
    starterGear: [
      { id: itemId('iron-dagger'), n: 1 },
      { id: itemId('leather-cuirass'), n: 1 },
      { id: itemId('leather-boots'), n: 1 },
      { id: itemId('lockpick'), n: 6 },
      { id: itemId('shirt-rough'), n: 1 },
      { id: itemId('pants-rough'), n: 1 },
    ],
    starterGold: 60,
  },
  {
    id: 'hearthsworn',
    name: 'Hearthsworn',
    blurb: 'A homesteader with a heavy hammer and heavier patience. Vethmoor tests both.',
    major: ['blunt', 'heavyArmor', 'block', 'athletics', 'alchemy'],
    minor: ['blade', 'restoration', 'speechcraft', 'marksman', 'security'],
    attrs: ['end', 'str'],
    starterGear: [
      { id: itemId('iron-warhammer'), n: 1 },
      { id: itemId('iron-greaves'), n: 1 },
      { id: itemId('iron-boots'), n: 1 },
      { id: itemId('potion-fatigue-small'), n: 2 },
      { id: itemId('shirt-rough'), n: 1 },
      { id: itemId('pants-rough'), n: 1 },
    ],
    starterGold: 45,
  },
];

export const CLASS_BY_ID: ReadonlyMap<string, ClassDef> = new Map(CLASSES.map((c) => [c.id, c]));
