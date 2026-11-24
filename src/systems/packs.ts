import type { SaveData } from '../state/save';
import { giltOf } from './currency';
import { grantGoods, goodsText, type Goods } from './shop';
import { rankInfo } from './rank';
import { dayKey } from './tasks';

/**
 * Packs, bought with Gilt (earned in play for now; easy to price in real money
 * later): one-time Rank packs that open as the player climbs, and the Abbess's
 * Blessing, 30 days of a daily Seal and Gilt for one price up front.
 */

export interface RankPack {
  id: string;
  name: string;
  rank: number;
  price: number;
  goods: Goods;
}

export const RANK_PACKS: RankPack[] = [
  { id: 'p-novice', name: "Novice's Bundle", rank: 3, price: 120, goods: { seals: 3, items: { unction1: 10 }, gear: 'SR' } },
  { id: 'p-pilgrim', name: "Pilgrim's Pack", rank: 5, price: 300, goods: { seals: 5, items: { unction2: 10, ash2: 5 }, gear: 'SSR' } },
  { id: 'p-crusader', name: "Crusader's Pack", rank: 10, price: 600, goods: { seals: 8, stigmata: 4, items: { armory2: 3, page2: 6 } } },
  { id: 'p-inquisitor', name: "Inquisitor's Pack", rank: 15, price: 900, goods: { seals: 10, stigmata: 6, items: { canon2: 5, iron3: 2 } } },
  { id: 'p-abbess', name: "Abbess's Pack", rank: 20, price: 1200, goods: { seals: 12, stigmata: 8, items: { armory3: 1, unction3: 4 } } },
  { id: 'p-saint', name: "Saint's Pack", rank: 25, price: 1500, goods: { seals: 15, stigmata: 10, items: { canon3: 3, ash3: 3 } } },
  { id: 'p-martyr', name: "Martyr's Pack", rank: 30, price: 2000, goods: { seals: 20, stigmata: 12, items: { armory3: 2, page3: 3 } } },
];

/** The Abbess's Blessing: pay once, claim each day for BLESSING_DAYS. */
export const BLESSING = { price: 1200, days: 30, now: { items: { unction2: 10, armory2: 2 } } as Goods, daily: { seals: 1 } as Goods, dailyGilt: 30 };

export interface PacksState {
  bought: string[];
  /** The Blessing runs until this time (ms). */
  blessedUntil?: number;
  /** Day key of the last Blessing claim. */
  blessedDay?: string;
}

export const packsOf = (save: SaveData): PacksState => (save.packs ??= { bought: [] });

export const packOpen = (save: SaveData, p: RankPack) => rankInfo(save).rank >= p.rank;
export const packBought = (save: SaveData, p: RankPack) => packsOf(save).bought.includes(p.id);

export function packBlock(save: SaveData, p: RankPack): string | undefined {
  if (packBought(save, p)) return 'Bought';
  if (!packOpen(save, p)) return `Opens at Rank ${p.rank}`;
  if (giltOf(save) < p.price) return 'Not enough Gilt';
  return undefined;
}

export function buyPack(save: SaveData, id: string, now = Date.now()) {
  const p = RANK_PACKS.find((x) => x.id === id);
  if (!p || packBlock(save, p)) return undefined;
  save.gilt = giltOf(save) - p.price;
  packsOf(save).bought.push(p.id);
  return grantGoods(save, p.goods, { now });
}

/** Rank packs open and not yet bought (for the Market's dot). */
export const packsWaiting = (save: SaveData) => RANK_PACKS.filter((p) => packOpen(save, p) && !packBought(save, p) && giltOf(save) >= p.price).length;

export const blessed = (save: SaveData, now = Date.now()) => (packsOf(save).blessedUntil ?? 0) > now;

/** Days of Blessing left, counting today. */
export const blessingDays = (save: SaveData, now = Date.now()) => Math.max(0, Math.ceil(((packsOf(save).blessedUntil ?? 0) - now) / 864e5));

export function blessingBlock(save: SaveData, now = Date.now()): string | undefined {
  // A new Blessing may be bought in its last 3 days; the days add on.
  if (blessingDays(save, now) > 3) return 'Already anointed';
  if (giltOf(save) < BLESSING.price) return 'Not enough Gilt';
  return undefined;
}

export function buyBlessing(save: SaveData, now = Date.now()): boolean {
  if (blessingBlock(save, now)) return false;
  const p = packsOf(save);
  save.gilt = giltOf(save) - BLESSING.price;
  p.blessedUntil = Math.max(p.blessedUntil ?? 0, now) + BLESSING.days * 864e5;
  grantGoods(save, BLESSING.now, { now });
  claimBlessing(save, now);
  return true;
}

export const blessingReady = (save: SaveData, now = Date.now()) => blessed(save, now) && packsOf(save).blessedDay !== dayKey(now);

/** Today's Blessing: a Seal and some Gilt. Returns a line, or undefined if not ready. */
export function claimBlessing(save: SaveData, now = Date.now()): string | undefined {
  if (!blessingReady(save, now)) return undefined;
  packsOf(save).blessedDay = dayKey(now);
  grantGoods(save, BLESSING.daily, { now });
  save.gilt = giltOf(save) + BLESSING.dailyGilt;
  return `${goodsText(BLESSING.daily)} + ${BLESSING.dailyGilt} Gilt`;
}

/** Something to buy or claim in Packs. */
export const packsReady = (save: SaveData, now = Date.now()) => blessingReady(save, now) || packsWaiting(save) > 0;
