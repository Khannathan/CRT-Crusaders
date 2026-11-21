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
