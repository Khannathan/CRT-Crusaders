import type { Rarity } from '../data/types';
import type { SaveData } from '../state/save';
import { giltOf } from './currency';
import type { Rng } from './gacha';
import { GODFORGED, SAINTS_ARMS, uniqueDef, type UniqueDef, type UniqueId } from '../data/loot';
import { GODSPARKS_TO_FORGE, MAX_GEAR, claimGear, gearOf, makeGear, playerIp, type GearItem } from './gear';
import { countOf, give, spend } from './items';
import { weekKey } from './tasks';

/**
 * The Saints' Armory: where Saint's Arms (named uniques) come from. They never
 * drop from ordinary foes.
 *
 * - The banner: a pull costs one Armory Writ (or PULL_GILT Gilt). UR_RATE of
 *   pulls give a Saint's Arms, FEATURED_SHARE of those the week's featured
 *   piece; the featured piece changes every Monday. One is certain by PITY
 *   pulls, and the count carries over between weeks. SSR pulls give Sworn or
 *   Anathema pieces, SR pulls Consecrated or Sworn.
 * - The forge: FORGE_FRAGMENTS Saint's Fragments, or one Reliquary Mould,
 *   pour the Saint's Arms you choose; two Godsparks pour a Godforged relic.
 *   Godforged are never on the banner and never sold.
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

/** The Saint's Arms featured this week, and when the week ends. */
export function featuredArms(now = Date.now()): { arms: UniqueDef; ends: number } {
  const [y, m, d] = weekKey(now).split('-').map(Number);
  const monday = new Date(y, m - 1, d);
  const weeks = Math.round((monday.getTime() - EPOCH.getTime()) / (7 * 864e5));
  const arms = SAINTS_ARMS[((weeks % SAINTS_ARMS.length) + SAINTS_ARMS.length) % SAINTS_ARMS.length];
  const ends = new Date(monday);
  ends.setDate(ends.getDate() + 7);
  return { arms, ends: ends.getTime() };
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
export function rollPull(save: SaveData, rng: Rng, now = Date.now()): { rarity: Rarity; unique?: UniqueId } {
  const a = armoryOf(save);
  a.pulls += 1;
  a.pity += 1;
  const r = rng();
  if (a.pity >= PITY || r < UR_RATE) {
    a.pity = 0;
    const featured = rng() < FEATURED_SHARE;
    const unique = featured ? featuredArms(now).arms.id : SAINTS_ARMS[Math.floor(rng() * SAINTS_ARMS.length) % SAINTS_ARMS.length].id;
    return { rarity: 'UR', unique };
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
    const { rarity, unique } = rollPull(save, rng, now);
    loot.push(makeGear(rng, rarity, undefined, { unique, ip: Math.max(400, playerIp(save)) }));
  }
  const before = gearOf(save).length;
  claimGear(save, loot);
  give(save, { armory1: n });
  return gearOf(save).slice(before);
}

export type ForgePay = 'fragments' | 'mould' | 'sparks';

export function forgeBlock(save: SaveData, pay: ForgePay): string | undefined {
  if (gearOf(save).length >= MAX_GEAR) return 'The armory is full: melt some gear first';
  if (pay === 'fragments' && countOf(save, 'armory1') < FORGE_FRAGMENTS) return `Needs ${FORGE_FRAGMENTS} Saint's Fragments`;
  if (pay === 'mould' && countOf(save, 'armory3') < 1) return 'Needs a Reliquary Mould';
  if (pay === 'sparks' && countOf(save, 'spark1') < GODSPARKS_TO_FORGE) return `Needs ${GODSPARKS_TO_FORGE} Godsparks`;
  return undefined;
}

/** Forges the chosen Saint's Arms (Fragments or a Mould) or Godforged relic (Godsparks). */
export function forgeUnique(save: SaveData, id: UniqueId, pay: ForgePay, rng: Rng = Math.random): GearItem | undefined {
  const u = uniqueDef(id);
  if (!u || forgeBlock(save, pay)) return undefined;
  if ((u.grade === 'godforged') !== (pay === 'sparks')) return undefined;
  spend(save, pay === 'fragments' ? { armory1: FORGE_FRAGMENTS } : pay === 'mould' ? { armory3: 1 } : { spark1: GODSPARKS_TO_FORGE });
  claimGear(save, [makeGear(rng, 'UR', u.slot, { unique: id })]);
  return gearOf(save).at(-1);
}

export { GODFORGED, SAINTS_ARMS };
