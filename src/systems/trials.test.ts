import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { autoChoose } from './autoplay';
import type { Battle } from './combat';
import { TRIAL_ENTRIES, entriesLeft, finishTrial, openTrials, starsFor, sweep, tierOpen, trialBattle } from './trials';
import { seeded } from './rng';

function play(b: Battle) {
  for (let i = 0; i < 400; i++) {
    const t = b.nextTurn();
    if (t.outcome || !t.actor) break;
    const pick = t.actor.side === 'party' ? autoChoose(b, t.actor) : b.enemyChoose(t.actor);
    b.act(t.actor, pick.skill, pick.target);
  }
  return b;
}

const party = CRUSADERS.filter((c) => c.rarity === 'R').slice(0, 4).map((c) => c.id);

describe('Relic Trials', () => {
  it('weekdays open one trial, weekends all five', () => {
    expect(openTrials(new Date(2026, 10, 16).getTime()).map((t) => t.kind)).toEqual(['blade']); // Monday
    expect(openTrials(new Date(2026, 10, 21).getTime()).length).toBe(5); // Saturday
  });

  it('a strong party wins with stars, pays, and three stars unlock sweep', () => {
    const save = newSave();
    for (const id of party) save.owned[id] = { level: 20, vow: 5 };
    const b = play(trialBattle(save, party, 0, seeded(3)));
    const r = finishTrial(save, 'tithes', 0, b);
    expect(r.stars).toBe(starsFor(b));
    expect(r.stars).toBeGreaterThan(0);
    expect(r.spoils?.tithes).toBe(300);
    expect(tierOpen(save, 'tithes', 1)).toBe(true);
    expect(entriesLeft(save)).toBe(TRIAL_ENTRIES - 1);
    if (r.stars === 3) expect(sweep(save, 'tithes', 0)?.tithes).toBe(300);
  });

  it('a loss spends no entry; sweeping needs three stars', () => {
    const save = newSave();
    save.owned[party[0]] = { level: 1, vow: 0 };
    const b = play(trialBattle(save, [party[0]], 4, seeded(1)));
    expect(finishTrial(save, 'seals', 4, b).spoils).toBeUndefined();
    expect(entriesLeft(save)).toBe(TRIAL_ENTRIES);
    expect(sweep(save, 'seals', 0)).toBeUndefined();
  });
});
