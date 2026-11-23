import type { SaveData } from '../state/save';
import { CRUSADERS } from '../data/crusaders';
import { HOUNDS } from '../data/hounds';
import { CRYPTS } from './crusade';
import { TOTAL_STAGES, campaignOf } from './campaign';
import { towerOf } from './tower';
import { rankInfo } from './rank';
import { bondLevel, bondsOf } from './bonds';
import { houndsOf } from './hounds';
import { MAX_LEVEL } from './stats';
import { grant, type Reward, type TaskEvent } from './tasks';

/**
 * Deeds: the long ledger. Twenty ladders of five tiers, each read from the
 * save or from lifetime counts of what the player has done. Every tier claimed
 * pays Gilt and Seals and adds Deed points; points earn titles, and the top
 * tier of each ladder earns that ladder's own title.
 */
export interface DeedDef {
  id: string;
  name: string;
  /** "Purge 5 crypts" for a tier's goal. */
  text: (n: number) => string;
  value: (save: SaveData) => number;
  tiers: number[];
  /** Earned with the top tier. */
  title: string;
}

const count = (save: SaveData, e: TaskEvent) => save.deeds?.counts[e] ?? 0;
const owned = (save: SaveData) => Object.values(save.owned);

export const DEEDS: DeedDef[] = [
  { id: 'crypts', name: 'Purger of Crypts', text: (n) => `Purge ${n} crypt${n > 1 ? 's' : ''}`, value: (s) => s.cleared.length, tiers: [1, 3, 6, 10, CRYPTS.length], title: 'Purger of Crypts' },
  { id: 'heresy', name: "Heretic's Bane", text: (n) => `Clear ${n} Heresy tier${n > 1 ? 's' : ''}`, value: (s) => Object.values(s.heresy ?? {}).reduce((a, b) => a + b, 0), tiers: [1, 5, 15, 30, 60], title: "Heretic's Bane" },
  { id: 'tower', name: 'Bell-Ringer', text: (n) => `Reach Bell Tower floor ${n}`, value: (s) => towerOf(s).best, tiers: [10, 25, 50, 75, 100], title: 'Bell-Ringer' },
  { id: 'road', name: 'Pilgrim', text: (n) => `Win ${n} stages of the Pilgrim's Road`, value: (s) => campaignOf(s).best, tiers: [10, 20, 30, 40, TOTAL_STAGES], title: 'Pilgrim of the Road' },
  { id: 'sworn', name: 'Mother Superior', text: (n) => `Swear ${n} Sisters`, value: (s) => owned(s).length, tiers: [10, 25, 45, 65, CRUSADERS.length], title: 'Mother Superior' },
  { id: 'urs', name: 'Saint-Caller', text: (n) => `Swear ${n} UR Sister${n > 1 ? 's' : ''}`, value: (s) => CRUSADERS.filter((c) => c.rarity === 'UR' && s.owned[c.id]).length, tiers: [1, 3, 5, 10, 15], title: 'Saint-Caller' },
  { id: 'vows', name: 'Vow-Keeper', text: (n) => `Take ${n} Vows`, value: (s) => owned(s).reduce((a, o) => a + o.vow + (o.tier ?? 0) * 5, 0), tiers: [5, 25, 75, 150, 300], title: 'Keeper of Vows' },
  { id: 'level', name: 'Exalted', text: (n) => `Raise a Sister to level ${n}`, value: (s) => Math.max(0, ...owned(s).map((o) => o.level)), tiers: [10, 20, 30, 40, MAX_LEVEL], title: 'The Exalted' },
  { id: 'bond', name: 'Beloved', text: (n) => `Reach bond ${n} with a Sister`, value: (s) => Math.max(0, ...Object.values(bondsOf(s)).map((b) => bondLevel(b.xp))), tiers: [5, 10, 15, 20, 30], title: 'Beloved of Sisters' },
  { id: 'fights', name: 'Slayer', text: (n) => `Slay ${n} horrors`, value: (s) => count(s, 'fightWon'), tiers: [100, 500, 2000, 5000, 10000], title: 'Slayer of Ten Thousand' },
  { id: 'bosses', name: 'Lord-Breaker', text: (n) => `Slay ${n} crypt lords`, value: (s) => count(s, 'bossWon'), tiers: [10, 50, 150, 400, 1000], title: 'Lord-Breaker' },
  { id: 'hunts', name: 'Huntress', text: (n) => `Open Hunt tier ${n}`, value: (s) => (s.hunts?.tier ?? 0) + 1, tiers: [2, 3, 4, 5, 6], title: 'Huntress of Beasts' },
  { id: 'rank', name: 'The Faithful', text: (n) => `Reach Rank of Faith ${n}`, value: (s) => rankInfo(s).rank, tiers: [5, 10, 15, 20, 30], title: 'Pillar of the Faith' },
  { id: 'penance', name: 'Penitent', text: (n) => `Finish Daily Penance on ${n} days`, value: (s) => count(s, 'dailyDone'), tiers: [7, 30, 60, 100, 200], title: 'The Penitent' },
  { id: 'pulls', name: 'Seal-Breaker', text: (n) => `Break ${n} seals`, value: (s) => s.totalPulls, tiers: [10, 100, 300, 600, 1000], title: 'Seal-Breaker' },
  { id: 'hounds', name: 'Kennel-Master', text: (n) => `Keep ${n} hounds`, value: (s) => Object.keys(houndsOf(s).owned).length, tiers: [2, 4, 6, 8, HOUNDS.length], title: 'Master of Hounds' },
  { id: 'sets', name: 'Collector', text: (n) => `Complete ${n} Order Book set${n > 1 ? 's' : ''}`, value: (s) => (s.sets ?? []).length, tiers: [1, 3, 5, 8, 11], title: 'Keeper of the Book' },
  { id: 'forge', name: 'Forge-Saint', text: (n) => `Temper gear ${n} times`, value: (s) => count(s, 'enhance'), tiers: [20, 100, 300, 700, 1500], title: 'Saint of the Forge' },
  { id: 'inquisition', name: 'Inquisitor', text: (n) => `Win ${n} Inquisition trials`, value: (s) => count(s, 'inquisitionWon'), tiers: [3, 10, 30, 60, 120], title: 'High Inquisitor' },
  { id: 'trials', name: 'Relic Warden', text: (n) => `Win ${n} Relic Trials`, value: (s) => count(s, 'trialWon'), tiers: [10, 50, 150, 300, 600], title: 'Warden of Relics' },
];

/** What each tier pays, by tier index. */
export const TIER_REWARDS: Reward[] = [
  { gilt: 10, seals: 1 },
  { gilt: 20, seals: 1 },
  { gilt: 40, seals: 2 },
  { gilt: 60, seals: 3 },
  { gilt: 100, seals: 5 },
];
export const TIER_POINTS = [10, 20, 30, 40, 50];

/** Titles for Deed points. */
export const POINT_TITLES: { at: number; title: string }[] = [
  { at: 100, title: 'The Faithful' },
  { at: 400, title: 'Zealot' },
  { at: 1000, title: 'Crusader' },
  { at: 2000, title: 'Inquisitor-General' },
  { at: 3000, title: 'Living Saint' },
];

export interface DeedState {
  /** Lifetime counts, from the day Deeds came. */
  counts: Partial<Record<TaskEvent, number>>;
  /** Tiers claimed per deed id. */
  claimed: Record<string, number>;
}

export const deedsOf = (save: SaveData): DeedState => (save.deeds ??= { counts: {}, claimed: {} });

export const claimedTiers = (save: SaveData, id: string) => deedsOf(save).claimed[id] ?? 0;

/** Tiers reached (not necessarily claimed). */
export function reachedTiers(save: SaveData, d: DeedDef) {
  const v = d.value(save);
  return d.tiers.filter((t) => v >= t).length;
}

export const deedReady = (save: SaveData, d: DeedDef) => reachedTiers(save, d) > claimedTiers(save, d.id);
export const anyDeedReady = (save: SaveData) => DEEDS.some((d) => deedReady(save, d));

export function deedPoints(save: SaveData) {
  return DEEDS.reduce((n, d) => n + TIER_POINTS.slice(0, claimedTiers(save, d.id)).reduce((a, b) => a + b, 0), 0);
}

export const MAX_POINTS = DEEDS.length * TIER_POINTS.reduce((a, b) => a + b, 0);

function earnTitle(save: SaveData, title: string, out: string[]) {
  if ((save.titles ??= []).includes(title)) return;
  save.titles.push(title);
  out.push(title);
}

export interface DeedClaim {
  reward: Reward;
  titles: string[];
}

/** Claims every reached tier of one deed (or of all deeds when `id` is omitted). */
export function claimDeeds(save: SaveData, id?: string): DeedClaim | undefined {
  const reward: Required<Pick<Reward, 'gilt' | 'seals'>> = { gilt: 0, seals: 0 };
  const titles: string[] = [];
  const st = deedsOf(save);
  for (const d of DEEDS) {
    if (id && d.id !== id) continue;
    const reached = reachedTiers(save, d);
    for (let t = claimedTiers(save, d.id); t < reached; t++) {
      reward.gilt += TIER_REWARDS[t].gilt ?? 0;
      reward.seals += TIER_REWARDS[t].seals ?? 0;
      st.claimed[d.id] = t + 1;
      if (t + 1 === d.tiers.length) earnTitle(save, d.title, titles);
    }
  }
  if (!reward.gilt && !reward.seals) return undefined;
  grant(save, reward);
  const pts = deedPoints(save);
  for (const p of POINT_TITLES) if (pts >= p.at) earnTitle(save, p.title, titles);
  return { reward, titles };
}

/** The next title by points, if any is left. */
export const nextPointTitle = (save: SaveData) => POINT_TITLES.find((p) => deedPoints(save) < p.at);
