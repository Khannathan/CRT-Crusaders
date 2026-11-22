import { HOUNDS, houndDef, type HoundDef, type Howl } from '../data/hounds';
import type { Rarity } from '../data/types';
import type { SaveData } from '../state/save';
import { ALMS_FOR_TOKEN, earn, giltOf } from './currency';
import type { Rng } from './gacha';
import { dayKey } from './tasks';

/**
 * The Kennel. Hounds come from the Whistle (one free each day, then Gilt).
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
}

export const HOUND_MAX = 5;
export const HOWL_PER_LEVEL = 0.1;
export const WHISTLE_GILT = 80;
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

export function whistleBlock(save: SaveData, now = Date.now()): string | undefined {
  if (freeWhistle(save, now)) return undefined;
  return giltOf(save) < WHISTLE_GILT ? `Needs ${WHISTLE_GILT} Gilt.` : undefined;
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

/** Blows the whistle: free once a day, then Gilt. */
export function whistle(save: SaveData, rng: Rng = Math.random, now = Date.now()): WhistleResult | undefined {
  if (whistleBlock(save, now)) return undefined;
  const s = houndsOf(save);
  if (freeWhistle(save, now)) s.freeDay = dayKey(now);
  else save.gilt = giltOf(save) - WHISTLE_GILT;
  const rarity = rollHoundRarity(rng, s.pity ?? 0);
  s.pity = rarity === 'SSR' || rarity === 'UR' ? 0 : (s.pity ?? 0) + 1;
  const pool = HOUNDS.filter((h) => h.rarity === rarity);
  const hound = pool[Math.floor(rng() * pool.length)];
  const had = s.owned[hound.id];
  if (!had) {
    s.owned[hound.id] = { level: 1 };
    return { hound, level: 1, isNew: true };
  }
  if (had.level < HOUND_MAX) {
    had.level += 1;
    return { hound, level: had.level, isNew: false };
  }
  const alms = ALMS_FOR_TOKEN[rarity];
  earn(save, 0, alms);
  return { hound, level: had.level, isNew: false, alms };
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
