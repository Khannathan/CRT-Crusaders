import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { BLESSING, RANK_PACKS, blessingBlock, blessingReady, buyBlessing, buyPack, claimBlessing, packBlock } from './packs';
import { rankOf, rankStep } from './rank';
import { COST_TEN, DISCOUNT_TEN, canPull, pull, tenCost } from './gacha';
import { checkReturn, homecomingLeft, welcomeGift } from './welcome';
import { boostsToday, setBoostsEnabled, setHomecoming } from './boosts';
import { letters } from './missives';

const T0 = new Date(2026, 10, 24, 12).getTime();
const DAY = 864e5;
const xpFor = (rank: number) => Array.from({ length: rank - 1 }, (_, i) => rankStep(i + 1)).reduce((a, b) => a + b, 0);

describe('Rank packs', () => {
  it('open at their Rank, cost Gilt, and sell once', () => {
    const s = newSave();
    s.gilt = 10000;
    const p = RANK_PACKS[1];
    rankOf(s).xp = xpFor(p.rank - 1);
    expect(packBlock(s, p)).toMatch(/Rank/);
    rankOf(s).xp = xpFor(p.rank);
    const seals = s.seals;
    expect(buyPack(s, p.id, T0)).toBeDefined();
    expect(s.seals).toBe(seals + (p.goods.seals ?? 0));
    expect(s.gilt).toBe(10000 - p.price);
    expect(buyPack(s, p.id, T0)).toBeUndefined();
  });
});

describe("the Abbess's Blessing", () => {
  it('pays once a day for its days, and can be renewed near its end', () => {
    const s = newSave();
    s.gilt = 5000;
    expect(buyBlessing(s, T0)).toBe(true);
    expect(blessingReady(s, T0)).toBe(false); // the first day is claimed on purchase
    expect(blessingBlock(s, T0)).toBe('Already blessed');
    const seals = s.seals;
    expect(claimBlessing(s, T0 + DAY)).toBeDefined();
    expect(claimBlessing(s, T0 + DAY)).toBeUndefined();
    expect(s.seals).toBe(seals + (BLESSING.daily.seals ?? 0));
    expect(blessingReady(s, T0 + (BLESSING.days + 1) * DAY)).toBe(false);
    expect(blessingBlock(s, T0 + (BLESSING.days - 2) * DAY)).toBeUndefined();
  });
});

describe('the weekly discounted 10-pull', () => {
  it('costs less once a week, after the free first one', () => {
    const s = newSave();
    s.seals = 100;
    expect(tenCost(s, T0)).toBe(0);
    pull(s, 'ten', () => 0.5);
    expect(tenCost(s)).toBe(DISCOUNT_TEN);
    pull(s, 'ten', () => 0.5);
    expect(s.seals).toBe(100 - DISCOUNT_TEN);
    expect(tenCost(s)).toBe(COST_TEN);
    s.seals = DISCOUNT_TEN;
    expect(canPull(s, 'ten')).toBe(false);
  });
});

describe('welcome back', () => {
  it('sends a gift and starts a Homecoming week after 3 days away', () => {
    const s = newSave();
    s.owned['IV-R-EXE'] = { level: 1, vow: 0 };
    expect(checkReturn(s, T0)).toBeUndefined();
    expect(checkReturn(s, T0 + 2 * DAY)).toBeUndefined();
    expect(checkReturn(s, T0 + 7 * DAY)).toBe(5);
    expect(homecomingLeft(s, T0 + 7 * DAY)).toBe(7 * DAY);
    const gift = letters(s, T0 + 7 * DAY).find((l) => l.title.startsWith('Welcome home'));
    expect(gift?.reward?.seals).toBe(welcomeGift(5).seals);
    expect(welcomeGift(60).seals).toBe(10);
  });

  it('adds the Homecoming boosts to the day', () => {
    setBoostsEnabled(true);
    setHomecoming(T0 + DAY);
    expect(boostsToday(T0).some((b) => b.kind === 'vigil' && b.pct === 1)).toBe(true);
    setHomecoming(0);
    setBoostsEnabled(false);
  });
});
