import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { ORDER_LIST } from '../data/orders';
import { newSave } from '../state/save';
import { bondInfo } from './bonds';
import { autoBattle } from './autoplay';
import { FAVOURED, OFFERINGS, PROCESSION_ENTRIES, POTENCY_XP, candleReady, finishProcession, giveOfferings, heldOf, lightCandle, offer, offeringOfDay, processionBattle, processionDrops, processionLeft, processionSweepTier, sweepProcession, tierOpen } from './offerings';
import { buy, offersAt } from './shop';

const c = CRUSADERS[0];
const DAY = Date.UTC(2026, 10, 22, 12);

describe('offerings', () => {
  it('every Order favours one common and one finer offering', () => {
    for (const o of ORDER_LIST) {
      const [a, b] = FAVOURED[o.name];
      expect(OFFERINGS.find((x) => x.id === a)!.potency).toBe('common');
      expect(OFFERINGS.find((x) => x.id === b)!.potency).not.toBe('common');
    }
  });

  it('a favoured offering gives double bond, and spends one', () => {
    const save = newSave();
    save.owned[c.id] = { level: 1, vow: 0 };
    const [fav] = FAVOURED[c.order];
    const plain = OFFERINGS.find((o) => o.potency === 'common' && !FAVOURED[c.order].includes(o.id))!.id;
    giveOfferings(save, [fav, plain]);
    expect(offer(save, c.id, plain)).toBe(true);
    expect(bondInfo(save, c.id).xp).toBe(POTENCY_XP.common);
    expect(offer(save, c.id, fav)).toBe(true);
    expect(bondInfo(save, c.id).xp).toBe(POTENCY_XP.common * 3);
    expect(heldOf(save, fav)).toBe(0);
    expect(offer(save, c.id, fav)).toBe(false);
  });

  it('the free candle lights once a day', () => {
    const save = newSave();
    save.owned[c.id] = { level: 1, vow: 0 };
    expect(candleReady(save, DAY)).toBe(true);
    expect(lightCandle(save, c.id, DAY)).toBe(true);
    expect(lightCandle(save, c.id, DAY)).toBe(false);
    expect(candleReady(save, DAY + 86_400_000)).toBe(true);
  });

  it('the Shop sells one offering of the day for Gilt', () => {
    const save = newSave();
    save.gilt = 1000;
    const o = offersAt(save, 'gilt', DAY)[0];
    expect(o.goods.offering).toBe(offeringOfDay(DAY).id);
    expect(buy(save, o, { now: DAY })).toBeDefined();
    expect(heldOf(save, o.goods.offering!)).toBe(1);
    expect(buy(save, o, { now: DAY })).toBeUndefined();
  });

  it('the procession pays only on a win, three a day, and opens the next tier', () => {
    const save = newSave();
    const party = CRUSADERS.slice(0, 4).map((x) => x.id);
    for (const id of party) save.owned[id] = { level: 60, vow: 5 };
    expect(tierOpen(save, 1)).toBe(false);
    for (let i = 0; i < PROCESSION_ENTRIES; i++) {
      const b = processionBattle(save, party, 0);
      autoBattle(b);
      const r = finishProcession(save, 0, b, Math.random, Date.now());
      expect(r.won).toBe(true);
      expect(r.offerings.length).toBe(2);
    }
    expect(processionLeft(save)).toBe(0);
    expect(tierOpen(save, 1)).toBe(true);
    expect(processionDrops(3).length).toBe(4);
  });
});

describe('Procession sweeps', () => {
  it('replays the highest tier won until entries run out', () => {
    const save = newSave();
    expect(processionSweepTier(save, DAY)).toBeUndefined();
    save.procession = { day: '', used: 0, best: 3 }; // an older save: tiers 0-2 won
    expect(processionSweepTier(save, DAY)).toBe(2);
    let n = 0;
    for (let p = sweepProcession(save, () => 0.5, DAY); p; p = sweepProcession(save, () => 0.5, DAY)) {
      expect(p.tier).toBe(2);
      expect(p.offerings.length).toBeGreaterThan(0);
      n++;
    }
    expect(n).toBe(PROCESSION_ENTRIES);
    expect(processionLeft(save, DAY)).toBe(0);
  });
});
