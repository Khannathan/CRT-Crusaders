import { CRUSADERS } from '../data/crusaders';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';
import type { Battle } from './combat';
import { BELFRY, OSSUARY, skirmish } from './crusade';
import { earn } from './currency';
import type { Rng } from './gacha';
import { bagText, give, type Bag } from './items';
import { limitedWindow, windowAt, type LimitedWindow } from './limited';
import { send, sumLetters } from './missives';
import { dayKey } from './tasks';
import { addStigmata } from './tiers';

/**
 * The Feast: a two-week event that runs beside each limited Saint. Feast
 * Candles come from six Feast stages (a big first-clear payout, then a few
 * repeat payouts a day) and a trickle from everything else you do. Candles
 * fill a milestone track and buy from the Feast stall, whose stock is capped
 * per Feast and includes the Saint's Favor. When the Feast ends, unspent
 * Candles melt into Alms: nothing is lost.
 */

export interface FeastStage {
  name: string;
  encounter: string;
  heresy: number;
  scale: number;
  /** Which crypt's look and rules (resolved at fight time: tasks.ts imports this file). */
  crypt: 'ossuary' | 'belfry';
  /** Candles for the first win this Feast. */
  first: number;
  /** Candles for each later win (while repeats are left today). */
  repeat: number;
}

export const FEAST_STAGES: FeastStage[] = [
  { name: 'The Procession Gate', encounter: 'ossuary-2', heresy: 0, scale: 1, crypt: 'ossuary', first: 60, repeat: 20 },
  { name: 'The Bread of Ash', encounter: 'ossuary-4', heresy: 0, scale: 1.3, crypt: 'ossuary', first: 80, repeat: 25 },
  { name: 'The Unwelcome Guests', encounter: 'ossuary-elite-1', heresy: 1, scale: 1.6, crypt: 'ossuary', first: 120, repeat: 30 },
  { name: 'The Bells at Supper', encounter: 'belfry-3', heresy: 1, scale: 2, crypt: 'belfry', first: 160, repeat: 35 },
  { name: 'The Bishop’s Table', encounter: 'belfry-elite-2', heresy: 2, scale: 2.5, crypt: 'belfry', first: 220, repeat: 40 },
  { name: 'The Feast Unmasked', encounter: 'abbess', heresy: 2, scale: 3, crypt: 'belfry', first: 300, repeat: 50 },
];

/** Repeat wins that pay Candles each day (first wins always pay). */
export const FEAST_REPEATS = 5;
/** Candle bonus per featured Sister in the party, and its cap. */
export const FEATURED_BONUS = 0.25;
export const FEATURED_CAP = 1;
/** Alms per unspent Candle when a Feast ends. */
export const ALMS_PER_CANDLE = 0.5;

export interface FeastReward {
  seals?: number;
  gilt?: number;
  tithes?: number;
  stigmata?: number;
  favor?: number;
  items?: Bag;
  title?: boolean;
}

export const rewardText = (r: FeastReward, saint?: CrusaderDef) =>
  [
    r.favor ? `${r.favor} ${saint ? saint.name.split(' ')[0] + "'s " : ''}Favor` : '',
    r.seals ? `${r.seals} Seal${r.seals > 1 ? 's' : ''}` : '',
    r.gilt ? `${r.gilt} Gilt` : '',
    r.stigmata ? `${r.stigmata} Stigmata` : '',
    r.tithes ? `${r.tithes} Tithes` : '',
    bagText(r.items),
    r.title ? 'a title' : '',
  ]
    .filter(Boolean)
    .join(' + ');

/** Paid on reaching each total of Candles earned this Feast. */
export const FEAST_MARKS: { at: number; reward: FeastReward }[] = [
  { at: 200, reward: { seals: 1, tithes: 500 } },
  { at: 500, reward: { favor: 10, gilt: 50 } },
  { at: 1000, reward: { seals: 2, items: { ash2: 3, page2: 3 } } },
  { at: 1800, reward: { favor: 15, stigmata: 2 } },
  { at: 2800, reward: { seals: 3, gilt: 100 } },
  { at: 4000, reward: { favor: 25, title: true } },
];

export interface StallItem {
  id: string;
  name: string;
  cost: number;
  /** How many this Feast. */
  stock: number;
  reward: FeastReward;
}

export const FEAST_STALL: StallItem[] = [
  { id: 'favor', name: "Saint's Favor ×10", cost: 250, stock: 5, reward: { favor: 10 } },
  { id: 'seal', name: 'Seal', cost: 80, stock: 3, reward: { seals: 1 } },
  { id: 'stigmata', name: 'Stigmata', cost: 150, stock: 5, reward: { stigmata: 1 } },
  { id: 'ash', name: "Martyr's Ash III", cost: 200, stock: 3, reward: { items: { ash3: 1 } } },
  { id: 'page', name: 'Psalter Pages III', cost: 200, stock: 3, reward: { items: { page3: 1 } } },
  { id: 'writ', name: 'Armory Writ', cost: 120, stock: 5, reward: { items: { armory2: 1 } } },
  { id: 'whistle', name: 'Hound Whistle', cost: 100, stock: 5, reward: { items: { kennel2: 1 } } },
  { id: 'gilt', name: '50 Gilt', cost: 100, stock: 5, reward: { gilt: 50 } },
  { id: 'tithes', name: '1000 Tithes', cost: 40, stock: 20, reward: { tithes: 1000 } },
];

export interface FeastState {
  /** The limited window this Feast belongs to. */
  index: number;
  candles: number;
  /** Candles earned this Feast (fills the milestone track). */
  earned: number;
  /** Stages won at least once this Feast. */
  won: number[];
  /** Milestones (by `at`) paid. */
  paid: number[];
  /** Stall purchases by item id. */
  bought: Record<string, number>;
  day: string;
  /** Repeat payouts used today. */
  repeats: number;
  /** Alms melted from the last Feast's Candles, shown once. */
  melted?: number;
}

export const feastName = (w: LimitedWindow = limitedWindow()) => `Feast of ${w.saint.name.split(' ')[0]}`;
export const feastTitle = (w: LimitedWindow) => `Guest at the ${feastName(w)}`;

/** This Feast's state; a new Feast melts the last one's Candles into Alms. */
export function feastOf(save: SaveData, now = Date.now()): FeastState {
  const w = limitedWindow(now);
  let f = save.feast;
  if (!f || f.index !== w.index) {
    // Milestones reached but never claimed go to Missives.
    const missed = f ? FEAST_MARKS.filter((m) => f!.earned >= m.at && !f!.paid.includes(m.at)) : [];
    if (missed.length) {
      const old = windowAt(f!.index);
      const r = sumLetters(missed.map((m) => ({ ...m.reward, favor: m.reward.favor ? { id: old.saint.id, name: old.saint.name.split(' ')[0], n: m.reward.favor } : undefined, title: m.reward.title ? feastTitle(old) : undefined })));
      send(save, { from: feastName(old), title: 'The Feast is over!', body: 'You lit the candles but left the gifts on the table. They are yours. Take them!', reward: r }, now);
    }
    const melted = f ? Math.floor(f.candles * ALMS_PER_CANDLE) : 0;
    if (melted) earn(save, 0, melted);
    f = save.feast = { index: w.index, candles: 0, earned: 0, won: [], paid: [], bought: {}, day: dayKey(now), repeats: 0, melted: melted || undefined };
  }
  if (f.day !== dayKey(now)) {
    f.day = dayKey(now);
    f.repeats = 0;
  }
  return f;
}

export function addCandles(save: SaveData, n: number, now = Date.now()) {
  const f = feastOf(save, now);
  n = Math.round(n);
  f.candles += n;
  f.earned += n;
  return n;
}

/** Candles from ordinary play during a Feast (fed by tasks.track). */
const TRICKLE: Partial<Record<string, number>> = { fightWon: 2, eliteWon: 5, bossWon: 10, cryptCleared: 15, trialWon: 6, towerFloor: 4, inquisitionWon: 10, dailyDone: 40, vigilClaim: 5 };
export function trickle(save: SaveData, event: string, n = 1, now = Date.now()) {
  const per = TRICKLE[event];
  if (per) addCandles(save, per * n, now);
}

/** Sisters who earn extra Candles: the Saint, her Order and the boosted SSRs. */
export function isFeatured(id: string, now = Date.now()) {
  const w = limitedWindow(now);
  const c = CRUSADERS.find((x) => x.id === id);
  return !!c && (c.id === w.saint.id || c.order === w.saint.order || w.ssrs.includes(c));
}
export const featuredBonus = (party: string[], now = Date.now()) => Math.min(FEATURED_CAP, party.filter((id) => isFeatured(id, now)).length * FEATURED_BONUS);

/** A stage opens once the one before it has been won this Feast. */
export const stageOpen = (save: SaveData, i: number) => i === 0 || feastOf(save).won.includes(i - 1);
export const repeatsLeft = (save: SaveData, now = Date.now()) => Math.max(0, FEAST_REPEATS - feastOf(save, now).repeats);

export function feastBattle(save: SaveData, party: string[], i: number, rng?: Rng): Battle {
  const st = FEAST_STAGES[i];
  return skirmish(save, party, st.encounter, st.heresy, rng, st.crypt === 'belfry' ? BELFRY : OSSUARY, st.scale);
}

/** Records a fought stage: Candles for a first win, or a repeat while any are left. */
export function finishStage(save: SaveData, i: number, party: string[], won: boolean, now = Date.now()): number {
  if (!won) return 0;
  const f = feastOf(save, now);
  const st = FEAST_STAGES[i];
  let base = 0;
  if (!f.won.includes(i)) {
    f.won.push(i);
    base = st.first;
  } else if (f.repeats < FEAST_REPEATS) {
    f.repeats += 1;
    base = st.repeat;
  }
  return base ? addCandles(save, base * (1 + featuredBonus(party, now)), now) : 0;
}

/** Sweep: repeat a won stage at once, for one of today's repeats. */
export function sweepStage(save: SaveData, i: number, now = Date.now()): number {
  const f = feastOf(save, now);
  if (!f.won.includes(i) || f.repeats >= FEAST_REPEATS) return 0;
  f.repeats += 1;
  return addCandles(save, FEAST_STAGES[i].repeat, now);
}

function grant(save: SaveData, r: FeastReward, now: number) {
  const w = limitedWindow(now);
  if (r.seals) save.seals += r.seals;
  if (r.tithes) save.tithes += r.tithes;
  if (r.gilt) earn(save, r.gilt);
  if (r.stigmata) addStigmata(save, r.stigmata);
  if (r.items) give(save, r.items);
  if (r.favor) (save.shards ??= {})[w.saint.id] = (save.shards?.[w.saint.id] ?? 0) + r.favor;
  if (r.title) {
    const t = feastTitle(w);
    if (!(save.titles ??= []).includes(t)) save.titles.push(t);
  }
}

export const marksReady = (save: SaveData, now = Date.now()) => {
  const f = feastOf(save, now);
  return FEAST_MARKS.filter((m) => f.earned >= m.at && !f.paid.includes(m.at));
};

/** Pays every milestone reached. Returns what was paid. */
export function claimMarks(save: SaveData, now = Date.now()) {
  const ready = marksReady(save, now);
  for (const m of ready) {
    feastOf(save, now).paid.push(m.at);
    grant(save, m.reward, now);
  }
  return ready;
}

export const stockLeft = (save: SaveData, item: StallItem, now = Date.now()) => item.stock - (feastOf(save, now).bought[item.id] ?? 0);

export function buy(save: SaveData, id: string, now = Date.now()): boolean {
  const item = FEAST_STALL.find((x) => x.id === id);
  const f = feastOf(save, now);
  if (!item || f.candles < item.cost || stockLeft(save, item, now) <= 0) return false;
  f.candles -= item.cost;
  f.bought[id] = (f.bought[id] ?? 0) + 1;
  grant(save, item.reward, now);
  return true;
}

/** Something to do or claim at the Feast (for the board's dot). */
export function feastReady(save: SaveData, now = Date.now()) {
  const f = feastOf(save, now);
  return marksReady(save, now).length > 0 || f.won.length === 0 || (f.won.length > 0 && repeatsLeft(save, now) > 0);
}
