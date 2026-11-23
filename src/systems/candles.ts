import type { SaveData } from '../state/save';
import { earn } from './currency';
import { campaignOf } from './campaign';

/**
 * Candles: three small vows on every stage of the Pilgrim's Road, lit by how a
 * stage is won (like star ratings). Each one lit for the first time pays a
 * little Gilt; lighting all three on a stage pays a Seal. A reason to walk the
 * road again with a stronger party.
 */

export interface CandleDef {
  id: 'unbroken' | 'chain' | 'swift';
  /** Shown under the candle. */
  label: string;
}

/** Battle seconds (field time, not wall time) to win inside for the third candle. */
export const SWIFT_SEC = 45;
/** Litanies linked in one Chain for the second candle. */
export const CHAIN_NEED = 3;
/** Gilt for each candle lit for the first time. */
export const CANDLE_GILT = 10;
/** Seals for lighting all three on one stage. */
export const CANDLE_SET_SEALS = 1;

export const CANDLES: CandleDef[] = [
  { id: 'unbroken', label: 'No Sister fell' },
  { id: 'chain', label: `Chain of ${CHAIN_NEED}` },
  { id: 'swift', label: `Under ${SWIFT_SEC} s` },
];

/** What the battle screen saw, handed to the stage's settlement. */
export interface FightStats {
  fallen: number;
  chainBest: number;
  secs: number;
}

let last: FightStats | undefined;
/** The battle screen notes the fight just won (read once by the stage's settlement). */
export function noteFight(s: FightStats) {
  last = s;
}
/** The last fight's stats, cleared on read. */
export function takeFight(): FightStats | undefined {
  const s = last;
  last = undefined;
  return s;
}

/** Which candles a win lights. */
export function candlesFor(s: FightStats): boolean[] {
  return [s.fallen === 0, s.chainBest >= CHAIN_NEED, s.secs <= SWIFT_SEC];
}

const bits = (lit: boolean[]) => lit.reduce((m, on, i) => (on ? m | (1 << i) : m), 0);
const count = (m: number) => [0, 1, 2].filter((i) => m & (1 << i)).length;

/** Candles already lit on a stage (best ever). */
export function stageCandles(save: SaveData, n: number): boolean[] {
  const m = campaignOf(save).candles?.[n] ?? 0;
  return [0, 1, 2].map((i) => !!(m & (1 << i)));
}

/** Total candles lit across the road. */
export function totalCandles(save: SaveData): number {
  return Object.values(campaignOf(save).candles ?? {}).reduce((a, m) => a + count(m), 0);
}

export interface CandleResult {
  /** Lit in this fight. */
  lit: boolean[];
  /** Lit for the first time ever in this fight. */
  fresh: boolean[];
  gilt: number;
  seals: number;
}

/** Records a won stage's candles and pays for the new ones. */
export function lightCandles(save: SaveData, n: number, s: FightStats): CandleResult {
  const c = campaignOf(save);
  const lit = candlesFor(s);
  const before = c.candles?.[n] ?? 0;
  const after = before | bits(lit);
  const fresh = lit.map((on, i) => on && !(before & (1 << i)));
  const gilt = fresh.filter(Boolean).length * CANDLE_GILT;
  const seals = count(after) === 3 && count(before) < 3 ? CANDLE_SET_SEALS : 0;
  if (after !== before) (c.candles ??= {})[n] = after;
  if (gilt) earn(save, gilt);
  save.seals += seals;
  return { lit, fresh, gilt, seals };
}
