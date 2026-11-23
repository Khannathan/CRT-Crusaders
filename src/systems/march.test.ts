import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { TOTAL_STAGES, campaignOf } from './campaign';
import { MARCH_TRIES, advanceMarch, clearMarchSummary, marchOf, marchSummary, setMarch, stopText } from './march';
import { seeded } from './rng';
import { ensureVigil } from './vigil';

const H = 3.6e6;
const ids = CRUSADERS.filter((c) => c.rarity === 'R').slice(0, 4).map((c) => c.id);

function saveWith(level: number) {
  const save = newSave();
  for (const id of ids) save.owned[id] = { level, vow: 0 };
  save.lastParty = ids;
  ensureVigil(save, 0);
  return save;
}

describe('the March (the Vigil pushing the road in the background)', () => {
  it('does nothing while off', () => {
    const save = saveWith(5);
    expect(advanceMarch(save, 10 * H)).toBe(false);
    expect(campaignOf(save).best).toBe(0);
  });

  it('takes a fight\'s length per stage, then pays its first clear', () => {
    const save = saveWith(10);
    setMarch(save, true, 0);
    const tithes = save.tithes;
    advanceMarch(save, 1000, 1, seeded(3)); // a fight has just begun
    expect(campaignOf(save).best).toBe(0);
    const ends = marchOf(save)!.fight!.ends;
    expect(ends).toBeGreaterThan(5000);
    advanceMarch(save, ends, 1, seeded(3));
    expect(campaignOf(save).best).toBe(1);
    expect(save.tithes).toBeGreaterThan(tithes);
    expect(marchSummary(save)!.cleared).toEqual([1]);
  });

  it('catches up time away and halts at a wall after repeated defeats', () => {
    const save = saveWith(1);
    setMarch(save, true, 0);
    advanceMarch(save, 12 * H, 1, seeded(7));
    const m = marchOf(save)!;
    expect(m.on).toBe(false);
    expect(m.stopped?.why).toBe('wall');
    expect(m.stopped?.n).toBe(campaignOf(save).best + 1);
    expect(campaignOf(save).best).toBeGreaterThan(0);
    expect(campaignOf(save).best).toBeLessThan(TOTAL_STAGES);
    const s = marchSummary(save)!;
    expect(s.cleared.length).toBe(campaignOf(save).best);
    expect(s.reward.tithes).toBeGreaterThan(0);
    expect(s.exp).toBeGreaterThan(0);
    expect(stopText(s.stopped!)).toContain(`${MARCH_TRIES} times`);
    clearMarchSummary(save);
    expect(marchSummary(save)).toBeUndefined();
  });

  it('a faster battle speed marches faster', () => {
    const slow = saveWith(10);
    const fast = saveWith(10);
    setMarch(slow, true, 0);
    setMarch(fast, true, 0);
    advanceMarch(slow, 1, 1, seeded(5));
    advanceMarch(fast, 1, 3, seeded(5));
    expect(marchOf(fast)!.fight!.ends).toBeLessThan(marchOf(slow)!.fight!.ends);
  });

  it('halts with no Sister on the Vigil, and switching on again clears the halt', () => {
    const save = saveWith(5);
    save.vigil!.party = [];
    setMarch(save, true, 0);
    advanceMarch(save, H);
    expect(marchOf(save)!.stopped?.why).toBe('party');
    save.vigil!.party = ids;
    setMarch(save, true, H);
    expect(marchOf(save)!.stopped).toBeUndefined();
    expect(marchOf(save)!.on).toBe(true);
  });

  it('a stage won by hand meanwhile is not fought again', () => {
    const save = saveWith(10);
    setMarch(save, true, 0);
    advanceMarch(save, 1, 1, seeded(9));
    campaignOf(save).best = 1; // the player cleared stage 1 themselves
    advanceMarch(save, marchOf(save)!.fight!.ends, 1, seeded(9));
    expect(marchSummary(save)).toBeUndefined();
    expect(marchOf(save)!.fight!.n).toBe(2);
  });
});
