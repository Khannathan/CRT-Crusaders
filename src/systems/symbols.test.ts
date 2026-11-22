import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { autoBattle } from './autoplay';
import { OSSUARY, skirmish } from './crusade';
import { give } from './items';
import { seeded } from './rng';
import { sisterStats } from './stats';
import { SYMBOL_MAX, raiseSymbol, symbolBlock, symbolCombat, symbolName, upgradeCost } from './symbols';

const hiero = CRUSADERS.find((c) => c.classId === 'hierophant')!;

describe('Holy Symbols', () => {
  it('every Sister has a relic to name her Symbol', () => {
    expect(CRUSADERS.every((c) => c.relic)).toBe(true);
    expect(symbolName(CRUSADERS.find((c) => c.id === 'CC-W001')!)).toBe('Interrogation Seal');
  });

  it('wakes after her first Ascension, then rises to +15 on tiered Grace', () => {
    const save = newSave();
    save.owned[hiero.id] = { level: 20, vow: 0 };
    save.tithes = 1e7;
    give(save, { grace1: 1000, grace2: 1000, grace3: 1000 });
    expect(symbolBlock(save, hiero.id)).toMatch(/Ascend/);
    save.owned[hiero.id].asc = 1;
    const before = sisterStats(save, hiero).atk;
    expect(raiseSymbol(save, hiero.id)).toBe(true);
    expect(save.owned[hiero.id].symbol).toBe(0);
    expect(sisterStats(save, hiero).atk).toBeGreaterThan(before);
    while (raiseSymbol(save, hiero.id));
    expect(save.owned[hiero.id].symbol).toBe(SYMBOL_MAX);
    expect(symbolBlock(save, hiero.id)).toMatch(/sanctified/);
  });

  it('each band of levels takes its own Grace', () => {
    expect(Object.keys(upgradeCost(3).items)).toEqual(['grace1']);
    expect(Object.keys(upgradeCost(8).items)).toEqual(['grace2']);
    expect(Object.keys(upgradeCost(15).items)).toEqual(['grace3']);
  });

  it('blessings at +5, +10 (by class) and +15', () => {
    expect(symbolCombat(hiero, undefined)).toBeUndefined();
    expect(symbolCombat(hiero, 4)!.mult).toBe(1);
    expect(symbolCombat(hiero, 5)!.mult).toBe(1.1);
    expect(symbolCombat(hiero, 10)!.guard).toBe(0.12);
    expect(symbolCombat(hiero, 15)!.rite).toBe(0.3);
  });

  it('a full party of +15 Symbols is strong, not a different game', () => {
    const party = ['CC-W013', 'CC-W052', 'CC-W001', 'CC-W022'];
    const rate = (lv?: number) => {
      let wins = 0;
      for (let i = 0; i < 200; i++) {
        const save = newSave();
        for (const p of party) save.owned[p] = { level: 1, vow: 0, symbol: lv };
        if (autoBattle(skirmish(save, party, OSSUARY.boss, 0, seeded(700 + i)), 400) === 'victory') wins++;
      }
      return wins / 200;
    };
    const none = rate(undefined);
    const full = rate(SYMBOL_MAX);
    console.log(`[symbols] Ossuary boss at level 1: none ${none}, all +15 ${full}`);
    expect(full).toBeGreaterThan(none);
  });
});
