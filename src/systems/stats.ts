import { RARITY_MULT } from '../data/classes';
import type { CrusaderDef } from '../data/types';
import type { OwnedCrusader, SaveData } from '../state/save';
import { equipped, gearBonus, type GearItem } from './gear';

export interface Stats {
  hp: number;
  atk: number;
  /** Divides incoming damage: dmg / (1 + armor / 100). */
  armor: number;
  spd: number;
  /** Chance for a hit to deal CRIT_MULT damage. */
  crit: number;
}

/** Level-1 R-rarity stats per class. */
const CLASS_BASE: Record<string, Stats> = {
  warsister: { hp: 120, atk: 18, armor: 48, spd: 9, crit: 0.1 },
  hierophant: { hp: 140, atk: 12, armor: 80, spd: 7, crit: 0.08 },
  inquisitor: { hp: 95, atk: 20, armor: 40, spd: 12, crit: 0.2 },
  confessor: { hp: 90, atk: 11, armor: 40, spd: 10, crit: 0.08 },
  censer: { hp: 85, atk: 13, armor: 32, spd: 11, crit: 0.1 },
  oracle: { hp: 80, atk: 17, armor: 24, spd: 8, crit: 0.12 },
};

export const MAX_LEVEL = 20;
export const VOW_BONUS = 0.05;

export const levelUpCost = (level: number) => 50 * level;

/** A Sister's stats from rarity, level, Vows and (optionally) the gear she wears. */
export function statsFor(c: CrusaderDef, owned: OwnedCrusader, gear: GearItem[] = []): Stats {
  const base = CLASS_BASE[c.classId];
  const mult = RARITY_MULT[c.rarity] * (1 + 0.08 * (owned.level - 1)) * (1 + VOW_BONUS * owned.vow);
  const g = gearBonus(gear);
  return {
    hp: Math.round(base.hp * mult * (1 + g.hpPct)),
    atk: Math.round(base.atk * mult * (1 + g.atkPct)),
    armor: Math.round(base.armor * mult * (1 + g.armorPct)),
    spd: base.spd + Math.round(g.spd), // class speed plus gear, so turn order stays readable
    crit: Math.min(1, base.crit + g.crit),
  };
}

/** Stats with her equipped gear. */
export const sisterStats = (save: SaveData, c: CrusaderDef) => statsFor(c, save.owned[c.id], equipped(save, c.id));

/** Tithes to take the next Vow. */
export const vowCost = (vow: number) => 150 * (vow + 1);
