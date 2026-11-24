import { CLASSES } from '../data/classes';
import { crusaderById } from '../data/crusaders';
import { KITS, exaltSig } from '../data/kits';
import type { CrusaderDef } from '../data/types';
import { WEAPONS } from '../data/weapons';
import { TIER_OF_RARITY, WEAPON_TIER, type WeaponTier } from '../data/weaponTiers';
import type { SaveData } from '../state/save';
import { bagText, hasAll, spend, type Bag } from './items';

/**
 * Signature Weapons (once called Holy Symbols): each Sister's own named weapon
 * from her card, tiered by rarity (R Epic, SR Legendary, SSR Mythic, UR Divine
 * Arsenal). It wakes once she has ascended, then rises on Grace (Embers for +1
 * to +5, Tears for +6 to +10, Crowns from +11). Epic and Legendary weapons stop
 * at +15, Mythic at +20 and Divine Arsenal at +25. Every level lifts her stats,
 * and +5, +10, +15, +20 and +25 each add a blessing. The one at +10 is her own:
 * a Sister with a signature has it Exalted (its shares 25% stronger); the rest
 * take a blessing by class. The +5 blessing wakes her Relic, the charm she
 * carries on the weapon.
 *
 * Saves keep the old field name: `owned[id].symbol` is her weapon level.
 */
/** The cap of Epic and Legendary weapons (and of every weapon before Mythic and Divine Arsenal climbed higher). */
export const SYMBOL_MAX = 15;
/** The highest any weapon climbs (Divine Arsenal). */
export const SYMBOL_TOP = 25;
/** All stats when the Symbol wakes, and per level after. */
export const SYMBOL_WAKE = 0.05;
export const SYMBOL_PER_LEVEL = 0.015;
/** Ascensions she needs before her weapon can wake. */
export const SYMBOL_ASC = 1;
export const WAKE_COST: Bag = { grace1: 10 };
export const WAKE_TITHES = 2000;

export const symbolOf = (save: SaveData, id: string): number | undefined => save.owned[id]?.symbol;

export interface Weapon {
  name: string;
  tier: WeaponTier;
  /** Tier name: Epic, Legendary, Mythic or Divine Arsenal. */
  label: string;
  color: number;
  /** What it looks like, from her card (empty when her card names none). */
  look: string;
  /** The highest level it climbs to. */
  max: number;
}

/** Her signature weapon: from her card, or named after her relic when her card has none. */
export function weaponOf(c: CrusaderDef): Weapon {
  const w = WEAPONS[c.id];
  const tier = w?.tier ?? TIER_OF_RARITY[c.rarity];
  const name = w?.name ?? (c.relic ?? 'Signature Weapon').split(',')[0].trim().replace(/(^|[\s-])\w/g, (m) => m.toUpperCase());
  return { name, tier, look: w?.look ?? '', ...WEAPON_TIER[tier] };
}

/** Her weapon's name. */
export const symbolName = (c: CrusaderDef): string => weaponOf(c).name;

/** The highest level her weapon climbs to. */
export const symbolMax = (c: CrusaderDef): number => weaponOf(c).max;

/** Grace and Tithes for the step to `level` (1..25). */
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

/** Litany bonus at +20 (on top of +15's), and the second Litany blow at +25. */
export const HALLOWED_RITE = 0.15;
export const DIVINE_WRATH = 0.4;

export function symbolPerks(c: CrusaderDef): SymbolPerk[] {
  const relic = KITS[c.id]?.relic;
  const k = exalts(c) ? { name: `Exalted ${c.passive!.name}`, desc: `${c.passive!.name} is 25% stronger.` } : CLASS_PERK[c.classId] ?? CLASS_PERK.warsister;
  const perks = [
    relic ? { at: 5, name: `Awakened: ${relic.name}`, desc: `Her skills deal and heal 10% more. ${relic.desc}` } : { at: 5, name: 'Awakened', desc: 'Her skills deal and heal 10% more.' },
    { at: 10, name: k.name, desc: k.desc },
    { at: 15, name: 'Sanctified', desc: 'Her Litany is 30% stronger.' },
    { at: 20, name: 'Hallowed Edge', desc: 'Her Litany is 15% stronger still, and her weapon burns in battle!' },
    { at: 25, name: 'Divine Wrath', desc: 'Her Litany strikes twice: the second blow lands at 40%!' },
  ];
  return perks.filter((p) => p.at <= symbolMax(c));
}

/** Stat multiplier from her weapon (1 while it sleeps). */
export function symbolStatMult(level: number | undefined): number {
  return level === undefined ? 1 : 1 + SYMBOL_WAKE + SYMBOL_PER_LEVEL * level;
}

/** What her weapon does in battle. */
export interface SymbolCombat {
  mult: number;
  heal: number;
  guard: number;
  rite: number;
  crit: number;
  zeal: number;
  /** Her signature's shares grow by this (Exalted at +10). */
  exalt?: number;
  /** Her Relic has woken (+5) and rewrites its skill. */
  relic?: boolean;
  /** Her weapon burns in battle (+20). */
  glow?: boolean;
  /** Divine Wrath (+25): her Litany strikes each foe again at this share. */
  echo?: number;
}

export function symbolCombat(c: CrusaderDef, level: number | undefined): SymbolCombat | undefined {
  if (level === undefined) return undefined;
  const out: SymbolCombat = { mult: 1, heal: 1, guard: 0, rite: 0, crit: 0, zeal: 0 };
  if (level >= 5) out.mult = 1.1;
  if (level >= 5 && KITS[c.id]?.relic) out.relic = true;
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
  if (level >= 20) {
    out.rite += HALLOWED_RITE;
    out.glow = true;
  }
  if (level >= 25) out.echo = DIVINE_WRATH;
  return out;
}

/** Why her weapon cannot wake or rise now, or undefined if it can. */
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
  const c = crusaderById(id);
  if (lv >= (c ? symbolMax(c) : SYMBOL_MAX)) return 'Fully sanctified';
  const cost = upgradeCost(lv + 1);
  if (!hasAll(save, cost.items)) return `Needs ${bagText(cost.items)}`;
  if (save.tithes < cost.tithes) return 'Not enough Tithes';
  return undefined;
}

/** Wakes her weapon, or raises it a level. */
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
