import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { giltOf } from './currency';
import { POWER_MILESTONES, growTarget, nextMilestone, notePower } from './powerGrowth';

const party = ['SW-R-WAR', 'DL-R-HIE', 'IV-R-EXE', 'SW-SR-CON'];

describe('Power growth', () => {
  it('the first look only records Power; later rises are reported', () => {
    const save = newSave();
    for (const id of party) save.owned[id] = { level: 1, vow: 0 };
    expect(notePower(save).gain).toBe(0);
    expect(notePower(save).gain).toBe(0);
    save.owned['SW-R-WAR'].level = 10;
    expect(notePower(save).gain).toBeGreaterThan(0);
  });

  it('milestones pay their Gilt once, all that were crossed', () => {
    const save = newSave();
    for (const id of party) save.owned[id] = { level: 50, vow: 0, asc: 3 };
    const gilt = giltOf(save);
    const note = notePower(save);
    expect(note.reached.length).toBeGreaterThanOrEqual(2);
    expect(giltOf(save) - gilt).toBe(note.reached.reduce((n, m) => n + m.gilt, 0));
    expect(notePower(save).reached).toHaveLength(0);
    expect(nextMilestone(save)!.at).toBeGreaterThan(note.power);
    expect(POWER_MILESTONES.map((m) => m.at)).toEqual([...POWER_MILESTONES.map((m) => m.at)].sort((a, b) => a - b));
  });

  it('Grow points at the weakest of the four, and at her next step', () => {
    const save = newSave();
    for (const id of party) save.owned[id] = { level: 20, vow: 0 };
    save.owned['SW-SR-CON'].level = 3;
    expect(growTarget(save, party)).toMatchObject({ id: 'SW-SR-CON', hint: 'Level her up' });
    save.owned['SW-SR-CON'].level = 20;
    const t = growTarget(save, party)!;
    expect(t.hint).toBe('Ascend her');
  });
});
