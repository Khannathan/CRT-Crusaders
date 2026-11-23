import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { CRUSADERS } from '../data/crusaders';
import { orderBonuses } from '../data/orders';
import { CLASS_SKILLS } from '../data/skills';
import { skillsFor } from './combat';
import { winRoom, BELFRY, CRYPTS, RAMP, actsOf, cryptFloors, OSSUARY, choices, chooseEvent, cryptUnlocked, enterNode, finishRun, generateMap, heresyAvailable, heresyScale, HERESY_GROWTH, cryptRecommended, ROMAN, keepOnDefeat, familyBonuses, miracle, MIRACLE_SEALS, makeBattle, maxHpOf, startRun, PILGRIMAGE_BONUS, PILGRIMAGE_CLEARS, pilgrimageLeft, restoreRun } from './crusade';
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
    expect(orderBonuses(['Glass Confession', 'Glass Confession', 'Glass Confession', 'Glass Confession']).length).toBe(3);
    expect(orderBonuses(['Iron Vigil', 'Iron Vigil', 'Hollow Bell', 'Hollow Bell']).map((b) => b.id)).toEqual(['order:Iron Vigil:2', 'order:Hollow Bell:2']);
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

  it('Heresy has no last tier: past V the crypt stays 30 floors and foes keep growing', () => {
    const save = newSave();
    save.cleared.push(OSSUARY.id);
    save.heresy = { [OSSUARY.id]: 12 };
    expect(heresyAvailable(save, OSSUARY)).toBe(13);
    expect(cryptFloors(OSSUARY, 12)).toBe(cryptFloors(OSSUARY, 5));
    expect(heresyScale(6) / heresyScale(5)).toBeCloseTo(HERESY_GROWTH);
    expect(heresyScale(5)).toBeCloseTo(2.25);
    expect(cryptRecommended(save, OSSUARY, 20)).toBeGreaterThan(cryptRecommended(save, OSSUARY, 10) * 5);
    expect(ROMAN[11]).toBe('XII');
  });

  it('the power to bring never drops as the crypts go deeper', () => {
    const save = newSave();
    const recs = CRYPTS.map((c) => cryptRecommended(save, c));
    recs.forEach((r, i) => expect(r).toBeGreaterThanOrEqual(recs[i - 1] ?? 0));
  });
});

describe('daily Pilgrimage', () => {
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
    expect(pilgrimageLeft(save, Date.now() + 864e5)).toBe(PILGRIMAGE_CLEARS);
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

describe('crypt variety', () => {
  it('has about thirty relics, twenty events, and families that switch on at two and three', async () => {
    const { RELICS } = await import('../data/relics');
    const { EVENTS } = await import('../data/events');
    expect(RELICS.length).toBeGreaterThanOrEqual(28);
    expect(Object.keys(EVENTS).length).toBeGreaterThanOrEqual(18);
    const save = newSave();
    const id = CRUSADERS[0].id;
    save.owned[id] = { level: 5, vow: 0 };
    const run = startRun(save, [id], OSSUARY);
    run.relics = ['censer-coal'];
    expect(familyBonuses(run)).toHaveLength(0);
    run.relics.push('phoenix-quill');
    expect(familyBonuses(run).map((r) => r.id)).toEqual(['family:burn:2']);
    run.relics.push('pitch-reliquary');
    expect(familyBonuses(run)).toHaveLength(2);
    const enc = run.map.flat().find((n) => n.encounter)!.encounter!;
    const b = makeBattle(save, run, enc);
    expect(b.mods.burnMult).toBeCloseTo(0.25 + 0.2 + 0.2);
    // foes open Burning
    expect(b.units.filter((u) => u.side === 'enemy').every((u) => u.status.poison)).toBe(true);
  });

  it('a Miracle raises the fallen, and a burden lasts the run', () => {
    const save = newSave();
    const id = CRUSADERS[0].id;
    save.owned[id] = { level: 5, vow: 0 };
    const run = startRun(save, [id], OSSUARY);
    run.hp[id] = 0;
    miracle(save, run);
    expect(run.hp[id]).toBe(maxHpOf(save, run, id));
    expect(run.seals).toBe(MIRACLE_SEALS);
    const full = maxHpOf(save, run, id);
    run.relics.push('blood-pact');
    expect(maxHpOf(save, run, id)).toBeLessThan(full);
  });

  it('about one map in fifteen holds a Miracle', () => {
    let n = 0;
    for (let i = 0; i < 600; i++) if (generateMap(OSSUARY, seeded(i + 7)).flat().some((x) => x.kind === 'miracle')) n++;
    expect(n / 600).toBeGreaterThan(0.03);
    expect(n / 600).toBeLessThan(0.12);
  });
});

describe('Pilgrimage renewal', () => {
  it('renews at the next local midnight', async () => {
    const { pilgrimageRenews } = await import('./crusade');
    const sun = new Date(2026, 10, 22, 12).getTime();
    expect(pilgrimageRenews(sun)).toBe(new Date(2026, 10, 23).getTime());
  });
});

describe('a run survives a reload', () => {
  it('comes back from its stored form with its crypt looked up again', () => {
    const save = newSave();
    for (const c of CRUSADERS.slice(0, 4)) save.owned[c.id] = { level: 1, vow: 0 };
    const run = startRun(save, CRUSADERS.slice(0, 4).map((c) => c.id), BELFRY, seeded(3));
    enterNode(run, choices(run)[0]);
    const stored = JSON.parse(JSON.stringify({ ...run, crypt: run.crypt.id }));
    const back = restoreRun(stored)!;
    expect(back.crypt).toBe(BELFRY);
    expect(back.map).toEqual(run.map);
    expect(back.floor).toBe(run.floor);
    expect(restoreRun({ ...stored, crypt: 'no-such-crypt' })).toBeUndefined();
    expect(restoreRun(undefined)).toBeUndefined();
  });
});
