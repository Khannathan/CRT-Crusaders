import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { autoBattle } from './autoplay';
import { HUNTS, HUNT_ENTRIES, HUNT_ROUNDS, MILESTONES, finishHunt, huntBattle, huntEntriesLeft, huntOn, huntScore, huntsOf, recommendFor, scoreUnit, weakTo } from './hunts';
import { seeded } from './rng';

const T0 = new Date(2026, 10, 22, 12).getTime();
const party = ['SW-R-WAR', 'DL-R-HIE', 'IV-R-EXE', 'SW-SR-CON'];
const saveAt = (level: number) => {
  const save = newSave();
  for (const p of party) save.owned[p] = { level, vow: 0 };
  return save;
};

describe('Purge Hunts', () => {
  it('turns one beast a day through all six', () => {
    const seen = new Set(Array.from({ length: 6 }, (_, i) => huntOn(T0 + i * 86_400_000).id));
    expect(seen.size).toBe(6);
  });

  it('a hunt ends after its rounds and is scored by damage', () => {
    for (const h of HUNTS) {
      const b = huntBattle(saveAt(10), party, h, 0, seeded(4));
      autoBattle(b, 400);
      expect(b.round).toBeLessThanOrEqual(HUNT_ROUNDS);
      const units = huntScore(b, h) / scoreUnit(h);
      console.log(`[hunts] ${h.id} level 10 tier I: ${(units * 100).toFixed(0)}% of the beast, ${b.round} rounds`);
      expect(units).toBeGreaterThan(0.1);
    }
  });

  it('three entries a day; milestones pay once; a kill opens the next tier', () => {
    const save = saveAt(10);
    const h = HUNTS[0];
    const b = huntBattle(save, party, h, 0, seeded(5));
    autoBattle(b, 400);
    const r = finishHunt(save, h, 0, b, T0);
    expect(r.rewards.length).toBeGreaterThan(0);
    const again = finishHunt(save, h, 0, b, T0);
    expect(again.rewards.length).toBe(0);
    expect(huntEntriesLeft(save, T0)).toBe(HUNT_ENTRIES - 2);
    // A felled beast opens tier II.
    const dead = huntBattle(save, party, h, 0, seeded(6));
    dead.units.find((u) => u.ref === h.boss)!.hp = 0;
    expect(finishHunt(save, h, 0, dead, T0).unlocked).toBe(1);
    expect(huntsOf(save, T0 + 86_400_000).entries).toBe(0);
    expect(MILESTONES.every((m, i) => i === 0 || m.at > MILESTONES[i - 1].at)).toBe(true);
  });

  it('the Flayed Saint heals less while she bleeds; the Choirmaster hides behind his singers', () => {
    const saint = HUNTS.find((h) => h.id === 'flayed-saint')!;
    expect(weakTo(saint)).toEqual(['physical']);
    const choir = HUNTS.find((h) => h.id === 'choirmaster')!;
    const b = huntBattle(saveAt(10), party, choir, 0, seeded(1));
    const boss = b.units.find((u) => u.ref === 'choirmaster')!;
    const a = b.units.find((u) => u.side === 'party')!;
    const skill = { id: 'x', name: 'x', desc: '', from: [], target: 'enemy' as const, mult: 1 };
    const guarded = b.preview(a, skill, boss);
    for (const u of b.units) if (u.side === 'enemy' && u !== boss) u.hp = 0;
    expect(b.preview(a, skill, boss)).toBeGreaterThan(guarded);
  });

  it('recommends owned Sisters the beast calls for', () => {
    const save = newSave();
    CRUSADERS.forEach((c) => (save.owned[c.id] = { level: 10, vow: 0 }));
    const recs = recommendFor(save, HUNTS.find((h) => h.id === 'rot-mother')!);
    expect(recs).toHaveLength(4);
    expect(recs.some((r) => r.c.classId === 'confessor')).toBe(true);
  });

  it('the Best overall list draws on every Sister, owned or not, with rare Sisters among them', () => {
    const save = newSave();
    save.owned['SW-R-WAR'] = { level: 1, vow: 0 };
    const hunt = HUNTS[0];
    expect(recommendFor(save, hunt).map((r) => r.c.id)).toEqual(['SW-R-WAR']);
    const best = recommendFor(save, hunt, 4, 'all');
    expect(best).toHaveLength(4);
    expect(best.some((r) => !save.owned[r.c.id])).toBe(true);
    expect(best.some((r) => r.c.rarity === 'UR' || r.c.rarity === 'SSR')).toBe(true);
  });
});
