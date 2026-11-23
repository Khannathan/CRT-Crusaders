import { beforeAll, describe, expect, it } from 'vitest';
import type { Rarity } from '../data/types';
import { nicheTable, type NicheRow } from './niche';

/**
 * The rarity budget on the open field: every hunt played in real time
 * (systems/field.ts). Looser than the turn-based guards in niche.test.ts until
 * the balance re-tune moves the "Shines in" sim onto the field as well.
 */
let rows: NicheRow[];
beforeAll(() => {
  rows = nicheTable({ seeds: 4, engine: 'field' });
}, 180_000);

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const avgOf = (r: Rarity) => mean(rows.filter((x) => x.rarity === r).map((x) => x.avg));

describe('niche sim on the field', () => {
  it('rarities stay in order: R < SR < SSR < UR', () => {
    expect(avgOf('R')).toBeLessThan(avgOf('SR'));
    expect(avgOf('SR')).toBeLessThan(avgOf('SSR'));
    expect(avgOf('SSR')).toBeLessThan(avgOf('UR'));
  });

  it('URs are stronger, but not by a runaway margin', () => {
    expect(avgOf('UR')).toBeLessThan(avgOf('SSR') * 1.3);
  });

  it('no Sister is useless on the field', () => {
    for (const r of rows) expect(r.avg, r.name).toBeGreaterThanOrEqual(25);
  });
});
