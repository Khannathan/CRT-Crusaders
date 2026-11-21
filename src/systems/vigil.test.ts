import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { BELFRY } from './crusade';
import { VIGIL_CAP_HOURS, claimVigil, ensureVigil, setVigil, vigilPending, vigilRates } from './vigil';

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

  it('stronger Sisters gather more, up to a limit', () => {
    const weak = saveWith(1);
    const strong = saveWith(20);
    const rw = vigilRates(weak, ensureVigil(weak, 0)!);
    const rs = vigilRates(strong, ensureVigil(strong, 0)!);
    expect(rs.tithes).toBeGreaterThan(rw.tithes);
    expect(rs.eff).toBeLessThanOrEqual(1.5);
  });

  it('claiming pays out and restarts the clock; changing crypt claims first', () => {
    const save = saveWith(8);
    ensureVigil(save, 0);
    const t0 = save.tithes;
    const expected = vigilPending(save, save.vigil!, 6 * H);
    const c = claimVigil(save, 6 * H, () => 0.5);
    expect(save.tithes).toBe(t0 + c.tithes);
    expect(c.gear.length).toBe(expected.gear);
    expect(c.gear.length).toBeGreaterThan(0);
    expect(save.vigil!.since).toBe(6 * H);
    // The Belfry is locked until the Ossuary is cleared.
    setVigil(save, 7 * H, { crypt: BELFRY.id });
    expect(save.vigil!.crypt).not.toBe(BELFRY.id);
    save.cleared.push('drowned-ossuary');
    const before = save.tithes;
    setVigil(save, 8 * H, { crypt: BELFRY.id });
    expect(save.vigil!.crypt).toBe(BELFRY.id);
    expect(save.tithes).toBeGreaterThan(before);
  });
});
