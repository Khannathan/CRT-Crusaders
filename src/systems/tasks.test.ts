import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { MARKS, claimMark, claimable, dayKey, devotion, maxDevotion, tasksOf, track, weekKey } from './tasks';

const DAY = 864e5;
const t0 = new Date(2026, 10, 18, 10).getTime(); // a Wednesday morning, local time

describe('Daily Penance and weekly Litany', () => {
  it('keys days and Monday-start weeks in local time', () => {
    expect(dayKey(t0)).toBe('2026-11-18');
    expect(weekKey(t0)).toBe('2026-11-16');
    expect(weekKey(new Date(2026, 10, 22, 23).getTime())).toBe('2026-11-16'); // Sunday night
    expect(weekKey(new Date(2026, 10, 23, 1).getTime())).toBe('2026-11-23'); // Monday
  });

  it('tasks fill Devotion, marks pay once', () => {
    const save = newSave();
    track(save, 'fightWon', 2, t0);
    expect(devotion(save, 'daily', t0)).toBe(0);
    track(save, 'fightWon', 5, t0);
    track(save, 'vigilClaim', 1, t0);
    expect(devotion(save, 'daily', t0)).toBe(40);
    expect(claimable(save, 'daily', t0).map((m) => m.at)).toEqual([40]);
    const seals = save.seals;
    const tithes = save.tithes;
    expect(claimMark(save, 'daily', 40, t0)).toEqual(MARKS.daily[0].reward);
    expect(save.tithes).toBe(tithes + (MARKS.daily[0].reward.tithes ?? 0));
    expect(save.seals).toBe(seals + (MARKS.daily[0].reward.seals ?? 0));
    expect(claimMark(save, 'daily', 40, t0)).toBeUndefined();
    expect(claimMark(save, 'daily', 70, t0)).toBeUndefined();
  });

  it('dailies reset at midnight, the Litany on Monday; a full day counts for the week', () => {
    const save = newSave();
    for (const e of ['fightWon', 'fightWon', 'fightWon', 'vigilClaim', 'enhance', 'enhance', 'pull', 'levelUp'] as const) track(save, e, 1, t0);
    expect(devotion(save, 'daily', t0)).toBe(maxDevotion('daily'));
    expect(tasksOf(save, t0).weekly.progress['w-daily']).toBe(1);
    expect(tasksOf(save, t0).weekly.progress['w-fights']).toBe(3);
    expect(devotion(save, 'daily', t0 + DAY)).toBe(0);
    expect(tasksOf(save, t0 + DAY).weekly.progress['w-fights']).toBe(3);
    expect(tasksOf(save, t0 + 6 * DAY).weekly.progress['w-fights']).toBeUndefined();
  });
});
