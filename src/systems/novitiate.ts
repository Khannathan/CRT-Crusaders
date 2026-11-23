import type { SaveData } from '../state/save';
import type { CrusaderDef } from '../data/types';
import { towerOf } from './tower';
import { rankInfo } from './rank';
import { grant, type Reward, type TaskEvent } from './tasks';
import { standardSSRs } from './gacha';

/**
 * The Novitiate: a new player's first week. Seven days of four tasks each; day
 * N opens on the Nth calendar day after the first visit, and every task stays
 * open until the Novitiate closes (14 days after it began, or once all is
 * claimed). Each claimed task pays at once and adds a Novice Mark; marks pay
 * at three thresholds, the last a free SSR of the player's choice.
 *
 * Events count from the day it began. Checks read the save as it stands, so a
 * veteran's save finishes them at once.
 */
export const NOVITIATE_DAYS = 7;
export const NOVITIATE_OPEN_DAYS = 14;

export interface NoviceTask {
  id: string;
  day: number;
  text: string;
  need: number;
  /** Counted from events since the Novitiate began... */
  event?: TaskEvent;
  /** ...or read from the save. */
  check?: (save: SaveData) => number;
  reward: Reward;
}

const maxLevel = (s: SaveData) => Math.max(0, ...Object.values(s.owned).map((o) => o.level));
const ownedCount = (s: SaveData) => Object.keys(s.owned).length;
const rankNow = (s: SaveData) => rankInfo(s).rank;

export const NOVICE_TASKS: NoviceTask[] = [
  // Day 1: take up the sword
  { id: 'n1-fights', day: 1, text: 'Put 3 horrors to the sword', event: 'fightWon', need: 3, reward: { seals: 1, tithes: 200 } },
  { id: 'n1-pull', day: 1, text: 'Break a seal at the Altar', event: 'pull', need: 1, reward: { seals: 1 } },
  { id: 'n1-level', day: 1, text: 'Raise a Sister to level 5', check: maxLevel, need: 5, reward: { tithes: 300, items: { ash1: 3 } } },
  { id: 'n1-vigil', day: 1, text: 'Gather the Vigil once', event: 'vigilClaim', need: 1, reward: { seals: 1, tithes: 150 } },
  // Day 2: the first crypt
  { id: 'n2-crypt', day: 2, text: 'Purge the Drowned Ossuary', check: (s) => s.cleared.length, need: 1, reward: { seals: 2, tithes: 300 } },
  { id: 'n2-enhance', day: 2, text: 'Temper gear twice', event: 'enhance', need: 2, reward: { tithes: 200, items: { iron1: 4 } } },
  { id: 'n2-levels', day: 2, text: 'Raise Sisters 10 levels in all', event: 'levelUp', need: 10, reward: { tithes: 400, items: { page1: 4 } } },
  { id: 'n2-rank', day: 2, text: 'Reach Rank of Faith II', check: rankNow, need: 2, reward: { seals: 1, gilt: 50 } },
  // Day 3: a growing host
  { id: 'n3-fights', day: 3, text: 'Slay 20 horrors', event: 'fightWon', need: 20, reward: { seals: 2, tithes: 300 } },
  { id: 'n3-elites', day: 3, text: 'Fell 3 greater horrors', event: 'eliteWon', need: 3, reward: { tithes: 300, items: { ash1: 5 } } },
  { id: 'n3-owned', day: 3, text: 'Swear 12 Sisters to the faith', check: ownedCount, need: 12, reward: { seals: 2 } },
  { id: 'n3-penance', day: 3, text: 'Finish Daily Penance once', event: 'dailyDone', need: 1, reward: { seals: 1, alms: 30 } },
  // Day 4: vows and trials
  { id: 'n4-rank', day: 4, text: 'Reach Rank of Faith III', check: rankNow, need: 3, reward: { seals: 2, gilt: 50 } },
  { id: 'n4-trials', day: 4, text: 'Win 2 Relic Trials', event: 'trialWon', need: 2, reward: { tithes: 400, items: { incense1: 5 } } },
  { id: 'n4-vow', day: 4, text: 'Take a Vow', event: 'takeVow', need: 1, reward: { seals: 2 } },
  { id: 'n4-level', day: 4, text: 'Raise a Sister to level 15', check: maxLevel, need: 15, reward: { tithes: 500, items: { page1: 5 } } },
  // Day 5: deeper
  { id: 'n5-crypts', day: 5, text: 'Purge 3 crypts', event: 'cryptCleared', need: 3, reward: { seals: 3, tithes: 400 } },
  { id: 'n5-bosses', day: 5, text: 'Slay 3 crypt lords', event: 'bossWon', need: 3, reward: { tithes: 500, items: { ash1: 6 } } },
  { id: 'n5-pulls', day: 5, text: 'Break 20 seals', event: 'pull', need: 20, reward: { seals: 3 } },
  { id: 'n5-level', day: 5, text: 'Raise a Sister to level 20', check: maxLevel, need: 20, reward: { tithes: 600, items: { iron1: 6 } } },
  // Day 6: the tower
  { id: 'n6-rank', day: 6, text: 'Reach Rank of Faith VI', check: rankNow, need: 6, reward: { seals: 2, gilt: 80 } },
  { id: 'n6-tower', day: 6, text: 'Climb to Bell Tower floor 5', check: (s) => towerOf(s).best, need: 5, reward: { seals: 3, tithes: 400 } },
  { id: 'n6-elites', day: 6, text: 'Fell 10 greater horrors', event: 'eliteWon', need: 10, reward: { tithes: 500, items: { incense1: 6 } } },
  { id: 'n6-enhance', day: 6, text: 'Temper gear 15 times', event: 'enhance', need: 15, reward: { tithes: 400, items: { iron1: 8 } } },
  // Day 7: the oath
  { id: 'n7-crypts', day: 7, text: 'Purge 5 crypts', check: (s) => s.cleared.length, need: 5, reward: { seals: 4, tithes: 600 } },
  { id: 'n7-level', day: 7, text: 'Raise a Sister to level 30', check: maxLevel, need: 30, reward: { tithes: 800, items: { page1: 8 } } },
  { id: 'n7-penance', day: 7, text: 'Finish Daily Penance on 4 days', event: 'dailyDone', need: 4, reward: { seals: 3, alms: 60 } },
  { id: 'n7-owned', day: 7, text: 'Swear 20 Sisters to the faith', check: ownedCount, need: 20, reward: { seals: 4, gilt: 100 } },
];

export interface NoviceMark {
  at: number;
  reward: Reward;
  /** The last mark: a free SSR of the player's choice. */
  pick?: boolean;
}

export const NOVICE_MARKS: NoviceMark[] = [
  { at: 8, reward: { seals: 5, tithes: 500 } },
  { at: 16, reward: { seals: 10, gilt: 100 } },
  { at: 24, reward: { seals: 5 }, pick: true },
];

/** Beginner banner: two 10-pulls at a discount, each sure to hold an SSR or better. */
export const NOVICE_TENS = 2;
export const NOVICE_COST = 8;

export interface NovitiateState {
  /** Local day it began (YYYY-MM-DD). */
  start: string;
  counts: Partial<Record<TaskEvent, number>>;
  claimed: string[];
  marks: number[];
  /** The SSR chosen with the last mark. */
  picked?: string;
  /** Novice 10-pulls taken. */
  tens: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (now: number) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const dayStart = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

/** The Novitiate, begun on first call. */
export function novitiateOf(save: SaveData, now = Date.now()): NovitiateState {
  return (save.novitiate ??= { start: dayKey(now), counts: {}, claimed: [], marks: [], tens: 0 });
}

/** Days since it began, 1 on the first day (calendar days, local time). */
export function noviceDay(save: SaveData, now = Date.now()) {
  const st = novitiateOf(save, now);
  return Math.floor((dayStart(dayKey(now)) - dayStart(st.start)) / 86_400_000 + 0.5) + 1;
}

/** The last moment it stays open: the end of its 14th day. */
export function noviceEnds(save: SaveData, now = Date.now()) {
  return dayStart(novitiateOf(save, now).start) + NOVITIATE_OPEN_DAYS * 86_400_000 + 3_600_000 * 2; // a little DST slack
}

/** Every task, mark, the SSR pick and the beginner banner are spent. */
export function noviceSpent(save: SaveData) {
  const st = save.novitiate;
  if (!st) return false;
  return st.claimed.length >= NOVICE_TASKS.length && st.marks.length >= NOVICE_MARKS.length && st.tens >= NOVICE_TENS;
}

/** True while it shows on the Sanctum. */
export function noviceOpen(save: SaveData, now = Date.now()) {
  if (save.novitiate && noviceSpent(save)) return false;
  return noviceDay(save, now) <= NOVITIATE_OPEN_DAYS;
}

export const dayOpen = (save: SaveData, day: number, now = Date.now()) => noviceDay(save, now) >= day;

export function taskProgress(save: SaveData, t: NoviceTask, now = Date.now()) {
  const have = t.check ? t.check(save) : (novitiateOf(save, now).counts[t.event!] ?? 0);
  return Math.min(t.need, have);
}

export const taskDone = (save: SaveData, t: NoviceTask, now = Date.now()) => taskProgress(save, t, now) >= t.need;

export function taskClaimable(save: SaveData, t: NoviceTask, now = Date.now()) {
  return noviceOpen(save, now) && dayOpen(save, t.day, now) && !novitiateOf(save, now).claimed.includes(t.id) && taskDone(save, t, now);
}

/** Counts an event toward the Novitiate (called from track()). */
export function noviceTrack(save: SaveData, event: TaskEvent, n: number, now = Date.now()) {
  if (!noviceOpen(save, now)) return;
  const st = novitiateOf(save, now);
  st.counts[event] = (st.counts[event] ?? 0) + n;
}

export function claimNoviceTask(save: SaveData, id: string, now = Date.now()): Reward | undefined {
  const t = NOVICE_TASKS.find((x) => x.id === id);
  if (!t || !taskClaimable(save, t, now)) return undefined;
  novitiateOf(save, now).claimed.push(id);
  grant(save, t.reward);
  return t.reward;
}

export const noviceMarks = (save: SaveData, now = Date.now()) => novitiateOf(save, now).claimed.length;

export function markClaimable(save: SaveData, m: NoviceMark, now = Date.now()) {
  const st = novitiateOf(save, now);
  return noviceOpen(save, now) && noviceMarks(save, now) >= m.at && !st.marks.includes(m.at);
}

/** Claims a mark; the last one needs the SSR chosen (`pick`). */
export function claimNoviceMark(save: SaveData, at: number, pick?: string, now = Date.now()): Reward | undefined {
  const m = NOVICE_MARKS.find((x) => x.at === at);
  if (!m || !markClaimable(save, m, now)) return undefined;
  const st = novitiateOf(save, now);
  if (m.pick) {
    const c = noviceChoices(now).find((x) => x.id === pick);
    if (!c) return undefined;
    giveChosen(save, c);
    st.picked = c.id;
  }
  st.marks.push(at);
  grant(save, m.reward);
  return m.reward;
}

/** The SSRs the last mark can give: every standard SSR. */
export const noviceChoices = (now = Date.now()): CrusaderDef[] => standardSSRs(now);

/** A new Sister, or a Vow token if she is already sworn. */
function giveChosen(save: SaveData, c: CrusaderDef) {
  const o = save.owned[c.id];
  if (!o) save.owned[c.id] = { level: 1, vow: 0 };
  else o.tokens = (o.tokens ?? 0) + 1;
}

/** Something waits to be claimed. */
export function noviceReady(save: SaveData, now = Date.now()) {
  if (!noviceOpen(save, now)) return false;
  return (
    NOVICE_TASKS.some((t) => taskClaimable(save, t, now)) ||
    NOVICE_MARKS.some((m) => markClaimable(save, m, now)) ||
    (novitiateOf(save, now).tens < NOVICE_TENS && save.seals >= NOVICE_COST)
  );
}

export const noviceTensLeft = (save: SaveData, now = Date.now()) => NOVICE_TENS - novitiateOf(save, now).tens;
