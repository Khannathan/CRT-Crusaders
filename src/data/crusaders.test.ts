import { describe, expect, it } from 'vitest';
import { CRUSADERS } from './crusaders';
import { membersOf } from '../systems/chapter';

describe('Sister names', () => {
  const first = (name: string) => name.split(' ')[0];

  it('every full name and every first name is unique', () => {
    const names = CRUSADERS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    const firsts = names.map(first);
    expect(firsts.filter((f, i) => firsts.indexOf(f) !== i)).toEqual([]);
  });

  it('surnames never double as first names', () => {
    const firsts = new Set(CRUSADERS.map((c) => first(c.name)));
    expect(CRUSADERS.map((c) => c.name.split(' ')[1]).filter((s) => firsts.has(s))).toEqual([]);
  });

  it('no Chapter member shares a first name with a Sister', () => {
    const firsts = new Set(CRUSADERS.map((c) => first(c.name)));
    for (const seed of [1, 7, 42, 2026]) {
      expect(membersOf(seed).map((m) => first(m.name)).filter((f) => firsts.has(f))).toEqual([]);
    }
  });
});

describe('Chapter log from before the rename', () => {
  it('drops lines naming the old members and keeps the rest', async () => {
    const { chapterOf } = await import('../systems/chapter');
    const { newSave } = await import('../state/save');
    const save = newSave();
    const now = Date.now();
    save.chapter = { name: 'x', seed: 1, xp: 0, marks: 0, simDay: '', day: '', strikes: 0, siege: { week: '', dealt: 0, by: {}, paid: [] }, bought: {}, log: [
      { day: 'd', text: 'Perpetua the Penitent gave a reliquary to the Chapter.' },
      { day: 'd', text: '9 Sisters struck the beast for 1,000. Scholastica of the Nails struck hardest (300).' },
      { day: 'd', text: 'You took your vows before the Chapter.' },
    ] };
    const log = chapterOf(save, now)!.log.map((l) => l.text);
    expect(log).toContain('You took your vows before the Chapter.');
    expect(log.some((l) => /Perpetua the|Scholastica of/.test(l))).toBe(false);
  });
});
