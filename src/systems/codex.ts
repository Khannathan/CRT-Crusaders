import { CRUSADERS } from '../data/crusaders';
import { ORDERS, ORDER_LIST } from '../data/orders';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';
import { hasAll, spend, type Bag } from './items';

/**
 * The Order Codex: each of the ten Orders has a level, 0 to MAX_CODEX, raised
 * with Order Writs and Tithes. Each level adds CODEX_STEP to the attack, HP
 * and armor of every Sister of that Order, so pulling deep into one Order pays.
 */
export const MAX_CODEX = 10;
export const CODEX_STEP = 0.015;

/** Index n is the cost of level n + 1. */
export const CODEX_COST: { items: Bag; tithes: number }[] = [
  { items: { writ1: 3 }, tithes: 300 },
  { items: { writ1: 5 }, tithes: 500 },
  { items: { writ1: 8 }, tithes: 800 },
  { items: { writ2: 2 }, tithes: 1200 },
  { items: { writ2: 3 }, tithes: 1600 },
  { items: { writ2: 4 }, tithes: 2000 },
  { items: { writ2: 5, writ3: 1 }, tithes: 2600 },
  { items: { writ2: 6, writ3: 1 }, tithes: 3200 },
  { items: { writ3: 2 }, tithes: 4000 },
  { items: { writ3: 3 }, tithes: 5000 },
];

export const codexLevel = (save: SaveData, order: string) => save.codex?.[order] ?? 0;
/** Stat bonus for a Sister of this Order. */
export const codexBonus = (save: SaveData, order: string) => CODEX_STEP * codexLevel(save, order);
/** The Codex id of a Sister's Order (Sisters name their Order; the Codex keys by id). */
export const orderIdOf = (c: Pick<CrusaderDef, 'order'>) => ORDERS[c.order]?.id ?? '';
/** Her stat bonus from her Order's Codex level. */
export const sisterCodexBonus = (save: SaveData, c: Pick<CrusaderDef, 'order'>) => codexBonus(save, orderIdOf(c));
export const sworn = (save: SaveData, order: string) => CRUSADERS.filter((c) => orderIdOf(c) === order && save.owned[c.id]).length;
export const nextCodexCost = (save: SaveData, order: string) => CODEX_COST[codexLevel(save, order)];

export function codexBlock(save: SaveData, order: string): string | undefined {
  const cost = nextCodexCost(save, order);
  if (!cost) return 'Complete';
  if (!sworn(save, order)) return 'Swear a Sister first';
  if (!hasAll(save, cost.items)) return 'Not enough Writs';
  if (save.tithes < cost.tithes) return 'Not enough Tithes';
  return undefined;
}

export function raiseCodex(save: SaveData, order: string): boolean {
  if (codexBlock(save, order)) return false;
  const cost = nextCodexCost(save, order);
  spend(save, cost.items);
  save.tithes -= cost.tithes;
  (save.codex ??= {})[order] = codexLevel(save, order) + 1;
  return true;
}

export const codexOrders = () => ORDER_LIST;
