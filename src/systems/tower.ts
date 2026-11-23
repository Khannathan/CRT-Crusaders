import { boostBag, boostMult } from './boosts';
import { CRUSADERS } from '../data/crusaders';
import { earn } from './currency';
import { ENCOUNTERS, ENEMIES } from '../data/enemies';
import { ORDER_LIST } from '../data/orders';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';
import type { Battle } from './combat';
import { BELFRY, OSSUARY, skirmish } from './crusade';
import type { Rng } from './gacha';
import { claimGear, makeGear, rollGearRarity, type GearItem } from './gear';
import { recommendedPower } from './power';
import { addBags, bagText, floorDrops, give, type Bag } from './items';
import { track } from './tasks';
import { addStigmata } from './tiers';

/**
 * The Bell Tower: an endless climb open to any Sisters. A boss every 10th
 * floor; some floors admit only R and SR Sisters, so a wide roster climbs higher.
 * Beside it stand the Order Towers (round 9): one per Order, fifty floors each,
 * climbed only by a full party of that Order's Sisters, paying Order Writs.
 * No entry limit: a loss costs nothing. Each floor pays once, on its first clear.
 *
 * Foes grow in a straight line to floor TOWER_FLOORS, then by TOWER_GROWTH a
 * floor without end, so every bit of Power a party gains buys a few more floors
 * (a maxed party tops out near floor 100).
 */
export const TOWER_FLOORS = 60;
export const TOWER_GROWTH = 1.09;
/** Floors listed above the next one. */
export const TOWER_LOOKAHEAD = 30;

const linearScale = (floor: number) => 0.8 + 0.1 * (floor - 1);
export const towerScale = (floor: number) => (floor <= TOWER_FLOORS ? linearScale(floor) : linearScale(TOWER_FLOORS) * TOWER_GROWTH ** (floor - TOWER_FLOORS));

export type FloorRule = { kind: 'order'; order: string } | { kind: 'humble' } | undefined;

export interface FloorDef {
  floor: number;
  encounter: string;
  /** Enemy HP and attack multiplier. */
  scale: number;
  boss: boolean;
  rule: FloorRule;
}

const POOL = ['ossuary-1', 'ossuary-2', 'ossuary-3', 'ossuary-4', 'ossuary-5', 'belfry-1', 'belfry-2', 'belfry-3', 'belfry-4', 'belfry-5'];
const ELITES = ['ossuary-elite-1', 'ossuary-elite-2', 'belfry-elite-1', 'belfry-elite-2'];

export function floorDef(floor: number): FloorDef {
  const boss = floor % 10 === 0;
  const encounter = boss ? (floor % 20 === 10 ? 'choir' : 'abbess') : floor % 3 === 0 ? ELITES[(floor / 3) % ELITES.length] : POOL[(floor * 7) % POOL.length];
  let rule: FloorRule;
  if (!boss && floor % 10 === 8) rule = { kind: 'humble' };
  // Gentler under an Order lock: the player's pool is narrower.
  const scale = towerScale(floor) * (rule?.kind === 'order' ? 0.85 : 1);
  return { floor, encounter, scale, boss, rule };
}

export const ruleText = (r: FloorRule) => (!r ? '' : r.kind === 'order' ? `Only Sisters of the ${r.order}` : 'Only R and SR Sisters');

export const allowedOn = (r: FloorRule) => (c: CrusaderDef) => !r || (r.kind === 'order' ? c.order === r.order : c.rarity === 'R' || c.rarity === 'SR');

export const foesOf = (f: FloorDef) => ENCOUNTERS[f.encounter].map((t) => ENEMIES[t].name).join(', ');

export interface TowerState {
  /** Highest floor cleared. */
  best: number;
  /** Highest floor cleared in each Order Tower, by Order name. */
  orders?: Record<string, number>;
}

export const towerOf = (save: SaveData): TowerState => (save.tower ??= { best: 0 });

export interface FloorReward {
  tithes: number;
  seals: number;
  gear?: 'SR' | 'SSR';
  items: Bag;
  gilt: number;
  stigmata?: number;
}

export function floorReward(floor: number): FloorReward {
  const boss = floor % 10 === 0;
  return { tithes: 60 + 15 * floor, seals: boss ? 3 : floor % 5 === 0 ? 1 : 0, gear: boss ? 'SSR' : floor % 5 === 0 ? 'SR' : undefined, items: boss ? addBags(floorDrops(floor), { armory1: 5 + Math.floor(floor / 10) }, floor % 50 === 0 ? { armory2: 2 } : {}) : floorDrops(floor), gilt: boss ? 30 + floor : 0, stigmata: boss ? 1 + Math.floor(floor / 30) : 0 };
}

export const rewardLine = (r: FloorReward, withItems = true) =>
  [`${r.tithes} Tithes`, r.seals ? `${r.seals} Seal${r.seals > 1 ? 's' : ''}` : '', r.gear ? `${r.gear}+ gear` : '', r.gilt ? `${r.gilt} Gilt` : '', r.stigmata ? `${r.stigmata} Stigmata` : '', withItems ? bagText(r.items) : ''].filter(Boolean).join(' + ');

export function towerBattle(save: SaveData, party: string[], floor: number, rng?: Rng): Battle {
  const f = floorDef(floor);
  const allow = allowedOn(f.rule);
  const ids = party.filter((id) => allow(CRUSADERS.find((c) => c.id === id)!));
  return skirmish(save, ids, f.encounter, 0, rng, floor > 30 ? BELFRY : OSSUARY, f.scale);
}

export const floorRecommended = (save: SaveData, floor: number) => recommendedPower(towerBattle(save, [], floor));

/** Records a climb. A victory on the next floor raises the best and pays once. */
export function finishFloor(save: SaveData, floor: number, battle: Battle, rng: Rng = Math.random): { won: boolean; reward?: FloorReward; gear?: GearItem } {
  const t = towerOf(save);
  const won = battle.outcome() === 'victory';
  if (!won || floor !== t.best + 1) return { won };
  t.best = floor;
  track(save, 'towerFloor');
  const base = floorReward(floor);
  const reward = { ...base, tithes: Math.round(base.tithes * boostMult('tower')), items: boostBag(base.items, 'tower') };
  save.tithes += reward.tithes;
  save.seals += reward.seals;
  give(save, reward.items);
  earn(save, reward.gilt);
  addStigmata(save, reward.stigmata ?? 0);
  let gear: GearItem | undefined;
  if (reward.gear) {
    const before = save.gear?.length ?? 0;
    const rarity = rollGearRarity(rng, reward.gear === 'SSR' ? 0.2 : 0.08);
    const r = reward.gear === 'SSR' && (rarity === 'R' || rarity === 'SR') ? 'SSR' : rarity === 'R' ? 'SR' : rarity;
    claimGear(save, [makeGear(rng, r)]);
    if ((save.gear?.length ?? 0) > before) gear = save.gear![save.gear!.length - 1];
  }
  return { won, reward, gear };
}

// ---- Order Towers ---------------------------------------------------------

/** Floors in each Order Tower. */
export const ORDER_TOWER_FLOORS = 50;
/** Sisters of the Order a climb takes. */
export const ORDER_PARTY = 4;
/** Order Tower foes against the Bell Tower's at the same floor: one Order is a narrower pool. */
export const ORDER_TOWER_EASE = 0.8;

export const orderBest = (save: SaveData, order: string) => towerOf(save).orders?.[order] ?? 0;

export function orderFloorDef(order: string, floor: number): FloorDef {
  const k = Math.max(0, ORDER_LIST.findIndex((o) => o.name === order)) + 1;
  const boss = floor % 10 === 0;
  const encounter = boss ? ((floor / 10 + k) % 2 ? 'choir' : 'abbess') : floor % 3 === 0 ? ELITES[(floor / 3 + k) % ELITES.length] : POOL[(floor * 7 + k * 3) % POOL.length];
  return { floor, encounter, scale: towerScale(floor) * ORDER_TOWER_EASE, boss, rule: { kind: 'order', order } };
}

/** First-clear spoils: Order Writs for the Codex all the way up, more on bells and bosses. */
export function orderFloorReward(floor: number): FloorReward {
  const boss = floor % 10 === 0;
  const items: Bag = { writ1: 2 + Math.floor(floor / 10) };
  if (floor % 5 === 0) items.writ2 = 1 + Math.floor(floor / 25);
  if (boss) {
    items.writ3 = 1;
    items.armory1 = 4 + floor / 10;
  }
  if (floor === ORDER_TOWER_FLOORS) items.armory2 = 3;
  return { tithes: 80 + 20 * floor, seals: boss ? 3 : 0, items, gilt: boss ? 40 + floor : 0, gear: boss ? 'SSR' : undefined };
}

/** A climb of an Order Tower: only that Order's Sisters take the field. */
export function orderTowerBattle(save: SaveData, party: string[], order: string, floor: number, rng?: Rng): Battle {
  const f = orderFloorDef(order, floor);
  const ids = party.filter((id) => CRUSADERS.find((c) => c.id === id)?.order === order);
  return skirmish(save, ids, f.encounter, 0, rng, floor > 25 ? BELFRY : OSSUARY, f.scale);
}

export const orderFloorRecommended = (save: SaveData, order: string, floor: number) => recommendedPower(orderTowerBattle(save, [], order, floor));

/** Owned Sisters of an Order. */
export const orderSisters = (save: SaveData, order: string) => CRUSADERS.filter((c) => c.order === order && save.owned[c.id]);

/** Records an Order Tower climb: a win on the next floor with a full party of the Order pays once. */
export function finishOrderFloor(save: SaveData, order: string, floor: number, battle: Battle, rng: Rng = Math.random): { won: boolean; reward?: FloorReward; gear?: GearItem } {
  const won = battle.outcome() === 'victory';
  const sisters = battle.units.filter((u) => u.side === 'party' && CRUSADERS.find((c) => c.id === u.ref)?.order === order).length;
  if (!won || floor !== orderBest(save, order) + 1 || floor > ORDER_TOWER_FLOORS || sisters < ORDER_PARTY) return { won };
  (towerOf(save).orders ??= {})[order] = floor;
  track(save, 'towerFloor');
  const base = orderFloorReward(floor);
  const reward = { ...base, tithes: Math.round(base.tithes * boostMult('tower')), items: boostBag(base.items, 'tower') };
  save.tithes += reward.tithes;
  save.seals += reward.seals;
  give(save, reward.items);
  earn(save, reward.gilt);
  let gear: GearItem | undefined;
  if (reward.gear) {
    const before = save.gear?.length ?? 0;
    claimGear(save, [makeGear(rng, 'SSR')]);
    if ((save.gear?.length ?? 0) > before) gear = save.gear![save.gear!.length - 1];
  }
  return { won, reward, gear };
}
