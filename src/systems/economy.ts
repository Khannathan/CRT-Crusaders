import { newSave } from '../state/save';
import { roadRates, FAST_FREE, FAST_HOURS } from './campaign';
import { MARKS } from './tasks';
import { MATINS, MATINS_DAYS } from './matins';
import { DAILY_STEP_CAP, OVERFLOW, SEASON_DAYS, STEPS_PER_TIER, TIERS, freeReward } from './pass';
import { FEAST_MARKS, FEAST_STALL } from './feast';
import { LIMITED_DAYS as FEAST_DAYS } from './limited';
import { BRAND_MARKS, ROTATION_DAYS as INQ_DAYS } from './inquisition';
import { placeReward as ordealReward } from './ordeals';
import { SIEGE_MILESTONES, SIEGE_TIERS, placeReward as chapterPlace } from './chapter';
import { WAR_LOSS, WAR_WIN } from './chapterWar';
import { CLEAR_CHEST } from './raid';
import { BOARD_SIZE, DURATIONS, ERRAND_SLOTS, errandReward } from './errands';
import { ALMONRY_POOL, ALMONRY_SLOTS, GILT_OFFERS, TITHE_OFFERS } from './shop';
import { PILGRIMAGE_BONUS, PILGRIMAGE_CLEARS } from './crusade';

/**
 * The Seal ledger: how many Seals (one Seal = one pull) a steady free player
 * earns in a week, source by source, from the game's own numbers. Used to
 * tune the gacha's pace; see economy.test.ts for the band it must stay in.
 *
 * The player: logs in daily, clears every daily and weekly duty, claims the
 * Vigil twice a day, keeps all errand slots on 20-hour errands, and spends
 * Gilt and Alms on Seals first. Everything here is per week.
 */
export interface Player {
  /** Highest Pilgrim's Road stage cleared. */
  road: number;
  /** Ordeals league (0 = lowest) and usual place. */
  league: number;
  ordealPlace: number;
  /** Usual place in the Chapter's Siege standings. */
  siegePlace: number;
  /** Share of Chapter Wars won. */
  warWins: number;
  /** Gilt earned per week outside the lines below, spent on Seals. */
  giltPerWeek: number;
}

/** A month-old, steady free player. */
export const STEADY: Player = { road: 30, league: 1, ordealPlace: 6, siegePlace: 5, warWins: 0.5, giltPerWeek: 300 };

export interface Line {
  source: string;
  seals: number;
  gilt?: number;
}

const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((n, x) => n + f(x), 0);

export function sealLedger(p: Player = STEADY): Line[] {
  const save = newSave();
  save.campaign = { ...(save.campaign ?? {}), best: p.road } as never;
  const rates = roadRates(save);
  const passTiersPerSeason = Math.min(TIERS, (DAILY_STEP_CAP * SEASON_DAYS) / STEPS_PER_TIER);
  const overflowPerSeason = Math.max(0, (DAILY_STEP_CAP * SEASON_DAYS) / STEPS_PER_TIER - TIERS);
  const freeSeals = sum(Array.from({ length: Math.floor(passTiersPerSeason) }, (_, i) => freeReward(i + 1)), (r) => r.seals ?? 0);
  const perWeek = (n: number, days: number) => (n * 7) / days;
  const lines: Line[] = [
    { source: 'Daily Penance', seals: 7 * sum(MARKS.daily, (m) => m.reward.seals ?? 0) },
    { source: 'Weekly Litany', seals: sum(MARKS.weekly, (m) => m.reward.seals ?? 0), gilt: sum(MARKS.weekly, (m) => m.reward.gilt ?? 0) },
    { source: 'Matins', seals: perWeek(sum(MATINS, (r) => r.seals ?? 0), MATINS_DAYS), gilt: perWeek(sum(MATINS, (r) => r.gilt ?? 0), MATINS_DAYS) },
    // The Vigil carries part-Seals between claims, so its rate counts in full.
    { source: 'The Vigil (24 h a day, plus the free Fast Reward)', seals: 7 * (24 + FAST_FREE * FAST_HOURS) * rates.seals },
    { source: "Pilgrim's Pass, free lane and Overflow", seals: perWeek(freeSeals + overflowPerSeason * (OVERFLOW.seals ?? 0), SEASON_DAYS) },
    // A 20-hour errand pays a Seal; about one board errand in four is that long, and slots cap it.
    { source: 'Holy Errands (20 h)', seals: 7 * Math.min(BOARD_SIZE / DURATIONS.length, (24 * ERRAND_SLOTS) / 20) * (errandReward('relic' as never, 20).seals ?? 0) },
    { source: 'Feast milestones and stall', seals: perWeek(sum(FEAST_MARKS, (m) => m.reward.seals ?? 0) + sum(FEAST_STALL.filter((s) => s.reward.seals), (s) => s.stock * (s.reward.seals ?? 0)), FEAST_DAYS) },
    { source: 'Inquisition (9 Brands)', seals: perWeek(sum(BRAND_MARKS, (m) => m.seals ?? 0), INQ_DAYS), gilt: perWeek(sum(BRAND_MARKS, (m) => m.gilt ?? 0), INQ_DAYS) },
    { source: 'Ordeals', seals: ordealReward(p.ordealPlace, p.league).seals ?? 0, gilt: ordealReward(p.ordealPlace, p.league).gilt ?? 0 },
    { source: 'Chapter Siege', seals: sum(SIEGE_MILESTONES, (m) => m.reward.seals ?? 0) + sum(SIEGE_TIERS, (m) => m.reward.seals ?? 0) + (chapterPlace(p.siegePlace).seals ?? 0) },
    { source: 'Chapter War', seals: p.warWins * (WAR_WIN.seals ?? 0) + (1 - p.warWins) * (WAR_LOSS.seals ?? 0), gilt: p.warWins * (WAR_WIN.gilt ?? 0) },
    { source: 'Raid clear chest', seals: CLEAR_CHEST.seals, gilt: CLEAR_CHEST.gilt },
    { source: 'Weekly Pilgrimage (blessed crypt clears)', seals: 7 * PILGRIMAGE_CLEARS * PILGRIMAGE_BONUS.seals },
    { source: 'Shop: Tithe Exchange', seals: sum(TITHE_OFFERS, (o) => (o.goods.seals ?? 0) * o.limit) },
    { source: 'Shop: Almonry (when it stocks Seals)', seals: 7 * (ALMONRY_SLOTS / ALMONRY_POOL.length) * sum(ALMONRY_POOL, (o) => o.goods.seals ?? 0) },
  ];
  // Gilt from the lines above plus other sources, spent on single Seals at the Gilt counter.
  const gilt = sum(lines, (l) => l.gilt ?? 0) + p.giltPerWeek;
  const single = GILT_OFFERS.find((o) => o.id === 'g-seal')!;
  lines.push({ source: `Shop: Gilt counter (${Math.round(gilt)} Gilt a week)`, seals: Math.min(7 * single.limit, gilt / single.price) });
  return lines.map((l) => ({ ...l, seals: Math.round(l.seals * 10) / 10 }));
}

export const sealsPerWeek = (p: Player = STEADY) => Math.round(sum(sealLedger(p), (l) => l.seals));
