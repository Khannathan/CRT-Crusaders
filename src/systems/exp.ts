import type { OwnedCrusader, SaveData } from '../state/save';
import type { Battle } from './combat';
import { countOf, spend, type Bag, type ItemId } from './items';
import { recommendedPower } from './power';
import { levelCap } from './stats';
import { track } from './tasks';

/**
 * Sister EXP. Each level needs more EXP than the last on a gentle quadratic
 * curve (10L² + 100L): early levels fly by, later ones take real play, and
 * Ascension caps (20, 30, 40, 50) act as walls, as in Genshin Impact.
 *
 * EXP comes three ways:
 * - Battle EXP: every Sister standing after a won fight, free and automatic
 *   (Epic Seven style), scaled by how strong the foes were.
 * - The Vigil: its Sisters gain EXP every hour you are away (AFK Arena style).
 * - Unction: EXP items in three sizes (1:5:25, so refining loses nothing),
 *   fed on her Grow tab for 1 Tithe per 10 EXP (Genshin's Mora rule).
 *
 * At her level cap EXP banks up to one full level, waiting for Ascension.
 */
export const expToNext = (level: number) => 10 * level * level + 100 * level;

/** EXP from level 1 to `level`. */
export const expTotal = (level: number) => {
  let n = 0;
  for (let l = 1; l < level; l++) n += expToNext(l);
  return n;
};

export const UNCTIONS: ItemId[] = ['unction1', 'unction2', 'unction3'];
export const UNCTION_EXP: Record<string, number> = { unction1: 300, unction2: 1500, unction3: 7500 };
/** Tithes per EXP fed from Unction. */
export const TITHES_PER_EXP = 0.1;
/** Battle EXP per point of the foes' recommended Power. */
export const BATTLE_EXP = 0.1;

export const expOf = (o: Pick<OwnedCrusader, 'exp'>) => o.exp ?? 0;

/** EXP still banked at her cap (shown as a full bar). */
export const capFull = (o: OwnedCrusader) => o.level >= levelCap(o) && expOf(o) >= expToNext(o.level);

/**
 * Adds EXP to a Sister and levels her up as far as it reaches (never past her
 * cap; the rest banks up to one level). Returns levels gained.
 */
export function addExp(save: SaveData, id: string, amount: number): number {
  const o = save.owned[id];
  if (!o || amount < 0) return 0;
  const cap = levelCap(o);
  let exp = expOf(o) + Math.floor(amount);
  let gained = 0;
  while (o.level < cap && exp >= expToNext(o.level)) {
    exp -= expToNext(o.level);
    o.level += 1;
    gained += 1;
    track(save, 'levelUp');
  }
  o.exp = o.level >= cap ? Math.min(exp, expToNext(o.level)) : exp;
  return gained;
}

/** After Ascension raises her cap, EXP banked at the old cap flows on. */
export const settleExp = (save: SaveData, id: string) => addExp(save, id, 0);

/** Battle EXP for a won fight: each Sister still standing earns it. */
export function battleExp(battle: Battle) {
  return Math.max(20, Math.round(recommendedPower(battle) * BATTLE_EXP));
}

/** Gives a won battle's EXP to the Sisters standing; returns what each got and who levelled. */
export function expBattle(save: SaveData, battle: Battle): { exp: number; levelled: string[] } {
  if (battle.outcome() !== 'victory') return { exp: 0, levelled: [] };
  const exp = battleExp(battle);
  const levelled: string[] = [];
  for (const u of battle.units) if (u.side === 'party' && u.hp > 0 && save.owned[u.ref] && addExp(save, u.ref, exp)) levelled.push(u.ref);
  return { exp, levelled };
}

export interface FeedPlan {
  /** Levels she reaches. */
  levels: number;
  /** Unction to spend. */
  items: Bag;
  exp: number;
  tithes: number;
  /** Why no level can be reached, or undefined. */
  block?: 'cap' | 'unction' | 'tithes';
}

/**
 * What it takes to raise her `n` levels (or as many as Unction and Tithes
 * allow): the biggest flasks that fit first, then the smallest that tops up.
 */
export function feedPlan(save: SaveData, id: string, n: number): FeedPlan {
  const o = save.owned[id];
  const empty = (block: FeedPlan['block']): FeedPlan => ({ levels: 0, items: {}, exp: 0, tithes: 0, block });
  if (!o) return empty('cap');
  const cap = levelCap(o);
  const target0 = Math.min(cap, o.level + n);
  if (target0 <= o.level) return empty('cap');
  for (let target = target0; target > o.level; target--) {
    let need = 0;
    for (let l = o.level; l < target; l++) need += expToNext(l);
    need -= expOf(o);
    const have = Object.fromEntries(UNCTIONS.map((u) => [u, countOf(save, u)]));
    const items: Bag = {};
    let fed = 0;
    for (const u of [...UNCTIONS].reverse()) {
      const k = Math.min(have[u], Math.floor((need - fed) / UNCTION_EXP[u]));
      if (k > 0) (items[u] = k), (have[u] -= k), (fed += k * UNCTION_EXP[u]);
    }
    for (const u of UNCTIONS) {
      while (fed < need && have[u] > 0) (items[u] = (items[u] ?? 0) + 1), have[u]--, (fed += UNCTION_EXP[u]);
    }
    if (fed < need) continue;
    const tithes = Math.ceil(fed * TITHES_PER_EXP);
    if (tithes > save.tithes) continue;
    return { levels: target - o.level, items, exp: fed, tithes };
  }
  // Nothing reachable: say what is short for the next level.
  const next = expToNext(o.level) - expOf(o);
  const total = UNCTIONS.reduce((s, u) => s + countOf(save, u) * UNCTION_EXP[u], 0);
  return empty(total < next ? 'unction' : 'tithes');
}

/** Feeds Unction to raise her up to `n` levels. Returns levels gained. */
export function feed(save: SaveData, id: string, n: number): number {
  const p = feedPlan(save, id, n);
  if (!p.levels || !spend(save, p.items)) return 0;
  save.tithes -= p.tithes;
  return addExp(save, id, p.exp);
}

/** Vigil EXP per hour for each of its Sisters, from the road. */
export const vigilExpRate = (best: number) => 120 * (1 + 0.1 * best);

/** EXP she can still take before her cap is full (one level banks at the cap). */
export function expRoom(save: SaveData, id: string): number {
  const o = save.owned[id];
  if (!o) return 0;
  const cap = levelCap(o);
  let room = 0;
  for (let l = o.level; l <= cap; l++) room += expToNext(l);
  return Math.max(0, room - expOf(o));
}

export interface UsePlan {
  /** Flasks of the chosen Unction to use. */
  count: number;
  tithes: number;
  exp: number;
  /** Why none can be used, or undefined. */
  block?: 'cap' | 'unction' | 'tithes';
}

/**
 * Using one chosen Unction: `n` flasks (Infinity for all she can take), or
 * `level: true` for just enough to reach her next level. Never wastes a flask
 * past her full cap, and stops where Tithes run out.
 */
export function usePlan(save: SaveData, id: string, u: ItemId, n: number, level = false): UsePlan {
  const o = save.owned[id];
  const per = UNCTION_EXP[u] ?? 0;
  const none = (block: UsePlan['block']): UsePlan => ({ count: 0, tithes: 0, exp: 0, block });
  if (!o || !per) return none('cap');
  const room = expRoom(save, id);
  if (room <= 0 || o.level >= levelCap(o)) return none('cap');
  const want = level ? Math.ceil(Math.max(1, expToNext(o.level) - expOf(o)) / per) : n;
  const held = countOf(save, u);
  if (held <= 0) return none('unction');
  if (level && held < want) return none('unction');
  const perTithes = per * TITHES_PER_EXP;
  const afford = Math.floor(save.tithes / perTithes);
  const count = Math.min(want, held, Math.ceil(room / per), afford);
  if (count <= 0) return none('tithes');
  if (level && count < want) return none('tithes');
  return { count, tithes: Math.ceil(count * perTithes), exp: count * per };
}

/** Uses the chosen Unction by plan. Returns levels gained (or -1 when nothing was used). */
export function useUnction(save: SaveData, id: string, u: ItemId, n: number, level = false): number {
  const p = usePlan(save, id, u, n, level);
  if (!p.count || !spend(save, { [u]: p.count })) return -1;
  save.tithes -= p.tithes;
  return addExp(save, id, p.exp);
}
