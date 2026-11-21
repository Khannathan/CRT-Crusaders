import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { autoBattle } from './autoplay';
import { BALANCE_VERSION } from './combat';
import { absorbBattle, currentRoom, finishRun, makeBattle, shrine, startRun, winRoom } from './crusade';
import { seeded } from './rng';

/**
 * Played by autoChoose, the same player as the in-game Auto button.
 * Balance targets (see research/Epic_Seven_Balance_Deep_Dive.md):
 * - a fresh all-R level-1 party is a real challenge for a simple auto-player,
 * - a modestly levelled party (5) clears reliably, a mature one (10) almost always,
 * - the first Rite of the boss fight arrives around rounds 4-6.
 */
const STARTER = ['CC-W013', 'CC-W052', 'CC-W001', 'CC-W022'];
const N = 400;

function playCrypt(seed: number, level: number) {
  const save = newSave();
  for (const id of STARTER) save.owned[id] = { level, vow: 0 };
  const rng = seeded(seed);
  const run = startRun(save, STARTER);
  let firstRite: number | undefined;
  while (currentRoom(run)) {
    const room = currentRoom(run)!;
    if (room.kind === 'choice') {
      shrine(save, run);
      continue;
    }
    const b = makeBattle(save, run, room.encounter, rng);
    const res = autoBattle(b, 400, (round) => {
      if (room.kind === 'boss' && firstRite === undefined) firstRite = round;
    });
    absorbBattle(run, b);
    if (res !== 'victory') return { outcome: finishRun(save, run, 'defeat').outcome, firstRite };
    winRoom(run);
  }
  return { outcome: finishRun(save, run, 'victory').outcome, firstRite };
}

function sample(level: number) {
  let wins = 0;
  const rites: number[] = [];
  for (let i = 0; i < N; i++) {
    const r = playCrypt(1000 + i, level);
    if (r.outcome === 'victory') wins++;
    if (r.firstRite !== undefined) rites.push(r.firstRite);
  }
  rites.sort((a, b) => a - b);
  const median = rites[Math.floor(rites.length / 2)];
  console.log(`[balance ${BALANCE_VERSION}] level ${level}: win ${((wins / N) * 100).toFixed(1)}%, boss first Rite median round ${median}`);
  return { rate: wins / N, median };
}

describe(`crypt balance ${BALANCE_VERSION} (auto player, ${N} seeded runs)`, () => {
  it('level 1, all R: a real challenge but winnable', () => {
    const { rate } = sample(1);
    expect(rate).toBeGreaterThan(0.4);
    expect(rate).toBeLessThan(0.75);
  });

  it('level 5: clears reliably, first Rite around rounds 4-6', () => {
    const { rate, median } = sample(5);
    expect(rate).toBeGreaterThan(0.85);
    expect(median).toBeGreaterThanOrEqual(4);
    expect(median).toBeLessThanOrEqual(6);
  });

  it('level 10: almost always clears', () => {
    expect(sample(10).rate).toBeGreaterThan(0.97);
  });
});
