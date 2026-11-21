import { CLASSES } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { ORDER_LIST } from '../data/orders';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';
import type { Battle } from './combat';

/**
 * Sister bonds (Confession). Fighting beside a Sister, keeping Vigil with her
 * and lighting candles for her raise her bond. Each bond level adds a little
 * ATK and HP and opens one more of her five confessions. Candles cost Tithes;
 * there is no limit and no new currency.
 */
export interface BondState {
  xp: number;
  /** Confessions read (highest level heard). */
  heard: number;
}

export const MAX_BOND = 5;
/** Total bond XP needed for each level, 1 to 5. */
export const BOND_AT = [60, 180, 400, 750, 1250];
/** ATK and HP per bond level. */
export const BOND_STAT = 0.02;

export const BOND_XP = { fight: 4, elite: 6, boss: 10, challenge: 6, vigilHour: 2, candle: 25 };

export const bondsOf = (save: SaveData) => (save.bonds ??= {});
export const bondOf = (save: SaveData, id: string): BondState => bondsOf(save)[id] ?? { xp: 0, heard: 0 };

export function bondLevel(xp: number) {
  let lv = 0;
  while (lv < MAX_BOND && xp >= BOND_AT[lv]) lv++;
  return lv;
}

export function bondInfo(save: SaveData, id: string) {
  const b = bondOf(save, id);
  const level = bondLevel(b.xp);
  const from = level ? BOND_AT[level - 1] : 0;
  const to = level < MAX_BOND ? BOND_AT[level] : from;
  return { level, xp: b.xp, into: b.xp - from, need: to - from, max: level >= MAX_BOND, unheard: level > b.heard };
}

/** Stat multiplier from bond (1.0 to 1.1). */
export const bondMult = (save: SaveData, id: string) => 1 + BOND_STAT * bondLevel(bondOf(save, id).xp);

/** Adds bond XP to each owned Sister listed. Returns those who reached a new level. */
export function addBond(save: SaveData, ids: string[], xp: number): string[] {
  const up: string[] = [];
  if (xp <= 0) return up;
  const all = bondsOf(save);
  for (const id of new Set(ids)) {
    if (!save.owned[id]) continue;
    const b = (all[id] ??= { xp: 0, heard: 0 });
    const before = bondLevel(b.xp);
    b.xp = Math.min(BOND_AT[MAX_BOND - 1], b.xp + xp);
    if (bondLevel(b.xp) > before) up.push(id);
  }
  return up;
}

/** After a won side-mode fight: every Sister who fought draws closer. */
export function bondBattle(save: SaveData, battle: Battle) {
  if (battle.outcome() !== 'victory') return [];
  return addBond(save, battle.units.filter((u) => u.side === 'party').map((u) => u.ref), BOND_XP.challenge);
}

export const candleCost = (save: SaveData, id: string) => 80 * (bondLevel(bondOf(save, id).xp) + 1);

/** Lights a candle for her: Tithes for bond XP. False if maxed or too poor. */
export function offerCandle(save: SaveData, id: string): boolean {
  const cost = candleCost(save, id);
  if (!save.owned[id] || bondInfo(save, id).max || save.tithes < cost) return false;
  save.tithes -= cost;
  addBond(save, [id], BOND_XP.candle);
  return true;
}

/** Marks her confessions up to her bond level as heard. */
export function hear(save: SaveData, id: string) {
  const all = bondsOf(save);
  const b = (all[id] ??= { xp: 0, heard: 0 });
  b.heard = Math.max(b.heard, bondLevel(b.xp));
}

export const anyUnheard = (save: SaveData) => Object.keys(save.owned).some((id) => bondInfo(save, id).unheard);

export interface Confession {
  title: string;
  body: string;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** What each combat class carries into the confessional. */
const CLASS_SIN: Record<string, string> = {
  warsister: 'She shows you the scars beneath her hairshirt, one for every Sister she could not shield. "I count them when I cannot sleep. The count is never finished."',
  hierophant: 'She sets her relic on the sill between you. "It is heavier every year. I think it is the prayers. I think they are not all mine."',
  inquisitor: 'She speaks of the first heretic she ever judged. "He wept and named his children. I did not stop. I tell myself the Lord would not have stopped either."',
  confessor: 'She laughs, low and tired. "I hear a hundred sins a week. No one asks who hears mine. So I came to you."',
  censer: 'Smoke still clings to her habit. "The fire is clean," she says. "That is what they told me. They did not tell me it remembers."',
  oracle: 'Her eyes stay closed throughout. "I have seen how I die. It is not in the crypts. I will not tell you where, only that you were not there."',
};

/** Her five confessions, one per bond level. Placeholder voice until the name library and lore arrive. */
export function confessions(c: CrusaderDef): Confession[] {
  const first = c.name.split(' ')[0];
  const order = ORDER_LIST.find((o) => o.name === c.order);
  const joined = Math.max(7, Math.min(c.age - 6, 6 + (c.age % 9)));
  const cls = CLASSES[c.classId]?.name ?? c.title ?? 'Sister';
  return [
    {
      title: 'The Grate',
      body: `${first} kneels at the grate and says nothing for a long while. Then, barely a breath: "${order?.creed ?? 'We endure.'}" It is the creed of the ${c.order}. She says it as if it might still save her.`,
    },
    {
      title: 'The Burden',
      body: `She speaks of it at last: ${lower(c.hook)} "Do not tell the Prioress," she whispers. "She would call it pride. I call it the only thing I have kept."`,
    },
    {
      title: `The ${cls}`,
      body: CLASS_SIN[c.classId] ?? `She speaks of her calling as a ${cls}, and of what it has cost.`,
    },
    {
      title: 'The Order',
      body: `"The ${c.order} took me when I was ${joined}," she says. ${order?.lore ?? ''} She does not say whether she was grateful. You do not ask.`,
    },
    {
      title: 'Absolution',
      body: `${first} asks for no absolution. She asks only that you remember her name when the candles go out. You promise. When she rises, she does not kneel to you. She takes your hand, as a Sister would.`,
    },
  ];
}

export const sisterDef = (id: string) => CRUSADERS.find((c) => c.id === id);
