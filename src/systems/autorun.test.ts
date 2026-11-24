import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { canRepeat, repeatRuns } from './autorun';
import { OSSUARY } from './crusade';
import { seeded } from './rng';

const party = ['SW-R-WAR', 'DL-R-HIE', 'IV-R-EXE', 'SW-SR-CON'];

describe('repeat runs', () => {
  it('needs the crypt cleared at that tier', () => {
    const save = newSave();
    expect(canRepeat(save, OSSUARY, 0)).toBe(false);
    save.cleared.push(OSSUARY.id);
    expect(canRepeat(save, OSSUARY, 0)).toBe(true);
    expect(canRepeat(save, OSSUARY, 1)).toBe(false);
  });

  it('a strong party clears several runs and brings the spoils home', () => {
    const save = newSave();
    for (const id of party) save.owned[id] = { level: 15, vow: 2 };
    save.cleared.push(OSSUARY.id);
    const tithes = save.tithes;
    const runs = repeatRuns(save, party, OSSUARY, 0, 3, seeded(7));
    expect(runs.length).toBeGreaterThan(0);
    expect(runs.every((r) => r.outcome === 'victory')).toBe(true);
    expect(save.tithes).toBeGreaterThan(tithes);
  });

  it('stops at the first defeat', () => {
    const save = newSave();
    save.owned[party[0]] = { level: 1, vow: 0 };
    save.cleared.push(OSSUARY.id);
    const runs = repeatRuns(save, [party[0]], OSSUARY, 0, 5, seeded(2));
    expect(runs.length).toBe(1);
    expect(runs[0].outcome).toBe('defeat');
  });
});
