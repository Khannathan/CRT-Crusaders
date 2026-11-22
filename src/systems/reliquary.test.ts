import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { CRUSADERS } from '../data/crusaders';
import { sisterPower } from './power';
import { sisterStats } from './stats';
import { RELICS, consecrate, relicBlock, reliquaryBonus } from './reliquary';

describe('the Reliquary', () => {
  const rich = () => {
    const save = newSave();
    save.tithes = 1_000_000;
    save.items = { incense1: 999, incense2: 999, incense3: 999 };
    return save;
  };

  it('lights each branch in order, the Crown last', () => {
    const save = rich();
    expect(relicBlock(save, 'wrath2')).toMatch(/before/);
    expect(relicBlock(save, 'crown')).toMatch(/every other/);
    expect(consecrate(save, 'wrath1')).toBe(true);
    expect(consecrate(save, 'wrath1')).toBe(false);
    expect(consecrate(save, 'wrath2')).toBe(true);
    for (const r of RELICS) if (r.branch !== 'crown') consecrate(save, r.id);
    expect(consecrate(save, 'crown')).toBe(true);
    expect(save.reliquary!.length).toBe(RELICS.length);
  });

  it('needs Incense and Tithes', () => {
    const save = newSave();
    save.tithes = 0;
    expect(relicBlock(save, 'faith1')).toMatch(/Incense/);
    save.items = { incense1: 10 };
    expect(relicBlock(save, 'faith1')).toMatch(/Tithes/);
  });

  it('lifts every Sister, and her Power', () => {
    const save = rich();
    const c = CRUSADERS[0];
    save.owned[c.id] = { level: 10, vow: 0 };
    const before = sisterStats(save, c);
    const p0 = sisterPower(save, c);
    consecrate(save, 'wrath1');
    consecrate(save, 'faith1');
    expect(reliquaryBonus(save)).toMatchObject({ atkPct: 0.02, hpPct: 0.02 });
    const after = sisterStats(save, c);
    expect(after.atk).toBeGreaterThan(before.atk);
    expect(after.hp).toBeGreaterThan(before.hp);
    expect(sisterPower(save, c)).toBeGreaterThan(p0);
  });
});
