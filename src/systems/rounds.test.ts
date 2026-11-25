import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { finishStage, feastOf, FEAST_REPEATS } from './feast';
import { matinsReady } from './matins';
import { morningRounds, roundsReady } from './rounds';
import { huntEntriesLeft, huntOn, huntsOf, scoreUnit, HUNT_ENTRIES } from './hunts';
import { processionLeft } from './offerings';

function seeded(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

const NOW = new Date(2026, 10, 22, 12).getTime();

describe('Morning Rounds', () => {
  it('claims the Vigil, lights Matins and sweeps the Feast in one go, then has nothing left', () => {
    const save = newSave();
    const ids = CRUSADERS.filter((c) => c.rarity === 'R').slice(0, 4).map((c) => c.id);
    for (const id of ids) save.owned[id] = { level: 5, vow: 0 };
    save.lastParty = ids;
    save.vigil = { party: ids, since: NOW - 5 * 3.6e6 };
    finishStage(save, 0, ids, true, NOW);
    const tithes = save.tithes;
    expect(roundsReady(save, NOW)).toBe(true);
    const r = morningRounds(save, NOW, seeded(1));
    expect(save.tithes).toBeGreaterThan(tithes);
    expect(matinsReady(save, NOW)).toBe(false);
    expect(feastOf(save, NOW).repeats).toBe(FEAST_REPEATS);
    expect(r.done.length).toBeGreaterThanOrEqual(3);
    expect(roundsReady(save, NOW + 1000)).toBe(false);
  });

  it('leaves a Vow-token candle for the player to choose', () => {
    const save = newSave();
    save.owned[CRUSADERS[0].id] = { level: 1, vow: 0 };
    save.matins = { lit: 27 };
    const r = morningRounds(save, NOW, seeded(2));
    expect(r.left.some((l) => l.startsWith('Matins'))).toBe(true);
    expect(matinsReady(save, NOW)).toBe(true);
  });

  it('sweeps the Purge Hunt and the Procession once they are open and you have a record', () => {
    const save = newSave();
    save.owned[CRUSADERS[0].id] = { level: 1, vow: 0 };
    save.rank = { xp: 1e7, gifted: 30, sched: 2 };
    huntsOf(save, NOW).records[huntOn(NOW).id] = Math.round(scoreUnit(huntOn(NOW)) * 2);
    save.procession = { day: '', used: 0, best: 2 };
    expect(roundsReady(save, NOW)).toBe(true);
    const r = morningRounds(save, NOW, seeded(3));
    expect(r.done.some((l) => l.startsWith('Purge Hunt swept'))).toBe(true);
    expect(r.done.some((l) => l.includes('swept:'))).toBe(true);
    expect(huntEntriesLeft(save, NOW)).toBe(HUNT_ENTRIES - 1);
    expect(processionLeft(save, NOW)).toBe(0);
  });
});
