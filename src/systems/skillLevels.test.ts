import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { CRUSADERS } from '../data/crusaders';
import { CLASS_SKILLS } from '../data/skills';
import { leveled } from './combat';
import { countOf } from './items';
import { sisterPower } from './power';
import { MAX_SKILL_LEVEL, SKILL_STEPS, raiseSkill, skillBlock, skillLevels } from './skillLevels';

describe('Skill levels', () => {
  const c = CRUSADERS[0];
  const fresh = () => {
    const save = newSave();
    save.owned[c.id] = { level: 50, vow: 0 };
    save.tithes = 100_000;
    save.items = { page1: 100, page2: 100, page3: 100 };
    return save;
  };

  it('needs the Sister level, Pages and Tithes', () => {
    const save = newSave();
    save.owned[c.id] = { level: 1, vow: 0 };
    expect(skillBlock(save, c.id, 0)).toMatch(/level 5/);
    save.owned[c.id].level = 5;
    expect(skillBlock(save, c.id, 0)).toMatch(/Pages/);
    save.items = { page1: 8 };
    save.tithes = 0;
    expect(skillBlock(save, c.id, 0)).toMatch(/Tithes/);
    save.tithes = 400;
    expect(raiseSkill(save, c.id, 0)).toBe(true);
    expect(skillLevels(save, c.id)).toEqual([2, 1, 1, 1]);
    expect(countOf(save, 'page1')).toBe(0);
    expect(save.tithes).toBe(0);
  });

  it('stops at level 5 and raises Power each step', () => {
    const save = fresh();
    let last = sisterPower(save, c);
    for (let i = 1; i < MAX_SKILL_LEVEL; i++) {
      expect(raiseSkill(save, c.id, 3)).toBe(true);
      const now = sisterPower(save, c);
      expect(now).toBeGreaterThan(last);
      last = now;
    }
    expect(SKILL_STEPS.length).toBe(MAX_SKILL_LEVEL - 1);
    expect(raiseSkill(save, c.id, 3)).toBe(false);
    expect(skillBlock(save, c.id, 3)).toBe('Mastered');
    expect(skillLevels(save, c.id)[3]).toBe(MAX_SKILL_LEVEL);
  });

  it('a leveled skill hits harder', () => {
    const s = CLASS_SKILLS[c.classId].find((k) => k.mult)!;
    expect(leveled(s, 1)).toBe(s);
    expect(leveled(s, 5).mult!).toBeCloseTo(s.mult! * 1.24, 1);
  });
});
