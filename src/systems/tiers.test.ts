import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { powerOf } from './power';
import { statsFor } from './stats';
import { MAX_TIER, MAX_VOW, TIER_STIGMATA, copiesFor, copiesLeft, oathMult, skillVow, takeVow, tierBlock, tierTithes, tierUp, vowBlock } from './tiers';

describe('star tiers', () => {
  it('each Vow needs more copies on each tier', () => {
    expect([0, 1, 2, 3, 4].map((v) => copiesFor(0, v))).toEqual([1, 1, 2, 2, 3]);
    expect([0, 1, 2, 3, 4].map((v) => copiesFor(1, v))).toEqual([2, 2, 3, 3, 4]);
    expect([0, 1, 2, 3, 4].map((v) => copiesFor(2, v))).toEqual([3, 3, 4, 4, 5]);
    // 9 copies for tier 0, then 14, 19 ... 34
    expect(copiesLeft({ vow: 0, tier: 0 })).toBe(9 + 14 + 19 + 24 + 29 + 34);
    expect(copiesLeft({ vow: MAX_VOW, tier: MAX_TIER })).toBe(0);
  });

  it('Vows spend copies and Tithes; at five, Stigmata raise the tier and Vows start again', () => {
    const save = newSave();
    save.owned.x = { level: 1, vow: 0, tokens: 0 };
    const o = save.owned.x;
    save.tithes = 1e6;
    expect(vowBlock(save, o)).toBe('tokens');
    o.tokens = 9;
    for (let v = 0; v < MAX_VOW; v++) expect(takeVow(save, 'x')).toBe(true);
    expect(o).toMatchObject({ vow: 5, tokens: 0 });
    expect(vowBlock(save, o)).toBe('tier');
    expect(tierBlock(save, o)).toBe('stigmata');
    save.stigmata = TIER_STIGMATA[0];
    const before = save.tithes;
    expect(tierUp(save, 'x')).toBe(true);
    expect(o).toMatchObject({ vow: 0, tier: 1 });
    expect(save.stigmata).toBe(0);
    expect(save.tithes).toBe(before - tierTithes(0));
    // the second tier's first Vow needs 2 copies
    o.tokens = 1;
    expect(takeVow(save, 'x')).toBe(false);
    o.tokens = 2;
    expect(takeVow(save, 'x')).toBe(true);
  });

  it('rising a tier never lowers her stats or Power; skill upgrades stay', () => {
    const c = CRUSADERS.find((x) => x.rarity === 'R')!;
    const at5 = { level: 20, vow: 5, tier: 0 };
    const t1 = { level: 20, vow: 0, tier: 1 };
    expect(oathMult(t1)).toBeGreaterThan(oathMult(at5));
    expect(skillVow(t1)).toBe(MAX_VOW);
    const p5 = powerOf(c, statsFor(c, at5), skillVow(at5));
    const p1 = powerOf(c, statsFor(c, t1), skillVow(t1));
    expect(p1).toBeGreaterThan(p5);
  });
});
