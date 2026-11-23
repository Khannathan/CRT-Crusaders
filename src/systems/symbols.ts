import { CLASSES } from '../data/classes';
import { KITS, exaltSig } from '../data/kits';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';
import { bagText, hasAll, spend, type Bag } from './items';

/**
 * Holy Symbols: each Sister's own relic, like an exclusive weapon. It wakes
 * once she has ascended, then rises +1 to +15 on Grace (Embers for +1 to +5,
 * Tears for +6 to +10, Crowns for +11 to +15). Every level lifts her stats,
 * and +5, +10 and +15 each add a blessing. The one at +10 is her own: a Sister
 * with a signature has it Exalted (its shares 25% stronger); the rest take a
 * blessing by class.
 */
export const SYMBOL_MAX = 15;
/** All stats when the Symbol wakes, and per level after. */
export const SYMBOL_WAKE = 0.05;
export const SYMBOL_PER_LEVEL = 0.015;
/** Ascensions she needs before her Symbol can wake. */
export const SYMBOL_ASC = 1;
export const WAKE_COST: Bag = { grace1: 10 };
export const WAKE_TITHES = 2000;

export const symbolOf = (save: SaveData, id: string): number | undefined => save.owned[id]?.symbol;

/** Her Symbol's name: the first part of her roster relic, in title case. */
export function symbolName(c: CrusaderDef): string {
  const base = (c.relic ?? 'Holy Symbol').split(',')[0].trim();
  return base.replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Grace and Tithes for the step to `level` (1..15). */
export function upgradeCost(level: number): { items: Bag; tithes: number } {
  if (level <= 5) return { items: { grace1: 4 * level }, tithes: 400 * level };
  if (level <= 10) return { items: { grace2: 3 * (level - 5) }, tithes: 400 * level };
  return { items: { grace3: 2 * (level - 10) }, tithes: 400 * level };
}

export interface SymbolPerk {
  at: number;
  name: string;
  desc: string;
}

/** How much stronger an Exalted signature's shares are. */
export const EXALT = 1.25;

/** Whether her +10 blessing Exalts her signature (an SSR or UR whose signature has a share to raise). */
export const exalts = (c: CrusaderDef): boolean => (c.rarity === 'SSR' || c.rarity === 'UR') && !!exaltSig(KITS[c.id]?.sig, EXALT);

/** The +10 blessing by class. */
const CLASS_PERK: Record<string, { name: string; desc: string }> = {
  hierophant: { name: 'Unbroken Relic', desc: 'She takes 12% less damage.' },
  confessor: { name: 'Anointed Hands', desc: 'Her heals and shields are 20% stronger.' },
  oracle: { name: 'Seer\'s Ember', desc: 'The party starts every fight with +8 Zeal.' },
  censer: { name: 'Censer\'s Breath', desc: 'Her skills deal 12% more damage.' },
  warsister: { name: 'Edge of Penance', desc: '+12% critical chance.' },
  inquisitor: { name: 'Edge of Judgement', desc: '+12% critical chance.' },
  sentinel: { name: 'Sealed Tomb', desc: 'She takes 12% less damage.' },
  martyr: { name: 'Dawn Plate', desc: 'She takes 12% less damage.' },
  hospitaller: { name: 'Overflowing Chalice', desc: 'Her heals and shields are 20% stronger.' },
  abbess: { name: 'Rosewater', desc: 'Her heals and shields are 20% stronger.' },
  cantor: { name: 'Opening Hymn', desc: 'The party starts every fight with +8 Zeal.' },
  adjudicator: { name: 'Gavel of Ash', desc: 'Her skills deal 12% more damage.' },
  veilblade: { name: 'Edge of the Veil', desc: '+12% critical chance.' },
  arbalist: { name: 'Blessed Fletching', desc: '+12% critical chance.' },
  exorcist: { name: 'Lantern Oil', desc: 'Her skills deal 12% more damage.' },
};

export function symbolPerks(c: CrusaderDef): SymbolPerk[] {
  const k = exalts(c) ? { name: `Exalted ${c.passive!.name}`, desc: `${c.passive!.name} is 25% stronger.` } : CLASS_PERK[c.classId] ?? CLASS_PERK.warsister;
  return [
    { at: 5, name: 'Awakened', desc: 'Her skills deal and heal 10% more.' },
    { at: 10, name: k.name, desc: k.desc },
    { at: 15, name: 'Sanctified', desc: 'Her Litany is 30% stronger.' },
  ];
}

/** Stat multiplier from her Symbol (1 while it sleeps). */
export function symbolStatMult(level: number | undefined): number {
  return level === undefined ? 1 : 1 + SYMBOL_WAKE + SYMBOL_PER_LEVEL * level;
}

/** What her Symbol does in battle. */
export interface SymbolCombat {
  mult: number;
  heal: number;
  guard: number;
  rite: number;
  crit: number;
  zeal: number;
  /** Her signature's shares grow by this (Exalted at +10). */
  exalt?: number;
}

export function symbolCombat(c: CrusaderDef, level: number | undefined): SymbolCombat | undefined {
  if (level === undefined) return undefined;
  const out: SymbolCombat = { mult: 1, heal: 1, guard: 0, rite: 0, crit: 0, zeal: 0 };
  if (level >= 5) out.mult = 1.1;
  if (level >= 10 && exalts(c)) out.exalt = EXALT;
  else if (level >= 10) {
    const role = CLASSES[c.classId]?.role;
    if (role === 'Tank') out.guard = 0.12;
    else if (role === 'Healer') out.heal = 1.2;
    else if (c.classId === 'oracle' || c.classId === 'cantor') out.zeal = 8;
    // The Censer's blessing used to copy the Oracle's; she and the other casters now hit harder.
    else if (c.classId === 'censer' || c.classId === 'adjudicator' || c.classId === 'exorcist') out.mult *= 1.12;
    else out.crit = 0.12;
  }
  if (level >= 15) out.rite = 0.3;
  return out;
}

/** Why her Symbol cannot wake or rise now, or undefined if it can. */
export function symbolBlock(save: SaveData, id: string): string | undefined {
  const o = save.owned[id];
  if (!o) return 'Not sworn';
  const lv = o.symbol;
  if (lv === undefined) {
    if ((o.asc ?? 0) < SYMBOL_ASC) return 'Ascend her once to wake it';
    if (!hasAll(save, WAKE_COST)) return `Needs ${bagText(WAKE_COST)}`;
    if (save.tithes < WAKE_TITHES) return 'Not enough Tithes';
    return undefined;
  }
  if (lv >= SYMBOL_MAX) return 'Fully sanctified';
  const cost = upgradeCost(lv + 1);
  if (!hasAll(save, cost.items)) return `Needs ${bagText(cost.items)}`;
  if (save.tithes < cost.tithes) return 'Not enough Tithes';
  return undefined;
}

/** Wakes her Symbol, or raises it a level. */
export function raiseSymbol(save: SaveData, id: string): boolean {
  if (symbolBlock(save, id)) return false;
  const o = save.owned[id];
  if (o.symbol === undefined) {
    spend(save, WAKE_COST);
    save.tithes -= WAKE_TITHES;
    o.symbol = 0;
    return true;
  }
  const cost = upgradeCost(o.symbol + 1);
  spend(save, cost.items);
  save.tithes -= cost.tithes;
  o.symbol += 1;
  return true;
}
