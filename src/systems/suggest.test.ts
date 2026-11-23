import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { CRUSADERS } from '../data/crusaders';
import { CLASSES } from '../data/classes';
import { suggestParty } from './crusade';
import { sisterPowerById } from './power';

const roleOf = (id: string) => CLASSES[CRUSADERS.find((c) => c.id === id)!.classId].role;

describe('suggestParty', () => {
  it('keeps a Tank and a Healer, then fields the strongest Sisters by Power', () => {
    const s = newSave();
    for (const c of CRUSADERS.slice(0, 30)) s.owned[c.id] = { level: 1 + (c.id.charCodeAt(5) % 7), vow: 0 } as never;
    const party = suggestParty(s);
    expect(party).toHaveLength(4);
    expect(party.some((id) => roleOf(id) === 'Tank')).toBe(true);
    expect(party.some((id) => roleOf(id) === 'Healer')).toBe(true);
    // the two free picks are the strongest Sisters left
    const forced = new Set(party.filter((id) => ['Tank', 'Healer'].includes(roleOf(id))));
    const rest = Object.keys(s.owned).filter((id) => !party.includes(id));
    const weakestFree = Math.min(...party.filter((id) => !forced.has(id) || forced.size > 2).map((id) => sisterPowerById(s, id)));
    for (const id of rest) if (!['Tank', 'Healer'].includes(roleOf(id))) expect(sisterPowerById(s, id)).toBeLessThanOrEqual(weakestFree);
  });
});
