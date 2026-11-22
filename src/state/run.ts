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
  finish: (outcome: 'victory' | 'defeat', battle: Battle) => { scene: string; data?: object };
}

/**
 * A fight left on the player's turn (via the battle Menu), kept so it picks up
 * where it stopped. Only resumed by the same run node or the same challenge.
 */
export interface PausedBattle {
  battle: Battle;
  actorUid: string;
  /** Candle length at the start, for the candle display. */
  vigilMax: number;
  run?: RunState;
  floor?: number;
  at?: number;
  challenge?: Challenge;
}

/** The crusade in progress, if any. Lives in memory only; a reload abandons it. */
export const current: { run?: RunState; challenge?: Challenge; paused?: PausedBattle; /** Crypt picked on the Crusade tab. */ cryptId?: string; /** Heresy tier picked per crypt. */ heresy?: Record<string, number> } = {};
