import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { GILT_START, almsOf, giltOf } from './currency';
import { countOf } from './items';
import { GILT_OFFERS, REFRESH_GILT, TITHE_OFFERS, buy, buyBlock, offersAt, refreshAlmonry, shopOf } from './shop';
import { salvage, gearOf } from './gear';
import { seeded } from './rng';

const day = new Date(2026, 10, 23, 12).getTime(); // a Monday

describe('Shop', () => {
  it('Gilt buys Seals up to the daily limit', () => {
    const save = newSave();
    expect(giltOf(save)).toBe(GILT_START);
    const seal = GILT_OFFERS.find((o) => o.id === 'g-seal')!;
    save.gilt = 10_000;
    for (let i = 0; i < seal.limit; i++) expect(buy(save, seal, { now: day })).toBeTruthy();
    expect(buyBlock(save, seal, day)).toMatch(/Sold out/);
    expect(save.seals).toBe(30 + seal.limit);
    // the next day the limit is back
    expect(buyBlock(save, seal, day + 864e5)).toBeUndefined();
  });

  it('Tithe Exchange limits reset weekly, and pay materials', () => {
    const save = newSave();
    save.tithes = 100_000;
    const ash = TITHE_OFFERS.find((o) => o.id === 't-ash')!;
    for (let i = 0; i < ash.limit; i++) buy(save, ash, { now: day });
    expect(countOf(save, 'ash1')).toBe(5 * ash.limit);
    expect(buyBlock(save, ash, day + 864e5)).toMatch(/this week/);
    expect(buyBlock(save, ash, day + 7 * 864e5)).toBeUndefined();
  });

  it('the Almonry stocks six a day, the same all day; the first refresh is free', () => {
    const save = newSave();
    const a = offersAt(save, 'almonry', day).map((o) => o.id);
    expect(a.length).toBe(6);
    expect(offersAt(save, 'almonry', day + 3600e3).map((o) => o.id)).toEqual(a);
    const g = giltOf(save);
    expect(refreshAlmonry(save, day, seeded(2))).toBe(true);
    expect(giltOf(save)).toBe(g);
    expect(refreshAlmonry(save, day, seeded(3))).toBe(true);
    expect(giltOf(save)).toBe(g - REFRESH_GILT);
    expect(shopOf(save, day).refreshes).toBe(2);
  });

  it('melting gear pays Alms', () => {
    const save = newSave();
    const piece = gearOf(save)[0];
    salvage(save, piece.uid);
    expect(almsOf(save)).toBeGreaterThan(0);
  });
});
