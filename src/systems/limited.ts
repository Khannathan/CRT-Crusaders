import { CRUSADERS } from '../data/crusaders';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';

/**
 * The Limited banner: every LIMITED_DAYS a new banner takes the Altar. Each
 * runs one Saint (a limited UR) and two limited SSRs, none of whom any
 * standard banner can give, and it cannot be customized. Once GRADUATE_AFTER
 * more Limited banners have come and gone, its three Sisters join their
 * Orders' standard pools for good. The calendar runs on the device clock,
 * like every other reset.
 *
 * LINEUP is the schedule, in order. When it runs out, its last banner stays
 * up (and nobody new graduates) until more banners are added to the end.
 */
export const LIMITED_DAYS = 14;
/** Limited banners that must pass after hers before a Sister goes standard. */
export const GRADUATE_AFTER = 3;
/** The Monday the first window opened (local time). */
const EPOCH = new Date(2026, 10, 16);
const DAY = 864e5;

/** Each Limited banner: its Saint, then its two SSRs (one of her Order, one of an Order with no Saint). */
const LINEUP: [string, string, string][] = [
  ['CC-W069', 'CC-W078', 'CC-W187'],
  ['CC-W129', 'CC-W147', 'CC-W197'],
  ['CC-W209', 'CC-W218', 'CC-W137'],
  ['CC-W199', 'CC-W217', 'CC-W148'],
  ['CC-W229', 'CC-W127', 'CC-W237'],
];

const byId = (id: string) => CRUSADERS.find((c) => c.id === id)!;
export interface LimitedBanner {
  /** Position in the lineup. */
  slot: number;
  saint: CrusaderDef;
  ssrs: CrusaderDef[];
}
export const LIMITED_BANNERS: LimitedBanner[] = LINEUP.map(([u, a, b], slot) => ({ slot, saint: byId(u), ssrs: [byId(a), byId(b)] }));

/** Every limited Saint, in the order their banners come. */
export const SAINTS: CrusaderDef[] = LIMITED_BANNERS.map((b) => b.saint);
/** Lineup slot of each limited Sister. */
const SLOT_OF = new Map(LIMITED_BANNERS.flatMap((b) => [b.saint, ...b.ssrs].map((c) => [c.id, b.slot] as const)));

export interface LimitedWindow {
  /** Window number since EPOCH; changes every LIMITED_DAYS. */
  index: number;
  /** The lineup banner this window runs (the last one, once the lineup runs out). */
  slot: number;
  saint: CrusaderDef;
  /** The two limited SSRs boosted beside her. */
  ssrs: CrusaderDef[];
  starts: number;
  ends: number;
}

/** Local midnight `days` after EPOCH (setDate keeps it right across daylight saving). */
function dayStart(days: number) {
  const d = new Date(EPOCH);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

const LAST = LIMITED_BANNERS.length - 1;
const slotAt = (index: number) => Math.max(0, Math.min(index, LAST));

/** The window with this index. */
export function windowAt(index: number): LimitedWindow {
  const b = LIMITED_BANNERS[slotAt(index)];
  return { index, slot: b.slot, saint: b.saint, ssrs: b.ssrs, starts: dayStart(index * LIMITED_DAYS), ends: dayStart((index + 1) * LIMITED_DAYS) };
}

const windowIndex = (now: number) => {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const days = Math.round((midnight.getTime() - EPOCH.getTime()) / DAY);
  return Math.floor(days / LIMITED_DAYS);
};

/** The window open now. */
export function limitedWindow(now = Date.now()): LimitedWindow {
  return windowAt(windowIndex(now));
}

/** The lineup slot whose banner first opens a Sister to everyone: GRADUATE_AFTER banners after hers have ended. */
export const graduatesAt = (id: string) => (SLOT_OF.has(id) ? SLOT_OF.get(id)! + GRADUATE_AFTER + 1 : undefined);

/** True once a limited Sister has joined her Order's standard pool. */
export function graduated(c: Pick<CrusaderDef, 'id' | 'limited'>, now = Date.now()) {
  if (!c.limited) return false;
  const at = graduatesAt(c.id);
  return at !== undefined && at <= LAST && slotAt(windowIndex(now)) >= at;
}

/** True for a Sister the standard banner can give: never limited, or limited and graduated. */
export const isStandard = (c: CrusaderDef, now = Date.now()) => !c.limited || graduated(c, now);
/** True while a Sister is only on the Limited banner. */
export const isLimitedNow = (c: Pick<CrusaderDef, 'id' | 'limited'>, now = Date.now()) => !!c.limited && !graduated(c, now);

/** When a limited Sister joins the standard pool: the start of that window, or undefined if the lineup is not that long yet. */
export function graduationDate(id: string): number | undefined {
  const at = graduatesAt(id);
  return at === undefined || at > LAST ? undefined : dayStart(at * LIMITED_DAYS);
}

/** The Limited banners still to come after this one, with when each arrives. */
export const upcoming = (now = Date.now()) => {
  const cur = windowIndex(now);
  const out: LimitedWindow[] = [];
  for (let i = cur + 1; i <= LAST; i++) out.push(windowAt(i));
  return out;
};

/** "9d 4h", "5h 12m" or "12m" until `t`. */
export function timeLeft(t: number, now = Date.now()) {
  const m = Math.max(0, Math.floor((t - now) / 6e4));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m % 60}m`;
  return `${m % 60}m`;
}

/** True while this window's Saint is new to the player (lights the Altar tab). */
export const limitedUnseen = (save: SaveData, now = Date.now()) => save.limitedSeen !== limitedWindow(now).slot;

export function markLimitedSeen(save: SaveData, now = Date.now()) {
  save.limitedSeen = limitedWindow(now).slot;
}
