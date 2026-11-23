import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { track } from './tasks';
import { giltOf } from './currency';
import { DEEDS, POINT_TITLES, TIER_REWARDS, claimDeeds, claimedTiers, deedPoints, deedReady, reachedTiers } from './deeds';

describe('Deeds', () => {
  it('twenty ladders of five rising tiers, each with its own title', () => {
    expect(DEEDS).toHaveLength(20);
    expect(new Set(DEEDS.map((d) => d.id)).size).toBe(20);
    for (const d of DEEDS) {
      expect(d.tiers).toHaveLength(5);
      for (let i = 1; i < 5; i++) expect(d.tiers[i]).toBeGreaterThan(d.tiers[i - 1]);
    }
  });

  it('lifetime counts fill a ladder; a claim pays every tier reached once', () => {
    const save = newSave();
    track(save, 'fightWon', 600);
    const gilt = giltOf(save);
    const seals = save.seals;
    const slayer = DEEDS.find((d) => d.id === 'fights')!;
    expect(reachedTiers(save, slayer)).toBe(2);
    expect(deedReady(save, slayer)).toBe(true);
    const r = claimDeeds(save, 'fights')!;
    expect(r.reward.gilt).toBe((TIER_REWARDS[0].gilt ?? 0) + (TIER_REWARDS[1].gilt ?? 0));
    expect(save.seals).toBe(seals + (TIER_REWARDS[0].seals ?? 0) + (TIER_REWARDS[1].seals ?? 0));
    expect(giltOf(save) - gilt).toBe(r.reward.gilt);
    expect(claimedTiers(save, 'fights')).toBe(2);
    expect(claimDeeds(save, 'fights')).toBeUndefined();
  });

  it('the top tier and enough points earn titles', () => {
    const save = newSave();
    track(save, 'fightWon', 10000);
    track(save, 'bossWon', 1000);
    track(save, 'enhance', 1500);
    const r = claimDeeds(save)!;
    expect(r.titles).toContain('Slayer of Ten Thousand');
    expect(deedPoints(save)).toBeGreaterThanOrEqual(POINT_TITLES[0].at);
    expect(save.titles).toContain(POINT_TITLES[0].title);
  });
});
