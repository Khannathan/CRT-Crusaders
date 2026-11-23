import type { SaveData } from '../state/save';
import { almsOf, giltOf } from './currency';
import { offeringsHeld } from './offerings';
import { countOf, familyDef, itemDef, type Bag, type ItemId } from './items';

/**
 * Where every resource comes from, so any cost or counter can answer "how do
 * I get more?". Each source names the screen that gives it, for a Go button.
 */
export type Currency = 'gilt' | 'alms' | 'seals' | 'tithes' | 'vows' | 'shards' | 'stigmata' | 'offerings';
export type ResourceId = Currency | ItemId;

export interface Source {
  text: string;
  /** Scene that gives it (opened by the Go button). */
  scene?: string;
  data?: object;
}

export interface ResourceInfo {
  name: string;
  desc: string;
  sources: Source[];
}

const CRYPTS: Source = { text: 'Crusades: crypt rooms, more and rarer at higher Heresy', scene: 'Crusade' };
const CRYPT_ELITE: Source = { text: 'Crusades: elites and bosses', scene: 'Crusade' };
const CRYPT_BOSS: Source = { text: 'Crusades: bosses at Heresy 2 and up', scene: 'Crusade' };
const VIGIL: Source = { text: "The Vigil: gathers while you are away, faster further along the Pilgrim's Road", scene: 'Sanctum' };
const ROAD: Source = { text: "Pilgrim's Road: first clears and chapter chests", scene: 'Campaign' };
const DAILY: Source = { text: 'Daily Penance marks', scene: 'Penance' };
const WEEKLY: Source = { text: 'Weekly Litany marks', scene: 'Penance', data: { tab: 'weekly' } };
const REFINE = (lower: string): Source => ({ text: `Refine 5 ${lower} into 1 in the Inventory`, scene: 'Inventory' });
const TITHE_SHOP: Source = { text: 'Shop: Tithe Exchange (weekly)', scene: 'Shop', data: { counter: 'tithes' } };
const GILT_SHOP: Source = { text: 'Shop: Gilt counter crates (daily)', scene: 'Shop', data: { counter: 'gilt' } };
const ALMONRY: Source = { text: 'Shop: the Almonry, when it stocks it', scene: 'Shop', data: { counter: 'almonry' } };
const TOWER: Source = { text: 'Bell Tower: first clear of a floor', scene: 'Tower' };
const INQ: Source = { text: 'Inquisition: Brand marks', scene: 'Inquisition' };

const CURRENCIES: Record<Currency, ResourceInfo> = {
  gilt: {
    name: 'Gilt',
    desc: 'The rare coin. Buys Seals, crates and refreshes in the Shop.',
    sources: [
      { text: 'Crusades: first clear of a crypt (100) and each new Heresy tier (40)', scene: 'Crusade' },
      ROAD,
      { text: 'Rank of Faith gifts', scene: 'Rank' },
      { text: 'Matins: the seventh dawn of each week', scene: 'Matins' },
      { text: 'Bell Tower: boss floors', scene: 'Tower' },
      WEEKLY,
      INQ,
    ],
  },
  alms: {
    name: 'Alms',
    desc: 'Charity of the faithful. Spent in the Almonry.',
    sources: [
      { text: 'Melt spare gear (Roster, Gear, Change)', scene: 'Roster' },
      { text: 'Pulls of a Sister whose Vows are full', scene: 'Recruit' },
      DAILY,
    ],
  },
  seals: {
    name: 'Wax Seals',
    desc: 'Break one at the Altar to call a Sister.',
    sources: [
      { text: 'Crusades: elites, bosses, every clear and first clears', scene: 'Crusade' },
      { text: 'The Vigil: one every few hours', scene: 'Sanctum' },
      ROAD,
      { text: 'Matins: a candle each dawn', scene: 'Matins' },
      { text: 'Rank of Faith gifts', scene: 'Rank' },
      DAILY,
      { text: 'Shop: for Gilt, Alms or Tithes', scene: 'Shop' },
    ],
  },
  tithes: {
    name: 'Tithes',
    desc: 'The common coin. Levels Sisters, enhances gear, pays for most growth.',
    sources: [
      { text: 'Crusades: every fight won, every run', scene: 'Crusade' },
      VIGIL,
      ROAD,
      { text: 'Relic Trials: the Tithe trial', scene: 'Trials' },
      { text: 'Melt spare gear', scene: 'Roster' },
      DAILY,
      TOWER,
    ],
  },
  vows: {
    name: 'Vow tokens',
    desc: 'A Sister pulled again: a copy of her. Vows take more copies on each star tier.',
    sources: [{ text: 'Pull a Sister you already have', scene: 'Recruit' }, { text: 'Matins: the 28th candle', scene: 'Matins' }, ALMONRY],
  },
  stigmata: {
    name: 'Stigmata',
    desc: "Wounds of the faithful. Spent to raise a Sister's star tier once her five Vows are taken.",
    sources: [
      { text: "Pilgrim's Road: chapter chests", scene: 'Campaign' },
      { text: 'Bell Tower: boss floors (every tenth)', scene: 'Tower' },
      { text: 'Inquisition: the 6 and 9 Brand marks', scene: 'Inquisition' },
      { text: 'Shop: Tithe Exchange (weekly)', scene: 'Shop', data: { counter: 'tithes' } },
      ALMONRY,
      { text: 'Pull a Sister who needs no more copies', scene: 'Recruit' },
    ],
  },
  offerings: {
    name: 'Offerings',
    desc: "Gifts for Confession. Each raises a Sister's bond; her Order's favourites count double.",
    sources: [
      { text: 'Reliquary Procession: three victories a day', scene: 'Procession' },
      { text: 'Shop: the Offering of the Day (Gilt counter)', scene: 'Shop', data: { counter: 'gilt' } },
      { text: 'Confession: one free candle each dawn, for any Sister', scene: 'Confession' },
    ],
  },
  shards: {
    name: 'Relic Shards',
    desc: "Every pull on an Order's banner adds one. Enough of them buy that Order's UR.",
    sources: [{ text: "Pull on an Order's banner at the Altar", scene: 'Recruit' }],
  },
};

const FAMILY_SOURCES: Record<string, Record<1 | 2 | 3, Source[]>> = {
  grace: {
    1: [{ text: 'Crusades: every crypt boss', scene: 'Crusade' }],
    2: [{ text: 'Crusades: bosses at Heresy 2 and up', scene: 'Crusade' }, REFINE('Embers of Grace')],
    3: [{ text: 'Crusades: bosses at Heresy 5', scene: 'Crusade' }, REFINE('Tears of Grace')],
  },
  unction: {
    1: [VIGIL, CRYPTS, ROAD, TITHE_SHOP],
    2: [CRYPT_BOSS, VIGIL, ROAD, GILT_SHOP, REFINE('Lesser Unction')],
    3: [ROAD, ALMONRY, REFINE('Blessed Unction')],
  },
  ash: {
    1: [CRYPTS, VIGIL, { text: 'Relic Trials: the Ash trial (Mon, Thu, weekends)', scene: 'Trials' }, DAILY, TITHE_SHOP],
    2: [CRYPT_ELITE, { text: 'Relic Trials: Ash trial, higher tiers', scene: 'Trials' }, GILT_SHOP, ALMONRY, REFINE('Grave Ash')],
    3: [CRYPT_BOSS, INQ, ALMONRY, REFINE("Martyr's Ash")],
  },
  page: {
    1: [CRYPTS, VIGIL, { text: 'Relic Trials: the Psalter trial (Tue, Fri, weekends)', scene: 'Trials' }, DAILY, TITHE_SHOP],
    2: [CRYPT_ELITE, { text: 'Relic Trials: Psalter trial, higher tiers', scene: 'Trials' }, GILT_SHOP, ALMONRY, REFINE('Torn Pages')],
    3: [CRYPT_BOSS, INQ, ALMONRY, REFINE('Psalter Leaves')],
  },
  iron: {
    1: [TOWER, CRYPTS, VIGIL, TITHE_SHOP],
    2: [{ text: 'Bell Tower: floors above 15', scene: 'Tower' }, CRYPT_ELITE, GILT_SHOP, ALMONRY, REFINE('Coffin Nails')],
    3: [{ text: 'Bell Tower: boss floors from 30', scene: 'Tower' }, CRYPT_BOSS, ALMONRY, REFINE('Blessed Iron')],
  },
  incense: {
    1: [CRYPTS, VIGIL, DAILY, TITHE_SHOP],
    2: [WEEKLY, CRYPT_ELITE, ALMONRY, REFINE('Myrrh')],
    3: [CRYPT_BOSS, REFINE('Frankincense')],
  },
  armory: {
    1: [{ text: 'Crusades: every boss, more at higher Heresy', scene: 'Crusade' }, { text: 'Bell Tower: boss floors', scene: 'Tower' }, { text: 'Relic Trials: tier 3 and up', scene: 'Trials' }, { text: "The Saints' Armory: one with every pull", scene: 'Armory' }, { text: 'Melt SSR and UR gear', scene: 'Roster' }, INQ, ALMONRY],
    2: [{ text: 'Feast stall', scene: 'Feast' }, { text: 'Shop: Gilt counter', scene: 'Shop', data: { counter: 'gilt' } }, ALMONRY, { text: 'Bonds: levels 15 and 25', scene: 'Roster' }, { text: 'Bell Tower: every 50th floor', scene: 'Tower' }, INQ, { text: "The Saints' Armory: 10 free the first time", scene: 'Armory' }],
    3: [{ text: 'Bonds: level 30', scene: 'Roster' }],
  },
  writ: {
    1: [{ text: 'Bell Tower: every fifth floor', scene: 'Tower' }, { text: 'Crusades: bosses', scene: 'Crusade' }, WEEKLY, TITHE_SHOP],
    2: [{ text: 'Bell Tower: boss floors', scene: 'Tower' }, INQ, WEEKLY, ALMONRY, REFINE('Writs of Passage')],
    3: [INQ, REFINE('Writs of Office')],
  },
};

const isItem = (id: ResourceId): id is ItemId => /^(ash|page|iron|incense|writ|unction|grace|armory)[123]$/.test(id);

export function resourceInfo(id: ResourceId): ResourceInfo {
  if (!isItem(id)) return CURRENCIES[id];
  const d = itemDef(id);
  return { name: d.name, desc: `${familyDef(d.family).use}. ${d.flavor}`, sources: FAMILY_SOURCES[d.family][d.tier] };
}

export function amountOf(save: SaveData, id: ResourceId): number {
  switch (id) {
    case 'gilt':
      return giltOf(save);
    case 'alms':
      return almsOf(save);
    case 'seals':
      return save.seals;
    case 'tithes':
      return save.tithes;
    case 'vows':
      return Object.values(save.owned).reduce((n, o) => n + (o.tokens ?? 0), 0);
    case 'stigmata':
      return save.stigmata ?? 0;
    case 'offerings':
      return offeringsHeld(save);
    case 'shards':
      return Object.values(save.shards ?? {}).reduce((n, v) => n + v, 0);
    default:
      return countOf(save, id);
  }
}

/** The resource worth explaining for a cost: the first one short, else the first item, else Tithes. */
export function costFocus(save: SaveData, items: Bag = {}, tithes = 0): ResourceId {
  const entries = Object.entries(items) as [ItemId, number][];
  const short = entries.find(([id, n]) => countOf(save, id) < n);
  if (short) return short[0];
  if (tithes && save.tithes < tithes) return 'tithes';
  return entries[0]?.[0] ?? 'tithes';
}
