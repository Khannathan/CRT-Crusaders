import { describe, expect, it } from 'vitest';
import { STEADY, sealLedger, sealsPerWeek } from './economy';

/**
 * Aaron's target (2026-11-23): a steady free player gets about 300 pulls a
 * month, so a UR (about 42 pulls with pity) comes roughly weekly. If this
 * fails, a Seal source changed: retune it or move the band on purpose.
 */
describe('the Seal economy', () => {
  it('pays a steady free player about 300 pulls a month', () => {
    const month = (sealsPerWeek() * 30) / 7;
    expect(month).toBeGreaterThan(260);
    expect(month).toBeLessThan(380);
  });

  it('stays in the band early and late on the road', () => {
    for (const road of [10, 50]) {
      const month = (sealsPerWeek({ ...STEADY, road }) * 30) / 7;
      expect(month).toBeGreaterThan(240);
      expect(month).toBeLessThan(400);
    }
  });

  it('has no single source above a quarter of the total', () => {
    const total = sealsPerWeek();
    for (const l of sealLedger()) expect(l.seals, l.source).toBeLessThan(total / 4);
  });
});
