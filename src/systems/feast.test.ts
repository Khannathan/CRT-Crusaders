import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { ALMS_PER_CANDLE, FEAST_MARKS, FEAST_REPEATS, FEAST_STAGES, FEAST_STALL, addCandles, buy, claimMarks, feastOf, featuredBonus, finishStage, stageOpen, stockLeft, sweepStage } from './feast';
import { LIMITED_DAYS, limitedWindow } from './limited';
import { track } from './tasks';

const NOW = new Date(2026, 10, 22, 12).getTime();
const DAY = 864e5;

describe('the Feast', () => {
  it('pays a first win once, then a few repeats a day', () => {
    const save = newSave();
    expect(stageOpen(save, 1)).toBe(false);
    expect(finishStage(save, 0, [], true, NOW)).toBe(FEAST_STAGES[0].first);
    expect(stageOpen(save, 1)).toBe(true);
    expect(finishStage(save, 0, [], false, NOW)).toBe(0);
    for (let i = 0; i < FEAST_REPEATS; i++) expect(sweepStage(save, 0, NOW)).toBe(FEAST_STAGES[0].repeat);
    expect(sweepStage(save, 0, NOW)).toBe(0);
    expect(finishStage(save, 0, [], true, NOW)).toBe(0);
    // A new day brings the repeats back.
    expect(sweepStage(save, 0, NOW + DAY)).toBe(FEAST_STAGES[0].repeat);
  });

  it('bonus Sisters add Candles, up to the cap', () => {
    const w = limitedWindow(NOW);
    expect(featuredBonus([w.saint.id, w.ssrs[0].id], NOW)).toBeCloseTo(0.5);
    expect(featuredBonus(['CC-W001'], NOW)).toBe(w.saint.order === 'Iron Vigil' ? 0.25 : 0);
    const save = newSave();
    expect(finishStage(save, 0, [w.saint.id, w.ssrs[0].id], true, NOW)).toBe(Math.round(FEAST_STAGES[0].first * 1.5));
  });

  it('ordinary play trickles in Candles', () => {
    const save = newSave();
    track(save, 'dailyDone', 1, NOW);
    expect(feastOf(save, NOW).candles).toBeGreaterThan(0);
  });

  it('milestones pay once, and the stall honours its stock', () => {
    const save = newSave();
    addCandles(save, FEAST_MARKS[1].at, NOW);
    const w = limitedWindow(NOW);
    const paid = claimMarks(save, NOW);
    expect(paid).toHaveLength(2);
    expect(save.shards?.[w.saint.id]).toBe(10);
    expect(claimMarks(save, NOW)).toHaveLength(0);
    const favor = FEAST_STALL.find((x) => x.id === 'favor')!;
    addCandles(save, favor.cost * (favor.stock + 1), NOW);
    for (let i = 0; i < favor.stock; i++) expect(buy(save, 'favor', NOW)).toBe(true);
    expect(buy(save, 'favor', NOW)).toBe(false);
    expect(stockLeft(save, favor, NOW)).toBe(0);
    expect(save.shards?.[w.saint.id]).toBe(10 + 10 * favor.stock);
  });

  it('a new Feast melts the old Candles into Alms', () => {
    const save = newSave();
    addCandles(save, 300, NOW);
    const alms = save.alms ?? 0;
    const f = feastOf(save, NOW + LIMITED_DAYS * DAY);
    expect(f.candles).toBe(0);
    expect(f.melted).toBe(300 * ALMS_PER_CANDLE);
    expect(save.alms).toBe(alms + 300 * ALMS_PER_CANDLE);
  });
});
