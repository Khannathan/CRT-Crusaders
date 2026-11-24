import { CLASSES } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { AFFINITY, ENEMIES } from '../data/enemies';
import { dmgTagOf } from '../data/classes';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';
import { ENEMY_TUNE, type Battle } from './combat';
import { BELFRY, skirmish } from './crusade';
import type { Rng } from './gacha';
import { sisterPower } from './power';
import { dayKey, grant, type Reward } from './tasks';

/**
 * Purge Hunts, after AFK Journey's Dream Realm: one great beast a day from
 * a pool of six, each with mechanics that call for different Sisters. A hunt
 * lasts HUNT_ROUNDS rounds and is scored by the damage dealt; today's best
 * score pays milestones of Grace (for signature weapons). Felling the beast opens
 * the next difficulty, up to six tiers and then an endless climb.
 */
export const HUNT_ROUNDS = 12;
/** How long a hunt lasts on the real-time field (rounds were 2.2s, now 2s; field.ts keeps the length). */
export const HUNT_SECONDS = Math.round((HUNT_ROUNDS * 2.2) / 2) * 2;
export const HUNT_ENTRIES = 3;

export interface HuntMechanic {
  name: string;
  text: string;
  /** Who it puts in the spotlight. */
  answer: string;
}

export interface HuntDef {
  id: string;
  /** Enemy id of the beast. */
  boss: string;
  encounter: string;
  lore: string;
  mechanics: HuntMechanic[];
  /** Classes the mechanics call for, best first. */
  classes: string[];
}

export const HUNTS: HuntDef[] = [
  {
    id: 'flayed-saint', boss: 'flayed-saint', encounter: 'hunt-flayed-saint',
    lore: 'A saint who was skinned for her faith and would not stay dead. Her wounds close as fast as they are opened.',
    mechanics: [
      { name: 'Unending Martyrdom', text: 'Heals 4% of her HP every 2s. Half as much while she Bleeds, Burns or is Poisoned.', answer: 'War-Sisters (Bleed) and Censers (Burn)' },
      { name: 'Weeping Wounds', text: 'Makes every Sister Bleed.', answer: 'Confessors and Abbesses cure it' },
      { name: 'Thick Skin of Faith', text: 'Huge Magic Resist, thin Armor.', answer: 'Physical damage' },
    ],
    classes: ['warsister', 'censer', 'confessor', 'inquisitor', 'exorcist', 'abbess'],
  },
  {
    id: 'twofold-reliquary', boss: 'twofold-reliquary', encounter: 'hunt-twofold-reliquary',
    lore: 'A reliquary that holds two saints who hated each other. Every few breaths a different one wakes.',
    mechanics: [
      { name: 'Two Saints', text: 'Every 6s it swaps its Armor and Magic Resist. It starts weak to Magic.', answer: 'A party with both Physical and Magic damage' },
      { name: 'Gilded Crush', text: 'Hammers the Vanguard.', answer: 'A Hierophant up front' },
      { name: 'Cracked Gilding', text: 'Sunder and Hex cut through whichever guard is up.', answer: 'Executioners and Sentinels (Sunder), Oracles and Cantors (Hex)' },
    ],
    classes: ['inquisitor', 'oracle', 'hierophant', 'censer', 'cantor', 'arbalist'],
  },
  {
    id: 'colossus', boss: 'colossus', encounter: 'hunt-colossus',
    lore: 'The ossuary built itself a body out of every bone it was given. It is very slow and very strong.',
    mechanics: [
      { name: 'Grave Slam', text: 'Winds up, then hits the front Sister for over three times its attack.', answer: 'A Hierophant with Taunt, Ward or a shield' },
      { name: 'Raise the Dead', text: 'Calls Penitent Husks to stand in the way.', answer: 'Hits that strike every foe' },
      { name: 'Bone Armor', text: 'Very high Armor, almost no Magic Resist.', answer: 'Magic damage' },
    ],
    classes: ['hierophant', 'censer', 'oracle', 'confessor', 'sentinel', 'exorcist'],
  },
  {
    id: 'rot-mother', boss: 'rot-mother', encounter: 'hunt-rot-mother',
    lore: 'She nursed a plague village and kept every sickness she touched.',
    mechanics: [
      { name: 'Blight Psalm', text: 'Poisons every Sister, again and again.', answer: 'Confessors: heals and cures' },
      { name: 'Festering Touch', text: 'A heavy poison on the weakest Sister.', answer: 'Hierophants to Ward and shield' },
      { name: 'Rotten Hide', text: 'Thin Armor, thick Magic Resist.', answer: 'Physical damage' },
    ],
    classes: ['confessor', 'hierophant', 'warsister', 'inquisitor', 'hospitaller', 'martyr'],
  },
  {
    id: 'choirmaster', boss: 'choirmaster', encounter: 'hunt-choirmaster',
    lore: 'He conducts the drowned. While they sing, nothing can touch him.',
    mechanics: [
      { name: 'Shielded by Song', text: 'Takes 50% less damage while any singer stands.', answer: 'Censers, Exorcists and others who hit every foe' },
      { name: 'Summon the Choir', text: 'Calls new Bell Ringers.', answer: 'Kill the singers fast' },
      { name: 'Dread Chorus', text: 'Hits every Sister.', answer: 'Confessors to heal' },
    ],
    classes: ['censer', 'oracle', 'confessor', 'warsister', 'veilblade', 'hospitaller'],
  },
  {
    id: 'red-cardinal', boss: 'red-cardinal', encounter: 'hunt-red-cardinal',
    lore: 'A prince of the Church who signed a thousand burnings. His anger only grows.',
    mechanics: [
      { name: 'Mounting Wrath', text: 'Gains 8% attack every 2s. Hit him hard and early.', answer: 'Burst: Executioners, Veilblades and War-Sisters' },
      { name: 'Scarlet Edict', text: 'Steals 15 Zeal from the party.', answer: 'Oracles and Cantors to refill Zeal and haste the party' },
      { name: "Cardinal's Rod", text: 'Beats the weakest Sister.', answer: 'A Hierophant to Taunt' },
    ],
    classes: ['inquisitor', 'oracle', 'warsister', 'hierophant', 'adjudicator', 'sentinel'],
  },
  {
    id: 'font-leviathan', boss: 'font-leviathan', encounter: 'hunt-font-leviathan',
    lore: 'The baptismal font of a drowned cathedral grew a thing in it. Everyone it swallows is born again.',
    mechanics: [
      { name: 'Baptismal Waters', text: 'Heals 2% of its HP every 2s (half while it Bleeds, Burns or is Poisoned) and gains 4% attack every 2s.', answer: 'Damage over time early, burst late: Censers, Exorcists, War-Sisters' },
      { name: 'Swallow', text: 'Winds up, then swallows the strongest Sister and stuns her.', answer: 'A Hierophant or Sentinel to Taunt' },
      { name: 'Tidal Surge', text: 'Hits and weakens every Sister.', answer: 'Confessors and Cantors to keep the party up' },
    ],
    classes: ['censer', 'exorcist', 'warsister', 'hierophant', 'confessor', 'cantor'],
  },
  {
    id: 'iron-abbot', boss: 'iron-abbot', encounter: 'hunt-iron-abbot',
    lore: 'An abbot who had himself cast in iron so he could keep his chair forever. His wardens keep it with him.',
    mechanics: [
      { name: 'The Wardens\' Wall', text: 'Takes 40% less damage while any Warden stands.', answer: 'Hits that strike every foe, and Executioners for the Wardens' },
      { name: 'Iron and Glass', text: 'Every 8s it swaps its Armor and Magic Resist.', answer: 'A party with both Physical and Magic damage' },
      { name: 'Iron Sermon', text: 'Hits every Sister and Sunders her armor.', answer: 'Martyrs and Abbesses to hold the line' },
    ],
    classes: ['censer', 'inquisitor', 'oracle', 'martyr', 'arbalist', 'abbess'],
  },
];

/** Difficulty tiers: boss HP and attack. Past the sixth, each Endless step is 35% more. */
export const TIER_SCALE = [1, 1.6, 2.5, 4, 6, 9];
export const TIER_NAMES = ['I', 'II', 'III', 'IV', 'V', 'VI'];
export const tierScale = (tier: number) => (tier < TIER_SCALE.length ? TIER_SCALE[tier] : TIER_SCALE[TIER_SCALE.length - 1] * Math.pow(1.35, tier - TIER_SCALE.length + 1));
export const tierLabel = (tier: number) => (tier < TIER_NAMES.length ? TIER_NAMES[tier] : `Endless ${tier - TIER_NAMES.length + 1}`);

const DAY_MS = 86_400_000;
/** Today's hunt: the pool turns one a day (local days). */
export function huntOn(now = Date.now()): HuntDef {
  const d = new Date(now);
  const days = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
  return HUNTS[((days % HUNTS.length) + HUNTS.length) % HUNTS.length];
}

export interface HuntState {
  day: string;
  entries: number;
  /** Today's best score. */
  best: number;
  /** Milestones paid today (count). */
  paid: number;
  /** Highest tier unlocked (0 = tier I). */
  tier: number;
  /** Best score ever per hunt id. */
  records: Record<string, number>;
}

export function huntsOf(save: SaveData, now = Date.now()): HuntState {
  const day = dayKey(now);
  const s = (save.hunts ??= { day, entries: 0, best: 0, paid: 0, tier: 0, records: {} });
  if (s.day !== day) Object.assign(s, { day, entries: 0, best: 0, paid: 0 });
  return s;
}

export const huntEntriesLeft = (save: SaveData, now = Date.now()) => Math.max(0, HUNT_ENTRIES - huntsOf(save, now).entries);

/** One unit of score: the hunt beast's HP at tier I. Milestones and records are in these. */
export const scoreUnit = (h: HuntDef) => Math.round(ENEMIES[h.boss].hp * ENEMY_TUNE);

/** Score milestones (in beasts at tier I) and what each pays, once a day. */
export const MILESTONES: { at: number; reward: Reward }[] = [
  { at: 0.2, reward: { tithes: 300, items: { grace1: 3 } } },
  { at: 0.4, reward: { tithes: 400, items: { grace1: 4, kennel2: 1 } } },
  { at: 0.7, reward: { tithes: 500, items: { grace1: 5 } } },
  { at: 1, reward: { tithes: 600, items: { grace1: 6, kennel1: 5 }, gilt: 20 } },
  { at: 1.6, reward: { tithes: 800, items: { grace2: 2 } } },
  { at: 2.5, reward: { tithes: 1000, items: { grace2: 3, kennel2: 2 }, gilt: 30 } },
  { at: 4, reward: { tithes: 1200, items: { grace2: 4 } } },
  { at: 6, reward: { tithes: 1500, items: { grace3: 1, kennel2: 3, kennel1: 10 }, gilt: 40 } },
  { at: 9, reward: { tithes: 2000, items: { grace3: 2 } } },
  { at: 13, reward: { tithes: 2500, items: { grace3: 2 }, gilt: 60 } },
  { at: 18, reward: { tithes: 3000, items: { grace3: 3, kennel3: 1 } } },
];

export function huntBattle(save: SaveData, party: string[], hunt: HuntDef, tier: number, rng?: Rng): Battle {
  const b = skirmish(save, party, hunt.encounter, 0, rng, BELFRY, tierScale(tier));
  b.roundLimit = HUNT_ROUNDS;
  // The candle never gutters in a hunt: the round limit is the clock.
  b.vigil = HUNT_ROUNDS + 1;
  return b;
}

/** Damage dealt to the beast, counting what it healed back. */
export function huntScore(b: Battle, hunt: HuntDef): number {
  const boss = b.units.find((u) => u.side === 'enemy' && u.ref === hunt.boss);
  if (!boss) return 0;
  return Math.max(0, boss.maxHp - Math.max(0, boss.hp) + (boss.healed ?? 0));
}

export interface HuntResult {
  score: number;
  felled: boolean;
  /** Milestones newly reached, with their rewards (already paid). */
  rewards: Reward[];
  newBest: boolean;
  newRecord: boolean;
  /** A tier newly unlocked. */
  unlocked?: number;
}

/** Records a hunt: spends an entry, pays new milestones of today's best, and opens the next tier on a kill. */
export function finishHunt(save: SaveData, hunt: HuntDef, tier: number, battle: Battle, now = Date.now()): HuntResult {
  const s = huntsOf(save, now);
  s.entries += 1;
  const score = huntScore(battle, hunt);
  const felled = !battle.units.some((u) => u.ref === hunt.boss && u.hp > 0);
  const newBest = score > s.best;
  if (newBest) s.best = score;
  const newRecord = score > (s.records[hunt.id] ?? 0);
  if (newRecord) s.records[hunt.id] = score;
  const units = s.best / scoreUnit(hunt);
  const rewards: Reward[] = [];
  while (s.paid < MILESTONES.length && units >= MILESTONES[s.paid].at) {
    const r = MILESTONES[s.paid].reward;
    grant(save, r);
    rewards.push(r);
    s.paid += 1;
  }
  let unlocked: number | undefined;
  if (felled && tier === s.tier) {
    s.tier += 1;
    unlocked = s.tier;
  }
  return { score, felled, rewards, newBest, newRecord, unlocked };
}

/** The damage a beast is weak to (both, for the Twofold Reliquary). */
export function weakTo(hunt: HuntDef): ('physical' | 'magic')[] {
  const e = ENEMIES[hunt.boss];
  if (e.traits?.swap) return ['physical', 'magic'];
  const mres = AFFINITY[hunt.boss]?.mres ?? e.armor;
  return [mres > e.armor ? 'physical' : 'magic'];
}

export const baneOf = (hunt: HuntDef) => AFFINITY[hunt.boss]?.bane;

export interface Pick {
  c: CrusaderDef;
  why: string[];
}

/** How much rarity counts when ranking every Sister, owned or not ('all'). */
const RARITY_WEIGHT: Record<string, number> = { UR: 1, SSR: 0.8, SR: 0.6, R: 0.45 };

/**
 * Sisters ranked for a hunt: a class it calls for, the damage it fears, its
 * bane Order, then strength. 'owned' ranks your roster by its Power now;
 * 'all' ranks every Sister in the game by rarity, owned or not.
 */
export function recommendFor(save: SaveData, hunt: HuntDef, n = 4, from: 'owned' | 'all' = 'owned'): Pick[] {
  const weak = weakTo(hunt);
  const bane = baneOf(hunt);
  const owned = from === 'all' ? CRUSADERS : CRUSADERS.filter((c) => save.owned[c.id]);
  const top = Math.max(1, ...owned.map((c) => (save.owned[c.id] ? sisterPower(save, c) : 0)));
  const strength = (c: CrusaderDef) => (from === 'all' ? RARITY_WEIGHT[c.rarity] ?? 0.5 : sisterPower(save, c) / top);
  const scored = owned.map((c) => {
    const why: string[] = [];
    let score = 0;
    const ci = hunt.classes.indexOf(c.classId);
    if (ci >= 0) {
      score += 3 - ci * 0.4;
      why.push(CLASSES[c.classId].name.split(' ').pop()!);
    }
    if (weak.length === 1 && dmgTagOf(c) === weak[0]) {
      score += 1.5;
      why.push(weak[0] === 'physical' ? 'Physical' : 'Magic');
    }
    if (bane && c.order === bane) {
      score += 1.5;
      why.push('Bane Order');
    }
    score += 2 * strength(c);
    return { c, why, score };
  });
  // Pick the best, but no more than two of one class, so the party has answers to every mechanic.
  const out: Pick[] = [];
  const perClass: Record<string, number> = {};
  for (const x of scored.sort((a, b) => b.score - a.score)) {
    if ((perClass[x.c.classId] ?? 0) >= 2) continue;
    perClass[x.c.classId] = (perClass[x.c.classId] ?? 0) + 1;
    out.push({ c: x.c, why: x.why });
    if (out.length >= n) break;
  }
  // The beast's first-named class is the one it most calls for: make sure one comes along.
  const need = hunt.classes[0];
  if (need && out.length >= n && !out.some((p) => p.c.classId === need)) {
    const best = scored.find((x) => x.c.classId === need);
    if (best) out[out.length - 1] = { c: best.c, why: best.why };
  }
  return out;
}
