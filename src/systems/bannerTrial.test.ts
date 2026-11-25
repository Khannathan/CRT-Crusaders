import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { autoBattle } from './autoplay';
import { trialBattle, trialLoan, trialParty } from './bannerTrial';
import { syncBanner } from './gacha';
import { seeded } from './rng';

const NOW = new Date(2026, 10, 25, 12).getTime();

describe('banner trial', () => {
  it('lends the banner UR and her two SSRs beside your best Sister, and leaves your save alone', () => {
    const save = newSave();
    const mine = CRUSADERS.filter((c) => c.rarity === 'R').slice(0, 4).map((c) => c.id);
    for (const id of mine) save.owned[id] = { level: 5, vow: 0 };
    syncBanner(save, NOW);
    const loan = trialLoan(save, NOW);
    expect(loan).toHaveLength(3);
    expect(CRUSADERS.find((c) => c.id === loan[0])!.rarity).toBe('UR');
    const party = trialParty(save, NOW);
    expect(party.slice(0, 3)).toEqual(loan);
    expect(mine).toContain(party[3]);
    const owned = JSON.stringify(save.owned);
    const b = trialBattle(save, seeded(1), NOW);
    expect(b.units.filter((u) => u.side === 'party').map((u) => u.ref)).toEqual(party);
    expect(JSON.stringify(save.owned)).toBe(owned);
  });

  it('is a fight Auto usually wins', () => {
    const save = newSave();
    for (const c of CRUSADERS.filter((c) => c.rarity === 'R').slice(0, 4)) save.owned[c.id] = { level: 5, vow: 0 };
    syncBanner(save, NOW);
    let wins = 0;
    const N = 30;
    for (let i = 0; i < N; i++) {
      const b = trialBattle(save, seeded(100 + i), NOW);
      autoBattle(b, 600);
      if (b.outcome() === 'victory') wins++;
    }
    console.log(`[trial] Auto wins ${wins}/${N}`);
    expect(wins / N).toBeGreaterThan(0.5);
  });
});
