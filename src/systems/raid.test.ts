import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { newSave } from '../state/save';
import { BOSS_REWARD, RAID_BOSSES, beginDelve, delveBattle, delvesLeft, finishDelve, raidBlock, raidCrypts, raidOf, setSquad } from './raid';
import { seeded } from './rng';

const NOW = new Date(2026, 10, 23, 12).getTime();
const IDS = CRUSADERS.slice(0, 12).map((c) => c.id);

function save() {
  const s = newSave();
  for (const id of IDS) s.owned[id] = { level: 40, vow: 0 };
  for (let i = 0; i < 3; i++) setSquad(s, i, IDS.slice(i * 4, i * 4 + 4), NOW);
  return s;
}

describe('the Nightmare Raid', () => {
  it('three different bosses a week; a Sister sits in one Squad only', () => {
    expect(new Set(raidCrypts(NOW).map((c) => c.id)).size).toBe(RAID_BOSSES);
    const s = save();
    setSquad(s, 2, [IDS[0], IDS[9]], NOW);
    const r = raidOf(s, NOW);
    expect(r.squads[0]).not.toContain(IDS[0]);
    expect(r.squads[2]).toEqual([IDS[0], IDS[9]]);
  });

  it('a fallen Squad hands the wounded boss to the next', () => {
    const s = save();
    beginDelve(s, NOW);
    expect(delvesLeft(s, NOW)).toBe(0);
    const b = delveBattle(s, seeded(1), NOW)!;
    const boss = b.units.find((u) => u.boss)!;
    boss.hp = Math.round(boss.maxHp * 0.4);
    const step = finishDelve(s, 'defeat', b, NOW);
    expect(step.over).toBe(false);
    expect(raidOf(s, NOW).delve!.squad).toBe(1);
    const b2 = delveBattle(s, seeded(2), NOW)!;
    const boss2 = b2.units.find((u) => u.boss)!;
    expect(boss2.hp / boss2.maxHp).toBeCloseTo(0.4, 1);
    expect(b2.units.filter((u) => u.side === 'party').map((u) => u.uid)).toEqual(IDS.slice(4, 8));
  });

  it('a slain boss pays and the Squad goes on; all three fall and the delve ends', () => {
    const s = save();
    beginDelve(s, NOW);
    const t = s.tithes;
    for (let i = 0; i < RAID_BOSSES; i++) {
      const b = delveBattle(s, seeded(i), NOW)!;
      const st = finishDelve(s, 'victory', b, NOW);
      expect(st.slain).toBe(true);
      expect(st.over).toBe(i === RAID_BOSSES - 1);
    }
    expect(s.tithes - t).toBe(BOSS_REWARD.reduce((n, r) => n + r.tithes, 0));
    expect(raidOf(s, NOW).best).toBe(3);
    expect(raidOf(s, NOW).cleared).toBe(true);
    expect(raidBlock(s, NOW)).toBe('One delve a day');
    expect(raidBlock(s, NOW + 864e5)).toBeUndefined();
  });

  it('every Squad falling ends the delve', () => {
    const s = save();
    beginDelve(s, NOW);
    let st;
    for (let i = 0; i < 3; i++) st = finishDelve(s, 'defeat', delveBattle(s, seeded(i), NOW)!, NOW);
    expect(st!.over).toBe(true);
    expect(raidOf(s, NOW).delve).toBeUndefined();
  });
});
