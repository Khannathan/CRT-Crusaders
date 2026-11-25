import type { SaveData } from '../state/save';
import { roman } from './roman';
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
  ordealWon: 15,
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
  /** Unlock schedule this save is on (2 = modes spread over two weeks). */
  sched?: number;
  /** The rank a save had when the schedule changed: modes it had open stay open. */
  kept?: number;
}

/** The rank state; an older save starts with Faith for what it has already done. */
export function rankOf(save: SaveData): RankState {
  if (!save.rank) {
    const levels = Object.values(save.owned).reduce((n, o) => n + o.level - 1, 0);
    const xp = levels * RANK_XP.levelUp + save.cleared.length * RANK_XP.cryptCleared * 2 + save.totalPulls * RANK_XP.pull;
    save.rank = { xp, gifted: rankFromXp(xp).rank, sched: 2 };
  }
  // A save from before the two-week schedule keeps every mode it had opened.
  if (!save.rank.sched) {
    save.rank.sched = 2;
    save.rank.kept = rankFromXp(save.rank.xp).rank;
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

/**
 * What each rank opens, keyed by the screen it opens (a scene key, or 'Repeat'
 * for crypt Sweeps). The ranks are spread so a new mode arrives every day or
 * two over a player's first two weeks (an active player gains roughly 500 to
 * 900 Faith a day). `was` is the rank the mode needed before this schedule:
 * a save that had reached it keeps the mode open (see opened).
 */
export interface Unlock {
  key: string;
  rank: number;
  was: number;
  name: string;
  desc: string;
}

export const UNLOCKS: Unlock[] = [
  { key: 'Matins', rank: 1, was: 1, name: 'Matins', desc: 'A candle each dawn, and gifts that never reset.' },
  { key: 'Penance', rank: 2, was: 2, name: 'Penance', desc: 'Daily and weekly devotions that pay in wax.' },
  { key: 'Trials', rank: 3, was: 3, name: 'Relic Trials', desc: 'A daily spoil. Sweep what you have mastered.' },
  { key: 'Hunt', rank: 4, was: 4, name: 'Purge Hunts', desc: 'A great beast each day. Your best pays Godblood.' },
  { key: 'Ordeals', rank: 5, was: 3, name: 'The Ordeals', desc: 'A weekly league of twenty Orders. Rise, or be cast down!' },
  { key: 'Confession', rank: 6, was: 5, name: 'Confession', desc: 'Give offerings to raise bonds. Each level adds strength and a confession.' },
  { key: 'Repeat', rank: 7, was: 4, name: 'Sweep', desc: 'Clear a beaten crypt again on Auto, several times over.' },
  { key: 'Abyss', rank: 8, was: 4, name: 'The Abyssal Crypt', desc: 'Endless tiers, no limit. Farm the dark for gear.' },
  { key: 'Tower', rank: 9, was: 6, name: 'The Bell Tower', desc: 'An endless climb. Some floors admit one Order only, others only the humble.' },
  { key: 'Procession', rank: 10, was: 5, name: 'The Reliquary Procession', desc: 'Guard the relics. Win offerings.' },
  { key: 'Hold', rank: 11, was: 4, name: 'Hold the Line', desc: 'Ten waves. Wounds carry. Hold!' },
  { key: 'War', rank: 13, was: 6, name: 'Chapter War', desc: 'Storm a rival Chapter\'s forts, two storms a day. Stars win the war.' },
  { key: 'Raid', rank: 15, was: 6, name: 'The Nightmare Raid', desc: 'Three bosses. Three Squads. Its wounds carry!' },
  { key: 'Inquisition', rank: 17, was: 8, name: 'The Inquisition', desc: 'Three hard trials under a fortnightly edict. Earn Brands.' },
];

/** Rank of Faith a screen needs (1 when nothing gates it). */
export const rankFor = (key: string) => UNLOCKS.find((u) => u.key === key)?.rank ?? 1;

/** True when the screen `key` is open: its rank reached, or already reached under the old schedule. */
export function opened(save: SaveData, key: string): boolean {
  const u = UNLOCKS.find((x) => x.key === key);
  if (!u) return true;
  const kept = rankOf(save).kept ?? 0;
  return rankInfo(save).rank >= u.rank || kept >= u.was;
}

export const unlocked = (save: SaveData, rank: number) => rankInfo(save).rank >= rank;

export const ROMAN_RANK = roman;
