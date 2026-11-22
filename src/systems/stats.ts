import { symbolStatMult } from './symbols';
import { bondMult } from './bonds';
import { RARITY_MULT } from '../data/classes';
import type { CrusaderDef } from '../data/types';
import type { OwnedCrusader, SaveData } from '../state/save';
import { equipped, gearBonus, type GearItem } from './gear';
import { reliquaryBonus } from './reliquary';
import { sisterCodexBonus } from './codex';
import { oathMult } from './tiers';

export interface Stats {
  hp: number;
  atk: number;
  /** Divides incoming damage: dmg / (1 + armor / 100). */
  armor: number;
  /** Divides incoming Magic damage the way armor divides Physical. */
  mres: number;
  spd: number;
  /** Chance for a hit to deal CRIT_MULT damage. */
  crit: number;
}

/** Level-1 R-rarity stats per class. */
const CLASS_BASE: Record<string, Stats> = {
  warsister: { hp: 120, atk: 18, armor: 48, mres: 24, spd: 9, crit: 0.1 },
  hierophant: { hp: 140, atk: 12, armor: 80, mres: 40, spd: 7, crit: 0.08 },
  inquisitor: { hp: 95, atk: 20, armor: 40, mres: 30, spd: 12, crit: 0.2 },
  confessor: { hp: 90, atk: 11, armor: 40, mres: 56, spd: 10, crit: 0.08 },
  censer: { hp: 85, atk: 13, armor: 32, mres: 48, spd: 11, crit: 0.1 },
  oracle: { hp: 80, atk: 17, armor: 24, mres: 50, spd: 8, crit: 0.12 },
};

/** Level cap before any Ascension; each Ascension adds ASC_LEVELS. */
export const BASE_LEVEL_CAP = 20;
export const ASC_LEVELS = 10;
export const MAX_ASCENSION = 3;
/** The highest level any Sister can reach. */
export const MAX_LEVEL = BASE_LEVEL_CAP + ASC_LEVELS * MAX_ASCENSION;
/** Stat bonus per Ascension. */
export const ASC_STAT = 0.05;
export { VOW_BONUS } from './tiers';

/** Gear Speed past this counts half, and all gear together adds at most GEAR_SPEED_CAP. */
export const GEAR_SPEED_SOFT = 4;
export const GEAR_SPEED_CAP = 8;
export const gearSpeed = (n: number) => Math.round(Math.min(GEAR_SPEED_CAP, n <= GEAR_SPEED_SOFT ? n : GEAR_SPEED_SOFT + (n - GEAR_SPEED_SOFT) / 2));

export const levelCap = (o: Pick<OwnedCrusader, 'asc'>) => BASE_LEVEL_CAP + ASC_LEVELS * (o.asc ?? 0);

export const levelUpCost = (level: number) => 50 * level;

/** A Sister's stats from rarity, level, Vows and (optionally) the gear she wears. */
export function statsFor(c: CrusaderDef, owned: OwnedCrusader, gear: GearItem[] = []): Stats {
  const base = CLASS_BASE[c.classId];
  const mult = RARITY_MULT[c.rarity] * (1 + 0.08 * (owned.level - 1)) * oathMult(owned) * (1 + ASC_STAT * (owned.asc ?? 0)) * symbolStatMult(owned.symbol);
  const g = gearBonus(gear);
  return {
    hp: Math.round(base.hp * mult * (1 + g.hpPct)),
    atk: Math.round(base.atk * mult * (1 + g.atkPct)),
    armor: Math.round(base.armor * mult * (1 + g.armorPct)),
    mres: Math.round(base.mres * mult * (1 + g.armorPct)),
    spd: base.spd + gearSpeed(g.spd), // class speed plus gear (soft-capped), so turn order stays readable
    crit: Math.min(1, base.crit + g.crit),
  };
}

/** Stats with her equipped gear. */
export function sisterStats(save: SaveData, c: CrusaderDef): Stats {
  const st = statsFor(c, save.owned[c.id], equipped(save, c.id));
  const m = bondMult(save, c.id);
  // The Reliquary lifts every Sister.
  const r = reliquaryBonus(save);
  // ...and the Order Codex lifts the Sisters of each Order.
  const k = 1 + sisterCodexBonus(save, c);
  return {
    hp: Math.round(st.hp * m * k * (1 + r.hpPct)),
    atk: Math.round(st.atk * m * k * (1 + r.atkPct)),
    armor: Math.round(st.armor * k * (1 + r.armorPct)),
    mres: Math.round(st.mres * k * (1 + r.armorPct)),
    spd: st.spd + r.spd,
    crit: Math.min(1, st.crit + r.crit),
  };
}

/** Tithes to take the next Vow. */
