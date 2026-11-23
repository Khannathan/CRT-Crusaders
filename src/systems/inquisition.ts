import { CRUSADERS } from '../data/crusaders';
import { earn } from './currency';
import { ENCOUNTERS, ENEMIES } from '../data/enemies';
import { ORDER_LIST } from '../data/orders';
import type { SaveData } from '../state/save';
import type { Battle } from './combat';
import { BELFRY, skirmish } from './crusade';
import type { Rng } from './gacha';
import { claimGear, makeGear, rollGearRarity, type GearItem } from './gear';
import { recommendedPower } from './power';
import { bagText, give, type Bag } from './items';
import { track, weekKey } from './tasks';
import { addStigmata } from './tiers';

/**
 * The Inquisition: every two weeks a new Edict names three hard trials and one
 * heretical rule that bends every fight. Each trial earns 0-3 Brands, nine in
 * all, and Brands pay out at three marks. A Sister who wins a trial is spent
 * for the others this rotation, so all three need different Sisters. Two
 * featured Orders fight with a blessing. No entry limit: a loss costs nothing.
 */
export const ROTATION_DAYS = 14;
/** The Monday the first rotation began. */
const EPOCH = new Date(2026, 0, 5);
/** Rounds a trial must end within for its third Brand. */
export const BRAND_ROUNDS = 8;
/** Featured Orders' ATK and HP blessing. */
export const FEATURED_BONUS = 0.2;

export type EdictId = 'famine' | 'candle' | 'iron' | 'haste';

export interface Edict {
  id: EdictId;
  name: string;
  rule: string;
}

export const EDICTS: Edict[] = [
  { id: 'famine', name: 'Edict of Famine', rule: 'Sisters receive half healing.' },
  { id: 'candle', name: 'Edict of the Short Candle', rule: 'The Vigil candle burns only 4 rounds.' },
  { id: 'iron', name: 'Edict of Iron', rule: 'Heretics wear iron: +60% armor.' },
  { id: 'haste', name: 'Edict of Haste', rule: 'Heretics move quicker and strike 10% harder.' },
];

export interface Act {
  name: string;
  encounter: string;
  scale: number;
}

const ACT_SETS: Act[][] = [
  [
    { name: 'The Kennel Tribunal', encounter: 'ossuary-elite-2', scale: 2.0 },
    { name: 'The Bishop’s Heresy', encounter: 'belfry-elite-1', scale: 2.5 },
    { name: 'The Choir Unmasked', encounter: 'choir', scale: 3.0 },
  ],
  [
    { name: 'The Stone Confessor', encounter: 'ossuary-elite-1', scale: 2.0 },
    { name: 'The Rotten Cloister', encounter: 'belfry-elite-2', scale: 2.5 },
    { name: 'The Abbess on Trial', encounter: 'abbess', scale: 2.7 },
  ],
];

export interface Rotation {
  /** Rotation number since the first; also its save key. */
  index: number;
  edict: Edict;
  acts: Act[];
  /** Featured Order names. */
  featured: string[];
  /** When this rotation ends (ms since epoch). */
  ends: number;
}

function mondayOf(now: number) {
  const [y, m, d] = weekKey(now).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function rotation(now = Date.now()): Rotation {
  const monday = mondayOf(now);
  const weeks = Math.round((monday.getTime() - EPOCH.getTime()) / (7 * 864e5));
  const index = Math.floor(weeks / 2);
  const start = new Date(EPOCH);
  start.setDate(start.getDate() + index * ROTATION_DAYS);
  const ends = new Date(start);
  ends.setDate(ends.getDate() + ROTATION_DAYS);
  const n = ((index % 1000) + 1000) % 1000;
  return {
    index,
    edict: EDICTS[n % EDICTS.length],
    acts: ACT_SETS[Math.floor(n / EDICTS.length) % ACT_SETS.length],
    featured: [ORDER_LIST[(n * 3) % ORDER_LIST.length].name, ORDER_LIST[(n * 3 + 5) % ORDER_LIST.length].name],
    ends: ends.getTime(),
  };
}

export interface InquisitionState {
  rotation: number;
  /** Best Brands per act. */
  brands: number[];
  /** Sisters who won each act; they can't fight the other two. */
  used: string[][];
  /** Marks (Brands total) already paid. */
  paid: number[];
}

export function inquisitionOf(save: SaveData, now = Date.now()): InquisitionState {
  const r = rotation(now).index;
  if (!save.inquisition || save.inquisition.rotation !== r) save.inquisition = { rotation: r, brands: [0, 0, 0], used: [[], [], []], paid: [] };
  return save.inquisition;
}

export const totalBrands = (save: SaveData, now = Date.now()) => inquisitionOf(save, now).brands.reduce((a, b) => a + b, 0);

/** Sisters spent on the other acts, so not free for this one. */
export function spentElsewhere(save: SaveData, act: number, now = Date.now()) {
  return new Set(inquisitionOf(save, now).used.flatMap((ids, i) => (i === act ? [] : ids)));
}

export interface Mark {
  at: number;
  seals: number;
  tithes: number;
  gear?: 'SSR';
  items?: Bag;
  gilt?: number;
  stigmata?: number;
}

export const BRAND_MARKS: Mark[] = [
  { at: 3, seals: 2, tithes: 300, gilt: 30, items: { writ2: 2 } },
  { at: 6, seals: 3, tithes: 0, gilt: 50, gear: 'SSR', items: { ash3: 1, page3: 1, armory1: 10, canon2: 2 }, stigmata: 1 },
  { at: 9, seals: 4, tithes: 500, gilt: 100, items: { writ3: 1, armory2: 3, canon3: 1 }, stigmata: 2 },
];

export const markText = (m: Mark) => [m.seals ? `${m.seals} Seals` : '', m.tithes ? `${m.tithes} Tithes` : '', m.gear ? `${m.gear}+ gear` : '', m.gilt ? `${m.gilt} Gilt` : '', m.stigmata ? `${m.stigmata} Stigmata` : '', bagText(m.items)].filter(Boolean).join(' + ');

export const isFeatured = (rot: Rotation, id: string) => rot.featured.includes(CRUSADERS.find((c) => c.id === id)?.order ?? '');

export const foesOf = (a: Act) => ENCOUNTERS[a.encounter].map((t) => ENEMIES[t].name).join(', ');

/** Builds an act's fight: the Edict's rule, then the featured Orders' blessing. */
export function inquisitionBattle(save: SaveData, party: string[], act: number, rng?: Rng, now = Date.now()): Battle {
  const rot = rotation(now);
  const a = rot.acts[act];
  const spent = spentElsewhere(save, act, now);
  const b = skirmish(save, party.filter((id) => !spent.has(id)), a.encounter, 0, rng, BELFRY, a.scale);
  applyEdict(b, rot.edict.id);
  for (const u of b.units) {
    if (u.side !== 'party' || !isFeatured(rot, u.ref)) continue;
    u.atk = Math.round(u.atk * (1 + FEATURED_BONUS));
    u.hp = Math.round(u.hp * (1 + FEATURED_BONUS));
    u.maxHp = Math.round(u.maxHp * (1 + FEATURED_BONUS));
  }
  return b;
}

/** Recommended party power for an act, with the Edict's rule on the foes. */
export const actRecommended = (save: SaveData, act: number, now = Date.now()) => recommendedPower(inquisitionBattle(save, [], act, undefined, now));

export function applyEdict(b: Battle, id: EdictId) {
  if (id === 'famine') b.partyHeal = 0.5;
  if (id === 'candle') b.vigil = Math.min(b.vigil, 4);
  for (const u of b.units) {
    if (u.side !== 'enemy') continue;
    if (id === 'iron') u.armor = Math.round(u.armor * 1.6);
    if (id === 'haste') {
      u.spd += 4;
      u.atk = Math.round(u.atk * 1.1);
    }
  }
}

/** 1 Brand for a win, 2 with no Sister fallen, 3 if also within BRAND_ROUNDS. */
export function brandsFor(battle: Battle): number {
  if (battle.outcome() !== 'victory') return 0;
  if (battle.units.some((u) => u.side === 'party' && u.hp <= 0)) return 1;
  return battle.round <= BRAND_ROUNDS ? 3 : 2;
}

export interface ActResult {
  brands: number;
  /** Brands gained over the act's previous best. */
  gained: number;
  paid: Mark[];
  gear: GearItem[];
}

/**
 * Records an act. A better result replaces the act's Brands and the Sisters
 * who earned them (freeing the old ones). Marks reached pay once.
 */
export function finishAct(save: SaveData, act: number, battle: Battle, rng: Rng = Math.random, now = Date.now()): ActResult {
  const st = inquisitionOf(save, now);
  const brands = brandsFor(battle);
  const res: ActResult = { brands, gained: 0, paid: [], gear: [] };
  if (!brands) return res;
  track(save, 'inquisitionWon', 1, now);
  if (brands <= st.brands[act]) return res;
  res.gained = brands - st.brands[act];
  st.brands[act] = brands;
  st.used[act] = battle.units.filter((u) => u.side === 'party').map((u) => u.ref);
  const total = st.brands.reduce((x, y) => x + y, 0);
  for (const m of BRAND_MARKS) {
    if (total < m.at || st.paid.includes(m.at)) continue;
    st.paid.push(m.at);
    save.seals += m.seals;
    save.tithes += m.tithes;
    if (m.items) give(save, m.items);
    earn(save, m.gilt ?? 0);
    addStigmata(save, m.stigmata ?? 0);
    if (m.gear) {
      const r = rollGearRarity(rng, 0.2);
      const before = save.gear?.length ?? 0;
      claimGear(save, [makeGear(rng, r === 'R' || r === 'SR' ? 'SSR' : r)]);
      if ((save.gear?.length ?? 0) > before) res.gear.push(save.gear![save.gear!.length - 1]);
    }
    res.paid.push(m);
  }
  return res;
}
