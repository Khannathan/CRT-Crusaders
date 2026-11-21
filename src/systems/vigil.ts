import { CRUSADERS } from '../data/crusaders';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';
import { CRYPTS, cryptUnlocked, suggestParty, type CryptDef } from './crusade';
import type { Rng } from './gacha';
import { claimGear, makeGear, rollGearRarity, type GearItem } from './gear';
import { sisterStats, statsFor, type Stats } from './stats';
import { track } from './tasks';

/**
 * Vigils: the idle side of the game. A party of up to four Sisters keeps watch
 * over one crypt and slowly gathers Tithes, gear and Seals, even while the game
 * is closed, up to VIGIL_CAP_HOURS before someone has to claim it.
 */
export interface VigilState {
  crypt: string;
  party: string[];
  /** When gathering started (ms since epoch). */
  since: number;
}

export const VIGIL_CAP_HOURS = 12;
export const VIGIL_SIZE = 4;
/** Per hour, at full strength, before the crypt's reward multiplier. */
export const VIGIL_RATES = { tithes: 80, gear: 0.5, seals: 0.25 };
/** Level a party of four R Sisters needs to hold each crypt at full strength. */
const RECOMMENDED_LEVEL: Record<string, number> = { 'drowned-ossuary': 5, 'sunken-belfry': 10 };
/** Strength below this share of the recommended power still gathers this much. */
const MIN_EFF = 0.2;
const MAX_EFF = 1.5;

const power = (s: Stats) => s.atk * 4 + s.hp / 4 + s.armor / 4;

/** A stand-in R Sister of the given class, to measure what a crypt asks for. */
const yardstick = (classId: string): CrusaderDef => ({ id: '', name: '', classId, rarity: 'R', order: '', age: 0, hook: '' });

export function recommendedPower(crypt: CryptDef) {
  const level = RECOMMENDED_LEVEL[crypt.id] ?? 10;
  return ['warsister', 'inquisitor', 'oracle', 'confessor'].reduce((n, cls) => n + power(statsFor(yardstick(cls), { level, vow: 0 })), 0);
}

export function partyPower(save: SaveData, party: string[]) {
  return party.reduce((n, id) => {
    const c = CRUSADERS.find((x) => x.id === id);
    return c && save.owned[id] ? n + power(sisterStats(save, c)) : n;
  }, 0);
}

/** How well the party holds the crypt: 0.2 (barely) to 1.5 (with ease). */
export function vigilStrength(save: SaveData, v: VigilState) {
  const crypt = cryptOf(v);
  return Math.max(MIN_EFF, Math.min(MAX_EFF, partyPower(save, v.party) / recommendedPower(crypt)));
}

export const cryptOf = (v: VigilState) => CRYPTS.find((c) => c.id === v.crypt) ?? CRYPTS[0];

export function vigilRates(save: SaveData, v: VigilState) {
  const eff = vigilStrength(save, v);
  const m = cryptOf(v).rewardMult;
  return { eff, tithes: VIGIL_RATES.tithes * m * eff, gear: VIGIL_RATES.gear * eff, seals: VIGIL_RATES.seals * Math.min(1, eff) * m };
}

export function vigilHours(v: VigilState, now: number) {
  return Math.max(0, Math.min(VIGIL_CAP_HOURS, (now - v.since) / 3.6e6));
}

/** What claiming now would give. */
export function vigilPending(save: SaveData, v: VigilState, now: number) {
  const hours = vigilHours(v, now);
  const r = vigilRates(save, v);
  return { hours, full: hours >= VIGIL_CAP_HOURS, tithes: Math.floor(hours * r.tithes), gear: Math.floor(hours * r.gear), seals: Math.floor(hours * r.seals) };
}

/** Sets up the Vigil on first visit: the last party, at the hardest unlocked crypt. */
export function ensureVigil(save: SaveData, now: number): VigilState | undefined {
  if (!Object.keys(save.owned).length) return undefined;
  if (!save.vigil) {
    const party = (save.lastParty.length ? save.lastParty : suggestParty(save)).filter((id) => save.owned[id]).slice(0, VIGIL_SIZE);
    save.vigil = { crypt: CRYPTS[0].id, party, since: now };
  }
  return save.vigil;
}

export interface VigilClaim {
  tithes: number;
  seals: number;
  gear: GearItem[];
  melted: number;
}

/** Pays out what the Vigil gathered and starts the clock again. */
export function claimVigil(save: SaveData, now: number, rng: Rng = Math.random): VigilClaim {
  const v = save.vigil;
  if (!v) return { tithes: 0, seals: 0, gear: [], melted: 0 };
  const p = vigilPending(save, v, now);
  const crypt = cryptOf(v);
  const luck = Math.min(0.2, (crypt.rewardMult - 1) * 0.1);
  const gear = Array.from({ length: p.gear }, () => makeGear(rng, rollGearRarity(rng, luck)));
  const melted = claimGear(save, gear);
  save.tithes += p.tithes;
  save.seals += p.seals;
  v.since = now;
  if (p.tithes > 0) track(save, 'vigilClaim', 1, now);
  return { tithes: p.tithes, seals: p.seals, gear, melted };
}

/** Changing the crypt or the party claims first, so nothing gathered is lost. */
export function setVigil(save: SaveData, now: number, change: Partial<Pick<VigilState, 'crypt' | 'party'>>): VigilClaim | undefined {
  const v = ensureVigil(save, now);
  if (!v) return undefined;
  const claim = claimVigil(save, now);
  if (change.crypt && CRYPTS.some((c) => c.id === change.crypt && cryptUnlocked(save, c))) v.crypt = change.crypt;
  if (change.party) v.party = change.party.filter((id) => save.owned[id]).slice(0, VIGIL_SIZE);
  return claim;
}

export const vigilCrypts = (save: SaveData) => CRYPTS.filter((c) => cryptUnlocked(save, c));
