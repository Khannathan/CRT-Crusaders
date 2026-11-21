import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { autoBattle } from './autoplay';
import { BALANCE_VERSION } from './combat';
import {
  BELFRY,
  OSSUARY,
  absorbBattle,
  chooseEvent,
  choices,
  cryptCleared,
  currentNode,
  enterNode,
  finishRun,
  makeBattle,
  maxHpOf,
  relicOffer,
  shrine,
  startRun,
  takeRelic,
  winRoom,
  type CryptDef,
  type RunState,
} from './crusade';
import type { SaveData } from '../state/save';
import { seeded } from './rng';

/**
 * Played by autoChoose, the same player as the in-game Auto button.
 * Balance targets (see research/Epic_Seven_Balance_Deep_Dive.md):
 * - a fresh all-R level-1 party is a real challenge for the Ossuary,
 * - a modestly levelled party (5) clears it reliably, a mature one (10) almost always,
 * - the Belfry wants a levelled party,
 * - the first Rite of the boss fight arrives around rounds 4-6.
 */
const STARTER = ['CC-W013', 'CC-W052', 'CC-W001', 'CC-W022'];
const N = 300;

/** A plain path policy: rest when hurt, take elites only when healthy, events by their first option. */
function pickNode(save: SaveData, run: RunState): number {
  const open = choices(run);
  const living = run.party.filter((id) => run.hp[id] > 0);
  const health = living.reduce((n, id) => n + run.hp[id] / maxHpOf(save, run, id), 0) / Math.max(1, living.length);
  const kindAt = (i: number) => run.map[run.floor + 1][i].kind;
  const rank = (i: number) => {
    const k = kindAt(i);
    if (k === 'shrine') return health < 0.65 ? 0 : 4;
    if (k === 'elite') return health > 0.8 ? 1 : 6;
    if (k === 'reliquary') return 2;
    if (k === 'fight') return 3;
    return 5;
  };
  return [...open].sort((a, b) => rank(a) - rank(b))[0];
}

function playCrypt(seed: number, level: number, crypt: CryptDef = OSSUARY) {
  const save = newSave();
  for (const id of STARTER) save.owned[id] = { level, vow: 0 };
  const rng = seeded(seed);
  const run = startRun(save, STARTER, crypt, rng);
  let firstRite: number | undefined;
  while (!cryptCleared(run)) {
    const node = enterNode(run, pickNode(save, run));
    if (node.kind === 'shrine') shrine(save, run);
    else if (node.kind === 'event') chooseEvent(save, run, 0, rng);
    else if (node.kind === 'reliquary') takeRelic(save, run, relicOffer(run, rng)[0]?.id ?? 'knucklebone');
    else {
      const b = makeBattle(save, run, currentNode(run)!.encounter!, rng);
      const res = autoBattle(b, 400, (round) => {
        if (node.kind === 'boss' && firstRite === undefined) firstRite = round;
      });
      absorbBattle(run, b);
      if (res !== 'victory') return { outcome: finishRun(save, run, 'defeat').outcome, firstRite };
      winRoom(run, save);
    }
    if (run.pendingRelic) takeRelic(save, run, relicOffer(run, rng)[0].id);
  }
  return { outcome: finishRun(save, run, 'victory').outcome, firstRite };
}

function sample(level: number, crypt: CryptDef = OSSUARY) {
  let wins = 0;
  const rites: number[] = [];
  for (let i = 0; i < N; i++) {
    const r = playCrypt(1000 + i, level, crypt);
    if (r.outcome === 'victory') wins++;
    if (r.firstRite !== undefined) rites.push(r.firstRite);
  }
  rites.sort((a, b) => a - b);
  const median = rites[Math.floor(rites.length / 2)];
  console.log(`[balance ${BALANCE_VERSION}] ${crypt.id} level ${level}: win ${((wins / N) * 100).toFixed(1)}%, boss first Rite median round ${median}`);
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

  it('the Belfry: too hard at level 1, a fair fight at level 6, reliable at 12', () => {
    expect(sample(1, BELFRY).rate).toBeLessThan(0.25);
    const mid = sample(6, BELFRY);
    expect(mid.rate).toBeGreaterThan(0.45);
    expect(mid.rate).toBeLessThan(0.9);
    expect(sample(12, BELFRY).rate).toBeGreaterThan(0.9);
  });
});
