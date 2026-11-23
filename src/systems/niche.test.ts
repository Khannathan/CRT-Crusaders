import { beforeAll, describe, expect, it } from 'vitest';
import type { Rarity } from '../data/types';
import { HUNTS } from './hunts';
import { nicheTable, partyFor, rankIn, type NicheRow } from './niche';

/**
 * The rarity budget, checked in the niche sim: every Sister fights every
 * Hallowed Hunt in a plain R party, scored against the best SSR of her role.
 * These are guard rails, not exact targets: they fail when a kit change pushes
 * a rarity out of order, makes URs run away, or leaves a Sister with no use.
 */
let rows: NicheRow[];
beforeAll(() => {
  rows = nicheTable({ seeds: 4 });
}, 120_000);

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const avgOf = (r: Rarity) => mean(rows.filter((x) => x.rarity === r).map((x) => x.avg));

describe('niche sim', () => {
  it('a Sister joins the plain party in her own role slot', () => {
    expect(partyFor('CC-W090')[0]).toBe('CC-W090'); // a Tank leads
    expect(partyFor('CC-W199')[3]).toBe('CC-W199'); // a Healer at the back
  });

  it('scores every Sister in every hunt', () => {
    expect(rows.length).toBeGreaterThanOrEqual(80);
    for (const r of rows) expect(Object.keys(r.rel)).toEqual(HUNTS.map((h) => h.id));
    const top = rows.find((r) => r.rarity === 'SSR')!;
    expect(rankIn(rows, top.id, HUNTS[0].id)).toBeGreaterThanOrEqual(1);
  });

  it('rarities are in order: R < SR < SSR < UR', () => {
    expect(avgOf('R')).toBeLessThan(avgOf('SR'));
    expect(avgOf('SR')).toBeLessThan(avgOf('SSR'));
    expect(avgOf('SSR')).toBeLessThan(avgOf('UR'));
  });

  it('URs are stronger, but not by a runaway margin', () => {
    expect(avgOf('UR')).toBeLessThan(avgOf('SSR') * 1.3);
  });

  it('every SSR and UR has a hunt where she is close to the best of her role', () => {
    for (const r of rows) {
      if (r.rarity === 'SSR') expect(r.best, r.name).toBeGreaterThanOrEqual(75);
      if (r.rarity === 'UR') expect(r.best, r.name).toBeGreaterThanOrEqual(90);
    }
  });

  it('no Sister is dead weight', () => {
    for (const r of rows) expect(r.avg, r.name).toBeGreaterThanOrEqual(40);
  });
});
