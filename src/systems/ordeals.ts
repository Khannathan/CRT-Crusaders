import type { SaveData } from '../state/save';
import { ENCOUNTERS } from '../data/enemies';
import type { Battle } from './combat';
import { BELFRY, OSSUARY, skirmish } from './crusade';
import type { Rng } from './gacha';
import { CP, foePower, partyPower } from './power';
import { rivals } from './rivals';
import { seeded } from './rng';
import { dayKey, grant, track, weekKey, type Reward } from './tasks';

/**
 * The Ordeals: a weekly league of twenty Sisterhoods, you and nineteen of the
 * rival Orders. Five Ordeals a day: each offers three champions (Easy, Even,
 * Hard), scaled to the party you send, so the climb is skill and nerve, not
 * only Power. A win pays points by how hard it was; a loss still pays a little.
 *
 * When the week turns, the bracket is judged: the top four rise a league, the
 * bottom four fall, and every place pays (more in the higher leagues). Rivals'
 * points grow through the week on a fixed seed, the same for every player.
 */

export const LEAGUES = ['Penitent', 'Faithful', 'Zealot', 'Martyr', 'Saint'];
export const BRACKET = 20;
export const RISE = 4;
export const FALL = 4;
export const ORDEALS_PER_DAY = 5;
/** Points for a loss: the attempt still counts for something. */
export const LOSS_POINTS = 2;

export type Grade = 'easy' | 'even' | 'hard';
export const GRADES: Record<Grade, { label: string; /** Foes' recommended power as a share of your party's. */ mult: number; points: number }> = {
  easy: { label: 'Easy', mult: 0.95, points: 10 },
  even: { label: 'Even', mult: 1.2, points: 20 },
  hard: { label: 'Hard', mult: 1.45, points: 35 },
};

/** Foes the champions bring, and the crypt whose ground they fight on. */
const BOUTS: { encounter: string; crypt: typeof OSSUARY }[] = [
  { encounter: 'ossuary-3', crypt: OSSUARY },
  { encounter: 'ossuary-4', crypt: OSSUARY },
  { encounter: 'ossuary-5', crypt: OSSUARY },
  { encounter: 'ossuary-elite-1', crypt: OSSUARY },
  { encounter: 'ossuary-elite-2', crypt: OSSUARY },
  { encounter: 'belfry-2', crypt: BELFRY },
  { encounter: 'belfry-3', crypt: BELFRY },
  { encounter: 'belfry-4', crypt: BELFRY },
  { encounter: 'belfry-elite-1', crypt: BELFRY },
  { encounter: 'belfry-elite-2', crypt: BELFRY },
].filter((b) => ENCOUNTERS[b.encounter]);

const TITLES = ['Champion', 'Zealot', 'Penitent', 'Inquisitor', 'Flagellant', 'Confessor', 'Warden', 'Abbess-elect'];

export interface OrdealResult {
  week: string;
  league: number;
  place: number;
  points: number;
  /** League after judgement. */
  now: number;
  reward: Reward;
  claimed?: boolean;
}

export interface OrdealState {
  week: string;
  league: number;
  points: number;
  day: string;
  /** Ordeals fought today. */
  used: number;
  wins: number;
  /** Last week's judgement, waiting to be claimed. */
  last?: OrdealResult;
  /** Highest league ever reached. */
  best?: number;
}

export interface Champion {
  grade: Grade;
  rival: string;
  title: string;
  encounter: string;
}

export interface BracketRow {
  name: string;
  points: number;
  you?: boolean;
}

const WEEK = 7 * 864e5;
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const weekStart = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

/** The nineteen rivals in your bracket this week, and how far each will climb. */
function field(week: string, league: number) {
  const rng = seeded(hash(`${week}:${league}`));
  const pool = rivals(weekStart(week)).map((r) => r.name);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, BRACKET - 1).map((name) => {
    const skill = rng();
    // Final weekly points: from about 150 to 1000, higher in the higher leagues.
    const final = Math.round((150 + 850 * Math.pow(skill, 1.2)) * (0.8 + 0.12 * league));
    // Some start fast, some finish late.
    const pace = 0.7 + rng() * 0.6;
    return { name, final, pace };
  });
}

/** The bracket at `now`, best first. */
export function bracket(save: SaveData, now = Date.now()): { rows: BracketRow[]; place: number } {
  const o = ordealsOf(save, now);
  const done = Math.min(1, Math.max(0, (now - weekStart(o.week)) / WEEK));
  // Points move on the hour, not every frame.
  const t = Math.floor(done * 168) / 168;
  const rows: BracketRow[] = field(o.week, o.league).map((r) => ({ name: r.name, points: Math.round(r.final * Math.pow(t, r.pace)) }));
  const you: BracketRow = { name: 'Your Sisterhood', points: o.points, you: true };
  rows.push(you);
  rows.sort((a, b) => b.points - a.points || Number(!!b.you) - Number(!!a.you));
  return { rows, place: rows.indexOf(you) + 1 };
}

/** What a place pays in a league. */
export function placeReward(place: number, league: number): Reward {
  const m = 1 + 0.5 * league;
  const r = (gilt: number, seals: number, tithes: number): Reward => ({ gilt: Math.round(gilt * m), seals: Math.round(seals * m), tithes: Math.round(tithes * m) });
  if (place === 1) return r(60, 3, 3000);
  if (place <= RISE) return r(40, 2, 2000);
  if (place <= 10) return r(20, 1, 1200);
  if (place <= BRACKET - FALL) return { gilt: Math.round(10 * m), tithes: Math.round(800 * m) };
  return { tithes: Math.round(400 * m) };
}

/** Judges a finished week: place, reward, and the league you move to. */
function judge(o: OrdealState): OrdealResult {
  const rows = field(o.week, o.league).map((r) => r.final);
  const place = 1 + rows.filter((p) => p > o.points).length;
  let now = o.league;
  if (place <= RISE) now = Math.min(LEAGUES.length - 1, o.league + 1);
  else if (place > BRACKET - FALL) now = Math.max(0, o.league - 1);
  return { week: o.week, league: o.league, place, points: o.points, now, reward: placeReward(place, o.league) };
}

/** This week's state; a new week judges the last one first. */
export function ordealsOf(save: SaveData, now = Date.now()): OrdealState {
  const week = weekKey(now);
  let o = save.ordeals;
  if (!o) o = save.ordeals = { week, league: 0, points: 0, day: dayKey(now), used: 0, wins: 0 };
  if (o.week !== week) {
    // A week you never fought in is not judged: no reward, no fall.
    const last = o.points > 0 ? judge(o) : undefined;
    // An unclaimed older reward is paid now rather than lost.
    if (o.last && !o.last.claimed) grant(save, o.last.reward);
    o.last = last;
    o.league = last ? last.now : o.league;
    o.best = Math.max(o.best ?? 0, o.league);
    o.week = week;
    o.points = 0;
    o.wins = 0;
  }
  if (o.day !== dayKey(now)) {
    o.day = dayKey(now);
    o.used = 0;
  }
  return o;
}

export const ordealsLeft = (save: SaveData, now = Date.now()) => Math.max(0, ORDEALS_PER_DAY - ordealsOf(save, now).used);

export const lastWeekReady = (save: SaveData, now = Date.now()) => {
  const l = ordealsOf(save, now).last;
  return !!l && !l.claimed;
};

export const ordealsReady = (save: SaveData, now = Date.now()) => ordealsLeft(save, now) > 0 || lastWeekReady(save, now);

/** Pays last week's judgement. */
export function claimLastWeek(save: SaveData, now = Date.now()): OrdealResult | undefined {
  const l = ordealsOf(save, now).last;
  if (!l || l.claimed) return undefined;
  l.claimed = true;
  grant(save, l.reward);
  return l;
}

/** The three champions offered for the next Ordeal (fixed until it is fought). */
export function champions(save: SaveData, now = Date.now()): Champion[] {
  const o = ordealsOf(save, now);
  const rng = seeded(hash(`${o.week}:${o.day}:${o.used}:${o.league}`));
  const names = field(o.week, o.league).map((r) => r.name);
  const pick = <T>(a: T[]) => a[Math.floor(rng() * a.length)];
  return (['easy', 'even', 'hard'] as Grade[]).map((grade) => ({ grade, rival: pick(names), title: pick(TITLES), encounter: pick(BOUTS).encounter }));
}

/** The fight: the champion's foes, scaled so their power asks `mult` of the party's. */
export function ordealBattle(save: SaveData, party: string[], c: Champion, rng?: Rng): Battle {
  const bout = BOUTS.find((b) => b.encounter === c.encounter) ?? BOUTS[0];
  const want = (Math.max(1, partyPower(save, party)) * GRADES[c.grade].mult) / CP.recommend;
  let scale = 1;
  // Power is near-linear in scale (Armor is not scaled), so two steps land close.
  for (let i = 0; i < 2; i++) {
    const p = foePower(skirmish(save, [], bout.encounter, 0, undefined, bout.crypt, scale));
    if (p > 0) scale *= want / p;
  }
  return skirmish(save, party, bout.encounter, 0, rng, bout.crypt, Math.max(0.2, scale));
}

/** Records a fought Ordeal. Returns points won. */
export function finishOrdeal(save: SaveData, c: Champion, won: boolean, now = Date.now()): number {
  if (ordealsLeft(save, now) <= 0) return 0;
  const o = ordealsOf(save, now);
  o.used += 1;
  const pts = won ? GRADES[c.grade].points : LOSS_POINTS;
  o.points += pts;
  if (won) {
    o.wins += 1;
    track(save, 'ordealWon', 1, now);
  }
  return pts;
}

/** Time until the week is judged. */
export const weekEnds = (now = Date.now()) => weekStart(weekKey(weekStart(weekKey(now)) + WEEK + 12 * 36e5));
