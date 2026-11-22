import type { SaveData } from '../state/save';
import { hasAll, spend, type Bag } from './items';

/**
 * The Reliquary: an account-wide tree. Incense consecrates its relics one by
 * one, and each relic raises the stats of every Sister. Three branches of five
 * relics, taken in order, then the Crown once all fifteen are lit.
 */
export type Branch = 'wrath' | 'faith' | 'zeal' | 'crown';

export interface RelicBonus {
  atkPct?: number;
  hpPct?: number;
  armorPct?: number;
  crit?: number;
  spd?: number;
}

export interface RelicNode {
  id: string;
  branch: Branch;
  /** 0-4 within the branch; the Crown is 5. */
  step: number;
  name: string;
  bonus: RelicBonus;
  items: Bag;
  tithes: number;
}

export interface BranchDef {
  id: Branch;
  name: string;
  hint: string;
  color: number;
}

export const BRANCHES: BranchDef[] = [
  { id: 'wrath', name: 'Wrath', hint: 'Attack and crits', color: 0xd36a5c },
  { id: 'faith', name: 'Faith', hint: 'HP and armor', color: 0xd8c79a },
  { id: 'zeal', name: 'Zeal', hint: 'Speed and a bit of all', color: 0x8fc07a },
];

/** Cost of the n-th relic in a branch. */
const COST: { items: Bag; tithes: number }[] = [
  { items: { incense1: 10 }, tithes: 200 },
  { items: { incense1: 20 }, tithes: 500 },
  { items: { incense1: 20, incense2: 4 }, tithes: 1000 },
  { items: { incense2: 10 }, tithes: 2000 },
  { items: { incense2: 12, incense3: 3 }, tithes: 4000 },
];

const node = (branch: Branch, step: number, name: string, bonus: RelicBonus): RelicNode => ({ id: `${branch}${step + 1}`, branch, step, name, bonus, ...COST[step] });

export const RELICS: RelicNode[] = [
  node('wrath', 0, 'Rusted Spearhead', { atkPct: 0.02 }),
  node('wrath', 1, 'Nail of the Cross', { atkPct: 0.03 }),
  node('wrath', 2, "Executioner's Hood", { crit: 0.03 }),
  node('wrath', 3, 'Sword of Saint Agathe', { atkPct: 0.04 }),
  node('wrath', 4, 'The Burning Tongue', { crit: 0.05 }),
  node('faith', 0, 'Bone of a Novice', { hpPct: 0.02 }),
  node('faith', 1, 'Veil of the Abbess', { hpPct: 0.03 }),
  node('faith', 2, 'Iron Girdle', { armorPct: 0.04 }),
  node('faith', 3, 'Heart in a Jar', { hpPct: 0.04 }),
  node('faith', 4, 'Shroud of the Martyr', { armorPct: 0.06 }),
  node('zeal', 0, 'Pilgrim Shell', { atkPct: 0.01, hpPct: 0.01 }),
  node('zeal', 1, 'Winged Sandal', { spd: 1 }),
  node('zeal', 2, 'Candle that Will Not Die', { atkPct: 0.02, hpPct: 0.02 }),
  node('zeal', 3, 'Feather of the Seraph', { spd: 1 }),
  node('zeal', 4, 'The Choir Bell', { atkPct: 0.03, hpPct: 0.03 }),
  { id: 'crown', branch: 'crown', step: 5, name: 'Crown of Thorns', bonus: { atkPct: 0.05, hpPct: 0.05, armorPct: 0.05 }, items: { incense3: 8 }, tithes: 8000 },
];

export const relic = (id: string) => RELICS.find((r) => r.id === id)!;
export const litOf = (save: SaveData) => (save.reliquary ??= []);
export const isLit = (save: SaveData, id: string) => litOf(save).includes(id);

/** Why a relic cannot be consecrated now, or undefined. */
export function relicBlock(save: SaveData, id: string): string | undefined {
  const r = relic(id);
  if (isLit(save, id)) return 'Consecrated';
  if (r.branch === 'crown') {
    if (RELICS.some((x) => x.branch !== 'crown' && !isLit(save, x.id))) return 'Light every other relic first';
  } else if (r.step > 0 && !isLit(save, `${r.branch}${r.step}`)) return 'Light the one before it first';
  if (!hasAll(save, r.items)) return 'Not enough Incense';
  if (save.tithes < r.tithes) return 'Not enough Tithes';
  return undefined;
}

export function consecrate(save: SaveData, id: string): boolean {
  if (relicBlock(save, id)) return false;
  const r = relic(id);
  spend(save, r.items);
  save.tithes -= r.tithes;
  litOf(save).push(id);
  return true;
}

/** Every lit relic's bonus, summed. Applies to every Sister. */
export function reliquaryBonus(save: SaveData): Required<RelicBonus> {
  const b = { atkPct: 0, hpPct: 0, armorPct: 0, crit: 0, spd: 0 };
  for (const id of save.reliquary ?? []) for (const [k, v] of Object.entries(relic(id)?.bonus ?? {}) as [keyof RelicBonus, number][]) b[k] += v;
  return b;
}

/** "+3% ATK, +1 SPD". */
export const relicBonusText = (b: RelicBonus) =>
  (Object.entries(b) as [keyof RelicBonus, number][])
    .filter(([, v]) => v)
    .map(([k, v]) => (k === 'spd' ? `+${v} SPD` : `+${Math.round(v * 100)}% ${{ atkPct: 'ATK', hpPct: 'HP', armorPct: 'ARM', crit: 'CRIT' }[k]}`))
    .join(', ');
