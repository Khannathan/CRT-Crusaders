import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { CRUSADERS } from '../data/crusaders';
import { sisterPower } from './power';
import { sisterStats } from './stats';
import { CODEX_COST, MAX_CODEX, codexBlock, codexLevel, orderIdOf, raiseCodex } from './codex';

describe('the Order Codex', () => {
  const c = CRUSADERS[0];
  const order = orderIdOf(c);

  it('needs a sworn Sister of the Order, Writs and Tithes', () => {
    const save = newSave();
    for (const id of Object.keys(save.owned)) delete save.owned[id];
    expect(order).not.toBe('');
    expect(codexBlock(save, order)).toMatch(/Swear/);
    save.owned[c.id] = { level: 1, vow: 0 };
    expect(codexBlock(save, order)).toMatch(/Writs/);
    save.items = { writ1: 3 };
    save.tithes = 300;
    expect(raiseCodex(save, order)).toBe(true);
    expect(codexLevel(save, order)).toBe(1);
    expect(save.tithes).toBe(0);
  });

  it('lifts only Sisters of that Order, up to level 10', () => {
    const save = newSave();
    const other = CRUSADERS.find((x) => orderIdOf(x) !== order)!;
    save.owned[c.id] = { level: 10, vow: 0 };
    save.owned[other.id] = { level: 10, vow: 0 };
    save.tithes = 1_000_000;
    save.items = { writ1: 99, writ2: 99, writ3: 99 };
    const mine = sisterStats(save, c);
    const theirs = sisterStats(save, other);
    const p0 = sisterPower(save, c);
    for (let i = 0; i < MAX_CODEX + 2; i++) raiseCodex(save, order);
    expect(codexLevel(save, order)).toBe(MAX_CODEX);
    expect(CODEX_COST.length).toBe(MAX_CODEX);
    expect(sisterStats(save, c).atk).toBeGreaterThan(mine.atk);
    expect(sisterStats(save, other)).toEqual(theirs);
    expect(sisterPower(save, c)).toBeGreaterThan(p0);
  });
});
