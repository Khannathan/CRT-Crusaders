import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { autoBattle } from './autoplay';
import { seeded } from './rng';
import { BRAND_MARKS, applyEdict, finishAct, inquisitionBattle, inquisitionOf, rotation, spentElsewhere, totalBrands } from './inquisition';
import { skirmish } from './crusade';

const party = ['CC-W013', 'CC-W052', 'CC-W001', 'CC-W022'];
const day = (d: number) => new Date(2026, 10, d, 12).getTime();

function strongSave() {
  const save = newSave();
  for (const id of party) save.owned[id] = { level: 30, vow: 5 };
  return save;
}

describe('Inquisition', () => {
  it('a rotation lasts two weeks and then changes', () => {
    const a = rotation(day(16));
    expect(rotation(a.ends - 1000).index).toBe(a.index);
    const b = rotation(a.ends + 1000);
    expect(b.index).toBe(a.index + 1);
    expect(b.edict.id).not.toBe(a.edict.id);
    expect(a.acts).toHaveLength(3);
    expect(a.featured).toHaveLength(2);
  });

  it('edicts bend the fight', () => {
    const save = strongSave();
    const b = skirmish(save, party, 'choir', 0, seeded(1));
    applyEdict(b, 'famine');
    expect(b.partyHeal).toBe(0.5);
    applyEdict(b, 'candle');
    expect(b.vigil).toBeLessThanOrEqual(4);
  });

  it('a win earns Brands, spends its Sisters for the other acts, and pays marks once', () => {
    const save = strongSave();
    const now = day(16);
    const seals = save.seals;
    const b = inquisitionBattle(save, party, 0, seeded(3), now);
    autoBattle(b, 800);
    const r = finishAct(save, 0, b, seeded(9), now);
    expect(r.brands).toBeGreaterThan(0);
    expect(totalBrands(save, now)).toBe(r.brands);
    expect(spentElsewhere(save, 1, now).has(party[0])).toBe(true);
    expect(spentElsewhere(save, 0, now).size).toBe(0);
    // Act 1 can't field them now.
    expect(inquisitionBattle(save, party, 1, seeded(4), now).units.some((u) => u.side === 'party')).toBe(false);
    if (r.brands >= BRAND_MARKS[0].at) expect(save.seals).toBeGreaterThan(seals);
    // A worse or equal replay changes nothing.
    const again = finishAct(save, 0, b, seeded(9), now);
    expect(again.gained).toBe(0);
    expect(again.paid).toHaveLength(0);
  });

  it('resets with the next rotation', () => {
    const save = strongSave();
    const now = day(16);
    inquisitionOf(save, now).brands = [3, 3, 3];
    expect(totalBrands(save, rotation(now).ends + 1000)).toBe(0);
  });
});
