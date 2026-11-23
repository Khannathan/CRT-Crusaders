import type { SaveData } from '../state/save';
import { CHAPTERS, STAGES_PER_CHAPTER, TOTAL_STAGES, campaignOf, type StageReward } from './campaign';
import type { Battle } from './combat';
import { CRYPTS, skirmish } from './crusade';
import { earn } from './currency';
import type { Rng } from './gacha';
import { give } from './items';
import { CP, foePower } from './power';
import { addStigmata } from './tiers';

/**
 * The Penitent and Damned roads: the Pilgrim's Road walked again, harder.
 * Same fifty stages and chapters, but each chapter's foes come from a deeper
 * crypt, and each stage asks far more Power. Penitent opens once the Road is
 * walked; Damned once Penitent is. No story plays here (it belongs to the
 * first walk). Every stage has a vow, "none fall": win without losing a
 * Sister for a bonus the first time. Every tenth stage opens a chest.
 */
export type HardMode = 'penitent' | 'damned';
export const HARD_MODES: HardMode[] = ['penitent', 'damned'];
export const HARD_NAME: Record<HardMode, string> = { penitent: 'The Penitent Road', damned: 'The Damned Road' };

export interface HardState {
  best: number;
  /** Stages won with no Sister fallen (their vow bonus paid). */
  unbroken: number[];
}

export const hardOf = (save: SaveData, mode: HardMode): HardState => {
  const c = campaignOf(save);
  return ((c.hard ??= {})[mode] ??= { best: 0, unbroken: [] });
};

export const hardOpen = (save: SaveData, mode: HardMode) => (mode === 'penitent' ? campaignOf(save).best >= TOTAL_STAGES : hardOf(save, 'penitent').best >= TOTAL_STAGES);
export const hardNext = (save: SaveData, mode: HardMode) => Math.min(TOTAL_STAGES, hardOf(save, mode).best + 1);

/** Which deeper crypt sends its foes to each chapter: Penitent takes the next five, Damned the five after. */
const cryptFor = (mode: HardMode, chapter: number) => CRYPTS[Math.min(CRYPTS.length - 1, 2 + chapter + (mode === 'penitent' ? 3 : 8))];

export interface HardStageDef {
  n: number;
  chapter: number;
  index: number;
  boss: boolean;
  elite: boolean;
  encounter: string;
  label: string;
}

export function hardStageDef(mode: HardMode, n: number): HardStageDef {
  const chapter = Math.floor((n - 1) / STAGES_PER_CHAPTER);
  const index = ((n - 1) % STAGES_PER_CHAPTER) + 1;
  const c = cryptFor(mode, Math.min(chapter, CHAPTERS.length - 1));
  const boss = index === STAGES_PER_CHAPTER;
  const elite = index === 5 || index === 8;
  const pool = boss ? [c.boss] : elite ? c.elites : index <= 3 ? c.early : c.late;
  return { n, chapter, index, boss, elite, encounter: pool[(n + 1) % pool.length], label: `${mode === 'penitent' ? 'P' : 'D'}${chapter + 1}-${index}` };
}

/** Recommended Power: Penitent picks up where the Road ends; Damned starts far above. */
export const hardTarget = (mode: HardMode, n: number) => Math.round((mode === 'penitent' ? 30000 + 1500 * (n - 1) : 110000 + 4000 * (n - 1)) * (hardStageDef(mode, n).boss ? 0.9 : 1));

const EMPTY = { owned: {} } as unknown as SaveData;
const scales = new Map<string, number>();
function hardScale(mode: HardMode, n: number) {
  const key = `${mode}${n}`;
  let v = scales.get(key);
  if (v === undefined) {
    const s = hardStageDef(mode, n);
    const crypt = { ...cryptFor(mode, s.chapter), power: 1 };
    const rec = (k: number) => foePower(skirmish(EMPTY, [], s.encounter, 0, undefined, crypt, k)) * CP.recommend;
    v = 1;
    for (let i = 0; i < 3; i++) v *= hardTarget(mode, n) / rec(v);
    scales.set(key, v);
  }
  return v;
}

export function hardBattle(save: SaveData, mode: HardMode, party: string[], n: number, rng?: Rng): Battle {
  const s = hardStageDef(mode, n);
  const crypt = { ...cryptFor(mode, s.chapter), power: 1 };
  return skirmish(save, party, s.encounter, 0, rng, crypt, hardScale(mode, n));
}

/** First clear of a stage. */
export function hardReward(mode: HardMode, n: number): StageReward {
  const s = hardStageDef(mode, n);
  const d = mode === 'damned';
  const base = d ? 900 + 40 * n : 400 + 20 * n;
  if (s.boss) return { tithes: base * 2, seals: d ? 2 : 1, gilt: d ? 60 : 30, items: d ? { canon2: 2 } : { canon1: 4 } };
  return { tithes: base, seals: 0, gilt: s.elite ? (d ? 25 : 10) : 0, items: d ? { canon1: 2, ash3: s.elite ? 1 : 0 } : { canon1: 1, ash2: s.elite ? 2 : 0 } };
}

/** "None fall": the bonus for a stage first won with no Sister down. */
export const vowBonus = (mode: HardMode): StageReward => ({ tithes: 0, seals: 0, gilt: mode === 'damned' ? 20 : 10, items: {} });

/** A chapter's chest on the hard roads; the Damned Road's last pays a ten-pull of Seals. */
export function hardChest(mode: HardMode, chapter: number): StageReward {
  const step = chapter + 1;
  const d = mode === 'damned';
  const last = chapter === CHAPTERS.length - 1;
  return {
    tithes: (d ? 4000 : 2000) * step,
    seals: (d ? 3 : 2) + step + (d && last ? 10 : 0),
    gilt: (d ? 150 : 80) * step,
    stigmata: (d ? 2 : 1) + Math.floor(step / 2),
    items: d ? { canon2: 2 * step, canon3: step >= 3 ? 1 : 0, page3: step } : { canon1: 4 * step, canon2: step >= 3 ? step - 2 : 0, page2: 2 * step },
  };
}

function pay(save: SaveData, r: StageReward) {
  save.tithes += r.tithes;
  save.seals += r.seals;
  earn(save, r.gilt);
  give(save, Object.fromEntries(Object.entries(r.items).filter(([, v]) => v)));
  addStigmata(save, r.stigmata ?? 0);
}

export interface HardResult {
  won: boolean;
  first: boolean;
  reward?: StageReward;
  chest?: StageReward;
  /** True when this win kept the "none fall" vow for the first time. */
  vow?: StageReward;
}

/** Settles a hard-road fight. `fallen` = Sisters down at the end. */
export function finishHardStage(save: SaveData, mode: HardMode, n: number, outcome: 'victory' | 'defeat', fallen: number): HardResult {
  const h = hardOf(save, mode);
  if (outcome !== 'victory' || n > h.best + 1) return { won: outcome === 'victory', first: false };
  const out: HardResult = { won: true, first: n === h.best + 1 };
  if (out.first) {
    h.best = n;
    out.reward = hardReward(mode, n);
    pay(save, out.reward);
    const s = hardStageDef(mode, n);
    if (s.boss) pay(save, (out.chest = hardChest(mode, s.chapter)));
  }
  if (!fallen && !h.unbroken.includes(n)) {
    h.unbroken.push(n);
    pay(save, (out.vow = vowBonus(mode)));
  }
  return out;
}
