import { describe, expect, it } from 'vitest';
import type { SkillDef } from '../data/skills';
import { Battle, FERVOR_DMG, makeEnemy, withRelic, type Unit } from './combat';
import type { Kit } from '../data/kits';

const sister = (uid: string, order: string, rank = 1, extra: Partial<Unit> = {}): Unit => ({
  uid, side: 'party', name: uid, ref: uid, classId: 'warsister', order, rank, maxHp: 100, hp: 100, atk: 20, armor: 0, mres: 0, crit: 0, spd: 10, status: {}, ...extra,
});
const sk = (s: Partial<SkillDef>): SkillDef => ({ id: 'test', name: 'Test', desc: '', from: [], target: 'enemy', ...s });
const never = () => 0.5;
const big = (uid: string, rank = 1) => {
  const e = makeEnemy('golem', uid, rank);
  e.maxHp = e.hp = 100000;
  return e;
};

describe('Zealot Initiative mechanics', () => {
  it('Penance hurts a foe each time it acts', () => {
    const s = sister('s', 'Veiled Tribunal');
    const foe = makeEnemy('husk', 'e0', 1);
    foe.maxHp = foe.hp = 100000;
    const b = new Battle([s], [foe], { rng: never });
    b.act(s, sk({ mult: 0.01, penance: { pct: 0.5, turns: 2 } }), foe);
    const before = foe.hp;
    const { skill, target } = b.enemyChoose(foe);
    b.act(foe, skill, target);
    expect(foe.hp).toBeLessThan(before);
    expect(foe.status.penance?.turns).toBe(1);
  });

  it('a Brand makes the next hit land harder, then is spent', () => {
    const s = sister('s', 'Iron Vigil');
    const foe = big('e0');
    const b = new Battle([s], [foe], { rng: never });
    let h = foe.hp;
    b.act(s, sk({ mult: 1 }), foe);
    const plain = h - foe.hp;
    b.act(s, sk({ mult: 0.001, brand: 1 }), foe);
    h = foe.hp;
    b.act(s, sk({ mult: 1 }), foe);
    expect(h - foe.hp).toBeGreaterThan(plain * 1.7);
    expect(foe.status.brand).toBeUndefined();
  });

  it('Rapture and Mirror Images swallow hits', () => {
    const s = sister('s', 'Confessors of Glass');
    const foe = makeEnemy('husk', 'e0', 1);
    const b = new Battle([s], [foe], { rng: never });
    b.act(s, sk({ target: 'self', images: 2 }));
    expect(s.status.images).toBe(2);
    const { skill, target } = b.enemyChoose(foe);
    b.act(foe, skill, target);
    expect(s.hp).toBe(100);
    expect(s.status.images).toBe(1);
    s.status.images = undefined;
    b.act(s, sk({ target: 'self', rapture: 1 }));
    const again = b.enemyChoose(foe);
    b.act(foe, again.skill, again.target);
    expect(s.hp).toBe(100);
  });

  it('Fervor stacks to five and raises damage', () => {
    const s = sister('s', 'Verdant Martyrdom');
    const foe = big('e0');
    const b = new Battle([s], [foe], { rng: never });
    for (let i = 0; i < 7; i++) b.act(s, sk({ target: 'self', fervor: 1 }));
    expect(s.fervor).toBe(5);
    expect(FERVOR_DMG * 5).toBeCloseTo(0.3);
  });

  it('Stigmata bleeds the foe and heals the Sister who cut it', () => {
    const s = sister('s', 'Verdant Martyrdom', 1, { hp: 50 });
    const foe = big('e0');
    const b = new Battle([s], [foe], { rng: never });
    b.act(s, sk({ mult: 0.01, stigmata: { mult: 1, turns: 2 } }), foe);
    b.beginTurn(foe, []);
    expect(s.hp).toBeGreaterThan(50);
  });

  it('Martyrdom takes part of a blow aimed at another Sister', () => {
    const m = sister('m', 'Crimson Inquisition', 2, { maxHp: 1000, hp: 1000 });
    const s = sister('s', 'Crimson Inquisition', 1);
    const foe = makeEnemy('husk', 'e0', 1);
    const b = new Battle([s, m], [foe], { rng: never });
    b.act(m, sk({ target: 'self', martyrdom: { pct: 0.5, turns: 2 } }));
    b.act(foe, sk({ mult: 2, target: 'enemy' }), s);
    expect(m.hp).toBeLessThan(1000);
  });

  it('Silence breaks a charge and keeps a foe to its plainest skill', () => {
    const s = sister('s', 'Hallowed Belfry');
    const foe = makeEnemy('husk', 'e0', 1);
    const b = new Battle([s], [foe], { rng: never });
    foe.status.charging = true;
    b.act(s, sk({ mult: 0.01, silence: 2 }), foe);
    expect(foe.status.charging).toBe(false);
    expect(foe.status.silence).toBe(2);
  });

  it('Shatter on death reforges a Glass Sister once and cuts every foe', () => {
    const s = sister('s', 'Confessors of Glass', 1, { sig: { shatterDeath: { mult: 1, reform: 0.3 } } });
    const foes = [big('e0'), big('e1', 2)];
    const b = new Battle([s], foes, { rng: never });
    b.act(foes[0], sk({ mult: 999, target: 'enemy' }), s);
    expect(s.hp).toBe(30);
    expect(foes[1].hp).toBeLessThan(100000);
    b.act(foes[0], sk({ mult: 999, target: 'enemy' }), s);
    expect(s.hp).toBe(0);
  });

  it('holy ground works each round, then fades', () => {
    const s = sister('s', 'Ashen Mercy', 1, { hp: 50 });
    const foe = big('e0');
    const b = new Battle([s], [foe], { rng: never });
    b.act(s, sk({ target: 'self', ground: { kind: 'hallowed', rounds: 2 } }));
    b.startRound([]);
    expect(s.hp).toBe(54);
    b.startRound([]);
    expect(b.ground).toBeUndefined();
  });

  it('a Patron Miracle lifts only her own Order', () => {
    const p = sister('p', 'Iron Vigil', 1, { sig: { patron: { atk: 0.2, guard: 0.1 } } });
    const mate = sister('m', 'Iron Vigil', 2);
    const other = sister('o', 'Choir of the Pyre', 3);
    new Battle([p, mate, other], [big('e0')], { rng: never });
    expect(mate.bonusAtk).toBeCloseTo(0.2);
    expect(other.bonusAtk).toBe(0);
  });

  it('a Relic rewrites its skill', () => {
    const base = sk({ id: 'a', name: 'A', desc: 'Hit.', mult: 1 });
    const kit: Kit = { skills: [base, base, base, base], relic: { name: 'Nail', desc: 'Also Brands.', skill: 1, patch: { brand: 0.3 } } };
    const out = withRelic(kit);
    expect(out[1].brand).toBe(0.3);
    expect(out[1].desc).toContain('RELIC: Also Brands.');
    expect(out[0].brand).toBeUndefined();
  });
});
