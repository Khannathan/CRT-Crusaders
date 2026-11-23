import { afterEach, describe, expect, it } from 'vitest';
import { WEEK_BOOSTS, boostBag, boostMult, boostN, boostsToday, setBoostsEnabled } from './boosts';
import { addBond, bondOf } from './bonds';
import { newSave } from '../state/save';

const day = (d: number) => new Date(2026, 10, 15 + d, 12).getTime(); // 15 Nov 2026 is a Sunday

describe('daily blessings', () => {
  afterEach(() => setBoostsEnabled(false));

  it('follow a fixed week, every day has one, and each mode is blessed at least once', () => {
    setBoostsEnabled(true);
    expect(boostsToday(day(1)).map((b) => b.kind)).toEqual(['crusade', 'exp']);
    expect(boostsToday(day(8))).toEqual(boostsToday(day(1)));
    for (let d = 0; d < 7; d++) expect(boostsToday(day(d)).length).toBeGreaterThan(0);
    const kinds = new Set(WEEK_BOOSTS.flat().map((b) => b.kind));
    expect(kinds.size).toBe(8);
    expect(boostMult('crusade', day(1))).toBe(1.5);
    expect(boostMult('crusade', day(2))).toBe(1);
  });

  it('scale bags and bond XP, and never on a day off', () => {
    setBoostsEnabled(true);
    expect(boostN(1, 1.5)).toBe(2);
    expect(boostN(10, 1.5)).toBe(15);
    expect(boostBag({ iron1: 4, armory1: 3 }, 'crusade', day(4))).toEqual({ iron1: 6, armory1: 10 });
    expect(boostBag({ iron1: 4 }, 'crusade', day(2))).toEqual({ iron1: 4 });
    setBoostsEnabled(false);
    expect(boostMult('crusade', day(1))).toBe(1);
    const save = newSave();
    save.owned.x = { level: 1, vow: 0 };
    addBond(save, ['x'], 10);
    expect(bondOf(save, 'x').xp).toBe(10);
  });
});
