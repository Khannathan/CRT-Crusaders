import { starterGear, type GearItem } from '../systems/gear';
import type { PilgrimageState } from '../systems/crusade';
import type { MatinsState } from '../systems/matins';
import type { RankState } from '../systems/rank';
import type { TowerState } from '../systems/tower';
import type { InquisitionState } from '../systems/inquisition';
import type { BondState } from '../systems/bonds';
import type { ArmoryState } from '../systems/armory';
import type { ChapterState } from '../systems/chapter';
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
  /** Holy Symbol level: undefined while it sleeps, 0-15 once woken (systems/symbols.ts). */
  symbol?: number;
  /** Canonization past level 50: rank 0-20 and the traits taken (systems/canon.ts). */
  canon?: { rank: number; traits: string[] };
  /** Second Vows taken (systems/secondVows.ts): her advanced class. */
  secondVow?: boolean;
  /** Crusades left to sit out after falling (0 = ready). Tithes can revive early. */
  recovering?: number;
}

export interface SaveData {
  /** Relic Rites (systems/relicRites.ts): daily entries, best levels, Motes and Sanctified steps per Sister. */
  relicRites?: { day: string; used: number; best: Record<string, number>; motes: Record<string, number>; sanct: Record<string, number> };
  /** The Nightmare Raid (systems/raid.ts): Squads, today's delve, the week's best. */
  raid?: import('../systems/raid').RaidState;
  /** Hold the Line (systems/holdLine.ts): today's stand, best waves held. */
  holdLine?: import('../systems/holdLine').HoldState;
  /** Hosanna picks: per party (sorted Sister ids joined by +) and the last one picked. */
  hosanna?: { byParty?: Record<string, string>; last?: string };
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
  /**
   * The banner up at the Sealed Altar: the UR it targets (and her Order), the
   * SSRs it boosts on a standard banner, or the Limited window it belongs to.
   */
  banner?: { order: string; target: string; ssrs?: string[]; limited?: number };
  /** The player's standard banner picks, kept while the Limited banner is up. */
  standardPick?: { target: string; ssrs: string[] };
  /** The Feast event running beside the limited Saint (systems/feast.ts). */
  feast?: import('../systems/feast').FeastState;
  /** The Limited banner window last looked at (systems/limited.ts). */
  limitedSeen?: number;
  /** True after a banner UR was not the target: the next banner UR will be. */
  urGuaranteed?: boolean;
  /** Pulls since the last UR, on any banner (UR pity). */
  urPity?: number;
  /** Relic Shards per Order name: one per pull on its banner. */
  shards?: Record<string, number>;
  /** Recent pulls, newest last (capped at PULL_LOG_MAX), for the history page. */
  pullLog?: { id: string; at: number; banner?: string; isNew?: boolean }[];
  /** Order Book sets already claimed, by set id. */
  sets?: string[];
  /** Cosmetic titles earned, and the one worn. */
  titles?: string[];
  title?: string;
  /** The Vigil Flame: a kind daily streak (see flame.ts). */
  flame?: { level: number; best: number; day: number; grace: number; week: string };
  /** Personal bests: Bell Tower floor, Inquisition Brands in one fortnight, fewest rounds to clear each crypt (by "crypt:heresy"). */
  records?: { tower?: number; brands?: number; clears?: Record<string, number> };
  /** Your place on the rival ladder when you last looked, to tell you how far you climbed. */
  ladderSeen?: number;
  /** Highest Heresy tier cleared per crypt id (0 = the base crypt). */
  heresy?: Record<string, number>;
  /** Every piece of gear owned; `on` says who wears it. */
  gear?: GearItem[];
  nextGearId?: number;
  /** The Saints' Armory: UR gear banner pity and pulls. */
  armory?: ArmoryState;
  /** The Chapter (offline guild with AI members). */
  chapter?: ChapterState;
  war?: import('../systems/chapterWar').WarState;
  /** The idle Vigil: who keeps watch where, and since when. */
  vigil?: VigilState;
  /** Stigmata: raise a Sister's star tier. */
  stigmata?: number;
  /** The Pilgrim's Road: the Vigil's campaign. */
  campaign?: CampaignState;
  /** Daily Penance and weekly Litany progress. */
  tasks?: TaskState;
  /** Story scenes seen (systems/story.ts). */
  story?: import('../systems/story').StoryState;
  /** The Keeper of the Sanctum (systems/keeper.ts). */
  keeper?: import('../systems/keeper').KeeperState;
  /** Deeds: lifetime counts and tiers claimed (systems/deeds.ts). */
  deeds?: import('../systems/deeds').DeedState;
  /** A new player's first week (systems/novitiate.ts). */
  novitiate?: import('../systems/novitiate').NovitiateState;
  /** The Pilgrim's Pass for this season (systems/pass.ts). */
  pass?: import('../systems/pass').PassState;
  /** Missives: letters with rewards and news (systems/missives.ts). */
  missives?: import('../systems/missives').MissivesState;
  /** The weekly Ordeals league (systems/ordeals.ts). */
  ordeals?: import('../systems/ordeals').OrdealState;
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
  /** The Kennel: hounds owned and the one going into battle. */
  hounds?: import('../systems/hounds').HoundState;
  /** Hallowed Hunts: today's entries and best, tiers opened and records. */
  hunts?: import('../systems/hunts').HuntState;
  /** Account Power last shown, for the "+N Power" pop (systems/powerGrowth.ts). */
  powerSeen?: number;
  /** Power milestones reached so far. */
  powerMilestone?: number;
  /** Saved parties, each with an icon shown on its Sisters' portraits. */
  presets?: import('../systems/presets').PartyPreset[];
  /** Materials by item id (see systems/items.ts). */
  /** Order Codex level by Order id (systems/codex.ts). */
  codex?: Record<string, number>;
  /** Lit Reliquary relic ids (systems/reliquary.ts). */
  reliquary?: string[];
  items?: import('../systems/items').Bag;
  /** Holy Errands: today's sent errands and those still away (systems/errands.ts). */
  errands?: import('../systems/errands').ErrandState;
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
      const data = parseSave(raw);
      if (data) return data;
      // The save is damaged: fall back to the newest daily backup rather than starting over.
      const auto = autoBackups()[0];
      if (auto) return auto.save;
    }
  } catch {
    // storage blocked or corrupt: start fresh
  }
  return newSave();
}

function parseSave(raw: string): SaveData | undefined {
  try {
    const data = JSON.parse(raw) as SaveData;
    if (data && data.version === 1 && typeof data.owned === 'object') return { ...newSave(), ...data, gear: data.gear ?? starterGear() };
  } catch {
    // not JSON
  }
  return undefined;
}

/** Daily backups kept on the device: one snapshot per day played, the last AUTO_KEEP days. */
export const AUTO_KEEP = 3;
const AUTO_PREFIX = 'crt-crusaders.save.auto.';
const dayStamp = (now: number) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
let autoDay = '';

/** The first save of each day is also kept as that day's backup; older ones are pruned. */
function writeAutoBackup(json: string, now = Date.now()) {
  const day = dayStamp(now);
  if (autoDay === day) return;
  if (!localStorage.getItem(AUTO_PREFIX + day)) localStorage.setItem(AUTO_PREFIX + day, json);
  autoDay = day;
  const keys = autoKeys();
  for (const k of keys.slice(AUTO_KEEP)) localStorage.removeItem(k);
}

/** Backup keys, newest first. */
function autoKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(AUTO_PREFIX)) keys.push(k);
  }
  return keys.sort().reverse();
}

/** The daily backups that still read as saves, newest first. */
export function autoBackups(): { day: string; save: SaveData }[] {
  try {
    return autoKeys()
      .map((k) => ({ day: k.slice(AUTO_PREFIX.length), save: parseSave(localStorage.getItem(k) ?? '') }))
      .filter((b): b is { day: string; save: SaveData } => !!b.save);
  } catch {
    return [];
  }
}

export function writeSave(data: SaveData) {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(KEY, json);
    try {
      writeAutoBackup(json);
    } catch {
      // out of room for a backup: the save itself is what matters
    }
  } catch {
    // storage unavailable (private mode); progress lasts for this session only
  }
}

/**
 * Asks the browser to keep this game's storage when space runs low (Chrome
 * grants it to sites you use often or install). Harmless where unsupported.
 */
export function askPersistentStorage() {
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    // not supported
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
