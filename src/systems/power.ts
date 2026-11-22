import { CRUSADERS } from '../data/crusaders';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';
import { CLASSES } from '../data/classes';
import { CRIT_MULT, VOW_UPGRADES, type Battle } from './combat';
import { GEAR_SLOTS, equipped, gearOf, type GearItem } from './gear';
import { statsFor, sisterStats, type Stats } from './stats';
import { bondMult } from './bonds';
import { skillLevelsGained } from './skillLevels';
import { skillVow } from './tiers';

/**
 * Power (CP): one number for how strong a Sister, a piece of gear or the whole
 * account is. Offense is crit-adjusted attack scaled by speed (speed is extra
 * turns); defense is a weighted sum of HP and armor, kept linear so every
 * class grows at the same pace with level. A role share lifts healers and
 * mystics, whose worth is not in raw stats; Vow skill upgrades and a signature
 * passive add more. All weights live in CP so they can be retuned in one place.
 */
export const CP = {
  /** Weight of offense (crit-adjusted ATK x speed factor). */
  offense: 30,
  /** Weight of HP. */
  hp: 3,
  /** Weight of armor (and Magic Resist). */
  armor: 3.6,
  /** Share by class role, for value raw stats miss (heals, debuffs). */
  role: { Vanguard: 1, Striker: 1, Mender: 1.3, Mystic: 1.2 } as Record<string, number>,
  /** Speed that counts as 1.0x. */
  speedBase: 10,
  /** Per Vow skill upgrade. */
  vowSkill: 0.05,
  /** A Sister with a signature passive. */
  passive: 0.1,
  /** Per skill level above 1 (up to 16 across her four skills). */
  skillLevel: 0.02,
  /** Sisters counted for account power (a full party). */
  accountTop: 4,
  /**
   * Recommended power is the foes' stat power times this. Tuned by auto-played
   * fights: at 1.2 a party of that power wins most tries (the starter party
   * meets the Ossuary at about level 4 or 5).
   */
  recommend: 1.07, // 1.2 before balance 0.8 raised foes' raw stats by 12% (statuses made Sisters stronger)
  /** Below this share of the recommendation a fight is shown as dangerous. */
  risky: 0.8,
};

export const offenseOf = (s: Stats) => s.atk * (1 + Math.min(1, s.crit) * (CRIT_MULT - 1)) * (s.spd / CP.speedBase);
/** Armor and Magic Resist count half each: a foe hits with one or the other. */
export const defenseOf = (s: Pick<Stats, 'hp' | 'armor'> & { mres?: number }) => s.hp * CP.hp + ((s.armor + (s.mres ?? s.armor)) / 2) * CP.armor;

/** Raw power of a stat block, before role, skill and passive shares. */
export const statPower = (s: Stats) => offenseOf(s) * CP.offense + defenseOf(s);

const vowSkills = (vow: number) => VOW_UPGRADES.filter(([v]) => vow >= v).length;

/** The share Vow upgrades and a passive add (1.0 and up). */
export const skillShare = (c: CrusaderDef, vow: number, levels = 0) =>
  (CP.role[CLASSES[c.classId]?.role] ?? 1) * (1 + vowSkills(vow) * CP.vowSkill + (c.passive ? CP.passive : 0) + levels * CP.skillLevel);

export const powerOf = (c: CrusaderDef, s: Stats, vow: number, levels = 0) => Math.round(statPower(s) * skillShare(c, vow, levels));

/** A Sister's power as she stands: level, Vows, gear and bond. */
export function sisterPower(save: SaveData, c: CrusaderDef) {
  const o = save.owned[c.id];
  return o ? powerOf(c, sisterStats(save, c), skillVow(o), skillLevelsGained(save, c.id)) : 0;
}

export const sisterPowerById = (save: SaveData, id: string) => {
  const c = CRUSADERS.find((x) => x.id === id);
  return c ? sisterPower(save, c) : 0;
};

/** Her power with `gear` worn instead of what she has now. */
function powerWith(save: SaveData, c: CrusaderDef, gear: GearItem[]) {
  const o = save.owned[c.id];
  if (!o) return 0;
  const st = statsFor(c, o, gear);
  const m = bondMult(save, c.id);
  return powerOf(c, { ...st, hp: Math.round(st.hp * m), atk: Math.round(st.atk * m) }, skillVow(o), skillLevelsGained(save, c.id));
}

/** What a worn piece adds to her power: with it on versus off. */
export function gearPower(save: SaveData, c: CrusaderDef, item: GearItem) {
  const worn = equipped(save, c.id);
  const without = worn.filter((g) => g.uid !== item.uid && g.slot !== item.slot);
  return powerWith(save, c, [...without, item]) - powerWith(save, c, without);
}

/** The change in her power if she put this piece on in place of her current one. */
export function gearSwapDelta(save: SaveData, c: CrusaderDef, item: GearItem) {
  const worn = equipped(save, c.id);
  const swapped = [...worn.filter((g) => g.slot !== item.slot), item];
  return powerWith(save, c, swapped) - sisterPower(save, c);
}

/** The pieces that would raise her power most, one per slot, from her own and the unworn. */
export function autoEquipPlan(save: SaveData, c: CrusaderDef): GearItem[] {
  const out: GearItem[] = [];
  for (const slot of GEAR_SLOTS) {
    const now = equipped(save, c.id).find((g) => g.slot === slot);
    let best = now;
    let bestP = now ? gearPower(save, c, now) : 0;
    for (const g of gearOf(save)) {
      if (g.slot !== slot || (g.on && g.on !== c.id)) continue;
      const p = gearPower(save, c, g);
      if (p > bestP) (best = g), (bestP = p);
    }
    if (best && best !== now) out.push(best);
  }
  return out;
}

/** Account power: the strongest full party (of the Sisters `allow` admits). */
export function accountPower(save: SaveData, allow: (c: CrusaderDef) => boolean = () => true) {
  return CRUSADERS.filter((c) => save.owned[c.id] && allow(c))
    .map((c) => sisterPower(save, c))
    .sort((a, b) => b - a)
    .slice(0, CP.accountTop)
    .reduce((n, p) => n + p, 0);
}

export const partyPower = (save: SaveData, party: string[]) => party.reduce((n, id) => n + (save.owned[id] ? sisterPowerById(save, id) : 0), 0);

export const formatPower = (n: number) => n.toLocaleString('en-US');

/** The foes' raw power in a built fight. */
export const foePower = (b: Battle) => b.units.filter((u) => u.side === 'enemy').reduce((n, u) => n + statPower(u), 0);

/** The party power a fight asks for, rounded to the nearest 100. */
export const recommendedPower = (b: Battle) => Math.round((foePower(b) * CP.recommend) / 100) * 100;

export type PowerVerdict = 'ready' | 'close' | 'danger';

export const powerVerdict = (mine: number, rec: number): PowerVerdict => (mine >= rec ? 'ready' : mine >= rec * CP.risky ? 'close' : 'danger');
