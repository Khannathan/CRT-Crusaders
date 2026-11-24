import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { ERRAND_SLOTS, boardFor, busySisters, claimErrand, errandsOf, fitsBonus, openErrands, recallErrand, sendBlock, sendErrand } from './errands';
import { countOf } from './items';

const T0 = new Date(2026, 10, 22, 9).getTime();
const H = 3600_000;

function saveWithAll() {
  const s = newSave();
  for (const c of CRUSADERS) s.owned[c.id] = { level: 10, vow: 0 };
  return s;
}

describe('Sworn Errands', () => {
  it('offers the same six errands all day, one 1h, one 20h', () => {
    const a = boardFor('2026-11-22');
    expect(a).toEqual(boardFor('2026-11-22'));
    expect(a.map((e) => e.hours).sort((x, y) => x - y)).toEqual([1, 4, 4, 8, 8, 20]);
    expect(a.find((e) => e.hours === 20)!.minRarity).toBe('SSR');
  });

  it('sends, marks Sisters busy, pays on return and leaves the board', () => {
    const save = saveWithAll();
    const e = openErrands(save, T0).find((x) => x.hours === 4)!;
    const team = CRUSADERS.filter((c) => !fitsBonus(e, c.id)).slice(0, 2).map((c) => c.id);
    expect(sendErrand(save, e, team, T0)).toBe(true);
    expect(busySisters(save).has(team[0])).toBe(true);
    expect(openErrands(save, T0).some((x) => x.id === e.id)).toBe(false);
    expect(claimErrand(save, 0, T0 + 3 * H)).toBeUndefined();
    const before = save.tithes;
    const r = claimErrand(save, 0, T0 + 4 * H)!;
    expect(save.tithes - before).toBe(r.tithes);
    expect(countOf(save, `${e.family}1`)).toBeGreaterThan(0);
    expect(errandsOf(save, T0 + 4 * H).active.length).toBe(0);
  });

  it('pays +50% with the bonus Sister, and enforces size, rarity and slots', () => {
    const save = saveWithAll();
    const long = openErrands(save, T0).find((x) => x.hours === 20)!;
    const rs = CRUSADERS.filter((c) => c.rarity === 'R').slice(0, 3).map((c) => c.id);
    expect(sendBlock(save, long, rs, T0)).toMatch(/SSR/);
    expect(sendBlock(save, long, rs.slice(0, 2), T0)).toMatch(/3 Sisters/);
    const one = openErrands(save, T0).find((x) => x.hours === 1)!;
    const fan = CRUSADERS.find((c) => fitsBonus(one, c.id))!;
    sendErrand(save, one, [fan.id], T0);
    expect(errandsOf(save, T0).active[0].boosted).toBe(true);
    const r = claimErrand(save, 0, T0 + H)!;
    expect(r.tithes).toBe(Math.ceil(one.reward.tithes! * 1.5));
    // slots
    const pool = CRUSADERS.map((c) => c.id);
    let k = 0;
    for (const e of openErrands(save, T0).slice(0, ERRAND_SLOTS)) {
      const ids = CRUSADERS.filter((c) => c.rarity === 'UR').slice(k, k + e.size).map((c) => c.id);
      k += e.size;
      expect(sendErrand(save, e, ids, T0)).toBe(true);
    }
    const extra = openErrands(save, T0)[0];
    expect(sendBlock(save, extra, pool.slice(-extra.size), T0)).toMatch(/at once/);
    recallErrand(save, 0, T0);
    expect(errandsOf(save, T0).active.length).toBe(ERRAND_SLOTS - 1);
  });

  it('a new day brings a fresh board but keeps errands still away', () => {
    const save = saveWithAll();
    const e = openErrands(save, T0).find((x) => x.hours === 20)!;
    const ids = CRUSADERS.filter((c) => c.rarity === 'SSR').slice(0, 3).map((c) => c.id);
    expect(sendErrand(save, e, ids, T0)).toBe(true);
    const next = T0 + 24 * H;
    expect(openErrands(save, next).length).toBe(6);
    expect(errandsOf(save, next).active.length).toBe(1);
  });
});
