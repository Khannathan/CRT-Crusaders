import { AFFIX_IDS, EDICTS, MAX_IP, ROLE_AFFIXES, UNIQUES, type AffixId } from '../data/loot';
import { CLASSES } from '../data/classes';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';
import { GEAR_SLOTS, lineValue, type GearItem, type GearSlot, type GearStat, type GearSub } from './gear';
import { gearSwapDelta, sisterPower } from './power';

/**
 * The gear power budget (design doc: "a UR in starter gear beats an R in
 * perfect gear"). Builds three kits for a Sister and measures how far each
 * lifts her Power over wearing nothing. Used by gear.test.ts only.
 */

const MAIN_CHOICES: Record<GearSlot, GearStat[]> = { blade: ['atkPct'], habit: ['hpPct', 'armorPct'], veil: ['hpPct', 'mresPct'], sabatons: ['armorPct', 'hpPct', 'mresPct'], rosary: ['crit', 'critDmg', 'atkPct'] };


const piece = (slot: GearSlot, main: GearStat, grade: GearItem['grade'], ip: number, level: number, subs: GearSub[], extra: Partial<GearItem> = {}): GearItem => ({
  uid: `${slot}-${main}-${subs.map((s) => s.stat).join('-')}-${extra.edict?.id ?? extra.unique ?? ''}`,
  slot,
  grade,
  rarity: grade === 'worn' ? 'R' : grade === 'consecrated' ? 'SR' : grade === 'arms' || grade === 'godforged' ? 'UR' : 'SSR',
  name: '',
  ip,
  level,
  main,
  subs,
  penance: 0,
  ...extra,
});

const line = (stat: AffixId, ip: number, roll: number, burn = false, up = 0): GearSub => ({ stat, roll, burn: burn || undefined, up: up || undefined, value: lineValue(stat, ip, roll, burn, up) });

/** Five Worn pieces at IP 150, +0: what a new player wears. */
export function starterKit(): GearItem[] {
  return GEAR_SLOTS.map((s) => piece(s, MAIN_CHOICES[s][0], 'worn', 150, 0, []));
}

/** A farmed kit: Sworn pieces at IP 550, +10, lines she hopes for at 85%, two Edicts. */
export function farmedKit(c: CrusaderDef): GearItem[] {
  const want = ROLE_AFFIXES[CLASSES[c.classId].role];
  return GEAR_SLOTS.map((s, i) => {
    const main = MAIN_CHOICES[s].find((m) => want.includes(m)) ?? MAIN_CHOICES[s][0];
    const stats = want.filter((a) => a !== main).slice(0, 3);
    const subs = stats.map((a, j) => line(a, 550, 0.85, false, j === 0 ? 2 : j === 1 ? 1 : 0));
    const edict = i < 2 ? EDICTS.find((e) => e.slots.includes(s)) : undefined;
    return piece(s, main, edict ? 'anathema' : 'sworn', 550, 10, subs, edict ? { edict: { id: edict.id, roll: 0.5 } } : {});
  });
}

function combos<T>(xs: T[], k: number): T[][] {
  if (k === 0) return [[]];
  return xs.flatMap((x, i) => combos(xs.slice(i + 1), k - 1).map((rest) => [x, ...rest]));
}

/** Every perfect piece a slot can hold: IP 800, +15, every line Burning at 100%, the Anvil's five growths on one line, the best Edict or unique. */
function perfectPieces(slot: GearSlot): GearItem[] {
  const out: GearItem[] = [];
  const edicts = EDICTS.filter((e) => e.slots.includes(slot));
  for (const main of MAIN_CHOICES[slot]) {
    for (const trio of combos(AFFIX_IDS.filter((a) => a !== main), 3)) {
      for (let upAt = 0; upAt < 3; upAt++) {
        const subs = trio.map((a, j) => line(a, MAX_IP, 1, true, j === upAt ? 5 : 0));
        for (const e of edicts) out.push(piece(slot, main, 'anathema', MAX_IP, 15, subs, { edict: { id: e.id, roll: 1 } }));
      }
    }
  }
  for (const u of UNIQUES.filter((x) => x.slot === slot)) {
    const subs = u.affixes.map((a, j) => line(a, MAX_IP, 1, true, j === 0 ? 5 : 0));
    out.push(piece(slot, u.main, u.grade, MAX_IP, 15, subs, { unique: u.id, uRoll: 1 }));
  }
  return out;
}

const cache: Partial<Record<GearSlot, GearItem[]>> = {};

/** Her best perfect kit, found slot by slot (two passes, so Edicts and lines settle). */
export function bisKit(save: SaveData, c: CrusaderDef): GearItem[] {
  const kit: GearItem[] = [];
  const wear = (items: GearItem[]) => {
    save.gear = items.map((g) => ({ ...g, on: c.id }));
  };
  for (let pass = 0; pass < 2; pass++) {
    for (const slot of GEAR_SLOTS) {
      const pool = (cache[slot] ??= perfectPieces(slot));
      wear(kit);
      let best = kit.find((g) => g.slot === slot);
      let bestD = best ? 0 : -Infinity;
      for (const g of pool) {
        const d = gearSwapDelta(save, c, g);
        if (d > bestD) (bestD = d), (best = g);
      }
      const i = kit.findIndex((g) => g.slot === slot);
      if (i >= 0) kit[i] = best!;
      else kit.push(best!);
    }
  }
  save.gear = [];
  return kit;
}

/** Her Power wearing `kit`, over her Power wearing nothing. */
export function kitRatio(save: SaveData, c: CrusaderDef, kit: GearItem[]): number {
  save.gear = [];
  const bare = sisterPower(save, c);
  save.gear = kit.map((g) => ({ ...g, on: c.id }));
  const worn = sisterPower(save, c);
  save.gear = [];
  return worn / bare;
}


