import type { SaveData } from '../state/save';
import { giltOf } from './currency';
import { grant, rewardText, type Reward, type TaskEvent } from './tasks';
import { send } from './missives';

/**
 * The Pilgrim's Pass: a 30-day season of 50 tiers, climbed with Steps earned by
 * playing as usual (any fight, pull, claim or upgrade counts, through
 * tasks.track). Every tier pays on the free lane; the Sworn lane, bought once a
 * season for Gilt, pays more on every tier, back to the first. Past tier 50,
 * every further tier's worth of Steps opens an Overflow chest.
 *
 * Steps are capped per day so the climb asks for a visit each day, not one
 * long night; a full season needs about 25 good days of the 30.
 */

export const SEASON_DAYS = 30;
export const TIERS = 50;
export const STEPS_PER_TIER = 100;
/** Most Steps one local day can give. */
export const DAILY_STEP_CAP = 240;
/** Gilt to swear to the season's Sworn lane. */
export const SWORN_COST = 600;
/** Each Overflow chest past the last tier. */
export const OVERFLOW: Reward = { tithes: 500, alms: 20 };

/** Seasons count from this local date. */
const EPOCH = new Date(2026, 10, 16).getTime();

const NAMES = ['Ash', 'Bells', 'Thorns', 'Salt', 'Iron', 'Wicks', 'Veils', 'Bone'];

/** Steps for each thing done. */
export const STEPS: Record<TaskEvent, number> = {
  fightWon: 3,
  eliteWon: 6,
  bossWon: 12,
  cryptCleared: 30,
  pull: 4,
  enhance: 3,
  levelUp: 4,
  takeVow: 12,
  vigilClaim: 12,
  dailyDone: 60,
  trialWon: 12,
  towerFloor: 6,
  inquisitionWon: 12,
  ordealWon: 8,
};

export interface PassState {
  season: number;
  steps: number;
  /** Steps taken on `day` (local date), for the daily cap. */
  day: string;
  today: number;
  sworn?: boolean;
  /** Tiers claimed on each lane. */
  free: number[];
  paid: number[];
  /** Overflow chests opened. */
  overflow: number;
}

export interface Season {
  index: number;
  name: string;
  starts: number;
  ends: number;
}

/** The season running at `now`. */
export function seasonAt(now = Date.now()): Season {
  const len = SEASON_DAYS * 864e5;
  const index = Math.floor((now - EPOCH) / len);
  const starts = EPOCH + index * len;
  return { index, name: `Season of ${NAMES[((index % NAMES.length) + NAMES.length) % NAMES.length]}`, starts, ends: starts + len };
}

const dayOf = (now: number) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** This season's pass state, fresh when a new season has begun. */
export function passOf(save: SaveData, now = Date.now()): PassState {
  const s = seasonAt(now).index;
  if (save.pass && save.pass.season !== s) mailUnclaimed(save, save.pass, now);
  if (!save.pass || save.pass.season !== s) save.pass = { season: s, steps: 0, day: dayOf(now), today: 0, free: [], paid: [], overflow: 0 };
  if (save.pass.day !== dayOf(now)) {
    save.pass.day = dayOf(now);
    save.pass.today = 0;
  }
  return save.pass;
}

/** A season's tiers reached but never claimed go to Missives when it ends. */
function mailUnclaimed(save: SaveData, p: PassState, now: number) {
  const missed: Reward[] = [];
  for (let t = 1; t <= tierOf(p); t++) {
    if (!p.free.includes(t)) missed.push(freeReward(t));
    if (p.sworn && !p.paid.includes(t)) missed.push(paidReward(t));
  }
  const extra = Math.floor(Math.max(0, p.steps - TIERS * STEPS_PER_TIER) / STEPS_PER_TIER) - p.overflow;
  for (let i = 0; i < extra; i++) missed.push(OVERFLOW);
  if (missed.length) send(save, { from: "The Pilgrim's Pass", title: 'The season has turned!', body: 'You walked the steps but never took the rewards. Here they are. Walk the new season harder!', reward: sumRewards(missed) }, now);
}

/** Adds Steps for something done (called from tasks.track). Returns Steps actually gained. */
export function passTrack(save: SaveData, event: TaskEvent, n = 1, now = Date.now()): number {
  const p = passOf(save, now);
  const want = (STEPS[event] ?? 0) * n;
  const got = Math.max(0, Math.min(want, DAILY_STEP_CAP - p.today));
  p.today += got;
  p.steps += got;
  return got;
}

/** Tier reached (0..TIERS). */
export const tierOf = (p: PassState) => Math.min(TIERS, Math.floor(p.steps / STEPS_PER_TIER));

/** The free lane's reward for a tier (1-based). */
export function freeReward(tier: number): Reward {
  if (tier === TIERS) return { seals: 10, gilt: 100 };
  if (tier % 10 === 0) return { seals: 5 };
  if (tier % 5 === 0) return { seals: 2, items: { ash2: 2 } };
  const cycle = tier % 4;
  if (cycle === 1) return { tithes: 300 + 20 * tier };
  if (cycle === 2) return { items: { unction2: 2 } };
  if (cycle === 3) return { items: { incense1: 4, page1: 3 } };
  return { seals: 1 };
}

/** The Sworn lane's reward for a tier (1-based). */
export function paidReward(tier: number): Reward {
  if (tier === TIERS) return { seals: 30, gilt: 200, items: { canon2: 5 } };
  if (tier % 10 === 0) return { seals: 8, items: { writ2: 1 } };
  if (tier % 5 === 0) return { seals: 4, gilt: 40 };
  const cycle = tier % 3;
  if (cycle === 1) return { seals: 1, tithes: 400 };
  if (cycle === 2) return { items: { unction3: 1, ash2: 2 } };
  return { gilt: 15, items: { canon1: 2 } };
}

export function freeClaimable(save: SaveData, tier: number, now = Date.now()) {
  const p = passOf(save, now);
  return tier <= tierOf(p) && !p.free.includes(tier);
}

export function paidClaimable(save: SaveData, tier: number, now = Date.now()) {
  const p = passOf(save, now);
  return !!p.sworn && tier <= tierOf(p) && !p.paid.includes(tier);
}

/** Overflow chests waiting past the last tier. */
export function overflowReady(save: SaveData, now = Date.now()) {
  const p = passOf(save, now);
  const extra = Math.max(0, p.steps - TIERS * STEPS_PER_TIER);
  return Math.floor(extra / STEPS_PER_TIER) - p.overflow;
}

export function passReady(save: SaveData, now = Date.now()) {
  const p = passOf(save, now);
  for (let t = 1; t <= tierOf(p); t++) if (!p.free.includes(t) || (p.sworn && !p.paid.includes(t))) return true;
  return overflowReady(save, now) > 0;
}

/** Swears to the Sworn lane for Gilt. */
export function swearPass(save: SaveData, now = Date.now()): boolean {
  const p = passOf(save, now);
  if (p.sworn || giltOf(save) < SWORN_COST) return false;
  save.gilt = giltOf(save) - SWORN_COST;
  p.sworn = true;
  return true;
}

/** Claims everything ready on both lanes, and any Overflow chests. Returns what was paid. */
export function claimAllPass(save: SaveData, now = Date.now()): Reward[] {
  const p = passOf(save, now);
  const paid: Reward[] = [];
  for (let t = 1; t <= tierOf(p); t++) {
    if (!p.free.includes(t)) {
      p.free.push(t);
      paid.push(freeReward(t));
    }
    if (p.sworn && !p.paid.includes(t)) {
      p.paid.push(t);
      paid.push(paidReward(t));
    }
  }
  for (let i = overflowReady(save, now); i > 0; i--) {
    p.overflow++;
    paid.push(OVERFLOW);
  }
  paid.forEach((r) => grant(save, r));
  return paid;
}

/** All rewards summed, for one line of text. */
export function sumRewards(rs: Reward[]): Reward {
  const out: Reward = {};
  for (const r of rs) {
    out.seals = (out.seals ?? 0) + (r.seals ?? 0);
    out.tithes = (out.tithes ?? 0) + (r.tithes ?? 0);
    out.gilt = (out.gilt ?? 0) + (r.gilt ?? 0);
    out.alms = (out.alms ?? 0) + (r.alms ?? 0);
    for (const [k, v] of Object.entries(r.items ?? {})) (out.items ??= {})[k as keyof NonNullable<Reward['items']>] = ((out.items?.[k as keyof NonNullable<Reward['items']>] ?? 0) as number) + (v as number);
  }
  return out;
}

export const sumText = (rs: Reward[]) => rewardText(sumRewards(rs));
