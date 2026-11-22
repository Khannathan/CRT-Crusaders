import { CRUSADERS } from '../data/crusaders';
import { ORDER_LIST } from '../data/orders';
import type { SaveData } from '../state/save';
import { codexLevel, nextCodexCost, orderIdOf, sworn } from './codex';
import { expOf, expToNext } from './exp';
import { COST_TEN, SPARK, shardsOf } from './gacha';
import { countOf, type ItemId } from './items';
import { rankInfo } from './rank';
import { levelCap } from './stats';

/**
 * Real, nearby goals: how far the player is from the next thing worth having.
 * Every number here is true; nothing is padded to look closer than it is.
 */
export interface Goal {
  id: string;
  /** Short line, e.g. "3 Seals to your next 10-pull". */
  text: string;
  /** 0 to 1, how close it is. 1 means it is ready now. */
  frac: number;
  /** Where tapping it goes. */
  scene: string;
  data?: object;
}

const first = (id: string) => CRUSADERS.find((c) => c.id === id)?.name.split(' ')[0] ?? 'A Sister';

export function tenPullGoal(save: SaveData): Goal {
  const left = COST_TEN - save.seals;
  return {
    id: 'ten-pull',
    text: left > 0 ? `${left} Seal${left === 1 ? '' : 's'} to your next 10-pull` : 'A 10-pull is ready at the Altar',
    frac: Math.min(1, save.seals / COST_TEN),
    scene: 'Recruit',
  };
}

export function rankGoal(save: SaveData): Goal | undefined {
  const r = rankInfo(save);
  if (!r.need) return undefined;
  return { id: 'rank', text: `${r.need - r.into} Faith to Rank ${r.rank + 1}`, frac: r.into / r.need, scene: 'Rank' };
}

export function levelGoal(save: SaveData, id: string): Goal | undefined {
  const o = save.owned[id];
  if (!o || o.level >= levelCap(o)) return undefined;
  const need = expToNext(o.level);
  const have = expOf(o);
  return { id: `level:${id}`, text: `${need - have} EXP until ${first(id)} reaches Lv ${o.level + 1}`, frac: Math.min(1, have / need), scene: 'Roster', data: { openId: id } };
}

/** How close an Order's next Codex level is: the scarcest of its Tithes and Writs. */
export function codexGoal(save: SaveData, order: string): Goal | undefined {
  const cost = nextCodexCost(save, order);
  if (!cost || !sworn(save, order)) return undefined;
  const parts: [number, number][] = [[save.tithes, cost.tithes], ...(Object.entries(cost.items) as [ItemId, number][]).map(([id, n]) => [countOf(save, id), n] as [number, number])];
  const frac = Math.min(...parts.map(([have, need]) => Math.min(1, have / need)));
  const name = ORDER_LIST.find((o) => o.id === order)?.name ?? order;
  const writs = (Object.entries(cost.items) as [ItemId, number][]).reduce((n, [id, k]) => n + Math.max(0, k - countOf(save, id)), 0);
  const tithes = Math.max(0, cost.tithes - save.tithes);
  const missing = [writs && `${writs} Writ${writs === 1 ? '' : 's'}`, tithes && `${tithes} Tithes`].filter(Boolean).join(' and ');
  return {
    id: `codex:${order}`,
    text: missing ? `${missing} to raise the ${name} Codex to ${codexLevel(save, order) + 1}` : `The ${name} Codex can rise to ${codexLevel(save, order) + 1}`,
    frac,
    scene: 'Reliquary',
    data: { tab: 'codex' },
  };
}

export function sparkGoal(save: SaveData): Goal | undefined {
  let best: Goal | undefined;
  for (const o of ORDER_LIST) {
    const n = shardsOf(save, o.id);
    if (!n) continue;
    const g: Goal = { id: `spark:${o.id}`, text: n >= SPARK ? `Choose a ${o.name} UR with your Relic Shards` : `${SPARK - n} Relic Shards to choose a ${o.name} UR`, frac: Math.min(1, n / SPARK), scene: 'Recruit' };
    if (!best || g.frac > best.frac) best = g;
  }
  return best;
}

/** The Order with the most of these Sisters in it. */
export function leadOrder(ids: string[]): string | undefined {
  const count = new Map<string, number>();
  for (const id of ids) {
    const c = CRUSADERS.find((x) => x.id === id);
    if (c) count.set(orderIdOf(c), (count.get(orderIdOf(c)) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** Goals, closest first. Ready goals (frac 1) lead. */
export function nearGoals(save: SaveData, focus: string[] = save.lastParty ?? []): Goal[] {
  const out: (Goal | undefined)[] = [tenPullGoal(save), rankGoal(save), sparkGoal(save)];
  for (const id of focus) out.push(levelGoal(save, id));
  for (const o of ORDER_LIST) out.push(codexGoal(save, o.id));
  return out.filter((g): g is Goal => !!g).sort((a, b) => b.frac - a.frac);
}
