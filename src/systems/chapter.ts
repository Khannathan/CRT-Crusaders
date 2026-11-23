import type { SaveData } from '../state/save';
import type { Battle } from './combat';
import { earn, giltOf } from './currency';
import type { Rng } from './gacha';
import { BELFRY, skirmish } from './crusade';
import { HUNTS, HUNT_ROUNDS, huntScore, scoreUnit, tierScale, type HuntDef } from './hunts';
import { give, type Bag } from './items';
import { seeded } from './rng';
import { dayKey, grant, rewardText, weekKey, type Reward } from './tasks';

/**
 * The Chapter (round 9): the guild, played offline.
 *
 * WHAT IS SIMULATED. There is no server: the other members are AI Sisters
 * generated from a seed when the Chapter is founded. Each day the game rolls,
 * for each member, whether she was devout that day (her Devotion is the
 * chance), and if so she tithes and strikes the week's Siege beast for damage
 * drawn from her Might. Missed days catch up when the game opens (up to a
 * week). Members' Might grows with the Chapter's level. Nothing goes online.
 *
 * WHAT THE PLAYER DOES.
 * - Tithe once a day (Tithes or Gilt) for Chapter XP and Marks.
 * - Strike the Siege beast SIEGE_STRIKES times a day: a real fight against the
 *   week's beast, scored by damage, like the Hunts.
 * - Claim Siege milestones as the whole Chapter's damage passes them.
 * - Spend Marks in the Chapter shop (weekly stock).
 * Chapter levels lift every Sister's ATK and HP by CHAPTER_PERK a level.
 */
export const MAX_CHAPTER_LEVEL = 10;
export const CHAPTER_PERK = 0.01;
export const SIEGE_STRIKES = 2;
export const MEMBERS = 14;
/** Siege HP in "beast units" (one unit is the beast's own HP at the week's strength). */
export const SIEGE_POOL = 55;

export const chapterXpFor = (level: number) => 800 * level;

export interface Member {
  id: string;
  name: string;
  title: string;
  /** Chance she is active on a day. */
  devotion: number;
  /** Damage per strike, in beast units, at Chapter level 1. */
  might: number;
}

export interface LogLine {
  day: string;
  text: string;
}

export interface SiegeState {
  week: string;
  /** Damage dealt by the whole Chapter. */
  dealt: number;
  /** Damage by member id ('you' for the player). */
  by: Record<string, number>;
  /** Milestone indexes paid. */
  paid: number[];
}

export interface ChapterState {
  name: string;
  seed: number;
  xp: number;
  marks: number;
  /** Day the members were last simulated. */
  simDay: string;
  day: string;
  /** Tithe given today (index into TITHES), if any. */
  tithed?: number;
  strikes: number;
  siege: SiegeState;
  /** Shop purchases this week by offer id. */
  bought: Record<string, number>;
  log: LogLine[];
}

// Latin first names no Sister uses (project files: names/latin-name-library.md), so a Chapter member is never mistaken for one.
const FIRST = ['Agnes', 'Annia', 'Cocceia', 'Crescentia', 'Cyrilla', 'Domnina', 'Euphemia', 'Fannia', 'Galeria', 'Jucunda', 'Margarita', 'Melania', 'Nigrina', 'Ovinia', 'Plancia', 'Pomponia', 'Popillia', 'Prisca', 'Roscia', 'Salvia', 'Scribonia', 'Sempronia'];
/** The members' first names before the Latin rename (2026-11-23), for cleaning old logs. */
const OLD_MEMBER_LINE = new RegExp(`\\b(${['Agathe', 'Odile', 'Maren', 'Ysolde', 'Benedetta', 'Clothilde', 'Ilse', 'Perpetua', 'Sabine', 'Ottilie', 'Hroswitha', 'Lucia', 'Ermengarde', 'Felicitas', 'Gisela', 'Radegund', 'Walburga', 'Scholastica', 'Brunhild', 'Theodora', 'Cunegonde', 'Adelais'].join('|')}) (the |of |Ash|Lamp|Bell|Grave|Thorn|Candle)`);
const EPITHET = ['the Penitent', 'of the Nails', 'Ashhand', 'the Unbowed', 'Lampwright', 'of Seven Sorrows', 'the Quiet', 'Bellrope', 'the Scourged', 'Gravewarden', 'of the Last Psalm', 'Thornveil', 'the Unshriven', 'Candlewick'];
const TITLES = ['Prioress', 'Subprioress', 'Cellaress', 'Sacristan', 'Novice Mistress', 'Sister', 'Sister', 'Sister', 'Sister', 'Sister', 'Sister', 'Novice', 'Novice', 'Novice'];
const CHAPTER_NAMES = ['Chapter of the Weeping Nail', 'Chapter of the Ninth Bell', 'Chapter of Ash and Vigil', 'Chapter of the Drowned Lamp', 'Chapter of the Iron Psalter'];

/** The AI members, the same every time for one seed. */
export function membersOf(seed: number): Member[] {
  const rng = seeded(seed);
  const names = [...FIRST];
  return Array.from({ length: MEMBERS }, (_, i) => {
    const first = names.splice(Math.floor(rng() * names.length), 1)[0];
    const epithet = EPITHET[Math.floor(rng() * EPITHET.length)];
    // Officers are the most devout; novices come and go.
    const devotion = Math.min(0.97, Math.max(0.35, (i < 5 ? 0.85 : i < 11 ? 0.7 : 0.5) + (rng() - 0.5) * 0.2));
    const might = Math.round((0.12 + rng() * 0.25) * (i < 3 ? 1.3 : 1) * 100) / 100;
    return { id: `m${i}`, name: `${first} ${epithet}`, title: TITLES[i], devotion, might };
  });
}

export const TITHES: { name: string; tithes?: number; gilt?: number; xp: number; marks: number }[] = [
  { name: 'A Candle', tithes: 2000, xp: 20, marks: 20 },
  { name: 'A Censer', gilt: 40, xp: 50, marks: 50 },
  { name: 'A Reliquary', gilt: 120, xp: 120, marks: 120 },
];

export const SIEGE_MILESTONES: { at: number; reward: Reward & { marks: number } }[] = [
  { at: 0.1, reward: { marks: 40, tithes: 2000 } },
  { at: 0.25, reward: { marks: 60, items: { unction2: 3 } } },
  { at: 0.5, reward: { marks: 80, seals: 2, items: { iron2: 3 } } },
  { at: 0.75, reward: { marks: 100, gilt: 60, items: { armory1: 8 } } },
  { at: 1, reward: { marks: 150, seals: 5, items: { armory2: 2 } } },
];

export interface ChapterOffer {
  id: string;
  name: string;
  price: number;
  limit: number;
  goods: Reward;
}

export const CHAPTER_SHOP: ChapterOffer[] = [
  { id: 'c-writ', name: '1 Armory Writ', price: 150, limit: 2, goods: { items: { armory2: 1 } } },
  { id: 'c-frag', name: "6 Saint's Fragments", price: 90, limit: 3, goods: { items: { armory1: 6 } } },
  { id: 'c-iron', name: '4 Blessed Iron', price: 70, limit: 3, goods: { items: { iron2: 4 } } },
  { id: 'c-unction', name: '3 Blessed Unction', price: 60, limit: 5, goods: { items: { unction2: 3 } } },
  { id: 'c-writs', name: '3 Writs of Office', price: 90, limit: 3, goods: { items: { writ2: 3 } } },
  { id: 'c-seal', name: '1 Wax Seal', price: 120, limit: 3, goods: { seals: 1 } },
  { id: 'c-ash', name: "1 Saint's Ash", price: 110, limit: 2, goods: { items: { ash3: 1 } } },
];

export const chapterLevel = (xp: number) => {
  let l = 1;
  let need = chapterXpFor(1);
  while (l < MAX_CHAPTER_LEVEL && xp >= need) {
    xp -= need;
    l += 1;
    need = chapterXpFor(l);
  }
  return l;
};

/** XP into the current level, and the level's size. */
export function levelProgress(xp: number): { into: number; need: number } {
  let l = 1;
  while (l < MAX_CHAPTER_LEVEL && xp >= chapterXpFor(l)) xp -= chapterXpFor(l++);
  return { into: xp, need: chapterXpFor(l) };
}

/** The ATK and HP lift for every Sister. */
export const chapterPerk = (save: SaveData) => (save.chapter ? CHAPTER_PERK * chapterLevel(save.chapter.xp) : 0);

const EPOCH = new Date(2026, 0, 5);
/** The week's Siege beast and its strength. */
export function siegeBeast(save: SaveData, now = Date.now()): { hunt: HuntDef; scale: number; pool: number } {
  const [y, m, d] = weekKey(now).split('-').map(Number);
  const weeks = Math.round((new Date(y, m - 1, d).getTime() - EPOCH.getTime()) / (7 * 864e5));
  const hunt = HUNTS[((weeks % HUNTS.length) + HUNTS.length) % HUNTS.length];
  const level = save.chapter ? chapterLevel(save.chapter.xp) : 1;
  const scale = tierScale(1) * (1 + 0.12 * (level - 1));
  return { hunt, scale, pool: Math.round(SIEGE_POOL * scoreUnit(hunt) * scale) };
}

const newSiege = (now: number): SiegeState => ({ week: weekKey(now), dealt: 0, by: {}, paid: [] });

/** Joins (founds) the Chapter: generates its members. */
export function foundChapter(save: SaveData, now = Date.now(), seed = Math.floor(Math.random() * 2 ** 31)): ChapterState {
  const day = dayKey(now);
  save.chapter = { name: CHAPTER_NAMES[seed % CHAPTER_NAMES.length], seed, xp: 0, marks: 0, simDay: day, day, strikes: 0, siege: newSiege(now), bought: {}, log: [{ day, text: 'You took your vows before the Chapter.' }] };
  // The members were already at it before you came: today's work is done.
  simulateDay(save, now);
  return save.chapter;
}

const log = (c: ChapterState, day: string, text: string) => {
  c.log.unshift({ day, text });
  c.log.length = Math.min(c.log.length, 40);
};

/** Milestones reached and not yet paid. */
export function siegeReady(save: SaveData, now = Date.now()): number[] {
  const c = save.chapter;
  if (!c) return [];
  const { pool } = siegeBeast(save, now);
  return SIEGE_MILESTONES.map((m, i) => (c.siege.dealt >= m.at * pool && !c.siege.paid.includes(i) ? i : -1)).filter((i) => i >= 0);
}

/** Pays the reached milestones. */
export function claimSiege(save: SaveData, now = Date.now()): (Reward & { marks: number })[] {
  const c = save.chapter;
  if (!c) return [];
  const out = siegeReady(save, now).map((i) => {
    c.siege.paid.push(i);
    const r = SIEGE_MILESTONES[i].reward;
    grant(save, r);
    c.marks += r.marks;
    return r;
  });
  return out;
}

/** One day of the AI members: tithes and Siege strikes, rolled from the day's seed. */
function simulateDay(save: SaveData, now: number) {
  const c = save.chapter!;
  const day = dayKey(now);
  const rng = seeded((c.seed ^ hashDay(day)) >>> 0);
  const { hunt, scale } = siegeBeast(save, now);
  const unit = scoreUnit(hunt) * scale;
  const lvl = chapterLevel(c.xp);
  let total = 0;
  let came = 0;
  let best: { name: string; dmg: number } | undefined;
  for (const m of membersOf(c.seed)) {
    if (rng() > m.devotion) continue;
    const t = rng() < 0.15 ? 2 : rng() < 0.45 ? 1 : 0;
    c.xp += TITHES[t].xp;
    if (t === 2) log(c, day, `${m.name} gave ${TITHES[t].name.toLowerCase()} to the Chapter.`);
    let dmg = 0;
    for (let s = 0; s < SIEGE_STRIKES; s++) dmg += unit * m.might * (1 + 0.08 * (lvl - 1)) * (0.75 + rng() * 0.5);
    dmg = Math.round(dmg);
    c.siege.dealt += dmg;
    c.siege.by[m.id] = (c.siege.by[m.id] ?? 0) + dmg;
    total += dmg;
    came += 1;
    if (!best || dmg > best.dmg) best = { name: m.name, dmg };
  }
  if (best) log(c, day, `${came} Sisters struck the beast for ${total.toLocaleString('en-US')}. ${best.name} struck hardest (${best.dmg.toLocaleString('en-US')}).`);
}

function hashDay(day: string) {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The Chapter, brought up to date: a new week pays the old Siege's reached
 * milestones and starts the next beast; each missed day (up to seven) is
 * simulated for the members; a new day resets the tithe and strikes.
 */
export function chapterOf(save: SaveData, now = Date.now()): ChapterState | undefined {
  const c = save.chapter;
  if (!c) return undefined;
  // Saves from before the Latin rename: drop log lines naming the old members
  // (some of those names, like Perpetua, now belong to Sisters).
  c.log = c.log.filter((l) => !OLD_MEMBER_LINE.test(l.text));
  const today = dayKey(now);
  if (c.simDay === today) return c;
  // Walk forward a day at a time from the last simulated day.
  const start = new Date(now);
  start.setHours(12, 0, 0, 0);
  const days: number[] = [];
  for (let k = 0; k < 7; k++) {
    const t = start.getTime() - k * 864e5;
    if (dayKey(t) === c.simDay) break;
    days.unshift(t);
  }
  for (const t of days) {
    if (weekKey(t) !== c.siege.week) {
      // Last week's beast: whatever was reached is paid now.
      const paid = claimSiege(save, t - 7 * 864e5);
      if (paid.length) log(c, dayKey(t), `Last week's Siege paid you: ${paid.map(rewardText).join(' + ')}.`);
      c.siege = newSiege(t);
      c.bought = {};
      log(c, dayKey(t), `A new beast besieges the Chapter: ${siegeBeast(save, t).hunt.id.replace(/-/g, ' ')}.`);
    }
    simulateDay(save, t);
  }
  c.simDay = today;
  if (c.day !== today) {
    c.day = today;
    c.tithed = undefined;
    c.strikes = 0;
  }
  return c;
}

export function titheBlock(save: SaveData, i: number): string | undefined {
  const c = save.chapter;
  const t = TITHES[i];
  if (!c || !t) return 'No Chapter';
  if (c.tithed !== undefined) return 'Tithed today';
  if (t.tithes && save.tithes < t.tithes) return 'Not enough Tithes';
  if (t.gilt && giltOf(save) < t.gilt) return 'Not enough Gilt';
  return undefined;
}

export function tithe(save: SaveData, i: number, now = Date.now()): boolean {
  const c = chapterOf(save, now);
  if (!c || titheBlock(save, i)) return false;
  const t = TITHES[i];
  save.tithes -= t.tithes ?? 0;
  if (t.gilt) save.gilt = giltOf(save) - t.gilt;
  c.tithed = i;
  c.xp += t.xp;
  c.marks += t.marks;
  log(c, dayKey(now), `You gave ${t.name.toLowerCase()} to the Chapter (+${t.xp} XP).`);
  return true;
}

export const strikesLeft = (save: SaveData, now = Date.now()) => {
  const c = chapterOf(save, now);
  return c ? Math.max(0, SIEGE_STRIKES - c.strikes) : 0;
};

export function siegeBattle(save: SaveData, party: string[], rng?: Rng, now = Date.now()): Battle {
  const { hunt, scale } = siegeBeast(save, now);
  const b = skirmish(save, party, hunt.encounter, 0, rng, BELFRY, scale);
  b.roundLimit = HUNT_ROUNDS;
  b.vigil = HUNT_ROUNDS + 1;
  return b;
}

/** Records a Siege strike: its damage counts toward the Chapter's total. Returns the damage. */
export function finishSiege(save: SaveData, battle: Battle, now = Date.now()): number {
  const c = chapterOf(save, now);
  if (!c || strikesLeft(save, now) <= 0) return 0;
  const { hunt } = siegeBeast(save, now);
  const dmg = huntScore(battle, hunt);
  c.strikes += 1;
  c.siege.dealt += dmg;
  c.siege.by.you = (c.siege.by.you ?? 0) + dmg;
  log(c, dayKey(now), `You struck the beast for ${dmg.toLocaleString('en-US')}.`);
  return dmg;
}

/** The week's damage table, best first, with you in it. */
export function siegeTable(save: SaveData): { id: string; name: string; dealt: number }[] {
  const c = save.chapter;
  if (!c) return [];
  const rows = membersOf(c.seed).map((m) => ({ id: m.id, name: m.name, dealt: c.siege.by[m.id] ?? 0 }));
  rows.push({ id: 'you', name: 'You', dealt: c.siege.by.you ?? 0 });
  return rows.sort((a, b) => b.dealt - a.dealt);
}

export const boughtOf = (save: SaveData, id: string) => save.chapter?.bought[id] ?? 0;

export function buyChapter(save: SaveData, id: string, now = Date.now()): boolean {
  const c = chapterOf(save, now);
  const o = CHAPTER_SHOP.find((x) => x.id === id);
  if (!c || !o || c.marks < o.price || boughtOf(save, id) >= o.limit) return false;
  c.marks -= o.price;
  c.bought[id] = (c.bought[id] ?? 0) + 1;
  save.seals += o.goods.seals ?? 0;
  save.tithes += o.goods.tithes ?? 0;
  if (o.goods.items) give(save, o.goods.items as Bag);
  earn(save, o.goods.gilt ?? 0);
  return true;
}

/** Something to do in the Chapter today. */
export const chapterReady = (save: SaveData, now = Date.now()) => {
  const c = chapterOf(save, now);
  if (!c) return true;
  return c.tithed === undefined || strikesLeft(save, now) > 0 || siegeReady(save, now).length > 0;
};
