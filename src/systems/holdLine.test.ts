import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { simulateField } from './field';
import { HOLD_WAVES, beginStand, finishWave, holdLeft, holdOf, standReward, takeBlessing, waveBattle, waveShare } from './holdLine';
import { countOf } from './items';
import { seeded } from './rng';

const PARTY = ['SW-R-VEI', 'DL-R-SEN', 'IV-R-EXE', 'SW-SR-ABB'];
const NOW = new Date(2026, 10, 23, 12).getTime();

function save(level = 40) {
  const s = newSave();
  for (const id of PARTY) s.owned[id] = { level, vow: 0 };
  return s;
}

describe('Hold the Line', () => {
  it('one stand a day, and it opens with the party at full HP', () => {
    const s = save();
    expect(holdLeft(s, NOW)).toBe(1);
    const st = beginStand(s, PARTY, NOW)!;
    expect(st.held).toBe(0);
    expect(Object.values(st.hp).every((v) => v > 0)).toBe(true);
    expect(beginStand(s, PARTY, NOW)).toBeUndefined();
    expect(holdLeft(s, NOW + 24 * 3600e3)).toBe(1);
  });

  it('waves ramp from easy to past the party', () => {
    expect(waveShare(1)).toBeCloseTo(0.6);
    expect(waveShare(HOLD_WAVES)).toBeCloseTo(3);
    const s = save();
    const st = beginStand(s, PARTY, NOW)!;
    let early = 0;
    let late = 0;
    for (let i = 0; i < 12; i++) {
      st.held = 0;
      if (simulateField(waveBattle(s, st, seeded(100 + i), NOW), { rng: seeded(200 + i) }).outcome === 'victory') early++;
      st.held = HOLD_WAVES - 1;
      if (simulateField(waveBattle(s, st, seeded(100 + i), NOW), { rng: seeded(200 + i) }).outcome === 'victory') late++;
    }
    expect(early).toBeGreaterThanOrEqual(10);
    expect(late).toBeLessThan(early);
  });

  it('a won wave keeps wounds and offers blessings; a loss ends and pays', () => {
    const s = save();
    const st = beginStand(s, PARTY, NOW)!;
    const b = waveBattle(s, st, seeded(1), NOW);
    const r = simulateField(b, { rng: seeded(2) });
    expect(r.outcome).toBe('victory');
    const res = finishWave(s, 'victory', b, seeded(3), NOW);
    expect(res.over).toBe(false);
    expect(st.held).toBe(1);
    expect(st.offer).toHaveLength(3);
    expect(takeBlessing(s, st.offer![0], NOW)).toBe(true);
    expect(st.blessings).toHaveLength(1);
    const tithes = s.tithes;
    const end = finishWave(s, 'defeat', b, seeded(4), NOW);
    expect(end.over).toBe(true);
    expect(end.newBest).toBe(true);
    expect(holdOf(s, NOW).best).toBe(1);
    expect(holdOf(s, NOW).stand).toBeUndefined();
    expect(s.tithes - tithes).toBe(standReward(1).tithes);
    expect(countOf(s, 'canon1')).toBe(2);
  });

  it('blessings change the next wave', () => {
    const s = save();
    const st = beginStand(s, PARTY, NOW)!;
    const plain = waveBattle(s, st, seeded(1), NOW).units.find((u) => u.side === 'party')!;
    st.blessings = ['wrath', 'ward', 'zeal'];
    const blessed = waveBattle(s, st, seeded(1), NOW).units.find((u) => u.side === 'party')!;
    expect(blessed.atk).toBeGreaterThan(plain.atk);
    expect(blessed.status.shield ?? 0).toBeGreaterThan(plain.status.shield ?? 0);
    expect(blessed.zeal ?? 0).toBeGreaterThan(plain.zeal ?? 0);
  });
});
