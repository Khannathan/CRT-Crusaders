import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { newSave } from '../state/save';
import { stageBattle } from './campaign';
import { Battle, makeEnemy } from './combat';
import { FieldBattle } from './field';
import { seeded } from './rng';

const STARTER = ['SW-R-VEI', 'DL-R-SEN', 'IV-R-EXE', 'SW-SR-ABB'];

function setup(dodge: boolean) {
  const save = newSave();
  for (const id of STARTER) save.owned[id] = { level: 30, vow: 0 };
  const party = stageBattle(save, STARTER, 3, seeded(7)).units.filter((u) => u.side === 'party');
  const boss = makeEnemy('choir', 'boss', 1);
  boss.phase = 2;
  const b = new Battle(party, [boss], { rng: () => 0.5 });
  const f = new FieldBattle(b, { w: 540, h: 450, rng: seeded(3), dodge });
  const requiem = ENEMIES.choir.phase2!.skills.find((s) => s.windup)!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perform = (f as any).perform.bind(f);
  return { b, f, boss, party, requiem, cast: () => perform(boss, f.bodies.get(boss.uid), requiem, undefined, []) };
}

describe('danger zones and dodging', () => {
  it('a charged blow marks the ground round the party', () => {
    const { f, party, cast } = setup(true);
    cast();
    expect(f.zones).toHaveLength(1);
    const z = f.zones[0];
    const inside = party.filter((u) => {
      const me = f.bodies.get(u.uid)!;
      return Math.hypot(me.x - z.x, me.y - z.y) <= z.r;
    });
    expect(inside.length).toBeGreaterThanOrEqual(2);
  });

  it('a Sister dragged out of the mark is spared; the rest are hit', () => {
    const { f, party, cast } = setup(true);
    cast();
    const z = f.zones[0];
    const runner = party[0];
    const before = new Map(party.map((u) => [u.uid, u.hp]));
    expect(f.moveTo(runner.uid, z.x + z.r + 60 > 500 ? z.x - z.r - 60 : z.x + z.r + 60, z.y)).toBe(true);
    // Hold everyone else still and walk the runner out.
    for (let i = 0; i < 60; i++) {
      const me = f.bodies.get(runner.uid)!;
      const o = me.order!;
      const d = Math.hypot(o.x - me.x, o.y - me.y);
      if (d < 4) break;
      me.x += ((o.x - me.x) / d) * Math.min(d, 8);
      me.y += ((o.y - me.y) / d) * Math.min(d, 8);
    }
    const inside = party.filter((u) => {
      const me = f.bodies.get(u.uid)!;
      return Math.hypot(me.x - z.x, me.y - z.y) <= z.r;
    });
    cast();
    expect(runner.hp).toBe(before.get(runner.uid));
    expect(inside.length).toBeGreaterThan(0);
    for (const u of inside) expect(u.hp).toBeLessThan(before.get(u.uid)!);
    expect(f.zones).toHaveLength(0);
  });

  it('without dodging (sims, background fights) nothing is marked', () => {
    const { f, cast } = setup(false);
    cast();
    expect(f.zones).toHaveLength(0);
  });
});
