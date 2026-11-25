import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
// Kit mechanics are tested on their first owners, some retired from the 200 (their kits stay as donors).
import { ROSTER } from '../data/roster';
import { KITS } from '../data/kits';
import { CLASS_SKILLS } from '../data/skills';
import { ENEMIES } from '../data/enemies';
import { RELICS, BURDENS } from '../data/relics';
import { TURN_WORDS, realtimeText } from '../data/realtimeText';
import glossarySrc from '../ui/glossary.ts?raw';
import { HOSANNAS } from './hosanna';
import { HUNTS } from './hunts';
import { Battle, PULSE, cooldownSec, makeEnemy, type Unit } from './combat';
import { FieldBattle, KNOCK_DIST } from './field';
import { newSave } from '../state/save';
import { stageBattle } from './campaign';
import { seeded } from './rng';

/**
 * Combat is real time. No player-facing combat text may speak of turns, rounds
 * or ranks, and the clock must do what the words say: "for 6s" lasts 6 seconds
 * whoever it is laid on.
 */
describe('real-time words', () => {
  it('no kit, foe, relic, Hosanna, hunt or glossary line says turn, round or rank', () => {
    const lines: [string, string][] = [];
    for (const c of ROSTER) {
      const k = KITS[c.id];
      lines.push([`${c.name} passive`, c.passive?.desc ?? '']);
      for (const s of k?.skills ?? []) lines.push([`${c.name}: ${s.name}`, s.desc]);
      if (k?.seal) lines.push([`${c.name} seal`, k.seal.desc]);
      if (k?.relic) lines.push([`${c.name} relic`, k.relic.desc]);
    }
    for (const [cls, set] of Object.entries(CLASS_SKILLS)) for (const s of set) lines.push([`${cls}: ${s.name}`, s.desc]);
    for (const e of Object.values(ENEMIES)) for (const s of [...e.skills, ...(e.blasphemy ? [e.blasphemy] : [])]) lines.push([`${e.name}: ${s.name}`, s.desc]);
    for (const r of [...RELICS, ...BURDENS]) lines.push([r.name, r.desc]);
    for (const h of HOSANNAS) lines.push([h.name, h.desc]);
    for (const h of HUNTS) for (const m of h.mechanics) lines.push([m.name, m.text]);
    // The glossary pulls in Phaser, so read its text from the source.
    for (const m of glossarySrc.matchAll(/title: '([^']+)'.*?text: ['`]((?:\\.|[^'`])*)['`]/g)) lines.push([m[1], m[2].replace(/\$\{[^}]*\}/g, '')]);
    const bad = lines.filter(([, t]) => TURN_WORDS.test(t) || /\bDelay/.test(t) || /Cooldown \d+(?!s)\b/.test(t));
    expect(bad.map(([w, t]) => `${w}: ${t}`)).toEqual([]);
    expect(lines.length).toBeGreaterThan(2500);
  });

  it('the three Sisters from the proposal read as agreed', () => {
    const skill = (name: string, s: string) => KITS[ROSTER.find((c) => c.name === name)!.id].skills.find((x) => x.name === s)!.desc;
    expect(skill('Abnegata Ustoria', 'Reliquary Bash')).toBe('Strike a front-line foe, hurl it back and draw enemy attacks for 4s.');
    expect(skill('Absoluta Ambusta', 'Witchfire')).toMatch(/^Set any enemy Burning for 6s\./);
    expect(skill('Insomnia', 'The Watch-Keys')).toMatch(/^Lock a foe out: it is Accused for 4s and is Staggered \(breaks a charge\)\..*Cooldown 6s\.$/);
    expect(CRUSADERS.find((c) => c.name === 'Insomnia')!.passive!.desc).toMatch(/^\+20% damage from the Rearguard\./);
  });

  it('converts each form once and leaves converted text alone', () => {
    expect(realtimeText('Weaken it for 2 turns. Cooldown 2.')).toBe('Weaken it for 4s. Cooldown 6s.');
    expect(realtimeText('Regenerates 4% a round for 3 rounds')).toBe('Regenerates 4% every 2s for 6s');
    expect(realtimeText('Smite any enemy, push its turn to the end')).toBe('Smite any enemy, Stagger it');
    const once = realtimeText('Strike rank 1-2, knock it a rank back and draw enemy attacks for 2 turns. Cooldown 3.');
    expect(realtimeText(once)).toBe(once);
  });
});

function duel(spd: number) {
  const a = makeEnemy(Object.keys(ENEMIES)[0], 'a', 1);
  const party: Unit = { ...makeEnemy(Object.keys(ENEMIES)[0], 'p', 1), side: 'party', hp: 1e6, maxHp: 1e6 };
  a.spd = spd;
  a.hp = a.maxHp = 1e6;
  const b = new Battle([party], [a]);
  b.timed = true;
  return { b, a };
}

describe('real-time clock', () => {
  it('a 3-turn burn lasts 6 seconds and bites 3 times, on fast and slow foes alike', () => {
    for (const spd of [4, 10, 15]) {
      const { b, a } = duel(spd);
      a.status.poison = { dmg: 10, turns: 3, kind: 'burn' };
      let t = 0;
      let bites = 0;
      while (a.status.poison && t < 20) {
        const ev: never[] = [];
        b.timePass(0.05, ev);
        bites += (ev as { type: string }[]).filter((e) => e.type === 'damage').length;
        t += 0.05;
      }
      expect(t).toBeCloseTo(3 * PULSE, 1);
      expect(bites).toBe(3);
    }
  });

  it('a 2-turn Weaken lasts 4 seconds; renewing it restarts the clock', () => {
    const { b, a } = duel(10);
    a.status.weaken = { pct: 0.2, turns: 2 };
    for (let i = 0; i < 30; i++) b.timePass(0.1, []);
    expect(a.status.weaken).toBeDefined();
    a.status.weaken = { pct: 0.2, turns: 2 };
    for (let i = 0; i < 35; i++) b.timePass(0.1, []);
    expect(a.status.weaken).toBeDefined();
    for (let i = 0; i < 10; i++) b.timePass(0.1, []);
    expect(a.status.weaken).toBeUndefined();
  });

  it('a cooldown of 2 lasts 6 seconds from use', () => {
    expect(cooldownSec(2)).toBe(6);
    const { b, a } = duel(10);
    a.cooldowns = { x: cooldownSec(2) };
    for (let i = 0; i < 59; i++) b.timePass(0.1, []);
    expect(a.cooldowns.x).toBeGreaterThan(0);
    b.timePass(0.2, []);
    expect(a.cooldowns.x).toBe(0);
  });
});

describe('real-time field positions', () => {
  const STARTER = ['TC-R-WAR', 'DL-R-SEN', 'IV-R-EXE', 'TC-SR-CON'];
  const setup = () => {
    const save = newSave();
    for (const id of STARTER) save.owned[id] = { level: 10, vow: 0 };
    const b = stageBattle(save, STARTER, 8, seeded(4));
    return { b, f: new FieldBattle(b, { w: 540, h: 600, rng: seeded(2) }) };
  };

  it('the front line is the two foes standing nearest the Sisters, wherever their formation slot', () => {
    const { b, f } = setup();
    const foes = b.alive('enemy');
    expect(foes.length).toBeGreaterThan(2);
    // Move the back-slot foe right up to the Sisters.
    const back = foes.reduce((x, y) => (y.rank > x.rank ? y : x));
    const party = b.alive('party').map((u) => f.bodies.get(u.uid)!);
    const body = f.bodies.get(back.uid)!;
    body.x = party[0].x;
    body.y = party[0].y - 30;
    expect(b.space!.liveRank!(back)).toBe(1);
    const strike = { id: 't', name: 't', desc: '', from: [], target: 'enemy' as const, reach: [1, 2] };
    expect(b.validTargets(b.alive('party')[0], strike)).toContain(back);
  });

  it('a knocked-back foe is hurled away from the striker', () => {
    const { b, f } = setup();
    const foe = b.alive('enemy')[0];
    const sis = b.alive('party')[0];
    const fb = f.bodies.get(foe.uid)!;
    const sb = f.bodies.get(sis.uid)!;
    fb.x = sb.x;
    fb.y = sb.y - 50;
    const before = Math.hypot(fb.x - sb.x, fb.y - sb.y);
    const bash = { id: 'b', name: 'Bash', desc: '', from: [], target: 'enemy' as const, mult: 0.1, shove: 1 };
    (f as unknown as { perform: (...a: unknown[]) => void }).perform(sis, sb, bash, foe.uid, []);
    for (let i = 0; i < 6; i++) f.update(0.05);
    expect(Math.hypot(fb.x - sb.x, fb.y - sb.y)).toBeGreaterThan(before + KNOCK_DIST * 0.6);
  });
});
