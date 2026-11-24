import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { KITS } from '../data/kits';
import { kitShape } from '../data/kitForge';

describe('Kit Forge', () => {
  it('no two Sisters share a kit', () => {
    const seen = new Map<string, string>();
    const clash: string[] = [];
    for (const c of CRUSADERS) {
      const s = kitShape(KITS[c.id]);
      if (seen.has(s)) clash.push(`${seen.get(s)} = ${c.id}`);
      seen.set(s, c.id);
    }
    expect(clash).toEqual([]);
  });

  it('every Sister has her own passive, a Relic and a battle cry', () => {
    const names = new Map<string, string>();
    for (const c of CRUSADERS) {
      const k = KITS[c.id];
      expect(c.passive, c.id).toBeDefined();
      expect(k.relic, c.id).toBeDefined();
      expect(k.cry, c.id).toBeTruthy();
      expect(k.look, c.id).toBeTruthy();
      if (k.generated) {
        expect(names.has(c.passive!.name), `${c.id} passive ${c.passive!.name} also ${names.get(c.passive!.name)}`).toBe(false);
        names.set(c.passive!.name, c.id);
      }
    }
  });

  it('cries are unique, R have a Command line and SSR an Ascension line', () => {
    const cries = new Set(CRUSADERS.map((c) => KITS[c.id].cry));
    expect(cries.size).toBe(CRUSADERS.length);
    for (const c of CRUSADERS) {
      if (c.rarity === 'R') expect(KITS[c.id].command, c.id).toBeTruthy();
      if (c.rarity === 'SSR' && !c.limited) expect(KITS[c.id].ascended, c.id).toBeTruthy();
    }
  });

  it('every Limited UR carries a Patron Miracle', () => {
    const lurs = CRUSADERS.filter((c) => c.rarity === 'UR' && c.limited);
    expect(lurs.length).toBe(10);
    for (const c of lurs) expect(KITS[c.id].sig?.patron, c.id).toBeDefined();
  });

  it('skill ids are unique within a kit and twisted skills have their own ids', () => {
    const byId = new Map<string, string>();
    for (const c of CRUSADERS) {
      const ids = KITS[c.id].skills.map((s) => s.id);
      expect(new Set(ids).size, c.id).toBe(4);
      for (const s of KITS[c.id].skills) {
        const shape = JSON.stringify({ ...s, desc: '', name: '' });
        const prev = byId.get(s.id);
        if (prev !== undefined) expect(prev, `${c.id} ${s.id}`).toBe(shape);
        byId.set(s.id, shape);
      }
    }
  });
});
