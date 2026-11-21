import { RARITY_MULT } from '../data/classes';
import type { CrusaderDef } from '../data/types';
import type { OwnedCrusader } from '../state/save';

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

/** Level-1 R-rarity stats per class. */
const CLASS_BASE: Record<string, Stats> = {
  warsister: { hp: 120, atk: 18, def: 6, spd: 9 },
  hierophant: { hp: 140, atk: 12, def: 10, spd: 7 },
  inquisitor: { hp: 95, atk: 20, def: 5, spd: 12 },
  confessor: { hp: 90, atk: 11, def: 5, spd: 10 },
  censer: { hp: 85, atk: 13, def: 4, spd: 11 },
  oracle: { hp: 80, atk: 17, def: 3, spd: 8 },
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
    def: Math.round(base.def * mult),
    spd: base.spd, // speed is fixed per class so turn order stays readable
  };
}
