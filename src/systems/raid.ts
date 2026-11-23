import type { SaveData } from '../state/save';
import type { Battle } from './combat';
import { CRYPTS, skirmish, type CryptDef } from './crusade';
import { earn } from './currency';
import type { Rng } from './gacha';
import { give, type Bag } from './items';
import { CP, foePower, partyPower } from './power';
import { dayKey, weekKey } from './tasks';

/**
 * The Nightmare Raid: three bosses in a row, fought by up to three Squads
 * (parties of four; no Sister in two Squads). One delve a day. A Squad that
 * falls is spent for the delve, and the next Squad picks up the fight against
 * the wounded boss: its HP carries. A Squad that wins rests and goes on to
 * the next boss. Bosses are set against your Squads' own Power, so the raid
 * asks for depth, not one strong party. Each boss slain pays; the week's
 * first full clear pays a chest.
 */
export const RAID_BOSSES = 3;
export const RAID_SQUADS = 3;
export const SQUAD_SIZE = 4;
/** Each boss asks this share of the average Squad's Power. */
export const RAID_SHARE = [1.3, 1.8, 2.4];

export interface Delve {
  /** Boss being fought (0-2). */
  boss: number;
  /** Its HP left, as a share of full. */
  hp: number;
  /** Squad fighting now (0-2). */
  squad: number;
  slain: number;
}

export interface RaidState {
  week: string;
  day: string;
  /** Delves begun today. */
  used: number;
  squads: string[][];
  /** Best bosses slain this week, and whether the clear chest was paid. */
  best: number;
  cleared: boolean;
  delve?: Delve;
}

export function raidOf(save: SaveData, now = Date.now()): RaidState {
  const r = (save.raid ??= { week: weekKey(now), day: dayKey(now), used: 0, squads: [[], [], []], best: 0, cleared: false });
  if (r.week !== weekKey(now)) {
    r.week = weekKey(now);
    r.best = 0;
    r.cleared = false;
  }
  if (r.day !== dayKey(now)) {
    r.day = dayKey(now);
    r.used = 0;
    r.delve = undefined;
  }
  // Sisters who left the Order drop out of their Squads.
  r.squads = r.squads.map((s) => s.filter((id) => save.owned[id]));
  return r;
}

export const delvesLeft = (save: SaveData, now = Date.now()) => (raidOf(save, now).used >= 1 ? 0 : 1);

/** The week's three bosses: three crypts' hearts, turning each week. */
export function raidCrypts(now = Date.now()): CryptDef[] {
  const k = weekKey(now);
  let h = 0;
  for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: RAID_BOSSES }, (_, i) => CRYPTS[(h + i * 3) % CRYPTS.length]);
}

/** Sets a Squad; any Sister in it leaves the other Squads. */
export function setSquad(save: SaveData, i: number, ids: string[], now = Date.now()) {
  const r = raidOf(save, now);
  const pick = ids.filter((id) => save.owned[id]).slice(0, SQUAD_SIZE);
  r.squads = r.squads.map((s, j) => (j === i ? pick : s.filter((id) => !pick.includes(id))));
}

const filled = (r: RaidState) => r.squads.filter((s) => s.length);

export function raidBlock(save: SaveData, now = Date.now()): string | undefined {
  const r = raidOf(save, now);
  if (r.delve) return undefined;
  if (r.used >= 1) return 'One delve a day';
  if (!filled(r).length) return 'Form a Squad first';
  return undefined;
}

export function beginDelve(save: SaveData, now = Date.now()): Delve | undefined {
  const r = raidOf(save, now);
  if (raidBlock(save, now) || r.delve) return r.delve;
  r.used++;
  const first = r.squads.findIndex((s) => s.length);
  r.delve = { boss: 0, hp: 1, squad: first, slain: 0 };
  return r.delve;
}

const EMPTY = { owned: {} } as unknown as SaveData;

/** The average Power of the Squads formed. */
export function squadPower(save: SaveData, now = Date.now()) {
  const s = filled(raidOf(save, now));
  return s.length ? s.reduce((n, sq) => n + partyPower(save, sq), 0) / s.length : 0;
}

export function raidTarget(save: SaveData, boss: number, now = Date.now()) {
  return Math.max(2000, Math.round(squadPower(save, now) * RAID_SHARE[boss]));
}

function scaleFor(crypt: CryptDef, target: number) {
  const c = { ...crypt, power: 1 };
  const rec = (k: number) => foePower(skirmish(EMPTY, [], crypt.boss, 0, undefined, c, k)) * CP.recommend;
  let v = 1;
  for (let i = 0; i < 3; i++) v *= target / rec(v);
  return v;
}

/** The fight now: the Squad up against the boss, wounded as it was left. */
export function delveBattle(save: SaveData, rng?: Rng, now = Date.now()): Battle | undefined {
  const r = raidOf(save, now);
  const d = r.delve;
  if (!d) return undefined;
  const crypt = raidCrypts(now)[d.boss];
  const b = skirmish(save, r.squads[d.squad], crypt.boss, 0, rng, { ...crypt, power: 1 }, scaleFor(crypt, raidTarget(save, d.boss, now)));
  const boss = b.units.find((u) => u.side === 'enemy' && u.boss);
  if (boss) boss.hp = Math.max(1, Math.round(boss.maxHp * d.hp));
  return b;
}

export const BOSS_REWARD: { tithes: number; gilt: number; items: Bag }[] = [
  { tithes: 3000, gilt: 10, items: { canon1: 4, ash2: 2 } },
  { tithes: 5000, gilt: 20, items: { canon2: 1, ash3: 1 } },
  { tithes: 8000, gilt: 40, items: { canon2: 2, canon3: 1 } },
];
export const CLEAR_CHEST = { seals: 5, gilt: 60, items: { canon3: 1 } as Bag };

export interface DelveStep {
  won: boolean;
  /** The boss fell this fight. */
  slain: boolean;
  over: boolean;
  reward?: { tithes: number; gilt: number; items: Bag };
  chest?: boolean;
  /** Boss HP left (share), when it lived. */
  hp: number;
}

/** After a raid fight: the boss's wounds carry, the Squad goes on or is spent. */
export function finishDelve(save: SaveData, outcome: 'victory' | 'defeat', battle: Battle, now = Date.now()): DelveStep {
  const r = raidOf(save, now);
  const d = r.delve;
  if (!d) return { won: false, slain: false, over: true, hp: 0 };
  const boss = battle.units.find((u) => u.side === 'enemy' && u.boss);
  const slain = outcome === 'victory';
  let reward: DelveStep['reward'];
  if (slain) {
    reward = BOSS_REWARD[d.boss];
    save.tithes += reward.tithes;
    earn(save, reward.gilt);
    give(save, reward.items);
    d.slain++;
    d.boss++;
    d.hp = 1;
  } else {
    d.hp = boss ? Math.max(0.01, boss.hp / boss.maxHp) : d.hp;
    // The next Squad with anyone in it takes over.
    let next = d.squad + 1;
    while (next < RAID_SQUADS && !r.squads[next].length) next++;
    d.squad = next;
  }
  const over = d.boss >= RAID_BOSSES || d.squad >= RAID_SQUADS;
  let chest = false;
  if (over) {
    r.best = Math.max(r.best, d.slain);
    if (d.slain >= RAID_BOSSES && !r.cleared) {
      r.cleared = true;
      chest = true;
      save.seals += CLEAR_CHEST.seals;
      earn(save, CLEAR_CHEST.gilt);
      give(save, CLEAR_CHEST.items);
    }
    r.delve = undefined;
  }
  return { won: slain, slain, over, reward, chest, hp: slain ? 0 : d.hp };
}
