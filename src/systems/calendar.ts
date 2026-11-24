import { featuredArms } from './armory';
import { BOOST_INFO, DAY_FEAST, WEEK_BOOSTS } from './boosts';
import { feastName } from './feast';
import { rotation } from './inquisition';
import { LIMITED_BANNERS, limitedWindow, windowAt } from './limited';
import { seasonAt } from './pass';
import { weekKey } from './tasks';

/**
 * The Calendar: what the next weeks hold, so a player can plan and save Seals
 * for a Saint. Everything here is already fixed by the date (banners, Feasts,
 * Inquisition rotations, Pass seasons, weekly resets), so it is computed, not stored.
 */

export type EventKind = 'saint' | 'feast' | 'inquisition' | 'pass' | 'weekly';

export interface CalEvent {
  kind: EventKind;
  title: string;
  sub: string;
  /** When it begins (ms); 0 for something already running. */
  at: number;
  /** When it ends (ms), if it does. */
  ends?: number;
  /** Already running when the week began. */
  running?: boolean;
}

export interface CalWeek {
  starts: number;
  ends: number;
  events: CalEvent[];
}

const DAY = 864e5;
const mondayOf = (now: number) => {
  const [y, m, d] = weekKey(now).split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};
const addDays = (t: number, n: number) => {
  const d = new Date(t);
  d.setDate(d.getDate() + n);
  return d.getTime();
};

/** "Mon 30 Nov". */
export const shortDate = (t: number) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** The coming `weeks` weeks, this one first, each with what begins (or runs) in it. */
export function calendar(now = Date.now(), weeks = 4): CalWeek[] {
  const out: CalWeek[] = [];
  const firstWin = limitedWindow(now).index;
  for (let w = 0; w < weeks; w++) {
    const starts = addDays(mondayOf(now), 7 * w);
    const ends = addDays(starts, 7);
    const events: CalEvent[] = [];
    const inWeek = (t: number) => t >= starts && t < ends;
    // Limited Saints and their Feasts (one window every LIMITED_DAYS).
    for (let i = firstWin; i < firstWin + 1 + weeks; i++) {
      const win = windowAt(i);
      const repeat = i > 0 && windowAt(i - 1).slot === win.slot;
      const first = win.saint.name.split(' ')[0];
      if (inWeek(win.starts) && !repeat) {
        events.push({ kind: 'saint', title: `Limited Saint: ${win.saint.name}`, sub: `With ${win.ssrs.map((s) => s.name.split(' ')[0]).join(' and ')}. Save your Seals for her!`, at: win.starts, ends: win.ends });
        events.push({ kind: 'feast', title: feastName(win), sub: 'Candles, a stall, and gifts for the faithful.', at: win.starts, ends: win.ends });
      } else if (w === 0 && win.starts < starts && win.ends > starts) {
        events.push({ kind: 'saint', title: `Limited Saint: ${win.saint.name}`, sub: `${first}'s banner and Feast run on.`, at: win.starts, ends: win.ends, running: true });
      }
    }
    // Inquisition rotations turn every two weeks.
    for (let d = 0; d < 7; d++) {
      const day = addDays(starts, d);
      const prev = rotation(addDays(day, -1));
      const rot = rotation(day);
      if (rot.index !== prev.index || (w === 0 && d === 0)) {
        const begins = addDays(rot.ends, -14);
        events.push({ kind: 'inquisition', title: `Inquisition: ${rot.edict.name}`, sub: `Featured Orders: ${rot.featured.join(' and ')}.`, at: begins, ends: rot.ends, running: begins < starts });
      }
    }
    // Pilgrim's Pass seasons.
    const season = seasonAt(starts);
    if (w === 0) events.push({ kind: 'pass', title: season.name, sub: "The Pilgrim's Pass season.", at: season.starts, ends: season.ends, running: season.starts < starts });
    const next = seasonAt(season.ends);
    if (inWeek(next.starts)) events.push({ kind: 'pass', title: `New season: ${next.name}`, sub: 'Unclaimed tiers go to your Missives. Claim them before!', at: next.starts, ends: next.ends });
    // Every Monday: the weekly turn.
    events.push({ kind: 'weekly', title: 'The week turns', sub: `Ordeals judged, new Raid bosses, Armory: ${featuredArms(starts + DAY / 2).arms.name}.`, at: starts, ends });
    events.sort((a, b) => Number(!!b.running) - Number(!!a.running) || a.at - b.at);
    out.push({ starts, ends, events });
  }
  return out;
}

/** This week's daily blessings, Monday first. */
export function blessingsWeek(now = Date.now()) {
  const monday = mondayOf(now);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    const dow = new Date(day).getDay();
    return { day, feast: DAY_FEAST[dow], boosts: WEEK_BOOSTS[dow].map((b) => `+${Math.round(b.pct * 100)}% ${BOOST_INFO[b.kind].name}`) };
  });
}

/** The next limited Saint, for the Sanctum's plaque. */
export function nextSaint(now = Date.now()) {
  const cur = limitedWindow(now);
  for (let i = cur.index + 1; i <= cur.index + LIMITED_BANNERS.length; i++) {
    const w = windowAt(i);
    if (w.slot !== cur.slot) return w;
  }
  return undefined;
}
