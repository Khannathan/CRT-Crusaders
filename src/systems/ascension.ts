import type { SaveData } from '../state/save';
import { bagText, countOf, hasAll, itemDef, spend, type Bag, type ItemId } from './items';
import { MAX_ASCENSION, levelCap } from './stats';

/**
 * Ascension: at her level cap a Sister can ascend, spending Martyr's Ash and
 * Tithes. Each ascension raises the cap by 10 (20, 30, 40, 50) and adds
 * ASC_STAT to all her stats.
 */
export interface AscensionStep {
  items: Bag;
  tithes: number;
}

export const ASCENSIONS: AscensionStep[] = [
  { items: { ash1: 20 }, tithes: 1500 },
  { items: { ash1: 30, ash2: 10 }, tithes: 3000 },
  { items: { ash2: 25, ash3: 8 }, tithes: 6000 },
];

export const ascensionOf = (save: SaveData, id: string) => save.owned[id]?.asc ?? 0;

/** The next step, or undefined at the last ascension. */
export const nextAscension = (save: SaveData, id: string): AscensionStep | undefined => ASCENSIONS[ascensionOf(save, id)];

/** Why she cannot ascend now, or undefined if she can. */
export function ascendBlock(save: SaveData, id: string): string | undefined {
  const o = save.owned[id];
  if (!o) return 'Not sworn';
  const step = nextAscension(save, id);
  if (!step) return 'Fully ascended';
  if (o.level < levelCap(o)) return `Reach level ${levelCap(o)} first`;
  if (!hasAll(save, step.items)) return 'Not enough Ash';
  if (save.tithes < step.tithes) return 'Not enough Tithes';
  return undefined;
}

export function ascend(save: SaveData, id: string): boolean {
  const step = nextAscension(save, id);
  if (!step || ascendBlock(save, id)) return false;
  spend(save, step.items);
  save.tithes -= step.tithes;
  const o = save.owned[id];
  o.asc = Math.min(MAX_ASCENSION, (o.asc ?? 0) + 1);
  return true;
}

/** "20 Grave Ash (12) · 1,500 Tithes" with what the player holds in brackets. */
export const costLine = (save: SaveData, step: AscensionStep) =>
  [
    ...(Object.entries(step.items) as [ItemId, number][]).map(([i, n]) => `${n} ${itemDef(i).name} (${countOf(save, i)})`),
    `${step.tithes.toLocaleString('en-US')} Tithes`,
  ].join(' · ');

export { bagText };
