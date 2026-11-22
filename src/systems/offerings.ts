import { ORDER_LIST } from '../data/orders';
import { CRUSADERS } from '../data/crusaders';
import type { SaveData } from '../state/save';
import { BOND_XP, addBond, bondInfo } from './bonds';
import type { Battle } from './combat';
import { OSSUARY, BELFRY, skirmish } from './crusade';
import type { Rng } from './gacha';
import { recommendedPower } from './power';
import { dayKey } from './tasks';

/**
 * Offerings: gifts for Confession. Each has a potency (common, fine, holy);
 * each Order favours two, which give its Sisters double bond. They come from
 * the Reliquary Procession (three entries a day), the Shop's Offering of the
 * Day, and a free candle each dawn.
 */
export type Potency = 'common' | 'fine' | 'holy';

export interface OfferingDef {
  id: string;
  name: string;
  potency: Potency;
  desc: string;
}

export const OFFERINGS: OfferingDef[] = [
  { id: 'tallow', name: 'Tallow Candle', potency: 'common', desc: 'Cheap, smoky, honest.' },
  { id: 'bread', name: 'Blessed Bread', potency: 'common', desc: 'A heel of the altar loaf.' },
  { id: 'rosary', name: 'Bone Rosary', potency: 'common', desc: 'Knuckle beads, worn smooth by prayer.' },
  { id: 'letter', name: 'Sealed Letter', potency: 'common', desc: 'Word from home, never opened.' },
  { id: 'lily', name: 'Grave Lily', potency: 'common', desc: 'Picked from a martyr\'s plot.' },
  { id: 'psalter', name: 'Pocket Psalter', potency: 'fine', desc: 'Margins full of someone else\'s prayers.' },
  { id: 'veil', name: 'Lace Veil', potency: 'fine', desc: 'Too fine for the cloister. She will keep it anyway.' },
  { id: 'myrrh', name: 'Vial of Myrrh', potency: 'fine', desc: 'For the dead, or for the living who smell of them.' },
  { id: 'icon', name: 'Painted Icon', potency: 'fine', desc: 'A saint whose face has been kissed away.' },
  { id: 'thorn', name: 'Crown Thorn', potency: 'holy', desc: 'One thorn, said to be from the Crown itself.' },
  { id: 'tear', name: 'Saint\'s Tear', potency: 'holy', desc: 'A drop of crystal that is always cold.' },
  { id: 'nail', name: 'True Nail', potency: 'holy', desc: 'Iron that hums when held.' },
];

export const offeringDef = (id: string) => OFFERINGS.find((o) => o.id === id)!;

/** Bond XP per offering by potency; a favoured one gives double. */
export const POTENCY_XP: Record<Potency, number> = { common: 20, fine: 50, holy: 120 };
export const FAVOURED_MULT = 2;
export const POTENCY_COLOR: Record<Potency, number> = { common: 0xc9c2b8, fine: 0x8fb6d8, holy: 0xf2d27a };

/** Two favoured offerings per Order (by Order name). */
export const FAVOURED: Record<string, [string, string]> = Object.fromEntries(
  ORDER_LIST.map((o, i) => {
    const commons = OFFERINGS.filter((x) => x.potency === 'common');
    const higher = OFFERINGS.filter((x) => x.potency !== 'common');
    return [o.name, [commons[i % commons.length].id, higher[(i * 3) % higher.length].id]];
  }),
);

export const favours = (orderName: string, offering: string) => FAVOURED[orderName]?.includes(offering) ?? false;
export const offeringsOf = (save: SaveData) => (save.offerings ??= {});
export const heldOf = (save: SaveData, id: string) => offeringsOf(save)[id] ?? 0;

/** Offerings held, all kinds. */
export const offeringsHeld = (save: SaveData) => Object.values(offeringsOf(save)).reduce((n, v) => n + v, 0);

export function giveOfferings(save: SaveData, ids: string[]) {
  const all = offeringsOf(save);
  for (const id of ids) all[id] = (all[id] ?? 0) + 1;
}

export function offeringXp(sisterId: string, offering: string) {
  const c = CRUSADERS.find((x) => x.id === sisterId);
  const base = POTENCY_XP[offeringDef(offering).potency];
  return c && favours(c.order, offering) ? base * FAVOURED_MULT : base;
}

/** Gives her one offering: bond XP (double if her Order favours it). False if none held or her bond is full. */
export function offer(save: SaveData, sisterId: string, offering: string): boolean {
  if (!save.owned[sisterId] || heldOf(save, offering) < 1 || bondInfo(save, sisterId).max) return false;
  offeringsOf(save)[offering] -= 1;
  addBond(save, [sisterId], offeringXp(sisterId, offering));
  return true;
}

/* ---- The free candle: one a day, for any Sister ---- */

export const candleReady = (save: SaveData, now = Date.now()) => save.candleDay !== dayKey(now);

export function lightCandle(save: SaveData, sisterId: string, now = Date.now()): boolean {
  if (!save.owned[sisterId] || !candleReady(save, now) || bondInfo(save, sisterId).max) return false;
  save.candleDay = dayKey(now);
  addBond(save, [sisterId], BOND_XP.candle);
  return true;
}

/* ---- Offering of the Day (Shop) ---- */

/** Gilt by potency for the Shop's daily offering. */
export const OFFERING_GILT: Record<Potency, number> = { common: 20, fine: 45, holy: 100 };

/** The day's offering: the same all day, a new one each dawn (holy ones rarer). */
export function offeringOfDay(now = Date.now()): OfferingDef {
  let h = 0;
  for (const ch of dayKey(now)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const roll = (h % 100) / 100;
  const potency: Potency = roll < 0.55 ? 'common' : roll < 0.88 ? 'fine' : 'holy';
  const pool = OFFERINGS.filter((o) => o.potency === potency);
  return pool[Math.floor(h / 100) % pool.length];
}

/* ---- The Reliquary Procession: three short fights a day for offerings ---- */

export const PROCESSION_ENTRIES = 3;

export interface ProcessionTier {
  name: string;
  /** Enemy strength. */
  scale: number;
  encounter: string;
  /** Offerings won by potency. */
  win: Partial<Record<Potency, number>>;
  /** Chance each drop is upgraded one potency. */
  upgrade: number;
}

export const PROCESSION_TIERS: ProcessionTier[] = [
  { name: 'The Lay Procession', scale: 1, encounter: 'ossuary-2', win: { common: 2 }, upgrade: 0.2 },
  { name: 'The Clerical Procession', scale: 1.8, encounter: 'ossuary-4', win: { common: 2, fine: 1 }, upgrade: 0.15 },
  { name: 'The Saints\' Procession', scale: 2.8, encounter: 'belfry-4', win: { fine: 2, holy: 1 }, upgrade: 0.1 },
  { name: 'The Pontifical Procession', scale: 4.2, encounter: 'belfry-elite-1', win: { fine: 2, holy: 2 }, upgrade: 0.1 },
];

/** The Order the procession honours today: drops lean to its favourites. */
export function honouredToday(now = Date.now()) {
  let h = 7;
  for (const ch of dayKey(now)) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return ORDER_LIST[h % ORDER_LIST.length];
}

/** Chance a drop becomes one of the honoured Order's favourites (of its potency, if it has one). */
export const HONOURED_CHANCE = 0.4;

export interface ProcessionState {
  day: string;
  used: number;
  /** Highest tier won (0 = none), opening the next. */
  best: number;
}

export function processionOf(save: SaveData, now = Date.now()): ProcessionState {
  const day = dayKey(now);
  const p = (save.procession ??= { day, used: 0, best: 0 });
  if (p.day !== day) Object.assign(p, { day, used: 0 });
  return p;
}

export const processionLeft = (save: SaveData, now = Date.now()) => Math.max(0, PROCESSION_ENTRIES - processionOf(save, now).used);
export const tierOpen = (save: SaveData, t: number) => t <= processionOf(save).best;

export function processionBattle(save: SaveData, party: string[], tier: number, rng?: Rng): Battle {
  const t = PROCESSION_TIERS[tier];
  return skirmish(save, party, t.encounter, 0, rng, t.encounter.startsWith('belfry') ? BELFRY : OSSUARY, t.scale);
}

export const processionRecommended = (save: SaveData, tier: number) => recommendedPower(processionBattle(save, [], tier));

const UP: Record<Potency, Potency> = { common: 'fine', fine: 'holy', holy: 'holy' };

/** The offerings a win pays, leaning to the honoured Order's favourites. */
export function processionDrops(tier: number, rng: Rng = Math.random, now = Date.now()): string[] {
  const t = PROCESSION_TIERS[tier];
  const honoured = FAVOURED[honouredToday(now).name] ?? [];
  const out: string[] = [];
  for (const [p, n] of Object.entries(t.win) as [Potency, number][]) {
    for (let i = 0; i < n; i++) {
      const potency = rng() < t.upgrade ? UP[p] : p;
      const fav = honoured.find((id) => offeringDef(id).potency === potency);
      const pool = OFFERINGS.filter((o) => o.potency === potency);
      out.push(fav && rng() < HONOURED_CHANCE ? fav : pool[Math.floor(rng() * pool.length)].id);
    }
  }
  return out;
}

export interface ProcessionResult {
  won: boolean;
  offerings: string[];
}

/** Settles a procession fight: an entry is spent only on a win. */
export function finishProcession(save: SaveData, tier: number, battle: Battle, rng: Rng = Math.random, now = Date.now()): ProcessionResult {
  if (battle.outcome() !== 'victory' || processionLeft(save, now) <= 0) return { won: false, offerings: [] };
  const p = processionOf(save, now);
  p.used += 1;
  p.best = Math.max(p.best, Math.min(PROCESSION_TIERS.length - 1, tier + 1));
  const offerings = processionDrops(tier, rng, now);
  giveOfferings(save, offerings);
  return { won: true, offerings };
}

export const offeringsText = (ids: string[]) => {
  const n = new Map<string, number>();
  for (const id of ids) n.set(id, (n.get(id) ?? 0) + 1);
  return [...n].map(([id, k]) => `${k > 1 ? `${k} ` : ''}${offeringDef(id).name}`).join(', ');
};
