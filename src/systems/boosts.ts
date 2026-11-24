import type { Bag, ItemId } from './items';

/**
 * Daily blessings (round 9): a fixed weekly schedule of content boosts, so
 * each day has a reason to play a different mode and players can plan the
 * week ("Tuesday is Tower day"). A day can carry several. The schedule runs
 * on the device clock, like the daily reset.
 */
export type BoostKind = 'crusade' | 'tower' | 'trials' | 'vigil' | 'errands' | 'bond' | 'exp' | 'fragments';

export interface Boost {
  kind: BoostKind;
  /** Extra share: 0.5 is +50%. */
  pct: number;
}

export const BOOST_INFO: Record<BoostKind, { name: string; what: string; scene: string }> = {
  crusade: { name: 'Crusade spoils', what: 'Tithes and materials carried home from Crusades', scene: 'Modes' },
  tower: { name: 'Bell Tower spoils', what: 'Tithes and materials from Bell Tower floors', scene: 'Tower' },
  trials: { name: 'Relic Trial spoils', what: 'Tithes, materials and Seals from Relic Trials; gear trials give an extra piece', scene: 'Trials' },
  vigil: { name: 'Vigil gathering', what: 'Tithes, materials and EXP the Vigil gathers', scene: 'Sanctum' },
  errands: { name: 'Errand spoils', what: 'What Sworn Errands bring home', scene: 'Errands' },
  bond: { name: 'Bond', what: 'Bond XP from every source', scene: 'Roster' },
  exp: { name: 'Battle EXP', what: 'EXP Sisters earn by winning fights', scene: 'Modes' },
  fragments: { name: "Saint's Fragments", what: "Saint's Fragments from every drop", scene: 'Armory' },
};

const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Each weekday's feast name, for flavour. */
export const DAY_FEAST = ['The Sabbath', "Pilgrims' Day", 'Bell Day', 'Day of Relics', "Crusaders' Day", 'Day of Ash', 'Vigil Eve'];

/** By weekday, Sunday first (Date.getDay). */
export const WEEK_BOOSTS: Boost[][] = [
  [{ kind: 'vigil', pct: 0.5 }, { kind: 'errands', pct: 0.5 }, { kind: 'fragments', pct: 1 }],
  [{ kind: 'crusade', pct: 0.5 }, { kind: 'exp', pct: 0.5 }],
  [{ kind: 'tower', pct: 0.5 }, { kind: 'bond', pct: 1 }],
  [{ kind: 'trials', pct: 0.5 }, { kind: 'errands', pct: 0.5 }],
  [{ kind: 'crusade', pct: 0.5 }, { kind: 'fragments', pct: 1 }],
  [{ kind: 'tower', pct: 0.5 }, { kind: 'exp', pct: 0.5 }],
  [{ kind: 'trials', pct: 0.5 }, { kind: 'bond', pct: 1 }, { kind: 'vigil', pct: 0.5 }],
];

let enabled = true;
/** Tests turn the schedule off so payouts don't depend on the weekday they run. */
export const setBoostsEnabled = (on: boolean) => (enabled = on);

export const dayName = (now = Date.now()) => DAY_NAME[new Date(now).getDay()];

/** Today's boosts. */
/** Homecoming (systems/welcome.ts): a returning player's week of boosts, on top of the day's. */
export const HOMECOMING: Boost[] = [{ kind: 'vigil', pct: 1 }, { kind: 'exp', pct: 0.5 }];
let homecomingUntil = 0;
export const setHomecoming = (until?: number) => (homecomingUntil = until ?? 0);
export const homecomingOn = (now = Date.now()) => now < homecomingUntil;

export const boostsToday = (now = Date.now()): Boost[] => (enabled ? [...WEEK_BOOSTS[new Date(now).getDay()], ...(homecomingOn(now) ? HOMECOMING : [])] : []);

/** Multiplier for a kind today: 1, or 1.5 for a +50% day. */
export const boostMult = (kind: BoostKind, now = Date.now()) => 1 + boostsToday(now).reduce((s, b) => s + (b.kind === kind ? b.pct : 0), 0);

export const boostPct = (kind: BoostKind, now = Date.now()) => Math.round((boostMult(kind, now) - 1) * 100);

/** Scales a count, rounding so a boosted 1 becomes 2 at +50% or more. */
export const boostN = (n: number, mult: number) => (mult === 1 || n <= 0 ? n : Math.max(n + 1, Math.round(n * mult)));

/** A bag scaled by a kind's boost; Saint's Fragments also take the Fragment boost. */
export function boostBag(bag: Bag | undefined, kind: BoostKind | undefined, now = Date.now()): Bag {
  const m = kind ? boostMult(kind, now) : 1;
  const f = boostMult('fragments', now);
  const out: Bag = {};
  for (const [id, n] of Object.entries(bag ?? {}) as [ItemId, number][]) out[id] = boostN(boostN(n, m), id === 'armory1' ? f : 1);
  return out;
}

/** "+50% Crusade spoils" lines for today. */
export const boostLines = (now = Date.now()) => boostsToday(now).map((b) => `+${Math.round(b.pct * 100)}% ${BOOST_INFO[b.kind].name}`);

/** Ms until the schedule turns (local midnight). */
export function nextTurn(now = Date.now()) {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}
