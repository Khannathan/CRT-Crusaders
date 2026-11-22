import type { Rarity } from '../data/types';
import { ALMS_FOR_GEAR, earn } from './currency';
import type { SaveData } from '../state/save';
import type { Rng } from './gacha';
import { track } from './tasks';

/**
 * Gear: three slots per Sister. Each piece has a rarity, a main stat that grows
 * when enhanced with Tithes, and 0-3 substats (one per rarity step above R).
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
  /** Enhance level, 0 to MAX_GEAR_LEVEL. */
  level: number;
  main: GearStat;
  subs: GearSub[];
  /** Sister id wearing it. */
  on?: string;
}

export const GEAR_SLOTS: GearSlot[] = ['blade', 'habit', 'rosary'];
export const SLOT_NAME: Record<GearSlot, string> = { blade: 'Blade', habit: 'Habit', rosary: 'Rosary' };
export const SLOT_HINT: Record<GearSlot, string> = { blade: 'Attack', habit: 'HP or Armor', rosary: 'Crit, Speed or Attack' };
export const STAT_NAME: Record<GearStat, string> = { atkPct: 'ATK', hpPct: 'HP', armorPct: 'ARM', crit: 'CRIT', spd: 'SPD' };

export const MAX_GEAR_LEVEL = 10;
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
export const SUB_UPGRADE_LEVELS = [3, 6, 9];

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
  return round(item.main, MAIN_BASE[item.main] * GEAR_RARITY_MULT[item.rarity] * (1 + 0.1 * item.level));
}

export function makeGear(rng: Rng, rarity: Rarity, slot: GearSlot = pick(rng, GEAR_SLOTS)): GearItem {
  const main = pick(rng, MAIN_CHOICES[slot]);
  const pool = (Object.keys(SUB_BASE) as GearStat[]).filter((s) => s !== main);
  const subs: GearSub[] = [];
  for (let i = 0; i < SUB_COUNT[rarity]; i++) {
    const stat = pool.splice(Math.floor(rng() * pool.length) % pool.length, 1)[0];
    subs.push({ stat, value: SUB_BASE[stat] });
  }
  return { uid: '', slot, rarity, name: `${pick(rng, PREFIX[rarity])} ${pick(rng, NOUN[slot])}`, level: 0, main, subs };
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

/** Spends Tithes to raise a piece one level. Returns false if it can't. */
export function enhance(save: SaveData, item: GearItem, rng: Rng = Math.random): boolean {
  const cost = enhanceCost(item);
  if (item.level >= MAX_GEAR_LEVEL || save.tithes < cost) return false;
  save.tithes -= cost;
  item.level += 1;
  track(save, 'enhance');
  if (SUB_UPGRADE_LEVELS.includes(item.level) && item.subs.length) {
    const sub = pick(rng, item.subs);
    sub.value = round(sub.stat, sub.value + SUB_BASE[sub.stat]);
  }
  return true;
}

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
  return b;
}

export const formatStat = (stat: GearStat, v: number) => (stat === 'spd' ? `+${Math.round(v)} ${STAT_NAME[stat]}` : `+${Math.round(v * 100)}% ${STAT_NAME[stat]}`);

/** Every new save starts with a worn set, so the gear page is never empty. */
export function starterGear(): GearItem[] {
  return [
    { uid: 'g-start-1', slot: 'blade', rarity: 'R', name: 'Worn Flail', level: 0, main: 'atkPct', subs: [] },
    { uid: 'g-start-2', slot: 'habit', rarity: 'R', name: 'Worn Hairshirt', level: 0, main: 'hpPct', subs: [] },
    { uid: 'g-start-3', slot: 'rosary', rarity: 'R', name: 'Worn Rosary', level: 0, main: 'crit', subs: [] },
  ];
}
