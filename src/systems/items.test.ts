import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { ascend, ascendBlock } from './ascension';
import { addBags, countOf, give, refine, roomDrops, spend, vigilDrops } from './items';
import { sisterPower } from './power';
import { seeded } from './rng';
import { levelCap } from './stats';

describe('Materials', () => {
  it('give, spend and refine five into one', () => {
    const save = newSave();
    give(save, { ash1: 12 });
    expect(spend(save, { ash1: 13 })).toBe(false);
    expect(refine(save, 'ash1', 2)).toBe(true);
    expect(countOf(save, 'ash1')).toBe(2);
    expect(countOf(save, 'ash2')).toBe(2);
    expect(refine(save, 'ash1')).toBe(false);
    expect(refine(save, 'ash3')).toBe(false);
  });

  it('bosses drop more than fights, and harder crypts drop more', () => {
    const total = (kind: 'fight' | 'boss', depth: number) => {
      const rng = seeded(3);
      const bag = addBags(...Array.from({ length: 50 }, () => roomDrops(kind, depth, rng)));
      return Object.values(bag).reduce((a, b) => a + (b ?? 0), 0);
    };
    expect(total('boss', 0)).toBeGreaterThan(total('fight', 0));
    expect(total('boss', 3)).toBeGreaterThan(total('boss', 0));
    expect(Object.values(vigilDrops(12, seeded(1))).reduce((a, b) => a + (b ?? 0), 0)).toBeGreaterThanOrEqual(5);
  });
});

describe('Ascension', () => {
  it('needs her cap, Ash and Tithes; raises the cap and her power', () => {
    const save = newSave();
    const c = CRUSADERS[0];
    save.owned[c.id] = { level: 19, vow: 0 };
    expect(ascendBlock(save, c.id)).toMatch(/level 20/);
    save.owned[c.id].level = 20;
    expect(ascendBlock(save, c.id)).toMatch(/Ash/);
    give(save, { ash1: 20 });
    save.tithes = 1500;
    const before = sisterPower(save, c);
    expect(ascend(save, c.id)).toBe(true);
    expect(levelCap(save.owned[c.id])).toBe(30);
    expect(save.tithes).toBe(0);
    expect(countOf(save, 'ash1')).toBe(0);
    expect(sisterPower(save, c)).toBeGreaterThan(before);
  });
});
