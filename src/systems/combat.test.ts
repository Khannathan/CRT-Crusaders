import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { CLASS_SKILLS } from '../data/skills';
import { newSave } from '../state/save';
import { autoBattle } from './autoplay';
import { Battle, ZEAL_MAX, makeEnemy, type Unit } from './combat';
import { OSSUARY, absorbBattle, currentRoom, finishRun, makeBattle, shrine, startRun, winRoom } from './crusade';

function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const crusader = (uid: string, classId: string, rank: number, extra: Partial<Unit> = {}): Unit => ({
  uid, side: 'party', name: uid, ref: uid, classId, rank, maxHp: 100, hp: 100, atk: 20, def: 0, spd: 10, status: {}, ...extra,
});

/** All-R level-1 party, the weakest a new player could field. */
const STARTER = ['CC-W013', 'CC-W052', 'CC-W001', 'CC-W022'];

function saveWith(ids: string[], level = 1) {
  const s = newSave();
  for (const id of ids) s.owned[id] = { level, vow: 0 };
  return s;
}

/** Plays a whole crypt with the auto player, taking the shrine in the middle. */
function playCrypt(rngSeed: number, level = 1) {
  const save = saveWith(STARTER, level);
  const rng = seeded(rngSeed);
  const run = startRun(save, STARTER);
  while (currentRoom(run)) {
    const room = currentRoom(run)!;
    if (room.kind === 'choice') {
      shrine(save, run);
      continue;
    }
    const b = makeBattle(save, run, room.encounter, rng);
    const res = autoBattle(b);
    absorbBattle(run, b);
    if (res !== 'victory') return { save, run, result: finishRun(save, run, 'defeat') };
    winRoom(run);
  }
  return { save, run, result: finishRun(save, run, 'victory') };
}

describe('combat', () => {
  it('rank and reach limit who can be hit', () => {
    const inq = crusader('inq', 'inquisitor', 1);
    const b = new Battle([inq], ['husk', 'acolyte', 'ringer'].map((t, i) => makeEnemy(t, `e${i}`, i + 1)));
    const thrust = CLASS_SKILLS.inquisitor[1];
    expect(b.validTargets(inq, thrust).map((u) => u.rank)).toEqual([1, 2, 3]);
    inq.rank = 3;
    expect(b.canUse(inq, thrust)).toBe(false);
  });

  it('taunt forces enemies onto the taunter', () => {
    const a = crusader('a', 'hierophant', 1, { status: { taunt: 2 } });
    const c = crusader('c', 'oracle', 2);
    const b = new Battle([a, c], [makeEnemy('wraith', 'e0', 1)], { rng: seeded(1) });
    for (let i = 0; i < 20; i++) expect(b.enemyChoose(b.get('e0')).target?.uid).toBe('a');
  });

  it('accused targets take more damage', () => {
    const run = (accused: boolean) => {
      const inq = crusader('inq', 'inquisitor', 1);
      const e = makeEnemy('husk', 'e0', 1);
      if (accused) e.status.accused = 2;
      const b = new Battle([inq], [e], { rng: () => 0.5 });
      b.act(inq, CLASS_SKILLS.inquisitor[1], e);
      return e.maxHp - e.hp;
    };
    expect(run(true)).toBeGreaterThan(run(false) * 1.5);
  });

  it('shields absorb damage and the Rite spends all Zeal', () => {
    const h = crusader('h', 'hierophant', 1);
    const b = new Battle([h], [makeEnemy('husk', 'e0', 1)], { rng: () => 0.5, zeal: ZEAL_MAX });
    b.act(h, CLASS_SKILLS.hierophant[2]);
    expect(h.status.shield).toBe(35);
    expect(b.zeal).toBe(0);
    b.act(b.get('e0'), ENEMIES.husk.skills[0], h);
    expect(h.hp).toBe(100);
  });

  it('dead units close ranks and the fight ends', () => {
    const w = crusader('w', 'warsister', 1, { atk: 999 });
    const b = new Battle([w], [makeEnemy('ringer', 'e0', 1), makeEnemy('wraith', 'e1', 2)], { rng: () => 0.5 });
    b.act(w, CLASS_SKILLS.warsister[0], b.get('e0'));
    expect(b.get('e1').rank).toBe(1);
    b.act(w, CLASS_SKILLS.warsister[0], b.get('e1'));
    expect(b.outcome()).toBe('victory');
  });

  it('the Vigil candle burns down, then enemies grow stronger', () => {
    const w = crusader('w', 'hierophant', 1, { maxHp: 1e6, hp: 1e6, atk: 0 });
    const b = new Battle([w], [makeEnemy('husk', 'e0', 1)], { rng: () => 0.5, vigil: 2 });
    for (let i = 0; i < 12; i++) b.nextTurn();
    expect(b.vigil).toBe(0);
    expect(b.rage).toBeGreaterThan(0);
  });
});

describe('crusade balance (auto player)', () => {
  it('a fresh all-R level-1 party clears the crypt sometimes, but not always', () => {
    let wins = 0;
    const N = 300;
    for (let i = 0; i < N; i++) if (playCrypt(i + 1).result.outcome === 'victory') wins++;
    const rate = wins / N;
    console.log(`level 1 win rate: ${(rate * 100).toFixed(1)}%`);
    expect(rate).toBeGreaterThan(0.3);
    expect(rate).toBeLessThan(0.9);
  });

  it('levelling up makes the crypt clearly easier', () => {
    let wins = 0;
    const N = 300;
    for (let i = 0; i < N; i++) if (playCrypt(i + 1, 6).result.outcome === 'victory') wins++;
    console.log(`level 6 win rate: ${((wins / N) * 100).toFixed(1)}%`);
    expect(wins / N).toBeGreaterThan(0.85);
  });

  it('pays out and marks the fallen as recovering', () => {
    const { save, result } = playCrypt(7);
    if (result.outcome === 'victory') {
      expect(result.seals).toBeGreaterThanOrEqual(3 + 5 + 2);
      expect(save.cleared).toContain(OSSUARY.id);
    }
    for (const id of result.fallen) expect(save.owned[id].recovering).toBe(1);
  });
});
