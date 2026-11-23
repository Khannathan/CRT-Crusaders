import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { autoBattle } from './autoplay';
import { OSSUARY, skirmish } from './crusade';
import { give } from './items';
import { seeded } from './rng';
import { sisterStats } from './stats';
import { KITS, exaltSig } from '../data/kits';
import { Battle, makeEnemy, type Unit } from './combat';
import { EXALT, SYMBOL_MAX, exalts, raiseSymbol, symbolBlock, symbolCombat, symbolName, symbolPerks, upgradeCost } from './symbols';

const hiero = CRUSADERS.find((c) => c.classId === 'hierophant' && c.rarity === 'R')!;

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

  it('at +10 a Sister with a signature has it Exalted; R and SR keep the class blessing', () => {
    const isolde = CRUSADERS.find((c) => c.id === 'CC-W040')!;
    expect(exalts(isolde)).toBe(true);
    expect(symbolPerks(isolde)[1].name).toBe(`Exalted ${isolde.passive!.name}`);
    expect(symbolCombat(isolde, 9)!.exalt).toBeUndefined();
    expect(symbolCombat(isolde, 10)!.exalt).toBe(EXALT);
    expect(symbolCombat(isolde, 10)!.mult).toBe(1.1);
    expect(exalts(hiero)).toBe(false);
    expect(symbolPerks(hiero)[1].name).toBe('Unbroken Relic');
    // Most SSR and UR signatures have a share to raise; the rest keep the class blessing.
    const high = CRUSADERS.filter((c) => c.rarity === 'SSR' || c.rarity === 'UR');
    expect(high.filter(exalts).length).toBeGreaterThanOrEqual(high.length * 0.7);
    expect(CRUSADERS.filter((c) => c.rarity === 'R' || c.rarity === 'SR').some(exalts)).toBe(false);
  });

  it('Exalting raises shares, not counts or turns', () => {
    const s = exaltSig({ burnFirst: 2, dotMult: 0.2, remainsAtk: { per: 0.04, cap: 0.2 }, mercyExtra: true, owZeal: 10 }, 1.25)!;
    expect(s).toEqual({ burnFirst: 2, dotMult: 0.25, remainsAtk: { per: 0.05, cap: 0.25 }, mercyExtra: true, owZeal: 13 });
    expect(exaltSig({ mercyExtra: true }, 1.25)).toBeUndefined();
  });

  it('an Exalted Sister fights with the stronger signature', () => {
    const c = CRUSADERS.find((x) => x.id === 'CC-W040')!;
    const unit = (lv?: number): Unit => ({ uid: c.id, side: 'party' as const, name: c.name, ref: c.id, classId: c.classId, order: c.order, rank: 1, maxHp: 1000, hp: 1000, atk: 100, armor: 0, mres: 0, crit: 0, spd: 10, status: {}, passive: c.passive, symbol: symbolCombat(c, lv) });
    const plain = unit(9);
    const high = unit(10);
    new Battle([plain], [makeEnemy('husk', 'e0', 1)]);
    new Battle([high], [makeEnemy('husk', 'e1', 1)]);
    expect(plain.sig).toBe(KITS[c.id].sig);
    expect(high.sig!.dotMult).toBeCloseTo(KITS[c.id].sig!.dotMult! * EXALT);
  });
});
