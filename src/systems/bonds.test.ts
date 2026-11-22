import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { BOND_AT, MAX_BOND, addBond, anyUnheard, bondInfo, confessions, hear } from './bonds';
import { claimVigil } from './vigil';
import { sisterStats } from './stats';

const id = 'CC-W001';

describe('Sister bonds', () => {
  it('levels from XP, caps at 5, and only for owned Sisters', () => {
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
    expect(after.armor).toBe(before.armor);
  });

  it('new confessions show as unheard until heard', () => {
    const save = newSave();
    save.owned[id] = { level: 1, vow: 0 };
    expect(anyUnheard(save)).toBe(false);
    addBond(save, [id], BOND_AT[1]);
    expect(anyUnheard(save)).toBe(true);
    hear(save, id);
    expect(anyUnheard(save)).toBe(false);
  });

  it('every Sister has five confessions', () => {
    for (const c of CRUSADERS) {
      const cs = confessions(c);
      expect(cs).toHaveLength(MAX_BOND);
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
