import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { MATINS, MATINS_DAYS, lightCandle, matinsOf, matinsReady } from './matins';

const DAY = 864e5;
const t0 = new Date(2026, 10, 18, 10).getTime();

describe('Matins calendar', () => {
  it('lights one candle per local day', () => {
    const save = newSave();
    const tithes = save.tithes;
    expect(lightCandle(save, t0)?.day).toBe(1);
    expect(save.tithes).toBe(tithes + (MATINS[0].tithes ?? 0));
    expect(matinsReady(save, t0 + 1000)).toBe(false);
    expect(lightCandle(save, t0 + 1000)).toBeUndefined();
    expect(lightCandle(save, t0 + DAY)?.day).toBe(2);
  });

  it('missed days never reset the count', () => {
    const save = newSave();
    lightCandle(save, t0);
    lightCandle(save, t0 + DAY);
    expect(lightCandle(save, t0 + 10 * DAY)?.day).toBe(3);
  });

  it('candle 28 gives a chosen Sister a Vow token, then the calendar starts over', () => {
    const save = newSave();
    const id = CRUSADERS[0].id;
    save.owned[id] = { level: 1, vow: 0 };
    for (let d = 0; d < MATINS_DAYS - 1; d++) lightCandle(save, t0 + d * DAY);
    const last = t0 + (MATINS_DAYS - 1) * DAY;
    expect(lightCandle(save, last)).toBeUndefined(); // must pick a Sister
    expect(lightCandle(save, last, id)?.reward.vowToken).toBe(true);
    expect(save.owned[id].tokens).toBe(1);
    expect(matinsOf(save).lit).toBe(0);
    expect(save.gear!.length).toBeGreaterThan(3); // gear candles paid out
  });
});
