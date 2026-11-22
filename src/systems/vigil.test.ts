import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { FAST_HOURS } from './campaign';
import { VIGIL_CAP_HOURS, claimVigil, ensureVigil, fastReward, setVigil, vigilPending, vigilRates } from './vigil';

const H = 3.6e6;
const ids = CRUSADERS.filter((c) => c.rarity === 'R').slice(0, 4).map((c) => c.id);

function saveWith(level: number) {
  const save = newSave();
  for (const id of ids) save.owned[id] = { level, vow: 0 };
  save.lastParty = ids;
  return save;
}

describe('Vigils', () => {
  it('needs a Sister before it starts', () => {
    expect(ensureVigil(newSave(), 0)).toBeUndefined();
    expect(ensureVigil(saveWith(1), 0)?.party).toEqual(ids);
  });

  it('gathers over time, capped at 12 hours', () => {
    const save = saveWith(5);
    const v = ensureVigil(save, 0)!;
    const four = vigilPending(save, v, 4 * H);
    expect(four.tithes).toBeGreaterThan(0);
    expect(four.seals).toBe(1);
    const capped = vigilPending(save, v, 40 * H);
    expect(capped.hours).toBe(VIGIL_CAP_HOURS);
    expect(capped.full).toBe(true);
    expect(capped.tithes).toBe(vigilPending(save, v, VIGIL_CAP_HOURS * H).tithes);
  });

  it('gathers faster the further the Pilgrim\'s Road is cleared', () => {
    const fresh = saveWith(1);
    const far = saveWith(1);
    far.campaign = { best: 23 };
    const rf = vigilRates(fresh);
    const rr = vigilRates(far);
    expect(rr.tithes).toBeGreaterThan(rf.tithes * 2);
    expect(rr.gear).toBeGreaterThan(rf.gear);
    expect(rr.seals).toBeGreaterThan(rf.seals);
  });

  it('Fast Reward: two hours at once, free once a day, then for Gilt', () => {
    const save = saveWith(5);
    ensureVigil(save, 0);
    const day = 30 * 24 * H;
    const t0 = save.tithes;
    const g0 = save.gilt ?? 300;
    const c = fastReward(save, day, () => 0.5)!;
    expect(c.tithes).toBe(Math.floor(FAST_HOURS * vigilRates(save).tithes));
    expect(save.tithes).toBe(t0 + c.tithes);
    expect(save.vigil!.since).toBe(0); // the running Vigil is untouched
    fastReward(save, day + 1000, () => 0.5);
    expect(save.gilt).toBe(g0 - 50);
    fastReward(save, day + 2000);
    fastReward(save, day + 3000);
    expect(fastReward(save, day + 4000)).toBeUndefined(); // 1 free + 3 paid a day
    expect(fastReward(save, day + 24 * H)).toBeDefined(); // a new day
  });

  it('claiming pays out and restarts the clock; changing the watch claims first', () => {
    const save = saveWith(8);
    ensureVigil(save, 0);
    const t0 = save.tithes;
    const expected = vigilPending(save, save.vigil!, 6 * H);
    const c = claimVigil(save, 6 * H, () => 0.5);
    expect(save.tithes).toBe(t0 + c.tithes);
    expect(c.gear.length).toBe(expected.gear);
    expect(c.gear.length).toBeGreaterThan(0);
    expect(save.vigil!.since).toBe(6 * H);
    const before = save.tithes;
    setVigil(save, 8 * H, { party: ids.slice(0, 2) });
    expect(save.vigil!.party).toEqual(ids.slice(0, 2));
    expect(save.tithes).toBeGreaterThan(before);
  });
});
