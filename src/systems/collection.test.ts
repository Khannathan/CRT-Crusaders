import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { GRAND_SET, SETS, claimSet, claimable, setDone } from './collection';

describe('Order Book sets', () => {
  it('only R and SR Sisters count, and each set pays once', () => {
    for (const set of SETS) {
      expect(set.members.length).toBeGreaterThan(0);
      for (const id of set.members) expect(['R', 'SR']).toContain(CRUSADERS.find((c) => c.id === id)!.rarity);
    }
    const save = newSave();
    const set = SETS[0];
    // URs and SSRs of the Order do nothing for the set
    for (const c of CRUSADERS.filter((c) => c.rarity === 'UR' || c.rarity === 'SSR')) save.owned[c.id] = { level: 1, vow: 0 };
    expect(setDone(save, set)).toBe(false);
    for (const id of set.members) save.owned[id] = { level: 1, vow: 0 };
    expect(claimable(save)).toEqual([set.id]);
    const seals = save.seals;
    expect(claimSet(save, set.id)).toBe(10);
    expect(save.seals).toBe(seals + 10);
    expect(save.title).toBe(set.title);
    expect(claimSet(save, set.id)).toBe(0);
  });

  it('the grand set opens once every Order set is claimed', () => {
    const save = newSave();
    for (const c of CRUSADERS) save.owned[c.id] = { level: 1, vow: 0 };
    for (const s of SETS) claimSet(save, s.id);
    expect(claimable(save)).toEqual([GRAND_SET]);
    expect(claimSet(save, GRAND_SET)).toBe(30);
  });
});
