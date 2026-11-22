import { CRUSADERS } from '../data/crusaders';
import { ENCOUNTERS, ENEMIES } from '../data/enemies';
import { ORDER_LIST } from '../data/orders';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';
import type { Battle } from './combat';
import { BELFRY, OSSUARY, skirmish } from './crusade';
import type { Rng } from './gacha';
import { claimGear, makeGear, rollGearRarity, type GearItem } from './gear';
import { recommendedPower } from './power';
import { bagText, floorDrops, give, type Bag } from './items';
import { track } from './tasks';

/**
 * The Bell Tower: an endless climb of fixed floors. A boss every 10th floor;
 * some floors admit only one Order, others only R and SR Sisters, so a wide
 * roster climbs higher. No entry limit: a loss costs nothing. Each floor pays
 * once, on its first clear.
 */
export const TOWER_FLOORS = 60;

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
  if (!boss && floor % 10 === 5) rule = { kind: 'order', order: ORDER_LIST[Math.floor(floor / 10) % ORDER_LIST.length].name };
  else if (!boss && floor % 10 === 8) rule = { kind: 'humble' };
  // Gentler under an Order lock: the player's pool is narrower.
  const scale = (0.8 + 0.1 * (floor - 1)) * (rule?.kind === 'order' ? 0.85 : 1);
  return { floor, encounter, scale, boss, rule };
}

export const ruleText = (r: FloorRule) => (!r ? '' : r.kind === 'order' ? `Only Sisters of the ${r.order}` : 'Only R and SR Sisters');

export const allowedOn = (r: FloorRule) => (c: CrusaderDef) => !r || (r.kind === 'order' ? c.order === r.order : c.rarity === 'R' || c.rarity === 'SR');

export const foesOf = (f: FloorDef) => ENCOUNTERS[f.encounter].map((t) => ENEMIES[t].name).join(', ');

export interface TowerState {
  /** Highest floor cleared. */
  best: number;
}

export const towerOf = (save: SaveData): TowerState => (save.tower ??= { best: 0 });

export interface FloorReward {
  tithes: number;
  seals: number;
  gear?: 'SR' | 'SSR';
  items: Bag;
}

export function floorReward(floor: number): FloorReward {
  const boss = floor % 10 === 0;
  return { tithes: 60 + 15 * floor, seals: boss ? 3 : floor % 5 === 0 ? 1 : 0, gear: boss ? 'SSR' : floor % 5 === 0 ? 'SR' : undefined, items: floorDrops(floor) };
}

export const rewardLine = (r: FloorReward, withItems = true) =>
  [`${r.tithes} Tithes`, r.seals ? `${r.seals} Seal${r.seals > 1 ? 's' : ''}` : '', r.gear ? `${r.gear}+ gear` : '', withItems ? bagText(r.items) : ''].filter(Boolean).join(' + ');

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
  if (!won || floor !== t.best + 1 || floor > TOWER_FLOORS) return { won };
  t.best = floor;
  track(save, 'towerFloor');
  const reward = floorReward(floor);
  save.tithes += reward.tithes;
  save.seals += reward.seals;
  give(save, reward.items);
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
