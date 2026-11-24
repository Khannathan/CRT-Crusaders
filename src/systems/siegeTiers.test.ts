import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { SIEGE_POOL, SIEGE_TIERS, chapterOf, claimTiers, foundChapter, placeReward, siegeBeast, siegePlace, tierProgress, tiersReady } from './chapter';

const D = (d: number, h = 10) => new Date(2026, 10, 16 + d, h).getTime(); // Monday 16 Nov 2026

describe('the Siege: your damage tiers and weekly place', () => {
  it('tiers open as your own damage grows, and pay once', () => {
    const s = newSave();
    const c = foundChapter(s, D(0), 11);
    const unit = siegeBeast(s, D(0)).pool / SIEGE_POOL;
    expect(tiersReady(s, D(0))).toEqual([]);
    c.siege.by.you = Math.ceil(SIEGE_TIERS[1].at * unit);
    expect(tiersReady(s, D(0))).toEqual([0, 1]);
    expect(tierProgress(s, D(0)).reached).toBe(2);
    const marks = c.marks;
    const seals = s.seals;
    expect(claimTiers(s, D(0))).toHaveLength(2);
    expect(c.marks - marks).toBe(SIEGE_TIERS[0].reward.marks + SIEGE_TIERS[1].reward.marks);
    expect(s.seals - seals).toBe((SIEGE_TIERS[0].reward.seals ?? 0) + (SIEGE_TIERS[1].reward.seals ?? 0));
    expect(tiersReady(s, D(0))).toEqual([]);
  });

  it('a better place pays more', () => {
    expect(placeReward(1).marks).toBeGreaterThan(placeReward(3).marks);
    expect(placeReward(3).marks).toBeGreaterThan(placeReward(8).marks);
    expect(placeReward(8).marks).toBeGreaterThan(placeReward(14).marks);
  });

  it('when the week turns, your tiers and your place are paid', () => {
    const s = newSave();
    const c = foundChapter(s, D(0), 11);
    const unit = siegeBeast(s, D(0)).pool / SIEGE_POOL;
    c.siege.by.you = Math.ceil(SIEGE_TIERS[0].at * unit) + 10 ** 9; // first place, all tiers
    expect(siegePlace(s)).toBe(1);
    const seals = s.seals;
    chapterOf(s, D(7));
    expect(c.siege.by.you).toBeUndefined();
    const tierSeals = SIEGE_TIERS.reduce((n, t) => n + (t.reward.seals ?? 0), 0);
    expect(s.seals - seals).toBeGreaterThanOrEqual(tierSeals + (placeReward(1).seals ?? 0));
    expect(c.log.some((l) => /placed 1 of/.test(l.text))).toBe(true);
  });
});
