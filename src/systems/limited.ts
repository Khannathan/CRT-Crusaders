import { CRUSADERS } from '../data/crusaders';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';

/**
 * The Limited banner: every LIMITED_DAYS a different Saint (a limited UR, never
 * on an Order banner) takes the Altar, with two SSRs boosted beside her. The
 * Saints come round in turn, so a missed Saint returns in a later window. The
 * calendar runs on the device clock, like every other reset.
 */
export const LIMITED_DAYS = 14;
/** The Monday the first window opened (local time). */
const EPOCH = new Date(2026, 10, 16);
const DAY = 864e5;

/** Every limited Saint, in the order their windows come round. */
export const SAINTS: CrusaderDef[] = CRUSADERS.filter((c) => c.limited);
/** True for a Sister any Order banner can give. */
export const isStandard = (c: CrusaderDef) => !c.limited;
/** Standard SSRs, in roster order, for the boosted pair. */
const SSRS = CRUSADERS.filter((c) => c.rarity === 'SSR' && isStandard(c));

export interface LimitedWindow {
  /** Window number since EPOCH; changes every LIMITED_DAYS. */
  index: number;
  saint: CrusaderDef;
  /** The two SSRs boosted beside her. */
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

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** The window with this index. */
export function windowAt(index: number): LimitedWindow {
  const saint = SAINTS[mod(index, SAINTS.length)];
  // Two SSRs of other Orders than hers, stepping through the list so pairs vary.
  const others = SSRS.filter((c) => c.order !== saint.order);
  const a = others[mod(index * 3, others.length)];
  const rest = others.filter((c) => c.order !== a.order);
  const b = rest[mod(index * 7 + 3, rest.length)];
  return { index, saint, ssrs: [a, b], starts: dayStart(index * LIMITED_DAYS), ends: dayStart((index + 1) * LIMITED_DAYS) };
}

/** The window open now. */
export function limitedWindow(now = Date.now()): LimitedWindow {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const days = Math.round((midnight.getTime() - EPOCH.getTime()) / DAY);
  return windowAt(Math.floor(days / LIMITED_DAYS));
}

/** The next `n` windows after this one: who is coming, and when. */
export const upcoming = (now = Date.now(), n = SAINTS.length - 1) => {
  const cur = limitedWindow(now).index;
  return Array.from({ length: n }, (_, k) => windowAt(cur + 1 + k));
};

/** When this Saint next opens a window (now, if she holds the Altar). */
export function nextWindowOf(id: string, now = Date.now()): LimitedWindow | undefined {
  const cur = limitedWindow(now).index;
  for (let k = 0; k <= SAINTS.length; k++) if (windowAt(cur + k).saint.id === id) return windowAt(cur + k);
  return undefined;
}

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
export const limitedUnseen = (save: SaveData, now = Date.now()) => save.limitedSeen !== limitedWindow(now).index;

export function markLimitedSeen(save: SaveData, now = Date.now()) {
  save.limitedSeen = limitedWindow(now).index;
}
