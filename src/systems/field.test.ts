import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { autoBattle } from './autoplay';
import { stageBattle } from './campaign';
import { CRUSADERS } from '../data/crusaders';
import { Battle, makeEnemy, skillsFor, type Unit } from './combat';
import { EXTRA_SEC, FieldBattle, HYMN_RADIUS, advanceField, screenField, SWING_SEC, reachOf, simulateField, type FieldEvent } from './field';
import { partyFor } from './niche';
import { seeded } from './rng';

const STARTER = ['CC-W013', 'CC-W052', 'CC-W001', 'CC-W022'];
const N = 60;

function rates(stage: number, level: number) {
  const save = newSave();
  for (const id of STARTER) save.owned[id] = { level, vow: 0 };
  let turn = 0;
  let real = 0;
  let secs = 0;
  let lit = 0;
  for (let i = 0; i < N; i++) {
    if (autoBattle(stageBattle(save, STARTER, stage, seeded(1000 + i))) === 'victory') turn++;
    const r = simulateField(stageBattle(save, STARTER, stage, seeded(1000 + i)), { rng: seeded(5000 + i) });
    if (r.outcome === 'victory') real++;
    secs += r.seconds;
    lit += r.litanies;
  }
  return { turn: turn / N, real: real / N, secs: secs / N, litanies: lit / N };
}

describe('real-time field combat', () => {
  it('melee closes in, ranged holds back, foes start across the field', () => {
    const save = newSave();
    for (const id of STARTER) save.owned[id] = { level: 5, vow: 0 };
    const b = stageBattle(save, STARTER, 3, seeded(7));
    const f = new FieldBattle(b, { w: 540, h: 600, rng: seeded(3) });
    const party = b.units.filter((u) => u.side === 'party');
    expect(new Set(party.map((u) => reachOf(u))).size).toBeGreaterThan(1);
    for (const u of b.units) expect(f.bodies.get(u.uid)!.y < 300).toBe(u.side === 'enemy');
    const start = new Map([...f.bodies].map(([k, v]) => [k, { x: v.x, y: v.y }]));
    for (let i = 0; i < 20; i++) f.update(0.05);
    const moved = [...f.bodies].filter(([k, v]) => Math.hypot(v.x - start.get(k)!.x, v.y - start.get(k)!.y) > 5);
    expect(moved.length).toBeGreaterThan(2);
  });

  it('fights end, Litanies fire, and win rates track the turn-based game', () => {
    for (const [stage, level] of [
      [1, 1],
      [5, 3],
      [10, 5],
      [15, 11],
      [15, 13],
      [20, 14],
      [20, 17],
    ]) {
      const r = rates(stage, level);
      console.log(`[field] stage ${stage} lv ${level}: turn-based ${(r.turn * 100).toFixed(0)}%, real-time ${(r.real * 100).toFixed(0)}%, ${r.secs.toFixed(0)}s, ${r.litanies.toFixed(1)} Litanies`);
      expect(r.secs).toBeLessThan(200);
      expect(Math.abs(r.real - r.turn)).toBeLessThan(0.3);
    }
  }, 60_000);

  it('manual Litanies wait for the tap', () => {
    const save = newSave();
    for (const id of STARTER) save.owned[id] = { level: 10, vow: 0 };
    const b = stageBattle(save, STARTER, 5, seeded(9));
    const r = simulateField(b, { manualLitany: true, rng: seeded(2) });
    expect(r.litanies).toBe(0);
    const b2 = stageBattle(save, STARTER, 5, seeded(9));
    const f = new FieldBattle(b2, { w: 540, h: 600, manualLitany: true, rng: seeded(2) });
    const sister = b2.units.find((u) => u.side === 'party')!;
    sister.zeal = 100;
    f.update(0.05);
    const e = f.castLitany(sister.uid);
    expect(e?.kind).toBe('act');
    expect(sister.zeal).toBeLessThan(100);
  });
});

describe('real-time field: Sister kits', () => {
  const sis = (id: string, rank = 1): Unit => {
    const c = CRUSADERS.find((x) => x.id === id)!;
    return { uid: id, side: 'party', name: c.name, ref: id, classId: c.classId, order: c.order, rank, maxHp: 1000, hp: 1000, atk: 100, armor: 0, mres: 0, crit: 0, spd: 10, status: {}, passive: c.passive };
  };
  const perform = (f: FieldBattle, u: Unit, name: string, target?: Unit) => {
    const out: FieldEvent[] = [];
    (f as unknown as { perform: (...a: unknown[]) => void }).perform(u, f.bodies.get(u.uid), skillsFor(u).find((s) => s.name === name), target?.uid, out);
    return out;
  };

  it('Coup de Grâce: a Mercy kill lets Justa Vindex strike again right after the swing', () => {
    const m = sis('CC-W077');
    const foes = [makeEnemy('husk', 'e0', 1), makeEnemy('husk', 'e1', 2)];
    foes[0].maxHp = 10000;
    foes[0].hp = 1550;
    const f = new FieldBattle(new Battle([m], foes, { rng: () => 0.99 }), { w: 540, h: 600, rng: seeded(1) });
    perform(f, m, 'Riposte Thrust', foes[0]);
    expect(foes[0].hp).toBe(0);
    const body = f.bodies.get(m.uid)!;
    expect(body.timer).toBeLessThanOrEqual(SWING_SEC + EXTRA_SEC);
    expect(f.battle.queue).toEqual([]);
    // Only once a round.
    foes[1].maxHp = 10000;
    foes[1].hp = 1550;
    perform(f, m, 'Riposte Thrust', foes[1]);
    expect(body.timer).toBeGreaterThan(SWING_SEC + EXTRA_SEC);
  });

  it('Processional: when ranks turn over, the formation moves with them', () => {
    const c = sis('CC-W120', 1);
    const p = sis('CC-W009', 2);
    const f = new FieldBattle(new Battle([c, p], [makeEnemy('golem', 'e0', 1)], { rng: () => 0.99 }), { w: 540, h: 600, rng: seeded(1) });
    const before = f.bodies.get(c.uid)!.homeY;
    perform(f, c, 'Processional');
    expect(c.rank).toBe(2);
    expect(f.bodies.get(c.uid)!.homeY).toBeGreaterThan(before);
  });

  it('every Sister fights a whole field battle with her kit', () => {
    for (const c of CRUSADERS) {
      const party = partyFor(c.id);
      const save = newSave();
      for (const p of party) save.owned[p] = { level: 10, vow: 0 };
      const r = simulateField(stageBattle(save, party, 3, seeded(7)), { rng: seeded(8) });
      expect(r.outcome, c.name).not.toBe('stalled');
    }
  });
});

describe('real-time field: space', () => {
  const sis = (id: string, rank = 1, classId?: string): Unit => {
    const c = CRUSADERS.find((x) => x.id === id)!;
    return { uid: id, side: 'party', name: c.name, ref: id, classId: classId ?? c.classId, order: c.order, rank, maxHp: 1000, hp: 1000, atk: 100, armor: 0, mres: 0, crit: 0, spd: 10, status: {}, passive: c.passive };
  };
  const anySkill = (u: Unit) => skillsFor(u).find((s) => s.target === 'enemy' && !s.rite)!;

  it('Focus: a tapped foe becomes every Sister\'s target, and tapping again clears it', () => {
    const save = newSave();
    for (const id of STARTER) save.owned[id] = { level: 10, vow: 0 };
    const b = stageBattle(save, STARTER, 5, seeded(9));
    const f = new FieldBattle(b, { w: 540, h: 600, rng: seeded(2) });
    const foe = b.units.filter((u) => u.side === 'enemy').at(-1)!;
    f.setFocus(foe.uid);
    expect(f.focusUid).toBe(foe.uid);
    const sister = b.units.find((u) => u.side === 'party' && b.validTargets(u, anySkill(u)).includes(foe))!;
    expect(f.preferredFoe(sister, anySkill(sister))?.uid).toBe(foe.uid);
    f.setFocus(foe.uid);
    expect(f.focusUid).toBeUndefined();
  });

  it('a Veilblade goes for the back line, an Arbalist for the hardest hitter', () => {
    const vb = CRUSADERS.find((c) => c.classId === 'veilblade')!;
    const ar = CRUSADERS.find((c) => c.classId === 'arbalist')!;
    const v = sis(vb.id, 1);
    const a = sis(ar.id, 4);
    const foes = [makeEnemy('husk', 'e0', 1), makeEnemy('husk', 'e1', 2), makeEnemy('husk', 'e2', 3)];
    foes[1].atk *= 3;
    const f = new FieldBattle(new Battle([v, a], foes, { rng: () => 0.5 }), { w: 540, h: 600, rng: seeded(1) });
    const vs = skillsFor(v).find((s) => s.target === 'enemy' && !s.rite && f.battle.validTargets(v, s).length > 1);
    expect(vs).toBeDefined();
    if (vs) expect(f.preferredFoe(v, vs)!.rank).toBe(Math.max(...f.battle.validTargets(v, vs).map((x) => x.rank)));
    const as = skillsFor(a).find((s) => s.target === 'enemy' && !s.rite && f.battle.validTargets(a, s).includes(foes[1]));
    expect(as).toBeDefined();
    if (as) expect(f.preferredFoe(a, as)!.uid).toBe('e1');
  });

  it('melee Sisters sharing a foe fan out around it instead of queuing', () => {
    const x = sis('CC-W013', 1);
    const y = sis('CC-W001', 2);
    const z = sis('CC-W052', 3);
    const foe = makeEnemy('golem', 'e0', 1);
    foe.maxHp = foe.hp = 1e9;
    const f = new FieldBattle(new Battle([x, y, z], [foe], { rng: () => 0.5 }), { w: 540, h: 600, rng: seeded(4) });
    for (let i = 0; i < 120; i++) f.update(0.05);
    const pts = [x, y, z].map((u) => f.bodies.get(u.uid)!);
    const xs = pts.map((p) => p.x);
    // Spread across the foe's front, not stacked on one line.
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(40);
  });

  it('a Hymn reaches only the allies near the singer', () => {
    const singer = sis('CC-W013', 1);
    const near = sis('CC-W001', 2);
    const far = sis('CC-W052', 3);
    const f = new FieldBattle(new Battle([singer, near, far], [makeEnemy('husk', 'e0', 1)], { rng: () => 0.5 }), { w: 540, h: 600, rng: seeded(1) });
    const at = (u: Unit, x: number, y: number) => Object.assign(f.bodies.get(u.uid)!, { x, y });
    at(singer, 100, 400);
    at(near, 100 + HYMN_RADIUS - 20, 400);
    at(far, 100 + HYMN_RADIUS + 60, 400);
    expect(f.battle.space!.inHymn(singer, near)).toBe(true);
    expect(f.battle.space!.inHymn(singer, far)).toBe(false);
  });

  it('Overwatch waits for a foe to step into the zone', () => {
    const w = sis('CC-W001', 1);
    const foe = makeEnemy('husk', 'e0', 1);
    const f = new FieldBattle(new Battle([w], [foe], { rng: () => 0.5 }), { w: 540, h: 600, rng: seeded(1) });
    Object.assign(f.bodies.get(w.uid)!, { x: 270, y: 560 });
    Object.assign(f.bodies.get(foe.uid)!, { x: 270, y: 40 });
    expect(f.battle.space!.inOverwatch(w, foe)).toBe(false);
    Object.assign(f.bodies.get(foe.uid)!, { x: 270, y: 450 });
    expect(f.battle.space!.inOverwatch(w, foe)).toBe(true);
  });
});

describe('real-time field: the player\'s hand', () => {
  const setup = () => {
    const save = newSave();
    for (const id of STARTER) save.owned[id] = { level: 10, vow: 0 };
    const b = stageBattle(save, STARTER, 5, seeded(9));
    return { b, f: new FieldBattle(b, { w: 540, h: 600, manualLitany: true, rng: seeded(2) }) };
  };

  it('before the fight, two Sisters trade places and ranks', () => {
    const { b, f } = setup();
    const [x, , , y] = b.units.filter((u) => u.side === 'party');
    const [rx, ry] = [x.rank, y.rank];
    const yBefore = f.bodies.get(y.uid)!.y;
    expect(f.swapPlaces(x.uid, y.uid)).toBe(true);
    expect([x.rank, y.rank]).toEqual([ry, rx]);
    expect(f.bodies.get(x.uid)!.y).toBeCloseTo(yBefore, 0);
    // Not once the fight is under way.
    f.update(0.05);
    expect(f.swapPlaces(x.uid, y.uid)).toBe(false);
  });

  it('an aimed Litany lands on the chosen target', () => {
    const { b, f } = setup();
    f.update(0.05);
    const sister = b.units.find((u) => u.side === 'party' && f.litanyTargets(u.uid).length > 1);
    expect(sister).toBeDefined();
    if (!sister) return;
    sister.zeal = 100;
    const targets = f.litanyTargets(sister.uid);
    const pick = targets[targets.length - 1];
    const e = f.castLitany(sister.uid, pick.uid);
    expect(e?.kind).toBe('act');
    if (e?.kind === 'act') expect(e.targetUid).toBe(pick.uid);
  });
});

describe('real-time field: played with no screen', () => {
  it('a fight left on Auto plays on in steps to its end, the same as watching it', () => {
    const save = newSave();
    for (const id of STARTER) save.owned[id] = { level: 10, vow: 0 };
    const f = screenField(stageBattle(save, STARTER, 5, seeded(9)), false);
    let outcome: string | undefined;
    for (let i = 0; i < 2000 && !outcome; i++) outcome = advanceField(f, 0.25);
    expect(outcome).toBe('victory');
    expect(f.time).toBeGreaterThan(5);
  });
});
