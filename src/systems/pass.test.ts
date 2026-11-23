import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { giltOf } from './currency';
import { track } from './tasks';
import {
  DAILY_STEP_CAP,
  STEPS_PER_TIER,
  SWORN_COST,
  TIERS,
  claimAllPass,
  overflowReady,
  passOf,
  passReady,
  passTrack,
  seasonAt,
  swearPass,
  tierOf,
} from './pass';

const T0 = new Date(2026, 10, 23, 12).getTime();
const DAY = 864e5;

describe("Pilgrim's Pass", () => {
  it('counts Steps from tasks.track, capped per day', () => {
    const save = newSave();
    track(save, 'dailyDone', 1, T0);
    expect(passOf(save, T0).steps).toBe(60);
    expect(passTrack(save, 'cryptCleared', 20, T0)).toBe(DAILY_STEP_CAP - 60);
    expect(passTrack(save, 'fightWon', 1, T0)).toBe(0);
    // a new day opens the cap again
    expect(passTrack(save, 'fightWon', 1, T0 + DAY)).toBe(3);
    expect(passOf(save, T0 + DAY).today).toBe(3);
  });

  it('claims every reached tier on the free lane, then the Sworn lane back to tier 1', () => {
    const save = newSave();
    passOf(save, T0).steps = 3 * STEPS_PER_TIER + 50;
    expect(tierOf(passOf(save, T0))).toBe(3);
    expect(passReady(save, T0)).toBe(true);
    expect(claimAllPass(save, T0)).toHaveLength(3);
    expect(passReady(save, T0)).toBe(false);
    save.gilt = SWORN_COST + 5;
    expect(swearPass(save, T0)).toBe(true);
    expect(giltOf(save)).toBe(5);
    expect(swearPass(save, T0)).toBe(false);
    expect(claimAllPass(save, T0)).toHaveLength(3);
    expect(passOf(save, T0).paid).toEqual([1, 2, 3]);
  });

  it('opens Overflow chests past the last tier', () => {
    const save = newSave();
    passOf(save, T0).steps = TIERS * STEPS_PER_TIER + 2 * STEPS_PER_TIER + 10;
    expect(overflowReady(save, T0)).toBe(2);
    const seals = save.seals;
    claimAllPass(save, T0);
    expect(overflowReady(save, T0)).toBe(0);
    expect(save.seals).toBeGreaterThan(seals);
  });

  it('starts fresh each season', () => {
    const save = newSave();
    passOf(save, T0).steps = 900;
    const next = seasonAt(T0).ends + 1000;
    expect(seasonAt(next).index).toBe(seasonAt(T0).index + 1);
    expect(passOf(save, next).steps).toBe(0);
  });
});
