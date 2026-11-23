import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { CRUSADERS } from '../data/crusaders';
import { recommendedPower, partyPower } from './power';
import {
  BRACKET,
  GRADES,
  ORDEALS_PER_DAY,
  bracket,
  champions,
  claimLastWeek,
  finishOrdeal,
  ordealBattle,
  ordealsLeft,
  ordealsOf,
  placeReward,
} from './ordeals';

// A Wednesday noon, and the Monday after.
const WED = new Date(2026, 10, 25, 12).getTime();
const NEXT_MON = new Date(2026, 10, 30, 9).getTime();

describe('the Ordeals', () => {
  it('builds a bracket of twenty with you in it, stable through the hour', () => {
    const save = newSave();
    const a = bracket(save, WED);
    expect(a.rows).toHaveLength(BRACKET);
    expect(a.rows.filter((r) => r.you)).toHaveLength(1);
    expect(bracket(save, WED + 60_000).rows).toEqual(a.rows);
    expect(champions(save, WED)).toEqual(champions(save, WED + 60_000));
  });

  it('spends five Ordeals a day; wins pay by grade, losses a little', () => {
    const save = newSave();
    const [easy, , hard] = champions(save, WED);
    expect(finishOrdeal(save, hard, true, WED)).toBe(35);
    expect(finishOrdeal(save, easy, false, WED)).toBe(2);
    for (let i = 0; i < 3; i++) finishOrdeal(save, easy, true, WED);
    expect(ordealsLeft(save, WED)).toBe(0);
    expect(finishOrdeal(save, easy, true, WED)).toBe(0);
    expect(ordealsOf(save, WED).points).toBe(67);
    expect(ordealsLeft(save, WED + 864e5)).toBe(ORDEALS_PER_DAY);
  });

  it('judges the week: a big week rises a league and pays', () => {
    const save = newSave();
    ordealsOf(save, WED).points = 5000;
    const o = ordealsOf(save, NEXT_MON);
    expect(o.points).toBe(0);
    expect(o.league).toBe(1);
    expect(o.last?.place).toBe(1);
    const seals = save.seals;
    expect(claimLastWeek(save, NEXT_MON)?.reward).toEqual(placeReward(1, 0));
    expect(save.seals).toBe(seals + (placeReward(1, 0).seals ?? 0));
    expect(claimLastWeek(save, NEXT_MON)).toBeUndefined();
  });

  it('a week barely fought falls; a week not fought is not judged', () => {
    const save = newSave();
    ordealsOf(save, WED).league = 2;
    ordealsOf(save, WED).points = 2;
    expect(ordealsOf(save, NEXT_MON).league).toBe(1);
    const idle = newSave();
    ordealsOf(idle, WED).league = 2;
    expect(ordealsOf(idle, NEXT_MON).league).toBe(2);
    expect(ordealsOf(idle, NEXT_MON).last).toBeUndefined();
  });

  it('scales the champion to the party sent', () => {
    const save = newSave();
    const party = CRUSADERS.slice(0, 4).map((c) => c.id);
    for (const id of party) save.owned[id] = { level: 20, vow: 0 };
    const pp = partyPower(save, party);
    for (const c of champions(save, WED)) {
      const rec = recommendedPower(ordealBattle(save, party, c));
      const want = pp * GRADES[c.grade].mult;
      expect(Math.abs(rec - want) / want).toBeLessThan(0.15);
    }
  });
});
