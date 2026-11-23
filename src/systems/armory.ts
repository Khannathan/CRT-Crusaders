import type { Rarity } from '../data/types';
import type { SaveData } from '../state/save';
import { giltOf } from './currency';
import type { Rng } from './gacha';
import { GEAR_SETS, GEAR_SLOTS, MAX_GEAR, claimGear, gearOf, makeGear, type GearItem, type GearSet, type GearSetId, type GearSlot } from './gear';
import { countOf, give, spend } from './items';
import { weekKey } from './tasks';

/**
 * The Saints' Armory: where UR gear comes from (round 9). UR pieces never drop.
 *
 * - The banner: a pull costs one Armory Writ (or PULL_GILT Gilt). UR_RATE of
 *   pulls give a UR piece, FEATURED_SHARE of those in the week's featured
 *   set; the featured set changes every Monday. A UR is certain by PITY pulls,
 *   and the count carries over between weeks.
 * - The forge: FORGE_FRAGMENTS Saint's Fragments, or one Reliquary Mould,
 *   pour a UR piece of the slot and set you choose.
 * - Every pull also leaves a Saint's Fragment, so bad luck still builds
 *   toward a forged piece.
 *
 * Fragments are farmed: Crusade bosses, Bell Tower boss floors, Relic Trials,
 * the Inquisition, melting SSR and UR gear. Writs come from the Feast, the
 * Shop and bond rewards.
 */
export const UR_RATE = 0.025;
export const SSR_RATE = 0.2;
export const FEATURED_SHARE = 0.7;
export const PITY = 50;
export const PULL_GILT = 60;
export const TEN_GILT = 540;
export const FORGE_FRAGMENTS = 60;
/** Writs given the first time the Armory opens. */
export const FIRST_WRITS = 10;

export interface ArmoryState {
  /** Pulls since the last UR. */
  pity: number;
  pulls: number;
  gifted?: boolean;
}

export const armoryOf = (save: SaveData): ArmoryState => (save.armory ??= { pity: 0, pulls: 0 });

const EPOCH = new Date(2026, 0, 5);

/** The set featured this week, and when the week ends. */
export function featuredSet(now = Date.now()): { set: GearSet; ends: number } {
  const [y, m, d] = weekKey(now).split('-').map(Number);
  const monday = new Date(y, m - 1, d);
  const weeks = Math.round((monday.getTime() - EPOCH.getTime()) / (7 * 864e5));
  const set = GEAR_SETS[((weeks % GEAR_SETS.length) + GEAR_SETS.length) % GEAR_SETS.length];
  const ends = new Date(monday);
  ends.setDate(ends.getDate() + 7);
  return { set, ends: ends.getTime() };
}

/** Gives the one-time Writs. Returns true the first time. */
export function giftWrits(save: SaveData): boolean {
  const a = armoryOf(save);
  if (a.gifted) return false;
  a.gifted = true;
  give(save, { armory2: FIRST_WRITS });
  return true;
}

export type PullPay = 'writ' | 'gilt';

/** Why `n` pulls can't be paid for that way, or undefined. */
export function pullBlock(save: SaveData, n: 1 | 10, pay: PullPay): string | undefined {
  if (gearOf(save).length + n > MAX_GEAR) return 'The armory is full: melt some gear first';
  if (pay === 'writ' && countOf(save, 'armory2') < n) return 'Not enough Armory Writs';
  if (pay === 'gilt' && giltOf(save) < (n === 10 ? TEN_GILT : PULL_GILT)) return 'Not enough Gilt';
  return undefined;
}

/** Rolls one banner pull's rarity and set, moving the pity count. */
export function rollPull(save: SaveData, rng: Rng, now = Date.now()): { rarity: Rarity; set?: GearSetId } {
  const a = armoryOf(save);
  a.pulls += 1;
  a.pity += 1;
  const r = rng();
  if (a.pity >= PITY || r < UR_RATE) {
    a.pity = 0;
    const featured = rng() < FEATURED_SHARE;
    const set = featured ? featuredSet(now).set.id : GEAR_SETS[Math.floor(rng() * GEAR_SETS.length) % GEAR_SETS.length].id;
    return { rarity: 'UR', set };
  }
  if (r < UR_RATE + SSR_RATE) return { rarity: 'SSR' };
  return { rarity: 'SR' };
}

/** Pulls `n` times on the banner. Returns the pieces, or [] when it can't. */
export function pullArmory(save: SaveData, n: 1 | 10, pay: PullPay, rng: Rng = Math.random, now = Date.now()): GearItem[] {
  if (pullBlock(save, n, pay)) return [];
  if (pay === 'writ') spend(save, { armory2: n });
  else save.gilt = giltOf(save) - (n === 10 ? TEN_GILT : PULL_GILT);
  const loot: GearItem[] = [];
  for (let i = 0; i < n; i++) {
    const { rarity, set } = rollPull(save, rng, now);
    loot.push(makeGear(rng, rarity, undefined, set));
  }
  const before = gearOf(save).length;
  claimGear(save, loot);
  give(save, { armory1: n });
  return gearOf(save).slice(before);
}

export function forgeBlock(save: SaveData, pay: 'fragments' | 'mould'): string | undefined {
  if (gearOf(save).length >= MAX_GEAR) return 'The armory is full: melt some gear first';
  if (pay === 'fragments' && countOf(save, 'armory1') < FORGE_FRAGMENTS) return `Needs ${FORGE_FRAGMENTS} Saint's Fragments`;
  if (pay === 'mould' && countOf(save, 'armory3') < 1) return 'Needs a Reliquary Mould';
  return undefined;
}

/** Forges a UR piece of the chosen slot and set. */
export function forgeUR(save: SaveData, slot: GearSlot, set: GearSetId, pay: 'fragments' | 'mould', rng: Rng = Math.random): GearItem | undefined {
  if (forgeBlock(save, pay) || !GEAR_SLOTS.includes(slot)) return undefined;
  spend(save, pay === 'fragments' ? { armory1: FORGE_FRAGMENTS } : { armory3: 1 });
  claimGear(save, [makeGear(rng, 'UR', slot, set)]);
  return gearOf(save).at(-1);
}
