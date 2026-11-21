import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { BELFRY, CRYPTS, OSSUARY, choices, chooseEvent, cryptUnlocked, enterNode, generateMap, startRun } from './crusade';
import { seeded } from './rng';

describe('crypt maps', () => {
  it('every node can be reached, and the boss waits at the top', () => {
    for (const crypt of CRYPTS) {
      for (let seed = 1; seed < 60; seed++) {
        const map = generateMap(crypt, seeded(seed));
        expect(map.length).toBe(crypt.floors + 1);
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
