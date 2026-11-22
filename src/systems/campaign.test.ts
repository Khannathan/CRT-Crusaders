import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { CHAPTERS, STAGES_PER_CHAPTER, TOTAL_STAGES, campaignOf, chapterChest, finishStage, nextStage, stageDef, stageRecommended, stageReward, roadRates, bellBonus } from './campaign';
import { giltOf } from './currency';

describe("the Pilgrim's Road", () => {
  it('chapters of ten stages, the tenth a boss, the fifth an elite', () => {
    expect(TOTAL_STAGES).toBe(CHAPTERS.length * STAGES_PER_CHAPTER);
    for (let n = 1; n <= TOTAL_STAGES; n++) {
      const s = stageDef(n);
      expect(s.boss).toBe(n % 10 === 0);
      expect(s.elite).toBe(n % 10 === 5);
      if (s.boss) expect(s.encounter).toBe(CHAPTERS[s.chapter].crypt.boss);
    }
    expect(stageDef(17).label).toBe('2-7');
  });

  it('asks for more Power stage by stage', () => {
    const save = newSave();
    let last = 0;
    for (let n = 1; n < TOTAL_STAGES; n++) {
      if (stageDef(n).boss) continue;
      const rec = stageRecommended(save, n);
      expect(rec).toBeGreaterThanOrEqual(last);
      last = rec;
    }
  });

  it('first clears pay once, in order; a boss opens its chapter chest', () => {
    const save = newSave();
    expect(finishStage(save, 2, 'victory').first).toBe(false); // must go in order
    const t0 = save.tithes;
    const r = finishStage(save, 1, 'victory');
    expect(r.first).toBe(true);
    expect(save.tithes).toBe(t0 + stageReward(1).tithes);
    expect(finishStage(save, 1, 'victory').first).toBe(false); // no second payout
    expect(finishStage(save, 2, 'defeat').won).toBe(false);
    for (let n = 2; n <= 9; n++) finishStage(save, n, 'victory');
    const g0 = giltOf(save);
    const s0 = save.seals;
    const boss = finishStage(save, 10, 'victory');
    expect(boss.chest).toEqual(chapterChest(0));
    expect(giltOf(save)).toBe(g0 + chapterChest(0).gilt);
    expect(save.seals).toBe(s0 + chapterChest(0).seals);
    expect(campaignOf(save).best).toBe(10);
    expect(nextStage(save)).toBe(11);
  });
});

describe('Bell Tower Vigil bonus', () => {
  it('each Tower floor cleared adds 1% to Vigil Tithes, gear and materials, but not Seals', () => {
    const save = newSave();
    const plain = roadRates(save);
    save.tower = { best: 80 };
    expect(bellBonus(save)).toBeCloseTo(1.8);
    const r = roadRates(save);
    expect(r.tithes / plain.tithes).toBeCloseTo(1.8);
    expect(r.gear / plain.gear).toBeCloseTo(1.8);
    expect(r.items / plain.items).toBeCloseTo(1.8);
    expect(r.seals).toBe(plain.seals);
  });
});
