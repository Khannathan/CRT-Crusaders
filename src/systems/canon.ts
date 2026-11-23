import type { OwnedCrusader, SaveData } from '../state/save';
import { countOf, hasAll, spend, type Bag } from './items';
import { MAX_LEVEL } from './stats';

/**
 * Canonization: the climb past the level cap. A Sister at level 50 (fully
 * ascended) can be raised through twenty Canon ranks with Canon materials and
 * Tithes. Each rank adds CANON_STAT to her stats; every second rank gives a
 * trait point for her own trait tree (three paths of five, taken in order).
 * Ten points never fill fifteen traits, so each Sister is built one way; the
 * tree resets for free.
 */
export const MAX_CANON = 20;
export const CANON_STAT = 0.015;

export const canonOf = (o: Pick<OwnedCrusader, 'canon'> | undefined) => o?.canon?.rank ?? 0;
export const canCanonize = (o: Pick<OwnedCrusader, 'level'> | undefined) => !!o && o.level >= MAX_LEVEL;

/** Materials and Tithes for the step from `rank` to `rank + 1`. */
export function canonCost(rank: number): { items: Bag; tithes: number } {
  const n = 4 + 2 * rank;
  const items: Bag = rank < 7 ? { canon1: n } : rank < 14 ? { canon2: Math.ceil(n / 4) } : { canon3: Math.ceil(n / 12) };
  return { items, tithes: 1000 * (rank + 1) };
}

export function canonBlock(save: SaveData, id: string): string | undefined {
  const o = save.owned[id];
  if (!o) return 'Not sworn';
  if (!canCanonize(o)) return `Reach level ${MAX_LEVEL} first (fully ascended)`;
  const r = canonOf(o);
  if (r >= MAX_CANON) return 'Wholly canonized';
  const c = canonCost(r);
  if (!hasAll(save, c.items)) return 'Not enough Canon materials';
  if (save.tithes < c.tithes) return 'Not enough Tithes';
  return undefined;
}

export function canonize(save: SaveData, id: string): boolean {
  if (canonBlock(save, id)) return false;
  const o = save.owned[id];
  const c = canonCost(canonOf(o));
  spend(save, c.items);
  save.tithes -= c.tithes;
  o.canon = { rank: canonOf(o) + 1, traits: o.canon?.traits ?? [] };
  return true;
}

// ---------- traits ----------

export type PathId = 'wrath' | 'ward' | 'fervor';

export interface TraitEffect {
  atkPct?: number;
  hpPct?: number;
  armorPct?: number;
  crit?: number;
  spd?: number;
  /** Litany damage, heals and shields. */
  litanyPct?: number;
  /** All damage she deals. */
  dmgPct?: number;
  /** Less damage taken. */
  guard?: number;
  /** Her heals and shields (every skill). */
  healPct?: number;
  /** Zeal at the start of a fight. */
  zeal?: number;
}

export interface TraitDef {
  id: string;
  path: PathId;
  name: string;
  desc: string;
  fx: TraitEffect;
}

export const PATHS: { id: PathId; name: string; desc: string }[] = [
  { id: 'wrath', name: 'Path of Wrath', desc: 'Strike harder. Her Litany burns hotter.' },
  { id: 'ward', name: 'Path of the Ward', desc: 'Endure. Take less, stand longer.' },
  { id: 'fervor', name: 'Path of Fervor', desc: 'Burn early, act fast, mend more.' },
];

const T = (path: PathId, n: number, name: string, desc: string, fx: TraitEffect): TraitDef => ({ id: `${path}${n}`, path, name, desc, fx });

export const TRAITS: TraitDef[] = [
  T('wrath', 1, 'Righteous Arm', '+5% ATK.', { atkPct: 0.05 }),
  T('wrath', 2, 'Keen Judgment', '+5% crit chance.', { crit: 0.05 }),
  T('wrath', 3, 'Searing Psalm', 'Her Litany +10% power.', { litanyPct: 0.1 }),
  T('wrath', 4, 'Iron Conviction', '+5% ATK.', { atkPct: 0.05 }),
  T('wrath', 5, 'Hand of God', 'All her damage +8%, and her Litany +10% more.', { dmgPct: 0.08, litanyPct: 0.1 }),
  T('ward', 1, 'Hair Shirt', '+6% HP.', { hpPct: 0.06 }),
  T('ward', 2, 'Blessed Mail', '+8% armor and magic resistance.', { armorPct: 0.08 }),
  T('ward', 3, 'Patience of Saints', 'Takes 4% less damage.', { guard: 0.04 }),
  T('ward', 4, 'Flesh of Stone', '+6% HP.', { hpPct: 0.06 }),
  T('ward', 5, 'Unbroken Vigil', 'Takes 8% less damage more (12% in all on this path).', { guard: 0.08 }),
  T('fervor', 1, 'Early Matins', 'Starts each fight with 15 Zeal.', { zeal: 15 }),
  T('fervor', 2, 'Quick Feet', '+1 speed.', { spd: 1 }),
  T('fervor', 3, 'Tender Mercy', 'Her heals and shields +10%.', { healPct: 0.1 }),
  T('fervor', 4, 'Burning Heart', 'Starts each fight with 15 Zeal more.', { zeal: 15 }),
  T('fervor', 5, 'Swift Zeal', '+1 speed, and her Litany +8% power.', { spd: 1, litanyPct: 0.08 }),
];
export const TRAIT = Object.fromEntries(TRAITS.map((t) => [t.id, t])) as Record<string, TraitDef>;

export const traitPoints = (o: Pick<OwnedCrusader, 'canon'> | undefined) => Math.floor(canonOf(o) / 2);
export const traitsOf = (o: Pick<OwnedCrusader, 'canon'> | undefined) => (o?.canon?.traits ?? []).filter((t) => TRAIT[t]);
export const pointsLeft = (o: Pick<OwnedCrusader, 'canon'> | undefined) => traitPoints(o) - traitsOf(o).length;

/** Why this trait can't be taken now (undefined: it can). Paths are taken in order. */
export function traitBlock(o: OwnedCrusader | undefined, id: string): string | undefined {
  const t = TRAIT[id];
  if (!o || !t) return 'Unknown';
  const have = traitsOf(o);
  if (have.includes(id)) return 'Taken';
  if (pointsLeft(o) <= 0) return canonOf(o) >= MAX_CANON ? 'No points left' : 'Next point at the next even Canon rank';
  const n = Number(id.slice(t.path.length));
  if (n > 1 && !have.includes(`${t.path}${n - 1}`)) return 'Take the one before it first';
  return undefined;
}

export function takeTrait(save: SaveData, sisterId: string, id: string): boolean {
  const o = save.owned[sisterId];
  if (traitBlock(o, id)) return false;
  o.canon = { rank: canonOf(o), traits: [...traitsOf(o), id] };
  return true;
}

/** Free: every point comes back. */
export function resetTraits(save: SaveData, sisterId: string) {
  const o = save.owned[sisterId];
  if (o?.canon) o.canon.traits = [];
}

/** Everything her Canon rank and traits give. */
export function canonEffect(o: Pick<OwnedCrusader, 'canon'> | undefined): Required<TraitEffect> & { statMult: number } {
  const out = { atkPct: 0, hpPct: 0, armorPct: 0, crit: 0, spd: 0, litanyPct: 0, dmgPct: 0, guard: 0, healPct: 0, zeal: 0, statMult: 1 + CANON_STAT * canonOf(o) };
  for (const id of traitsOf(o)) for (const [k, v] of Object.entries(TRAIT[id].fx)) out[k as keyof TraitEffect] += v as number;
  return out;
}

/** Canon materials held, for the tab header. */
export const canonHeld = (save: SaveData) => [countOf(save, 'canon1'), countOf(save, 'canon2'), countOf(save, 'canon3')];
