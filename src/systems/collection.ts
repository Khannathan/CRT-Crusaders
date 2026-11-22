import { CRUSADERS } from '../data/crusaders';
import type { CrusaderDef } from '../data/types';
import { ORDER_LIST } from '../data/orders';
import type { SaveData } from '../state/save';
import { orderIdOf } from './codex';

/**
 * The Order Book: every Sister, by Order. Each Order has one small set, its R
 * and SR Sisters; completing it pays Seals and a title. URs and SSRs never
 * count toward a set, and sets give no combat power.
 */
export interface SetDef {
  id: string;
  order: string;
  name: string;
  members: string[];
  seals: number;
  title: string;
}

export const SET_SEALS = 10;
export const GRAND_SET = 'all-orders';
export const GRAND_SEALS = 30;
export const GRAND_TITLE = 'Keeper of Every Order';

export const sistersOf = (order: string): CrusaderDef[] =>
  CRUSADERS.filter((c) => orderIdOf(c) === order).sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || a.name.localeCompare(b.name));
const rarityRank = (r: string) => ['R', 'SR', 'SSR', 'UR'].indexOf(r);

export const SETS: SetDef[] = ORDER_LIST.map((o) => ({
  id: `faithful:${o.id}`,
  order: o.id,
  name: `The ${o.name} Faithful`,
  members: CRUSADERS.filter((c) => orderIdOf(c) === o.id && (c.rarity === 'R' || c.rarity === 'SR')).map((c) => c.id),
  seals: SET_SEALS,
  title: `Faithful of the ${o.name}`,
}));

export const setOf = (order: string) => SETS.find((s) => s.order === order)!;
export const setHave = (save: SaveData, set: SetDef) => set.members.filter((id) => save.owned[id]).length;
export const setDone = (save: SaveData, set: SetDef) => setHave(save, set) === set.members.length;
export const setClaimed = (save: SaveData, id: string) => (save.sets ?? []).includes(id);
export const grandDone = (save: SaveData) => SETS.every((s) => setClaimed(save, s.id));

export function claimable(save: SaveData): string[] {
  const out = SETS.filter((s) => setDone(save, s) && !setClaimed(save, s.id)).map((s) => s.id);
  if (grandDone(save) && !setClaimed(save, GRAND_SET)) out.push(GRAND_SET);
  return out;
}

/** Claims a finished set: Seals and a title. Returns the Seals paid, or 0. */
export function claimSet(save: SaveData, id: string): number {
  if (!claimable(save).includes(id)) return 0;
  const set = SETS.find((s) => s.id === id);
  const seals = set ? set.seals : GRAND_SEALS;
  const title = set ? set.title : GRAND_TITLE;
  (save.sets ??= []).push(id);
  save.seals += seals;
  if (!(save.titles ??= []).includes(title)) save.titles.push(title);
  save.title ??= title;
  return seals;
}

export function wearTitle(save: SaveData, title: string | undefined) {
  if (title === undefined || (save.titles ?? []).includes(title)) save.title = title;
}

/** Sisters sworn in an Order, of how many. */
export const orderCount = (save: SaveData, order: string) => {
  const all = sistersOf(order);
  return { have: all.filter((c) => save.owned[c.id]).length, of: all.length };
};
