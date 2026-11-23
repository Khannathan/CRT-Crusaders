import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { giltOf } from './currency';
import { CANDLE_GILT, candlesFor, lightCandles, stageCandles, totalCandles } from './candles';

describe('candles', () => {
  it('lights by how the stage was won', () => {
    expect(candlesFor({ fallen: 0, chainBest: 3, secs: 20 })).toEqual([true, true, true]);
    expect(candlesFor({ fallen: 1, chainBest: 2, secs: 60 })).toEqual([false, false, false]);
  });

  it('pays Gilt once per new candle and a Seal for the full set', () => {
    const save = newSave();
    const gilt0 = giltOf(save);
    const seals0 = save.seals;
    const a = lightCandles(save, 3, { fallen: 0, chainBest: 0, secs: 90 });
    expect(a.fresh).toEqual([true, false, false]);
    expect(a.gilt).toBe(CANDLE_GILT);
    expect(a.seals).toBe(0);
    // the same candle again pays nothing
    expect(lightCandles(save, 3, { fallen: 0, chainBest: 0, secs: 90 }).gilt).toBe(0);
    const b = lightCandles(save, 3, { fallen: 2, chainBest: 4, secs: 30 });
    expect(b.fresh).toEqual([false, true, true]);
    expect(b.seals).toBe(1);
    expect(stageCandles(save, 3)).toEqual([true, true, true]);
    expect(totalCandles(save)).toBe(3);
    expect(giltOf(save) - gilt0).toBe(3 * CANDLE_GILT);
    expect(save.seals - seals0).toBe(1);
    // a full stage never pays its Seal twice
    expect(lightCandles(save, 3, { fallen: 0, chainBest: 9, secs: 1 }).seals).toBe(0);
  });
});
