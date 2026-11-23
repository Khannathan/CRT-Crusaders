import { CLASSES } from '../data/classes';
import { ENEMIES } from '../data/enemies';
import type { SkillDef } from '../data/skills';
import { autoChoose, autoStep } from './autoplay';
import { Battle, ZEAL_MAX, skillsFor, type BattleEvent, type Unit } from './combat';

/**
 * Real-time combat on an open field, built on top of the turn-based Battle.
 *
 * Every rule (damage, statuses, Zeal, Litanies, Wrath, Blasphemies, combos)
 * still lives in Battle. This layer only decides *when* and *where*:
 *
 * - each unit has a body on the field that walks toward its foe until it is in
 *   reach, then acts; melee fighters close in, ranged ones hold back and kite
 * - a unit acts on its own clock (about every 2.2 seconds, a little quicker for
 *   fast units) instead of waiting for its place in the turn order; each action
 *   starts with Battle.beginTurn, so poison, bleeds and statuses tick per action
 * - a round passes on a clock too (Battle.startRound): the Vigil candle, relic
 *   Zeal, the hound's howl and hunt-boss traits keep working
 * - ranks stay as the formation: they set where a Sister starts and which skills
 *   she may use, exactly as in turn-based fights
 * - Litanies fire on their own (auto) or when the player taps the Sister
 * - melee fighters spread into open spots around their foe instead of piling on
 *   one point; each class picks targets by its own rule (Veilblades dive the
 *   back line, Arbalists take the most dangerous foe, Exorcists the boss), and
 *   the player may Focus one foe for every Sister who can reach it
 * - space matters for two Orders: a Hymn reaches the allies near the singer,
 *   and Overwatch reacts to foes that step into the watcher's zone
 *
 * The view (ui/fieldView.ts) draws it; nothing here touches Phaser, so it runs
 * headless in tests.
 */

/**
 * Foes hit this much harder on the field than in the old turn-based game: the
 * Sisters' free Step and catching up after the walk in make them a little
 * stronger here (tuned with balance.test.ts on the field).
 */
export const FIELD_ENEMY_ATK = 1.09;
/** And the rank and file have this much more health (bosses keep theirs). */
export const FIELD_ENEMY_HP = 1;
/** Foes that shoot keep this share of a Sister's ranged reach. */
const ENEMY_SHOOT = 1;
/** Sisters act this much more often than foes of the same speed: they walk to most fights, foes' volleys do not. */
export const SISTER_PACE = 0.94;
/** Share of a beat a unit may catch up after walking into reach. */
const MAX_CATCHUP = 0.9;
/** Seconds between a unit's actions at speed 10. */
export const ACT_SEC = 2.2;
/** Seconds per round (candle, relic Zeal, howl, boss traits). */
export const ROUND_SEC = 2.2;
/** A delayed unit's next action waits this much longer. */
export const DELAY_SEC = 1.6;
/** An extra action (Coup de Grâce) comes this soon after the swing ends. */
export const EXTRA_SEC = 0.15;
/** Seconds a unit stands still after acting (the swing), and after a Litany. */
export const SWING_SEC = 0.45;
export const LITANY_SEC = 0.9;
/**
 * Litany Chains: a Litany cast within CHAIN_SEC of the last one links to it.
 * Each link hits harder (CHAIN_BONUS by link number) and kindles CHAIN_ZEAL in
 * every other Sister, so a player who holds full Litanies and fires them
 * together beats one who fires each the moment it is ready.
 */
export const CHAIN_SEC = 3.5;
export const CHAIN_BONUS = [0, 0, 0.15, 0.3, 0.5];
export const CHAIN_ZEAL = 8;
export const chainBonus = (link: number) => CHAIN_BONUS[Math.min(link, CHAIN_BONUS.length - 1)] ?? 0;

/** Field size the reach and speed numbers are tuned for. */
const BASE_W = 540;

export type Reach = 'melee' | 'mid' | 'ranged';
const REACH: Record<Reach, number> = { melee: 54, mid: 190, ranged: 230 };
/** A Hymn carries this far from the singer (field units at 540 wide). */
export const HYMN_RADIUS = 260;
/** Overwatch reacts to a foe this much further out than the watcher's own reach. */
export const OVERWATCH_EXTRA = 170;
/** Angle between melee fighters sharing one foe (radians). */
const SLOT_SPREAD = 0.85;

export interface Body {
  uid: string;
  x: number;
  y: number;
  reach: Reach;
  /** Distance at which it can act on a foe or ally. */
  range: number;
  /** Walking speed, field units a second. */
  speed: number;
  /** Personal space: other bodies are pushed out of it. */
  radius: number;
  /** Seconds until it may act again. */
  timer: number;
  /** Seconds it stands rooted (mid-swing). */
  lock: number;
  /** What it means to do when it gets in reach. */
  plan?: { skill: SkillDef; targetUid?: string; age: number };
  /** 1 = facing right, -1 = left. */
  face: 1 | -1;
  moving: boolean;
  /** Still walking in from beyond the edge of the field. */
  entering?: boolean;
  /** Its start-of-turn effects have run; it acts once it is in reach. */
  ready: boolean;
  /** Seconds it has been ready but still walking into reach. */
  waited?: number;
  /** Who it walked toward last frame (melee fighters share out spots around a foe). */
  goalUid?: string;
  /** Where it stands in formation (rank-based), for regrouping between fights. */
  homeX: number;
  homeY: number;
}

export type FieldEvent =
  | { kind: 'act'; uid: string; skill: SkillDef; targetUid?: string; events: BattleEvent[]; ranged: boolean; litany: boolean; charge: boolean }
  /** Start-of-action ticks (poison, regen, stun) and round effects. */
  | { kind: 'tick'; events: BattleEvent[] }
  | { kind: 'spawn'; uid: string }
  | { kind: 'end'; outcome: 'victory' | 'defeat' };

export interface FieldOpts {
  w: number;
  h: number;
  /** Sisters cast Litanies only when the player taps them. */
  manualLitany?: boolean;
  /** Sisters already standing somewhere (by Sister id), e.g. a Vigil's next wave. */
  carry?: Map<string, { x: number; y: number }>;
  /** Figure size on screen relative to the Vigil's (1): bigger bodies keep further apart and melee reaches further. */
  bodyScale?: number;
  /** Enemies walk in from beyond the side edges. */
  enemiesEnter?: boolean;
  rng?: () => number;
}

/** How a unit fights: melee closes in, mid stands back a little, ranged keeps away. */
export function reachOf(u: Unit, spawnRank = u.rank): Reach {
  if (u.side === 'party') {
    const role = (u.classId && CLASSES[u.classId]?.role) || '';
    if (/ranged/i.test(role)) return 'ranged';
    if (/healer|buffer|support/i.test(role)) return 'mid';
    if (/tank|melee/i.test(role)) return 'melee';
    return spawnRank >= 3 ? 'ranged' : 'melee';
  }
  if (u.boss) return 'melee';
  const def = ENEMIES[u.ref];
  const moves = (def?.skills ?? []).filter((s) => !s.rite);
  if (moves.length && moves.every((s) => s.from.length && Math.min(...s.from) >= 3)) return 'ranged';
  return spawnRank >= 3 ? 'ranged' : 'melee';
}

export class FieldBattle {
  readonly bodies = new Map<string, Body>();
  /** Seconds since the fight began. */
  time = 0;
  private roundClock = 0;
  /** Someone has acted: from now on rounds pass. */
  private engaged = false;
  private done = false;
  private k: number;
  /** Litany Chain: links so far, when the last link was cast, and the longest this fight. */
  chain = { count: 0, at: -99, best: 0 };
  /** The foe the player marked: every Sister who can hit it turns on it. */
  focusUid?: string;
  private rng: () => number;

  constructor(
    readonly battle: Battle,
    readonly opts: FieldOpts,
  ) {
    this.k = opts.w / BASE_W;
    this.rng = opts.rng ?? Math.random;
    for (const u of battle.units) this.addBody(u);
    battle.space = {
      inHymn: (singer, u) => {
        const a = this.bodies.get(singer.uid);
        const c = this.bodies.get(u.uid);
        return !a || !c || this.dist(a, c) <= HYMN_RADIUS * this.k;
      },
      inOverwatch: (watcher, foe) => {
        const a = this.bodies.get(watcher.uid);
        const c = this.bodies.get(foe.uid);
        return !a || !c || this.dist(a, c) <= a.range + OVERWATCH_EXTRA * this.k + c.radius;
      },
    };
  }

  /** Marks a foe for every Sister (tap again, or pass nothing, to clear). */
  setFocus(uid?: string) {
    const u = uid ? this.battle.get(uid) : undefined;
    this.focusUid = u && u.side === 'enemy' && u.hp > 0 && this.focusUid !== uid ? uid : undefined;
    // Sisters already chasing someone else think again.
    if (this.focusUid) for (const s of this.battle.alive('party')) {
      const b = this.bodies.get(s.uid);
      if (b?.plan && b.plan.skill.target === 'enemy' && b.plan.targetUid !== this.focusUid) b.plan = undefined;
    }
  }

  get w() {
    return this.opts.w;
  }
  get h() {
    return this.opts.h;
  }

  /** Formation spot for a rank: rank 1 nearest the middle, the party below, foes above. */
  private home(u: Unit): { x: number; y: number } {
    const side = this.battle.units.filter((o) => o.side === u.side);
    const n = Math.max(1, side.length);
    const i = Math.max(0, side.indexOf(u));
    const { w, h } = this.opts;
    // Front two ranks a little forward, back ranks behind, spread across.
    const x = w * (0.5 + (i - (n - 1) / 2) * Math.min(0.22, 0.86 / n));
    const depth = (u.rank - 1) * 0.07 * h;
    const y = u.side === 'party' ? h * 0.66 + depth : h * 0.3 - depth;
    return { x, y: Math.max(20, Math.min(h - 10, y)) };
  }

  private addBody(u: Unit, near?: Body): Body {
    if (u.side === 'enemy') {
      u.atk = Math.round(u.atk * FIELD_ENEMY_ATK);
      const full = u.hp >= u.maxHp;
      if (!u.boss) u.maxHp = Math.round(u.maxHp * FIELD_ENEMY_HP);
      if (full) u.hp = u.maxHp;
    }
    const home = this.home(u);
    let { x, y } = home;
    const carried = u.side === 'party' ? this.opts.carry?.get(u.ref) : undefined;
    if (carried) ({ x, y } = carried);
    if (near) {
      x = near.x + (this.rng() - 0.5) * 60 * this.k;
      y = near.y - 10 * this.k;
    } else if (u.side === 'enemy' && this.opts.enemiesEnter) {
      // The next wave walks in out of the dark at either side.
      x = x < this.opts.w / 2 ? -40 - this.rng() * 50 : this.opts.w + 40 + this.rng() * 50;
    }
    const reach = reachOf(u);
    const fast = u.side === 'enemy' ? Math.max(0.75, Math.min(1.35, 0.7 + u.spd * 0.04)) : 1;
    const b: Body = {
      uid: u.uid,
      x,
      y,
      reach,
      // Foes that shoot stand a little closer than Sisters do, so melee Sisters can get at them.
      range: (reach === 'melee' ? REACH.melee * (this.opts.bodyScale ?? 1) : REACH[reach] * (u.side === 'enemy' ? ENEMY_SHOOT : 1)) * this.k * (u.boss ? 1.2 : 1),
      speed: (u.side === 'party' ? 92 : 78) * fast * this.k,
      radius: (u.boss ? 44 : 27) * this.k * (this.opts.bodyScale ?? 1),
      // Not everyone strikes at once at the start.
      timer: 0.3 + this.rng() * 0.8,
      lock: 0,
      face: u.side === 'party' ? 1 : -1,
      moving: false,
      ready: false,
      homeX: home.x,
      homeY: home.y,
      entering: x < 0 || x > this.opts.w,
    };
    this.bodies.set(u.uid, b);
    return b;
  }

  /** Seconds between this unit's actions: faster units act a little more often. */
  interval(u: Unit) {
    const f = Math.max(0.8, Math.min(1.25, 1 + (10 - u.spd) * 0.025));
    return ACT_SEC * f * (u.status.haste ? 0.8 : 1) * (u.side === 'party' ? SISTER_PACE : 1);
  }

  private dist(a: Body, b: Body) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /** The nearest living foe of a unit. */
  nearestFoe(u: Unit): Unit | undefined {
    const me = this.bodies.get(u.uid)!;
    let best: Unit | undefined;
    let bd = Infinity;
    for (const f of this.battle.alive(u.side === 'party' ? 'enemy' : 'party')) {
      const b = this.bodies.get(f.uid);
      if (!b) continue;
      const d = this.dist(me, b);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  /** The skill and target a unit wants, by the same brains as the turn-based Auto player and enemies. */
  private choose(u: Unit, out: FieldEvent[] = []): Body['plan'] {
    if (u.side === 'enemy') {
      // Nothing it can use from where it stands (it waits, as in the turn-based game).
      if (!skillsFor(u).some((s) => this.battle.canUse(u, s))) return undefined;
      const c = this.battle.enemyChoose(u);
      return { skill: c.skill, targetUid: c.target?.uid, age: 0 };
    }
    // A Sister knocked out of her ranks trades places with a neighbour first
    // (the free Step of the turn-based game), so rank-bound kits keep working.
    const partner = autoStep(this.battle, u);
    if (partner) {
      const events = this.battle.step(u, partner);
      if (events.length) {
        this.reform();
        out.push({ kind: 'tick', events });
      }
    }
    const c = autoChoose(this.battle, u, { noRite: this.opts.manualLitany });
    if (!c.skill || (c.skill.rite && this.opts.manualLitany)) return undefined;
    const target = c.skill.target === 'enemy' ? this.preferredFoe(u, c.skill) ?? c.target : c.target;
    return { skill: c.skill, targetUid: target?.uid, age: 0 };
  }

  /**
   * Who a Sister strikes, by her class: the player's Focus first, then
   * Veilblades the furthest-back foe, Arbalists the hardest-hitting, Exorcists
   * a boss (or the most blessed foe). Everyone else keeps the Auto player's pick.
   */
  preferredFoe(u: Unit, s: SkillDef): Unit | undefined {
    const legal = this.battle.validTargets(u, s);
    if (!legal.length) return undefined;
    const focus = this.focusUid ? legal.find((x) => x.uid === this.focusUid) : undefined;
    if (focus) return focus;
    const best = (score: (x: Unit) => number) => [...legal].sort((a, c) => score(c) - score(a))[0];
    switch (u.classId) {
      case 'veilblade':
        return best((x) => x.rank * 10 - x.hp / x.maxHp);
      case 'arbalist':
        return best((x) => x.atk * (x.boss ? 1.2 : 1));
      case 'exorcist':
        return best((x) => (x.boss ? 1000 : 0) + Object.keys(x.status).length * 10 + x.atk / 100);
      default:
        return undefined;
    }
  }

  private inReach(me: Body, t: Unit) {
    const tb = this.bodies.get(t.uid)!;
    return this.dist(me, tb) <= me.range + tb.radius;
  }

  /** The closest foe this skill may hit. */
  private nearestLegal(u: Unit, s: SkillDef): Unit | undefined {
    const me = this.bodies.get(u.uid)!;
    return [...this.battle.validTargets(u, s)].sort((a, c) => this.dist(me, this.bodies.get(a.uid)!) - this.dist(me, this.bodies.get(c.uid)!))[0];
  }

  /** Where a plan has to reach: its target, or (group strikes) the nearest foe. None = act at once. */
  private aimOf(u: Unit, plan: NonNullable<Body['plan']>): Unit | undefined {
    const s = plan.skill;
    if (s.target === 'self' || s.target === 'allAllies') return undefined;
    if (s.target === 'allEnemies') return this.nearestFoe(u);
    const t = plan.targetUid ? this.battle.get(plan.targetUid) : undefined;
    return t && t.hp > 0 ? t : undefined;
  }

  /** Advances the fight by dt seconds. Returns what happened, for the view to draw. */
  update(dt: number): FieldEvent[] {
    const out: FieldEvent[] = [];
    if (this.done) return out;
    const b = this.battle;
    this.time += dt;

    // Rounds tick on a clock, from the first blow: the walk in costs no candle.
    if (b.round === 0 || (this.engaged && (this.roundClock += dt) >= ROUND_SEC)) {
      this.roundClock = 0;
      const events: BattleEvent[] = [];
      if (b.roundLimit && b.round >= b.roundLimit) {
        b.timeUp = true;
        events.push({ type: 'text', text: 'The hunt is over. The beast withdraws into the dark.' });
      } else b.startRound(events);
      b.queue = [];
      if (events.length) out.push({ kind: 'tick', events });
    }

    for (const u of b.alive()) {
      const me = this.bodies.get(u.uid);
      if (!me) continue;
      me.lock = Math.max(0, me.lock - dt);
      me.timer -= dt;
      me.moving = false;
      if (me.lock > 0) continue;

      // Ready: start-of-turn effects (once per action), then decide.
      if (me.timer <= 0 && !me.ready) {
        const events: BattleEvent[] = [];
        const ok = b.beginTurn(u, events);
        if (events.length) out.push({ kind: 'tick', events });
        if (!ok || u.hp <= 0) {
          me.timer = this.interval(u);
          continue;
        }
        me.ready = true;
        me.waited = 0;
      }
      if (me.ready) me.waited = (me.waited ?? 0) + dt;
      if (me.ready && !me.plan) {
        me.plan = this.choose(u, out);
        if (!me.plan) me.timer = 0.4; // nothing worth doing yet: think again shortly
      }

      let goal: Unit | undefined;
      if (me.plan) {
        me.plan.age += dt;
        const aim = this.aimOf(u, me.plan);
        const s = me.plan.skill;
        const needsAim = s.target === 'enemy' || s.target === 'ally' || s.target === 'allEnemies';
        if (needsAim && !aim) {
          me.plan = undefined; // the target fell: think again next frame
          continue;
        }
        // Too long chasing one foe: strike the nearest one it may legally hit instead.
        if (me.plan.age > 2.5 && s.target === 'enemy' && aim) {
          const near = this.nearestLegal(u, s);
          if (near && near !== aim) {
            me.plan.targetUid = near.uid;
            continue;
          }
        }
        const inReach = !aim || aim === u || this.inReach(me, aim);
        if (inReach || me.plan.age > 5) {
          this.perform(u, me, me.plan.skill, me.plan.targetUid, out);
          me.plan = undefined;
          continue;
        }
        goal = aim;
      } else goal = this.nearestFoe(u);

      // A new wave: the Sisters fall back into formation while the foes walk in.
      if (this.opts.carry && u.side === 'party' && this.time < 1.8 && !me.plan) {
        this.walkTo(me, me.homeX, me.homeY, dt);
        continue;
      }
      me.goalUid = goal?.uid;
      this.steer(u, me, goal, dt);
    }

    this.separate();
    const outcome = b.outcome();
    if (outcome) {
      this.done = true;
      out.push({ kind: 'end', outcome });
    }
    return out;
  }

  private perform(u: Unit, me: Body, skill: SkillDef, targetUid: string | undefined, out: FieldEvent[], free = false) {
    const b = this.battle;
    const target = targetUid ? b.get(targetUid) : undefined;
    const charge = u.side === 'enemy' && !!skill.windup && !u.status.charging;
    if (target && target !== u) me.face = this.bodies.get(target.uid)!.x >= me.x ? 1 : -1;
    this.engaged = true;
    const litany = !!skill.rite && u.side === 'party';
    const link = litany ? this.chainLeft() > 0 ? this.chain.count + 1 : 1 : 0;
    if (litany) b.chainMult = 1 + chainBonus(link);
    const events = b.act(u, skill, target && target.hp > 0 ? target : undefined);
    b.chainMult = 1;
    if (litany) {
      this.chain.count = link;
      this.chain.at = this.time;
      this.chain.best = Math.max(this.chain.best, link);
      if (link >= 2) events.push({ type: 'text', text: `CHAIN x${link}!` }, ...b.kindle(CHAIN_ZEAL, u));
    }
    me.lock = skill.rite ? LITANY_SEC : SWING_SEC;
    // A tapped Litany is a free action: her own clock carries on.
    if (!free) {
      me.ready = false;
      // Time spent walking into reach is not lost: the next action comes that
      // much sooner (up to most of a beat), so walkers keep pace with casters.
      me.timer = this.interval(u) - Math.min(me.waited ?? 0, this.interval(u) * MAX_CATCHUP);
      me.waited = 0;
    }
    // Another action at once (Coup de Grâce): in turn order she goes to the front
    // of the queue; on the field she strikes again as soon as the swing ends.
    if (b.queue[0] === u.uid) {
      b.queue.shift();
      me.timer = Math.min(me.timer, me.lock + EXTRA_SEC);
    }
    // A taunt turns the foes: plans aimed at anyone else are dropped.
    if (events.some((e) => e.type === 'status' && /^Taunt/.test((e as { label?: string }).label ?? ''))) {
      for (const f of b.alive(u.side === 'party' ? 'enemy' : 'party')) {
        const fb = this.bodies.get(f.uid);
        if (fb?.plan && fb.plan.skill.target === 'enemy' && fb.plan.targetUid !== u.uid) fb.plan = undefined;
      }
    }
    // Ranks moved (Processional, Stride, Step, pulls): the formation follows.
    if (events.some((e) => e.type === 'move')) this.reform();
    this.applyDelays();
    out.push({ kind: 'act', uid: u.uid, skill, targetUid, events, ranged: me.reach !== 'melee', litany: !!skill.rite && !charge, charge });
    this.addSummons(me, out);
  }

  /** Summoned foes get bodies beside whoever called them. */
  private addSummons(caller: Body, out: FieldEvent[]) {
    for (const u of this.battle.units) {
      if (this.bodies.has(u.uid)) continue;
      const nb = this.addBody(u, caller);
      // A summoned foe needs a beat to rise before it acts (as it waits for the next round in turn order).
      nb.timer = this.interval(u);
      out.push({ kind: 'spawn', uid: u.uid });
    }
  }

  /** New formation spots after ranks change; bodies drift there when idle. */
  private reform() {
    for (const u of this.battle.units) {
      const me = this.bodies.get(u.uid);
      if (!me) continue;
      const home = this.home(u);
      me.homeX = home.x;
      me.homeY = home.y;
    }
  }

  /** Delay in real time: the struck unit's next action comes later. */
  private applyDelays() {
    for (const u of this.battle.units) {
      if (!u.status.delayed) continue;
      u.status.delayed = false;
      const me = this.bodies.get(u.uid);
      if (me) {
        me.timer += DELAY_SEC;
        me.plan = undefined;
      }
    }
  }

  /** Walk toward the goal until in reach; ranged fighters back off from foes that crowd them. */
  private steer(u: Unit, me: Body, goal: Unit | undefined, dt: number) {
    if (!goal || goal === u) return;
    const g = this.bodies.get(goal.uid);
    if (!g) return;
    if (me.reach === 'melee' && goal.side !== u.side && u.side === 'party') {
      const spot = this.meleeSpot(u, me, g);
      if (spot) {
        // Already close enough to strike: stand and wait for the swing.
        if (Math.hypot(g.x - me.x, g.y - me.y) <= me.range + g.radius && Math.hypot(spot.x - me.x, spot.y - me.y) < me.radius) return;
        this.walkTo(me, spot.x, spot.y, dt);
        if (Math.abs(g.x - me.x) > 4) me.face = g.x > me.x ? 1 : -1;
        this.clamp(me);
        return;
      }
    }
    const dx = g.x - me.x;
    const dy = g.y - me.y;
    const d = Math.hypot(dx, dy) || 1;
    const want = me.range * 0.85 + g.radius * 0.5;
    let step = 0;
    if (d > want) step = Math.min(me.speed * dt, d - want);
    else if (me.reach !== 'melee' && goal.side !== u.side && d < me.range * 0.4) step = -me.speed * 0.6 * dt;
    if (step) {
      const dir = step > 0 ? this.avoid(me, dx / d, dy / d, g.uid) : { x: dx / d, y: dy / d };
      me.x += dir.x * step;
      me.y += dir.y * step;
      me.moving = true;
    }
    if (Math.abs(dx) > 4) me.face = dx > 0 ? 1 : -1;
    this.clamp(me);
  }

  /**
   * An open spot beside a foe: melee fighters sharing one foe fan out around
   * it (from the side they came from) instead of queuing behind each other.
   */
  private meleeSpot(u: Unit, me: Body, g: Body): { x: number; y: number } | undefined {
    const sharing = [...this.bodies.values()]
      .filter((o) => o.goalUid === g.uid && o.reach === 'melee' && this.battle.get(o.uid)?.side === u.side && this.battle.get(o.uid)!.hp > 0)
      .map((o) => o.uid)
      .sort();
    if (!sharing.includes(me.uid)) sharing.push(me.uid);
    if (sharing.length < 2) return undefined;
    const i = sharing.indexOf(me.uid);
    // Fan out around the side of the foe facing this unit's own line.
    const base = Math.atan2(u.side === 'party' ? 1 : -1, 0);
    const ang = base + (i - (sharing.length - 1) / 2) * SLOT_SPREAD;
    const r = me.range * 0.8 + g.radius;
    return { x: g.x + Math.cos(ang) * r, y: g.y + Math.sin(ang) * r };
  }

  private walkTo(me: Body, x: number, y: number, dt: number) {
    const dx = x - me.x;
    const dy = y - me.y;
    const d = Math.hypot(dx, dy);
    if (d < 3) return;
    const step = Math.min(me.speed * dt, d);
    const dir = this.avoid(me, dx / d, dy / d);
    me.x += dir.x * step;
    me.y += dir.y * step;
    me.moving = true;
    if (Math.abs(dx) > 4) me.face = dx > 0 ? 1 : -1;
  }

  /**
   * Steers around bodies in the way: anyone standing just ahead on the line of
   * travel turns the step sideways, toward the side the walker is already on,
   * so a Sister goes round a boss instead of pushing into its back.
   */
  private avoid(me: Body, ux: number, uy: number, goalUid?: string): { x: number; y: number } {
    const look = 90 * this.k;
    let sx = 0;
    let sy = 0;
    for (const u of this.battle.alive()) {
      if (u.uid === me.uid || u.uid === goalUid) continue;
      const o = this.bodies.get(u.uid);
      if (!o) continue;
      const rx = o.x - me.x;
      const ry = o.y - me.y;
      const ahead = rx * ux + ry * uy;
      if (ahead <= 0 || ahead > look + o.radius) continue;
      const side = rx * -uy + ry * ux; // signed distance off the line
      const clear = me.radius + o.radius;
      if (Math.abs(side) >= clear) continue;
      // Turn away from it, harder the closer and more central it is.
      const push = (1 - Math.abs(side) / clear) * (1 - ahead / (look + o.radius + 1));
      const away = side >= 0 ? -1 : 1;
      sx += -uy * away * push * 1.6;
      sy += ux * away * push * 1.6;
    }
    if (!sx && !sy) return { x: ux, y: uy };
    const nx = ux + sx;
    const ny = uy + sy;
    const n = Math.hypot(nx, ny) || 1;
    return { x: nx / n, y: ny / n };
  }

  /** Nobody stands inside anyone else. */
  private separate() {
    const alive = this.battle.alive().map((u) => this.bodies.get(u.uid)).filter((x): x is Body => !!x);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i];
        const c = alive[j];
        const min = a.radius + c.radius;
        let dx = c.x - a.x;
        let dy = c.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 0.01) {
          dx = this.rng() - 0.5;
          dy = this.rng() - 0.5;
          d = Math.hypot(dx, dy);
        }
        // Big bodies (bosses) barely budge; the small ones step around them.
        const wa = 1 / a.radius ** 2;
        const wc = 1 / c.radius ** 2;
        const push = min - d;
        a.x -= (dx / d) * push * (wa / (wa + wc));
        a.y -= (dy / d) * push * (wa / (wa + wc));
        c.x += (dx / d) * push * (wc / (wa + wc));
        c.y += (dy / d) * push * (wc / (wa + wc));
        this.clamp(a);
        this.clamp(c);
      }
    }
  }

  private clamp(me: Body) {
    const m = 18 * this.k;
    // Foes walking in from beyond an edge may stand outside until they arrive.
    if (me.entering && me.x >= m && me.x <= this.opts.w - m) me.entering = false;
    if (!me.entering) me.x = Math.max(m, Math.min(this.opts.w - m, me.x));
    me.y = Math.min(this.opts.h - 6, Math.max(Math.max(36 * this.k, this.opts.h * 0.14), me.y));
  }

  /** Seconds left to link the next Litany into the Chain (0 = no Chain open). */
  chainLeft() {
    return this.chain.count > 0 ? Math.max(0, CHAIN_SEC - (this.time - this.chain.at)) : 0;
  }

  /** True when a Sister's Litany can be cast now (manual mode). */
  litanyReady(u: Unit) {
    const rite = skillsFor(u).find((s) => s.rite);
    return !!rite && u.hp > 0 && (u.zeal ?? 0) >= ZEAL_MAX && !this.done && this.battle.canUse(u, rite);
  }

  /** Who a Sister's Litany may be aimed at (empty when it needs no aim). */
  litanyTargets(uid: string): Unit[] {
    const u = this.battle.get(uid);
    const rite = u && skillsFor(u).find((s) => s.rite);
    if (!u || !rite || (rite.target !== 'enemy' && rite.target !== 'ally')) return [];
    return this.battle.validTargets(u, rite);
  }

  /**
   * The player taps a Sister whose Zeal is full: her Litany fires at once,
   * wherever she stands, on the best target (or on `aimUid`, when the player
   * dragged it onto someone it may reach).
   */
  castLitany(uid: string, aimUid?: string): FieldEvent | undefined {
    const u = this.battle.get(uid);
    if (!u || u.side !== 'party' || !this.litanyReady(u)) return undefined;
    const rite = skillsFor(u).find((s) => s.rite)!;
    const me = this.bodies.get(uid)!;
    const targets = this.battle.validTargets(u, rite);
    const aimed = aimUid ? targets.find((t) => t.uid === aimUid) : undefined;
    const target = aimed ?? [...targets].sort((x, y) => this.battle.preview(u, rite, y) - this.battle.preview(u, rite, x))[0];
    const out: FieldEvent[] = [];
    this.perform(u, me, rite, rite.target === 'enemy' || rite.target === 'ally' ? target?.uid : undefined, out, true);
    me.plan = undefined;
    return out[0];
  }

  /**
   * Before the fight: two Sisters trade places (and ranks), so the player can
   * set the formation on the battle screen itself.
   */
  swapPlaces(a: string, c: string): boolean {
    const x = this.battle.get(a);
    const y = this.battle.get(c);
    if (!x || !y || x === y || x.side !== 'party' || y.side !== 'party' || this.time > 0) return false;
    [x.rank, y.rank] = [y.rank, x.rank];
    // Their places across the line trade too.
    const us = this.battle.units;
    const i = us.indexOf(x);
    const j = us.indexOf(y);
    [us[i], us[j]] = [us[j], us[i]];
    this.reform();
    for (const u of [x, y]) {
      const b = this.bodies.get(u.uid)!;
      b.x = b.homeX;
      b.y = b.homeY;
    }
    return true;
  }

  /** Where every living Sister stands, by Sister id (to carry into the next wave). */
  partyPositions() {
    const m = new Map<string, { x: number; y: number }>();
    for (const u of this.battle.units) {
      const b = this.bodies.get(u.uid);
      if (u.side === 'party' && b) m.set(u.ref, { x: b.x, y: b.y });
    }
    return m;
  }
}

/** The battle screen's field (540 x 450, figures at 1.45): also played headless in the background. */
export const SCREEN_FIELD = { w: 540, h: 450, bodyScale: 1.45 };

export function screenField(battle: Battle, manualLitany: boolean) {
  return new FieldBattle(battle, { ...SCREEN_FIELD, manualLitany });
}

/** Steps a field fight forward by `sec` seconds in small steps. Returns the outcome if it ended. */
export function advanceField(f: FieldBattle, sec: number): 'victory' | 'defeat' | undefined {
  const dt = 1 / 20;
  for (let t = 0; t < sec; t += dt) {
    for (const e of f.update(dt)) if (e.kind === 'end') return e.outcome;
  }
  return undefined;
}

/** Plays a whole fight with no view (tests, balance checks). */
export function simulateField(battle: Battle, opts: Omit<FieldOpts, 'w' | 'h'> & { w?: number; h?: number } = {}, maxSec = 240) {
  const f = new FieldBattle(battle, { w: 540, h: 600, ...opts });
  const dt = 1 / 20;
  let litanies = 0;
  for (let t = 0; t < maxSec; t += dt) {
    for (const e of f.update(dt)) {
      if (e.kind === 'act' && e.litany && battle.get(e.uid).side === 'party') litanies++;
      if (e.kind === 'end') return { outcome: e.outcome, seconds: f.time, rounds: battle.round, litanies };
    }
  }
  return { outcome: 'stalled' as const, seconds: f.time, rounds: battle.round, litanies };
}
