import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { autoBattle } from './autoplay';
import { seeded } from './rng';
import { TOWER_FLOORS, allowedOn, finishFloor, floorDef, towerBattle, towerOf } from './tower';

const party = ['CC-W013', 'CC-W052', 'CC-W001', 'CC-W022'];

describe('Bell Tower', () => {
  it('bosses every 10th floor, Order and humble floors between, rising strength', () => {
    expect(floorDef(10).boss).toBe(true);
    expect(floorDef(5).rule?.kind).toBe('order');
    expect(floorDef(8).rule?.kind).toBe('humble');
    expect(floorDef(40).scale).toBeGreaterThan(floorDef(20).scale);
    const order = floorDef(15).rule;
    const allow = allowedOn(order);
    expect(CRUSADERS.filter(allow).length).toBe(5);
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
});
