import { commit, game } from '../state/game';
import { current } from '../state/run';
import { bondBattle } from './bonds';
import type { Battle } from './combat';
import { absorbBattle, finishRun, winRoom } from './crusade';
import { expBattle } from './exp';

/** Where a finished fight leads, and its closing line. */
export interface Settled {
  scene: string;
  data?: object;
  /** The battle log's last line. */
  line: string;
  won: boolean;
}

/**
 * Pays out a finished fight (EXP, bonds, the room or the challenge) and says
 * where to go next. Shared by the Battle screen and fights left running on
 * Auto in the background.
 */
export function settleBattle(battle: Battle, outcome: 'victory' | 'defeat'): Settled {
  const won = outcome === 'victory';
  const challenge = current.challenge;
  const exp = expBattle(game.save, battle);
  const expLine = exp.exp ? `  +${exp.exp} EXP${exp.levelled.length ? ', level up!' : ''}` : '';
  if (challenge) {
    current.challenge = undefined;
    bondBattle(game.save, battle);
    const next = challenge.finish(outcome, battle);
    commit();
    return { ...next, won, line: next.line ?? (won ? `The trial is passed.${expLine}` : 'Your Sisters fall back, bloodied but alive.') };
  }
  const run = current.run!;
  absorbBattle(run, battle);
  const line = won ? `The heretics are purged.${expLine}` : 'Your Sisters have fallen. The dark takes its tithe.';
  if (won) {
    winRoom(run, game.save);
    commit();
    return { scene: 'Crypt', won, line };
  }
  const result = finishRun(game.save, run, 'defeat');
  current.run = undefined;
  commit();
  return { scene: 'Results', data: { result }, won, line };
}
