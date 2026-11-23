import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { stageBattle } from './campaign';
import { MAX_CANON, PATHS, TRAITS, canonBlock, canonCost, canonize, canonOf, pointsLeft, resetTraits, takeTrait, traitBlock } from './canon';
import { give } from './items';
import { sisterPower } from './power';
import { seeded } from './rng';
import { sisterStats, MAX_LEVEL } from './stats';

const ID = 'CC-W013';
const ready = () => {
  const save = newSave();
  save.owned[ID] = { level: MAX_LEVEL, vow: 0, asc: 3 };
  save.tithes = 10_000_000;
  give(save, { canon1: 999, canon2: 999, canon3: 999 });
  return save;
};

describe('Canonization', () => {
  it('opens at level 50 and climbs twenty ranks', () => {
    const save = ready();
    save.owned[ID].level = 49;
    expect(canonBlock(save, ID)).toMatch(/level 50/);
    save.owned[ID].level = MAX_LEVEL;
    for (let r = 0; r < MAX_CANON; r++) expect(canonize(save, ID)).toBe(true);
    expect(canonOf(save.owned[ID])).toBe(MAX_CANON);
    expect(canonize(save, ID)).toBe(false);
    expect(pointsLeft(save.owned[ID])).toBe(10);
  });

  it('costs move up the tiers and never fall', () => {
    let tithes = 0;
    for (let r = 0; r < MAX_CANON; r++) {
      const c = canonCost(r);
      expect(c.tithes).toBeGreaterThan(tithes);
      tithes = c.tithes;
      expect(Object.keys(c.items)).toEqual([r < 7 ? 'canon1' : r < 14 ? 'canon2' : 'canon3']);
    }
  });

  it('each rank raises her stats and Power', () => {
    const save = ready();
    const c = CRUSADERS.find((x) => x.id === ID)!;
    const before = sisterStats(save, c);
    const p0 = sisterPower(save, c);
    for (let r = 0; r < 10; r++) canonize(save, ID);
    const after = sisterStats(save, c);
    expect(after.atk / before.atk).toBeCloseTo(1.15, 1);
    expect(sisterPower(save, c)).toBeGreaterThan(p0);
  });

  it('traits: one point per two ranks, paths in order, free reset', () => {
    const save = ready();
    const o = save.owned[ID];
    expect(traitBlock(o, 'wrath1')).toBeDefined();
    canonize(save, ID);
    canonize(save, ID);
    expect(takeTrait(save, ID, 'wrath2')).toBe(false);
    expect(takeTrait(save, ID, 'wrath1')).toBe(true);
    expect(takeTrait(save, ID, 'ward1')).toBe(false);
    for (let r = 0; r < MAX_CANON - 2; r++) canonize(save, ID);
    for (const n of [2, 3, 4, 5]) expect(takeTrait(save, ID, `wrath${n}`)).toBe(true);
    for (const n of [1, 2, 3, 4, 5]) expect(takeTrait(save, ID, `ward${n}`)).toBe(true);
    expect(pointsLeft(o)).toBe(0);
    expect(takeTrait(save, ID, 'fervor1')).toBe(false);
    resetTraits(save, ID);
    expect(pointsLeft(o)).toBe(10);
    expect(TRAITS.length).toBe(PATHS.length * 5);
  });

  it('traits reach the battle: opening Zeal, speed, damage taken', () => {
    const save = ready();
    for (let r = 0; r < MAX_CANON; r++) canonize(save, ID);
    const base = stageBattle(save, [ID], 3, seeded(1)).units.find((u) => u.ref === ID)!;
    for (const n of [1, 2, 3, 4, 5]) takeTrait(save, ID, `fervor${n}`);
    for (const n of [1, 2, 3, 4, 5]) takeTrait(save, ID, `ward${n}`);
    const u = stageBattle(save, [ID], 3, seeded(1)).units.find((x) => x.ref === ID)!;
    expect((u.zeal ?? 0) - (base.zeal ?? 0)).toBe(30);
    expect(u.spd - base.spd).toBe(2);
    expect(u.symbol?.guard ?? 0).toBeCloseTo((base.symbol?.guard ?? 0) + 0.12, 5);
    expect(u.maxHp).toBeGreaterThan(base.maxHp);
  });
});
