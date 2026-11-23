import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { pullArmory } from './armory';
import { pull } from './gacha';
import { gearOf } from './gear';
import { houndsOf, whistleMany } from './hounds';
import { countOf, give } from './items';

/**
 * Every pull is granted the moment it is paid for, before any reveal opens. The reveal
 * screens are only for show: a freeze, a skip or a closed app must never lose a pull.
 */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('pulls are granted before the reveal', () => {
  it('a Sister x10 puts all ten in the save at once', () => {
    const save = newSave();
    save.seals = 100;
    const got = pull(save, 'ten', seeded(7));
    expect(got).toHaveLength(10);
    for (const r of got) expect(save.owned[r.crusader.id]).toBeDefined();
    // Copies of one Sister: the save holds her once plus a Vow token (or Tithes) per extra copy.
    const copies = new Map<string, number>();
    for (const r of got) copies.set(r.crusader.id, (copies.get(r.crusader.id) ?? 0) + 1);
    for (const [id, n] of copies) {
      const last = got.filter((r) => r.crusader.id === id).at(-1)!;
      if (n > 1) expect(last.tokens + (last.tithes ? 1 : 0)).toBeGreaterThan(0);
      expect(save.owned[id]).toBeDefined();
    }
  });

  it('a Sister x1 is granted and paid for', () => {
    const save = newSave();
    save.seals = 5;
    const [r] = pull(save, 'one', seeded(3));
    expect(save.owned[r.crusader.id]).toBeDefined();
    expect(save.seals).toBe(4);
  });

  it('a Gear x10 puts ten pieces and ten Fragments in the save', () => {
    const save = newSave();
    give(save, { armory2: 10 });
    const before = gearOf(save).length;
    const got = pullArmory(save, 10, 'writ', seeded(5));
    expect(got).toHaveLength(10);
    expect(gearOf(save).length).toBe(before + 10);
    expect(countOf(save, 'armory1')).toBe(10);
    expect(countOf(save, 'armory2')).toBe(0);
  });

  it('a Hound x10 call levels or adds every hound it rolls', () => {
    const save = newSave();
    give(save, { kennel2: 10 });
    const before = Object.values(houndsOf(save).owned).reduce((n, h) => n + h.level, 0);
    const got = whistleMany(save, 10, seeded(9));
    expect(got).toHaveLength(10);
    expect(countOf(save, 'kennel2')).toBe(0);
    for (const r of got) expect(houndsOf(save).owned[r.hound.id]).toBeDefined();
    // Each call either adds a hound, raises one a level, or pays Alms at the last level.
    const after = Object.values(houndsOf(save).owned).reduce((n, h) => n + h.level, 0);
    const alms = got.filter((r) => r.alms).length;
    expect(after - before + alms).toBe(10);
  });
});
