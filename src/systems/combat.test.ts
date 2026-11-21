import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { CLASS_SKILLS } from '../data/skills';
import { Battle, CRIT_MULT, ZEAL_HURT_CAP, ZEAL_MAX, damageAfterArmor, makeEnemy, type Unit } from './combat';

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
  uid, side: 'party', name: uid, ref: uid, classId, rank, maxHp: 100, hp: 100, atk: 20, armor: 0, crit: 0, spd: 10, status: {}, ...extra,
});

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

describe('enemy telegraphs', () => {
  it('every enemy shows its next move, and then does exactly that', () => {
    const a = crusader('a', 'hierophant', 1);
    const c = crusader('c', 'oracle', 2, { hp: 30 });
    const b = new Battle([a, c], [makeEnemy('hound', 'e0', 1)], { rng: seeded(3) });
    const view = b.intentOf(b.get('e0'))!;
    expect(view.kind).toBe('attack');
    expect(view.targets.map((u) => u.uid)).toEqual(['c']); // hounds go for the most hurt
    expect(view.estimate).toBeGreaterThan(0);
    expect(b.enemyChoose(b.get('e0')).target?.uid).toBe('c');
  });

  it('a taunt redirects a planned attack', () => {
    const a = crusader('a', 'hierophant', 1);
    const c = crusader('c', 'oracle', 2, { hp: 30 });
    const b = new Battle([a, c], [makeEnemy('hound', 'e0', 1)], { rng: seeded(3) });
    a.status.taunt = 2;
    expect(b.intentOf(b.get('e0'))!.targets.map((u) => u.uid)).toEqual(['a']);
    expect(b.enemyChoose(b.get('e0')).target?.uid).toBe('a');
  });

  it('the boss enters a second phase at half HP and re-plans', () => {
    const w = crusader('w', 'warsister', 1, { atk: 300 });
    const boss = makeEnemy('choir', 'e0', 1);
    boss.armor = 0;
    const b = new Battle([w], [boss], { rng: () => 0.5 });
    const atk = boss.atk;
    const ev = b.act(w, CLASS_SKILLS.warsister[0], boss);
    expect(ev.some((e) => e.type === 'phase')).toBe(true);
    expect(boss.phase).toBe(2);
    expect(boss.atk).toBeGreaterThan(atk);
    expect(ENEMIES.choir.phase2!.skills.map((s) => s.id)).toContain(boss.intent!.skillId);
  });

  it('a wind-up spends a turn charging, and Foresight breaks it', () => {
    const o = crusader('o', 'oracle', 1, { maxHp: 1000, hp: 1000 });
    const boss = makeEnemy('choir', 'e0', 1);
    boss.phase = 2;
    const b = new Battle([o], [boss], { rng: () => 0.5 });
    const requiem = ENEMIES.choir.phase2!.skills.find((s) => s.windup)!;
    b.act(boss, requiem);
    expect(boss.status.charging).toBe(true);
    expect(o.hp).toBe(1000);
    expect(b.intentOf(boss)!.charging).toBe(true);
    b.act(o, CLASS_SKILLS.oracle[1], boss);
    expect(boss.status.charging).toBe(false);
    expect(boss.intent!.skillId).not.toBe('requiem');
    // uninterrupted, the second turn lands the blow
    b.act(boss, requiem);
    b.act(boss, requiem);
    expect(o.hp).toBeLessThan(1000);
  });
});

describe('balance formulas', () => {
  it('armor divides damage: 100 armor halves a hit', () => {
    expect(damageAfterArmor(200, 0)).toBe(200);
    expect(damageAfterArmor(200, 100)).toBe(100);
    expect(damageAfterArmor(120 * 1.4, 80)).toBeCloseTo(93.33, 1);
  });

  it('crits multiply damage, and Glass Confession always crits the Accused', () => {
    const inq = crusader('inq', 'inquisitor', 1, { passive: { name: 'Glass Confession', desc: '', kind: 'critOnAccused' } });
    const e = makeEnemy('husk', 'e0', 1);
    e.armor = 0;
    e.status.accused = 3;
    const b = new Battle([inq], [e], { rng: () => 0.5 });
    const ev = b.act(inq, CLASS_SKILLS.inquisitor[1], e).find((x) => x.type === 'damage');
    expect(ev && ev.type === 'damage' && ev.crit).toBe(true);
    // 20 atk x 1.2 x 1.25 accused x 1.5 thrust bonus x 1.5 crit
    expect(e.maxHp - e.hp).toBe(Math.round(20 * 1.2 * 1.25 * 1.5 * CRIT_MULT));
  });

  it('Zeal: +4 per attack action regardless of targets, Rites earn nothing', () => {
    const c = crusader('c', 'censer', 2);
    const b = new Battle([c], ['husk', 'acolyte', 'ringer'].map((t, i) => makeEnemy(t, `e${i}`, i + 1)), { rng: () => 0.5 });
    b.act(c, CLASS_SKILLS.censer[0]); // hits all three
    expect(b.zeal).toBe(4);
  });

  it('Zeal from wounds is capped per round', () => {
    const tank = crusader('t', 'hierophant', 1, { maxHp: 1000, hp: 1000 });
    const e = makeEnemy('choir', 'e0', 1);
    e.atk = 2000;
    const b = new Battle([tank, crusader('x', 'oracle', 2, { maxHp: 1e6, hp: 1e6 })], [e], { rng: () => 0.5 });
    b.nextTurn();
    b.act(e, ENEMIES.choir.skills[1], tank);
    expect(b.zeal).toBeLessThanOrEqual(ZEAL_HURT_CAP);
  });

  it('Unbroken Vow survives one killing blow per fight', () => {
    const m = crusader('m', 'warsister', 1, { hp: 5, passive: { name: 'Unbroken Vow', desc: '', kind: 'unbroken' } });
    const e = makeEnemy('husk', 'e0', 1);
    const b = new Battle([m, crusader('y', 'oracle', 2)], [e], { rng: () => 0.5 });
    b.act(e, ENEMIES.husk.skills[0], m);
    expect(m.hp).toBe(1);
    b.act(e, ENEMIES.husk.skills[0], m);
    expect(m.hp).toBe(0);
  });
});
