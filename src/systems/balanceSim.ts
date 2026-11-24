/**
 * The crypt balance simulation shared by balance.test.ts and balanceDeep.test.ts.
 * Split in two files so neither test worker runs past Vitest's 60 s RPC limit on CI.
 */
import { newSave } from '../state/save';
import { FieldBattle, SCREEN_FIELD } from './field';
import type { Battle } from './combat';
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
  shrine, miracle,
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
const STARTER = ['SW-R-WAR', 'DL-R-HIE', 'IV-R-EXE', 'SW-SR-CON'];
export const N = 120;

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

/** Plays a fight on the open field (every fight in the game is fought there), noting each Sister Litany's round. */
function fightOnField(b: Battle, onRite: (round: number) => void): 'victory' | 'defeat' | 'stalled' {
  const f = new FieldBattle(b, { ...SCREEN_FIELD, rng: seeded(b.units.length * 7919 + b.units[0].hp) });
  for (let t = 0; t < 400; t += 0.05) {
    for (const e of f.update(0.05)) {
      if (e.kind === 'act' && e.litany && b.get(e.uid).side === 'party') onRite(b.round);
      if (e.kind === 'end') return e.outcome;
    }
  }
  return 'stalled';
}

function playCrypt(seed: number, level: number, crypt: CryptDef = OSSUARY, heresy = 0) {
  const save = newSave();
  for (const id of STARTER) save.owned[id] = { level, vow: 0 };
  const rng = seeded(seed);
  const run = startRun(save, STARTER, crypt, rng, heresy);
  let firstRite: number | undefined;
  while (!cryptCleared(run)) {
    const node = enterNode(run, pickNode(save, run));
    if (node.kind === 'shrine') shrine(save, run);
    else if (node.kind === 'miracle') miracle(save, run);
    else if (node.kind === 'event') chooseEvent(save, run, 0, rng);
    else if (node.kind === 'reliquary') takeRelic(save, run, relicOffer(run, rng)[0]?.id ?? 'knucklebone');
    else {
      const b = makeBattle(save, run, currentNode(run)!.encounter!, rng);
      const res = fightOnField(b, (round) => {
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

export function sample(level: number, crypt: CryptDef = OSSUARY, heresy = 0) {
  let wins = 0;
  const rites: number[] = [];
  for (let i = 0; i < N; i++) {
    const r = playCrypt(1000 + i, level, crypt, heresy);
    if (r.outcome === 'victory') wins++;
    if (r.firstRite !== undefined) rites.push(r.firstRite);
  }
  rites.sort((a, b) => a - b);
  const median = rites[Math.floor(rites.length / 2)];
  console.log(`[balance ${BALANCE_VERSION}] ${crypt.id}${heresy ? ` heresy ${heresy}` : ''} level ${level}: win ${((wins / N) * 100).toFixed(1)}%, boss first Rite median round ${median}`);
  return { rate: wins / N, median };
}

/**
 * sample, but it gives the event loop a turn after each run, so a long sample
 * never starves the test runner's own messages (they time out after 60s).
 */
export async function sampleAsync(level: number, crypt: CryptDef = OSSUARY, heresy = 0) {
  let wins = 0;
  const rites: number[] = [];
  for (let i = 0; i < N; i++) {
    const r = playCrypt(1000 + i, level, crypt, heresy);
    if (r.outcome === 'victory') wins++;
    if (r.firstRite !== undefined) rites.push(r.firstRite);
    await new Promise((res) => setTimeout(res, 0));
  }
  rites.sort((a, b) => a - b);
  const median = rites[Math.floor(rites.length / 2)];
  console.log(`[balance ${BALANCE_VERSION}] ${crypt.id}${heresy ? ` heresy ${heresy}` : ''} level ${level}: win ${((wins / N) * 100).toFixed(1)}%, boss first Rite median round ${median}`);
  return { rate: wins / N, median };
}

export { BELFRY, OSSUARY };
