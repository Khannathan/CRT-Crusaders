import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { OSSUARY, enterNode, finishRun, startRun, winRoom } from './crusade';
import { GEAR_SETS, MAX_GEAR, MAX_GEAR_LEVEL, MAX_REFINE, REROLL_COST, claimGear, enhance, enhanceBlock, equip, equipped, gearBonus, makeGear, mainValue, rerollBlock, rerollSubs, salvage, type GearItem } from './gear';
import { statsFor } from './stats';

const seq = (xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe('gear', () => {
  it('rarity sets the substat count and main stat size', () => {
    const r = makeGear(seq([0.1]), 'R', 'blade');
    const ur = makeGear(seq([0.1, 0.5, 0.2, 0.7]), 'UR', 'blade');
    expect(r.subs.length).toBe(0);
    expect(ur.subs.length).toBe(3);
    expect(new Set(ur.subs.map((s) => s.stat)).size).toBe(3);
    expect(ur.subs.some((s) => s.stat === ur.main)).toBe(false);
    expect(mainValue(ur)).toBeGreaterThan(mainValue(r));
  });

  it('equipped gear raises stats, one piece per slot', () => {
    const save = newSave();
    const c = CRUSADERS[0];
    save.owned[c.id] = { level: 1, vow: 0 };
    const bare = statsFor(c, save.owned[c.id]);
    claimGear(save, [makeGear(seq([0]), 'SSR', 'blade'), makeGear(seq([0]), 'R', 'blade')]);
    const [a, b] = save.gear!.slice(-2);
    equip(save, c.id, a.uid);
    equip(save, c.id, b.uid);
    expect(equipped(save, c.id).map((g) => g.uid)).toEqual([b.uid]);
    const worn = statsFor(c, save.owned[c.id], equipped(save, c.id));
    expect(Math.abs(worn.atk - bare.atk * (1 + gearBonus([b]).atkPct))).toBeLessThanOrEqual(1);
    expect(worn.atk).toBeGreaterThan(bare.atk);
  });

  it('enhancing costs Tithes, grows the main stat and stops at the cap', () => {
    const save = newSave();
    save.tithes = 1e6;
    const item = makeGear(seq([0.3]), 'SR', 'habit');
    const before = mainValue(item);
    const subBefore = item.subs[0].value;
    for (let i = 0; i < MAX_GEAR_LEVEL + 3; i++) enhance(save, item);
    expect(item.level).toBe(MAX_GEAR_LEVEL);
    expect(mainValue(item)).toBeGreaterThan(before);
    expect(item.subs[0].value).toBeGreaterThan(subBefore);
  });

  it('a full armory melts new loot into Tithes; salvage pays out', () => {
    const save = newSave();
    claimGear(save, Array.from({ length: MAX_GEAR }, () => makeGear(Math.random, 'R')));
    expect(save.gear!.length).toBe(MAX_GEAR);
    const t = save.tithes;
    expect(claimGear(save, [makeGear(Math.random, 'R')])).toBeGreaterThan(0);
    expect(save.tithes).toBeGreaterThan(t);
    salvage(save, save.gear![0].uid);
    expect(save.gear!.length).toBe(MAX_GEAR - 1);
  });

  it('crusades drop gear: kept win or lose', () => {
    for (const outcome of ['victory', 'defeat'] as const) {
      const save = newSave();
      const id = CRUSADERS[0].id;
      save.owned[id] = { level: 1, vow: 0 };
      const run = startRun(save, [id], OSSUARY, seq([0.1, 0.4, 0.7]));
      const elite = run.map.findIndex((f) => f.some((n) => n.kind === 'elite'));
      run.floor = elite - 1;
      run.at = 0;
      run.map[elite - 1][0].next = [run.map[elite].findIndex((n) => n.kind === 'elite')];
      enterNode(run, run.map[elite - 1][0].next[0]);
      winRoom(run, save, () => 0.5);
      expect(run.loot.length).toBe(1);
      const before = save.gear!.length;
      const res = finishRun(save, run, outcome);
      expect(save.gear!.length).toBe(before + 1);
      expect(res.gear.length).toBe(1);
    }
  });
});

describe('the Forge', () => {
  const piece = (): GearItem => ({ uid: 'x', slot: 'blade', rarity: 'SSR', name: 'Test', level: 10, main: 'atkPct', subs: [{ stat: 'crit', value: 0.06 }, { stat: 'spd', value: 1 }] });

  it('refines past +10 only with Blessed Iron, up to +15', () => {
    const save = newSave();
    save.tithes = 100_000;
    const item = piece();
    expect(enhanceBlock(save, item)).toMatch(/Iron/);
    save.items = { iron1: 25, iron2: 16, iron3: 2 };
    const before = mainValue(item);
    for (let i = 0; i < 8; i++) enhance(save, item, () => 0);
    expect(item.level).toBe(MAX_REFINE);
    expect(mainValue(item)).toBeGreaterThan(before);
    expect(save.items).toEqual({ iron1: 0, iron2: 0, iron3: 0 });
    expect(enhanceBlock(save, item)).toBe('Fully refined');
  });

  it('rerolls substats into new stats of the same strength', () => {
    const save = newSave();
    save.items = { iron2: 2 };
    save.tithes = REROLL_COST.tithes;
    const item = piece();
    expect(rerollSubs(save, item, () => 0)).toBe(true);
    expect(item.subs.map((s) => s.stat)).toEqual(['hpPct', 'armorPct']);
    expect(item.subs[0].value).toBeCloseTo(0.06);
    expect(item.subs[1].value).toBeCloseTo(0.04);
    expect(rerollBlock(save, item)).toBeTruthy();
  });

  it('two and three pieces of a set add their bonuses', () => {
    const set = GEAR_SETS[0];
    const mk = (slot: GearItem['slot']): GearItem => ({ uid: slot, slot, rarity: 'R', name: '', level: 0, main: 'hpPct', subs: [], set: set.id });
    const one = gearBonus([mk('blade')]);
    const two = gearBonus([mk('blade'), mk('habit')]);
    const three = gearBonus([mk('blade'), mk('habit'), mk('rosary')]);
    expect(one.atkPct).toBe(0);
    expect(two.atkPct).toBeCloseTo(set.two.atkPct!);
    expect(three.crit).toBeCloseTo(set.three.crit!);
    expect(makeGear(Math.random, 'SR').set).toBeDefined();
  });
});

describe('gear Speed soft cap', () => {
  it('counts in full up to 4, half after, and never past 8', async () => {
    const { gearSpeed } = await import('./stats');
    expect([0, 3, 4, 6, 12, 20].map(gearSpeed)).toEqual([0, 3, 4, 5, 8, 8]);
  });
});
