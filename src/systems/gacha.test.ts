import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { CRUSADERS } from '../data/crusaders';
import { ORDER_LIST } from '../data/orders';
import { MAX_VOW, OVERFLOW_TITHES, PITY_LIMIT, canPull, pull, rollRarity } from './gacha';

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

  it('duplicates add Vows, then pay Tithes once maxed', () => {
    const save = newSave();
    save.seals = 1000;
    const alwaysLow = () => 0; // always the first R crusader
    const first = pull(save, 'one', alwaysLow)[0];
    expect(first.isNew).toBe(true);
    for (let v = 1; v <= MAX_VOW; v++) expect(pull(save, 'one', alwaysLow)[0].vow).toBe(v);
    const tithesBefore = save.tithes;
    const over = pull(save, 'one', alwaysLow)[0];
    expect(over.tithes).toBe(OVERFLOW_TITHES);
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

  it('every Order has two URs to target and five Sisters', () => {
    for (const o of ORDER_LIST) {
      const sisters = CRUSADERS.filter((c) => c.order === o.name);
      expect(sisters).toHaveLength(5);
      expect(sisters.filter((c) => c.rarity === 'UR')).toHaveLength(2);
    }
    expect(CRUSADERS).toHaveLength(50);
    expect(new Set(CRUSADERS.map((c) => c.id)).size).toBe(50);
  });
});
