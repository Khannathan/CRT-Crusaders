import { passTrack } from './pass';
import { trickle } from './feast';
import type { SaveData } from '../state/save';
import { earn } from './currency';
import { bagText, give, type Bag } from './items';
import { gainFaith } from './rank';
import { noviceTrack } from './novitiate';

/**
 * Daily Penance and weekly Litany: small tasks that fill a Devotion bar. Each
 * finished task adds its Devotion at once; the bar pays out at three marks,
 * claimed by hand. Dailies reset at local midnight, the Litany on Monday.
 * Everything pays in Seals and Tithes, nothing new.
 */
export type TaskEvent =
  | 'fightWon'
  | 'eliteWon'
  | 'bossWon'
  | 'cryptCleared'
  | 'pull'
  | 'enhance'
  | 'levelUp'
  | 'takeVow'
  | 'vigilClaim'
  | 'dailyDone'
  | 'trialWon'
  | 'towerFloor'
  | 'inquisitionWon'
  | 'ordealWon';

export interface TaskDef {
  id: string;
  text: string;
  event: TaskEvent;
  need: number;
  devotion: number;
}

export interface Reward {
  seals?: number;
  tithes?: number;
  items?: Bag;
  gilt?: number;
  alms?: number;
}

export interface Mark {
  at: number;
  reward: Reward;
}

export type Period = 'daily' | 'weekly';

export const TASKS: Record<Period, TaskDef[]> = {
  daily: [
    { id: 'd-fights', text: 'Put three horrors to the sword', event: 'fightWon', need: 3, devotion: 20 },
    { id: 'd-vigil', text: 'Gather the fruits of the Vigil', event: 'vigilClaim', need: 1, devotion: 20 },
    { id: 'd-enhance', text: 'Temper gear at the forge twice', event: 'enhance', need: 2, devotion: 20 },
    { id: 'd-pull', text: 'Break a seal at the Altar', event: 'pull', need: 1, devotion: 20 },
    { id: 'd-level', text: 'Raise a Sister in the faith', event: 'levelUp', need: 1, devotion: 20 },
  ],
  weekly: [
    { id: 'w-fights', text: 'Slay 25 horrors', event: 'fightWon', need: 25, devotion: 20 },
    { id: 'w-crypts', text: 'Purify 3 crypts', event: 'cryptCleared', need: 3, devotion: 20 },
    { id: 'w-elites', text: 'Bring down 5 greater horrors', event: 'eliteWon', need: 5, devotion: 20 },
    { id: 'w-vigil', text: 'Claim the Vigil 7 times', event: 'vigilClaim', need: 7, devotion: 20 },
    { id: 'w-enhance', text: 'Temper gear 10 times', event: 'enhance', need: 10, devotion: 20 },
    { id: 'w-daily', text: 'Finish Daily Penance on 4 days', event: 'dailyDone', need: 4, devotion: 20 },
  ],
};

export const MARKS: Record<Period, Mark[]> = {
  daily: [
    { at: 40, reward: { tithes: 120, alms: 10, items: { incense1: 5 } } },
    { at: 70, reward: { seals: 1, tithes: 80, alms: 10, items: { page1: 4 } } },
    { at: 100, reward: { seals: 2, alms: 20, items: { incense1: 5, ash1: 4 } } },
  ],
  weekly: [
    { at: 40, reward: { seals: 2, tithes: 300, alms: 30, items: { incense2: 3 } } },
    { at: 80, reward: { seals: 3, gilt: 40, items: { writ1: 3 } } },
    { at: 120, reward: { seals: 5, gilt: 80, items: { incense2: 3, writ2: 1 } } },
  ],
};

export const maxDevotion = (p: Period) => TASKS[p].reduce((n, t) => n + t.devotion, 0);

export interface PeriodState {
  /** Which day or week this is (local date of its start), to know when to reset. */
  key: string;
  progress: Record<string, number>;
  /** Marks (by `at`) already claimed. */
  claimed: number[];
}

export interface TaskState {
  daily: PeriodState;
  weekly: PeriodState;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Local calendar day, e.g. 2026-11-21. */
export const dayKey = (now: number) => dateKey(new Date(now));

/** The Monday that starts this local week. */
export function weekKey(now: number) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dateKey(d);
}

const fresh = (key: string): PeriodState => ({ key, progress: {}, claimed: [] });

/** The task state, reset if a new day or week has begun. */
export function tasksOf(save: SaveData, now = Date.now()): TaskState {
  const t = (save.tasks ??= { daily: fresh(dayKey(now)), weekly: fresh(weekKey(now)) });
  if (t.daily.key !== dayKey(now)) t.daily = fresh(dayKey(now));
  if (t.weekly.key !== weekKey(now)) t.weekly = fresh(weekKey(now));
  return t;
}

export function devotion(save: SaveData, p: Period, now = Date.now()) {
  const st = tasksOf(save, now)[p];
  return TASKS[p].reduce((n, t) => n + ((st.progress[t.id] ?? 0) >= t.need ? t.devotion : 0), 0);
}

/** Counts something the player did toward every task that listens for it. */
export function track(save: SaveData, event: TaskEvent, n = 1, now = Date.now()) {
  gainFaith(save, event, n);
  trickle(save, event, n, now);
  noviceTrack(save, event, n, now);
  passTrack(save, event, n, now);
  // Lifetime counts for Deeds (systems/deeds.ts).
  const deeds = (save.deeds ??= { counts: {}, claimed: {} });
  deeds.counts[event] = (deeds.counts[event] ?? 0) + n;
  const st = tasksOf(save, now);
  const dailyWasDone = devotion(save, 'daily', now) >= maxDevotion('daily');
  for (const p of ['daily', 'weekly'] as Period[]) {
    for (const task of TASKS[p]) {
      if (task.event !== event) continue;
      st[p].progress[task.id] = Math.min(task.need, (st[p].progress[task.id] ?? 0) + n);
    }
  }
  if (!dailyWasDone && devotion(save, 'daily', now) >= maxDevotion('daily')) track(save, 'dailyDone', 1, now);
}

/** Marks reached and not yet claimed. */
export function claimable(save: SaveData, p: Period, now = Date.now()): Mark[] {
  const st = tasksOf(save, now)[p];
  const dev = devotion(save, p, now);
  return MARKS[p].filter((m) => dev >= m.at && !st.claimed.includes(m.at));
}

export const anyClaimable = (save: SaveData, now = Date.now()) => claimable(save, 'daily', now).length + claimable(save, 'weekly', now).length > 0;

export function grant(save: SaveData, r: Reward) {
  save.seals += r.seals ?? 0;
  save.tithes += r.tithes ?? 0;
  if (r.items) give(save, r.items);
  earn(save, r.gilt ?? 0, r.alms ?? 0);
}

export const rewardText = (r: Reward) => [r.seals ? `${r.seals} Seal${r.seals > 1 ? 's' : ''}` : '', r.tithes ? `${r.tithes} Tithes` : '', r.gilt ? `${r.gilt} Gilt` : '', r.alms ? `${r.alms} Alms` : '', bagText(r.items)].filter(Boolean).join(' + ');

/** Claims one mark. Returns its reward, or undefined if it isn't ready. */
export function claimMark(save: SaveData, p: Period, at: number, now = Date.now()): Reward | undefined {
  const mark = claimable(save, p, now).find((m) => m.at === at);
  if (!mark) return undefined;
  tasksOf(save, now)[p].claimed.push(at);
  grant(save, mark.reward);
  return mark.reward;
}
