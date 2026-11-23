import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { stageBattle } from './campaign';
import { FieldBattle, simulateField } from './field';
import { HOSANNA, HOSANNAS, HOSANNA_MAX, castHosanna, hosannaFor, pickHosanna } from './hosanna';
import { seeded } from './rng';

const STARTER = ['CC-W013', 'CC-W052', 'CC-W001', 'CC-W022'];
const saveAt = (level: number) => {
  const save = newSave();
  for (const id of STARTER) save.owned[id] = { level, vow: 0 };
  return save;
};

describe('Hosanna', () => {
  it('fills as the Sisters act; Auto sings it, a manual player must tap', () => {
    const save = saveAt(12);
    for (const manual of [false, true]) {
      const b = stageBattle(save, STARTER, 20, seeded(4));
      const f = new FieldBattle(b, { w: 540, h: 600, manualLitany: manual, hosanna: HOSANNA['wrath-choir'], rng: seeded(1) });
      let peak = 0;
      for (let t = 0; t < 90 && !b.outcome(); t += 0.05) {
        f.update(0.05);
        peak = Math.max(peak, f.hosanna);
      }
      if (manual) {
        expect(f.hosannas).toBe(0);
        expect(peak).toBeGreaterThan(HOSANNA_MAX / 2);
      } else expect(f.hosannas).toBeGreaterThan(0);
    }
  });

  it('a tapped Hosanna empties the bar and lands', () => {
    const save = saveAt(10);
    const b = stageBattle(save, STARTER, 8, seeded(4));
    const f = new FieldBattle(b, { w: 540, h: 600, manualLitany: true, hosanna: HOSANNA['wrath-choir'], rng: seeded(1) });
    f.update(0.05);
    expect(f.castHosanna()).toBeUndefined();
    f.hosanna = HOSANNA_MAX;
    const hp = b.alive('enemy').reduce((n, u) => n + u.hp, 0);
    const e = f.castHosanna();
    expect(e?.kind).toBe('act');
    expect(f.hosanna).toBe(0);
    expect(b.alive('enemy').reduce((n, u) => n + u.hp, 0)).toBeLessThan(hp);
  });

  it("every Hosanna resolves without touching the leader's cooldowns", () => {
    const save = saveAt(10);
    for (const h of HOSANNAS) {
      const b = stageBattle(save, STARTER, 8, seeded(4));
      for (const u of b.alive('party')) u.hp = Math.round(u.maxHp * 0.5);
      for (const u of b.alive('party')) u.cooldowns = { x: 2 };
      const r = castHosanna(b, h);
      expect(r, h.id).toBeDefined();
      expect(r!.caster.cooldowns).toEqual({ x: 2 });
      expect(r!.events.length, h.id).toBeGreaterThan(2);
    }
  });

  it('each party keeps its own pick; locked Hosannas cannot be picked', () => {
    const save = saveAt(10);
    expect(hosannaFor(save, STARTER).id).toBe('wrath-choir');
    expect(pickHosanna(save, STARTER, 'living-waters')).toBe(true);
    expect(hosannaFor(save, [...STARTER].reverse()).id).toBe('living-waters');
    // Another party falls back to the last pick until it has its own.
    expect(hosannaFor(save, ['CC-W013']).id).toBe('living-waters');
    pickHosanna(save, ['CC-W013'], 'saints-mantle');
    expect(hosannaFor(save, STARTER).id).toBe('living-waters');
    // Verdict of the Many needs Rank of Faith 9.
    expect(pickHosanna(save, STARTER, 'many-verdict')).toBe(false);
  });

  it('a Hosanna helps, but does not swing fights wildly', () => {
    const save = saveAt(12);
    let base = 0;
    let sung = 0;
    const n = 40;
    for (let i = 0; i < n; i++) {
      if (simulateField(stageBattle(save, STARTER, 20, seeded(300 + i)), { rng: seeded(700 + i) }).outcome === 'victory') base++;
      if (simulateField(stageBattle(save, STARTER, 20, seeded(300 + i)), { rng: seeded(700 + i), hosanna: HOSANNA['wrath-choir'] }).outcome === 'victory') sung++;
    }
    console.log(`[hosanna] stage 20 lv 12 on Auto: without ${base}/${n}, with Choir of Wrath ${sung}/${n}`);
    expect(sung).toBeGreaterThanOrEqual(base);
    expect(sung - base).toBeLessThanOrEqual(n * 0.35);
  });
});
