import type { CandleResult } from '../systems/candles';
import type { StageReward } from '../systems/campaign';
import type { FieldBattle } from '../systems/field';
import type { Battle } from '../systems/combat';
import type { RunState } from '../systems/crusade';
import type { Rng } from '../systems/gacha';

/**
 * A fight started by a side mode (Trials, Tower, Inquisition). The Battle
 * screen builds it with `make` and hands the result to `finish`, which says
 * where to go next.
 */
export interface Challenge {
  /** Shown as the battle's opening line. */
  label: string;
  make: (rng: Rng) => Battle;
  finish: (outcome: 'victory' | 'defeat', battle: Battle) => { scene: string; data?: object; /** Closing line, in place of the default. */ line?: string; /** A won stage: shown as the battle screen's win card. */ win?: WinCard };
}

/** What a won stage's win card shows (FieldScene.winCard). */
export interface WinCard {
  /** Stage label, e.g. "2-5", and its name. */
  stage: string;
  name?: string;
  candles?: CandleResult;
  /** First-clear spoils (and a chapter chest). */
  reward?: StageReward;
  chest?: StageReward;
  /** Stage numbers for the Again and Onward buttons. */
  again?: number;
  onward?: number;
}

/**
 * A fight left from the battle screen's Pause menu (not on Auto), kept so it
 * picks up where it stopped. Only resumed by the same run node or the same challenge.
 */
export interface PausedBattle {
  battle: Battle;
  /** Where everyone stands, kept as it was. */
  field: FieldBattle;
  /** Candle length at the start, for the candle display. */
  vigilMax: number;
  run?: RunState;
  floor?: number;
  at?: number;
  challenge?: Challenge;
}

/** The crusade in progress, if any. Lives in memory only; a reload abandons it. */
export const current: { run?: RunState; challenge?: Challenge; paused?: PausedBattle; /** Crypt picked on the Crusade tab. */ cryptId?: string; /** Heresy tier picked per crypt. */ heresy?: Record<string, number> } = {};
