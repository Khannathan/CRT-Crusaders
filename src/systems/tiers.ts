import type { Rarity } from '../data/types';
import type { OwnedCrusader, SaveData } from '../state/save';
import { track } from './tasks';

/**
 * Star tiers, separate from rarity. Each tier is five Vows; each Vow takes
 * copies of her (pulled again at the Altar), more the higher she climbs. At
 * the fifth Vow, Stigmata raise her a tier: the Vows start again, she keeps
 * what they gave, and her stars change colour. Any rarity can reach tier 5.
 */
export const MAX_VOW = 5;
export const MAX_TIER = 5;

/** Copies for Vows 1..5 on tier 0; each tier asks one more per Vow. */
export const VOW_COPIES = [1, 1, 2, 2, 3];
export const copiesFor = (tier: number, vow: number) => VOW_COPIES[vow] + tier;

/** Stigmata (and Tithes) to rise from `tier` to the next. */
export const TIER_STIGMATA = [2, 4, 6, 9, 12];
export const tierTithes = (tier: number) => 1500 * (tier + 1);

/** Each Vow ever taken: +5% stats. Each tier on top: +10%. */
export const VOW_BONUS = 0.05;
export const TIER_BONUS = 0.1;

/** Star colours by tier: tier 0 (amber), bronze, silver, gold, crimson, white. */
export const TIER_COLOR = [0xd79e6f, 0xb0703c, 0xc9ccd6, 0xf2d27a, 0xd04a5a, 0xfff6ea];
export const TIER_NAME = ['', 'Bronze', 'Silver', 'Gold', 'Crimson', 'White'];

export const tierOf = (o: Pick<OwnedCrusader, 'tier'>) => o.tier ?? 0;

/** Vows taken over all tiers (what the stat bonus counts). */
export const vowsEver = (o: Pick<OwnedCrusader, 'vow' | 'tier'>) => tierOf(o) * MAX_VOW + o.vow;

/** The Vow count that unlocks skill upgrades: tier 0's Vows; every tier above keeps all of them. */
export const skillVow = (o: Pick<OwnedCrusader, 'vow' | 'tier'>) => (tierOf(o) > 0 ? MAX_VOW : o.vow);

/** Stat multiplier from Vows and tiers. */
export const oathMult = (o: Pick<OwnedCrusader, 'vow' | 'tier'>) => (1 + VOW_BONUS * vowsEver(o)) * (1 + TIER_BONUS * tierOf(o));

/** True once every tier and Vow is taken. */
export const oathComplete = (o: Pick<OwnedCrusader, 'vow' | 'tier'>) => tierOf(o) >= MAX_TIER && o.vow >= MAX_VOW;

/** Copies still needed to finish every Vow of every tier (tokens held count against it). */
export function copiesLeft(o: Pick<OwnedCrusader, 'vow' | 'tier'>) {
  let n = 0;
  for (let t = tierOf(o); t <= MAX_TIER; t++) for (let v = t === tierOf(o) ? o.vow : 0; v < MAX_VOW; v++) n += copiesFor(t, v);
  return n;
}

/** Stigmata a duplicate gives once she needs no more copies. */
export const STIGMATA_FOR_COPY: Record<Rarity, number> = { R: 1, SR: 1, SSR: 2, UR: 3 };

export const stigmataOf = (save: SaveData) => save.stigmata ?? 0;
export function addStigmata(save: SaveData, n: number) {
  if (n) save.stigmata = stigmataOf(save) + n;
}

/** Tithes for each Vow, by Vows ever taken. */
export const vowCost = (o: Pick<OwnedCrusader, 'vow' | 'tier'>) => 150 * (vowsEver(o) + 1);

export type OathBlock = 'tokens' | 'tithes' | 'stigmata' | 'done' | 'tier';

/** Why the next Vow can't be taken yet, or null. */
export function vowBlock(save: SaveData, o: OwnedCrusader): OathBlock | null {
  if (o.vow >= MAX_VOW) return oathComplete(o) ? 'done' : 'tier';
  if ((o.tokens ?? 0) < copiesFor(tierOf(o), o.vow)) return 'tokens';
  if (save.tithes < vowCost(o)) return 'tithes';
  return null;
}

/** Takes the next Vow: spends copies and Tithes. */
export function takeVow(save: SaveData, id: string): boolean {
  const o = save.owned[id];
  if (!o || vowBlock(save, o)) return false;
  save.tithes -= vowCost(o);
  o.tokens = (o.tokens ?? 0) - copiesFor(tierOf(o), o.vow);
  o.vow += 1;
  track(save, 'takeVow');
  return true;
}

/** Why she can't rise a tier yet, or null. */
export function tierBlock(save: SaveData, o: OwnedCrusader): OathBlock | null {
  const t = tierOf(o);
  if (t >= MAX_TIER) return 'done';
  if (o.vow < MAX_VOW) return 'tier';
  if (stigmataOf(save) < TIER_STIGMATA[t]) return 'stigmata';
  if (save.tithes < tierTithes(t)) return 'tithes';
  return null;
}

/** Raises her a tier: Vows start again, their stats stay, the stars change colour. */
export function tierUp(save: SaveData, id: string): boolean {
  const o = save.owned[id];
  if (!o || tierBlock(save, o)) return false;
  const t = tierOf(o);
  save.stigmata = stigmataOf(save) - TIER_STIGMATA[t];
  save.tithes -= tierTithes(t);
  o.tier = t + 1;
  o.vow = 0;
  return true;
}
