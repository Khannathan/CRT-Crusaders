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
