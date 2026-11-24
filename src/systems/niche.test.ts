import { beforeAll, describe, expect, it } from 'vitest';
import type { Rarity } from '../data/types';
import { HUNTS } from './hunts';
import { KITS } from '../data/kits';
import { nicheTableAsync, partyFor, rankIn, type NicheRow } from './niche';

/**
 * The rarity budget, checked in the niche sim: every Sister fights every
 * Hallowed Hunt in a plain R party, scored against the best SSR of her role.
 * These are guard rails, not exact targets: they fail when a kit change pushes
 * a rarity out of order, makes URs run away, or leaves a Sister with no use.
 */
let rows: NicheRow[];
beforeAll(async () => {
  rows = await nicheTableAsync({ seeds: 4 });
}, 120_000);

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const avgOf = (r: Rarity) => mean(rows.filter((x) => x.rarity === r).map((x) => x.avg));

describe('niche sim', () => {
  it('a Sister joins the plain party in her own role slot', () => {
    expect(partyFor('TC-UR1')[0]).toBe('TC-UR1'); // a Tank leads
    expect(partyFor('SW-LUR')[3]).toBe('SW-LUR'); // a Healer at the back
  });

  it('scores every Sister in every hunt', () => {
    expect(rows.length).toBe(500);
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
    // Hand-made kits are held to the full budget; kits built from Order skills
    // (data/kitGen.ts, until a Sister's art arrives) to a looser one.
    for (const r of rows) {
      const made = !KITS[r.id]?.generated;
      if (r.rarity === 'SSR') expect(r.best, r.name).toBeGreaterThanOrEqual(made ? 75 : 50);
      if (r.rarity === 'UR') expect(r.best, r.name).toBeGreaterThanOrEqual(made ? 90 : 65);
    }
  });

  it('no Sister is dead weight', () => {
    for (const r of rows) expect(r.avg, r.name).toBeGreaterThanOrEqual(40);
  });

});
