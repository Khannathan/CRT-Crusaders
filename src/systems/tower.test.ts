import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { autoBattle } from './autoplay';
import { seeded } from './rng';
import type { Battle } from './combat';
import { ORDER_LIST } from '../data/orders';
import { ORDER_PARTY, ORDER_TOWER_FLOORS, finishOrderFloor, orderBest, orderFloorDef, orderTowerBattle, TOWER_FLOORS, TOWER_GROWTH, allowedOn, finishFloor, floorDef, floorRecommended, towerBattle, towerOf, towerScale } from './tower';

const party = ['SW-R-WAR', 'DL-R-HIE', 'IV-R-EXE', 'SW-SR-CON'];

describe('Bell Tower', () => {
  it('bosses every 10th floor, humble floors between, no Order floors, rising strength', () => {
    expect(floorDef(10).boss).toBe(true);
    expect(floorDef(5).rule).toBeUndefined();
    expect(floorDef(8).rule?.kind).toBe('humble');
    expect(floorDef(40).scale).toBeGreaterThan(floorDef(20).scale);
    for (let f = 1; f <= TOWER_FLOORS; f++) expect(floorDef(f).rule?.kind).not.toBe('order');
    const order = orderFloorDef(ORDER_LIST[0].name, 15).rule;
    const allow = allowedOn(order);
    expect(CRUSADERS.filter(allow).length).toBeGreaterThanOrEqual(5);
    expect(allowedOn(floorDef(8).rule)(CRUSADERS.find((c) => c.rarity === 'UR')!)).toBe(false);
    for (let f = 1; f <= TOWER_FLOORS; f++) expect(floorDef(f).encounter).toBeTruthy();
  });

  it('only the next floor pays, and only on a win', () => {
    const save = newSave();
    for (const id of party) save.owned[id] = { level: 20, vow: 5 };
    const b = towerBattle(save, party, 1, seeded(4));
    autoBattle(b, 600);
    const tithes = save.tithes;
    const r = finishFloor(save, 1, b);
    expect(r.won).toBe(true);
    expect(towerOf(save).best).toBe(1);
    expect(save.tithes).toBeGreaterThan(tithes);
    // replaying a cleared floor pays nothing
    const again = towerBattle(save, party, 1, seeded(5));
    autoBattle(again, 600);
    expect(finishFloor(save, 1, again).reward).toBeUndefined();
  });

  it('a locked floor fields only allowed Sisters', () => {
    const save = newSave();
    for (const id of party) save.owned[id] = { level: 5, vow: 0 };
    const b = towerBattle(save, party, 8, seeded(1));
    const ids = b.units.filter((u) => u.side === 'party').map((u) => u.ref);
    expect(ids.every((id) => ['R', 'SR'].includes(CRUSADERS.find((c) => c.id === id)!.rarity))).toBe(true);
  });

  it('never ends: past floor 60 foes grow by a fixed share a floor, and a maxed party tops out near 100', () => {
    expect(towerScale(TOWER_FLOORS + 1) / towerScale(TOWER_FLOORS)).toBeCloseTo(TOWER_GROWTH);
    expect(towerScale(TOWER_FLOORS + 10) / towerScale(TOWER_FLOORS + 9)).toBeCloseTo(TOWER_GROWTH);
    const save = newSave();
    const rec = floorRecommended(save, 100);
    expect(rec).toBeGreaterThan(1_000_000);
    expect(rec).toBeLessThan(2_000_000);
    for (let f = 61; f <= 200; f++) expect(floorDef(f).encounter).toBeTruthy();
  });

  it('pays first clears past floor 60', () => {
    const save = newSave();
    towerOf(save).best = 60;
    const won = { outcome: () => 'victory' } as unknown as Battle;
    const tithes = save.tithes;
    expect(finishFloor(save, 61, won).won).toBe(true);
    expect(towerOf(save).best).toBe(61);
    expect(save.tithes).toBeGreaterThan(tithes);
  });
});

describe('Order Towers', () => {
  const order = ORDER_LIST[0].name;
  const mine = CRUSADERS.filter((c) => c.order === order && c.rarity !== 'UR').slice(0, ORDER_PARTY).map((c) => c.id);

  it('one per Order, each with its own floors, all Order-locked', () => {
    for (const o of ORDER_LIST) {
      expect(CRUSADERS.filter((c) => c.order === o.name).length).toBeGreaterThanOrEqual(ORDER_PARTY);
      expect(orderFloorDef(o.name, 7).rule).toEqual({ kind: 'order', order: o.name });
    }
    expect(orderFloorDef(order, 10).boss).toBe(true);
    expect(orderFloorDef(order, 40).scale).toBeGreaterThan(orderFloorDef(order, 20).scale);
  });

  it('pays Writs on a won next floor with a full party of the Order only', () => {
    const save = newSave();
    for (const id of mine) save.owned[id] = { level: 30, vow: 5 };
    const b = orderTowerBattle(save, mine, order, 1, seeded(2));
    autoBattle(b, 600);
    const r = finishOrderFloor(save, order, 1, b);
    expect(r.reward?.items.writ1).toBeGreaterThan(0);
    expect(orderBest(save, order)).toBe(1);
    expect(save.items?.writ1).toBeGreaterThan(0);
    // three Sisters is not a full party
    const short = orderTowerBattle(save, mine.slice(0, 3), order, 2, seeded(3));
    autoBattle(short, 600);
    expect(finishOrderFloor(save, order, 2, short).reward).toBeUndefined();
    // other Orders' Sisters never take the field
    const other = CRUSADERS.find((c) => c.order !== order)!.id;
    save.owned[other] = { level: 1, vow: 0 };
    expect(orderTowerBattle(save, [other, ...mine], order, 2).units.filter((u) => u.ref === other).length).toBe(0);
    expect(ORDER_TOWER_FLOORS).toBe(50);
  });
});

describe('elite floors are marked', () => {
  it('every third floor that is not a boss is an elite, in both kinds of tower', () => {
    expect(floorDef(3).elite).toBe(true);
    expect(floorDef(4).elite).toBe(false);
    expect(floorDef(30).elite).toBe(false);
    expect(floorDef(30).boss).toBe(true);
    expect(orderFloorDef('Iron Vigil', 6).elite).toBe(true);
  });
});
