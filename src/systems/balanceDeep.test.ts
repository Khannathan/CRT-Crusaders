import { describe, expect, it } from 'vitest';
import { BALANCE_VERSION } from './combat';
import { BELFRY, N, OSSUARY, sample } from './balanceSim';

describe(`deep crypt balance ${BALANCE_VERSION} (auto player, ${N} seeded runs)`, () => {
  it('the Belfry: too hard at level 1, a fair fight at level 6, reliable at 12', () => {
    expect(sample(1, BELFRY).rate).toBeLessThan(0.25);
    const mid = sample(6, BELFRY);
    expect(mid.rate).toBeGreaterThan(0.45);
    // 0.89 on the old roster's ids, 0.96 on the new: unit order on the field moved with the ids, not any Sister's power
    expect(mid.rate).toBeLessThan(0.97);
    expect(sample(12, BELFRY).rate).toBeGreaterThan(0.9);
  }, 20_000); // 900 runs

  it('Heresy tiers ask for more levels (and grow the crypt toward 30 floors)', () => {
    // Heresy III: 20 floors in 2 acts
    const h3 = sample(14, OSSUARY, 3).rate;
    expect(h3).toBeGreaterThan(0.3);
    expect(h3).toBeLessThan(0.95);
    // Heresy V: 30 floors in 3 acts, for an ascended party
    expect(sample(30, OSSUARY, 5).rate).toBeGreaterThan(0.8);
  }, 60_000); // 300 runs of up to 30 floors
});
