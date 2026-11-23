import { describe, expect, it } from 'vitest';
import { ENCOUNTERS } from '../data/enemies';
import { newSave } from '../state/save';
import { TOTAL_STAGES, campaignOf } from './campaign';
import { HARD_MODES, finishHardStage, hardBattle, hardChest, hardNext, hardOf, hardOpen, hardStageDef, hardTarget } from './hardRoad';
import { recommendedPower } from './power';

describe('Penitent and Damned roads', () => {
  it('every stage has real foes and asks close to its target, climbing', () => {
    const save = newSave();
    for (const mode of HARD_MODES) {
      let prev = 0;
      for (let n = 1; n <= TOTAL_STAGES; n++) {
        const s = hardStageDef(mode, n);
        expect(ENCOUNTERS[s.encounter], `${mode} ${n} ${s.encounter}`).toBeDefined();
        const rec = recommendedPower(hardBattle(save, mode, [], n));
        expect(Math.abs(rec - hardTarget(mode, n)) / hardTarget(mode, n), `${mode} ${n}`).toBeLessThan(0.05);
        if (!s.boss && n > 1 && !hardStageDef(mode, n - 1).boss) expect(rec).toBeGreaterThan(prev * 0.97);
        prev = rec;
      }
    }
    // Damned starts above where Penitent ends.
    expect(hardTarget('damned', 1)).toBeGreaterThan(hardTarget('penitent', TOTAL_STAGES));
  });

  it('Penitent opens after the Road; Damned after Penitent', () => {
    const save = newSave();
    expect(hardOpen(save, 'penitent')).toBe(false);
    campaignOf(save).best = TOTAL_STAGES;
    expect(hardOpen(save, 'penitent')).toBe(true);
    expect(hardOpen(save, 'damned')).toBe(false);
    hardOf(save, 'penitent').best = TOTAL_STAGES;
    expect(hardOpen(save, 'damned')).toBe(true);
  });

  it('first clears pay once, in order; chests on every tenth; the vow pays once', () => {
    const save = newSave();
    const seals = save.seals;
    expect(finishHardStage(save, 'penitent', 2, 'victory', 0).first).toBe(false);
    const r = finishHardStage(save, 'penitent', 1, 'victory', 1);
    expect(r.first && !!r.reward && !r.vow).toBe(true);
    expect(hardNext(save, 'penitent')).toBe(2);
    expect(finishHardStage(save, 'penitent', 1, 'victory', 0).vow).toBeDefined();
    expect(finishHardStage(save, 'penitent', 1, 'victory', 0).vow).toBeUndefined();
    for (let n = 2; n <= 10; n++) {
      const x = finishHardStage(save, 'penitent', n, 'victory', 1);
      expect(!!x.chest).toBe(n === 10);
    }
    expect(save.seals).toBeGreaterThan(seals);
    expect(save.items?.canon1 ?? 0).toBeGreaterThan(0);
    expect(hardChest('damned', 4).seals).toBeGreaterThanOrEqual(10);
  });
});
