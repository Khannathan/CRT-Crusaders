import { CRUSADERS } from '../data/crusaders';
import type { CrusaderDef, Rarity } from '../data/types';
import type { SaveData } from '../state/save';

export const RATES: Record<Rarity, number> = { R: 0.6, SR: 0.3, SSR: 0.085, UR: 0.015 };
export const RARITY_ORDER: Rarity[] = ['R', 'SR', 'SSR', 'UR'];
/** The PITY_LIMIT-th pull without an SSR or UR is guaranteed one. */
export const PITY_LIMIT = 50;
export const MAX_VOW = 5;
/** Tithes paid for a duplicate once Vows are maxed. */
export const OVERFLOW_TITHES = 200;
export const COST_ONE = 1;
export const COST_TEN = 10;

export type Rng = () => number;

export interface PullResult {
  crusader: CrusaderDef;
  isNew: boolean;
  /** Vow rank after this pull (0 for a new recruit). */
  vow: number;
  /** Tithes granted because Vows were already maxed. */
  tithes: number;
}

const rank = (r: Rarity) => RARITY_ORDER.indexOf(r);

/** Rolls a rarity from RATES, restricted to rarities at or above `floor`. */
export function rollRarity(rng: Rng, floor: Rarity = 'R'): Rarity {
  const allowed = RARITY_ORDER.filter((r) => rank(r) >= rank(floor));
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

/** One pull: applies pity, adds the crusader (or a Vow) to the save. Does not spend Seals. */
function pullOnce(save: SaveData, rng: Rng, floor: Rarity): PullResult {
  save.pity += 1;
  save.totalPulls += 1;
  const pityFloor: Rarity = save.pity >= PITY_LIMIT ? 'SSR' : 'R';
  const rarity = rollRarity(rng, rank(pityFloor) > rank(floor) ? pityFloor : floor);
  if (rank(rarity) >= rank('SSR')) save.pity = 0;

  const crusader = pickCrusader(save, rng, rarity);
  const owned = save.owned[crusader.id];
  if (!owned) {
    save.owned[crusader.id] = { level: 1, vow: 0 };
    return { crusader, isNew: true, vow: 0, tithes: 0 };
  }
  if (owned.vow < MAX_VOW) {
    owned.vow += 1;
    return { crusader, isNew: false, vow: owned.vow, tithes: 0 };
  }
  save.tithes += OVERFLOW_TITHES;
  return { crusader, isNew: false, vow: owned.vow, tithes: OVERFLOW_TITHES };
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
    return [pullOnce(save, rng, 'R')];
  }
  if (!save.freeTenUsed) save.freeTenUsed = true;
  else save.seals -= COST_TEN;

  const results: PullResult[] = [];
  for (let i = 0; i < 10; i++) {
    const needSR = i === 9 && results.every((r) => r.crusader.rarity === 'R');
    results.push(pullOnce(save, rng, needSR ? 'SR' : 'R'));
  }
  return results;
}
