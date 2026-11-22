import { CRUSADERS } from '../data/crusaders';
import { ALMS_FOR_TOKEN, earn } from './currency';
import type { CrusaderDef, Rarity } from '../data/types';
import type { SaveData } from '../state/save';
import { track } from './tasks';
import { STIGMATA_FOR_COPY, addStigmata, copiesLeft } from './tiers';
import { isStandard, limitedWindow } from './limited';

export const RATES: Record<Rarity, number> = { R: 0.6, SR: 0.3, SSR: 0.085, UR: 0.015 };
export const RARITY_ORDER: Rarity[] = ['R', 'SR', 'SSR', 'UR'];
/** The PITY_LIMIT-th pull without an SSR or UR is guaranteed one. */
export const PITY_LIMIT = 50;
/** UR pity, shared across every banner: from pull UR_SOFT the UR chance climbs; pull UR_HARD is always a UR. */
export const UR_SOFT = 60;
export const UR_HARD = 80;
/** UR chance added per pull past UR_SOFT. */
export const UR_SOFT_STEP = 0.06;
/**
 * Relic Shards: one per pull on an Order banner, kept per Order; SPARK of them
 * buy that Order's UR. On the Limited banner they are Saint's Favor, kept per
 * Saint (never lost: a Saint's Favor waits for her return).
 */
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

/** Sisters of a rarity that any banner can give at random (limited Saints only come as a target). */
const standardOf = (rarity: Rarity) => CRUSADERS.filter((c) => c.rarity === rarity && isStandard(c));

/**
 * Points the saved banner at what is on offer now: a Limited banner from an
 * earlier window moves to this window's Saint; a missing or stale Order banner
 * falls back to that Order's (or the first Order's) UR.
 */
export function syncBanner(save: SaveData, now = Date.now()) {
  const b = save.banner;
  if (b?.limited !== undefined) {
    const w = limitedWindow(now);
    if (b.limited !== w.index || b.target !== w.saint.id) save.banner = { order: w.saint.order, target: w.saint.id, limited: w.index };
    return save.banner!;
  }
  const urOf = (order: string) => CRUSADERS.find((c) => c.order === order && c.rarity === 'UR' && isStandard(c));
  if (!b || !urOf(b.order)) {
    const first = CRUSADERS.find((c) => c.rarity === 'UR' && isStandard(c))!;
    save.banner = { order: first.order, target: first.id };
  } else if (b.target !== urOf(b.order)!.id) b.target = urOf(b.order)!.id;
  return save.banner!;
}

/** Puts the Limited banner up at the Altar. */
export function chooseLimited(save: SaveData, now = Date.now()) {
  const w = limitedWindow(now);
  save.banner = { order: w.saint.order, target: w.saint.id, limited: w.index };
}

/** The banner's targeted UR, if it has one. */
function targetOf(save: SaveData): CrusaderDef | undefined {
  const b = save.banner;
  if (!b) return undefined;
  return CRUSADERS.find((c) => c.id === b.target && c.rarity === 'UR' && (b.limited !== undefined ? !!c.limited : c.order === b.order && isStandard(c)));
}

/** The SSRs this banner boosts: the Order's two, or the Limited window's pair. */
export function boostedSSRs(save: SaveData, now = Date.now()): CrusaderDef[] {
  const b = save.banner;
  if (!b) return [];
  if (b.limited !== undefined) return limitedWindow(now).ssrs;
  return standardOf('SSR').filter((c) => c.order === b.order);
}

/** Where a pull's Relic Shards (or Saint's Favor) go, and what spends them. */
export const sparkKey = (c: Pick<CrusaderDef, 'id' | 'order' | 'limited'>) => (c.limited ? c.id : c.order);

/**
 * Picks the Sister for a rolled rarity. A banner UR is the target half the
 * time and always after a miss; an SSR is a boosted one half the time.
 */
function pickCrusader(save: SaveData, rng: Rng, rarity: Rarity): CrusaderDef {
  const pool = standardOf(rarity);
  const target = targetOf(save);
  if (rarity === 'UR' && target) {
    if (save.urGuaranteed || rng() < TARGET_SHARE) {
      save.urGuaranteed = false;
      return target;
    }
    save.urGuaranteed = true;
    return pickFrom(rng, pool.filter((c) => c.id !== target.id));
  }
  if (rarity === 'SSR') {
    const boosted = boostedSSRs(save);
    if (boosted.length && rng() < ORDER_SSR_SHARE) return pickFrom(rng, boosted);
  }
  return pickFrom(rng, pool);
}

/**
 * Every Sister this banner can give, with her base chance per pull (before
 * pity). The targeted UR takes half the UR rate, the boosted SSRs half the SSR
 * rate; everyone else shares the rest of her rarity evenly.
 */
export function bannerPool(save: SaveData): { c: CrusaderDef; chance: number; featured: boolean }[] {
  const out: { c: CrusaderDef; chance: number; featured: boolean }[] = [];
  const target = targetOf(save);
  const boosted = boostedSSRs(save);
  for (const r of [...RARITY_ORDER].reverse()) {
    const rate = RATES[r];
    const pool = standardOf(r);
    if (r === 'UR' && target) {
      out.push({ c: target, chance: rate * TARGET_SHARE, featured: true });
      const rest = pool.filter((c) => c !== target);
      for (const c of rest) out.push({ c, chance: (rate * (1 - TARGET_SHARE)) / rest.length, featured: false });
      continue;
    }
    for (const c of pool) {
      let chance = rate / pool.length;
      const up = r === 'SSR' && boosted.includes(c);
      if (r === 'SSR' && boosted.length) chance = (rate * (1 - ORDER_SSR_SHARE)) / pool.length + (up ? (rate * ORDER_SSR_SHARE) / boosted.length : 0);
      out.push({ c, chance, featured: up });
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
  const target = targetOf(save);
  if (target) (save.shards ??= {})[sparkKey(target)] = shardsOf(save, sparkKey(target)) + 1;
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
  log.push({ id: r.crusader.id, at: Date.now(), banner: save.banner?.limited !== undefined ? 'Limited' : save.banner?.order, isNew: r.isNew || undefined });
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
  if (save.banner) syncBanner(save);
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

/** Spends SPARK Relic Shards of an Order for its UR, or SPARK Saint's Favor for that Saint. */
export function claimSpark(save: SaveData, id: string): PullResult | undefined {
  const c = CRUSADERS.find((x) => x.id === id && x.rarity === 'UR');
  if (!c || shardsOf(save, sparkKey(c)) < SPARK) return undefined;
  save.shards![sparkKey(c)] -= SPARK;
  return grantSister(save, c);
}

