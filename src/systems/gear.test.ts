import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { OSSUARY, enterNode, finishRun, startRun, winRoom } from './crusade';
import { MAX_GEAR, MAX_GEAR_LEVEL, claimGear, enhance, equip, equipped, gearBonus, makeGear, mainValue, salvage } from './gear';
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

  it('crusades drop gear: kept on victory, lost on defeat', () => {
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
      expect(save.gear!.length).toBe(before + (outcome === 'victory' ? 1 : 0));
      expect(res.gear.length).toBe(outcome === 'victory' ? 1 : 0);
    }
  });
});
