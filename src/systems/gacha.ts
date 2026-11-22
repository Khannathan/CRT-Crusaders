import { CRUSADERS } from '../data/crusaders';
import { ALMS_FOR_TOKEN, earn } from './currency';
import type { CrusaderDef, Rarity } from '../data/types';
import type { SaveData } from '../state/save';
import { track } from './tasks';
import { STIGMATA_FOR_COPY, addStigmata, copiesLeft } from './tiers';

export const RATES: Record<Rarity, number> = { R: 0.6, SR: 0.3, SSR: 0.085, UR: 0.015 };
export const RARITY_ORDER: Rarity[] = ['R', 'SR', 'SSR', 'UR'];
/** The PITY_LIMIT-th pull without an SSR or UR is guaranteed one. */
export const PITY_LIMIT = 50;
/** UR pity, shared across every banner: from pull UR_SOFT the UR chance climbs; pull UR_HARD is always a UR. */
export const UR_SOFT = 60;
export const UR_HARD = 80;
/** UR chance added per pull past UR_SOFT. */
export const UR_SOFT_STEP = 0.06;
/** Relic Shards: one per pull on an Order banner, kept per Order; SPARK of them buys one of that Order's URs. */
export const SPARK = 150;
export { MAX_VOW } from './tiers';
/** Tithes paid for a duplicate once Vows are maxed. */
export const OVERFLOW_TITHES = 200;
export const COST_ONE = 1;
export const COST_TEN = 10;

export type Rng = () => number;

export interface PullResult {
  crusader: CrusaderDef;
  isNew: boolean;
  /** Her Vow rank (0 for a new recruit). */
  vow: number;
  /** Vow tokens she now holds, waiting for Take Vow. */
  tokens: number;
  /** Tithes granted because Vows were already maxed. */
  tithes: number;
  /** Alms granted with those Tithes. */
  alms?: number;
  /** Stigmata granted because she needs no more copies. */
  stigmata?: number;
}

const rank = (r: Rarity) => RARITY_ORDER.indexOf(r);

/** Rolls a rarity from RATES, restricted to rarities at or above `floor` (and below UR if `noUR`). */
export function rollRarity(rng: Rng, floor: Rarity = 'R', noUR = false): Rarity {
  const allowed = RARITY_ORDER.filter((r) => rank(r) >= rank(floor) && !(noUR && r === 'UR'));
  const total = allowed.reduce((s, r) => s + RATES[r], 0);
  let x = rng() * total;
  for (const r of allowed) {
    x -= RATES[r];
    if (x < 0) return r;
  }
  return allowed[allowed.length - 1];
}

/** Share of banner URs that are the targeted Sister (the rest are any other UR). */
export const TARGET_SHARE = 0.5;
/** Share of banner SSRs drawn from the banner's Order. */
export const ORDER_SSR_SHARE = 0.5;

const pickFrom = (rng: Rng, pool: CrusaderDef[]) => pool[Math.floor(rng() * pool.length)];

/**
 * Picks the Sister for a rolled rarity. On an Order banner, a UR is the target
 * half the time and always after a miss; an SSR comes from the Order half the time.
 */
function pickCrusader(save: SaveData, rng: Rng, rarity: Rarity): CrusaderDef {
  const pool = CRUSADERS.filter((c) => c.rarity === rarity);
  const banner = save.banner;
  const target = banner && CRUSADERS.find((c) => c.id === banner.target && c.order === banner.order && c.rarity === 'UR');
  if (rarity === 'UR' && target) {
    if (save.urGuaranteed || rng() < TARGET_SHARE) {
      save.urGuaranteed = false;
      return target;
    }
    save.urGuaranteed = true;
    return pickFrom(rng, pool.filter((c) => c.id !== target.id));
  }
  if (rarity === 'SSR' && banner) {
    const orderPool = pool.filter((c) => c.order === banner.order);
    if (orderPool.length && rng() < ORDER_SSR_SHARE) return pickFrom(rng, orderPool);
  }
  return pickFrom(rng, pool);
}

/**
 * Every Sister this banner can give, with her base chance per pull (before
 * pity). The targeted UR takes half the UR rate, the banner Order's SSRs half
 * the SSR rate; everyone else shares the rest of her rarity evenly.
 */
export function bannerPool(save: SaveData): { c: CrusaderDef; chance: number; featured: boolean }[] {
  const banner = save.banner;
  const out: { c: CrusaderDef; chance: number; featured: boolean }[] = [];
  for (const r of [...RARITY_ORDER].reverse()) {
    const pool = CRUSADERS.filter((c) => c.rarity === r);
    const rate = RATES[r];
    const target = r === 'UR' && banner ? pool.find((c) => c.id === banner.target) : undefined;
    const orderSSR = r === 'SSR' && banner ? pool.filter((c) => c.order === banner.order) : [];
    for (const c of pool) {
      let chance = rate / pool.length;
      if (target) chance = c === target ? rate * TARGET_SHARE : (rate * (1 - TARGET_SHARE)) / (pool.length - 1);
      else if (orderSSR.length) chance = (rate * (1 - ORDER_SSR_SHARE)) / pool.length + (orderSSR.includes(c) ? (rate * ORDER_SSR_SHARE) / orderSSR.length : 0);
      out.push({ c, chance, featured: c === target || orderSSR.includes(c) });
    }
  }
  return out;
}

/** UR chance on the n-th pull since the last UR (1-based). */
export function urChance(n: number) {
  if (n >= UR_HARD) return 1;
  if (n <= UR_SOFT) return RATES.UR;
  return Math.min(1, RATES.UR + UR_SOFT_STEP * (n - UR_SOFT));
}

/** Pulls left until a UR is certain. */
export const urPityLeft = (save: SaveData) => UR_HARD - (save.urPity ?? 0);

export const shardsOf = (save: SaveData, order: string) => save.shards?.[order] ?? 0;

/** One pull: applies pity, adds the Sister (or a Vow token) to the save. Does not spend Seals. */
function pullOnce(save: SaveData, rng: Rng, floor: Rarity): PullResult {
  save.pity += 1;
  save.totalPulls += 1;
  save.urPity = (save.urPity ?? 0) + 1;
  if (save.banner) (save.shards ??= {})[save.banner.order] = shardsOf(save, save.banner.order) + 1;
  const pityFloor: Rarity = save.pity >= PITY_LIMIT ? 'SSR' : 'R';
  const lo = rank(pityFloor) > rank(floor) ? pityFloor : floor;
  // Past soft pity the UR check comes first, at its raised chance.
  const soft = save.urPity > UR_SOFT;
  const rarity: Rarity = soft ? (rng() < urChance(save.urPity) ? 'UR' : rollRarity(rng, lo, true)) : rollRarity(rng, lo);
  if (rank(rarity) >= rank('SSR')) save.pity = 0;
  if (rarity === 'UR') save.urPity = 0;

  const result = grantSister(save, pickCrusader(save, rng, rarity));
  logPull(save, result);
  return result;
}

/** How many recent pulls the history keeps. */
export const PULL_LOG_MAX = 200;

function logPull(save: SaveData, r: PullResult) {
  const log = (save.pullLog ??= []);
  log.push({ id: r.crusader.id, at: Date.now(), banner: save.banner?.order, isNew: r.isNew || undefined });
  if (log.length > PULL_LOG_MAX) log.splice(0, log.length - PULL_LOG_MAX);
}

/** Adds a Sister, or a Vow token for a duplicate, or Tithes once her Vows are full. */
function grantSister(save: SaveData, crusader: CrusaderDef): PullResult {
  const owned = save.owned[crusader.id];
  if (!owned) {
    save.owned[crusader.id] = { level: 1, vow: 0 };
    return { crusader, isNew: true, vow: 0, tithes: 0, tokens: 0 };
  }
  // A duplicate becomes a Vow token (a copy), until she holds every copy her remaining Vows and tiers need.
  const tokens = owned.tokens ?? 0;
  if (tokens < copiesLeft(owned)) {
    owned.tokens = tokens + 1;
    return { crusader, isNew: false, vow: owned.vow, tithes: 0, tokens: owned.tokens };
  }
  // Past that, a copy becomes Stigmata, Tithes and Alms.
  save.tithes += OVERFLOW_TITHES;
  const alms = ALMS_FOR_TOKEN[crusader.rarity];
  earn(save, 0, alms);
  const stigmata = STIGMATA_FOR_COPY[crusader.rarity];
  addStigmata(save, stigmata);
  return { crusader, isNew: false, vow: owned.vow, tithes: OVERFLOW_TITHES, alms, stigmata, tokens };
}

export type PullKind = 'one' | 'ten';

export function canPull(save: SaveData, kind: PullKind): boolean {
  if (kind === 'ten' && !save.freeTenUsed) return true;
  return save.seals >= (kind === 'one' ? COST_ONE : COST_TEN);
}

/**
 * Spends Seals (or the free first 10-pull) and performs the pulls.
 * A 10-pull always contains at least one SR or better.
 */
export function pull(save: SaveData, kind: PullKind, rng: Rng = Math.random): PullResult[] {
  if (!canPull(save, kind)) return [];
  if (kind === 'one') {
    save.seals -= COST_ONE;
    track(save, 'pull');
    return [pullOnce(save, rng, 'R')];
  }
  if (!save.freeTenUsed) save.freeTenUsed = true;
  else save.seals -= COST_TEN;

  track(save, 'pull', 10);
  const results: PullResult[] = [];
  for (let i = 0; i < 10; i++) {
    const needSR = i === 9 && results.every((r) => r.crusader.rarity === 'R');
    results.push(pullOnce(save, rng, needSR ? 'SR' : 'R'));
  }
  return results;
}

/** Spends SPARK Relic Shards of an Order for one of its URs. */
export function claimSpark(save: SaveData, id: string): PullResult | undefined {
  const c = CRUSADERS.find((x) => x.id === id && x.rarity === 'UR');
  if (!c || shardsOf(save, c.order) < SPARK) return undefined;
  save.shards![c.order] -= SPARK;
  return grantSister(save, c);
}

