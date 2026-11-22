import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { CRUSADERS } from '../data/crusaders';
import { orderBonuses } from '../data/orders';
import { CLASS_SKILLS } from '../data/skills';
import { skillsFor } from './combat';
import { winRoom, BELFRY, CRYPTS, RAMP, actsOf, cryptFloors, OSSUARY, choices, chooseEvent, cryptUnlocked, enterNode, finishRun, generateMap, heresyAvailable, keepOnDefeat, makeBattle, maxHpOf, startRun, PILGRIMAGE_BONUS, PILGRIMAGE_CLEARS, pilgrimageLeft } from './crusade';
import { seeded } from './rng';

describe('the crypt ramp', () => {
  it('18 crypts, each one step of the ramp, each unlocked by the one before', () => {
    expect(CRYPTS.length).toBe(18);
    expect(CRYPTS.map((c) => c.floors)).toEqual(RAMP);
    CRYPTS.slice(1).forEach((c, i) => expect(c.unlockAfter).toBe(CRYPTS[i].id));
  });

  it('acts hold up to 10 floors', () => {
    expect(actsOf(5)).toEqual([5]);
    expect(actsOf(10)).toEqual([10]);
    expect(actsOf(15)).toEqual([10, 5]);
    expect(actsOf(30)).toEqual([10, 10, 10]);
  });

  it('Heresy climbs every crypt to 30 floors at the last tier', () => {
    expect([0, 1, 2, 3, 4, 5].map((h) => cryptFloors(OSSUARY, h))).toEqual([5, 10, 15, 20, 25, 30]);
    for (const c of CRYPTS) {
      expect(cryptFloors(c, 0)).toBe(c.floors);
      expect(cryptFloors(c, 5)).toBe(30);
      for (let h = 1; h <= 5; h++) {
        expect(cryptFloors(c, h)).toBeGreaterThanOrEqual(cryptFloors(c, h - 1));
        expect(RAMP).toContain(cryptFloors(c, h));
      }
    }
  });

  it('each act ends in a boss; acts of 8 or more floors add a Warden midway', () => {
    for (const floors of [5, 8, 10, 15, 18, 30]) {
      const map = generateMap(OSSUARY, seeded(floors), floors);
      const acts = actsOf(floors);
      const bosses = map.filter((row) => row[0].kind === 'boss');
      expect(bosses.filter((r) => r[0].warden).length).toBe(acts.filter((n) => n >= 8).length);
      expect(bosses.filter((r) => r[0].actEnd).length).toBe(acts.length - 1);
      expect(map[map.length - 1][0]).toMatchObject({ kind: 'boss', encounter: OSSUARY.boss, act: acts.length });
      bosses.forEach((r) => expect(r.length).toBe(1));
    }
  });

  it('felling an act boss opens a Sanctuary that heals before the next act', () => {
    const save = newSave();
    save.owned['CC-W013'] = { level: 1, vow: 0 };
    const run = startRun(save, ['CC-W013'], OSSUARY, seeded(9), 2); // 15 floors: acts of 10 and 5
    expect(run.map.length).toBe(17);
    const end = run.map.findIndex((row) => row[0].actEnd);
    expect(end).toBe(10);
    run.floor = end;
    run.at = 0;
    run.resolved = false;
    run.hp['CC-W013'] = 1;
    winRoom(run, save);
    expect(run.sanctuary).toBe(1);
    expect(run.hp['CC-W013']).toBeGreaterThan(1);
  });
});

describe('crypt maps', () => {
  it('every node can be reached, and the boss waits at the top', () => {
    for (const crypt of CRYPTS) {
      for (let seed = 1; seed < 60; seed++) {
        const map = generateMap(crypt, seeded(seed));
        expect(map.length).toBe(crypt.floors + actsOf(crypt.floors).length); // a boss row ends each act
        expect(map[map.length - 1].map((n) => n.kind)).toEqual(['boss']);
        expect(map[0].every((n) => n.kind === 'fight')).toBe(true);
        expect(map.flat().some((n) => n.kind === 'elite')).toBe(true);
        for (let f = 1; f < map.length; f++) {
          map[f].forEach((_, j) => expect(map[f - 1].some((n) => n.next.includes(j))).toBe(true));
        }
        map.slice(0, -1).forEach((floor) => floor.forEach((n) => expect(n.next.length).toBeGreaterThan(0)));
      }
    }
  });

  it('you can only step along a path, and events change the run', () => {
    const save = newSave();
    save.owned['CC-W013'] = { level: 1, vow: 0 };
    const run = startRun(save, ['CC-W013'], OSSUARY, seeded(4));
    expect(choices(run)).toEqual(run.map[0].map((_, i) => i));
    enterNode(run, 0);
    expect(choices(run)).toEqual([]); // the fight is not done yet
    expect(() => enterNode(run, 0)).toThrow();
    // force an event to check its effects
    run.resolved = true;
    run.map[1][run.map[0][0].next[0]] = { kind: 'event', event: 'tithe-box', next: run.map[1][run.map[0][0].next[0]].next };
    enterNode(run, run.map[0][0].next[0]);
    chooseEvent(save, run, 0);
    expect(run.tithes).toBe(80);
    expect(run.curseVigil).toBe(3);
  });

  it('the Belfry opens after the Ossuary is cleared', () => {
    const save = newSave();
    expect(cryptUnlocked(save, BELFRY)).toBe(false);
    save.cleared.push(OSSUARY.id);
    expect(cryptUnlocked(save, BELFRY)).toBe(true);
  });
});

describe('reasons to keep going', () => {
  it('two crusaders of one order turn on its bonus', () => {
    const save = newSave();
    // Aveline and Mariel are both Sepulcher Watch: +10% max HP
    for (const id of ['CC-W013', 'CC-W022', 'CC-W001']) save.owned[id] = { level: 1, vow: 0 };
    const solo = startRun(save, ['CC-W013', 'CC-W001']);
    const pair = startRun(save, ['CC-W013', 'CC-W022']);
    expect(maxHpOf(save, pair, 'CC-W013')).toBe(Math.round(maxHpOf(save, solo, 'CC-W013') * 1.1));
    expect(orderBonuses(['Glass Confession', 'Glass Confession', 'Glass Confession']).length).toBe(2);
  });

  it('Vows upgrade skills at ranks 2, 4 and 5', () => {
    const save = newSave();
    save.owned['CC-W001'] = { level: 1, vow: 2 };
    const run = startRun(save, ['CC-W001']);
    const unit = makeBattle(save, run, 'ossuary-1').units.find((u) => u.side === 'party')!;
    const skills = skillsFor(unit);
    expect(skills[0].name).toBe('Accuse+');
    expect(skills[0].mult).toBeCloseTo(CLASS_SKILLS.inquisitor[0].mult! * 1.25);
    expect(skills[1].name).toBe("Duelist's Thrust");
  });

  it('Heresy unlocks one tier at a time, makes enemies tougher and pays Seals once', () => {
    const save = newSave();
    save.owned['CC-W013'] = { level: 1, vow: 0 };
    expect(heresyAvailable(save, OSSUARY)).toBe(0);
    save.cleared.push(OSSUARY.id);
    expect(heresyAvailable(save, OSSUARY)).toBe(1);
    const run = startRun(save, ['CC-W013'], OSSUARY, seeded(1), 1);
    const base = makeBattle(save, startRun(save, ['CC-W013']), 'ossuary-1').units.find((u) => u.side === 'enemy')!;
    const hard = makeBattle(save, run, 'ossuary-1').units.find((u) => u.side === 'enemy')!;
    expect(hard.maxHp).toBeGreaterThan(base.maxHp * 1.2);
    run.floor = run.map.length - 1;
    const first = finishRun(save, run, 'victory');
    expect(first.heresyCleared).toBe(1);
    expect(heresyAvailable(save, OSSUARY)).toBe(2);
    const again = finishRun(save, { ...run }, 'victory');
    expect(again.heresyCleared).toBeUndefined();
    expect(again.seals).toBeLessThan(first.seals);
  });
});

describe('weekly Pilgrimage', () => {
  it('the first three victories each week pay a bonus; defeats and retreats do not use one', () => {
    const save = newSave();
    const id = CRUSADERS[0].id;
    save.owned[id] = { level: 1, vow: 0 };
    const run = () => startRun(save, [id], OSSUARY);
    expect(pilgrimageLeft(save)).toBe(PILGRIMAGE_CLEARS);
    expect(finishRun(save, run(), 'retreat').pilgrimage).toBeUndefined();
    expect(finishRun(save, run(), 'defeat').pilgrimage).toBeUndefined();
    for (let i = 1; i <= PILGRIMAGE_CLEARS; i++) {
      const r = finishRun(save, run(), 'victory');
      expect(r.pilgrimage?.seals).toBe(PILGRIMAGE_BONUS.seals);
      expect(r.pilgrimage?.left).toBe(PILGRIMAGE_CLEARS - i);
    }
    expect(finishRun(save, run(), 'victory').pilgrimage).toBeUndefined();
    // next week it renews
    expect(pilgrimageLeft(save, Date.now() + 8 * 864e5)).toBe(PILGRIMAGE_CLEARS);
  });
});

describe('losing a crypt', () => {
  it('keeps Seals, gear, banked spoils and most of the rest', () => {
    expect(keepOnDefeat(100, 0)).toBe(75);
    expect(keepOnDefeat(100, 60)).toBe(90);
    expect(keepOnDefeat(100, 100)).toBe(100);
    const save = newSave();
    const id = CRUSADERS[0].id;
    save.owned[id] = { level: 1, vow: 0 };
    const run = startRun(save, [id], OSSUARY);
    run.tithes = 400;
    run.seals = 3;
    run.items = { ash1: 10 };
    run.banked = { tithes: 200, items: { ash1: 6 } };
    const t = save.tithes;
    const s = save.seals;
    const r = finishRun(save, run, 'defeat');
    expect(r.tithes).toBe(350);
    expect(r.seals).toBe(3);
    expect(r.items.ash1).toBe(9);
    expect(save.tithes - t).toBe(350);
    expect(save.seals - s).toBe(3);
  });
});
