import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { orderIdOf } from './codex';
import { codexGoal, levelGoal, nearGoals, tenPullGoal } from './goals';

describe('nearby goals', () => {
  it('are true distances, closest first', () => {
    const save = newSave();
    save.seals = 7;
    expect(tenPullGoal(save).text).toBe('3 Seals to your next 10-pull');
    expect(tenPullGoal(save).frac).toBeCloseTo(0.7);
    const c = CRUSADERS[0];
    save.owned[c.id] = { level: 5, vow: 0, exp: 0 };
    expect(levelGoal(save, c.id)!.frac).toBe(0);
    const goals = nearGoals(save, [c.id]);
    for (let i = 1; i < goals.length; i++) expect(goals[i - 1].frac).toBeGreaterThanOrEqual(goals[i].frac);
    save.seals = 12;
    expect(nearGoals(save, [c.id])[0].id).toBe('ten-pull');
  });

  it('only names a Codex for an Order the player has sworn', () => {
    const save = newSave();
    const c = CRUSADERS[0];
    expect(codexGoal(save, orderIdOf(c))).toBeUndefined();
    save.owned[c.id] = { level: 1, vow: 0 };
    save.tithes = 150;
    const g = codexGoal(save, orderIdOf(c))!;
    expect(g.frac).toBe(0); // no Writs yet
    expect(g.text).toContain('3 Writs and 150 Tithes');
  });
});
