import type { SaveData } from '../state/save';
import { GILT_PER_RANK, earn } from './currency';
import type { TaskEvent } from './tasks';

/**
 * Rank of Faith: an account level fed by everything the player does. Ranks
 * open side modes one at a time, so a new player isn't flooded, and every
 * rank leaves a small gift to claim: Seals, Tithes and Gilt.
 */
export const RANK_XP: Record<TaskEvent, number> = {
  fightWon: 10,
  eliteWon: 15,
  bossWon: 30,
  cryptCleared: 50,
  pull: 4,
  enhance: 3,
  levelUp: 6,
  takeVow: 25,
  vigilClaim: 15,
  dailyDone: 40,
  trialWon: 15,
  towerFloor: 12,
  inquisitionWon: 25,
};

export const MAX_RANK = 30;

/** Faith needed to climb from rank r to r + 1. */
export const rankStep = (r: number) => 60 + 40 * r;

export interface RankInfo {
  rank: number;
  /** Faith gained toward the next rank. */
  into: number;
  /** Faith the next rank needs (0 at max). */
  need: number;
}

export function rankFromXp(xp: number): RankInfo {
  let rank = 1;
  let rest = xp;
  while (rank < MAX_RANK && rest >= rankStep(rank)) {
    rest -= rankStep(rank);
    rank += 1;
  }
  return { rank, into: rank >= MAX_RANK ? 0 : rest, need: rank >= MAX_RANK ? 0 : rankStep(rank) };
}

export interface RankState {
  xp: number;
  /** Highest rank whose gift was claimed (1 = none yet). */
  gifted: number;
}

/** The rank state; an older save starts with Faith for what it has already done. */
export function rankOf(save: SaveData): RankState {
  if (!save.rank) {
    const levels = Object.values(save.owned).reduce((n, o) => n + o.level - 1, 0);
    const xp = levels * RANK_XP.levelUp + save.cleared.length * RANK_XP.cryptCleared * 2 + save.totalPulls * RANK_XP.pull;
    save.rank = { xp, gifted: rankFromXp(xp).rank };
  }
  return save.rank;
}

export const rankInfo = (save: SaveData) => rankFromXp(rankOf(save).xp);

export function gainFaith(save: SaveData, event: TaskEvent, n = 1) {
  rankOf(save).xp += RANK_XP[event] * n;
}

export interface RankGift {
  seals: number;
  tithes: number;
  gilt: number;
}

export const rankGift = (r: number): RankGift => ({ seals: 2 + Math.floor(r / 5), tithes: 100 * r, gilt: GILT_PER_RANK });

/** Ranks reached whose gifts are still unclaimed. */
export function giftsWaiting(save: SaveData): number[] {
  const { rank } = rankInfo(save);
  const from = rankOf(save).gifted + 1;
  return Array.from({ length: Math.max(0, rank - from + 1) }, (_, i) => from + i);
}

/** Claims every waiting gift at once. */
export function claimGifts(save: SaveData): RankGift {
  const total = { seals: 0, tithes: 0, gilt: 0 };
  for (const r of giftsWaiting(save)) {
    const g = rankGift(r);
    total.seals += g.seals;
    total.tithes += g.tithes;
    total.gilt += g.gilt;
  }
  earn(save, total.gilt);
  save.seals += total.seals;
  save.tithes += total.tithes;
  rankOf(save).gifted = rankInfo(save).rank;
  return total;
}

/** What each rank opens. Later modes add their entry here. */
export interface Unlock {
  rank: number;
  name: string;
  desc: string;
}

export const UNLOCKS: Unlock[] = [
  { rank: 1, name: 'Matins', desc: 'A candle each dawn, and gifts that never reset.' },
  { rank: 2, name: 'Penance', desc: 'Daily and weekly devotions that pay in wax.' },
  { rank: 3, name: 'Relic Trials', desc: 'A daily spoil: gear, Tithes or Seals. Sweep what you have mastered.' },
  { rank: 4, name: 'Repeat crusades', desc: 'Send your Sisters back through a cleared crypt on Auto, several times over.' },
  { rank: 5, name: 'Confession', desc: 'Grow close to your Sisters. Each bond level adds strength and one more confession.' },
  { rank: 6, name: 'The Bell Tower', desc: 'An endless climb. Some floors admit one Order only, others only the humble.' },
  { rank: 8, name: 'The Inquisition', desc: 'Three hard trials under a heretical edict, renewed every two weeks. Earn Brands.' },
];

export const unlocked = (save: SaveData, rank: number) => rankInfo(save).rank >= rank;

export const ROMAN_RANK = (n: number) => {
  const map: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) (out += s), (n -= v);
  return out;
};
