import type { SaveData } from '../state/save';

/** Personal bests. Each note returns the old best when it was beaten, so the screen can say so. */
export interface Beaten {
  label: string;
  value: number;
  /** The previous best, or undefined for a first record. */
  was?: number;
}

const recs = (save: SaveData) => (save.records ??= {});

/** Call with the best floor from before this climb (the Tower keeps its own best). */
export function noteTower(save: SaveData, floor: number, before: number): Beaten | undefined {
  if (floor <= before) return undefined;
  recs(save).tower = floor;
  return { label: `Bell Tower: floor ${floor}`, value: floor, was: before || undefined };
}

export function noteBrands(save: SaveData, brands: number): Beaten | undefined {
  const r = recs(save);
  if (brands <= (r.brands ?? 0)) return undefined;
  const was = r.brands;
  r.brands = brands;
  return { label: `Inquisition: ${brands} Brands in one Edict`, value: brands, was };
}

/** Fewest battle rounds to clear a crypt at a Heresy tier. */
export function noteClear(save: SaveData, crypt: string, heresy: number, rounds: number, name: string): Beaten | undefined {
  const r = recs(save);
  const key = `${crypt}:${heresy}`;
  const old = r.clears?.[key];
  if (old !== undefined && rounds >= old) return undefined;
  (r.clears ??= {})[key] = rounds;
  return { label: `Fastest clear of ${name}${heresy ? ` (Heresy ${heresy})` : ''}: ${rounds} rounds`, value: rounds, was: old };
}

export const beatenText = (b: Beaten) => (b.was === undefined ? `First record: ${b.label}` : `${b.label} (was ${b.was})`);
