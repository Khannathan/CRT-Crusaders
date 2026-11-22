import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { FLAME_TIERS, tendFlame } from './flame';

const DAY = 864e5;
// A Wednesday noon, so a few days stay in one week.
const T0 = new Date(2026, 10, 18, 12).getTime();

describe('Vigil Flame', () => {
  it('grows once a day, and only once', () => {
    const save = newSave();
    expect(tendFlame(save, T0)?.grew).toBe(1);
    expect(tendFlame(save, T0 + 3600e3)).toBeUndefined();
    tendFlame(save, T0 + DAY);
    tendFlame(save, T0 + 2 * DAY);
    expect(save.flame!.level).toBe(3);
    expect(save.titles).toContain(FLAME_TIERS[1].title);
  });

  it('grace covers missed days, then each extra miss dims one step, never to zero', () => {
    const save = newSave();
    for (let d = 0; d < 5; d++) tendFlame(save, T0 - 2 * DAY + d * DAY); // Mon..Fri
    expect(save.flame!.level).toBe(5);
    // Skip Sat and Sun: both graced
    const r = tendFlame(save, T0 + 5 * DAY)!; // next Monday: new week, grace refills first
    expect(r.dimmed).toBe(0);
    expect(save.flame!.level).toBe(6);
    // Miss 5 days in the new week: 2 graced, 3 dim
    const r2 = tendFlame(save, T0 + 11 * DAY)!;
    expect(r2.graced).toBe(2);
    expect(r2.dimmed).toBe(3);
    expect(save.flame!.level).toBe(4);
    // A very long absence leaves one lit step, then today's
    tendFlame(save, T0 + 200 * DAY);
    expect(save.flame!.level).toBe(2);
    expect(save.flame!.best).toBe(6);
  });
});
