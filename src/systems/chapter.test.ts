import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { CRUSADERS } from '../data/crusaders';
import { autoBattle } from './autoplay';
import { seeded } from './rng';
import { sisterStats } from './stats';
import {
  CHAPTER_PERK,
  CHAPTER_SHOP,
  MEMBERS,
  SIEGE_STRIKES,
  buyChapter,
  chapterLevel,
  chapterOf,
  chapterXpFor,
  claimSiege,
  finishSiege,
  foundChapter,
  membersOf,
  siegeBattle,
  siegeBeast,
  siegeReady,
  strikesLeft,
  tithe,
} from './chapter';

const D = (d: number, h = 10) => new Date(2026, 10, 16 + d, h).getTime(); // Monday 16 Nov 2026

describe('the Chapter (offline guild)', () => {
  it('has the same AI members for a seed, and simulates their days', () => {
    expect(membersOf(7)).toEqual(membersOf(7));
    expect(membersOf(7).length).toBe(MEMBERS);
    const save = newSave();
    const c = foundChapter(save, D(0), 7);
    const day0 = c.siege.dealt;
    expect(day0).toBeGreaterThan(0);
    chapterOf(save, D(3));
    expect(c.siege.dealt).toBeGreaterThan(day0);
    // nothing changes within the same day
    const d3 = c.siege.dealt;
    chapterOf(save, D(3, 20));
    expect(c.siege.dealt).toBe(d3);
  });

  it('tithes once a day for XP and Marks; levels lift every Sister', () => {
    const save = newSave();
    foundChapter(save, D(0), 3);
    save.tithes = 1e5;
    const c = save.chapter!;
    const xp = c.xp;
    expect(tithe(save, 0, D(0))).toBe(true);
    expect(tithe(save, 0, D(0))).toBe(false);
    expect(c.xp).toBe(xp + 20);
    expect(c.marks).toBe(20);
    expect(tithe(save, 0, D(1))).toBe(true);
    const sister = CRUSADERS[0];
    save.owned[sister.id] = { level: 10, vow: 0 };
    const before = sisterStats(save, sister).atk;
    c.xp = chapterXpFor(1) + chapterXpFor(2);
    expect(chapterLevel(c.xp)).toBe(3);
    expect(sisterStats(save, sister).atk).toBeGreaterThanOrEqual(Math.floor(before * (1 + 2 * CHAPTER_PERK)));
  });

  it('strikes the Siege twice a day, and the whole Chapter reaches milestones', () => {
    const save = newSave();
    const party = CRUSADERS.slice(0, 4).map((c) => c.id);
    for (const id of party) save.owned[id] = { level: 30, vow: 3 };
    foundChapter(save, D(0), 11);
    expect(strikesLeft(save, D(0))).toBe(SIEGE_STRIKES);
    const b = siegeBattle(save, party, seeded(1), D(0));
    autoBattle(b, 600);
    const dmg = finishSiege(save, b, D(0));
    expect(dmg).toBeGreaterThan(0);
    expect(save.chapter!.siege.by.you).toBe(dmg);
    finishSiege(save, b, D(0));
    expect(finishSiege(save, b, D(0))).toBe(0);
    expect(strikesLeft(save, D(1))).toBe(SIEGE_STRIKES);
    // A week of the members alone passes the first milestones.
    chapterOf(save, D(6));
    expect(siegeReady(save, D(6)).length).toBeGreaterThan(0);
    const paid = claimSiege(save, D(6));
    expect(paid.length).toBeGreaterThan(0);
    expect(save.chapter!.marks).toBeGreaterThan(0);
    // A new week brings a new beast and clears the shop.
    save.chapter!.marks = 1000;
    expect(buyChapter(save, CHAPTER_SHOP[0].id, D(6))).toBe(true);
    chapterOf(save, D(8));
    expect(save.chapter!.siege.week).not.toBe('2026-11-16');
    expect(save.chapter!.bought).toEqual({});
    expect(siegeBeast(save, D(8)).hunt.id).not.toBe(siegeBeast(save, D(0)).hunt.id);
  });
});
