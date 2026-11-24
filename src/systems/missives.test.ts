import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { KEEP_DAYS, NEWS, claimAllLetters, claimLetter, letters, missivesReady, missivesWaiting, send } from './missives';
import { STEPS_PER_TIER, passOf, seasonAt } from './pass';
import { FEAST_MARKS, feastOf } from './feast';
import { limitedWindow } from './limited';

const T0 = new Date(2026, 10, 24, 12).getTime();
const DAY = 864e5;

describe('Missives', () => {
  it('delivers each news letter once, and its gift once', () => {
    const save = newSave();
    expect(letters(save, T0)).toHaveLength(NEWS.length);
    expect(letters(save, T0 + DAY)).toHaveLength(NEWS.length);
    const seals = save.seals;
    claimAllLetters(save, T0);
    expect(save.seals).toBe(seals + (NEWS[0].reward?.seals ?? 0));
    expect(claimAllLetters(save, T0)).toHaveLength(0);
    expect(missivesReady(save, T0)).toBe(false);
  });

  it('claims one letter, and an unclaimed gift crumbles after 30 days', () => {
    const save = newSave();
    claimAllLetters(save, T0);
    const a = send(save, { from: 'Test', title: 'A', body: '', reward: { tithes: 100 } }, T0);
    send(save, { from: 'Test', title: 'B', body: '', reward: { tithes: 50 } }, T0);
    expect(missivesWaiting(save, T0)).toBe(2);
    const t = save.tithes;
    expect(claimLetter(save, a.id, T0)?.tithes).toBe(100);
    expect(save.tithes).toBe(t + 100);
    expect(claimLetter(save, a.id, T0)).toBeUndefined();
    // B is never claimed: gone after KEEP_DAYS, and so is the read letter A
    expect(letters(save, T0 + (KEEP_DAYS + 1) * DAY).map((l) => l.title)).not.toContain('B');
    expect(letters(save, T0 + (KEEP_DAYS + 1) * DAY).map((l) => l.title)).not.toContain('A');
  });

  it("mails a season's unclaimed Pass tiers when it turns", () => {
    const save = newSave();
    claimAllLetters(save, T0);
    passOf(save, T0).steps = 5 * STEPS_PER_TIER;
    passOf(save, seasonAt(T0).ends + DAY);
    const l = letters(save, seasonAt(T0).ends + DAY).find((x) => x.from === "The Pilgrim's Pass");
    expect(l?.reward?.seals).toBeGreaterThan(0);
  });

  it("mails a Feast's unclaimed milestones, Favor for that Feast's Saint", () => {
    const save = newSave();
    claimAllLetters(save, T0);
    const w = limitedWindow(T0);
    feastOf(save, T0).earned = FEAST_MARKS[1].at;
    feastOf(save, w.ends + DAY);
    const l = letters(save, w.ends + DAY).find((x) => x.title === 'The Feast is over!');
    expect(l?.reward?.favor?.id).toBe(w.saint.id);
    claimLetter(save, l!.id, w.ends + DAY);
    expect(save.shards?.[w.saint.id]).toBe(FEAST_MARKS[1].reward.favor);
  });
});
