import type { SaveData } from '../state/save';
import { canonOf } from './canon';

/** Relic Motes held, per Sister (from Relic Rites). */
const motes = (save: SaveData, id: string) => save.relicRites?.motes[id] ?? 0;
export const sanctOf = (save: SaveData, id: string) => save.relicRites?.sanct[id] ?? 0;

// ---------- Sanctified Litany ----------

export const SANCT_MAX = 3;
/** Canon rank and Motes for each step. */
export const SANCT_STEPS = [
  { canon: 5, motes: 20 },
  { canon: 10, motes: 40 },
  { canon: 15, motes: 80 },
];
/** Litany power per step, and opening Zeal at the last. */
export const SANCT_LITANY = [0, 0.12, 0.25, 0.4];
export const SANCT_ZEAL = 25;

export function sanctBlock(save: SaveData, id: string): string | undefined {
  const s = sanctOf(save, id);
  if (s >= SANCT_MAX) return 'Wholly sanctified';
  const step = SANCT_STEPS[s];
  if (canonOf(save.owned[id]) < step.canon) return `Reach Canon rank ${step.canon} first`;
  if (motes(save, id) < step.motes) return 'Not enough Relic Motes';
  return undefined;
}

export function sanctify(save: SaveData, id: string): boolean {
  if (sanctBlock(save, id)) return false;
  const r = save.relicRites!;
  const s = sanctOf(save, id);
  r.motes[id] -= SANCT_STEPS[s].motes;
  r.sanct[id] = s + 1;
  return true;
}

/** What her Sanctified Litany adds in battle. */
export const sanctEffect = (save: SaveData, id: string) => {
  const s = sanctOf(save, id);
  return { litanyPct: SANCT_LITANY[s], zeal: s >= SANCT_MAX ? SANCT_ZEAL : 0 };
};
