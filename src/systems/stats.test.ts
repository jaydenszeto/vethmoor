import { beforeAll, describe, expect, it } from 'vitest';
import { setWorldSeed } from '@/engine/rng';
import { DEFAULT_WORLD_SEED } from '@/data/world';
import { validateItems } from '@/data/items';
import { itemId } from '@/data/ids';
import {
  applyLevelUp,
  attrMultiplier,
  createCharacter,
  levelUpReady,
  maxCarry,
  walkSpeed,
} from './stats';
import { awardSkillXp, xpThreshold } from './skills';
import { addItem, encumbrance, equipItem, totalArmor, unequipSlot, usePotion } from './inventory';
import { rollLoot } from './loot';

beforeAll(() => setWorldSeed(DEFAULT_WORLD_SEED));

describe('item catalog', () => {
  it('validates (unique ids, sane numbers)', () => {
    expect(() => validateItems()).not.toThrow();
  });
});

describe('character math', () => {
  it('creation produces the documented derived stats', () => {
    const c = createCharacter('Test', 'morchai', 'sellsword', 'tide');
    // Morchai: str 40+15+10(class)=65, end 40+10+10=60.
    expect(c.attrs.str).toBe(65);
    expect(c.attrs.end).toBe(60);
    expect(c.hpMax).toBe(Math.round(20 + (65 + 60) / 2 + 15));
    expect(c.fatMax).toBe(65 + 40 + 40 + 60); // str+wil+agi+end
    expect(c.hp).toBe(c.hpMax);
    expect(maxCarry(c)).toBe(65 * 4);
    expect(walkSpeed(c)).toBeGreaterThan(3);
    // Major skill: blade base 5 + race 5 + major 25 = 35.
    expect(c.skills.blade).toBe(35);
  });

  it('use-based skill XP levels skills and arms level-up after 10 ups', () => {
    const c = createCharacter('Test', 'karthi', 'sellsword', 'tide');
    const before = c.skills.blade;
    // Blade is major (×1.5): threshold = 12 + 2·skill.
    awardSkillXp(c, 'blade', xpThreshold(c.skills.blade)); // 1.5× overshoots → level
    expect(c.skills.blade).toBe(before + 1);
    expect(c.levelProgress).toBe(1);
    expect(c.attrUps.str).toBe(1);

    for (let i = 0; i < 30 && !levelUpReady(c); i++) {
      awardSkillXp(c, 'block', xpThreshold(c.skills.block) / 1.4);
    }
    expect(levelUpReady(c)).toBe(true);

    const str = c.attrs.str;
    const mult = attrMultiplier(c.attrUps.str);
    applyLevelUp(c, ['str', 'end', 'luc']);
    expect(c.level).toBe(2);
    expect(c.attrs.str).toBe(str + mult);
    expect(c.levelProgress).toBe(0);
  });

  it('attribute multiplier table matches the spec', () => {
    expect(attrMultiplier(0)).toBe(1);
    expect(attrMultiplier(1)).toBe(2);
    expect(attrMultiplier(4)).toBe(2);
    expect(attrMultiplier(5)).toBe(3);
    expect(attrMultiplier(7)).toBe(3);
    expect(attrMultiplier(8)).toBe(4);
    expect(attrMultiplier(10)).toBe(5);
  });
});

describe('inventory + equipment', () => {
  it('equips, unequips, and tracks encumbrance', () => {
    const c = createCharacter('Test', 'karthi', 'sellsword', 'tide');
    const encBefore = encumbrance(c);
    expect(encBefore).toBeGreaterThan(0);
    expect(equipItem(c, itemId('iron-sword'))).toBe(true);
    expect(c.equipment.weapon).toBe(itemId('iron-sword'));
    // Equipping moved it out of inventory but weight is unchanged.
    expect(encumbrance(c)).toBeCloseTo(encBefore, 5);
    expect(equipItem(c, itemId('iron-cuirass'))).toBe(true);
    expect(equipItem(c, itemId('iron-shield'))).toBe(true);
    expect(totalArmor(c)).toBeGreaterThan(0);
    unequipSlot(c, 'weapon');
    expect(c.equipment.weapon).toBeNull();
  });

  it('two-handed weapons displace the shield', () => {
    const c = createCharacter('Test', 'morchai', 'hearthsworn', 'tide');
    addItem(c, itemId('iron-shield'));
    expect(equipItem(c, itemId('iron-shield'))).toBe(true);
    expect(equipItem(c, itemId('iron-warhammer'))).toBe(true);
    expect(c.equipment.shield).toBeNull();
    expect(c.equipment.weapon).toBe(itemId('iron-warhammer'));
  });

  it('potions restore and are consumed', () => {
    const c = createCharacter('Test', 'karthi', 'sellsword', 'tide');
    c.hp = 10;
    expect(usePotion(c, itemId('potion-mend-small'))).toBe(true);
    expect(c.hp).toBe(35);
    expect(usePotion(c, itemId('potion-mend-small'))).toBe(true);
    expect(usePotion(c, itemId('potion-mend-small'))).toBe(false); // only had 2
  });
});

describe('loot', () => {
  it('is deterministic per seed and varies across seeds', () => {
    const a = rollLoot('chest:tier:2', 1234);
    const b = rollLoot('chest:tier:2', 1234);
    const c = rollLoot('chest:tier:2', 99);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it('boss chests always pay', () => {
    for (let s = 0; s < 40; s++) {
      const loot = rollLoot('chest:boss:2', s);
      expect(loot.length).toBeGreaterThanOrEqual(2);
      expect(loot.some((i) => (i.id as string) === 'gold')).toBe(true);
    }
  });
});
