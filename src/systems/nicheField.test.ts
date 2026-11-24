import { beforeAll, describe, expect, it } from 'vitest';
import type { Rarity } from '../data/types';
import { KITS } from '../data/kits';
import { HUNTS } from './hunts';
import { SHINE_LABEL, nicheTableAsync, rankIn, type NicheRow } from './niche';

/**
 * The rarity budget on the open field: every hunt played in real time
 * (systems/field.ts), as every fight in the game is. The "Shines in" hunts on
 * each Sister's page are checked here; the turn-based guards in niche.test.ts
 * stay as a second opinion on the kits themselves.
 */
let rows: NicheRow[];
beforeAll(async () => {
  rows = await nicheTableAsync({ seeds: 4, engine: 'field' });
}, 300_000); // every hunt for every Sister on the real-time clock: slow on CI runners

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const avgOf = (r: Rarity) => mean(rows.filter((x) => x.rarity === r).map((x) => x.avg));

describe('niche sim on the field', () => {
  it('rarities stay in order: R < SR < SSR < UR', () => {
    expect(avgOf('R')).toBeLessThan(avgOf('SR'));
    expect(avgOf('SR')).toBeLessThan(avgOf('SSR'));
    expect(avgOf('SSR')).toBeLessThan(avgOf('UR'));
  });

  it('URs are well ahead of SSRs on the field too, but not by a runaway margin', () => {
    expect(avgOf('UR')).toBeGreaterThan(avgOf('SSR') * 1.1);
    expect(avgOf('UR')).toBeLessThan(avgOf('SSR') * 1.5);
  });

  it('no Sister is useless on the field', () => {
    for (const r of rows) expect(r.avg, r.name).toBeGreaterThanOrEqual(25);
  });

  it('every hunt a Sister claims to shine in is one where she is in the top third of her role', () => {
    expect(Object.keys(SHINE_LABEL).sort()).toEqual(HUNTS.map((h) => h.id).sort());
    let claims = 0;
    // Claims are read against the hand-made kits of her role: the kits built
    // from Order skills (data/kitGen.ts) are stand-ins until each one's art arrives.
    const made = rows.filter((x) => !KITS[x.id]?.generated);
    for (const r of made) {
      const n = made.filter((x) => x.role === r.role).length;
      for (const s of KITS[r.id]?.shines ?? []) {
        if (!/Hunt\b/.test(s) || /Hunt (damage|bosses)|Hunts$/.test(s) || s === 'Finishing Hunt bosses') continue;
        const hunt = Object.keys(SHINE_LABEL).find((h) => SHINE_LABEL[h] === s);
        expect(hunt, `${r.name}: "${s}" names no hunt`).toBeDefined();
        expect(rankIn(made, r.id, hunt!), `${r.name} in ${s}`).toBeLessThanOrEqual(Math.ceil(n / 3));
        claims++;
      }
    }
    expect(claims).toBeGreaterThan(30);
  });
});
