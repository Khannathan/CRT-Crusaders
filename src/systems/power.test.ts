import { BELFRY, OSSUARY, cryptRecommended } from './crusade';
import { floorRecommended } from './tower';
import { actRecommended } from './inquisition';
import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { equip, makeGear } from './gear';
import { claimGear } from './gear';
import { seeded } from './rng';
import { accountPower, gearPower, gearSwapDelta, partyPower, powerVerdict, sisterPower } from './power';

const byRarity = (r: string, cls: string) => CRUSADERS.find((c) => c.rarity === r && c.classId === cls)!;

describe('Power', () => {
  it('rises with level, Vows and rarity', () => {
    const save = newSave();
    const r = byRarity('R', 'warsister');
    save.owned[r.id] = { level: 1, vow: 0 };
    const base = sisterPower(save, r);
    expect(base).toBeGreaterThan(900);
    expect(base).toBeLessThan(1200);
    save.owned[r.id] = { level: 20, vow: 0 };
    const lv = sisterPower(save, r);
    expect(lv).toBeGreaterThan(base);
    save.owned[r.id] = { level: 20, vow: 3 };
    expect(sisterPower(save, r)).toBeGreaterThan(lv);
    const ur = CRUSADERS.find((c) => c.rarity === 'UR' && c.classId === 'warsister')!;
    save.owned[ur.id] = { level: 1, vow: 0 };
    save.owned[r.id] = { level: 1, vow: 0 };
    expect(sisterPower(save, ur)).toBeGreaterThan(sisterPower(save, r));
  });

  it('gear adds power, and a swap shows its change', () => {
    const save = newSave();
    const c = byRarity('R', 'inquisitor');
    save.owned[c.id] = { level: 10, vow: 0 };
    const before = sisterPower(save, c);
    claimGear(save, [makeGear(seeded(1), 'SSR', 'blade')]);
    const item = save.gear![save.gear!.length - 1];
    const delta = gearSwapDelta(save, c, item);
    expect(delta).toBeGreaterThan(0);
    equip(save, c.id, item.uid);
    expect(sisterPower(save, c)).toBe(before + delta);
    expect(gearPower(save, c, item)).toBe(delta);
  });

  it('account power is the strongest four', () => {
    const save = newSave();
    const ids = CRUSADERS.slice(0, 6).map((c) => c.id);
    ids.forEach((id, i) => (save.owned[id] = { level: 1 + i * 5, vow: 0 }));
    const top4 = CRUSADERS.slice(0, 6)
      .map((c) => sisterPower(save, c))
      .sort((a, b) => b - a)
      .slice(0, 4)
      .reduce((a, b) => a + b, 0);
    expect(accountPower(save)).toBe(top4);
  });

  it('recommended power: the starter party meets the Ossuary by level 5, and harder fights ask more', () => {
    const save = newSave();
    const starter = ['CC-W013', 'CC-W052', 'CC-W001', 'CC-W022'];
    for (const id of starter) save.owned[id] = { level: 5, vow: 0 };
    const ossuary = cryptRecommended(save, OSSUARY);
    expect(powerVerdict(partyPower(save, starter), ossuary)).toBe('ready');
    for (const id of starter) save.owned[id] = { level: 1, vow: 0 };
    expect(powerVerdict(partyPower(save, starter), ossuary)).not.toBe('ready');
    expect(cryptRecommended(save, OSSUARY, 2)).toBeGreaterThan(ossuary);
    expect(cryptRecommended(save, BELFRY)).toBeGreaterThan(ossuary);
    expect(floorRecommended(save, 30)).toBeGreaterThan(floorRecommended(save, 1));
    expect(actRecommended(save, 2)).toBeGreaterThan(0);
    expect(ossuary % 100).toBe(0);
  });
});
