import { RARITY_MULT } from '../data/classes';
import type { CrusaderDef } from '../data/types';
import type { OwnedCrusader } from '../state/save';

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

export function statsFor(c: CrusaderDef, owned: OwnedCrusader): Stats {
  const base = CLASS_BASE[c.classId];
  const mult = RARITY_MULT[c.rarity] * (1 + 0.08 * (owned.level - 1)) * (1 + VOW_BONUS * owned.vow);
  return {
    hp: Math.round(base.hp * mult),
    atk: Math.round(base.atk * mult),
    armor: Math.round(base.armor * mult),
    spd: base.spd, // speed is fixed per class so turn order stays readable
    crit: base.crit,
  };
}
