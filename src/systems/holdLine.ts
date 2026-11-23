import type { SaveData } from '../state/save';
import type { Battle } from './combat';
import { CRYPTS, makeBattle, maxHpOf, skirmish, type CryptDef, type RunState } from './crusade';
import { earn } from './currency';
import type { Rng } from './gacha';
import { give, type Bag } from './items';
import { CP, foePower, partyPower } from './power';
import { dayKey } from './tasks';

/**
 * Hold the Line: a daily wave defense. One stand a day, ten waves back to back
 * with one party. Wounds carry from wave to wave and the fallen stay down.
 * Between waves the Sisters take one of three blessings. Foes are set against
 * the party's own Power, so wave 1 is easy and wave 10 is far past it: the
 * score is how many waves held. The stand pays Canon materials, Gilt and
 * Tithes by waves held, and the best stand is kept.
 */
export const HOLD_WAVES = 10;

export type BlessingId = 'mend' | 'zeal' | 'wrath' | 'ward' | 'raise' | 'haste';
export interface Blessing {
  id: BlessingId;
  name: string;
  desc: string;
}
export const BLESSINGS: Blessing[] = [
  { id: 'mend', name: 'Bell of Rest', desc: 'Heal every Sister 35% now.' },
  { id: 'zeal', name: 'Kindled Psalm', desc: 'Every wave after this starts with +25 Zeal.' },
  { id: 'wrath', name: 'Holy Oil', desc: '+12% damage for the rest of the stand.' },
  { id: 'ward', name: 'Iron Bars', desc: 'Every wave starts with a shield of 15% HP.' },
  { id: 'raise', name: 'Last Rites', desc: 'Fallen Sisters rise at 40% HP.' },
  { id: 'haste', name: 'Quickened Step', desc: '+8% Speed for the rest of the stand.' },
];

export interface HoldStand {
  party: string[];
  /** Waves held so far (the next wave is held + 1). */
  held: number;
  /** HP left per Sister (0 = fallen). */
  hp: Record<string, number>;
  blessings: BlessingId[];
  /** Blessings on offer after the last wave (pick one before the next). */
  offer?: BlessingId[];
}

export interface HoldState {
  day: string;
  /** Stands begun today. */
  used: number;
  best: number;
  /** Best today. */
  today: number;
  stand?: HoldStand;
}

export function holdOf(save: SaveData, now = Date.now()): HoldState {
  const h = (save.holdLine ??= { day: dayKey(now), used: 0, best: 0, today: 0 });
  if (h.day !== dayKey(now)) {
    h.day = dayKey(now);
    h.used = 0;
    h.today = 0;
    // A stand left open from yesterday ends where it stood (already paid wave by wave).
    h.stand = undefined;
  }
  return h;
}

export const HOLD_STANDS = 1;
export const holdLeft = (save: SaveData, now = Date.now()) => Math.max(0, HOLD_STANDS - holdOf(save, now).used);

/** Today's crypt: its foes pour through the doors. */
export function holdCrypt(now = Date.now()): CryptDef {
  const k = dayKey(now);
  let h = 0;
  for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CRYPTS[h % CRYPTS.length];
}

/** Wave n: plain fights, an elite on 4 and 9, the crypt's boss on 5 and 10. */
export function waveEncounter(crypt: CryptDef, n: number) {
  if (n % 5 === 0) return crypt.boss;
  if (n % 5 === 4) return crypt.elites[(n >> 2) % crypt.elites.length];
  return crypt.late[n % crypt.late.length];
}

/** Wave n asks this share of the party's own Power: 0.6 at wave 1, 3 at wave 10, growing evenly by ratio. */
export const WAVE_FIRST = 0.6;
export const WAVE_LAST = 3;
export const waveShare = (n: number) => WAVE_FIRST * (WAVE_LAST / WAVE_FIRST) ** ((n - 1) / (HOLD_WAVES - 1));

const EMPTY = { owned: {} } as unknown as SaveData;

function waveScale(crypt: CryptDef, n: number, target: number) {
  const c = { ...crypt, power: 1 };
  const enc = waveEncounter(crypt, n);
  const rec = (k: number) => foePower(skirmish(EMPTY, [], enc, 0, undefined, c, k)) * CP.recommend;
  let v = 1;
  for (let i = 0; i < 3; i++) v *= target / rec(v);
  return v;
}

/** Begins today's stand with this party. */
export function beginStand(save: SaveData, party: string[], now = Date.now()): HoldStand | undefined {
  const h = holdOf(save, now);
  if (h.used >= HOLD_STANDS || !party.length) return undefined;
  h.used++;
  const ids = party.filter((id) => save.owned[id]);
  const stand: HoldStand = { party: ids, held: 0, hp: {}, blessings: [] };
  const run = runFor(stand, holdCrypt(now));
  for (const id of ids) stand.hp[id] = maxHpOf(save, run, id);
  h.stand = stand;
  return stand;
}

function runFor(stand: HoldStand, crypt: CryptDef): RunState {
  const zeal = stand.blessings.filter((b) => b === 'zeal').length * 25;
  return { crypt: { ...crypt, power: 1 }, map: [], party: stand.party, hp: { ...stand.hp }, floor: 0, at: 0, path: [], resolved: false, relics: [], tithes: 0, seals: 0, heresy: 0, loot: [], blessZeal: zeal };
}

const count = (s: HoldStand, id: BlessingId) => s.blessings.filter((b) => b === id).length;

/** The next wave's fight, with the stand's wounds and blessings. */
export function waveBattle(save: SaveData, stand: HoldStand, rng?: Rng, now = Date.now()): Battle {
  const crypt = holdCrypt(now);
  const n = stand.held + 1;
  const target = Math.max(1000, partyPower(save, stand.party) * waveShare(n));
  const b = makeBattle(save, runFor(stand, crypt), waveEncounter(crypt, n), rng, waveScale(crypt, n, target));
  const wrath = 1 + 0.12 * count(stand, 'wrath');
  const haste = 1 + 0.08 * count(stand, 'haste');
  const ward = 0.15 * count(stand, 'ward');
  for (const u of b.units) {
    if (u.side !== 'party') continue;
    u.atk = Math.round(u.atk * wrath);
    u.spd = Math.round(u.spd * haste);
    if (ward) u.status.shield = (u.status.shield ?? 0) + Math.round(u.maxHp * ward);
  }
  return b;
}

/** Waves-held reward (paid once, as the stand ends). */
export function standReward(held: number): { tithes: number; gilt: number; items: Bag } {
  return {
    tithes: 300 * held,
    gilt: held >= 10 ? 60 : held >= 7 ? 30 : held >= 4 ? 10 : 0,
    items: { canon1: held * 2, canon2: held >= 5 ? held - 4 : 0, canon3: held >= 10 ? 1 : 0 },
  };
}

/** Three different blessings, not yet held twice. */
function offerFor(stand: HoldStand, rng: Rng): BlessingId[] {
  const pool = BLESSINGS.map((b) => b.id).filter((id) => count(stand, id) < 2 && (id !== 'raise' || Object.values(stand.hp).some((v) => v <= 0)));
  const out: BlessingId[] = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

export interface WaveResult {
  held: number;
  over: boolean;
  reward?: ReturnType<typeof standReward>;
  newBest?: boolean;
}

/** After a wave: wounds kept, a blessing offered, or the stand ends and pays. */
export function finishWave(save: SaveData, outcome: 'victory' | 'defeat', battle: Battle, rng: Rng = Math.random, now = Date.now()): WaveResult {
  const h = holdOf(save, now);
  const stand = h.stand;
  if (!stand) return { held: 0, over: true };
  if (outcome === 'victory') {
    stand.held++;
    for (const u of battle.units) if (u.side === 'party' && u.uid in stand.hp) stand.hp[u.uid] = Math.max(0, u.hp);
  }
  const over = outcome !== 'victory' || stand.held >= HOLD_WAVES;
  if (!over) {
    stand.offer = offerFor(stand, rng);
    return { held: stand.held, over };
  }
  const reward = standReward(stand.held);
  save.tithes += reward.tithes;
  earn(save, reward.gilt);
  give(save, reward.items);
  const newBest = stand.held > h.best;
  h.best = Math.max(h.best, stand.held);
  h.today = Math.max(h.today, stand.held);
  h.stand = undefined;
  return { held: stand.held, over, reward, newBest };
}

/** Takes a blessing from the offer. */
export function takeBlessing(save: SaveData, id: BlessingId, now = Date.now()) {
  const s = holdOf(save, now).stand;
  if (!s?.offer?.includes(id)) return false;
  s.blessings.push(id);
  s.offer = undefined;
  const run = runFor(s, holdCrypt(now));
  for (const sid of s.party) {
    const max = maxHpOf(save, run, sid);
    if (id === 'mend' && s.hp[sid] > 0) s.hp[sid] = Math.min(max, s.hp[sid] + Math.round(max * 0.35));
    if (id === 'raise' && s.hp[sid] <= 0) s.hp[sid] = Math.round(max * 0.4);
  }
  return true;
}

/** Gives up the stand: paid for the waves held. */
export function yieldStand(save: SaveData, now = Date.now()) {
  const s = holdOf(save, now).stand;
  if (!s) return undefined;
  s.offer = undefined;
  // A defeat with no wave fought: pays what was held.
  return finishWave(save, 'defeat', { units: [] } as unknown as Battle, Math.random, now);
}
