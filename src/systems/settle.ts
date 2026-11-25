import type { WinCard } from '../state/run';
import { simulateField } from './field';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import { bondBattle } from './bonds';
import type { Battle } from './combat';
import { absorbBattle, currentNode, finishRun, makeBattle, winRoom } from './crusade';
import { newSeed, seeded } from './rng';
import { expBattle } from './exp';
import { battleHosanna } from './hosanna';
import { track } from './tasks';

/** Where a finished fight leads, and its closing line. */
export interface Settled {
  scene: string;
  data?: object;
  /** The battle log's last line. */
  line: string;
  won: boolean;
  /** A won stage's win card (Pilgrim's Road). */
  win?: WinCard;
  /** EXP the party took, and who levelled. */
  exp?: { exp: number; levelled: string[] };
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
    if (won) countWin(battle);
    const next = challenge.finish(outcome, battle);
    commit();
    return { ...next, won, exp, line: next.line ?? (won ? `The trial is passed by decree.${expLine}` : 'Your Sisters fall back, bloodied but alive.') };
  }
  const run = current.run!;
  absorbBattle(run, battle);
  const line = won ? `Sentence carried out. The heretics burn!${expLine}` : 'Your Sisters have fallen. The Order will remember who failed it.';
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

/**
 * A won fight outside the crypts (the Road, the Tower, Hunts and every other
 * mode) counts as horrors slain, for Penance, the Novitiate, Deeds and Rank of
 * Faith, just as a crypt room does (crypt rooms count in winRoom).
 */
function countWin(battle: Battle) {
  track(game.save, 'fightWon');
  if (battle.units.some((u) => u.side === 'enemy' && u.boss)) track(game.save, 'bossWon');
}

/**
 * A crypt fight cut off by a reload (the app closed mid-fight) plays out on
 * Auto, as if skipped to its end, and is paid out like any other.
 */
export function playOutStoredFight(): Settled | undefined {
  const run = current.run;
  const node = run && currentNode(run);
  if (!run || !node?.encounter || current.challenge) return undefined;
  const battle = makeBattle(game.save, run, node.encounter, seeded(newSeed()));
  // Crypt fights are fought on the field, so they play out there too.
  const outcome = simulateField(battle, { hosanna: battleHosanna(game.save, battle) }, 600).outcome === 'victory' ? 'victory' : 'defeat';
  return settleBattle(battle, outcome);
}
