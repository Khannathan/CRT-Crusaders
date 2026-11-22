import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { SPARK, bannerPool, chooseLimited, claimSpark, pull, shardsOf, syncBanner } from './gacha';
import { LIMITED_DAYS, SAINTS, limitedUnseen, limitedWindow, markLimitedSeen, upcoming, windowAt } from './limited';

function seeded(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

const NOW = new Date(2026, 10, 22, 12).getTime();
const DAY = 864e5;

describe('limited Saints', () => {
  it('are URs that no Order banner gives', () => {
    expect(SAINTS.length).toBeGreaterThanOrEqual(4);
    for (const c of SAINTS) expect(c.rarity).toBe('UR');
    const save = newSave();
    save.seals = 100_000;
    save.banner = { order: 'Iron Vigil', target: 'CC-W040' };
    const rng = seeded(5);
    for (let i = 0; i < 300; i++) for (const r of pull(save, 'ten', rng)) expect(r.crusader.limited).toBeUndefined();
    expect(bannerPool(save).some((p) => p.c.limited)).toBe(false);
  });

  it('each window lasts LIMITED_DAYS, and every Saint comes round again', () => {
    const w = limitedWindow(NOW);
    expect(w.starts).toBeLessThanOrEqual(NOW);
    expect(w.ends).toBeGreaterThan(NOW);
    expect(Math.round((w.ends - w.starts) / DAY)).toBe(LIMITED_DAYS);
    expect(limitedWindow(w.ends).index).toBe(w.index + 1);
    expect(windowAt(w.index + SAINTS.length).saint.id).toBe(w.saint.id);
    const ids = new Set(upcoming(NOW).map((x) => x.saint.id));
    expect(ids.size).toBe(SAINTS.length - 1);
    expect(ids.has(w.saint.id)).toBe(false);
    for (const x of [w, ...upcoming(NOW)]) {
      expect(x.ssrs).toHaveLength(2);
      expect(x.ssrs[0].order).not.toBe(x.ssrs[1].order);
      for (const c of x.ssrs) expect(c.rarity).toBe('SSR');
    }
  });

  it('the Limited banner gives its Saint, with odds that add up', () => {
    const save = newSave();
    save.seals = 100_000;
    chooseLimited(save, NOW);
    const saint = limitedWindow(NOW).saint;
    const pool = bannerPool(save);
    expect(pool.reduce((a, p) => a + p.chance, 0)).toBeCloseTo(1, 6);
    expect(pool.find((p) => p.c.id === saint.id)!.chance).toBeCloseTo(0.0075, 6);
    expect(pool.filter((p) => p.c.limited)).toHaveLength(1);
    const rng = seeded(3);
    let got = 0;
    for (let i = 0; i < 200; i++) for (const r of pull(save, 'ten', rng)) if (r.crusader.id === saint.id) got++;
    expect(got).toBeGreaterThan(5);
  });

  it("Saint's Favor is kept per Saint and buys her at SPARK", () => {
    const save = newSave();
    save.seals = 100_000;
    chooseLimited(save);
    const saint = CRUSADERS.find((c) => c.id === save.banner!.target)!;
    for (let i = 0; i < SPARK / 10; i++) pull(save, 'ten', seeded(i + 1));
    expect(shardsOf(save, saint.id)).toBe(SPARK);
    expect(shardsOf(save, saint.order)).toBe(0);
    expect(claimSpark(save, saint.id)!.crusader.id).toBe(saint.id);
    expect(shardsOf(save, saint.id)).toBe(0);
  });

  it('a Limited banner from a closed window moves to the new Saint', () => {
    const save = newSave();
    chooseLimited(save, NOW);
    const before = save.banner!.target;
    syncBanner(save, NOW + LIMITED_DAYS * DAY);
    expect(save.banner!.target).not.toBe(before);
    expect(save.banner!.limited).toBe(limitedWindow(NOW).index + 1);
  });

  it('a new Saint lights the Altar until looked at', () => {
    const save = newSave();
    expect(limitedUnseen(save, NOW)).toBe(true);
    markLimitedSeen(save, NOW);
    expect(limitedUnseen(save, NOW)).toBe(false);
    expect(limitedUnseen(save, NOW + LIMITED_DAYS * DAY)).toBe(true);
  });
});
