import type { SaveData } from '../state/save';
import type { Rng } from './gacha';
import { claimGear, makeGear, rollGearRarity, type GearItem } from './gear';
import { bagText, give, type Bag } from './items';
import { dayKey, weekKey } from './tasks';
import { trialsOf } from './trials';
import type { Rarity } from '../data/types';
import { almsOf, giltOf } from './currency';
import { addStigmata } from './tiers';
import { OFFERING_GILT, giveOfferings, offeringDef, offeringOfDay } from './offerings';

/**
 * The Shop has three counters: Gilt (fixed, daily limits), the Almonry (six
 * offers that change each day, free refresh once a day, more for Gilt) and the
 * Tithe Exchange (fixed, weekly limits).
 */
export type Currency = 'gilt' | 'alms' | 'tithes';
export type Counter = 'gilt' | 'almonry' | 'tithes';

export const CURRENCY_NAME: Record<Currency, string> = { gilt: 'Gilt', alms: 'Alms', tithes: 'Tithes' };

export interface Goods {
  seals?: number;
  items?: Bag;
  gear?: Rarity;
  /** A Vow token for a Sister the player picks. */
  vowToken?: boolean;
  stigmata?: number;
  /** One more Relic Trial victory today. */
  trialEntry?: boolean;
  /** An offering for Confession, by id. */
  offering?: string;
}

export interface Offer {
  id: string;
  name: string;
  price: number;
  currency: Currency;
  goods: Goods;
  /** Purchases allowed per period (daily for Gilt and Almonry, weekly for Tithes). */
  limit: number;
}

/** Gilt to refresh the Almonry beyond the free daily refresh. */
export const REFRESH_GILT = 30;
export const ALMONRY_SLOTS = 6;

export const GILT_OFFERS: Offer[] = [
  { id: 'g-seal', name: '1 Wax Seal', price: 150, currency: 'gilt', goods: { seals: 1 }, limit: 5 },
  { id: 'g-seal10', name: '10 Wax Seals', price: 1350, currency: 'gilt', goods: { seals: 10 }, limit: 1 },
  { id: 'g-trial', name: 'Extra Trial victory', price: 50, currency: 'gilt', goods: { trialEntry: true }, limit: 1 },
  { id: 'g-ash', name: "Martyr's Ash crate", price: 120, currency: 'gilt', goods: { items: { ash2: 5 } }, limit: 2 },
  { id: 'g-page', name: 'Psalter crate', price: 120, currency: 'gilt', goods: { items: { page2: 5 } }, limit: 2 },
  { id: 'g-iron', name: 'Blessed Iron crate', price: 120, currency: 'gilt', goods: { items: { iron2: 5 } }, limit: 2 },
  { id: 'g-unction', name: 'Unction crate', price: 100, currency: 'gilt', goods: { items: { unction2: 5 } }, limit: 2 },
  { id: 'g-ssr', name: 'SSR+ gear', price: 300, currency: 'gilt', goods: { gear: 'SSR' }, limit: 1 },
];

export const TITHE_OFFERS: Offer[] = [
  { id: 't-ash', name: '5 Grave Ash', price: 400, currency: 'tithes', goods: { items: { ash1: 5 } }, limit: 10 },
  { id: 't-page', name: '5 Torn Pages', price: 400, currency: 'tithes', goods: { items: { page1: 5 } }, limit: 10 },
  { id: 't-iron', name: '5 Coffin Nails', price: 400, currency: 'tithes', goods: { items: { iron1: 5 } }, limit: 10 },
  { id: 't-incense', name: '5 Myrrh', price: 400, currency: 'tithes', goods: { items: { incense1: 5 } }, limit: 10 },
  { id: 't-writ', name: '2 Writs of Passage', price: 600, currency: 'tithes', goods: { items: { writ1: 2 } }, limit: 5 },
  { id: 't-unction', name: '5 Lesser Unction', price: 300, currency: 'tithes', goods: { items: { unction1: 5 } }, limit: 10 },
  { id: 't-seal', name: '1 Wax Seal', price: 2500, currency: 'tithes', goods: { seals: 1 }, limit: 2 },
  { id: 't-gear', name: 'SR+ gear', price: 700, currency: 'tithes', goods: { gear: 'SR' }, limit: 3 },
  { id: 't-stigmata', name: '1 Stigmata', price: 3000, currency: 'tithes', goods: { stigmata: 1 }, limit: 2 },
];

/** What the Almonry can stock; six are drawn each day. */
export const ALMONRY_POOL: Offer[] = [
  { id: 'a-ash2', name: "3 Martyr's Ash", price: 45, currency: 'alms', goods: { items: { ash2: 3 } }, limit: 1 },
  { id: 'a-page2', name: '3 Psalter Leaves', price: 45, currency: 'alms', goods: { items: { page2: 3 } }, limit: 1 },
  { id: 'a-iron2', name: '3 Blessed Iron', price: 45, currency: 'alms', goods: { items: { iron2: 3 } }, limit: 1 },
  { id: 'a-incense2', name: '3 Frankincense', price: 45, currency: 'alms', goods: { items: { incense2: 3 } }, limit: 1 },
  { id: 'a-writ2', name: '2 Writs of Office', price: 60, currency: 'alms', goods: { items: { writ2: 2 } }, limit: 1 },
  { id: 'a-ash3', name: "1 Saint's Ash", price: 120, currency: 'alms', goods: { items: { ash3: 1 } }, limit: 1 },
  { id: 'a-page3', name: '1 Illuminated Folio', price: 120, currency: 'alms', goods: { items: { page3: 1 } }, limit: 1 },
  { id: 'a-iron3', name: '1 Reliquary Steel', price: 120, currency: 'alms', goods: { items: { iron3: 1 } }, limit: 1 },
  { id: 'a-unction3', name: '1 Extreme Unction', price: 90, currency: 'alms', goods: { items: { unction3: 1 } }, limit: 1 },
  { id: 'a-ssr', name: 'SSR+ gear', price: 150, currency: 'alms', goods: { gear: 'SSR' }, limit: 1 },
  { id: 'a-vow', name: 'Vow token of your choice', price: 400, currency: 'alms', goods: { vowToken: true }, limit: 1 },
  { id: 'a-seal', name: '2 Wax Seals', price: 160, currency: 'alms', goods: { seals: 2 }, limit: 1 },
  { id: 'a-stigmata', name: '2 Stigmata', price: 220, currency: 'alms', goods: { stigmata: 2 }, limit: 1 },
];

export interface ShopState {
  day: string;
  week: string;
  /** Purchases this period by offer id (daily for Gilt and Almonry, weekly for Tithes). */
  daily: Record<string, number>;
  weekly: Record<string, number>;
  /** Today's Almonry offer ids. */
  stock: string[];
  /** Refreshes of the Almonry today (the first is free). */
  refreshes: number;
}

const draw = (rng: Rng) => {
  const pool = [...ALMONRY_POOL];
  const out: string[] = [];
  while (out.length < ALMONRY_SLOTS && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length) % pool.length, 1)[0].id);
  return out;
};

/** A seeded draw so the day's stock is the same each time the shop opens. */
const dayRng = (key: string, salt: number): Rng => {
  let h = 2166136261 ^ salt;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
};

export function shopOf(save: SaveData, now = Date.now()): ShopState {
  const day = dayKey(now);
  const week = weekKey(now);
  const s = (save.shop ??= { day, week, daily: {}, weekly: {}, stock: draw(dayRng(day, 0)), refreshes: 0 });
  if (s.day !== day) Object.assign(s, { day, daily: {}, stock: draw(dayRng(day, 0)), refreshes: 0 });
  if (s.week !== week) Object.assign(s, { week, weekly: {} });
  return s;
}

export const purse = (save: SaveData, c: Currency) => (c === 'gilt' ? giltOf(save) : c === 'alms' ? almsOf(save) : save.tithes);

/** The Offering of the Day: one a day, a new one each dawn, priced by potency. */
export function dailyOffering(now = Date.now()): Offer {
  const d = offeringOfDay(now);
  return { id: 'g-offering', name: `Offering of the Day: ${d.name}`, price: OFFERING_GILT[d.potency], currency: 'gilt', goods: { offering: d.id }, limit: 1 };
}

export function offersAt(save: SaveData, counter: Counter, now = Date.now()): Offer[] {
  if (counter === 'gilt') return [dailyOffering(now), ...GILT_OFFERS];
  if (counter === 'tithes') return TITHE_OFFERS;
  return shopOf(save, now).stock.map((id) => ALMONRY_POOL.find((o) => o.id === id)!).filter(Boolean);
}

const bucket = (s: ShopState, o: Offer) => (o.currency === 'tithes' ? s.weekly : s.daily);
export const boughtOf = (save: SaveData, o: Offer, now = Date.now()) => bucket(shopOf(save, now), o)[o.id] ?? 0;
export const leftOf = (save: SaveData, o: Offer, now = Date.now()) => Math.max(0, o.limit - boughtOf(save, o, now));

/** Why it cannot be bought now, or undefined. */
export function buyBlock(save: SaveData, o: Offer, now = Date.now()): string | undefined {
  if (leftOf(save, o, now) <= 0) return o.currency === 'tithes' ? 'Sold out this week' : 'Sold out today';
  if (purse(save, o.currency) < o.price) return `Not enough ${CURRENCY_NAME[o.currency]}`;
  if (o.goods.trialEntry && trialsOf(save, now).used <= 0) return 'No Trial victory spent today';
  if (o.goods.gear && (save.gear?.length ?? 0) >= 60) return 'The armory is full';
  return undefined;
}

export interface Purchase {
  gear?: GearItem;
}

/**
 * Buys an offer. A Vow token needs `sister` (any owned Sister who can still
 * take one). Returns undefined when it cannot be bought.
 */
export function buy(save: SaveData, o: Offer, opts: { sister?: string; rng?: Rng; now?: number } = {}): Purchase | undefined {
  const now = opts.now ?? Date.now();
  if (buyBlock(save, o, now)) return undefined;
  if (o.goods.vowToken && (!opts.sister || !save.owned[opts.sister])) return undefined;
  if (o.currency === 'gilt') save.gilt = giltOf(save) - o.price;
  else if (o.currency === 'alms') save.alms = almsOf(save) - o.price;
  else save.tithes -= o.price;
  const b = bucket(shopOf(save, now), o);
  b[o.id] = (b[o.id] ?? 0) + 1;
  const out: Purchase = {};
  const g = o.goods;
  if (g.seals) save.seals += g.seals;
  addStigmata(save, g.stigmata ?? 0);
  if (g.items) give(save, g.items);
  if (g.offering) giveOfferings(save, [g.offering]);
  if (g.trialEntry) trialsOf(save, now).used -= 1;
  if (g.vowToken) {
    const own = save.owned[opts.sister!];
    own.tokens = (own.tokens ?? 0) + 1;
  }
  if (g.gear) {
    const rng = opts.rng ?? Math.random;
    const r = rollGearRarity(rng, g.gear === 'SSR' ? 0.2 : 0.08);
    const rarity: Rarity = g.gear === 'SSR' ? (r === 'UR' ? 'UR' : 'SSR') : r === 'R' ? 'SR' : r;
    const before = save.gear?.length ?? 0;
    claimGear(save, [makeGear(rng, rarity)]);
    if ((save.gear?.length ?? 0) > before) out.gear = save.gear![save.gear!.length - 1];
  }
  return out;
}

export const refreshCost = (save: SaveData, now = Date.now()) => (shopOf(save, now).refreshes === 0 ? 0 : REFRESH_GILT);

/** New Almonry stock: free once a day, then REFRESH_GILT each. */
export function refreshAlmonry(save: SaveData, now = Date.now(), rng: Rng = Math.random): boolean {
  const s = shopOf(save, now);
  const cost = refreshCost(save, now);
  if (giltOf(save) < cost) return false;
  save.gilt = giltOf(save) - cost;
  s.refreshes += 1;
  s.stock = draw(rng);
  for (const id of s.stock) delete s.daily[id];
  return true;
}

export const goodsText = (g: Goods) =>
  [g.seals ? `${g.seals} Wax Seal${g.seals > 1 ? 's' : ''}` : '', bagText(g.items), g.gear ? `${g.gear}+ gear` : '', g.vowToken ? 'a Vow token' : '', g.trialEntry ? 'one more Trial victory today' : '', g.offering ? offeringDef(g.offering).name : '']
    .filter(Boolean)
    .join(', ');

