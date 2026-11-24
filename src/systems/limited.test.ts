import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { SPARK, bannerPool, chooseLimited, claimSpark, pull, settleFavor, shardsOf, syncBanner } from './gacha';
import { GRADUATE_AFTER, LIMITED_BANNERS, LIMITED_DAYS, SAINTS, graduationDate, isStandard, limitedUnseen, limitedWindow, markLimitedSeen, upcoming, windowAt } from './limited';

const limitedWindowStart = (slot: number) => windowAt(slot).starts;

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
  it('are URs that no standard banner gives', () => {
    expect(SAINTS.length).toBeGreaterThanOrEqual(4);
    for (const c of SAINTS) expect(c.rarity).toBe('UR');
    const save = newSave();
    save.seals = 100_000;
    save.banner = { order: 'Iron Vigil', target: 'IV-UR1' };
    const rng = seeded(5);
    for (let i = 0; i < 300; i++) for (const r of pull(save, 'ten', rng)) expect(r.crusader.limited).toBeUndefined();
    expect(bannerPool(save).some((p) => p.c.limited)).toBe(false);
  });

  it('each window lasts LIMITED_DAYS and runs the next banner in the lineup', () => {
    const w = limitedWindow(NOW);
    expect(w.starts).toBeLessThanOrEqual(NOW);
    expect(w.ends).toBeGreaterThan(NOW);
    expect(Math.round((w.ends - w.starts) / DAY)).toBe(LIMITED_DAYS);
    expect(limitedWindow(w.ends).index).toBe(w.index + 1);
    expect(limitedWindow(w.ends).slot).toBe(w.slot + 1);
    const ids = new Set(upcoming(NOW).map((x) => x.saint.id));
    expect(ids.size).toBe(LIMITED_BANNERS.length - 1 - w.slot);
    expect(ids.has(w.saint.id)).toBe(false);
    for (const b of LIMITED_BANNERS) {
      expect(b.saint.rarity).toBe('UR');
      expect(b.ssrs).toHaveLength(2);
      // both Limited Commanders are sworn to her, from her own Order
      expect(b.ssrs[0].order).toBe(b.saint.order);
      expect(b.ssrs[1].order).toBe(b.saint.order);
      for (const c of [b.saint, ...b.ssrs]) expect(c.limited).toBe(true);
      for (const c of b.ssrs) expect(c.rarity).toBe('SSR');
    }
    // every limited Sister is on exactly one banner
    const all = LIMITED_BANNERS.flatMap((b) => [b.saint, ...b.ssrs].map((c) => c.id));
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(CRUSADERS.filter((c) => c.limited).length);
  });

  it('when the lineup runs out, its last banner stays up', () => {
    const last = LIMITED_BANNERS.at(-1)!;
    expect(windowAt(LIMITED_BANNERS.length + 4).saint.id).toBe(last.saint.id);
  });

  it('the Limited banner gives its Saint and its two SSRs, with odds that add up', () => {
    const save = newSave();
    save.seals = 100_000;
    chooseLimited(save, NOW);
    const w = limitedWindow(NOW);
    const pool = bannerPool(save);
    expect(pool.reduce((a, p) => a + p.chance, 0)).toBeCloseTo(1, 6);
    expect(pool.find((p) => p.c.id === w.saint.id)!.chance).toBeCloseTo(0.0075, 6);
    expect(pool.filter((p) => p.c.limited).map((p) => p.c.id).sort()).toEqual([w.saint.id, ...w.ssrs.map((c) => c.id)].sort());
    for (const c of w.ssrs) expect(pool.find((p) => p.c.id === c.id)!.chance).toBeCloseTo(0.085 / 4, 6);
    const rng = seeded(3);
    let got = 0;
    let ssr = 0;
    for (let i = 0; i < 200; i++)
      for (const r of pull(save, 'ten', rng)) {
        if (r.crusader.id === w.saint.id) got++;
        if (w.ssrs.includes(r.crusader)) ssr++;
        // no other limited Sister ever comes
        if (r.crusader.limited) expect([w.saint, ...w.ssrs]).toContain(r.crusader);
      }
    expect(got).toBeGreaterThan(5);
    expect(ssr).toBeGreaterThan(40);
  });

  it('a banner\'s Sisters join the standard pool once three more Limited banners have passed', () => {
    const first = LIMITED_BANNERS[0];
    const third = LIMITED_BANNERS[GRADUATE_AFTER];
    const opens = limitedWindowStart;
    // while the third banner after hers is still up, she is limited
    expect(isStandard(first.saint, opens(GRADUATE_AFTER) + DAY)).toBe(false);
    expect(third.saint.id).toBeDefined();
    // when the next one opens, she and her SSRs are standard
    const later = opens(GRADUATE_AFTER + 1) + DAY;
    for (const c of [first.saint, ...first.ssrs]) expect(isStandard(c, later)).toBe(true);
    expect(graduationDate(first.saint.id)).toBe(opens(GRADUATE_AFTER + 1));
    // the standard banner can now give and target them
    const save = newSave();
    save.banner = { order: first.saint.order, target: first.saint.id };
    syncBanner(save, later);
    expect(save.banner!.target).toBe(first.saint.id);
    // a banner whose third successor is not in the lineup yet never graduates
    expect(graduationDate(LIMITED_BANNERS.at(-1)!.saint.id)).toBeUndefined();
    expect(isStandard(LIMITED_BANNERS.at(-1)!.saint, later + 1000 * DAY)).toBe(false);
  });

  it("a graduated Saint's Favor becomes her Order's Relic Shards", () => {
    const first = LIMITED_BANNERS[0].saint;
    const save = newSave();
    save.shards = { [first.id]: 90, [first.order]: 10 };
    settleFavor(save, limitedWindowStart(GRADUATE_AFTER + 1) + DAY);
    expect(shardsOf(save, first.order)).toBe(100);
    expect(save.shards[first.id]).toBeUndefined();
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
