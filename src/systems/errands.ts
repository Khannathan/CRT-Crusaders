import { boostBag, boostMult, boostN } from './boosts';
import { CLASSES } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { ORDER_LIST } from '../data/orders';
import type { Rarity } from '../data/types';
import type { SaveData } from '../state/save';
import type { Family, ItemId } from './items';
import { seeded } from './rng';
import { dayKey, grant, type Reward } from './tasks';

/**
 * Holy Errands: the Church sends Sisters away on timed duties (escorting
 * relics, hearing a village's confession, burning a heretic's books). Pick an
 * errand from today's six, send the Sisters it asks for, and claim its spoils
 * when the time is up. A Sister of the named Order or calling makes it go
 * better (+50% spoils). Sisters away on an errand can't take a second one;
 * they still fight.
 */
export const ERRAND_SLOTS = 4;
export const BOARD_SIZE = 6;
export const BONUS_MULT = 1.5;
export const DURATIONS = [1, 4, 8, 20] as const;
export type Hours = (typeof DURATIONS)[number];

export interface ErrandDef {
  /** Unique per day: "<day>:<n>". */
  id: string;
  name: string;
  flavor: string;
  hours: Hours;
  /** Sisters it takes. */
  size: number;
  /** At least one Sister of this rarity or higher. */
  minRarity?: Rarity;
  /** A Sister of this Order (by name) or class (by id) earns +50%. */
  bonus: { kind: 'order' | 'class'; value: string };
  family: Family;
  reward: Reward;
}

export interface ActiveErrand {
  def: ErrandDef;
  sisters: string[];
  start: number;
  end: number;
  /** The bonus Sister went along. */
  boosted: boolean;
}

export interface ErrandState {
  /** Errand ids sent today (they leave the board). */
  sent: string[];
  day: string;
  active: ActiveErrand[];
}

/** Errand kinds: each pays mostly in one material family. */
const KINDS: { family: Family; names: [string, string][] }[] = [
  { family: 'ash', names: [['Tend the Pyres', 'A heretic burns at dawn. Someone must keep the fire honest.'], ['Sweep the Ossuary', 'The bones are restless. The ash is useful.']] },
  { family: 'page', names: [['Copy the Psalter', 'A blind scriptorium needs steady hands for a night.'], ['Burn the Heretic\'s Books', 'Read nothing. Keep what is holy.']] },
  { family: 'iron', names: [['Escort the Reliquary', 'A saint\'s finger travels to a poorer chapel.'], ['Nail the Coffins Shut', 'The plague village asks for iron and silence.']] },
  { family: 'incense', names: [['Bless the Fields', 'Smoke over the barley, and a prayer against the blight.'], ['Keep Vigil at the Shrine', 'The candles must not go out before Lauds.']] },
  { family: 'writ', names: [['Carry the Prioress\'s Letters', 'Sealed. Unread. Delivered by hand.'], ['Hear a Village\'s Confession', 'Every sin of a hamlet, in one long night.']] },
  { family: 'unction', names: [['Anoint the Dying', 'The hospice has more beds than priests.'], ['Wash the Pilgrims\' Feet', 'Humility is a discipline too.']] },
];

const RARITY_ORDER: Rarity[] = ['R', 'SR', 'SSR', 'UR'];
export const rarityAtLeast = (r: Rarity, min?: Rarity) => !min || RARITY_ORDER.indexOf(r) >= RARITY_ORDER.indexOf(min);

/** Spoils for an errand: a little Tithes and Alms, mostly its family's material. */
export function errandReward(family: Family, hours: Hours): Reward {
  const t1 = { 1: 2, 4: 5, 8: 8, 20: 14 }[hours];
  const t2 = { 1: 0, 4: 1, 8: 2, 20: 4 }[hours];
  const t3 = { 1: 0, 4: 0, 8: 0, 20: 1 }[hours];
  const items: Partial<Record<ItemId, number>> = { [`${family}1`]: t1 };
  if (t2) items[`${family}2` as ItemId] = t2;
  if (t3) items[`${family}3` as ItemId] = t3;
  return { tithes: 40 * hours, alms: 2 * hours + (hours === 20 ? 20 : 0), items };
}

/** The spoils with the bonus Sister along. */
export function boosted(r: Reward): Reward {
  const up = (n?: number) => (n ? Math.ceil(n * BONUS_MULT) : n);
  const items = Object.fromEntries(Object.entries(r.items ?? {}).map(([k, n]) => [k, up(n)]));
  return { ...r, tithes: up(r.tithes), alms: up(r.alms), items };
}

/** Today's six errands, the same all day: one short, one long, two of each between. */
export function boardFor(day: string): ErrandDef[] {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = seeded(h);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
  const hours: Hours[] = [1, 4, 4, 8, 8, 20];
  const classes = Object.keys(CLASSES);
  const used = new Set<string>();
  return hours.map((hr, n) => {
    const kind = KINDS[(n + Math.floor(rng() * KINDS.length)) % KINDS.length];
    // No errand twice in a day.
    const fresh = kind.names.filter(([nm]) => !used.has(nm));
    const [name, flavor] = fresh.length ? pick(fresh) : pick(kind.names);
    used.add(name);
    const size = hr === 1 ? 1 : hr === 20 ? 3 : 2;
    const minRarity: Rarity | undefined = hr === 20 ? 'SSR' : hr === 8 ? 'SR' : undefined;
    const bonus = rng() < 0.5 ? { kind: 'order' as const, value: pick(ORDER_LIST).name } : { kind: 'class' as const, value: pick(classes) };
    return { id: `${day}:${n}`, name, flavor, hours: hr, size, minRarity, bonus, family: kind.family, reward: errandReward(kind.family, hr) };
  });
}

export function errandsOf(save: SaveData, now = Date.now()): ErrandState {
  const day = dayKey(now);
  const s = (save.errands ??= { sent: [], day, active: [] });
  if (s.day !== day) {
    s.day = day;
    s.sent = [];
  }
  return s;
}

/** The errands still on offer today. */
export const openErrands = (save: SaveData, now = Date.now()) => {
  const s = errandsOf(save, now);
  return boardFor(s.day).filter((e) => !s.sent.includes(e.id));
};

/** Sisters away on an errand. */
/** Reads the active list directly: a day rollover clears the board, never the Sisters already away. */
export const busySisters = (save: SaveData) => new Set((save.errands?.active ?? []).flatMap((a) => a.sisters));

export const bonusLabel = (e: ErrandDef) => (e.bonus.kind === 'order' ? e.bonus.value : CLASSES[e.bonus.value]?.name ?? e.bonus.value);

const def = (id: string) => CRUSADERS.find((c) => c.id === id);

/** Whether a Sister fits the errand's bonus. */
export const fitsBonus = (e: ErrandDef, id: string) => {
  const c = def(id);
  return !!c && (e.bonus.kind === 'order' ? c.order === e.bonus.value : c.classId === e.bonus.value);
};

/** Why these Sisters can't go, or null if they can. */
export function sendBlock(save: SaveData, e: ErrandDef, sisters: string[], now = Date.now()): string | null {
  const s = errandsOf(save, now);
  if (s.active.length >= ERRAND_SLOTS) return `Only ${ERRAND_SLOTS} errands at once.`;
  if (s.sent.includes(e.id)) return 'Already sent today.';
  if (sisters.length !== e.size) return `This errand takes ${e.size} Sister${e.size > 1 ? 's' : ''}.`;
  const busy = busySisters(save);
  if (sisters.some((id) => !save.owned[id] || busy.has(id))) return 'A Sister is already away.';
  if (e.minRarity && !sisters.some((id) => rarityAtLeast(def(id)!.rarity, e.minRarity))) return `Needs at least one ${e.minRarity} or higher.`;
  return null;
}

export function sendErrand(save: SaveData, e: ErrandDef, sisters: string[], now = Date.now()): boolean {
  if (sendBlock(save, e, sisters, now)) return false;
  const s = errandsOf(save, now);
  s.sent.push(e.id);
  s.active.push({ def: e, sisters: [...sisters], start: now, end: now + e.hours * 3600_000, boosted: sisters.some((id) => fitsBonus(e, id)) });
  return true;
}

export const isDone = (a: ActiveErrand, now = Date.now()) => now >= a.end;

/** Claims a finished errand; returns its spoils. */
export function claimErrand(save: SaveData, index: number, now = Date.now()): Reward | undefined {
  const s = errandsOf(save, now);
  const a = s.active[index];
  if (!a || !isDone(a, now)) return undefined;
  const r0 = a.boosted ? boosted(a.def.reward) : a.def.reward;
  const m = boostMult('errands', now);
  const r = m > 1 ? { ...r0, tithes: r0.tithes && Math.round(r0.tithes * m), seals: r0.seals && boostN(r0.seals, m), items: boostBag(r0.items, 'errands', now) } : r0;
  grant(save, r);
  s.active.splice(index, 1);
  return r;
}

/** Calls the Sisters home early: no spoils, and the errand is spent for today. */
export function recallErrand(save: SaveData, index: number, now = Date.now()) {
  errandsOf(save, now).active.splice(index, 1);
}

export const anyErrandDone = (save: SaveData, now = Date.now()) => (save.errands?.active ?? []).some((a) => isDone(a, now));
