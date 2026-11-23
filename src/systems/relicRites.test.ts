import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { MAX_CANON } from './canon';
import { stageBattle } from './campaign';
import { simulateField } from './field';
import { partyPower, recommendedPower } from './power';
import { RITE_ENTRIES, RITE_LEVELS, SANCT_STEPS, finishRite, hasRite, motesOf, riteBattle, riteBlock, riteEntriesLeft, riteOpen, riteTarget, sanctBlock, sanctify, sanctOf, sweepRite } from './relicRites';
import { seeded } from './rng';

const SSRS = CRUSADERS.filter((c) => c.rarity === 'SSR').slice(0, 4).map((c) => c.id);
const ID = SSRS[0];
const saveWith = (level = 50) => {
  const save = newSave();
  for (const id of SSRS) save.owned[id] = { level, vow: 0, asc: 3 };
  return save;
};

describe('Relic Rites', () => {
  it('only SSR and UR Sisters at level 50 have one', () => {
    const save = saveWith(49);
    expect(riteOpen(save, ID)).toBe(false);
    save.owned[ID].level = 50;
    expect(riteOpen(save, ID)).toBe(true);
    expect(CRUSADERS.filter(hasRite).every((c) => c.rarity === 'SSR' || c.rarity === 'UR')).toBe(true);
  });

  it('levels open in order; two wins a day; a loss costs nothing; sweeps need a clear', () => {
    const save = saveWith();
    const now = new Date(2026, 10, 23, 12).getTime();
    expect(riteBlock(save, ID, 2, now)).toMatch(/before/);
    expect(finishRite(save, ID, 1, false, now)).toBeUndefined();
    expect(riteEntriesLeft(save, now)).toBe(RITE_ENTRIES);
    expect(sweepRite(save, ID, 1, now)).toBeUndefined();
    expect(finishRite(save, ID, 1, true, now)?.motes).toBe(3);
    expect(sweepRite(save, ID, 1, now)?.motes).toBe(3);
    expect(motesOf(save, ID)).toBe(6);
    expect(riteEntriesLeft(save, now)).toBe(0);
    expect(riteBlock(save, ID, 2, now)).toMatch(/today/);
    // A new day.
    expect(riteEntriesLeft(save, now + 86_400_000)).toBe(RITE_ENTRIES);
  });

  it('Rites climb in strength, and level 1 asks about the end of the Road', () => {
    const save = saveWith();
    let prev = 0;
    for (let l = 1; l <= RITE_LEVELS; l++) {
      const rec = recommendedPower(riteBattle(save, SSRS, l));
      expect(rec).toBeGreaterThan(prev);
      expect(Math.abs(rec - riteTarget(l)) / riteTarget(l)).toBeLessThan(0.05);
      prev = rec;
    }
    expect(riteTarget(1)).toBeGreaterThan(recommendedPower(stageBattle(save, SSRS, 50)));
  });

  it('a level 50 SSR party can win the first Rites', () => {
    const save = saveWith();
    let wins = 0;
    for (let i = 0; i < 12; i++) if (simulateField(riteBattle(save, SSRS, 1, seeded(40 + i)), { rng: seeded(90 + i) }, 300).outcome === 'victory') wins++;
    console.log(`[rites] level 1 with four lv50 SSRs (Power ${partyPower(save, SSRS)} vs ${riteTarget(1)}): ${wins}/12`);
    expect(wins).toBeGreaterThan(3);
  });

  it('Motes sanctify her Litany at Canon V, X and XV, and it reaches battle', () => {
    const save = saveWith();
    const r = (save.relicRites = { day: '', used: 0, best: {}, motes: { [ID]: 500 }, sanct: {} });
    expect(sanctBlock(save, ID)).toMatch(/Canon/);
    const before = riteBattle(save, SSRS, 1).units.find((u) => u.ref === ID)!;
    save.owned[ID].canon = { rank: MAX_CANON, traits: [] };
    for (let s = 0; s < 3; s++) expect(sanctify(save, ID)).toBe(true);
    expect(sanctify(save, ID)).toBe(false);
    expect(sanctOf(save, ID)).toBe(3);
    expect(r.motes[ID]).toBe(500 - SANCT_STEPS.reduce((n, s) => n + s.motes, 0));
    const after = riteBattle(save, SSRS, 1).units.find((u) => u.ref === ID)!;
    expect((after.symbol?.rite ?? 0) - (before.symbol?.rite ?? 0)).toBeCloseTo(0.4, 5);
    expect((after.zeal ?? 0) - (before.zeal ?? 0)).toBe(25);
  });
});
