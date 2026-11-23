import { HOUNDS, houndDef, type HoundDef, type Howl } from '../data/hounds';
import type { Rarity } from '../data/types';
import type { SaveData } from '../state/save';
import { ALMS_FOR_TOKEN, earn, giltOf } from './currency';
import type { Rng } from './gacha';
import { dayKey } from './tasks';
import { countOf, give, spend } from './items';

/**
 * The Kennel, at the Altar. Hounds answer the Whistle: one free call each day,
 * then a Hound Whistle (kennel2, the Kennel's own currency) or Gilt. Every
 * call leaves a Marrow Bone (kennel1); HOUND_SPARK of them, or one Saint's
 * Leash (kennel3), adopt any hound you choose.
 * A hound you already have grows a level instead (up to HOUND_MAX), and each
 * level makes its howl 10% stronger; past the last level it turns into Alms.
 * One hound is set at a time and goes into every fight.
 */
export interface HoundState {
  owned: Record<string, { level: number }>;
  /** The hound that goes into battle. */
  active?: string;
  /** Day the free whistle was last used. */
  freeDay?: string;
  /** Whistles since the last SSR or UR hound (pity). */
  pity?: number;
  /** The first-visit Hound Whistles have been given. */
  gifted?: boolean;
}

export const HOUND_MAX = 5;
export const HOWL_PER_LEVEL = 0.1;
export const WHISTLE_GILT = 80;
/** Ten calls for Gilt at once, a little cheaper. */
export const TEN_WHISTLE_GILT = 720;
/** Marrow Bones that adopt any hound. */
export const HOUND_SPARK = 60;
/** Hound Whistles given the first time the Kennel opens. */
export const FIRST_WHISTLES = 5;
export const HOUND_RATES: Record<Rarity, number> = { R: 0.55, SR: 0.32, SSR: 0.11, UR: 0.02 };
/** An SSR or better hound is sure by this whistle. */
export const HOUND_PITY = 20;
/** The hound every Sisterhood starts with. */
export const FIRST_HOUND = 'cur';

export function houndsOf(save: SaveData): HoundState {
  if (!save.hounds) save.hounds = { owned: { [FIRST_HOUND]: { level: 1 } }, active: FIRST_HOUND };
  return save.hounds;
}

export const freeWhistle = (save: SaveData, now = Date.now()) => houndsOf(save).freeDay !== dayKey(now);

/** Gives the first-visit Hound Whistles. Returns true the first time. */
export function giftWhistles(save: SaveData): boolean {
  const s = houndsOf(save);
  if (s.gifted) return false;
  s.gifted = true;
  give(save, { kennel2: FIRST_WHISTLES });
  return true;
}

export type WhistlePay = 'free' | 'whistle' | 'gilt';

/** How `n` calls would be paid for: the free call first, then Hound Whistles, then Gilt. */
export function whistlePay(save: SaveData, n: 1 | 10 = 1, now = Date.now()): WhistlePay | undefined {
  if (n === 1 && freeWhistle(save, now)) return 'free';
  if (countOf(save, 'kennel2') >= n) return 'whistle';
  if (giltOf(save) >= (n === 10 ? TEN_WHISTLE_GILT : WHISTLE_GILT)) return 'gilt';
  return undefined;
}

export function whistleBlock(save: SaveData, now = Date.now(), n: 1 | 10 = 1): string | undefined {
  if (whistlePay(save, n, now)) return undefined;
  return n === 10 ? `Needs 10 Hound Whistles or ${TEN_WHISTLE_GILT} Gilt.` : `Needs a Hound Whistle or ${WHISTLE_GILT} Gilt.`;
}

export interface WhistleResult {
  hound: HoundDef;
  /** New level, or 1 for a new hound. */
  level: number;
  isNew: boolean;
  /** Alms paid instead, for a hound already at its last level. */
  alms?: number;
}

function rollHoundRarity(rng: Rng, pity: number): Rarity {
  if (pity + 1 >= HOUND_PITY) return rng() < HOUND_RATES.UR / (HOUND_RATES.UR + HOUND_RATES.SSR) ? 'UR' : 'SSR';
  let x = rng();
  for (const r of ['UR', 'SSR', 'SR', 'R'] as Rarity[]) {
    x -= HOUND_RATES[r];
    if (x < 0) return r;
  }
  return 'R';
}

/** Adds a hound, or a level, or Alms once it is at its last level. */
function grantHound(save: SaveData, hound: HoundDef): WhistleResult {
  const s = houndsOf(save);
  const had = s.owned[hound.id];
  if (!had) {
    s.owned[hound.id] = { level: 1 };
    return { hound, level: 1, isNew: true };
  }
  if (had.level < HOUND_MAX) {
    had.level += 1;
    return { hound, level: had.level, isNew: false };
  }
  const alms = ALMS_FOR_TOKEN[hound.rarity];
  earn(save, 0, alms);
  return { hound, level: had.level, isNew: false, alms };
}

function callOnce(save: SaveData, rng: Rng): WhistleResult {
  const s = houndsOf(save);
  const rarity = rollHoundRarity(rng, s.pity ?? 0);
  s.pity = rarity === 'SSR' || rarity === 'UR' ? 0 : (s.pity ?? 0) + 1;
  const pool = HOUNDS.filter((h) => h.rarity === rarity);
  give(save, { kennel1: 1 });
  return grantHound(save, pool[Math.floor(rng() * pool.length)]);
}

/** Blows the whistle once: free once a day, then a Hound Whistle, then Gilt. */
export function whistle(save: SaveData, rng: Rng = Math.random, now = Date.now()): WhistleResult | undefined {
  return whistleMany(save, 1, rng, now)[0];
}

/** Blows the whistle `n` times (1 or 10). Returns [] when it can't be paid for. */
export function whistleMany(save: SaveData, n: 1 | 10, rng: Rng = Math.random, now = Date.now()): WhistleResult[] {
  const pay = whistlePay(save, n, now);
  if (!pay) return [];
  if (pay === 'free') houndsOf(save).freeDay = dayKey(now);
  else if (pay === 'whistle') spend(save, { kennel2: n });
  else save.gilt = giltOf(save) - (n === 10 ? TEN_WHISTLE_GILT : WHISTLE_GILT);
  return Array.from({ length: n }, () => callOnce(save, rng));
}

export function adoptBlock(save: SaveData): string | undefined {
  if (countOf(save, 'kennel3') >= 1 || countOf(save, 'kennel1') >= HOUND_SPARK) return undefined;
  return `Needs ${HOUND_SPARK} Marrow Bones or a Saint's Leash.`;
}

/** Adopts the hound you choose: a Saint's Leash if you have one, else HOUND_SPARK Marrow Bones. */
export function adoptHound(save: SaveData, id: string): WhistleResult | undefined {
  const hound = houndDef(id);
  if (!hound || adoptBlock(save)) return undefined;
  if (countOf(save, 'kennel3') >= 1) spend(save, { kennel3: 1 });
  else spend(save, { kennel1: HOUND_SPARK });
  return grantHound(save, hound);
}

export function setHound(save: SaveData, id: string | undefined) {
  const s = houndsOf(save);
  if (id && !s.owned[id]) return;
  s.active = id;
}

/** A hound's howl at a level: every number grows HOWL_PER_LEVEL per level past the first. */
export function howlAt(def: HoundDef, level: number): Howl {
  const f = 1 + HOWL_PER_LEVEL * (level - 1);
  const out: Howl = {};
  for (const [k, v] of Object.entries(def.howl) as [keyof Howl, number][]) {
    out[k] = k === 'zeal' ? Math.round(v * f) : Math.round(v * f * 1000) / 1000;
  }
  return out;
}

/** The hound going into battle and its howl, if one is set. */
export function activeHowl(save: SaveData): { name: string; howlName: string; howl: Howl } | undefined {
  const s = houndsOf(save);
  if (!s.active) return undefined;
  const def = houndDef(s.active);
  const lv = s.owned[s.active]?.level;
  if (!def || !lv) return undefined;
  return { name: def.name, howlName: def.howlName, howl: howlAt(def, lv) };
}

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
/** Each part of a howl in words, e.g. ["+8% damage", "+3 Zeal"]. */
export function howlParts(h: Howl): string[] {
  const out: string[] = [];
  if (h.atk) out.push(`Sisters deal +${pct(h.atk)} damage`);
  if (h.ward) out.push(`Sisters take ${pct(h.ward)} less damage`);
  if (h.mend) out.push(`heals the most wounded Sister ${pct(h.mend)} max HP`);
  if (h.shield) out.push(`shields the front Sister for ${pct(h.shield)} max HP`);
  if (h.zeal) out.push(`+${h.zeal} Zeal`);
  if (h.scent) out.push(`foes lose ${pct(h.scent)} Armor and Magic Resist`);
  return out;
}

/** Short form for the battle log, e.g. "+8% DMG, +3 Zeal". */
export function howlShort(h: Howl): string {
  const out: string[] = [];
  if (h.atk) out.push(`+${pct(h.atk)} DMG`);
  if (h.ward) out.push(`-${pct(h.ward)} DMG taken`);
  if (h.mend) out.push(`heal ${pct(h.mend)}`);
  if (h.shield) out.push(`shield ${pct(h.shield)}`);
  if (h.zeal) out.push(`+${h.zeal} Zeal`);
  if (h.scent) out.push(`Sunder/Hex ${pct(h.scent)}`);
  return out.join(', ');
}
