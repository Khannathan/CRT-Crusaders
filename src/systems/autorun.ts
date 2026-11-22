import type { SaveData } from '../state/save';
import { EVENTS } from '../data/events';
import { autoBattle } from './autoplay';
import { expBattle } from './exp';
import {
  absorbBattle,
  canMuster,
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
  miracle,
  startRun,
  takeRelic,
  winRoom,
  type CryptDef,
  type RunResult,
  type RunState,
} from './crusade';
import type { Rng } from './gacha';

/**
 * Repeat runs: replays a crypt already cleared, start to finish, with the Auto
 * player choosing both the path and every move. Real fights, real rewards,
 * real fallen. Stops at the first defeat or when no one is left to march.
 */

/** Path policy: rest when hurt, elites only when healthy, events by their first option. */
export function pickNode(save: SaveData, run: RunState): number {
  const open = choices(run);
  const living = run.party.filter((id) => run.hp[id] > 0);
  const health = living.reduce((n, id) => n + run.hp[id] / maxHpOf(save, run, id), 0) / Math.max(1, living.length);
  const rank = (i: number) => {
    const k = run.map[run.floor + 1][i].kind;
    if (k === 'miracle') return -1;
    if (k === 'shrine') return health < 0.65 ? 0 : 4;
    if (k === 'elite') return health > 0.8 ? 1 : 6;
    if (k === 'reliquary') return 2;
    if (k === 'fight') return 3;
    return 5;
  };
  return [...open].sort((a, b) => rank(a) - rank(b))[0];
}

/** Plays one whole run on Auto and ends it. */
export function autoRun(save: SaveData, party: string[], crypt: CryptDef, heresy: number, rng: Rng = Math.random): RunResult {
  const run = startRun(save, party, crypt, rng, heresy);
  while (!cryptCleared(run)) {
    const node = enterNode(run, pickNode(save, run));
    if (node.kind === 'shrine') shrine(save, run);
    else if (node.kind === 'miracle') miracle(save, run);
    else if (node.kind === 'event') {
      // Auto never takes on a lasting burden or trades away a relic.
      const opts = EVENTS[node.event!].options;
      const safe = opts.findIndex((o) => !o.outcome.gainRelic && !o.outcome.dropRelic);
      chooseEvent(save, run, Math.max(0, safe), rng);
    }
    else if (node.kind === 'reliquary') {
      const offer = relicOffer(run, rng);
      if (offer.length) takeRelic(save, run, offer[0].id);
      else run.resolved = true;
    } else {
      const b = makeBattle(save, run, currentNode(run)!.encounter!, rng);
      const res = autoBattle(b, 600);
      absorbBattle(run, b);
      if (res !== 'victory') return finishRun(save, run, 'defeat');
      expBattle(save, b);
      winRoom(run, save, rng);
    }
    if (run.pendingRelic) {
      const offer = relicOffer(run, rng);
      if (offer.length) takeRelic(save, run, offer[0].id);
      else run.pendingRelic = false;
    }
  }
  return finishRun(save, run, 'victory');
}

/** Can this crypt, at this tier, be repeated? It must have been cleared there. */
export function canRepeat(save: SaveData, crypt: CryptDef, heresy: number) {
  return save.cleared.includes(crypt.id) && heresy <= (save.heresy?.[crypt.id] ?? 0);
}

/** Up to `times` runs with the given party (those still able to march). */
export function repeatRuns(save: SaveData, party: string[], crypt: CryptDef, heresy: number, times: number, rng: Rng = Math.random): RunResult[] {
  const out: RunResult[] = [];
  for (let i = 0; i < times; i++) {
    const ready = party.filter((id) => canMuster(save, id));
    if (!ready.length) break;
    const r = autoRun(save, ready, crypt, heresy, rng);
    out.push(r);
    if (r.outcome !== 'victory') break;
  }
  return out;
}
