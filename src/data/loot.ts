import type { Rarity } from './types';

/**
 * Relics of War: the loot tables (design doc https://claude.ai/artifact/3BWexqdwzKubDMduRY4bkh).
 *
 * Grades are how many lines a piece rolls; Item Power (1-800) is how big those
 * lines are; each line's roll (70-100%) is where it landed in its range.
 * Systems live in systems/gear.ts; this file is the tables only.
 */
export type Grade = 'worn' | 'consecrated' | 'sworn' | 'anathema' | 'arms' | 'godforged';
export const GRADES: Grade[] = ['worn', 'consecrated', 'sworn', 'anathema', 'arms', 'godforged'];

export interface GradeDef {
  name: string;
  color: number;
  /** Affix lines rolled. */
  lines: number;
  /** Penance (crafting budget) at birth: [min, max]. */
  penance: [number, number];
  /** The old rarity band, for Alms, colours on old screens and melt-all filters. */
  band: Rarity;
}

export const GRADE: Record<Grade, GradeDef> = {
  worn: { name: 'Worn', color: 0x9a948c, lines: 0, penance: [0, 0], band: 'R' },
  consecrated: { name: 'Consecrated', color: 0x5b8fd6, lines: 2, penance: [10, 10], band: 'SR' },
  sworn: { name: 'Sworn', color: 0xe8c547, lines: 3, penance: [20, 28], band: 'SSR' },
  anathema: { name: 'Anathema', color: 0xe07a2a, lines: 3, penance: [20, 28], band: 'SSR' },
  arms: { name: "Saint's Arms", color: 0xe8dcc0, lines: 3, penance: [16, 16], band: 'UR' },
  godforged: { name: 'Godforged', color: 0xd0263a, lines: 4, penance: [12, 12], band: 'UR' },
};

/** Highest Item Power. */
export const MAX_IP = 800;
/** Item Power from which a piece is Ancient and its lines may Burn. */
export const ANCIENT_IP = 725;
/** Chance an Ancient piece's line Burns (x BURN_MULT). */
export const BURN_CHANCE = 0.05;
export const BURN_MULT = 1.5;
/** Rolls land between these shares of the top value. */
export const ROLL_MIN = 0.7;

/** How big Item Power makes a line: 0.34 at IP 100, 1.0 at IP 800. */
export const ipScale = (ip: number) => 0.25 + (0.75 * Math.min(ip, MAX_IP)) / MAX_IP;

// ---- Affixes -----------------------------------------------------------------

/** Stats a Sister's stat block carries (gear.ts sums them into statsFor). */
export type StatAffix = 'atkPct' | 'hpPct' | 'armorPct' | 'mresPct' | 'crit' | 'critDmg' | 'spd';
/** Lines that only act in battle (combat.ts reads them off Unit.gear). */
export type BattleAffix = 'bossDmg' | 'litanyDmg' | 'dmgTaken' | 'healRecv' | 'zealGain' | 'lifesteal';
export type AffixId = StatAffix | BattleAffix;

export interface AffixDef {
  id: AffixId;
  name: string;
  family: 'Offense' | 'Defense' | 'Zeal';
  /** Value of a 100% roll at IP 800 (a share, or whole points for SPD). */
  top: number;
  /** How the card writes it: "+6% ATK", "-4% damage taken". */
  label: string;
  /** Power weight per point (battle lines only; stat lines feed Power through stats). */
  cp?: number;
}

export const AFFIXES: Record<AffixId, AffixDef> = {
  atkPct: { id: 'atkPct', name: 'ATK', family: 'Offense', top: 0.017, label: 'ATK' },
  crit: { id: 'crit', name: 'CRIT', family: 'Offense', top: 0.011, label: 'CRIT' },
  critDmg: { id: 'critDmg', name: 'CRIT DMG', family: 'Offense', top: 0.015, label: 'CRIT DMG' },
  bossDmg: { id: 'bossDmg', name: 'Boss damage', family: 'Offense', top: 0.035, label: 'damage to bosses', cp: 0.35 },
  litanyDmg: { id: 'litanyDmg', name: 'Litany damage', family: 'Offense', top: 0.045, label: 'Litany damage', cp: 0.3 },
  hpPct: { id: 'hpPct', name: 'HP', family: 'Defense', top: 0.017, label: 'HP' },
  armorPct: { id: 'armorPct', name: 'ARM', family: 'Defense', top: 0.023, label: 'ARM' },
  mresPct: { id: 'mresPct', name: 'MRES', family: 'Defense', top: 0.023, label: 'MRES' },
  dmgTaken: { id: 'dmgTaken', name: 'Damage taken', family: 'Defense', top: 0.0175, label: 'damage taken', cp: 0.8 },
  healRecv: { id: 'healRecv', name: 'Healing received', family: 'Defense', top: 0.035, label: 'healing received', cp: 0.2 },
  zealGain: { id: 'zealGain', name: 'Zeal gained', family: 'Zeal', top: 0.03, label: 'Zeal gained', cp: 0.35 },
  lifesteal: { id: 'lifesteal', name: 'Lifesteal', family: 'Zeal', top: 0.0125, label: 'lifesteal', cp: 0.6 },
  spd: { id: 'spd', name: 'SPD', family: 'Zeal', top: 1, label: 'SPD' },
};
/** Lines a piece can roll. Gear never gives Speed: turn order stays the Sisters' own (Epic Seven's speed-gear trap). */
export const AFFIX_IDS: AffixId[] = (Object.keys(AFFIXES) as AffixId[]).filter((a) => a !== 'spd');

/** Battle lines stop counting past these totals (like resistance caps). */
export const LINE_CAP: Partial<Record<AffixId, number>> = { bossDmg: 0.025, litanyDmg: 0.035, dmgTaken: 0.02, healRecv: 0.04, zealGain: 0.025, lifesteal: 0.01 };

/** Main stat of a +0 piece at IP 800, before enhancing. */
export const MAIN_TOP: Record<StatAffix, number> = { atkPct: 0.028, hpPct: 0.028, armorPct: 0.035, mresPct: 0.035, crit: 0.015, critDmg: 0.021, spd: 0 };

/** What each role hopes a drop rolls (smart loot weights these x3). */
export const ROLE_AFFIXES: Record<string, AffixId[]> = {
  Tank: ['hpPct', 'armorPct', 'mresPct', 'dmgTaken', 'healRecv', 'lifesteal'],
  Healer: ['hpPct', 'mresPct', 'zealGain', 'healRecv', 'dmgTaken', 'lifesteal'],
  Buffer: ['zealGain', 'hpPct', 'atkPct', 'litanyDmg', 'crit', 'mresPct'],
  'Melee DPS': ['atkPct', 'crit', 'critDmg', 'bossDmg', 'litanyDmg', 'lifesteal'],
  'Ranged DPS': ['atkPct', 'crit', 'critDmg', 'bossDmg', 'litanyDmg', 'zealGain'],
};

// ---- Edicts (D4 Aspects) -------------------------------------------------------

export type EdictId =
  | 'lastRites'
  | 'scourge'
  | 'executioner'
  | 'flagellant'
  | 'inquisitor'
  | 'cloister'
  | 'hairshirt'
  | 'ossuary'
  | 'censer'
  | 'pilgrim'
  | 'bell'
  | 'oneCreed';

export type EdictKind = 'Wrath' | 'Bulwark' | 'Zeal' | 'Creed';
type Slot = 'blade' | 'habit' | 'veil' | 'sabatons' | 'rosary';

export interface EdictDef {
  id: EdictId;
  name: string;
  kind: EdictKind;
  /** Value range at IP 800: a roll of 0 gives min, 1 gives max. */
  min: number;
  max: number;
  /** Rules text; {v} is the value, written as a percent unless `flat`. */
  text: string;
  flat?: boolean;
  /** Slots that can carry it (D4: an Aspect fits some slots only). */
  slots: Slot[];
  /** Power share of a top roll. */
  cp: number;
  /** The old gear set it replaced, if any. */
  wasSet?: string;
}

const WRATH: Slot[] = ['blade', 'rosary'];
const BULWARK: Slot[] = ['habit', 'veil', 'sabatons'];
const ZEAL: Slot[] = ['rosary', 'veil', 'sabatons'];
const ANY: Slot[] = ['blade', 'habit', 'veil', 'sabatons', 'rosary'];

export const EDICTS: EdictDef[] = [
  { id: 'lastRites', name: 'Edict of Last Rites', kind: 'Wrath', min: 0.15, max: 0.225, text: 'Hit foes under 30% HP for +{v} damage.', slots: WRATH, cp: 0.0375 },
  { id: 'scourge', name: 'Edict of the Scourge', kind: 'Wrath', min: 0.045, max: 0.068, text: 'Each Litany costs you 2% HP and grants +{v} ATK for the fight.', slots: WRATH, cp: 0.045 },
  { id: 'executioner', name: 'Edict of the Executioner', kind: 'Wrath', min: 0.15, max: 0.225, text: 'Above 70% HP, crits deal +{v} damage.', slots: WRATH, cp: 0.0375, wasSet: 'Executioner' },
  { id: 'flagellant', name: 'Edict of the Flagellant', kind: 'Wrath', min: 0.09, max: 0.135, text: 'Below half HP, deal +{v} damage.', slots: WRATH, cp: 0.0375, wasSet: 'Flagellant' },
  { id: 'inquisitor', name: 'Edict of the Inquisitor', kind: 'Wrath', min: 0.075, max: 0.112, text: '+{v} CRIT against bosses.', slots: WRATH, cp: 0.0375, wasSet: 'Inquisitor' },
  { id: 'cloister', name: 'Edict of the Cloister', kind: 'Bulwark', min: 0.225, max: 0.338, text: 'The first blow each fight deals you {v} less.', slots: BULWARK, cp: 0.03, wasSet: 'Cloister' },
  { id: 'hairshirt', name: 'Edict of the Hairshirt', kind: 'Bulwark', min: 0.06, max: 0.09, text: 'Reflect {v} of the damage you take.', slots: BULWARK, cp: 0.0375 },
  { id: 'ossuary', name: 'Edict of the Ossuary', kind: 'Bulwark', min: 0.075, max: 0.112, text: 'Below 40% HP, raise a barrier of {v} max HP, once a fight.', slots: BULWARK, cp: 0.0375, wasSet: 'Ossuary' },
  { id: 'censer', name: 'Edict of the Censer', kind: 'Zeal', min: 0.075, max: 0.112, text: 'Each Litany refunds {v} of its Zeal.', slots: ZEAL, cp: 0.045 },
  { id: 'pilgrim', name: 'Edict of the Pilgrim', kind: 'Zeal', min: 10, max: 20, text: 'Start every fight with +{v} Zeal.', flat: true, slots: ZEAL, cp: 0.0375, wasSet: 'Pilgrim' },
  { id: 'bell', name: 'Edict of the Bell', kind: 'Zeal', min: 0.45, max: 0.675, text: 'Every 4th attack tolls for +{v} damage.', slots: ZEAL, cp: 0.0375 },
  { id: 'oneCreed', name: 'Edict of One Creed', kind: 'Creed', min: 0.015, max: 0.022, text: '+{v} ATK for each other Sister of your Order in the party.', slots: ANY, cp: 0.03 },
];
export const edictDef = (id: EdictId | undefined) => EDICTS.find((e) => e.id === id);

/** An Edict's value for a roll (0-1) on a piece of this Item Power. */
export const edictValue = (id: EdictId, roll: number, ip: number) => {
  const e = edictDef(id)!;
  const v = (e.min + (e.max - e.min) * roll) * (0.6 + (0.4 * Math.min(ip, MAX_IP)) / MAX_IP);
  return e.flat ? Math.round(v) : Math.round(v * 1000) / 1000;
};

export const edictText = (id: EdictId, value: number) => {
  const e = edictDef(id)!;
  return e.text.replace('{v}', e.flat ? `${value}` : `${Math.round(value * 100)}%`);
};

// ---- Saint's Arms and Godforged ---------------------------------------------------

export type UniqueId = 'unsleepingFlail' | 'ashMail' | 'crossVisor' | 'pyreSabatons' | 'lastLantern' | 'vigiliaKey';

export interface UniqueDef {
  id: UniqueId;
  name: string;
  grade: 'arms' | 'godforged';
  slot: Slot;
  /** The Order it was sworn to: worn by one of its Sisters, the Sworn line wakes (+SWORN_LINE). */
  order: string;
  main: StatAffix;
  /** Its fixed affix list (rolled for quality). */
  affixes: AffixId[];
  /** Its power; {v} is the value. */
  text: string;
  min: number;
  max: number;
  flat?: boolean;
  cp: number;
  flavor: string;
}

/** Edicts and relic powers that wake at once on one Sister: her strongest MAX_POWERS (the rest sleep). */
export const MAX_POWERS = 3;

/** A Saint's Arms worn by a Sister of its Order: its power grows this much. */
export const SWORN_LINE = 0.25;

export const UNIQUES: UniqueDef[] = [
  {
    id: 'unsleepingFlail', name: 'Flail of the Unsleeping Watch', grade: 'arms', slot: 'blade', order: 'Iron Vigil', main: 'atkPct',
    affixes: ['crit', 'litanyDmg', 'bossDmg'], min: 0.09, max: 0.135, cp: 0.052,
    text: 'Your Litany marks every foe. Marked foes take +{v} damage from your Order.',
    flavor: 'Its chain was forged from a cell door. The prisoner is still inside.',
  },
  {
    id: 'ashMail', name: 'Templar Ash-Mail', grade: 'arms', slot: 'habit', order: 'Iron Vigil', main: 'hpPct',
    affixes: ['armorPct', 'dmgTaken', 'healRecv'], min: 0.06, max: 0.09, cp: 0.046,
    text: 'Take {v} less damage, doubled while you stand at the front.',
    flavor: 'Quenched in the ash of the first pyre. It never cooled.',
  },
  {
    id: 'crossVisor', name: 'Visor of the Burning Cross', grade: 'arms', slot: 'veil', order: 'Iron Vigil', main: 'mresPct',
    affixes: ['hpPct', 'zealGain', 'litanyDmg'], min: 0.045, max: 0.068, cp: 0.046,
    text: 'Your Litany heals every Sister for {v} of your max HP.',
    flavor: 'Through its slit the whole world is on fire, and righteous.',
  },
  {
    id: 'pyreSabatons', name: 'Pyre-Walker Sabatons', grade: 'arms', slot: 'sabatons', order: 'Iron Vigil', main: 'hpPct',
    affixes: ['hpPct', 'zealGain', 'armorPct'], min: 4, max: 8, flat: true, cp: 0.039,
    text: 'Every Sister of your Order starts each fight with +{v} Zeal for each of you in the party.',
    flavor: 'Worn by the Templar who walked out of her own pyre.',
  },
  {
    id: 'lastLantern', name: 'Lantern of the Last Watch', grade: 'arms', slot: 'rosary', order: 'Iron Vigil', main: 'critDmg',
    affixes: ['atkPct', 'crit', 'zealGain'], min: 4, max: 8, flat: true, cp: 0.046,
    text: 'Each foe you slay gives every Sister +{v} Zeal.',
    flavor: 'Lit at the first watch. It goes out at the last.',
  },
  {
    id: 'vigiliaKey', name: "Vigilia's Key of the Last Door", grade: 'godforged', slot: 'rosary', order: 'Iron Vigil', main: 'atkPct',
    affixes: ['crit', 'critDmg', 'hpPct', 'zealGain'], min: 0.3, max: 0.4, cp: 0.06,
    text: 'Once a fight, the first Sister to fall rises at {v} HP with full Zeal.',
    flavor: 'The god of the Iron Vigil holds every key. This one opens the grave from inside.',
  },
];
export const uniqueDef = (id: string | undefined) => UNIQUES.find((u) => u.id === id);
export const SAINTS_ARMS = UNIQUES.filter((u) => u.grade === 'arms');
export const GODFORGED = UNIQUES.filter((u) => u.grade === 'godforged');

export const uniqueValue = (id: UniqueId, roll: number, sworn: boolean) => {
  const u = uniqueDef(id)!;
  const v = (u.min + (u.max - u.min) * roll) * (sworn ? 1 + SWORN_LINE : 1);
  return u.flat ? Math.round(v) : Math.round(v * 1000) / 1000;
};

export const uniqueText = (id: UniqueId, value: number) => {
  const u = uniqueDef(id)!;
  return u.text.replace('{v}', u.flat ? `${value}` : `${Math.round(value * 100)}%`);
};

// ---- Names ------------------------------------------------------------------

export const PREFIX: Record<'worn' | 'consecrated' | 'sworn', string[]> = {
  worn: ['Worn', 'Tarnished', 'Pilgrim', 'Penitent'],
  consecrated: ['Consecrated', 'Anointed', 'Vigilant', 'Chrism-Oiled'],
  sworn: ['Sworn', "Zealot's", 'Inquisitorial', 'Pyre-Tempered'],
};

export const NOUN: Record<Slot, string[]> = {
  blade: ['Flail', 'Mace', 'Censer-Hammer', 'Scourge', 'Longsword', 'Bone Saw', 'Glaive'],
  habit: ['Habit', 'Hairshirt', 'Cuirass', 'Chainmail', 'Shroud', 'Tabard'],
  veil: ['Veil', 'Wimple', 'Mourning Hood', 'Coif', 'Mitre', 'Visor'],
  sabatons: ['Sabatons', 'Greaves', 'Pilgrim Boots', 'Penitent Sandals', 'Iron Shoes'],
  rosary: ['Rosary', 'Reliquary', 'Prayer Beads', 'Censer', 'Burning Icon', 'Fingerbone'],
};

/** "Scourge of the Pyre": Anathema pieces are named for their Edict. */
export const EDICT_OF: Record<EdictId, string> = {
  lastRites: 'Last Rites',
  scourge: 'the Scourge',
  executioner: 'the Headsman',
  flagellant: 'the Lash',
  inquisitor: 'the Question',
  cloister: 'the Cloister',
  hairshirt: 'the Hairshirt',
  ossuary: 'the Ossuary',
  censer: 'the Censer',
  pilgrim: 'the Pilgrim',
  bell: 'the Bell',
  oneCreed: 'One Creed',
};
