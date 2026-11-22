import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { noteBrands, noteClear, noteTower } from './records';
import { RIVAL_COUNT, ladder, renownOf, rivals } from './rivals';

describe('personal bests', () => {
  it('only a better result is a record', () => {
    const save = newSave();
    expect(noteTower(save, 3, 4)).toBeUndefined();
    expect(noteTower(save, 5, 4)?.was).toBe(4);
    expect(noteBrands(save, 3)?.was).toBeUndefined();
    expect(noteBrands(save, 3)).toBeUndefined();
    expect(noteClear(save, 'x', 0, 20, 'X')?.was).toBeUndefined();
    expect(noteClear(save, 'x', 0, 25, 'X')).toBeUndefined();
    expect(noteClear(save, 'x', 0, 18, 'X')?.was).toBe(20);
    expect(noteClear(save, 'x', 1, 30, 'X')).toBeDefined(); // each Heresy tier keeps its own
  });
});

describe('rival ladder', () => {
  it('is the same for everyone and does not bend to the player', () => {
    const now = Date.now();
    const a = rivals(now);
    expect(a).toHaveLength(RIVAL_COUNT);
    expect(rivals(now)).toEqual(a);
    const weak = newSave();
    const strong = newSave();
    strong.tower = { best: 40 };
    expect(renownOf(strong)).toBeGreaterThan(renownOf(weak));
    expect(ladder(strong, now).place).toBeLessThan(ladder(weak, now).place);
    // rivals are identical either way
    expect(ladder(strong, now).rows.filter((r) => !r.you)).toEqual(ladder(weak, now).rows.filter((r) => !r.you));
  });
});
