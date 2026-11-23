import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { foundChapter } from './chapter';
import { FORTS, STAR_POINTS, WAR_ATTACKS, WAR_WIN, aiPoints, attacksLeft, finishStorm, fortGarrison, fortTarget, starsFor, warBattle, warOf, warScore } from './chapterWar';
import { seeded } from './rng';

const NOW = new Date(2026, 10, 23, 12).getTime(); // a Monday
const DAY = 864e5;
const IDS = CRUSADERS.slice(0, 4).map((c) => c.id);

function save() {
  const s = newSave();
  for (const id of IDS) s.owned[id] = { level: 40, vow: 0 };
  foundChapter(s, NOW, 7);
  return s;
}

describe('Chapter War', () => {
  it('six forts, harder toward the Stronghold, whose garrison is a boss', () => {
    const s = save();
    const t = FORTS.map((_, i) => fortTarget(s, i, NOW));
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
    const last = fortGarrison(s, FORTS.length - 1, NOW);
    expect(last.encounter).toBe(last.crypt.boss);
    expect(warBattle(s, IDS, 0, seeded(1), NOW).units.some((u) => u.side === 'enemy')).toBe(true);
  });

  it('stars: best kept per fort, only new stars pay, two storms a day', () => {
    const s = save();
    const t = s.tithes;
    expect(finishStorm(s, 0, 2, NOW).gained).toBe(2);
    expect(finishStorm(s, 0, 1, NOW).gained).toBe(0);
    expect(attacksLeft(s, NOW)).toBe(0);
    expect(finishStorm(s, 1, 3, NOW).gained).toBe(0);
    expect(warOf(s, NOW)!.stars[0]).toBe(2);
    expect(s.tithes).toBeGreaterThan(t);
    expect(attacksLeft(s, NOW + DAY)).toBe(WAR_ATTACKS);
    const b = warBattle(s, IDS, 0, seeded(1), NOW);
    expect(starsFor('victory', b)).toBe(3);
    b.units.find((u) => u.side === 'party')!.hp = 0;
    expect(starsFor('victory', b)).toBe(2);
    expect(starsFor('defeat', b)).toBe(0);
  });

  it('the AI alone loses the war; your stars can turn it, and the week pays', () => {
    const s = save();
    const w = warOf(s, NOW)!;
    const ai = aiPoints(s, w.week, 7);
    expect(ai.them).toBeGreaterThan(ai.us);
    expect(aiPoints(s, w.week, 7)).toEqual(ai); // rolled once, the same every time
    expect(ai.us + FORTS.length * 3 * STAR_POINTS).toBeGreaterThan(ai.them);
    w.stars = FORTS.map(() => 3);
    expect(warScore(s, NOW).us).toBe(aiPoints(s, w.week, 1).us + FORTS.length * 3 * STAR_POINTS);
    const seals = s.seals;
    const next = warOf(s, NOW + 7 * DAY)!;
    expect(next.last!.won).toBe(true);
    expect(s.seals).toBeGreaterThanOrEqual(seals + WAR_WIN.seals!);
    expect(next.stars).toEqual(FORTS.map(() => 0));
  });
});
