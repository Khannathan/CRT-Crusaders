import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { CRUSADERS } from '../data/crusaders';
import { bondOf } from './bonds';
import { KEEPER_BOND, blessingReady, chooseKeeper, keeperLines, keeperOf, visitKeeper } from './keeper';

const DAY = 864e5;
const t0 = new Date(2026, 10, 18, 10).getTime();

describe('the Keeper of the Sanctum', () => {
  it('defaults to the strongest Sister, keeps the one chosen', () => {
    const save = newSave();
    expect(keeperOf(save)).toBeUndefined();
    const [a, b] = CRUSADERS;
    save.owned[a.id] = { level: 1, vow: 0 };
    save.owned[b.id] = { level: 30, vow: 0 };
    expect(keeperOf(save)?.id).toBe(b.id);
    expect(chooseKeeper(save, a.id)).toBe(true);
    expect(keeperOf(save)?.id).toBe(a.id);
    expect(chooseKeeper(save, CRUSADERS[5].id)).toBe(false);
  });

  it('the first word each day adds bond, once', () => {
    const save = newSave();
    const c = CRUSADERS[0];
    save.owned[c.id] = { level: 1, vow: 0 };
    expect(blessingReady(save, t0)).toBe(true);
    expect(visitKeeper(save, t0)).toBe(KEEPER_BOND);
    expect(visitKeeper(save, t0 + 3600e3)).toBe(0);
    expect(bondOf(save, c.id).xp).toBe(KEEPER_BOND);
    expect(visitKeeper(save, t0 + DAY)).toBe(KEEPER_BOND);
  });

  it('speaks of what waits first, then the hour and her Order', () => {
    const save = newSave();
    const c = CRUSADERS[0];
    save.owned[c.id] = { level: 1, vow: 0 };
    const lines = keeperLines(save, c, { deeds: true }, t0);
    expect(lines[0]).toMatch(/deeds/i);
    expect(lines.length).toBeGreaterThanOrEqual(6);
  });
});
