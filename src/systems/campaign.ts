import type { MarchState } from './march';
import type { SaveData } from '../state/save';
import type { Battle } from './combat';
import { CRYPTS, skirmish, type CryptDef } from './crusade';
import { earn, giltOf } from './currency';
import type { Rng } from './gacha';
import { give, type Bag } from './items';
import { CP, foePower, recommendedPower } from './power';
import { dayKey } from './tasks';
import { addStigmata } from './tiers';

/**
 * The Pilgrim's Road: the Vigil's own campaign. A road of chapters, ten stages
 * each, the tenth a boss. Each stage is one fight; the first clear pays once, a
 * chapter's boss opens its chest. The highest stage cleared sets how fast the
 * Vigil gathers while you are away (see vigil.ts).
 */
export const STAGES_PER_CHAPTER = 10;

export interface ChapterDef {
  name: string;
  blurb: string;
  /** The crypt whose foes walk this stretch of road. */
  crypt: CryptDef;
}

export const CHAPTERS: ChapterDef[] = [
  { name: 'The Drowned Road', blurb: 'Causeways over black water, where the drowned keep pace.', crypt: CRYPTS[0] },
  { name: 'The Marsh Bells', blurb: 'Bells ring under the reeds. Something answers them.', crypt: CRYPTS[1] },
  { name: 'The Weeping Mile', blurb: 'Every shrine on this mile has a nun who will not stop praying.', crypt: CRYPTS[2] },
  { name: 'The Ash Fields', blurb: 'Burned scriptoria, and the ink still crawling.', crypt: CRYPTS[3] },
  { name: 'The Hanging Way', blurb: 'The last road before the cathedral, under a sky of chains.', crypt: CRYPTS[4] },
];

export const TOTAL_STAGES = CHAPTERS.length * STAGES_PER_CHAPTER;

/**
 * Recommended Power asked by stage 1, and what each later stage adds; bosses
 * count for less (recommended Power overstates a lone boss). Each stage's foes are scaled to hit this, so the road
 * climbs evenly whichever line-up a stage draws.
 */
const REC_START = 3000;
const REC_STEP = 500;
const BOSS_REC = 0.9;

export const stageTarget = (n: number) => (REC_START + REC_STEP * (n - 1)) * (stageDef(n).boss ? BOSS_REC : 1);

const scales = new Map<number, number>();
/** The strength that brings a stage's foes to its target Power (two refining steps, cached). */
function stageScale(n: number) {
  let v = scales.get(n);
  if (v === undefined) {
    const s = stageDef(n);
    const crypt = { ...CHAPTERS[s.chapter].crypt, power: 1 };
    const rec = (scale: number) => foePower(skirmish(EMPTY, [], s.encounter, 0, undefined, crypt, scale)) * CP.recommend;
    v = 1;
    for (let i = 0; i < 3; i++) v *= stageTarget(n) / rec(v);
    scales.set(n, v);
  }
  return v;
}
const EMPTY = { owned: {} } as unknown as SaveData;

export interface StageDef {
  /** 1-based, along the whole road. */
  n: number;
  chapter: number;
  /** 1..10 within its chapter. */
  index: number;
  boss: boolean;
  elite: boolean;
  encounter: string;
  /** "2-7" */
  label: string;
}

export function stageDef(n: number): StageDef {
  const chapter = Math.floor((n - 1) / STAGES_PER_CHAPTER);
  const index = ((n - 1) % STAGES_PER_CHAPTER) + 1;
  const c = CHAPTERS[Math.min(chapter, CHAPTERS.length - 1)].crypt;
  const boss = index === STAGES_PER_CHAPTER;
  const elite = index === 5;
  const pool = boss ? [c.boss] : elite ? c.elites : index <= 3 ? c.early : c.late;
  return { n, chapter, index, boss, elite, encounter: pool[n % pool.length], label: `${chapter + 1}-${index}` };
}

export interface FastState {
  day: string;
  used: number;
}

export interface CampaignState {
  /** Highest stage cleared (0 = none). */
  best: number;
  fast?: FastState;
  /** The Vigil marching on by itself (march.ts). */
  march?: MarchState;
  /** The Penitent and Damned roads (systems/hardRoad.ts). */
  hard?: Partial<Record<'penitent' | 'damned', { best: number; unbroken: number[] }>>;
}

export const campaignOf = (save: SaveData): CampaignState => (save.campaign ??= { best: 0 });

/** The stage to fight next (the last one once the road is done). */
export const nextStage = (save: SaveData) => Math.min(TOTAL_STAGES, campaignOf(save).best + 1);
export const roadDone = (save: SaveData) => campaignOf(save).best >= TOTAL_STAGES;
export const chaptersCleared = (save: SaveData) => Math.floor(campaignOf(save).best / STAGES_PER_CHAPTER);

/** Foes on the road use the chapter crypt's line-ups, at the stage's own strength. */
export function stageBattle(save: SaveData, party: string[], n: number, rng?: Rng): Battle {
  const s = stageDef(n);
  const crypt = { ...CHAPTERS[s.chapter].crypt, power: 1 };
  return skirmish(save, party, s.encounter, 0, rng, crypt, stageScale(n));
}

export const stageRecommended = (save: SaveData, n: number) => recommendedPower(stageBattle(save, [], n));

export interface StageReward {
  stigmata?: number;
  tithes: number;
  seals: number;
  gilt: number;
  items: Bag;
}

/** Paid once, on a stage's first clear. */
export function stageReward(n: number): StageReward {
  const s = stageDef(n);
  const oil = { unction1: 2 + Math.floor(n / 8) };
  if (s.boss) return { tithes: 150 + 20 * n, seals: 0, gilt: 0, items: { unction2: 2 + Math.floor(n / 10) } };
  return { tithes: 40 + 12 * n, seals: s.elite ? 1 : 0, gilt: 0, items: s.elite ? { ash1: 2, ...oil } : oil };
}

/** A chapter's chest, opened by its boss. */
export function chapterChest(chapter: number): StageReward {
  const step = chapter + 1;
  return { tithes: 0, seals: 3 + step, gilt: 60 + 40 * step, stigmata: 1 + Math.floor(step / 2), items: { ash2: step, page2: step, unction3: step, ...(step >= 3 ? { incense2: step - 1 } : {}), ...(step >= 4 ? { canon1: 2 * step } : {}) } };
}

export interface StageResult {
  won: boolean;
  first: boolean;
  reward?: StageReward;
  chest?: StageReward;
}

function pay(save: SaveData, r: StageReward) {
  save.tithes += r.tithes;
  save.seals += r.seals;
  earn(save, r.gilt);
  give(save, r.items);
  addStigmata(save, r.stigmata ?? 0);
}

/** Settles a stage fight. Only the next stage can be won for the first time. */
export function finishStage(save: SaveData, n: number, outcome: 'victory' | 'defeat'): StageResult {
  const c = campaignOf(save);
  if (outcome !== 'victory') return { won: false, first: false };
  if (n !== c.best + 1) return { won: true, first: false };
  c.best = n;
  const reward = stageReward(n);
  pay(save, reward);
  const s = stageDef(n);
  const chest = s.boss ? chapterChest(s.chapter) : undefined;
  if (chest) pay(save, chest);
  return { won: true, first: true, reward, chest };
}

/* ---- Idle rates: what the Vigil gathers per hour, from the road ---- */

/** Per hour on a fresh road. */
export const BASE_RATES = { tithes: 60, gear: 0.3, seals: 0.25 };

/** Rates per hour from the highest stage cleared; each chapter cleared is a further step. */
/** Each Bell Tower floor cleared adds this share to the Vigil's Tithes, gear and materials. */
export const BELL_VIGIL = 0.01;
/** The Vigil's Bell Tower multiplier: it keeps rising, since the Tower has no top. */
export const bellBonus = (save: SaveData) => 1 + BELL_VIGIL * (save.tower?.best ?? 0);

export function roadRates(save: SaveData) {
  const best = campaignOf(save).best;
  const ch = chaptersCleared(save);
  const bell = bellBonus(save);
  return {
    tithes: BASE_RATES.tithes * (1 + 0.06 * best) * (1 + 0.15 * ch) * bell,
    gear: (BASE_RATES.gear + 0.012 * best) * bell,
    seals: BASE_RATES.seals + 0.004 * best,
    /** Extra materials per hour on top of the Vigil's base find. */
    items: (0.5 + 0.02 * best) * bell,
  };
}

/* ---- Fast Reward: two hours of the Vigil at once ---- */

export const FAST_HOURS = 2;
export const FAST_FREE = 1;
export const FAST_PAID = 3;
export const FAST_GILT = 50;

function fastOf(save: SaveData, now: number) {
  const c = campaignOf(save);
  const day = dayKey(now);
  if (!c.fast || c.fast.day !== day) c.fast = { day, used: 0 };
  return c.fast;
}

/** What the next Fast Reward costs today: 0 (free), Gilt, or null when none are left. */
export function fastCost(save: SaveData, now = Date.now()): number | null {
  const f = fastOf(save, now);
  if (f.used < FAST_FREE) return 0;
  if (f.used < FAST_FREE + FAST_PAID) return FAST_GILT;
  return null;
}

/** Spends today's Fast Reward (free or for Gilt); false if it can't be paid. */
export function useFast(save: SaveData, now = Date.now()): boolean {
  const cost = fastCost(save, now);
  if (cost === null || giltOf(save) < cost) return false;
  if (cost) save.gilt = giltOf(save) - cost;
  fastOf(save, now).used += 1;
  return true;
}
