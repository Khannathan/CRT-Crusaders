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

/** The crusade in progress, if any. Lives in memory only; a reload abandons it. */
export const current: { run?: RunState; challenge?: Challenge; /** Crypt picked on the Crusade tab. */ cryptId?: string; /** Heresy tier picked per crypt. */ heresy?: Record<string, number> } = {};
