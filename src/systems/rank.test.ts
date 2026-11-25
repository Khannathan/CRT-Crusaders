import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { MAX_RANK, claimGifts, giftsWaiting, rankFromXp, rankGift, rankInfo, rankOf, rankStep } from './rank';
import { track } from './tasks';

describe('Rank of Faith', () => {
  it('climbs by rank steps and stops at the top', () => {
    expect(rankFromXp(0).rank).toBe(1);
    expect(rankFromXp(rankStep(1) - 1).rank).toBe(1);
    expect(rankFromXp(rankStep(1)).rank).toBe(2);
    expect(rankFromXp(1e9)).toEqual({ rank: MAX_RANK, into: 0, need: 0 });
  });

  it('every tracked deed earns Faith, and gifts are claimed once', () => {
    const save = newSave();
    expect(rankInfo(save).rank).toBe(1);
    track(save, 'cryptCleared', 3);
    expect(rankOf(save).xp).toBe(150);
    expect(rankInfo(save).rank).toBe(2);
    expect(giftsWaiting(save)).toEqual([2]);
    const seals = save.seals;
    expect(claimGifts(save)).toEqual(rankGift(2));
    expect(save.seals).toBe(seals + rankGift(2).seals);
    expect(giftsWaiting(save)).toEqual([]);
  });

  it('an older save starts with Faith for its progress, with no backlog of gifts', () => {
    const save = newSave();
    save.owned['a'] = { level: 15, vow: 0 };
    save.cleared = ['drowned-ossuary'];
    save.totalPulls = 40;
    expect(rankInfo(save).rank).toBeGreaterThan(1);
    expect(giftsWaiting(save)).toEqual([]);
  });
});

describe('modes open over two weeks', () => {
  it('a new save opens modes one rank at a time, the last near Rank XVII', async () => {
    const { UNLOCKS, opened, rankFor } = await import('./rank');
    const ranks = UNLOCKS.map((u) => u.rank);
    for (const r of new Set(ranks)) expect(ranks.filter((x) => x === r).length).toBeLessThanOrEqual(1);
    expect(Math.max(...ranks)).toBeGreaterThanOrEqual(15);
    const save = newSave();
    expect(opened(save, 'Trials')).toBe(false);
    save.rank!.xp = Array.from({ length: rankFor('Trials') - 1 }, (_, i) => rankStep(i + 1)).reduce((a, b) => a + b, 0);
    expect(rankInfo(save).rank).toBe(rankFor('Trials'));
    expect(opened(save, 'Trials')).toBe(true);
    expect(opened(save, 'Inquisition')).toBe(false);
    expect(opened(save, 'Campaign')).toBe(true); // ungated screens are always open
  });

  it('a save from before the schedule keeps every mode it had opened', async () => {
    const { opened } = await import('./rank');
    const save = newSave();
    // Rank VI under the old schedule: the Tower (old Rank VI) was open.
    save.rank = { xp: Array.from({ length: 5 }, (_, i) => rankStep(i + 1)).reduce((a, b) => a + b, 0), gifted: 6 };
    expect(opened(save, 'Tower')).toBe(true);
    expect(opened(save, 'Raid')).toBe(true);
    expect(opened(save, 'Inquisition')).toBe(false); // old Rank VIII, not reached
  });

});
