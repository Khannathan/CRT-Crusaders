import type { Rarity } from '../data/types';
import type { SaveData } from '../state/save';

/**
 * Gilt and Alms, the two currencies beside Seals and Tithes.
 * - Gilt is the premium currency. For now it is only earned (first clears,
 *   Heresy tiers, Rank gifts, Matins, Tower bosses, Inquisition and Litany
 *   marks); a real-money purchase would add to the same number later.
 * - Alms come from melting gear, Vow tokens past a Sister's last Vow, and
 *   Penance marks. Both are spent in the Shop (systems/shop.ts).
 */
export const GILT_START = 300;

export const giltOf = (save: SaveData) => (save.gilt ??= GILT_START);
export const almsOf = (save: SaveData) => save.alms ?? 0;

export function earn(save: SaveData, gilt = 0, alms = 0) {
  if (gilt) save.gilt = giltOf(save) + gilt;
  if (alms) save.alms = almsOf(save) + alms;
}

/** Alms for melting a piece of gear. */
export const ALMS_FOR_GEAR: Record<Rarity, number> = { R: 1, SR: 3, SSR: 8, UR: 20 };
/** Alms for a Vow token past a Sister's last Vow. */
export const ALMS_FOR_TOKEN: Record<Rarity, number> = { R: 10, SR: 25, SSR: 50, UR: 100 };
/** Gilt for clearing a crypt the first time, and each Heresy tier the first time. */
export const GILT_FIRST_CLEAR = 100;
export const GILT_HERESY = 40;
/** Gilt per Rank of Faith gift. */
export const GILT_PER_RANK = 50;
