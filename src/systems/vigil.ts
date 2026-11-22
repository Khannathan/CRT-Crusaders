import { BOND_XP, addBond } from './bonds';
import { give, vigilDrops, type Bag } from './items';
import type { SaveData } from '../state/save';
import { suggestParty } from './crusade';
import { FAST_HOURS, chaptersCleared, nextStage, roadRates, stageDef, useFast } from './campaign';
import type { Rng } from './gacha';
import { claimGear, makeGear, rollGearRarity, type GearItem } from './gear';
import { track } from './tasks';

/**
 * Vigils: the idle side of the game. A party of up to four Sisters keeps watch
 * on the Pilgrim's Road and slowly gathers Tithes, gear, materials and Seals,
 * even while the game is closed, up to VIGIL_CAP_HOURS before someone claims it.
 * How fast it gathers is set by the highest stage cleared (campaign.ts).
 */
export interface VigilState {
  /** Older saves: the crypt it once watched. The Pilgrim's Road decides now. */
  crypt?: string;
  party: string[];
  /** When gathering started (ms since epoch). */
  since: number;
}

export const VIGIL_CAP_HOURS = 12;
export const VIGIL_SIZE = 4;

/** Where the Vigil fights: the next stage of the Pilgrim's Road (the last once it is done). */
export const vigilStage = (save: SaveData) => stageDef(nextStage(save));

/** Per hour, set by the highest stage cleared on the Pilgrim's Road (campaign.ts). */
export function vigilRates(save: SaveData, _v?: VigilState) {
  return roadRates(save);
}

export function vigilHours(v: VigilState, now: number) {
  return Math.max(0, Math.min(VIGIL_CAP_HOURS, (now - v.since) / 3.6e6));
}

/** What claiming now would give. */
export function vigilPending(save: SaveData, v: VigilState, now: number) {
  const hours = vigilHours(v, now);
  const r = vigilRates(save, v);
  return gatherFor(hours, r);
}

function gatherFor(hours: number, r: ReturnType<typeof roadRates>) {
  return { hours, full: hours >= VIGIL_CAP_HOURS, tithes: Math.floor(hours * r.tithes), gear: Math.floor(hours * r.gear), seals: Math.floor(hours * r.seals) };
}

/** Sets up the Vigil on first visit, with the last party. */
export function ensureVigil(save: SaveData, now: number): VigilState | undefined {
  if (!Object.keys(save.owned).length) return undefined;
  if (!save.vigil) {
    const party = (save.lastParty.length ? save.lastParty : suggestParty(save)).filter((id) => save.owned[id]).slice(0, VIGIL_SIZE);
    save.vigil = { party, since: now };
  }
  return save.vigil;
}

export interface VigilClaim {
  tithes: number;
  seals: number;
  gear: GearItem[];
  melted: number;
  items: Bag;
}

/** Pays out `hours` of gathering at the road's rates. */
function payOut(save: SaveData, hours: number, party: string[], rng: Rng): VigilClaim {
  const r = vigilRates(save);
  const p = gatherFor(hours, r);
  const luck = Math.min(0.2, chaptersCleared(save) * 0.04);
  const gear = Array.from({ length: p.gear }, () => makeGear(rng, rollGearRarity(rng, luck)));
  const melted = claimGear(save, gear);
  save.tithes += p.tithes;
  save.seals += p.seals;
  const items = vigilDrops(p.hours * r.items * 2, rng);
  give(save, items);
  addBond(save, party, Math.floor(p.hours * BOND_XP.vigilHour));
  return { tithes: p.tithes, seals: p.seals, gear, melted, items };
}

/** Pays out what the Vigil gathered and starts the clock again. */
export function claimVigil(save: SaveData, now: number, rng: Rng = Math.random): VigilClaim {
  const v = save.vigil;
  if (!v) return { tithes: 0, seals: 0, gear: [], melted: 0, items: {} };
  const c = payOut(save, vigilHours(v, now), v.party, rng);
  v.since = now;
  if (c.tithes > 0) track(save, 'vigilClaim', 1, now);
  return c;
}

/** Fast Reward: FAST_HOURS of gathering at once (free once a day, then Gilt). Undefined if not allowed. */
export function fastReward(save: SaveData, now: number, rng: Rng = Math.random): VigilClaim | undefined {
  const v = ensureVigil(save, now);
  if (!v || !useFast(save, now)) return undefined;
  return payOut(save, FAST_HOURS, v.party, rng);
}

/** Changing the party claims first, so nothing gathered is lost. */
export function setVigil(save: SaveData, now: number, change: Partial<Pick<VigilState, 'party'>>): VigilClaim | undefined {
  const v = ensureVigil(save, now);
  if (!v) return undefined;
  const claim = claimVigil(save, now);
  if (change.party) v.party = change.party.filter((id) => save.owned[id]).slice(0, VIGIL_SIZE);
  return claim;
}
