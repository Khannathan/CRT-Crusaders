import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { ERRAND_SLOTS, errandsOf, openErrands } from './errands';
import { gearOf, makeGear, MAX_GEAR_LEVEL } from './gear';
import { claimAllErrands, enhanceTo, meltSpares, nextMilestone, quickSend, quickSendPlan, quickVowPlan, spareGear, takeQuickVows } from './quick';
import { MAX_VOW } from './tiers';

const NOON = new Date(2026, 10, 23, 12).getTime();

describe('Quick Vow', () => {
  it('takes every Vow copies pay for, never with Stigmata, rarest first when Tithes run short', () => {
    const save = newSave();
    const ur = CRUSADERS.find((c) => c.rarity === 'UR')!;
    const r = CRUSADERS.find((c) => c.rarity === 'R')!;
    save.owned = { [ur.id]: { level: 1, vow: 0, tokens: 2 }, [r.id]: { level: 1, vow: 0, tokens: 1 } };
    save.stigmata = 99;
    save.tithes = 300; // Vow 1 (150) + Vow 2 (300) would be 450: only the UR's first fits, then the R's (150)
    const plan = quickVowPlan(save);
    expect(plan.steps[0].id).toBe(ur.id);
    expect(plan.vows).toBe(2);
    takeQuickVows(save);
    expect(save.owned[ur.id].vow).toBe(1);
    expect(save.owned[r.id].vow).toBe(1);
    expect(save.tithes).toBe(0);
    expect(save.stigmata).toBe(99);
  });

  it('stops at the fifth Vow (tier rise stays a choice)', () => {
    const save = newSave();
    const c = CRUSADERS[0];
    save.owned = { [c.id]: { level: 1, vow: 0, tokens: 50 } };
    save.tithes = 1e6;
    takeQuickVows(save);
    expect(save.owned[c.id].vow).toBe(MAX_VOW);
    expect(save.owned[c.id].tier ?? 0).toBe(0);
    expect(quickVowPlan(save).vows).toBe(0);
  });
});

describe('Quick Send and Claim all', () => {
  it('fills every free slot, then brings them all home', () => {
    const save = newSave();
    for (const c of CRUSADERS.slice(0, 14)) save.owned[c.id] = { level: 1, vow: 0 };
    // one SSR or better so the long errand can go
    const ssr = CRUSADERS.find((c) => c.rarity === 'SSR')!;
    save.owned[ssr.id] = { level: 1, vow: 0 };
    const plan = quickSendPlan(save, NOON);
    expect(plan.length).toBe(ERRAND_SLOTS);
    const sent = quickSend(save, NOON);
    expect(sent.length).toBe(ERRAND_SLOTS);
    const used = sent.flatMap((s) => s.sisters);
    expect(new Set(used).size).toBe(used.length);
    expect(openErrands(save, NOON).length).toBe(2);
    expect(quickSendPlan(save, NOON)).toEqual([]);
    const later = NOON + 21 * 3600_000;
    const before = save.tithes;
    const got = claimAllErrands(save, later);
    expect(got.count).toBe(ERRAND_SLOTS);
    expect(save.tithes - before).toBe(got.reward.tithes);
    expect(errandsOf(save, later).active.length).toBe(0);
  });
});

describe('Gear conveniences', () => {
  it('melts only unworn, unenhanced spares', () => {
    const save = newSave();
    const rng = () => 0.3;
    const list = gearOf(save);
    list.length = 0;
    const mk = (r: 'R' | 'SR' | 'SSR', extra = {}) => list.push({ ...makeGear(rng, r), uid: `x${list.length}`, ...extra });
    mk('R');
    mk('SR');
    mk('SSR');
    mk('R', { on: 'someone' });
    mk('SR', { level: 2 });
    expect(spareGear(save).length).toBe(2);
    const t = save.tithes;
    const m = meltSpares(save);
    expect(m.count).toBe(2);
    expect(save.tithes - t).toBe(m.tithes);
    expect(list.length).toBe(3);
  });

  it('enhances to the next substat roll', () => {
    const save = newSave();
    const item = { ...makeGear(() => 0.3, 'SR'), uid: 'e1' };
    expect(nextMilestone(item)).toBe(3);
    save.tithes = 1e6;
    expect(enhanceTo(save, item)).toBe(3);
    expect(item.level).toBe(3);
    item.level = 9;
    expect(nextMilestone(item)).toBe(MAX_GEAR_LEVEL);
    save.tithes = 0;
    expect(enhanceTo(save, item)).toBe(0);
    expect(nextMilestone({ level: 0, subs: [] })).toBe(MAX_GEAR_LEVEL);
  });
});

describe('Roster dot', () => {
  it('matches the Quick Vow plan', async () => {
    const { quickVowReady } = await import('./quick');
    const save = newSave();
    const c = CRUSADERS[0];
    save.owned = { [c.id]: { level: 1, vow: 0, tokens: 0 } };
    save.tithes = 1000;
    expect(quickVowReady(save)).toBe(false);
    save.owned[c.id].tokens = 1;
    expect(quickVowReady(save)).toBe(quickVowPlan(save).vows > 0);
    save.tithes = 0;
    expect(quickVowReady(save)).toBe(false);
  });
});
