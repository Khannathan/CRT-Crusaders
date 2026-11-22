import type { Rarity } from '../data/types';
import { ALMS_FOR_GEAR, earn } from './currency';
import type { SaveData } from '../state/save';
import type { Rng } from './gacha';
import { track } from './tasks';
import { bagText, hasAll, spend, type Bag } from './items';

/**
 * Gear: three slots per Sister. Each piece has a rarity, a main stat that grows
 * when enhanced (Tithes to +10, then Blessed Iron too, up to +15), 0-3
 * substats (one per rarity step above R) that Blessed Iron can reroll, and a
 * set: two or three pieces of one set on a Sister add a bonus.
 */
export type GearSlot = 'blade' | 'habit' | 'rosary';
export type GearStat = 'atkPct' | 'hpPct' | 'armorPct' | 'crit' | 'spd';

export interface GearSub {
  stat: GearStat;
  value: number;
}

export interface GearItem {
  /** Unique in the save; '' while it is still unclaimed loot in a run. */
  uid: string;
  slot: GearSlot;
  rarity: Rarity;
  name: string;
  /** Enhance level, 0 to MAX_REFINE. */
  level: number;
  main: GearStat;
  subs: GearSub[];
  /** Sister id wearing it. */
  on?: string;
  /** Older pieces and the starter set have none. */
  set?: GearSetId;
}

export const GEAR_SLOTS: GearSlot[] = ['blade', 'habit', 'rosary'];
export const SLOT_NAME: Record<GearSlot, string> = { blade: 'Blade', habit: 'Habit', rosary: 'Rosary' };
export const SLOT_HINT: Record<GearSlot, string> = { blade: 'Attack', habit: 'HP or Armor', rosary: 'Crit, Speed or Attack' };
export const STAT_NAME: Record<GearStat, string> = { atkPct: 'ATK', hpPct: 'HP', armorPct: 'ARM', crit: 'CRIT', spd: 'SPD' };

/** Tithes alone take a piece this far. */
export const MAX_GEAR_LEVEL = 10;
/** Refinement past +10 needs Blessed Iron as well. */
export const MAX_REFINE = 15;
/** Iron for each level past +10: index 0 is the step to +11. */
export const REFINE_IRON: Bag[] = [{ iron1: 10 }, { iron1: 15 }, { iron2: 4 }, { iron2: 6 }, { iron2: 6, iron3: 2 }];
/** Rerolling a piece's substats. */
export const REROLL_COST = { items: { iron2: 2 } as Bag, tithes: 300 };
/** Pieces kept in the armory. Loot beyond this is melted down for Tithes. */
export const MAX_GEAR = 60;

const GEAR_RARITY_MULT: Record<Rarity, number> = { R: 1, SR: 1.25, SSR: 1.5, UR: 1.8 };
const SUB_COUNT: Record<Rarity, number> = { R: 0, SR: 1, SSR: 2, UR: 3 };
/** Main stat at +0 for an R piece. */
const MAIN_BASE: Record<GearStat, number> = { atkPct: 0.08, hpPct: 0.08, armorPct: 0.1, crit: 0.05, spd: 1 };
/** One substat roll. */
const SUB_BASE: Record<GearStat, number> = { atkPct: 0.03, hpPct: 0.03, armorPct: 0.04, crit: 0.03, spd: 1 };
const MAIN_CHOICES: Record<GearSlot, GearStat[]> = { blade: ['atkPct'], habit: ['hpPct', 'armorPct'], rosary: ['crit', 'spd', 'atkPct'] };
/** Enhancing to these levels improves a random substat. */
export const SUB_UPGRADE_LEVELS = [3, 6, 9, 12, 15];

const PREFIX: Record<Rarity, string[]> = {
  R: ['Worn', 'Pilgrim', 'Penitent', 'Tarnished'],
  SR: ['Blessed', 'Anointed', 'Vigilant', 'Sworn'],
  SSR: ['Sainted', 'Inquisitorial', 'Consecrated', 'Wrathful'],
  UR: ["Martyr's", 'Seraphic', 'Apocalyptic', 'Most Holy'],
};
const NOUN: Record<GearSlot, string[]> = {
  blade: ['Flail', 'Mace', 'Censer-Hammer', 'Scourge', 'Longsword', 'Bone Saw', 'Glaive'],
  habit: ['Habit', 'Hairshirt', 'Cuirass', 'Chainmail', 'Shroud', 'Tabard'],
  rosary: ['Rosary', 'Reliquary', 'Prayer Beads', 'Censer', 'Holy Icon', 'Fingerbone'],
};

const pick = <T>(rng: Rng, xs: T[]) => xs[Math.floor(rng() * xs.length) % xs.length];
const round = (stat: GearStat, n: number) => (stat === 'spd' ? Math.round(n) : Math.round(n * 1000) / 1000);

export function mainValue(item: Pick<GearItem, 'main' | 'rarity' | 'level'>): number {
  return round(item.main, MAIN_BASE[item.main] * GEAR_RARITY_MULT[item.rarity] * (1 + 0.1 * Math.min(item.level, MAX_GEAR_LEVEL) + 0.15 * Math.max(0, item.level - MAX_GEAR_LEVEL)));
}

export function makeGear(rng: Rng, rarity: Rarity, slot: GearSlot = pick(rng, GEAR_SLOTS)): GearItem {
  const main = pick(rng, MAIN_CHOICES[slot]);
  const pool = (Object.keys(SUB_BASE) as GearStat[]).filter((s) => s !== main);
  const subs: GearSub[] = [];
  for (let i = 0; i < SUB_COUNT[rarity]; i++) {
    const stat = pool.splice(Math.floor(rng() * pool.length) % pool.length, 1)[0];
    subs.push({ stat, value: SUB_BASE[stat] });
  }
  const name = `${pick(rng, PREFIX[rarity])} ${pick(rng, NOUN[slot])}`;
  return { uid: '', slot, rarity, name, level: 0, main, subs, set: pick(rng, GEAR_SETS).id };
}

/** Rarity of a dropped piece. `luck` (0-1) shifts the odds upward: elites, bosses and Heresy add to it. */
export function rollGearRarity(rng: Rng, luck = 0): Rarity {
  const r = rng();
  if (r < 0.02 + luck * 0.25) return 'UR';
  if (r < 0.12 + luck) return 'SSR';
  if (r < 0.45 + luck * 1.5) return 'SR';
  return 'R';
}

export const enhanceCost = (item: GearItem) => Math.round(25 * (item.level + 1) * GEAR_RARITY_MULT[item.rarity]);
export const salvageValue = (item: GearItem) => Math.round(15 * GEAR_RARITY_MULT[item.rarity] * (1 + item.level));

/** Blessed Iron for the next level, past +10. */
export const refineIron = (item: GearItem): Bag | undefined => (item.level >= MAX_GEAR_LEVEL ? REFINE_IRON[item.level - MAX_GEAR_LEVEL] : undefined);

/** Why the piece cannot be enhanced now, or undefined. */
export function enhanceBlock(save: SaveData, item: GearItem): string | undefined {
  if (item.level >= MAX_REFINE) return 'Fully refined';
  const iron = refineIron(item);
  if (iron && !hasAll(save, iron)) return 'Not enough Blessed Iron';
  if (save.tithes < enhanceCost(item)) return 'Not enough Tithes';
  return undefined;
}

/** Spends Tithes (and Blessed Iron past +10) to raise a piece one level. Returns false if it can't. */
export function enhance(save: SaveData, item: GearItem, rng: Rng = Math.random): boolean {
  if (enhanceBlock(save, item)) return false;
  const iron = refineIron(item);
  if (iron) spend(save, iron);
  save.tithes -= enhanceCost(item);
  item.level += 1;
  track(save, 'enhance');
  if (SUB_UPGRADE_LEVELS.includes(item.level) && item.subs.length) {
    const sub = pick(rng, item.subs);
    sub.value = round(sub.stat, sub.value + SUB_BASE[sub.stat]);
  }
  return true;
}

export function rerollBlock(save: SaveData, item: GearItem): string | undefined {
  if (!item.subs.length) return 'No substats';
  if (!hasAll(save, REROLL_COST.items)) return 'Not enough Blessed Iron';
  if (save.tithes < REROLL_COST.tithes) return 'Not enough Tithes';
  return undefined;
}

/**
 * New stats for every substat, keeping how many times each was rolled: a sub
 * upgraded twice stays three rolls strong, of whatever stat it becomes.
 */
export function rerollSubs(save: SaveData, item: GearItem, rng: Rng = Math.random): boolean {
  if (rerollBlock(save, item)) return false;
  spend(save, REROLL_COST.items);
  save.tithes -= REROLL_COST.tithes;
  const pool = (Object.keys(SUB_BASE) as GearStat[]).filter((st) => st !== item.main);
  item.subs = item.subs.map((sub) => {
    const rolls = Math.max(1, Math.round(sub.value / SUB_BASE[sub.stat]));
    const stat = pool.splice(Math.floor(rng() * pool.length) % pool.length, 1)[0];
    return { stat, value: round(stat, SUB_BASE[stat] * rolls) };
  });
  return true;
}

export const ironText = (bag: Bag | undefined) => bagText(bag);

export const gearOf = (save: SaveData) => (save.gear ??= []);
export const equipped = (save: SaveData, sisterId: string) => gearOf(save).filter((g) => g.on === sisterId);

/** Puts a piece on a Sister, taking off whatever she had in that slot. */
export function equip(save: SaveData, sisterId: string, uid: string) {
  const item = gearOf(save).find((g) => g.uid === uid);
  if (!item) return;
  for (const g of equipped(save, sisterId)) if (g.slot === item.slot) g.on = undefined;
  item.on = sisterId;
}

export function unequip(save: SaveData, uid: string) {
  const item = gearOf(save).find((g) => g.uid === uid);
  if (item) item.on = undefined;
}

export function salvage(save: SaveData, uid: string): number {
  const list = gearOf(save);
  const i = list.findIndex((g) => g.uid === uid);
  if (i < 0) return 0;
  const value = salvageValue(list[i]);
  const [piece] = list.splice(i, 1);
  save.tithes += value;
  earn(save, 0, ALMS_FOR_GEAR[piece.rarity]);
  return value;
}

/** Moves loot into the armory. Pieces past MAX_GEAR are melted for Tithes. Returns the Tithes paid. */
export function claimGear(save: SaveData, loot: GearItem[]): number {
  const list = gearOf(save);
  let melted = 0;
  for (const item of loot) {
    if (list.length >= MAX_GEAR) {
      melted += salvageValue(item);
      continue;
    }
    save.nextGearId = (save.nextGearId ?? 0) + 1;
    list.push({ ...item, uid: `g${save.nextGearId}`, on: undefined });
  }
  save.tithes += melted;
  return melted;
}

export interface GearBonus {
  atkPct: number;
  hpPct: number;
  armorPct: number;
  crit: number;
  spd: number;
}

export function gearBonus(items: GearItem[]): GearBonus {
  const b: GearBonus = { atkPct: 0, hpPct: 0, armorPct: 0, crit: 0, spd: 0 };
  for (const g of items) {
    b[g.main] += mainValue(g);
    for (const s of g.subs) b[s.stat] += s.value;
  }
  for (const { set, count } of setsWorn(items)) {
    const add = (bonus: Partial<GearBonus>) => (Object.entries(bonus) as [GearStat, number][]).forEach(([k, v]) => (b[k] += v));
    if (count >= 2) add(set.two);
    if (count >= 3) add(set.three);
  }
  return b;
}

// ---- Sets ----------------------------------------------------------------

export type GearSetId = 'flagellant' | 'cloister' | 'pilgrim' | 'inquisitor';

export interface GearSet {
  id: GearSetId;
  name: string;
  /** Two pieces worn. */
  two: Partial<GearBonus>;
  /** All three pieces worn, on top of the two-piece bonus. */
  three: Partial<GearBonus>;
  color: number;
}

export const GEAR_SETS: GearSet[] = [
  { id: 'flagellant', name: 'Flagellant', two: { atkPct: 0.08 }, three: { crit: 0.1 }, color: 0xd36a5c },
  { id: 'cloister', name: 'Cloister', two: { hpPct: 0.1 }, three: { armorPct: 0.15 }, color: 0x9aa7b4 },
  { id: 'pilgrim', name: 'Pilgrim', two: { spd: 2 }, three: { atkPct: 0.06, hpPct: 0.06 }, color: 0x8fc07a },
  { id: 'inquisitor', name: 'Inquisitor', two: { crit: 0.06 }, three: { atkPct: 0.12 }, color: 0xb592c8 },
];

export const gearSet = (id: GearSetId | undefined) => GEAR_SETS.find((x) => x.id === id);

/** Sets among the pieces worn, with how many of each. */
export function setsWorn(items: GearItem[]): { set: GearSet; count: number }[] {
  return GEAR_SETS.map((set) => ({ set, count: items.filter((g) => g.set === set.id).length })).filter((x) => x.count > 0);
}

const bonusText = (b: Partial<GearBonus>) => (Object.entries(b) as [GearStat, number][]).map(([k, v]) => formatStat(k, v)).join(' ');

/** "2: +8% ATK · 3: +10% CRIT". */
export const setText = (set: GearSet) => `2: ${bonusText(set.two)} · 3: ${bonusText(set.three)}`;

export const formatStat = (stat: GearStat, v: number) => (stat === 'spd' ? `+${Math.round(v)} ${STAT_NAME[stat]}` : `+${Math.round(v * 100)}% ${STAT_NAME[stat]}`);

/** Every new save starts with a worn set, so the gear page is never empty. */
export function starterGear(): GearItem[] {
  return [
    { uid: 'g-start-1', slot: 'blade', rarity: 'R', name: 'Worn Flail', level: 0, main: 'atkPct', subs: [] },
    { uid: 'g-start-2', slot: 'habit', rarity: 'R', name: 'Worn Hairshirt', level: 0, main: 'hpPct', subs: [] },
    { uid: 'g-start-3', slot: 'rosary', rarity: 'R', name: 'Worn Rosary', level: 0, main: 'crit', subs: [] },
  ];
}
