import { CRUSADERS } from '../data/crusaders';
import type { CrusaderDef, Rarity } from '../data/types';
import type { SaveData } from '../state/save';
import { ERRAND_SLOTS, busySisters, errandsOf, fitsBonus, isDone, claimErrand, openErrands, rarityAtLeast, sendErrand, type ErrandDef } from './errands';
import { MAX_GEAR_LEVEL, MAX_REFINE, SUB_UPGRADE_LEVELS, enhance, enhanceBlock, gearOf, salvage, salvageValue, type GearItem } from './gear';
import { addBags } from './items';
import type { Reward } from './tasks';
import { sisterPower } from './power';
import { MAX_VOW, copiesFor, standIn, takeVow, tierOf, vowCost } from './tiers';

/**
 * One-tap conveniences found in most gachas: Quick Vow (every Vow her copies
 * already pay for, across the whole roster), Quick Send and Claim all for
 * Holy Errands, Melt spares for the armory, and Enhance to the next substat
 * roll. Each has a plan (what it would do, for the confirm sheet) and the act.
 */

const RANK: Rarity[] = ['R', 'SR', 'SSR', 'UR'];
const defOf = (id: string) => CRUSADERS.find((c) => c.id === id);

// ---- Quick Vow -------------------------------------------------------------

export interface VowStep {
  id: string;
  name: string;
  /** Vows she holds before, and after. */
  from: number;
  to: number;
  tithes: number;
}

export interface VowPlan {
  steps: VowStep[];
  vows: number;
  tithes: number;
}

/**
 * Every Vow paid in copies alone (no Stigmata, no tier rise: those stay the
 * player's choice), within the Tithes held. The rarest and strongest Sisters
 * go first, so a short purse lifts the ones that matter most.
 */
export function quickVowPlan(save: SaveData): VowPlan {
  const order = CRUSADERS.filter((c) => save.owned[c.id]).sort((a, b) => RANK.indexOf(b.rarity) - RANK.indexOf(a.rarity) || sisterPower(save, b) - sisterPower(save, a));
  let purse = save.tithes;
  const steps: VowStep[] = [];
  for (const c of order) {
    const o = save.owned[c.id];
    let vow = o.vow;
    let tokens = o.tokens ?? 0;
    let spent = 0;
    while (vow < MAX_VOW) {
      const need = copiesFor(tierOf(o), vow);
      const cost = vowCost({ vow, tier: o.tier });
      if (tokens < need || purse < cost) break;
      tokens -= need;
      purse -= cost;
      spent += cost;
      vow++;
    }
    if (vow > o.vow) steps.push({ id: c.id, name: c.name, from: o.vow, to: vow, tithes: spent });
  }
  return { steps, vows: steps.reduce((n, s) => n + s.to - s.from, 0), tithes: steps.reduce((n, s) => n + s.tithes, 0) };
}

/** Takes every Vow in the plan. Returns the plan as it was carried out. */
export function takeQuickVows(save: SaveData): VowPlan {
  const plan = quickVowPlan(save);
  for (const s of plan.steps) {
    const c = defOf(s.id);
    for (let v = s.from; v < s.to; v++) {
      // never let a stand-in slip in: copies alone pay for a Quick Vow
      if (standIn(save.owned[s.id], c?.rarity).short) break;
      takeVow(save, s.id, c?.rarity);
    }
  }
  return plan;
}

/** Sisters with a Vow their copies already pay for (the Roster tab's dot). */
export const quickVowReady = (save: SaveData) =>
  Object.values(save.owned).some((o) => o.vow < MAX_VOW && (o.tokens ?? 0) >= copiesFor(tierOf(o), o.vow) && save.tithes >= vowCost(o));

// ---- Holy Errands ------------------------------------------------------------

/**
 * The Sisters an errand would take: the bonus Sister first, then the weakest
 * (least needed elsewhere), with one of the rarity asked. Undefined if the
 * free Sisters can't fill it.
 */
export function errandPick(save: SaveData, e: ErrandDef, busy: Set<string>): string[] | undefined {
  const free = CRUSADERS.filter((c) => save.owned[c.id] && !busy.has(c.id));
  const ranked = [...free].sort((a, b) => Number(fitsBonus(e, b.id)) - Number(fitsBonus(e, a.id)) || sisterPower(save, a) - sisterPower(save, b));
  const out: CrusaderDef[] = ranked.slice(0, e.size);
  if (out.length < e.size) return undefined;
  if (e.minRarity && !out.some((c) => rarityAtLeast(c.rarity, e.minRarity))) {
    const rare = ranked.find((c) => rarityAtLeast(c.rarity, e.minRarity) && !out.includes(c));
    if (!rare) return undefined;
    out[out.length - 1] = rare;
  }
  return out.map((c) => c.id);
}

export interface SendStep {
  errand: ErrandDef;
  sisters: string[];
}

/** Fills every free errand slot, the longest (richest) errands first. */
export function quickSendPlan(save: SaveData, now = Date.now()): SendStep[] {
  const free = ERRAND_SLOTS - errandsOf(save, now).active.length;
  const busy = new Set(busySisters(save));
  const out: SendStep[] = [];
  const open = [...openErrands(save, now)].sort((a, b) => b.hours - a.hours);
  for (const e of open) {
    if (out.length >= free) break;
    const pick = errandPick(save, e, busy);
    if (!pick) continue;
    pick.forEach((id) => busy.add(id));
    out.push({ errand: e, sisters: pick });
  }
  return out;
}

export function quickSend(save: SaveData, now = Date.now()): SendStep[] {
  const plan = quickSendPlan(save, now);
  return plan.filter((s) => sendErrand(save, s.errand, s.sisters, now));
}

/** Brings every finished errand home. Returns how many, and all they paid. */
export function claimAllErrands(save: SaveData, now = Date.now()): { count: number; reward: Reward } {
  const s = errandsOf(save, now);
  const total: Reward = { tithes: 0, alms: 0, seals: 0, items: {} };
  let count = 0;
  for (let i = s.active.length - 1; i >= 0; i--) {
    if (!isDone(s.active[i], now)) continue;
    const r = claimErrand(save, i, now);
    if (!r) continue;
    count++;
    total.tithes! += r.tithes ?? 0;
    total.alms! += r.alms ?? 0;
    total.seals! += r.seals ?? 0;
    total.items = addBags(total.items ?? {}, r.items ?? {});
  }
  return { count, reward: total };
}

// ---- Gear -----------------------------------------------------------------------

/** Spare gear: worn by no one, never enhanced, of `upTo` rarity or lower. */
export const spareGear = (save: SaveData, upTo: Rarity = 'SR') => gearOf(save).filter((g) => !g.on && g.level === 0 && RANK.indexOf(g.rarity) <= RANK.indexOf(upTo));

/** Melts every spare piece. Returns pieces melted and Tithes paid. */
export function meltSpares(save: SaveData, upTo: Rarity = 'SR'): { count: number; tithes: number } {
  const list = spareGear(save, upTo);
  let tithes = 0;
  for (const g of list) tithes += salvage(save, g.uid);
  return { count: list.length, tithes };
}

export const spareValue = (save: SaveData, upTo: Rarity = 'SR') => spareGear(save, upTo).reduce((n, g) => n + salvageValue(g), 0);

/** The next level where a substat grows (or the cap of this stage), above the piece's level. R gear (no substats) climbs to the cap. */
export function nextMilestone(item: Pick<GearItem, 'level' | 'subs'>): number {
  const roll = item.subs.length ? SUB_UPGRADE_LEVELS.find((l) => l > item.level) : undefined;
  const cap = item.level < MAX_GEAR_LEVEL ? MAX_GEAR_LEVEL : MAX_REFINE;
  return Math.min(roll ?? cap, cap);
}

/** Enhances level by level up to `target`, stopping when the purse runs dry. Returns levels gained. */
export function enhanceTo(save: SaveData, item: GearItem, target = nextMilestone(item)): number {
  let n = 0;
  while (item.level < target && !enhanceBlock(save, item) && enhance(save, item)) n++;
  return n;
}
