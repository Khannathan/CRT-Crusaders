import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { game } from '../state/game';
import { current } from '../state/run';
import { newSave } from '../state/save';
import { OSSUARY, choices, currentNode, enterNode, startRun } from './crusade';
import { seeded } from './rng';
import { playOutStoredFight } from './settle';

describe('a fight cut off by a reload', () => {
  it('plays out to its end and pays out like any other', () => {
    const save = newSave();
    const party = CRUSADERS.slice(0, 4).map((c) => c.id);
    for (const id of party) save.owned[id] = { level: 40, vow: 0, asc: 3 };
    game.save = save;
    const run = startRun(save, party, OSSUARY, seeded(5));
    current.run = run;
    current.challenge = undefined;
    const fight = choices(run).find((i) => run.map[0][i].encounter)!;
    enterNode(run, fight);
    expect(currentNode(run)?.encounter).toBeTruthy();
    const s = playOutStoredFight()!;
    expect(s.won).toBe(true);
    expect(run.resolved).toBe(true);
    expect(playOutStoredFight()).toBeUndefined(); // nothing left to play out
    current.run = undefined;
  });
});
