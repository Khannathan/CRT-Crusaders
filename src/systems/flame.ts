import type { SaveData } from '../state/save';
import { weekKey } from './tasks';

/**
 * The Vigil Flame: a candle that grows one step for each day you play. A
 * missed day is first covered by a grace day (two each week); past those it
 * dims the flame one step, never below a single lit step. It never resets to
 * zero, and it pays only cosmetics (titles), never power.
 */
export const GRACE_PER_WEEK = 2;
export const MAX_FLAME = 60;

export interface FlameTier {
  at: number;
  name: string;
  title: string;
  color: number;
}

export const FLAME_TIERS: FlameTier[] = [
  { at: 1, name: 'Taper', title: 'Taper-Bearer', color: 0xe8c27a },
  { at: 3, name: 'Votive', title: 'Keeper of the Votive', color: 0xf0a040 },
  { at: 7, name: 'Altar Candle', title: 'Keeper of the Altar Flame', color: 0xff8a3d },
  { at: 14, name: 'Paschal Candle', title: 'Bearer of the Paschal Flame', color: 0xffd27a },
  { at: 30, name: 'Sanctus Flame', title: 'Warden of the Sanctus Flame', color: 0xbfe0ff },
  { at: 60, name: 'Eternal Flame', title: 'Keeper of the Eternal Flame', color: 0xd7b8ff },
];

/** Local calendar day number (midnight to midnight). */
export function dayNumber(now: number) {
  const d = new Date(now);
  return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 864e5);
}

/** Local noon of a day number (safe from daylight-saving edges). */
const dayStart = (day: number) => {
  const d = new Date(day * 864e5);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12).getTime();
};

export const tierOf = (level: number) => [...FLAME_TIERS].reverse().find((t) => level >= t.at) ?? FLAME_TIERS[0];
export const nextTier = (level: number) => FLAME_TIERS.find((t) => t.at > level);

export interface Tending {
  /** Steps the flame grew (1 on a new day). */
  grew: number;
  /** Missed days that grace covered. */
  graced: number;
  /** Steps it dimmed for missed days grace could not cover. */
  dimmed: number;
  /** Titles earned by reaching a new tier. */
  titles: string[];
}

/** Call once per visit: lights today's step. Returns what changed, or undefined if today was already tended. */
export function tendFlame(save: SaveData, now = Date.now()): Tending | undefined {
  const today = dayNumber(now);
  const week = weekKey(now);
  const f = (save.flame ??= { level: 0, best: 0, day: today - 1, grace: GRACE_PER_WEEK, week });
  if (f.day >= today) return undefined;
  // Missed days are covered by the grace of the week they fell in.
  let graced = 0;
  let uncovered = 0;
  for (let d = f.day + 1; d < today; d++) {
    const wk = weekKey(dayStart(d));
    if (wk !== f.week) {
      f.week = wk;
      f.grace = GRACE_PER_WEEK;
    }
    if (f.grace > 0) {
      f.grace -= 1;
      graced += 1;
    } else uncovered += 1;
  }
  if (f.week !== week) {
    f.week = week;
    f.grace = GRACE_PER_WEEK;
  }
  const dimmed = Math.min(uncovered, Math.max(0, f.level - 1));
  f.level = Math.min(MAX_FLAME, f.level - dimmed + 1);
  f.day = today;
  const titles: string[] = [];
  for (const t of FLAME_TIERS) {
    if (f.level >= t.at && f.best < t.at) {
      titles.push(t.title);
      if (!(save.titles ??= []).includes(t.title)) save.titles.push(t.title);
    }
  }
  f.best = Math.max(f.best, f.level);
  return { grew: 1, graced, dimmed, titles };
}

export const flameOf = (save: SaveData) => save.flame ?? { level: 0, best: 0, day: 0, grace: GRACE_PER_WEEK, week: '' };
