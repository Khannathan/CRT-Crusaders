import { describe, expect, it } from 'vitest';
import { BALANCE_VERSION } from './combat';
import { N, sample } from './balanceSim';

describe(`crypt balance ${BALANCE_VERSION} (auto player, ${N} seeded runs)`, () => {
  it('level 1, all R: a real challenge but winnable', () => {
    const { rate } = sample(1);
    expect(rate).toBeGreaterThan(0.4);
    expect(rate).toBeLessThan(0.75);
  }, 20_000); // 300 runs: slow on CI runners

  it('level 5: clears reliably, first Rite around rounds 4-6', () => {
    const { rate, median } = sample(5);
    expect(rate).toBeGreaterThan(0.85);
    expect(median).toBeGreaterThanOrEqual(4);
    expect(median).toBeLessThanOrEqual(6);
  }, 20_000); // 300 runs: slow on CI runners

  it('level 10: almost always clears', () => {
    expect(sample(10).rate).toBeGreaterThan(0.97);
  }, 20_000); // 300 runs: slow on CI runners
});
