import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { BOND_AT, BOND_CORE, MAX_BOND, addBond, anyBondRewards, anyUnheard, bondInfo, bondStats, claimBondRewards, confessions, hear } from './bonds';
import { claimVigil } from './vigil';
import { sisterStats } from './stats';

const id = 'IV-R-EXE';

describe('Sister bonds', () => {
  it('levels from XP, caps at 30, and only for owned Sisters', () => {
    const save = newSave();
    save.owned[id] = { level: 1, vow: 0 };
    expect(addBond(save, [id, 'CC-W999'], BOND_AT[0])).toEqual([id]);
    expect(bondInfo(save, id).level).toBe(1);
    expect(save.bonds!['CC-W999']).toBeUndefined();
    addBond(save, [id], 99999);
    expect(bondInfo(save, id)).toMatchObject({ level: MAX_BOND, max: true });
  });

  it('bond raises ATK and HP', () => {
    const save = newSave();
    save.owned[id] = { level: 10, vow: 0 };
    const c = CRUSADERS.find((x) => x.id === id)!;
    const before = sisterStats(save, c);
    addBond(save, [id], BOND_AT[MAX_BOND - 1]);
    const after = sisterStats(save, c);
    expect(after.atk).toBeGreaterThan(before.atk);
    expect(after.hp).toBeGreaterThan(before.hp);
    expect(after.armor).toBeGreaterThan(before.armor); // Devotion past bond X
  });

  it('new confessions show as unheard until heard', () => {
    const save = newSave();
    save.owned[id] = { level: 1, vow: 0 };
    expect(anyUnheard(save)).toBe(false);
    addBond(save, [id], BOND_AT[0]);
    expect(anyUnheard(save)).toBe(false); // the first confession opens at bond II
    addBond(save, [id], BOND_AT[1]);
    expect(anyUnheard(save)).toBe(true);
    hear(save, id);
    expect(anyUnheard(save)).toBe(false);
  });

  it('the curve is steep: bond X takes thousands of XP, bond XXX many times more', () => {
    expect(BOND_AT[BOND_CORE - 1]).toBeGreaterThan(4000);
    expect(BOND_AT[MAX_BOND - 1]).toBeGreaterThan(BOND_AT[BOND_CORE - 1] * 15);
  });

  it('past bond X each level adds a rotating Devotion buff', () => {
    const at10 = bondStats(10);
    expect(at10).toMatchObject({ atk: 0.1, hp: 0.1, armor: 0, mres: 0, crit: 0 });
    const at15 = bondStats(15);
    expect(at15.armor).toBeGreaterThan(0);
    expect(at15.mres).toBeGreaterThan(0);
    expect(at15.crit).toBeGreaterThan(0);
    expect(at15.atk).toBeGreaterThan(at10.atk);
  });

  it('bond rewards wait to be claimed, once each', () => {
    const save = newSave();
    save.owned[id] = { level: 1, vow: 0 };
    addBond(save, [id], BOND_AT[4]);
    expect(anyBondRewards(save)).toBe(true);
    const seals = save.seals;
    expect(claimBondRewards(save, id)).toEqual([1, 2, 3, 4, 5]);
    expect(save.seals).toBeGreaterThan(seals);
    expect(claimBondRewards(save, id)).toEqual([]);
    expect(anyBondRewards(save)).toBe(false);
  });

  it('every Sister has five confessions', () => {
    for (const c of CRUSADERS) {
      const cs = confessions(c);
      expect(cs).toHaveLength(5);
      for (const x of cs) expect(x.body.length).toBeGreaterThan(40);
    }
  });

  it('keeping Vigil together draws Sisters closer', () => {
    const save = newSave();
    save.owned[id] = { level: 5, vow: 0 };
    save.vigil = { crypt: 'drowned-ossuary', party: [id], since: 0 };
    claimVigil(save, 10 * 3.6e6);
    expect(bondInfo(save, id).xp).toBe(20);
  });
});
