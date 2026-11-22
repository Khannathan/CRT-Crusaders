import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { ascend } from './ascension';
import { autoBattle } from './autoplay';
import { stageBattle } from './campaign';
import { UNCTION_EXP, addExp, expBattle, expToNext, expTotal, feed, feedPlan } from './exp';
import { give } from './items';
import { levelCap } from './stats';

const id = CRUSADERS[0].id;

describe('Sister EXP', () => {
  it('each level needs more than the last', () => {
    for (let l = 1; l < 50; l++) expect(expToNext(l + 1)).toBeGreaterThan(expToNext(l));
    expect(expTotal(1)).toBe(0);
    expect(expTotal(3)).toBe(expToNext(1) + expToNext(2));
  });

  it('EXP levels her up and banks at her cap', () => {
    const save = newSave();
    save.owned[id] = { level: 1, vow: 0 };
    expect(addExp(save, id, expToNext(1) + 5)).toBe(1);
    expect(save.owned[id].exp).toBe(5);
    addExp(save, id, 10_000_000);
    expect(save.owned[id].level).toBe(levelCap(save.owned[id]));
    expect(save.owned[id].exp).toBe(expToNext(save.owned[id].level));
  });

  it('banked EXP flows on after Ascension', () => {
    const save = newSave();
    save.owned[id] = { level: 1, vow: 0 };
    addExp(save, id, 10_000_000);
    save.items = { ash1: 999, ash2: 999, ash3: 999 };
    save.tithes = 1e9;
    expect(ascend(save, id)).toBe(true);
    expect(save.owned[id].level).toBe(21);
  });

  it('Unction feeds levels for Tithes, biggest flasks first', () => {
    const save = newSave();
    save.owned[id] = { level: 1, vow: 0 };
    save.items = {};
    expect(feedPlan(save, id, 1).block).toBe('unction');
    give(save, { unction1: 1 });
    save.tithes = 0;
    expect(feedPlan(save, id, 1).block).toBe('tithes');
    save.tithes = 1000;
    give(save, { unction3: 1 });
    const plan = feedPlan(save, id, 1);
    expect(plan.levels).toBe(1);
    expect(plan.items).toEqual({ unction1: 1 });
    expect(plan.tithes).toBe(UNCTION_EXP.unction1 / 10);
    expect(feed(save, id, 999)).toBeGreaterThan(1);
  });

  it('a won fight gives battle EXP to the Sisters standing', () => {
    const save = newSave();
    const party = CRUSADERS.slice(0, 4).map((c) => c.id);
    for (const p of party) save.owned[p] = { level: 40, vow: 5, asc: 2 };
    const b = stageBattle(save, party, 1);
    autoBattle(b);
    const r = expBattle(save, b);
    expect(r.exp).toBeGreaterThan(0);
    expect(save.owned[party[0]].exp).toBe(r.exp);
  });
});

describe('choosing an Unction', () => {
  it('uses 1, 10, a level or all of the chosen flask, never past her full cap', async () => {
    const { usePlan, useUnction, expRoom } = await import('./exp');
    const save = newSave();
    const id = CRUSADERS[0].id;
    save.owned[id] = { level: 1, vow: 0 };
    save.items = { unction1: 50 };
    save.tithes = 1e6;
    expect(usePlan(save, id, 'unction1', 10).count).toBe(10);
    expect(usePlan(save, id, 'unction2', 1).block).toBe('unction');
    expect(useUnction(save, id, 'unction1', 1, true)).toBeGreaterThanOrEqual(1);
    const all = usePlan(save, id, 'unction1', Infinity);
    expect(all.count).toBeLessThanOrEqual(Math.ceil(expRoom(save, id) / 300));
    useUnction(save, id, 'unction1', Infinity);
    expect(save.items.unction1).toBe(49 - all.count);
  });
});
