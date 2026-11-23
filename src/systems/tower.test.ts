import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { autoBattle } from './autoplay';
import { seeded } from './rng';
import type { Battle } from './combat';
import { TOWER_FLOORS, TOWER_GROWTH, allowedOn, finishFloor, floorDef, floorRecommended, towerBattle, towerOf, towerScale } from './tower';

const party = ['CC-W013', 'CC-W052', 'CC-W001', 'CC-W022'];

describe('Bell Tower', () => {
  it('bosses every 10th floor, Order and humble floors between, rising strength', () => {
    expect(floorDef(10).boss).toBe(true);
    expect(floorDef(5).rule?.kind).toBe('order');
    expect(floorDef(8).rule?.kind).toBe('humble');
    expect(floorDef(40).scale).toBeGreaterThan(floorDef(20).scale);
    const order = floorDef(15).rule;
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
