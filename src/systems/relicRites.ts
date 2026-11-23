import { CRUSADERS } from '../data/crusaders';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';
import type { Battle } from './combat';
import { CRYPTS, skirmish } from './crusade';
import type { Rng } from './gacha';
import { CP, foePower } from './power';
import { dayKey } from './tasks';

/**
 * Relic Rites: every SSR and UR Sister has her own rite, a boss fight that
 * must include her. Ten levels, each harder; a win pays Relic Motes that are
 * hers alone. Two victories a day across all Rites (spent only on a win);
 * a level beaten once can be swept. Motes sanctify her Litany: three steps,
 * opened by Canon ranks V, X and XV.
 */
export const RITE_LEVELS = 10;
export const RITE_ENTRIES = 2;

export interface RiteState {
  day: string;
  used: number;
  /** Highest level beaten, per Sister. */
  best: Record<string, number>;
  /** Relic Motes held, per Sister. */
  motes: Record<string, number>;
  /** Sanctified Litany step 0-3, per Sister. */
  sanct: Record<string, number>;
}

export const hasRite = (c: Pick<CrusaderDef, 'rarity'>) => c.rarity === 'SSR' || c.rarity === 'UR';

export function ritesOf(save: SaveData, now = Date.now()): RiteState {
  const r = (save.relicRites ??= { day: dayKey(now), used: 0, best: {}, motes: {}, sanct: {} });
  if (r.day !== dayKey(now)) {
    r.day = dayKey(now);
    r.used = 0;
  }
  return r;
}

export const riteEntriesLeft = (save: SaveData, now = Date.now()) => Math.max(0, RITE_ENTRIES - ritesOf(save, now).used);
export const riteBest = (save: SaveData, id: string) => save.relicRites?.best[id] ?? 0;
export const motesOf = (save: SaveData, id: string) => save.relicRites?.motes[id] ?? 0;

/** A Rite opens once she can be canonized (level 50). */
export const riteOpen = (save: SaveData, id: string) => {
  const c = CRUSADERS.find((x) => x.id === id);
  return !!c && hasRite(c) && (save.owned[id]?.level ?? 0) >= 50;
};

/** Recommended Power for a Rite level: about the end of the Road, then +25% a level. */
export const riteTarget = (level: number) => Math.round(30000 * 1.25 ** (level - 1));

const EMPTY = { owned: {} } as unknown as SaveData;
const scales = new Map<number, number>();
/** The Road's five chapter crypts, in turn. */
const chapterOf = (level: number) => ({ crypt: CRYPTS[(level - 1) % 5] });

function riteScale(level: number) {
  let v = scales.get(level);
  if (v === undefined) {
    const crypt = { ...chapterOf(level).crypt, power: 1 };
    const rec = (s: number) => foePower(skirmish(EMPTY, [], crypt.boss, 0, undefined, crypt, s)) * CP.recommend;
    v = 1;
    for (let i = 0; i < 3; i++) v *= riteTarget(level) / rec(v);
    scales.set(level, v);
  }
  return v;
}

/** Her Rite at a level: the boss of a Road chapter, far stronger. */
export function riteBattle(save: SaveData, party: string[], level: number, rng?: Rng): Battle {
  const crypt = { ...chapterOf(level).crypt, power: 1 };
  return skirmish(save, party, crypt.boss, 0, rng, crypt, riteScale(level));
}

/** Motes and Tithes for a win (or a sweep) at a level. */
export const riteReward = (level: number) => ({ motes: 2 + level, tithes: 300 + 150 * level });

/** Can she fight this level now? */
export function riteBlock(save: SaveData, id: string, level: number, now = Date.now()): string | undefined {
  if (!riteOpen(save, id)) return 'Opens at level 50 (SSR and UR only)';
  if (level < 1 || level > RITE_LEVELS) return 'No such level';
  if (level > riteBest(save, id) + 1) return 'Beat the level before it first';
  if (riteEntriesLeft(save, now) <= 0) return 'No victories left today';
  return undefined;
}

function pay(save: SaveData, id: string, level: number) {
  const r = ritesOf(save);
  const got = riteReward(level);
  r.used++;
  r.motes[id] = (r.motes[id] ?? 0) + got.motes;
  save.tithes += got.tithes;
  return got;
}

/** After the fight: a win spends an entry and pays; a loss costs nothing. */
export function finishRite(save: SaveData, id: string, level: number, won: boolean, now = Date.now()) {
  if (!won || riteBlock(save, id, level, now)) return undefined;
  const r = ritesOf(save, now);
  r.best[id] = Math.max(r.best[id] ?? 0, level);
  return pay(save, id, level);
}

/** Sweep a level she has beaten (spends an entry). */
export function sweepRite(save: SaveData, id: string, level: number, now = Date.now()) {
  if (level > riteBest(save, id) || riteBlock(save, id, level, now)) return undefined;
  return pay(save, id, level);
}

// The Sanctified Litany lives in sanctity.ts (battle setup reads it without pulling in the Rites).
export { SANCT_MAX, SANCT_STEPS, SANCT_LITANY, SANCT_ZEAL, sanctOf, sanctBlock, sanctify, sanctEffect } from './sanctity';
