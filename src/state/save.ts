import { starterGear, type GearItem } from '../systems/gear';
import type { PilgrimageState } from '../systems/crusade';
import type { MatinsState } from '../systems/matins';
import type { RankState } from '../systems/rank';
import type { TowerState } from '../systems/tower';
import type { InquisitionState } from '../systems/inquisition';
import type { BondState } from '../systems/bonds';
import type { TrialState } from '../systems/trials';
import type { TaskState } from '../systems/tasks';
import type { VigilState } from '../systems/vigil';
import type { CampaignState } from '../systems/campaign';
import type { ProcessionState } from '../systems/offerings';

/** Everything the player owns, stored on the device. */
export interface OwnedCrusader {
  level: number;
  /** EXP into her current level (see systems/exp.ts). */
  exp?: number;
  /** Vows taken, 0-5. Each one spends a Vow token. */
  vow: number;
  /** Vow tokens: duplicate pulls of her, waiting for Take Vow. */
  tokens?: number;
  /** Skill levels 1-5 for her three skills and Rite (missing = 1). */
  skills?: number[];
  /** Star tier, 0-5 (separate from rarity): five Vows, then Stigmata raise it. */
  tier?: number;
  /** Ascensions taken, 0-3. Each raises the level cap by 10. */
  asc?: number;
  /** Crusades left to sit out after falling (0 = ready). Tithes can revive early. */
  recovering?: number;
}

export interface SaveData {
  version: 1;
  seals: number;
  tithes: number;
  /** Pulls since the last SSR or UR. */
  pity: number;
  totalPulls: number;
  freeTenUsed: boolean;
  owned: Record<string, OwnedCrusader>;
  /** Crypt ids cleared at least once (first-clear bonus). */
  cleared: string[];
  /** Order banner chosen at the Sealed Altar, and the UR it targets. */
  banner?: { order: string; target: string };
  /** True after a banner UR was not the target: the next banner UR will be. */
  urGuaranteed?: boolean;
  /** Pulls since the last UR, on any banner (UR pity). */
  urPity?: number;
  /** Relic Shards per Order name: one per pull on its banner. */
  shards?: Record<string, number>;
  /** Highest Heresy tier cleared per crypt id (0 = the base crypt). */
  heresy?: Record<string, number>;
  /** Every piece of gear owned; `on` says who wears it. */
  gear?: GearItem[];
  nextGearId?: number;
  /** The idle Vigil: who keeps watch where, and since when. */
  vigil?: VigilState;
  /** Stigmata: raise a Sister's star tier. */
  stigmata?: number;
  /** The Pilgrim's Road: the Vigil's campaign. */
  campaign?: CampaignState;
  /** Daily Penance and weekly Litany progress. */
  tasks?: TaskState;
  /** Matins login calendar. */
  matins?: MatinsState;
  /** Blessed crypt clears used this week. */
  pilgrimage?: PilgrimageState;
  /** Rank of Faith: account Faith and gifts claimed. */
  rank?: RankState;
  /** Relic Trials: entries used today and best stars. */
  trials?: TrialState;
  /** The Bell Tower: highest floor cleared. */
  tower?: TowerState;
  /** The Inquisition: this rotation's Brands, Sisters used and rewards paid. */
  inquisition?: InquisitionState;
  /** Sister bonds: bond XP and confessions heard, by Sister id. */
  bonds?: Record<string, BondState>;
  /** Offerings held for Confession, by offering id. */
  offerings?: Record<string, number>;
  /** Day the free candle was last lit. */
  candleDay?: string;
  /** The Reliquary Procession: entries used today and highest tier won. */
  procession?: ProcessionState;
  /** Gilt, the premium currency (starts at GILT_START). */
  gilt?: number;
  /** Alms, the shop currency. */
  alms?: number;
  /** Shop purchases and today's Almonry stock. */
  shop?: import('../systems/shop').ShopState;
  /** Materials by item id (see systems/items.ts). */
  /** Order Codex level by Order id (systems/codex.ts). */
  codex?: Record<string, number>;
  /** Lit Reliquary relic ids (systems/reliquary.ts). */
  reliquary?: string[];
  items?: import('../systems/items').Bag;
  /** Last party, in rank order, to pre-fill the muster screen. */
  lastParty: string[];
}

const KEY = 'crt-crusaders.save.v1';

/**
 * Prototype starting purse. Crusades (step 3) will earn Seals; until then this
 * lets you try the altar beyond the free first 10-pull.
 */
export function newSave(): SaveData {
  return { version: 1, seals: 30, tithes: 500, pity: 0, totalPulls: 0, freeTenUsed: false, owned: {}, cleared: [], lastParty: [], gear: starterGear(), items: { unction1: 10 } };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw) as SaveData;
      if (data && data.version === 1) return { ...newSave(), ...data, gear: data.gear ?? starterGear() };
    }
  } catch {
    // storage blocked or corrupt: start fresh
  }
  return newSave();
}

export function writeSave(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage unavailable (private mode); progress lasts for this session only
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Prefix on an exported save code, so a stray paste is easy to spot. */
const CODE_PREFIX = 'CRT1.';

/** The save as a text code that survives copy and paste: a prefix plus base64 JSON. */
export function exportSave(data: SaveData): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return CODE_PREFIX + btoa(bin);
}

/** Reads an exported code (or the raw JSON from a save file). Returns undefined if it is not a save. */
export function importSave(text: string): SaveData | undefined {
  try {
    const t = text.trim();
    let json: string;
    if (t.startsWith('{')) json = t;
    else {
      const body = (t.startsWith(CODE_PREFIX) ? t.slice(CODE_PREFIX.length) : t).replace(/\s+/g, '');
      const bin = atob(body);
      json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    }
    const data = JSON.parse(json) as SaveData;
    if (!data || data.version !== 1 || typeof data.owned !== 'object' || typeof data.seals !== 'number') return undefined;
    return { ...newSave(), ...data, gear: data.gear ?? starterGear() };
  } catch {
    return undefined;
  }
}
