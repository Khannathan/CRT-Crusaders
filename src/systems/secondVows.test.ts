import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { CLASSES } from '../data/classes';
import { newSave } from '../state/save';
import { VOW_STAT, canonEffect } from './canon';
import { hardOf } from './hardRoad';
import { SECOND_TITLE, VOW_HOLD, VOW_PENITENT, VOW_SEALS, VOW_TITHES, takeSecondVows, tookVows, vowBlock, vowTrials } from './secondVows';
import { sisterStats } from './stats';
import { skirmish } from './crusade';

const ID = 'CC-W090';

function ready() {
  const s = newSave();
  s.owned[ID] = { level: 50, vow: 0, canon: { rank: 10, traits: [] } };
  hardOf(s, 'penitent').best = VOW_PENITENT;
  s.holdLine = { day: 'x', used: 0, best: 5, today: 0, withHer: { [ID]: VOW_HOLD } };
  s.items = { canon3: VOW_SEALS };
  s.tithes = VOW_TITHES;
  return s;
}

describe('Second Vows', () => {
  it('every class has an advanced title', () => {
    for (const id of Object.keys(CLASSES)) expect(SECOND_TITLE[id]).toBeTruthy();
  });

  it('four trials gate it; each one missing blocks', () => {
    const s = ready();
    expect(vowTrials(s, ID).every((t) => t.done)).toBe(true);
    expect(vowBlock(s, ID)).toBeUndefined();
    s.owned[ID].canon!.rank = 9;
    expect(vowBlock(s, ID)).toBe('1 trial left');
    s.owned[ID].canon!.rank = 10;
    s.holdLine!.withHer![ID] = 4;
    expect(vowBlock(s, ID)).toBe('1 trial left');
  });

  it('taking them spends the offering and lifts her for good', () => {
    const s = ready();
    const c = CRUSADERS.find((x) => x.id === ID)!;
    const before = sisterStats(s, c);
    expect(takeSecondVows(s, ID)).toBe(true);
    expect(tookVows(s.owned[ID])).toBe(true);
    expect(s.items!.canon3).toBe(0);
    expect(s.tithes).toBe(0);
    expect(sisterStats(s, c).atk).toBeGreaterThan(before.atk);
    expect(canonEffect(s.owned[ID]).statMult).toBeCloseTo(1 + 0.015 * 10 + VOW_STAT);
    expect(takeSecondVows(s, ID)).toBe(false);
    const u = skirmish(s, [ID], 'ossuary-1').units.find((x) => x.side === 'party')!;
    expect(u.exalted).toBe(true);
    expect(u.zeal).toBeGreaterThan(0);
  });
});
