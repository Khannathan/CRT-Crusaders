import type { SaveData } from '../state/save';
import { setHomecoming } from './boosts';
import { send } from './missives';

/**
 * Welcome back: a player away AWAY_DAYS or more finds a gift in Missives
 * (bigger the longer the absence, capped) and a Homecoming week of boosted
 * Vigil gathering and battle EXP, so a lapsed player catches up fast.
 */
export const AWAY_DAYS = 3;
export const HOMECOMING_DAYS = 7;
const DAY = 864e5;

export interface WelcomeState {
  /** Last time the game was opened or the Sanctum shown (ms). */
  seen: number;
  /** Homecoming boosts run until this time (ms). */
  homecoming?: number;
}

/** The gift for `days` away. */
export function welcomeGift(days: number) {
  const d = Math.min(14, Math.floor(days));
  return { seals: Math.min(10, 2 + d), tithes: 1000 * d, items: { unction2: 2 * d, ash2: d, page2: d } };
}

/** Call when the game opens and when the Sanctum shows. Returns the days away when a welcome was given. */
export function checkReturn(save: SaveData, now = Date.now()): number | undefined {
  const w = save.welcome;
  let given: number | undefined;
  if (w && now - w.seen >= AWAY_DAYS * DAY && Object.keys(save.owned).length) {
    const days = Math.floor((now - w.seen) / DAY);
    send(save, { from: 'The Abbess', title: 'Welcome home, crusader!', body: `${days} days without you! The dead grew bold. Take this, rest one breath, and march. A Homecoming week now doubles your Vigil and quickens your Sisters!`, reward: welcomeGift(days) }, now);
    w.homecoming = now + HOMECOMING_DAYS * DAY;
    given = days;
  }
  save.welcome = { ...(w ?? {}), seen: now };
  setHomecoming(save.welcome.homecoming);
  return given;
}

export const homecomingLeft = (save: SaveData, now = Date.now()) => Math.max(0, (save.welcome?.homecoming ?? 0) - now);
