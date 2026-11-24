import { describe, expect, it } from 'vitest';
import type { SkillDef } from '../data/skills';
import { Battle, makeEnemy, type BattleEvent, type Unit } from './combat';
import * as KW from './keywords';

const sister = (uid: string, order: string, rank = 1, extra: Partial<Unit> = {}): Unit => ({
  uid, side: 'party', name: uid, ref: uid, classId: 'warsister', order, rank, maxHp: 100, hp: 100, atk: 20, armor: 0, mres: 0, crit: 0, spd: 10, status: {}, ...extra,
});
const sk = (s: Partial<SkillDef>): SkillDef => ({ id: 'test', name: 'Test', desc: '', from: [], target: 'enemy', ...s });
const never = () => 0.99;

describe('Order keywords', () => {
  it('Mercy ends a common foe left under its line and heals the party', () => {
    const s = sister('s', 'Ashen Mercy', 1, { hp: 50 });
    const foe = makeEnemy('husk', 'e0', 1);
    const b = new Battle([s], [foe], { rng: never });
    foe.hp = Math.round(foe.maxHp * 0.16);
    b.act(s, sk({ mult: 0.4 }), foe);
    expect(foe.hp).toBe(0);
    expect(s.hp).toBeGreaterThan(50);
  });

  it('a Measured Cut stops at the Mercy line, and other Orders get no Mercy', () => {
    const s = sister('s', 'Ashen Mercy');
    const foe = makeEnemy('husk', 'e0', 1);
    const b = new Battle([s], [foe], { rng: never });
    b.act(s, sk({ mult: 50, cannotKill: true }), foe);
    expect(foe.hp).toBe(Math.ceil(foe.maxHp * KW.MERCY_LINE));
    const o = sister('o', 'Iron Vigil');
    const foe2 = makeEnemy('husk', 'e1', 1);
    const b2 = new Battle([o], [foe2], { rng: never });
    foe2.hp = Math.round(foe2.maxHp * 0.2);
    b2.act(o, sk({ mult: 0.01 }), foe2);
    expect(foe2.hp).toBeGreaterThan(0);
  });

  it('Guilt builds on the Accused, raises damage taken, and a Sentence spends it', () => {
    const s = sister('s', 'Veiled Tribunal');
    const foe = makeEnemy('golem', 'e0', 1);
    foe.maxHp = foe.hp = 100000;
    const b = new Battle([s], [foe], { rng: never });
    foe.status.accused = 9;
    for (let i = 0; i < 7; i++) b.act(s, sk({ mult: 0.1 }), foe);
    expect(foe.guilt).toBe(KW.GUILT_MAX);
    const before = foe.hp;
    b.act(s, sk({ mult: 1, spend: { kw: 'guilt', per: { multPct: 0.25 } } }), foe);
    const heavy = before - foe.hp;
    expect(foe.guilt).toBe(1); // spent, then this hit added one back
    const before2 = foe.hp;
    foe.guilt = 0;
    b.act(s, sk({ mult: 1 }), foe);
    expect(heavy).toBeGreaterThan((before2 - foe.hp) * 2);
  });

  it('Remains come from every fall while a Watch Sister stands, and boss marks', () => {
    const w = sister('w', 'Sepulcher Watch');
    const foes = [makeEnemy('husk', 'e0', 1), makeEnemy('husk', 'e1', 2)];
    const b = new Battle([w], foes, { rng: never });
    for (const f of foes) b.act(w, sk({ mult: 100 }), f);
    expect(b.kw.remains).toBe(2);
    const boss = makeEnemy('choir', 'b', 1);
    const b2 = new Battle([sister('w2', 'Sepulcher Watch')], [boss], { rng: never });
    boss.hp = Math.round(boss.maxHp * 0.6);
    b2.act(b2.get('w2'), sk({ mult: 0.01 }), boss);
    expect(b2.kw.remains).toBe(1);
    const nobody = new Battle([sister('x', 'Iron Vigil')], [makeEnemy('husk', 'e', 1)], { rng: never });
    nobody.act(nobody.get('x'), sk({ mult: 100 }), nobody.get('e'));
    expect(nobody.kw.remains).toBe(0);
  });

  it('a Hymn plays each round; a second Choir Hymn harmonises and gives Zeal', () => {
    const a = sister('a', 'Choir of the Pyre');
    const c = sister('c', 'Choir of the Pyre', 2);
    const b = new Battle([a, c], [makeEnemy('golem', 'e0', 1)], { rng: never });
    b.act(a, sk({ target: 'self', hymn: { name: 'Hymn of Iron', rounds: 3, allies: { ward: { pct: 0.1, turns: 1 } } } }));
    expect(c.status.ward?.pct).toBe(0.1);
    const z = c.zeal ?? 0;
    b.act(a, sk({ target: 'self', hymn: { name: 'Second', rounds: 3, allies: { critUp: { pct: 0.1, turns: 1 } } } }));
    expect(b.kw.hymns.map((h) => h.name)).toEqual(['Hymn of Iron', 'Second']);
    expect((c.zeal ?? 0) - z).toBe(KW.HARMONY_ZEAL);
  });

  it('Scars come from her own blood and add damage', () => {
    const t = sister('t', 'Verdant Martyrdom');
    const b = new Battle([t], [makeEnemy('golem', 'e0', 1)], { rng: never });
    b.act(t, sk({ target: 'self', selfDmgPct: 0.2 }));
    expect(t.scars).toBe(4);
  });

  it('the Tide rises each round with a Drowned Sister, and an Ebb spends it', () => {
    const d = sister('d', 'Drowned Litany');
    const b = new Battle([d], [makeEnemy('golem', 'e0', 1)], { rng: never });
    const ev: BattleEvent[] = [];
    for (let i = 0; i < 7; i++) b.startRound(ev);
    expect(b.kw.tide).toBe(KW.TIDE_MAX);
    b.act(d, sk({ target: 'allAllies', spend: { kw: 'tide', per: { shieldPct: 0.06 } } }));
    expect(b.kw.tide).toBe(0);
    expect(d.status.shield).toBe(30);
  });

  it('Confessed foes take Shattering crits', () => {
    const run = (confess: boolean) => {
      const g = sister('g', 'Confessors of Glass', 1, { crit: 1 });
      const foe = makeEnemy('golem', 'e0', 1);
      foe.maxHp = foe.hp = 100000;
      if (confess) foe.status.confessed = 3;
      new Battle([g], [foe], { rng: () => 0.5 }).act(g, sk({ mult: 1 }), foe);
      return 100000 - foe.hp;
    };
    expect(run(true)).toBeGreaterThan(run(false) * 1.1);
  });

  it('Pursuit comes from changing rank', () => {
    const p = sister('p', 'Crimson Inquisition', 1);
    const q = sister('q', 'Iron Vigil', 2);
    const b = new Battle([p, q], [makeEnemy('golem', 'e0', 1)], { rng: never });
    b.step(p, q);
    expect(p.stride).toBe(1);
    expect(q.stride).toBeUndefined();
  });

  it('Overwatch fires when the next foe acts, and drains Wrath from a charging boss', () => {
    const v = sister('v', 'Iron Vigil');
    const boss = makeEnemy('choir', 'b', 1);
    const b = new Battle([v], [boss], { rng: never });
    b.act(v, sk({ target: 'self', overwatch: KW.OVERWATCH_HIT }));
    expect(v.status.overwatch).toBeDefined();
    boss.status.charging = true;
    boss.wrath = 50;
    const hp = boss.hp;
    const { skill, target } = b.enemyChoose(boss);
    b.act(boss, skill, target);
    expect(boss.hp).toBeLessThan(hp);
    expect(v.status.overwatch).toBeUndefined();
    expect(boss.wrath).toBeLessThan(50 + 21);
  });

  it('the Bell peals every third toll and Midnight raises the fallen once', () => {
    const bell = sister('bell', 'Hallowed Belfry');
    const dead = sister('dead', 'Iron Vigil', 2, { hp: 0 });
    const b = new Battle([bell, dead], [makeEnemy('golem', 'e0', 1)], { rng: never });
    for (let i = 0; i < KW.MIDNIGHT_AT; i++) b.act(bell, sk({ target: 'self' }));
    expect(b.kw.midnight).toBe(true);
    expect(dead.hp).toBe(Math.round(dead.maxHp * KW.MIDNIGHT_RAISE));
  });
});
