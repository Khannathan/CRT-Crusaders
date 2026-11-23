import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { dmgTagOf } from '../data/classes';
import { newSave } from '../state/save';
import type { Unit } from './combat';
import { CRYPTS } from './crusade';
import { HUNTS, baneOf } from './hunts';
import { bonusMarks, cryptMarks, foeWeakness, huntMarks, joinMarks, liveLegend, needMarks, raidMarks, rarityNeedMarks } from './pickMarks';

const foe = (o: Partial<Unit>): Unit => ({ side: 'enemy', maxHp: 100, armor: 50, mres: 50, ...o }) as Unit;

describe('pick marks', () => {
  it('finds the bane and the thin guard of a boss, ignoring its minions', () => {
    const w = foeWeakness([foe({ boss: true, bane: 'Iron Vigil', armor: 10, mres: 80 }), foe({ bane: 'Candle Choir', maxHp: 900 })]);
    expect(w).toEqual({ banes: ['Iron Vigil'], weak: 'physical' });
  });

  it('marks no damage type when the guards are close or the foe swaps them', () => {
    expect(foeWeakness([foe({ armor: 50, mres: 55 })]).weak).toBeUndefined();
    expect(foeWeakness([foe({ armor: 0, mres: 90, traits: { swap: 3 } as Unit['traits'] })]).weak).toBeUndefined();
  });

  it('hunt marks follow the beast: bane Order and the damage it fears', () => {
    const save = newSave();
    const hunt = HUNTS[0];
    const m = huntMarks(save, hunt);
    const sis = CRUSADERS.find((c) => c.order === baneOf(hunt))!;
    expect(m.of(sis, []).some((x) => x.kind === 'bane')).toBe(true);
    const phys = CRUSADERS.find((c) => dmgTagOf(c) === 'physical')!;
    expect(m.of(phys, []).some((x) => x.label === 'PHYSICAL')).toBe(true);
  });

  it('a rarity need marks the qualified only until one is picked', () => {
    const ok = (c: { rarity: string }) => c.rarity === 'UR';
    const m = rarityNeedMarks('UR', ok);
    const ur = CRUSADERS.find(ok)!;
    expect(m.of(ur, [])).toHaveLength(1);
    expect(m.of(ur, [ur.id])).toHaveLength(0);
  });

  it('joins marks with need and bonus first, and the legend only lists what marks someone', () => {
    const [a, b] = CRUSADERS;
    const m = joinMarks(bonusMarks((c) => c.id === a.id, 'earn more'), needMarks(a.id, 'HER RITE', 'she must fight'), needMarks('nobody', 'X', 'never'));
    expect(m.of(a, []).map((x) => x.kind)).toEqual(['need', 'bonus']);
    expect(liveLegend(m, [a, b], []).map((l) => l.label)).toEqual(['BONUS', 'HER RITE']);
  });

  it('crypt and raid marks build without a party', () => {
    const save = newSave();
    for (const c of CRYPTS) expect(cryptMarks(save, c).legend.length).toBeGreaterThan(0);
    expect(raidMarks(save).legend.length).toBeGreaterThan(0);
  });
});
