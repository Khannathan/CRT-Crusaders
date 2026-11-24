import type { Rarity } from '../data/types';
import {
  AFFIXES,
  AFFIX_IDS,
  ANCIENT_IP,
  BURN_CHANCE,
  BURN_MULT,
  EDICTS,
  EDICT_OF,
  GODFORGED,
  GRADE,
  GRADES,
  MAIN_TOP,
  MAX_IP,
  NOUN,
  PREFIX,
  ROLL_MIN,
  SAINTS_ARMS,
  edictDef,
  edictValue,
  ipScale,
  uniqueDef,
  uniqueValue,
  type AffixId,
  type EdictId,
  type Grade,
  type StatAffix,
  type UniqueId,
} from '../data/loot';
import { CLASSES } from '../data/classes';
import { LINE_CAP, MAX_POWERS, ROLE_AFFIXES } from '../data/loot';
import { ALMS_FOR_GEAR, earn } from './currency';
import type { SaveData } from '../state/save';
import type { Rng } from './gacha';
import { track } from './tasks';
import { send } from './missives';
import { bagText, give, hasAll, spend, type Bag } from './items';

/**
 * Gear, rebuilt as ARPG loot ("Relics of War", design doc
 * https://claude.ai/artifact/3BWexqdwzKubDMduRY4bkh). Five slots per Sister.
 *
 * A piece has a grade (Worn, Consecrated, Sworn, Anathema, Saint's Arms,
 * Godforged: how many lines it rolls), an Item Power 1-800 (how big the lines
 * are) and a roll per line (70-100% of the top value). Ancient pieces (IP 725+)
 * can roll Burning lines worth x1.5. Anathema pieces carry an Edict that changes
 * how a Sister fights; melting one writes its Edict into the Index, which can
 * imprint it onto a Sworn piece. Saint's Arms and Godforged are named uniques.
 *
 * Crafting spends Penance (Last Epoch's Forging Potential): the Confessional
 * rerolls one line; at 0 Penance a piece is Absolved and can only be enhanced.
 * Enhancing (the Anvil) is as before: Tithes to +10, Consecrated Iron to +15,
 * and every third level a random line grows by a quarter.
 *
 * Gear's whole worth is held to a budget (gear.test.ts): best-in-slot lifts a
 * Sister's Power about x1.65 at most, so a UR in starter gear still beats an R
 * in perfect gear.
 */
export type GearSlot = 'blade' | 'habit' | 'veil' | 'sabatons' | 'rosary';
export type GearStat = StatAffix;
export type { AffixId, Grade, EdictId, UniqueId };

export interface GearSub {
  stat: AffixId;
  value: number;
  /** Where the line landed, ROLL_MIN-1. */
  roll: number;
  /** A Burning line (D4's greater affix): x1.5. */
  burn?: boolean;
  /** Times the Anvil has grown it (+25% each). */
  up?: number;
}

export interface GearItem {
  /** Unique in the save; '' while it is still unclaimed loot in a run. */
  uid: string;
  slot: GearSlot;
  grade: Grade;
  /** The old rarity band of its grade (R-UR): Alms, colours on older screens. */
  rarity: Rarity;
  name: string;
  /** Item Power, 1-800. */
  ip: number;
  /** Enhance level, 0 to MAX_REFINE. */
  level: number;
  main: GearStat;
  subs: GearSub[];
  /** Anathema pieces: the Edict it carries and its roll (0-1). */
  edict?: { id: EdictId; roll: number };
  /** Saint's Arms and Godforged: which one, and its power's roll (0-1). */
  unique?: UniqueId;
  uRoll?: number;
  /** Crafting budget left. 0 = Absolved. */
  penance: number;
  /** The one line the Confessional may reroll, once chosen. */
  rerollLine?: number;
  /** Confessions so far (each costs more Tithes). */
  rerolls?: number;
  /** A confession's two offers, waiting for a choice. */
  offer?: GearSub[];
  /** Sister id wearing it. */
  on?: string;
  /** Old gear sets (retired into Edicts); kept only so old saves load. */
  set?: string;
}

export const GEAR_SLOTS: GearSlot[] = ['blade', 'habit', 'veil', 'sabatons', 'rosary'];
export const SLOT_NAME: Record<GearSlot, string> = { blade: 'Blade', habit: 'Habit', veil: 'Veil', sabatons: 'Sabatons', rosary: 'Rosary' };
export const SLOT_HINT: Record<GearSlot, string> = { blade: 'Attack', habit: 'HP or Armor', veil: 'HP or Magic Resist', sabatons: 'Armor, HP or Magic Resist', rosary: 'Crit, Crit Damage or Attack' };
export const STAT_NAME: Record<GearStat, string> = { atkPct: 'ATK', hpPct: 'HP', armorPct: 'ARM', mresPct: 'MRES', crit: 'CRIT', critDmg: 'CRIT DMG', spd: 'SPD' };
export const GRADE_COLOR: Record<Grade, number> = Object.fromEntries(GRADES.map((g) => [g, GRADE[g].color])) as Record<Grade, number>;
export const gradeName = (g: Grade) => GRADE[g].name;
/** A piece's name, marked Ancient at IP 725+. */
export const gearName = (g: Pick<GearItem, 'name' | 'ip' | 'grade'>) => (g.ip >= ANCIENT_IP && g.grade !== 'arms' && g.grade !== 'godforged' ? `Ancient ${g.name}` : g.name);

/** Tithes alone take a piece this far. */
export const MAX_GEAR_LEVEL = 10;
/** Refinement past +10 needs Consecrated Iron as well. */
export const MAX_REFINE = 15;
/** Iron for each level past +10: index 0 is the step to +11. */
export const REFINE_IRON: Bag[] = [{ iron1: 10 }, { iron1: 15 }, { iron2: 4 }, { iron2: 6 }, { iron2: 6, iron3: 2 }];
/** Pieces kept in the armory. Loot beyond this is melted down. */
export const MAX_GEAR = 150;
/** Enhancing to these levels grows a random line by UP_STEP. */
export const SUB_UPGRADE_LEVELS = [3, 6, 9, 12, 15];
export const UP_STEP = 0.2;
/** The Confessional: Penance a reroll costs (random in range), and Tithes (x CONFESS_RISE per reroll before). */
export const CONFESS_PENANCE: [number, number] = [2, 4];
export const CONFESS_TITHES = 300;
export const CONFESS_RISE = 1.25;
/** Kept for older screens: the Confessional's base cost. */
export const REROLL_COST = { items: {} as Bag, tithes: CONFESS_TITHES };
/** The Index: imprinting an Edict onto a Sworn piece. */
export const IMPRINT_COST = { items: { iron2: 3 } as Bag, tithes: 1500 };
/** Godforged drop chance per Heresy IV+ boss, and Godspark chance. */
export const GODFORGED_DROP = 0.001;
export const GODSPARK_DROP = 0.05;
export const GODSPARKS_TO_FORGE = 2;

const BAND_MULT: Record<Rarity, number> = { R: 1, SR: 1.25, SSR: 1.5, UR: 2 };
const MAIN_CHOICES: Record<GearSlot, GearStat[]> = { blade: ['atkPct'], habit: ['hpPct', 'armorPct'], veil: ['hpPct', 'mresPct'], sabatons: ['armorPct', 'hpPct', 'mresPct'], rosary: ['crit', 'critDmg', 'atkPct'] };

const pick = <T>(rng: Rng, xs: T[]) => xs[Math.floor(rng() * xs.length) % xs.length];
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const between = (rng: Rng, [a, b]: [number, number]) => a + Math.floor(rng() * (b - a + 1));

export const isAncient = (item: Pick<GearItem, 'ip'>) => item.ip >= ANCIENT_IP;
export const isAbsolved = (item: Pick<GearItem, 'penance'>) => item.penance <= 0;

const levelMult = (level: number) => 1 + 0.1 * Math.min(level, MAX_GEAR_LEVEL) + 0.15 * Math.max(0, level - MAX_GEAR_LEVEL);

export function mainValue(item: Pick<GearItem, 'main' | 'level'> & { ip?: number }): number {
  // Gear gives no Speed: turn order stays the Sisters' own.
  if (item.main === 'spd') return 0;
  return r3(MAIN_TOP[item.main] * ipScale(item.ip ?? 400) * levelMult(item.level));
}

/** A line's value from its roll, the piece's Item Power, Burning and Anvil growth. */
export function lineValue(stat: AffixId, ip: number, roll: number, burn?: boolean, up = 0): number {
  const v = AFFIXES[stat].top * ipScale(ip) * roll * (burn ? BURN_MULT : 1) * (1 + UP_STEP * up);
  return stat === 'spd' ? Math.max(1, Math.round(v)) : r3(v);
}

const refresh = (item: GearItem) => {
  for (const s of item.subs) s.value = lineValue(s.stat, item.ip, s.roll, s.burn, s.up);
};

/** A fresh line of `stat` for a piece of this IP. */
function rollLine(rng: Rng, stat: AffixId, ip: number): GearSub {
  const roll = r3(ROLL_MIN + (1 - ROLL_MIN) * rng());
  const burn = ip >= ANCIENT_IP && rng() < BURN_CHANCE;
  return { stat, roll, burn: burn || undefined, value: lineValue(stat, ip, roll, burn) };
}

/** Picks a stat from `pool`, with `favour` three times as likely. */
function pickStat(rng: Rng, pool: AffixId[], favour: AffixId[] = []): AffixId {
  const weights = pool.map((s) => (favour.includes(s) ? 3 : 1));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) if ((r -= weights[i]) < 0) return pool[i];
  return pool[pool.length - 1];
}

function rollLines(rng: Rng, n: number, ip: number, main: GearStat, favour?: AffixId[], fixed?: AffixId[]): GearSub[] {
  if (fixed) return fixed.map((s) => rollLine(rng, s, ip));
  const pool = AFFIX_IDS.filter((s) => s !== main);
  const out: GearSub[] = [];
  for (let i = 0; i < n; i++) {
    const stat = pickStat(rng, pool, favour);
    pool.splice(pool.indexOf(stat), 1);
    out.push(rollLine(rng, stat, ip));
  }
  return out;
}

/** The grade a drop of this rarity band rolls. */
export function gradeFor(rng: Rng, band: Rarity): Grade {
  const r = rng();
  if (band === 'R') return r < 0.6 ? 'worn' : 'consecrated';
  if (band === 'SR') return r < 0.45 ? 'consecrated' : 'sworn';
  if (band === 'SSR') return r < 0.6 ? 'sworn' : 'anathema';
  return 'arms';
}

export interface MakeOpts {
  /** Item Power; DEFAULT_IP when left out. */
  ip?: number;
  /** Smart loot: lines her role hopes for are three times as likely. */
  favour?: AffixId[];
  /** Force a grade instead of rolling one from the band. */
  grade?: Grade;
  /** Saint's Arms or Godforged to make. */
  unique?: UniqueId;
  /** Edict for an Anathema piece. */
  edict?: EdictId;
}

export const DEFAULT_IP = 150;

/**
 * Rolls a piece. `band` (R-UR) is the drop's quality band: R gives Worn or
 * Consecrated, SR Consecrated or Sworn, SSR Sworn or Anathema, UR a Saint's Arms.
 */
export function makeGear(rng: Rng, band: Rarity, slot?: GearSlot, opts: MakeOpts = {}): GearItem {
  const uDef = uniqueDef(opts.unique) ?? (opts.grade === 'godforged' ? pick(rng, GODFORGED) : undefined);
  let grade: Grade = uDef?.grade ?? opts.grade ?? gradeFor(rng, band);
  if (grade === 'arms' && !uDef) {
    const fits = SAINTS_ARMS.filter((u) => !slot || u.slot === slot);
    return makeGear(rng, band, slot, { ...opts, unique: pick(rng, fits.length ? fits : SAINTS_ARMS).id });
  }
  if (uDef) {
    const ip = MAX_IP;
    return {
      uid: '',
      slot: uDef.slot,
      grade,
      rarity: 'UR',
      name: uDef.name,
      ip,
      level: 0,
      main: uDef.main,
      subs: rollLines(rng, 0, ip, uDef.main, undefined, uDef.affixes).map((s) => (grade === 'godforged' ? { ...s, burn: true, value: lineValue(s.stat, ip, s.roll, true) } : s)),
      unique: uDef.id,
      uRoll: r3(rng()),
      penance: GRADE[grade].penance[0],
    };
  }
  const s = slot ?? pick(rng, GEAR_SLOTS);
  const ip = Math.max(1, Math.min(MAX_IP, Math.round(opts.ip ?? DEFAULT_IP)));
  const main = pick(rng, MAIN_CHOICES[s]);
  const subs = rollLines(rng, GRADE[grade].lines, ip, main, opts.favour);
  const fits = EDICTS.filter((e) => e.slots.includes(s));
  const edictId = grade === 'anathema' ? (opts.edict && edictDef(opts.edict)?.slots.includes(s) ? opts.edict : pick(rng, fits).id) : undefined;
  if (grade === 'anathema' && !edictId) grade = 'sworn';
  const noun = pick(rng, NOUN[s]);
  const name = edictId ? `${noun} of ${EDICT_OF[edictId]}` : `${pick(rng, PREFIX[grade as 'worn' | 'consecrated' | 'sworn'])} ${noun}`;
  return {
    uid: '',
    slot: s,
    grade,
    rarity: GRADE[grade].band,
    name,
    ip,
    level: 0,
    main,
    subs,
    edict: edictId ? { id: edictId, roll: r3(rng()) } : undefined,
    penance: between(rng, GRADE[grade].penance),
  };
}

/**
 * Quality band of a dropped piece, R to SSR: Saint's Arms never drop from
 * ordinary foes (they come from the Saints' Armory). `luck` (0-1) shifts the odds upward.
 */
export function rollGearRarity(rng: Rng, luck = 0): Rarity {
  const r = rng();
  if (r < 0.14 + luck * 1.25) return 'SSR';
  if (r < 0.45 + luck * 1.5) return 'SR';
  return 'R';
}

/**
 * Smart loot (Diablo III): SMART_SHARE of drops favour the lines one of the
 * party's roles hopes for. The rest stay wild, so other Sisters still find gear.
 */
export const SMART_SHARE = 0.7;
export function smartFavour(rng: Rng, classIds: (string | undefined)[]): AffixId[] | undefined {
  const roles = classIds.map((id) => (id ? CLASSES[id]?.role : undefined)).filter((r): r is NonNullable<typeof r> => !!r);
  if (!roles.length || rng() >= SMART_SHARE) return undefined;
  return ROLE_AFFIXES[pick(rng, roles)];
}

// ---- Item Power from content ------------------------------------------------------

/** Item Power a drop lands near: up to 15 below to 10 above the content's. */
export const dropIp = (rng: Rng, content: number) => Math.max(1, Math.min(MAX_IP, Math.round(content - 15 + rng() * 25)));

/**
 * Content IP of a crypt: 100 for the first, 400 for the deepest, +50 a Heresy
 * tier. The deepest crypts at the highest Heresy drop Ancient pieces (725-800).
 */
export function cryptIp(index: number, count: number, heresy: number, rng: Rng = Math.random): number {
  const base = 100 + Math.round((300 * index) / Math.max(1, count - 1)) + 50 * heresy;
  if (heresy >= 5 && index >= count - 4) return ANCIENT_IP + Math.round(rng() * (MAX_IP - ANCIENT_IP));
  return Math.min(650, base);
}

/** IP of the highest content a save has cleared: what side rewards (Tower, Trials, Shop) drop at. */
export function playerIp(save: SaveData): number {
  return save.lootIp ?? DEFAULT_IP;
}

/** Notes content IP once it is cleared, so side rewards keep pace. */
export function noteIp(save: SaveData, ip: number) {
  save.lootIp = Math.max(save.lootIp ?? DEFAULT_IP, Math.min(650, ip));
}

// ---- The Anvil (enhance) --------------------------------------------------------

export const enhanceCost = (item: GearItem) => Math.round(25 * (item.level + 1) * BAND_MULT[item.rarity] * (0.6 + 0.4 * ipScale(item.ip)));
/** Saint's Fragments a melted piece leaves behind. */
export const FRAGMENTS_FOR: Record<Grade, number> = { worn: 0, consecrated: 0, sworn: 0, anathema: 1, arms: 15, godforged: 15 };
export const salvageValue = (item: GearItem) => Math.round(15 * BAND_MULT[item.rarity] * (1 + item.level) * (0.5 + ipScale(item.ip)));

/** Consecrated Iron for the next level, past +10. */
export const refineIron = (item: GearItem): Bag | undefined => (item.level >= MAX_GEAR_LEVEL ? REFINE_IRON[item.level - MAX_GEAR_LEVEL] : undefined);

/** Why the piece cannot be enhanced now, or undefined. */
export function enhanceBlock(save: SaveData, item: GearItem): string | undefined {
  if (item.level >= MAX_REFINE) return 'Fully refined';
  const iron = refineIron(item);
  if (iron && !hasAll(save, iron)) return 'Not enough Consecrated Iron';
  if (save.tithes < enhanceCost(item)) return 'Not enough Tithes';
  return undefined;
}

/** Spends Tithes (and Consecrated Iron past +10) to raise a piece one level. Returns false if it can't. */
export function enhance(save: SaveData, item: GearItem, rng: Rng = Math.random): boolean {
  if (enhanceBlock(save, item)) return false;
  const iron = refineIron(item);
  if (iron) spend(save, iron);
  save.tithes -= enhanceCost(item);
  item.level += 1;
  track(save, 'enhance');
  if (SUB_UPGRADE_LEVELS.includes(item.level) && item.subs.length) {
    const sub = pick(rng, item.subs);
    sub.up = (sub.up ?? 0) + 1;
    refresh(item);
  }
  return true;
}

// ---- The Confessional (reroll one line) ----------------------------------------------

export const confessTithes = (item: GearItem) => Math.round(CONFESS_TITHES * Math.pow(CONFESS_RISE, item.rerolls ?? 0));

export function confessBlock(save: SaveData, item: GearItem, line: number): string | undefined {
  if (!item.subs[line]) return 'No such line';
  if (item.offer) return 'Choose from the last confession first';
  if (item.rerollLine !== undefined && item.rerollLine !== line) return 'Only her first confessed line';
  if (item.penance < CONFESS_PENANCE[0]) return 'Absolved: no Penance left';
  if (save.tithes < confessTithes(item)) return 'Not enough Tithes';
  return undefined;
}

/**
 * Confesses one line: spends Penance and Tithes and offers two new lines in
 * its place (the old one may be kept). The first line confessed is the only
 * one that piece may ever reroll (D4's enchanting rule).
 */
export function confess(save: SaveData, item: GearItem, line: number, rng: Rng = Math.random): GearSub[] | undefined {
  if (confessBlock(save, item, line)) return undefined;
  save.tithes -= confessTithes(item);
  item.penance = Math.max(0, item.penance - between(rng, CONFESS_PENANCE));
  item.rerollLine = line;
  item.rerolls = (item.rerolls ?? 0) + 1;
  const old = item.subs[line];
  const taken = new Set<AffixId>([item.main, ...item.subs.filter((_, i) => i !== line).map((s) => s.stat)]);
  const pool = AFFIX_IDS.filter((s) => !taken.has(s));
  const offer: GearSub[] = [];
  for (let i = 0; i < 2 && pool.length; i++) {
    const stat = pool.splice(Math.floor(rng() * pool.length) % pool.length, 1)[0];
    const l = rollLine(rng, stat, item.ip);
    if (old.up) (l.up = old.up), (l.value = lineValue(l.stat, item.ip, l.roll, l.burn, l.up));
    offer.push(l);
  }
  item.offer = offer;
  track(save, 'enhance');
  return offer;
}

/** Settles a confession: take offer 0 or 1, or keep the old line (-1). */
export function settle(item: GearItem, choice: number) {
  const offer = item.offer;
  if (!offer) return;
  if (choice >= 0 && offer[choice] && item.rerollLine !== undefined) item.subs[item.rerollLine] = offer[choice];
  item.offer = undefined;
}

// ---- The Index (Edicts) --------------------------------------------------------------

/** Best roll ever melted, per Edict. */
export const indexOf = (save: SaveData) => (save.edictIndex ??= {});

/** Writes a melted piece's Edict into the Index. Returns true when it is new or better. */
export function recordEdict(save: SaveData, item: GearItem): boolean {
  if (!item.edict) return false;
  const idx = indexOf(save);
  const best = idx[item.edict.id];
  if (best !== undefined && best >= item.edict.roll) return false;
  idx[item.edict.id] = item.edict.roll;
  return true;
}

/** Would melting it teach the Index something? */
export const teaches = (save: SaveData, item: GearItem) => !!item.edict && (indexOf(save)[item.edict.id] ?? -1) < item.edict.roll;

export const imprintTithes = (item: GearItem) => Math.round(IMPRINT_COST.tithes * ipScale(item.ip));

export function imprintBlock(save: SaveData, item: GearItem, id: EdictId): string | undefined {
  if (item.grade !== 'sworn' && item.grade !== 'anathema') return 'Only Sworn or Anathema pieces';
  if (!edictDef(id)?.slots.includes(item.slot)) return `Not on a ${SLOT_NAME[item.slot]}`;
  if (indexOf(save)[id] === undefined) return 'Not in the Index yet';
  if (item.edict?.id === id && item.edict.roll >= indexOf(save)[id]!) return 'Already carries it';
  if (!hasAll(save, IMPRINT_COST.items)) return 'Not enough Consecrated Iron';
  if (save.tithes < imprintTithes(item)) return 'Not enough Tithes';
  return undefined;
}

/** Imprints an Edict from the Index (its best roll): a Sworn piece turns Anathema. No Penance spent. */
export function imprint(save: SaveData, item: GearItem, id: EdictId): boolean {
  if (imprintBlock(save, item, id)) return false;
  spend(save, IMPRINT_COST.items);
  save.tithes -= imprintTithes(item);
  item.edict = { id, roll: indexOf(save)[id]! };
  item.grade = 'anathema';
  item.rarity = GRADE.anathema.band;
  item.name = `${item.name.replace(/ of .*$/, '').replace(/^\S+ /, '')} of ${EDICT_OF[id]}`;
  return true;
}

// ---- Owning, wearing, melting ----------------------------------------------------------

export const ironText = (bag: Bag | undefined) => bagText(bag);

/** The armory, upgrading pieces from before Relics of War on first look. */
export const gearOf = (save: SaveData) => {
  if ((save.gear ??= []).some((g) => !g.grade)) convertLegacy(save);
  return save.gear!;
};
export const equipped = (save: SaveData, sisterId: string) => gearOf(save).filter((g) => g.on === sisterId);

/** Puts a piece on a Sister, taking off whatever she had in that slot. */
export function equip(save: SaveData, sisterId: string, uid: string) {
  const item = gearOf(save).find((g) => g.uid === uid);
  if (!item) return;
  for (const g of equipped(save, sisterId)) if (g.slot === item.slot) g.on = undefined;
  item.on = sisterId;
}

export function unequip(save: SaveData, uid: string) {
  const item = gearOf(save).find((g) => g.uid === uid);
  if (item) item.on = undefined;
}

/** What melting a piece leaves besides Tithes. */
export function meltBag(item: GearItem): Bag {
  const bag: Bag = {};
  if (item.grade === 'consecrated') bag.iron1 = 1;
  if (item.grade === 'sworn' || item.grade === 'anathema') bag.iron2 = 1;
  const frags = FRAGMENTS_FOR[item.grade];
  if (frags) bag.armory1 = frags;
  if (item.grade === 'godforged') bag.spark1 = 1;
  return bag;
}

/** Melts a piece: Tithes, Alms, materials, and its Edict into the Index. */
function melt(save: SaveData, piece: GearItem): number {
  const value = salvageValue(piece);
  save.tithes += value;
  earn(save, 0, ALMS_FOR_GEAR[piece.rarity]);
  give(save, meltBag(piece));
  recordEdict(save, piece);
  return value;
}

export function salvage(save: SaveData, uid: string): number {
  const list = gearOf(save);
  const i = list.findIndex((g) => g.uid === uid);
  if (i < 0) return 0;
  const [piece] = list.splice(i, 1);
  return melt(save, piece);
}

// ---- The loot filter ------------------------------------------------------------

export interface LootFilter {
  /** Melt new pieces of this grade and below on arrival. */
  melt?: 'worn' | 'consecrated' | 'sworn';
  /** Melt Anathema pieces whose Edict the Index already holds at an equal or better roll. */
  knownEdicts?: boolean;
}

export const filterOf = (save: SaveData): LootFilter => (save.lootFilter ??= {});

/** Would the filter melt this new piece? */
export function filtered(save: SaveData, item: GearItem): boolean {
  const f = filterOf(save);
  const rank = GRADES.indexOf(item.grade);
  if (f.melt && rank <= GRADES.indexOf(f.melt)) return true;
  if (f.knownEdicts && item.grade === 'anathema' && !teaches(save, item)) return true;
  return false;
}

/**
 * Moves loot into the armory. The loot filter melts what it should, and pieces
 * past MAX_GEAR melt too (their Edicts still reach the Index). Returns the Tithes paid.
 */
export function claimGear(save: SaveData, loot: GearItem[]): number {
  const list = gearOf(save);
  let melted = 0;
  for (const item of loot) {
    if (list.length >= MAX_GEAR || filtered(save, item)) {
      melted += melt(save, item);
      continue;
    }
    save.nextGearId = (save.nextGearId ?? 0) + 1;
    list.push({ ...item, uid: `g${save.nextGearId}`, on: undefined });
  }
  return melted;
}

// ---- What gear does -------------------------------------------------------------

export type GearBonus = Record<GearStat, number>;

/** Stat-block lines (main stats and stat affixes), summed. */
export function gearBonus(items: GearItem[]): GearBonus {
  const b: GearBonus = { atkPct: 0, hpPct: 0, armorPct: 0, mresPct: 0, crit: 0, critDmg: 0, spd: 0 };
  for (const g of items) {
    b[g.main] += mainValue(g);
    for (const s of g.subs) if (s.stat in b) b[s.stat as GearStat] += s.value;
  }
  return b;
}

type BattleKey = 'bossDmg' | 'litanyDmg' | 'dmgTaken' | 'healRecv' | 'zealGain' | 'lifesteal';

/** What a Sister's gear does in battle beyond her stats (read by combat.ts). */
export interface GearCombat {
  bossDmg: number;
  litanyDmg: number;
  dmgTaken: number;
  healRecv: number;
  zealGain: number;
  lifesteal: number;
  edicts: Partial<Record<EdictId, number>>;
  uniques: Partial<Record<UniqueId, number>>;
  /** Battle state (combat.ts): spent once-a-fight Edicts, Scourge stacks, One Creed's ATK. */
  spent?: { cloister?: boolean; ossuary?: boolean };
  scourge?: number;
  creed?: number;
}

/** Her battle lines, Edicts (each counts once: the best) and unique powers. `order` wakes Sworn lines. */
export function gearCombat(items: GearItem[], order?: string): GearCombat | undefined {
  if (!items.length) return undefined;
  const c: GearCombat = { bossDmg: 0, litanyDmg: 0, dmgTaken: 0, healRecv: 0, zealGain: 0, lifesteal: 0, edicts: {}, uniques: {} };
  for (const g of items) {
    for (const s of g.subs) if (!(s.stat in STAT_NAME)) c[s.stat as BattleKey] += s.value;
    if (g.edict) {
      const v = edictValue(g.edict.id, g.edict.roll, g.ip);
      c.edicts[g.edict.id] = Math.max(c.edicts[g.edict.id] ?? 0, v);
    }
    if (g.unique) {
      const u = uniqueDef(g.unique)!;
      c.uniques[g.unique] = uniqueValue(g.unique, g.uRoll ?? 0.5, !!order && order === u.order);
    }
  }
  for (const [k, cap] of Object.entries(LINE_CAP) as [BattleKey, number][]) c[k] = Math.min(cap, c[k]);
  // Only her MAX_POWERS strongest Edicts and relic powers wake.
  const powers = [
    ...(Object.entries(c.edicts) as [EdictId, number][]).map(([id, v]) => ({ id, edict: true, share: (v / edictDef(id)!.max) * edictDef(id)!.cp })),
    ...(Object.entries(c.uniques) as [UniqueId, number][]).map(([id, v]) => ({ id, edict: false, share: (v / uniqueDef(id)!.max) * uniqueDef(id)!.cp })),
  ].sort((a, b) => b.share - a.share);
  for (const p of powers.slice(MAX_POWERS)) {
    if (p.edict) delete c.edicts[p.id as EdictId];
    else delete c.uniques[p.id as UniqueId];
  }
  return c;
}

/** Is this piece's Edict or relic power awake on her (one of her MAX_POWERS strongest)? */
export function powerAwake(worn: GearItem[], item: GearItem, order?: string): boolean {
  const c = gearCombat(worn, order);
  if (item.edict) return c?.edicts[item.edict.id] !== undefined;
  if (item.unique) return c?.uniques[item.unique] !== undefined;
  return true;
}

/** Power share of what stats miss: battle lines, Edicts and unique powers (1.0 and up). */
export function gearShare(items: GearItem[], order?: string): number {
  const c = gearCombat(items, order);
  if (!c) return 1;
  let share = 1;
  for (const id of ['bossDmg', 'litanyDmg', 'dmgTaken', 'healRecv', 'zealGain', 'lifesteal'] as const) share += c[id] * (AFFIXES[id].cp ?? 0);
  for (const [id, v] of Object.entries(c.edicts) as [EdictId, number][]) {
    const e = edictDef(id)!;
    share += (v / e.max) * e.cp;
  }
  for (const [id, v] of Object.entries(c.uniques) as [UniqueId, number][]) {
    const u = uniqueDef(id)!;
    share += (v / u.max) * u.cp;
  }
  return share;
}

export const formatStat = (stat: AffixId, v: number) => {
  if (stat === 'spd') return `+${Math.round(v)} SPD`;
  if (stat === 'dmgTaken') return `-${Math.round(v * 1000) / 10}% ${AFFIXES[stat].label}`;
  const pct = v < 0.1 ? Math.round(v * 1000) / 10 : Math.round(v * 100);
  return `+${pct}% ${AFFIXES[stat].label}`;
};

/** "+6% ATK · 92%" with a flame for Burning lines. */
export const lineText = (s: GearSub) => `${s.burn ? '🔥' : ''}${formatStat(s.stat, s.value)}`;

/** Every new save starts with a worn set, so the gear page is never empty. */
export function starterGear(): GearItem[] {
  const piece = (uid: string, slot: GearSlot, name: string, main: GearStat): GearItem => ({ uid, slot, grade: 'worn', rarity: 'R', name, ip: 100, level: 0, main, subs: [], penance: 0 });
  return [piece('g-start-1', 'blade', 'Worn Flail', 'atkPct'), piece('g-start-2', 'habit', 'Worn Hairshirt', 'hpPct'), piece('g-start-3', 'rosary', 'Worn Rosary', 'crit')];
}

// ---- Old saves ------------------------------------------------------------------

const LEGACY: Record<Rarity, { grade: Grade; ip: number }> = { R: { grade: 'worn', ip: 150 }, SR: { grade: 'consecrated', ip: 250 }, SSR: { grade: 'sworn', ip: 400 }, UR: { grade: 'arms', ip: MAX_IP } };

/**
 * Turns pieces from before Relics of War into the new kind: R to Worn, SR to
 * Consecrated, SSR to Sworn, UR to the Saint's Arms of its slot. Levels, who
 * wears it and the old lines' stats are kept; sets retire. Sends one letter
 * with Godsparks and Armory Writs, since the new power budget trims late gear.
 */
export function convertLegacy(save: SaveData, rng: Rng = Math.random) {
  const list = save.gear ?? [];
  let hadReal = false;
  save.gear = list.map((old) => {
    if (old.grade) return old;
    if (!old.uid.startsWith('g-start')) hadReal = true;
    const { grade, ip } = LEGACY[old.rarity] ?? LEGACY.R;
    const oldSubs = (old.subs ?? []) as { stat: AffixId; value: number }[];
    if (grade === 'arms') {
      const fresh = makeGear(rng, 'UR', old.slot, {});
      return { ...fresh, uid: old.uid, level: old.level, on: old.on };
    }
    const piece = makeGear(rng, 'R', old.slot, { grade, ip });
    piece.main = old.main === 'spd' ? 'armorPct' : old.main;
    const kept = oldSubs.filter((s) => s.stat !== old.main && s.stat !== 'spd' && AFFIXES[s.stat]).slice(0, GRADE[grade].lines).map((s) => ({ stat: s.stat, roll: 0.85, value: 0 }) as GearSub);
    const extra = piece.subs.filter((s) => s.stat !== old.main && !kept.some((k) => k.stat === s.stat));
    piece.subs = [...kept, ...extra].slice(0, GRADE[grade].lines);
    const ups = SUB_UPGRADE_LEVELS.filter((l) => l <= old.level).length;
    for (let i = 0; i < ups && piece.subs.length; i++) piece.subs[i % piece.subs.length].up = (piece.subs[i % piece.subs.length].up ?? 0) + 1;
    refresh(piece);
    return { ...piece, uid: old.uid, name: old.name, level: old.level, on: old.on };
  });
  if (hadReal && !save.lootGift) {
    save.lootGift = true;
    send(save, {
      from: 'The Armory',
      title: 'Relics of War!',
      body: 'Your gear is reforged as loot: Item Power, Edicts, Saint\'s Arms and Godforged relics. Take these to start the hunt. Two Godsparks forge a Godforged relic of your choosing!',
      reward: LOOT_GIFT,
    });
  }
}

/** The Relics of War letter to saves that owned gear before it. */
export const LOOT_GIFT = { items: { spark1: 2, armory2: 10 } as Bag };
