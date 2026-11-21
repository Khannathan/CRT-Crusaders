import { CRUSADERS } from '../data/crusaders';
import type { Rarity } from '../data/types';
import type { SaveData } from '../state/save';
import { MAX_VOW, RARITY_ORDER, type Rng } from './gacha';
import { claimGear, makeGear, type GearItem } from './gear';
import { dayKey } from './tasks';

/**
 * Matins: a 28-candle login calendar. Each new day lights the next candle.
 * A missed day only waits: the calendar never resets. Candle 28 grants a Vow
 * token for a Sister of the player's choice; then the calendar starts again.
 */
export interface MatinsReward {
  tithes?: number;
  seals?: number;
  gear?: Rarity;
  vowToken?: boolean;
}

export const MATINS_DAYS = 28;

const WEEK: MatinsReward[] = [{ tithes: 150 }, { seals: 1 }, { gear: 'SR' }, { tithes: 200 }, { seals: 1 }, { tithes: 250 }, { seals: 3 }];

export const MATINS: MatinsReward[] = Array.from({ length: MATINS_DAYS }, (_, i) => {
  if (i === 13) return { gear: 'SSR' };
  if (i === 20) return { seals: 5 };
  if (i === 27) return { vowToken: true };
  return WEEK[i % 7];
});

export interface MatinsState {
  /** Candles lit in this cycle, 0-28. */
  lit: number;
  /** Local day of the last candle, so only one is lit per day. */
  last?: string;
}

export const matinsOf = (save: SaveData): MatinsState => (save.matins ??= { lit: 0 });

/** True if today's candle is still unlit. */
export const matinsReady = (save: SaveData, now = Date.now()) => matinsOf(save).last !== dayKey(now);

export const matinsText = (r: MatinsReward) =>
  r.vowToken ? 'Vow token' : r.gear ? `${r.gear} gear` : r.seals ? `${r.seals} Seal${r.seals > 1 ? 's' : ''}` : `${r.tithes} Tithes`;

/** Sisters who can still take a Vow token, best first. */
export function vowCandidates(save: SaveData) {
  return CRUSADERS.filter((c) => {
    const o = save.owned[c.id];
    return o && o.vow + (o.tokens ?? 0) < MAX_VOW;
  }).sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity));
}

export interface MatinsClaim {
  reward: MatinsReward;
  gear?: GearItem;
  /** The day number just lit, 1-28. */
  day: number;
}

/**
 * Lights today's candle and pays it. A Vow token needs `sisterId` (any Sister
 * from vowCandidates); with no one eligible it pays 5 Seals instead.
 */
export function lightCandle(save: SaveData, now = Date.now(), sisterId?: string, rng: Rng = Math.random): MatinsClaim | undefined {
  const m = matinsOf(save);
  if (!matinsReady(save, now)) return undefined;
  const day = m.lit + 1;
  const reward = MATINS[m.lit];
  let gear: GearItem | undefined;
  if (reward.vowToken) {
    const candidates = vowCandidates(save);
    if (candidates.length) {
      const id = candidates.some((c) => c.id === sisterId) ? sisterId! : undefined;
      if (!id) return undefined;
      const o = save.owned[id];
      o.tokens = (o.tokens ?? 0) + 1;
    } else save.seals += 5;
  }
  save.tithes += reward.tithes ?? 0;
  save.seals += reward.seals ?? 0;
  if (reward.gear) {
    const before = save.gear?.length ?? 0;
    claimGear(save, [makeGear(rng, reward.gear)]);
    if ((save.gear?.length ?? 0) > before) gear = save.gear![save.gear!.length - 1];
  }
  m.last = dayKey(now);
  m.lit = day >= MATINS_DAYS ? 0 : day;
  return { reward, gear, day };
}
