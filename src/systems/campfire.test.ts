import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { bondOf } from './bonds';
import { MORALE_BASE, TOPICS, bestTalks, makeCamp, moraleBuff, moraleOf, reactionOf, topicsOf } from './campfire';
import { skirmish, startRun } from './crusade';

const PARTY = ['SW-R-VEI', 'DL-R-SEN', 'IV-R-EXE', 'SW-SR-ABB'];

describe('the Campfire', () => {
  it('every Sister loves two topics and loathes a third, and Sisters differ', () => {
    const seen = new Set<string>();
    for (const c of CRUSADERS) {
      const t = topicsOf(c.id);
      expect(new Set([...t.loves, t.loathes]).size).toBe(3);
      for (const id of [...t.loves, t.loathes]) expect(TOPICS.some((x) => x.id === id)).toBe(true);
      seen.add(t.loves.join());
    }
    expect(seen.size).toBeGreaterThan(20);
    expect(reactionOf('SW-R-VEI', topicsOf('SW-R-VEI').loves[0])).toBe('love');
    expect(reactionOf('SW-R-VEI', topicsOf('SW-R-VEI').loathes)).toBe('loathe');
  });

  it('a good camp beats no camp, and Morale buys a blessing', () => {
    const best = bestTalks(PARTY);
    expect(best.talks).toHaveLength(2);
    expect(best.morale).toBeGreaterThan(MORALE_BASE);
    expect(moraleOf(PARTY, [])).toBe(MORALE_BASE);
    expect(moraleBuff(undefined).atkPct).toBe(0);
    expect(moraleBuff(49).atkPct).toBe(0);
    expect(moraleBuff(50).atkPct).toBeGreaterThan(0);
    expect(moraleBuff(95).atkPct).toBeGreaterThan(moraleBuff(75).atkPct);
  });

  it('Morale blesses every fight of the descent and adds bond', () => {
    const s = newSave();
    for (const id of PARTY) s.owned[id] = { level: 10, vow: 0 };
    const run = startRun(s, PARTY);
    const plain = skirmish(s, PARTY, 'ossuary-1');
    run.morale = 95;
    const before = bondOf(s, PARTY[0]).xp;
    makeCamp(s, run, [{ speaker: PARTY[0], topic: topicsOf(PARTY[0]).loves[0] }, { speaker: PARTY[1], topic: topicsOf(PARTY[1]).loves[0] }]);
    expect(bondOf(s, PARTY[0]).xp).toBeGreaterThan(before);
    run.morale = 95;
    const { makeBattle } = await_import();
    const blessed = makeBattle(s, run, 'ossuary-1');
    const a = plain.units.find((u) => u.uid === PARTY[0])!;
    const b = blessed.units.find((u) => u.uid === PARTY[0])!;
    expect(b.atk).toBeGreaterThan(a.atk);
    expect(b.zeal ?? 0).toBeGreaterThan(a.zeal ?? 0);
  });
});

import * as crusade from './crusade';
const await_import = () => crusade;
