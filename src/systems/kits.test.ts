import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { KITS } from '../data/kits';
import { CLASS_SKILLS, type SkillDef } from '../data/skills';
import { Battle, makeEnemy, skillsFor, type BattleEvent, type Unit } from './combat';
import * as KW from './keywords';

/** A Sister from the roster, as a battle unit with plain stats. */
const sis = (id: string, rank = 1, extra: Partial<Unit> = {}): Unit => {
  const c = CRUSADERS.find((x) => x.id === id)!;
  return { uid: id, side: 'party', name: c.name, ref: id, classId: c.classId, order: c.order, rank, maxHp: 1000, hp: 1000, atk: 100, armor: 0, mres: 0, crit: 0, spd: 10, status: {}, passive: c.passive, ...extra };
};
const skill = (u: Unit, name: string) => skillsFor(u).find((s) => s.name === name)!;
const tank = (uid: string, rank: number, hp = 100000) => {
  const e = makeEnemy('golem', uid, rank);
  e.maxHp = e.hp = hp;
  return e;
};
const never = () => 0.99;

describe('Sister kits: shape', () => {
  it('every Sister on the roster has a kit of three skills and a Litany', () => {
    for (const c of CRUSADERS) {
      const k = KITS[c.id];
      expect(k, c.name).toBeDefined();
      expect(k.skills).toHaveLength(4);
      expect(k.skills.map((s) => !!s.rite), c.name).toEqual([false, false, false, true]);
    }
  });

  it('kits follow the rarity rules', () => {
    const staples = new Set(Object.values(CLASS_SKILLS).flat());
    for (const c of CRUSADERS) {
      const k = KITS[c.id];
      const own = k.skills.filter((s) => !staples.has(s));
      if (c.rarity === 'R') {
        expect(own, c.name).toHaveLength(1);
        expect(staples.has(k.skills[3]), c.name).toBe(true);
      } else if (c.rarity === 'SR') {
        expect(own.length, c.name).toBe(2);
        expect(staples.has(k.skills[3]), c.name).toBe(false);
      } else {
        expect(c.passive?.kind, c.name).toBe('signature');
        expect(k.shines?.length, c.name).toBeGreaterThan(0);
      }
      if (c.rarity === 'UR') expect(k.seal, c.name).toBeDefined();
      else expect(k.seal, c.name).toBeUndefined();
      // Class staples come from her own class.
      for (const s of k.skills) if (staples.has(s)) expect(CLASS_SKILLS[c.classId], `${c.name}: ${s.name}`).toContain(s);
    }
  });

  it('own skill ids never collide (Vow upgrades are cached by id)', () => {
    const seen = new Map<string, SkillDef>();
    for (const k of Object.values(KITS)) {
      for (const s of k.skills) {
        const had = seen.get(s.id);
        if (had) expect(had, s.id).toBe(s);
        seen.set(s.id, s);
      }
    }
  });

  it('Sisters fight with their kit', () => {
    const u = sis('CC-W077');
    expect(skillsFor(u).map((s) => s.name)).toEqual(['Measured Cut', 'Riposte Thrust', "Duelist's Salute", 'Mercy Stroke', 'Step']);
  });
});

describe('Sister kits: signatures', () => {
  it('Coup de Grâce: a Mercy kill gives Mirelle Bellgrave another action once a round', () => {
    const m = sis('CC-W077');
    const foes = [makeEnemy('husk', 'e0', 1), makeEnemy('husk', 'e1', 2)];
    const b = new Battle([m], foes, { rng: never });
    b.startRound([]);
    b.queue = b.queue.filter((id) => id !== m.uid);
    foes[0].maxHp = 10000;
    foes[0].hp = 1550; // the hit leaves it just under the Mercy line
    b.act(m, skill(m, 'Riposte Thrust'), foes[0]);
    expect(foes[0].hp).toBe(0);
    expect(b.queue[0]).toBe(m.uid);
  });

  it('Duet: while a Hymn plays, Morgane Greywake strikes twice and fills Zeal', () => {
    const run = (hymn: boolean) => {
      const m = sis('CC-W080', 1, { zeal: 0 });
      const foe = tank('e0', 1);
      const b = new Battle([m], [foe], { rng: never });
      if (hymn) b.kw.hymns.push({ by: m.uid, name: 'Test', rounds: 3, choir: true });
      const ev = b.act(m, skill(m, 'Candle Cut'), foe);
      return { hits: ev.filter((e) => e.type === 'damage' && e.uid === 'e0').length, zeal: m.zeal ?? 0 };
    };
    const plain = run(false);
    const sung = run(true);
    expect(sung.hits).toBe(plain.hits * 2);
    expect(sung.zeal).toBeGreaterThan(plain.zeal);
  });

  it('Watchfire: the foe acting first each round is set Burning', () => {
    const i = sis('CC-W040');
    const foe = tank('e0', 1);
    foe.spd = 99;
    const b = new Battle([i], [foe], { rng: never });
    b.startRound([]);
    expect(foe.status.poison?.kind).toBe('burn');
  });

  it("Sentry's Omen: the fastest Sister opens on Overwatch", () => {
    const v = sis('CC-W049', 2);
    const fast = sis('CC-W001', 1, { spd: 30 });
    new Battle([fast, v], [tank('e0', 1)], { rng: never });
    expect(fast.status.overwatch).toBeDefined();
    expect(v.status.overwatch).toBeUndefined();
  });

  it('Vindication: Isolde Thorne adds Guilt with each counter, and Vindicates at five', () => {
    const it2 = sis('CC-W069');
    const foe = makeEnemy('husk', 'e0', 1);
    foe.maxHp = foe.hp = 100000;
    const b = new Battle([it2], [foe], { rng: never });
    b.act(it2, skill(it2, 'Oath Strike'), foe);
    const g0 = foe.guilt ?? 0;
    const { skill: s, target } = b.enemyChoose(foe);
    b.act(foe, s, target);
    expect(foe.guilt).toBe(g0 + 1);
    foe.guilt = KW.GUILT_MAX;
    const ev = b.act(foe, s, target);
    expect(ev.some((e) => e.type === 'status' && e.label === 'Vindicate!')).toBe(true);
    expect(foe.guilt).toBe(0);
  });

  it('Harvest: Remains feed Aveline Thorne Zeal and attack', () => {
    const a = sis('CC-W079', 1, { zeal: 0 });
    const foes = [makeEnemy('husk', 'e0', 1), makeEnemy('husk', 'e1', 2)];
    const b = new Battle([a], foes, { rng: never });
    b.act(a, { id: 'x', name: 'x', desc: '', from: [], target: 'enemy', mult: 100 }, foes[0]);
    expect(b.kw.remains).toBe(1);
    expect(a.bonusAtk).toBeCloseTo(0.05);
    expect(a.zeal).toBeGreaterThanOrEqual(8);
  });

  it('Reliquary Volley spends Remains for one bolt each', () => {
    const e = sis('CC-W235', 3);
    const b = new Battle([e], [tank('e0', 1), tank('e1', 2)], { rng: never });
    b.kw.remains = 3;
    const ev = b.act(e, skill(e, 'Reliquary Volley'));
    expect(b.kw.remains).toBe(0);
    expect(ev.filter((x) => x.type === 'damage').length).toBe(3);
  });

  it('Brine Smite drains more with the Tide', () => {
    const run = (tide: number) => {
      const r = sis('CC-W100', 1, { hp: 100 });
      const b = new Battle([r], [tank('e0', 1)], { rng: never });
      b.kw.tide = tide;
      b.act(r, skill(r, 'Brine Smite'), b.get('e0'));
      return r.hp;
    };
    expect(run(5)).toBeGreaterThan(run(0));
  });

  it('Processional: the front Sister goes to the back and Pilgrims gain Stride', () => {
    const c = sis('CC-W120', 1);
    const p = sis('CC-W009', 2);
    const b = new Battle([c, p], [tank('e0', 1)], { rng: never });
    b.act(c, skill(c, 'Processional'));
    expect(c.rank).toBe(2);
    expect(p.rank).toBe(1);
    expect(p.stride).toBeGreaterThanOrEqual(1);
    expect(p.status.haste).toBe(1);
  });

  it('The Red Road: Ysabet Thorne may Step twice a turn', () => {
    const y = sis('CC-W009', 2);
    const a = sis('CC-W001', 1);
    const c = sis('CC-W013', 3);
    const b = new Battle([a, y, c], [tank('e0', 1)], { rng: never });
    b.step(y, a);
    expect(b.canStep(y)).toBe(true);
    b.step(y, a);
    expect(b.canStep(y)).toBe(false);
  });

  it('Cracked Bell: Peals strike every foe', () => {
    const m = sis('CC-W019');
    const foes = [tank('e0', 1), tank('e1', 2)];
    const b = new Battle([m], foes, { rng: never });
    b.kw.toll = KW.PEAL_EVERY - 1;
    b.act(m, { id: 'x', name: 'x', desc: '', from: [], target: 'self' });
    expect(foes.every((f) => f.hp < f.maxHp)).toBe(true);
  });
});

describe("Sister kits: Saint's Seals", () => {
  const blow = (b: Battle, foe: Unit, t: Unit, mult = 1000) => b.act(foe, { id: 'blow', name: 'Blow', desc: '', from: [], target: 'enemy', mult }, t);

  it('Last Rites Heard: the first Sister who would fall is healed instead, once', () => {
    const a = sis('CC-W050', 3);
    const v = sis('CC-W001', 1);
    const foe = makeEnemy('husk', 'e0', 1);
    const b = new Battle([v, a], [foe], { rng: never });
    blow(b, foe, v);
    expect(v.hp).toBeGreaterThan(0);
    expect(foe.status.foretold).toBeDefined();
    blow(b, foe, v);
    expect(v.hp).toBe(0);
  });

  it('Not Yet: the first Sister to fall rises at once', () => {
    const r = sis('CC-W199', 3);
    const v = sis('CC-W001', 1);
    const foe = makeEnemy('husk', 'e0', 1);
    const b = new Battle([v, r], [foe], { rng: never });
    blow(b, foe, v);
    expect(v.hp).toBe(Math.round(v.maxHp * 0.25));
  });

  it('I Walk Before You: Rosamund Thorne takes a killing blow meant for another', () => {
    const r = sis('CC-W129', 2, { maxHp: 100000, hp: 100000 });
    const v = sis('CC-W001', 1);
    const foe = makeEnemy('husk', 'e0', 1);
    const b = new Battle([v, r], [foe], { rng: never });
    blow(b, foe, v, 50);
    expect(v.hp).toBe(v.maxHp);
    expect(r.hp).toBeLessThan(r.maxHp);
  });

  it('Drowned and Returned: Rosamund Greywake rises next round and the Tide floods', () => {
    const r = sis('CC-W100');
    const foe = makeEnemy('husk', 'e0', 1);
    const b = new Battle([r, sis('CC-W001', 2)], [foe], { rng: never });
    blow(b, foe, r, 10000);
    expect(r.hp).toBe(0);
    const ev: BattleEvent[] = [];
    b.startRound(ev);
    expect(r.hp).toBe(Math.round(r.maxHp * 0.5));
    expect(b.kw.tide).toBe(KW.TIDE_MAX);
  });

  it('The Note Held: the first Hymn to end plays two more rounds', () => {
    const m = sis('CC-W080');
    const b = new Battle([m], [tank('e0', 1)], { rng: never });
    b.kw.hymns.push({ by: m.uid, name: 'Short', rounds: 1, choir: true });
    b.startRound([]);
    expect(b.kw.hymns.map((h) => h.rounds)).toEqual([2]);
    expect(m.sealUsed).toBe(true);
  });

  it('Seals reset each fight', () => {
    const a = sis('CC-W050');
    a.sealUsed = true;
    new Battle([a], [tank('e0', 1)], { rng: never });
    expect(a.sealUsed).toBe(false);
  });
});
