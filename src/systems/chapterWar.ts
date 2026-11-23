import type { SaveData } from '../state/save';
import type { Battle } from './combat';
import { CRYPTS, skirmish, type CryptDef } from './crusade';
import type { Rng } from './gacha';
import { accountPower } from './power';
import { scaleToPower } from './raid';
import { seeded } from './rng';
import { chapterLevel, chapterOf } from './chapter';
import { dayKey, grant, weekKey, type Reward } from './tasks';

/**
 * Chapter War: each week your Chapter goes to war with a rival Chapter.
 *
 * WHAT IS SIMULATED. There is no server. The rival Chapter and its six forts
 * are built from the week and your Chapter's seed. Each day, your Chapter's
 * AI members win some war points and the rival's members win some: both are
 * rolled from the day's seed, so they never change once rolled, and days away
 * count when you come back.
 *
 * WHAT THE PLAYER DOES. Storm the rival's forts, WAR_ATTACKS times a day. A
 * fort's defense team is set against your strongest four's Power as it stood
 * when the war began, from the Gatehouse (easy) to the Stronghold (its
 * commander, a boss). A win earns stars: 3 if no Sister fell, 2 if one fell,
 * 1 otherwise. Each fort keeps its best; each new star pays at once and is
 * worth STAR_POINTS war points. At week's end the side with more points wins.
 */
export const WAR_ATTACKS = 2;
export const STAR_POINTS = 3;
export const FORTS = ['Gatehouse', 'Bell Ward', 'Ossuary', 'Cloister', 'Scriptorium', 'Stronghold'];
/** Each fort asks this share of your strongest four's Power. */
export const FORT_SHARE = [0.9, 1.15, 1.4, 1.65, 1.95, 2.3];
export const STAR_REWARD: Reward & { marks: number } = { tithes: 1200, marks: 15 };
export const WAR_WIN: Reward & { marks: number } = { seals: 8, gilt: 40, marks: 200 };
export const WAR_LOSS: Reward & { marks: number } = { seals: 2, marks: 60 };

const RIVALS = ['Chapter of the Red Rosary', 'Chapter of the Hollow Choir', 'Chapter of the Black Lantern', 'Chapter of the Salt Vigil', 'Chapter of the Broken Censer', 'Chapter of the Seventh Wound'];

export interface WarState {
  week: string;
  day: string;
  attacks: number;
  /** Your strongest four's Power when the war began: the forts are set by it. */
  base: number;
  /** Best stars won at each fort. */
  stars: number[];
  /** Last week's result, shown once. */
  last?: { won: boolean; us: number; them: number };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const seedOf = (save: SaveData, week: string) => ((save.chapter?.seed ?? 0) ^ hash(week)) >>> 0;

export const rivalName = (save: SaveData, now = Date.now()) => RIVALS[seedOf(save, weekKey(now)) % RIVALS.length];

/** Days of the war week so far, today included (1 on Monday, 7 on Sunday). */
const daysIn = (now: number) => ((new Date(now).getDay() + 6) % 7) + 1;

/** War points the AI on each side has won over the first `days` days of a week. */
export function aiPoints(save: SaveData, week: string, days: number): { us: number; them: number } {
  const lvl = save.chapter ? chapterLevel(save.chapter.xp) : 1;
  let us = 0;
  let them = 0;
  for (let d = 0; d < days; d++) {
    const rng = seeded((seedOf(save, week) ^ Math.imul(d + 1, 2654435761)) >>> 0);
    us += 3 + Math.floor(rng() * 6) + Math.floor(lvl / 3);
    them += 7 + Math.floor(rng() * 6);
  }
  return { us, them };
}

const totalStars = (w: WarState) => w.stars.reduce((a, b) => a + b, 0);

/** The war score so far. */
export function warScore(save: SaveData, now = Date.now()) {
  const w = warOf(save, now);
  if (!w) return { us: 0, them: 0 };
  const ai = aiPoints(save, w.week, daysIn(now));
  return { us: ai.us + totalStars(w) * STAR_POINTS, them: ai.them };
}

const fresh = (save: SaveData, now: number): WarState => ({ week: weekKey(now), day: dayKey(now), attacks: 0, base: Math.max(2000, accountPower(save)), stars: FORTS.map(() => 0) });

/** The war, brought up to date: a new week settles the old war and declares the next. */
export function warOf(save: SaveData, now = Date.now()): WarState | undefined {
  const c = chapterOf(save, now);
  if (!c) return undefined;
  let w = save.war;
  if (!w) w = save.war = fresh(save, now);
  if (w.week !== weekKey(now)) {
    const ai = aiPoints(save, w.week, 7);
    const us = ai.us + totalStars(w) * STAR_POINTS;
    const won = us > ai.them;
    const r = won ? WAR_WIN : WAR_LOSS;
    grant(save, r);
    c.marks += r.marks;
    w = save.war = { ...fresh(save, now), last: { won, us, them: ai.them } };
  }
  if (w.day !== dayKey(now)) {
    w.day = dayKey(now);
    w.attacks = 0;
  }
  return w;
}

export const attacksLeft = (save: SaveData, now = Date.now()) => {
  const w = warOf(save, now);
  return w ? Math.max(0, WAR_ATTACKS - w.attacks) : 0;
};

export function fortTarget(save: SaveData, fort: number, now = Date.now()) {
  const w = warOf(save, now);
  return Math.round((w?.base ?? 2000) * FORT_SHARE[fort]);
}

/** The fort's garrison: a crypt and an encounter from it, set by the week. */
export function fortGarrison(save: SaveData, fort: number, now = Date.now()): { crypt: CryptDef; encounter: string } {
  const h = seedOf(save, weekKey(now));
  const crypt = CRYPTS[(h + fort * 5) % CRYPTS.length];
  const pick = (a: string[]) => (a.length ? a[(h >>> fort) % a.length] : crypt.boss);
  const encounter = fort === FORTS.length - 1 ? crypt.boss : fort >= 3 ? pick(crypt.elites) : pick(crypt.late);
  return { crypt, encounter };
}

export function warBattle(save: SaveData, party: string[], fort: number, rng?: Rng, now = Date.now()): Battle {
  const { crypt, encounter } = fortGarrison(save, fort, now);
  return skirmish(save, party, encounter, 0, rng, { ...crypt, power: 1 }, scaleToPower(crypt, fortTarget(save, fort, now), encounter));
}

/** Stars for a fight: 3 if no Sister fell, 2 if one fell, 1 otherwise, 0 for a loss. */
export function starsFor(outcome: 'victory' | 'defeat', battle: Battle) {
  if (outcome !== 'victory') return 0;
  const fell = battle.units.filter((u) => u.side === 'party' && u.hp <= 0).length;
  return fell === 0 ? 3 : fell === 1 ? 2 : 1;
}

/** After a storm: spends the attack, keeps the fort's best, pays new stars. */
export function finishStorm(save: SaveData, fort: number, stars: number, now = Date.now()): { stars: number; gained: number } {
  const w = warOf(save, now);
  if (!w || attacksLeft(save, now) <= 0) return { stars: 0, gained: 0 };
  w.attacks++;
  const gained = Math.max(0, stars - w.stars[fort]);
  if (gained) {
    w.stars[fort] = stars;
    grant(save, { tithes: (STAR_REWARD.tithes ?? 0) * gained });
    save.chapter!.marks += STAR_REWARD.marks * gained;
  }
  return { stars, gained };
}

export const warReady = (save: SaveData, now = Date.now()) => !!save.chapter && attacksLeft(save, now) > 0 && totalStars(warOf(save, now)!) < FORTS.length * 3;
