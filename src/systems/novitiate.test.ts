import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { track } from './tasks';
import { noviceTen } from './gacha';
import {
  NOVICE_COST,
  NOVICE_MARKS,
  NOVICE_TASKS,
  NOVICE_TENS,
  claimNoviceMark,
  claimNoviceTask,
  noviceChoices,
  noviceDay,
  noviceOpen,
  noviceReady,
  novitiateOf,
  taskClaimable,
} from './novitiate';

const DAY = 864e5;
const t0 = new Date(2026, 10, 18, 10).getTime();

describe('the Novitiate', () => {
  it('opens a day at a time and closes after 14 days', () => {
    const save = newSave();
    novitiateOf(save, t0);
    expect(noviceDay(save, t0)).toBe(1);
    expect(noviceDay(save, t0 + DAY)).toBe(2);
    expect(noviceOpen(save, t0 + 13 * DAY)).toBe(true);
    expect(noviceOpen(save, t0 + 14 * DAY)).toBe(false);
  });

  it('counts events from its start, and pays each task once', () => {
    const save = newSave();
    novitiateOf(save, t0);
    track(save, 'fightWon', 3, t0);
    const t = NOVICE_TASKS.find((x) => x.id === 'n1-fights')!;
    expect(taskClaimable(save, t, t0)).toBe(true);
    const seals = save.seals;
    expect(claimNoviceTask(save, t.id, t0)).toEqual(t.reward);
    expect(save.seals).toBe(seals + (t.reward.seals ?? 0));
    expect(claimNoviceTask(save, t.id, t0)).toBeUndefined();
  });

  it('holds a later day shut until it comes', () => {
    const save = newSave();
    novitiateOf(save, t0);
    track(save, 'fightWon', 20, t0);
    const t = NOVICE_TASKS.find((x) => x.id === 'n3-fights')!;
    expect(taskClaimable(save, t, t0 + DAY)).toBe(false);
    expect(taskClaimable(save, t, t0 + 2 * DAY)).toBe(true);
  });

  it('the last mark swears a chosen SSR', () => {
    const save = newSave();
    novitiateOf(save, t0);
    const st = novitiateOf(save, t0);
    st.claimed = NOVICE_TASKS.slice(0, 24).map((t) => t.id);
    const last = NOVICE_MARKS[NOVICE_MARKS.length - 1];
    expect(claimNoviceMark(save, last.at, undefined, t0)).toBeUndefined();
    const ssr = noviceChoices(t0)[0];
    expect(ssr.rarity).toBe('SSR');
    expect(claimNoviceMark(save, last.at, ssr.id, t0)).toBeDefined();
    expect(save.owned[ssr.id]).toBeDefined();
    expect(st.picked).toBe(ssr.id);
    expect(claimNoviceMark(save, last.at, ssr.id, t0)).toBeUndefined();
  });

  it('beginner banner: two discounted tens, each with an SSR or better', () => {
    const save = newSave();
    save.seals = 100;
    let r = 0.123;
    const rng = () => (r = (r * 9301 + 49297) % 233280 / 233280);
    for (let i = 0; i < NOVICE_TENS; i++) {
      const res = noviceTen(save, rng);
      expect(res).toHaveLength(10);
      expect(res.some((x) => x.crusader.rarity === 'SSR' || x.crusader.rarity === 'UR')).toBe(true);
    }
    expect(save.seals).toBe(100 - NOVICE_TENS * NOVICE_COST);
    expect(noviceTen(save, rng)).toHaveLength(0);
    expect(save.pullLog?.every((p) => p.banner === 'Novice')).toBe(true);
  });

  it('shows a dot while something waits', () => {
    const save = newSave();
    save.seals = 0;
    novitiateOf(save, t0);
    expect(noviceReady(save, t0)).toBe(false);
    track(save, 'pull', 1, t0);
    expect(noviceReady(save, t0)).toBe(true);
  });
});
