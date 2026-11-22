import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { CRUSADERS } from '../data/crusaders';
import { ORDER_LIST } from '../data/orders';
import { OVERFLOW_TITHES, PITY_LIMIT, SPARK, UR_HARD, UR_SOFT, canPull, claimSpark, pull, rollRarity, shardsOf, urChance } from './gacha';
import { copiesLeft } from './tiers';

/** Deterministic RNG (mulberry32). */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('gacha', () => {
  it('rolls rarities near the published rates', () => {
    const rng = seeded(1);
    const n = 200_000;
    const counts = { R: 0, SR: 0, SSR: 0, UR: 0 };
    for (let i = 0; i < n; i++) counts[rollRarity(rng)]++;
    expect(counts.R / n).toBeCloseTo(0.6, 2);
    expect(counts.SR / n).toBeCloseTo(0.3, 2);
    expect(counts.SSR / n).toBeCloseTo(0.085, 2);
    expect(counts.UR / n).toBeCloseTo(0.015, 2);
  });

  it('first 10-pull is free, later ones cost 10 Seals', () => {
    const save = newSave();
    save.seals = 10;
    expect(pull(save, 'ten', seeded(2))).toHaveLength(10);
    expect(save.seals).toBe(10);
    expect(pull(save, 'ten', seeded(3))).toHaveLength(10);
    expect(save.seals).toBe(0);
    expect(canPull(save, 'ten')).toBe(false);
    expect(pull(save, 'ten', seeded(4))).toHaveLength(0);
  });

  it('every 10-pull has at least one SR or better', () => {
    const rng = seeded(5);
    for (let k = 0; k < 2000; k++) {
      const save = newSave();
      const res = pull(save, 'ten', rng);
      expect(res.some((r) => r.crusader.rarity !== 'R')).toBe(true);
    }
  });

  it('never goes PITY_LIMIT pulls without an SSR or UR', () => {
    const save = newSave();
    save.seals = 100_000;
    // An RNG that always lands on R would never give SSR without pity.
    const alwaysLow = () => 0;
    let sinceHigh = 0;
    for (let i = 0; i < 500; i++) {
      const [r] = pull(save, 'one', alwaysLow);
      sinceHigh = r.crusader.rarity === 'SSR' || r.crusader.rarity === 'UR' ? 0 : sinceHigh + 1;
      expect(sinceHigh).toBeLessThan(PITY_LIMIT);
    }
  });

  it('duplicates become Vow tokens until every Vow of every tier is covered, then Stigmata', () => {
    const save = newSave();
    save.seals = 1000;
    const alwaysLow = () => 0; // always the first R crusader
    const first = pull(save, 'one', alwaysLow)[0];
    expect(first.isNew).toBe(true);
    const id = first.crusader.id;
    // every copy her tiers will ever need
    save.owned[id].tokens = copiesLeft(save.owned[id]) - 1;
    expect(pull(save, 'one', alwaysLow)[0].tokens).toBe(copiesLeft(save.owned[id]));
    expect(save.owned[id].vow).toBe(0);
    const tithesBefore = save.tithes;
    const over = pull(save, 'one', alwaysLow)[0];
    expect(over.tithes).toBe(OVERFLOW_TITHES);
    expect(over.stigmata).toBe(1);
    expect(save.stigmata).toBe(1);
    expect(save.tithes).toBe(tithesBefore + OVERFLOW_TITHES);
  });
});

describe('Order banners', () => {
  it('a banner UR is the target half the time, and always after a miss', () => {
    const save = newSave();
    save.seals = 1e6;
    save.freeTenUsed = true;
    save.banner = { order: 'Hollow Bell', target: 'CC-W019' };
    const rng = seeded(9);
    let urs = 0;
    let hits = 0;
    let lastMissed = false;
    for (let i = 0; i < 4000; i++) {
      for (const r of pull(save, 'ten', rng)) {
        if (r.crusader.rarity !== 'UR') continue;
        urs++;
        const hit = r.crusader.id === 'CC-W019';
        if (lastMissed) expect(hit).toBe(true);
        if (hit) hits++;
        lastMissed = !hit;
      }
    }
    expect(urs).toBeGreaterThan(300);
    // 50/50 with a guarantee after a loss: about two thirds of URs are the target
    expect(hits / urs).toBeGreaterThan(0.6);
    expect(hits / urs).toBeLessThan(0.73);
  });

  it('every Order has one UR to target, two SSRs, an SR and an R', () => {
    for (const o of ORDER_LIST) {
      const sisters = CRUSADERS.filter((c) => c.order === o.name && !c.limited);
      expect(sisters).toHaveLength(5);
      expect(sisters.map((c) => c.rarity).sort()).toEqual(['R', 'SR', 'SSR', 'SSR', 'UR']);
    }
    expect(CRUSADERS.filter((c) => !c.limited)).toHaveLength(50);
    expect(new Set(CRUSADERS.map((c) => c.id)).size).toBe(CRUSADERS.length);
  });

  it('a UR always comes by pull UR_HARD, and pity is shared across banners', () => {
    const save = newSave();
    save.seals = 100_000;
    const noUR = () => 0.99; // never rolls a UR on its own
    let since = 0;
    for (let i = 0; i < 400; i++) {
      // switch Orders every pull: pity carries over
      const ord = ORDER_LIST[i % ORDER_LIST.length];
      save.banner = { order: ord.name, target: CRUSADERS.find((c) => c.order === ord.name && c.rarity === 'UR')!.id };
      const [r] = pull(save, 'one', noUR);
      since = r.crusader.rarity === 'UR' ? 0 : since + 1;
      expect(since).toBeLessThan(UR_HARD);
    }
  });

  it('soft pity raises the UR chance after UR_SOFT pulls', () => {
    expect(urChance(UR_SOFT)).toBeCloseTo(0.015);
    expect(urChance(UR_SOFT + 5)).toBeGreaterThan(0.3);
    expect(urChance(UR_HARD)).toBe(1);
    // Over many runs the average UR lands well before the hard limit.
    const rng = seeded(11);
    let total = 0;
    const runs = 400;
    for (let k = 0; k < runs; k++) {
      const save = newSave();
      save.seals = 10_000;
      let n = 0;
      for (;;) {
        n++;
        if (pull(save, 'one', rng)[0].crusader.rarity === 'UR') break;
      }
      total += n;
    }
    expect(total / runs).toBeLessThan(UR_SOFT);
  });

  it('Relic Shards build per Order and buy one of its URs at SPARK', () => {
    const save = newSave();
    save.seals = 100_000;
    const ord = ORDER_LIST[2];
    const ur = CRUSADERS.find((c) => c.order === ord.name && c.rarity === 'UR')!;
    const other = CRUSADERS.find((c) => c.order !== ord.name && c.rarity === 'UR')!;
    save.banner = { order: ord.name, target: ur.id };
    for (let i = 0; i < SPARK / 10 - 1; i++) pull(save, 'ten', seeded(i));
    expect(shardsOf(save, ord.name)).toBe(SPARK - 10);
    expect(claimSpark(save, ur.id)).toBeUndefined();
    pull(save, 'ten', seeded(99));
    expect(claimSpark(save, other.id)).toBeUndefined();
    const got = claimSpark(save, ur.id)!;
    expect(got.crusader.id).toBe(ur.id);
    expect(save.owned[ur.id]).toBeDefined();
    expect(shardsOf(save, ord.name)).toBe(0);
  });
});

describe('bannerPool', () => {
  it('lists every Sister once and the chances add up to 100%', async () => {
    const { bannerPool } = await import('./gacha');
    const { CRUSADERS } = await import('../data/crusaders');
    const { newSave } = await import('../state/save');
    const s = newSave();
    s.banner = { order: 'Iron Vigil', target: 'CC-W040' };
    const pool = bannerPool(s);
    expect(pool.length).toBe(CRUSADERS.filter((c) => !c.limited).length);
    expect(pool.reduce((a, p) => a + p.chance, 0)).toBeCloseTo(1, 6);
    expect(pool.find((p) => p.c.id === 'CC-W040')!.chance).toBeCloseTo(0.0075, 6);
  });
});
