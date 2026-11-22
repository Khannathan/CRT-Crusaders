import { AFFINITY, ENEMIES } from '../data/enemies';
import { CLASS_SKILLS, SHIFT_SKILL, type DmgType, type SkillDef } from '../data/skills';
import type { PassiveDef } from '../data/types';
import type { Howl } from '../data/hounds';
import { howlShort } from './hounds';
import type { Rng } from './gacha';

export type Side = 'party' | 'enemy';

/** A hound's howl as a battle sees it. */
export interface HoundHowl {
  name: string;
  howlName: string;
  howl: Howl;
}

export interface Status {
  /** Burn (Fire) or Poison (Blight): damage each turn, ignoring armor. */
  poison?: { dmg: number; turns: number; kind?: 'burn' | 'poison' };
  /** Bleeding (Steel): damage each turn, ignoring armor. */
  bleed?: { dmg: number; turns: number };
  /** Turns left to lose. */
  stun?: number;
  sunder?: { pct: number; turns: number };
  hex?: { pct: number; turns: number };
  /** Rounds left acting first. */
  haste?: number;
  regen?: { pct: number; turns: number };
  ward?: { pct: number; turns: number };
  weaken?: { pct: number; turns: number };
  empower?: { pct: number; turns: number };
  accused?: number;
  taunt?: number;
  shield?: number;
  delayed?: boolean;
  /** Enemy is winding up its planned skill; it fires next turn unless delayed. */
  charging?: boolean;
}

/** What an enemy will do on its next turn, shown to the player in advance. */
export interface Intent {
  skillId: string;
  targetUid?: string;
}

export type IntentKind = 'attack' | 'aoe' | 'debuff' | 'summon' | 'charge' | 'buff';

export interface IntentView {
  kind: IntentKind;
  skill: SkillDef;
  /** Party units this move will land on (empty for summons). */
  targets: Unit[];
  /** Expected damage per target before crits, Accused and shields. */
  estimate: number;
  /** True while the enemy is charging: the hit comes on its following turn. */
  charging: boolean;
}

export interface Unit {
  uid: string;
  /** Her Holy Symbol's battle effects, once woken. */
  symbol?: import('./symbols').SymbolCombat;
  side: Side;
  name: string;
  /** Crusader id or enemy type id. */
  ref: string;
  /** Class id for crusaders. */
  classId?: string;
  rank: number;
  maxHp: number;
  hp: number;
  atk: number;
  armor: number;
  /** Cuts Magic damage the way armor cuts Physical. */
  mres: number;
  /** The damage her hits deal unless a skill says otherwise. */
  dmg?: DmgType;
  spd: number;
  crit: number;
  status: Status;
  boss?: boolean;
  passive?: PassiveDef;
  /** Set once an Unbroken passive has saved this unit. */
  spentUnbroken?: boolean;
  /** Enemies: the move planned for their next turn. */
  intent?: Intent;
  /** Enemies: the skill used last turn, to avoid repeating big moves. */
  lastSkill?: string;
  /** Bosses: 2 once the second phase has begun. */
  phase?: number;
  /** Crusaders: Vow rank, which upgrades skills (see VOW_UPGRADES). */
  vow?: number;
  /** Crusaders: skill levels 1-5 (three skills and the Rite), each +6% effect a level. */
  skillLv?: number[];
  /** Own turns left before each skill can be used again. */
  cooldowns?: Record<string, number>;
  /** Crusaders: has taken this turn's free Step. */
  stepped?: boolean;
  /** Crusaders: her Order, for Order weaknesses. */
  order?: string;
  /** Enemies: the Order whose Sisters it fears (they deal +25% and take -15% from it). */
  bane?: string;
}

export type BattleEvent =
  | { type: 'damage'; uid: string; amount: number; blocked: number; crit?: boolean }
  | { type: 'heal'; uid: string; amount: number }
  | { type: 'shield'; uid: string; amount: number }
  | { type: 'status'; uid: string; label: string }
  | { type: 'death'; uid: string }
  | { type: 'summon'; uid: string }
  | { type: 'move'; uid: string }
  | { type: 'zeal'; amount: number; reason: string }
  | { type: 'intent' }
  | { type: 'phase'; uid: string; text: string }
  | { type: 'text'; text: string };

export interface TurnStart {
  actor?: Unit;
  events: BattleEvent[];
  outcome?: 'victory' | 'defeat';
}

/** Bump when combat numbers change, so logged runs can be compared fairly. */
export const BALANCE_VERSION = '0.8';
/** Execute skills hit harder below this share of max HP. */
export const EXECUTE_AT = 0.3;

export const ZEAL_MAX = 100;
export const VIGIL_DEFAULT = 8;
/** Enemy attack bonus per round after the Vigil candle goes out. */
export const RAGE_STEP = 0.15;
const ACCUSED_MULT = 1.25;
/** Sisters of an enemy's bane Order hit it this much harder and take this much less from it. */
export const BANE_MULT = 1.25;
export const BANE_GUARD = 0.85;

export const CRIT_MULT = 1.5;
/** Armor scale: damage is divided by (1 + armor / ARMOR_K). */
export const ARMOR_K = 100;

// Zeal economy (from the balance research doc): a first Rite around rounds 4-6.
/** Per party action that hits an enemy, however many targets. */
export const ZEAL_ON_ATTACK = 4;
/** Per party action that heals someone at least 5% of max HP, or shields. */
export const ZEAL_ON_SUPPORT = 3;
/** +1 per full 5% of max HP the party loses to enemies... */
const HURT_STEP = 0.05;
/** ...up to this much per round. */
export const ZEAL_HURT_CAP = 8;

export function skillsFor(u: Unit): SkillDef[] {
  if (u.side === 'enemy') {
    const d = ENEMIES[u.ref];
    return u.phase === 2 && d.phase2 ? d.phase2.skills : d.skills;
  }
  const vow = u.vow ?? 0;
  return [
    ...CLASS_SKILLS[u.classId!].map((s, i) => leveled(VOW_UPGRADES.some(([v, idx]) => idx === i && vow >= v) ? upgraded(s) : s, u.skillLv?.[i] ?? 1)),
    SHIFT_SKILL,
  ];
}

const levelCache = new Map<string, SkillDef>();
/** A skill at a level above 1: +6% effect a level (see skillLevels.ts). */
export function leveled(s: SkillDef, lv: number): SkillDef {
  if (lv <= 1) return s;
  const key = `${s.id}:${s.name}:${lv}`;
  const hit = levelCache.get(key);
  if (hit) return hit;
  const f = 1 + 0.06 * (lv - 1);
  const up = (n?: number) => (n === undefined ? undefined : Math.round(n * f * 100) / 100);
  const out: SkillDef = {
    ...s,
    mult: up(s.mult),
    heal: up(s.heal),
    healPct: up(s.healPct),
    shieldPct: up(s.shieldPct),
    poison: s.poison && { ...s.poison, mult: up(s.poison.mult)! },
    bleed: s.bleed && { ...s.bleed, mult: up(s.bleed.mult)! },
  };
  levelCache.set(key, out);
  return out;
}

/** [vow rank, skill index]: duplicate pulls upgrade a skill at these Vow ranks (index 3 is the Rite). */
export const VOW_UPGRADES: [number, number][] = [
  [2, 0],
  [4, 1],
  [5, 3],
];

const upgradeCache = new Map<string, SkillDef>();
/** A Vow-upgraded skill: +25% effect, one turn less cooldown, and a + on its name. */
export function upgraded(s: SkillDef): SkillDef {
  const hit = upgradeCache.get(s.id);
  if (hit) return hit;
  const up = (n?: number) => (n === undefined ? undefined : Math.round(n * 1.25 * 100) / 100);
  const u: SkillDef = {
    ...s,
    id: s.id,
    name: `${s.name}+`,
    desc: `${s.desc} (Vow: +25% effect${s.cooldown ? ', -1 cooldown' : ''}.)`,
    mult: up(s.mult),
    heal: up(s.heal),
    healPct: up(s.healPct),
    shieldPct: up(s.shieldPct),
    poison: s.poison && { ...s.poison, mult: up(s.poison.mult)! },
    bleed: s.bleed && { ...s.bleed, mult: up(s.bleed.mult)! },
    cooldown: s.cooldown ? s.cooldown - 1 : undefined,
  };
  upgradeCache.set(s.id, u);
  return u;
}

/** Run-wide modifiers from crypt relics (all 0 by default). */
export interface BattleMods {
  burnMult: number;
  detonateMult: number;
  openingBurn: number;
  roundZeal: number;
  zealMult: number;
  riteMult: number;
  lowHpAtk: number;
  fallenAtk: number;
  fallHeal: number;
}
export const NO_MODS: BattleMods = { burnMult: 0, detonateMult: 0, openingBurn: 0, roundZeal: 0, zealMult: 0, riteMult: 0, lowHpAtk: 0, fallenAtk: 0, fallHeal: 0 };

export class Battle {
  units: Unit[];
  zeal: number;
  round = 0;
  vigil: number;
  rage = 0;
  /** uids still to act this round, in order. */
  queue: string[] = [];
  /** Every action and Zeal change, for balance comparisons. */
  log: string[] = [];
  private rng: Rng;
  private summons = 0;
  private hurtFrac = 0;
  private hurtZealThisRound = 0;
  private enemyScale: number;
  /** Multiplies healing the party receives (an Inquisition edict halves it). */
  partyHeal = 1;
  /** Crypt relic effects. */
  mods: BattleMods = { ...NO_MODS };
  /** The party's hound: it howls at the start of every round. */
  hound?: HoundHowl;

  constructor(party: Unit[], enemies: Unit[], opts: { rng?: Rng; vigil?: number; zeal?: number; enemyScale?: number; mods?: Partial<BattleMods>; hound?: HoundHowl } = {}) {
    this.mods = { ...NO_MODS, ...opts.mods };
    this.hound = opts.hound;
    this.enemyScale = opts.enemyScale ?? 1;
    this.units = [...party, ...enemies];
    this.rng = opts.rng ?? Math.random;
    this.vigil = opts.vigil ?? VIGIL_DEFAULT;
    const passiveZeal = party.reduce((s, u) => s + (u.passive?.kind === 'startZeal' ? u.passive.value ?? 0 : 0), 0);
    this.zeal = Math.min(ZEAL_MAX, (opts.zeal ?? 0) + passiveZeal);
    for (const e of enemies) this.planIntent(e);
    // Relics that set the foes alight before the first blow.
    if (this.mods.openingBurn > 0 && party.length) {
      const avg = party.reduce((n, u) => n + u.atk, 0) / party.length;
      const dmg = Math.max(1, Math.round(avg * this.mods.openingBurn * (1 + this.mods.burnMult)));
      for (const e of enemies) e.status.poison = { dmg, turns: 3, kind: 'burn' };
    }
  }

  /** A party member's damage multiplier from relics: wounded, fallen Sisters, Rites. */
  private relicMult(actor: Unit, skill: SkillDef) {
    if (actor.side !== 'party') return 1;
    const m = this.mods;
    const fallen = this.units.filter((u) => u.side === 'party' && u.hp <= 0).length;
    let f = (1 + fallen * m.fallenAtk + (actor.hp < actor.maxHp / 2 ? m.lowHpAtk : 0)) * (actor.symbol?.mult ?? 1);
    if (skill.rite) f *= (1 + m.riteMult) * (1 + (actor.symbol?.rite ?? 0));
    return f;
  }

  /** Holy Symbol: +10% at +5, a Confessor's +20% at +10, and the Rite bonus at +15. */
  private symbolHeal(actor: Unit, skill: SkillDef) {
    const sy = actor.symbol;
    if (!sy) return 1;
    return sy.mult * sy.heal * (skill.rite ? 1 + sy.rite : 1);
  }

  private detonateOf(actor: Unit) {
    return actor.side === 'party' ? 1 + this.mods.detonateMult : 1;
  }

  private healOf(u: Unit) {
    return u.side === 'party' ? this.partyHeal : 1;
  }

  alive(side?: Side) {
    return this.units.filter((u) => u.hp > 0 && (!side || u.side === side)).sort((a, b) => a.rank - b.rank);
  }

  get(uid: string) {
    return this.units.find((u) => u.uid === uid)!;
  }

  outcome(): 'victory' | 'defeat' | undefined {
    if (!this.alive('party').length) return 'defeat';
    if (!this.alive('enemy').length) return 'victory';
    return undefined;
  }

  /** Turn order for display: who acts after the current actor this round. */
  upcoming(): Unit[] {
    return this.queue.map((id) => this.get(id)).filter((u) => u.hp > 0);
  }

  private startRound(events: BattleEvent[]) {
    this.round += 1;
    this.hurtZealThisRound = 0;
    this.log.push(`-- round ${this.round} (zeal ${this.zeal}, vigil ${this.vigil})`);
    if (this.mods.roundZeal > 0 && this.alive('party').length) this.addZeal(this.mods.roundZeal, events, 'relics');
    this.howl(events);
    if (this.round > 1) {
      if (this.vigil > 0) {
        this.vigil -= 1;
        if (this.vigil === 0) events.push({ type: 'text', text: 'The Vigil candle gutters out. Pray harder, Sisters.' });
      } else {
        this.rage += 1;
        events.push({ type: 'text', text: 'The candle is dead. The heretics grow bolder.' });
      }
    }
    const order = this.alive().sort((a, b) => {
      const da = a.status.delayed ? 1 : 0;
      const db = b.status.delayed ? 1 : 0;
      if (da !== db) return da - db;
      const ha = a.status.haste ? 1 : 0;
      const hb = b.status.haste ? 1 : 0;
      if (ha !== hb) return hb - ha;
      if (b.spd !== a.spd) return b.spd - a.spd;
      if (a.side !== b.side) return a.side === 'party' ? -1 : 1;
      return a.rank - b.rank;
    });
    order.forEach((u) => {
      u.status.delayed = false;
      if (u.status.haste && --u.status.haste <= 0) u.status.haste = undefined;
    });
    this.queue = order.map((u) => u.uid);
  }

  /** The hound's howl at the start of a round: Zeal, mending, a shield on the front Sister, and the foes' scent. */
  private howl(events: BattleEvent[]) {
    const h = this.hound?.howl;
    const party = this.alive('party');
    if (!h || !party.length) return;
    events.push({ type: 'text', text: `${this.hound!.name}: ${this.hound!.howlName}! ${howlShort(h)}` });
    this.log.push(`howl ${this.hound!.howlName}`);
    if (h.zeal) this.addZeal(h.zeal, events, this.hound!.howlName);
    if (h.mend) {
      const u = [...party].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      const real = Math.min(u.maxHp - u.hp, Math.round(u.maxHp * h.mend * this.healOf(u)));
      if (real > 0) {
        u.hp += real;
        events.push({ type: 'heal', uid: u.uid, amount: real });
      }
    }
    if (h.shield) {
      const front = party[0];
      const amount = Math.round(front.maxHp * h.shield);
      front.status.shield = Math.max(front.status.shield ?? 0, amount);
      events.push({ type: 'shield', uid: front.uid, amount });
    }
    if (h.scent) {
      for (const e of this.alive('enemy')) {
        if ((e.status.sunder?.pct ?? 0) <= h.scent) e.status.sunder = { pct: h.scent, turns: Math.max(2, e.status.sunder?.turns ?? 0) };
        if ((e.status.hex?.pct ?? 0) <= h.scent) e.status.hex = { pct: h.scent, turns: Math.max(2, e.status.hex?.turns ?? 0) };
      }
    }
  }

  /** Advances to the next living actor and applies its start-of-turn effects. */
  nextTurn(): TurnStart {
    const events: BattleEvent[] = [];
    for (let guard = 0; guard < 100; guard++) {
      const done = this.outcome();
      if (done) return { events, outcome: done };
      if (!this.queue.length) this.startRound(events);
      const actor = this.get(this.queue.shift()!);
      if (actor.hp <= 0) continue;

      const st = actor.status;
      st.shield = 0;
      actor.stepped = false;
      if (st.poison) {
        const dmg = Math.min(actor.hp, st.poison.dmg);
        actor.hp -= dmg;
        events.push({ type: 'damage', uid: actor.uid, amount: dmg, blocked: 0 });
        if (actor.side === 'party') this.hurtZeal(actor, dmg, events);
        st.poison.turns -= 1;
        if (st.poison.turns <= 0) st.poison = undefined;
        if (actor.hp <= 0) {
          this.kill(actor, events);
          continue;
        }
        this.checkPhase(actor, events);
      }
      if (st.bleed) {
        const dmg = Math.min(actor.hp, st.bleed.dmg);
        actor.hp -= dmg;
        events.push({ type: 'damage', uid: actor.uid, amount: dmg, blocked: 0 });
        if (actor.side === 'party') this.hurtZeal(actor, dmg, events);
        if (--st.bleed.turns <= 0) st.bleed = undefined;
        if (actor.hp <= 0) {
          this.kill(actor, events);
          continue;
        }
        this.checkPhase(actor, events);
      }
      if (st.regen) {
        const real = Math.min(actor.maxHp - actor.hp, Math.round(actor.maxHp * st.regen.pct * this.healOf(actor)));
        if (real > 0) {
          actor.hp += real;
          events.push({ type: 'heal', uid: actor.uid, amount: real });
        }
        if (--st.regen.turns <= 0) st.regen = undefined;
      }
      if (actor.passive?.kind === 'healAura') {
        for (const a of this.alive(actor.side)) {
          const real = Math.min(a.maxHp - a.hp, Math.round(a.maxHp * (actor.passive.value ?? 0) * this.healOf(a)));
          if (real > 0) {
            a.hp += real;
            events.push({ type: 'heal', uid: a.uid, amount: real });
          }
        }
      }
      if (st.weaken && --st.weaken.turns <= 0) st.weaken = undefined;
      if (st.empower && --st.empower.turns <= 0) st.empower = undefined;
      if (st.accused && --st.accused <= 0) st.accused = undefined;
      if (st.taunt && --st.taunt <= 0) st.taunt = undefined;
      if (st.sunder && --st.sunder.turns <= 0) st.sunder = undefined;
      if (st.hex && --st.hex.turns <= 0) st.hex = undefined;
      if (st.ward && --st.ward.turns <= 0) st.ward = undefined;
      if (st.stun) {
        st.stun -= 1;
        if (st.stun <= 0) st.stun = undefined;
        this.log.push(`${actor.name} is stunned`);
        events.push({ type: 'status', uid: actor.uid, label: 'Stunned' });
        continue;
      }
      return { actor, events };
    }
    return { events, outcome: this.outcome() };
  }

  canUse(actor: Unit, skill: SkillDef): boolean {
    if ((actor.cooldowns?.[skill.id] ?? 0) > 0) return false;
    if (skill.rite && this.zeal < ZEAL_MAX) return false;
    if (skill.from.length && !skill.from.includes(actor.rank)) return false;
    if (skill.summon && this.alive('enemy').length >= 4) return false;
    // Enemy healers only mend when someone is actually hurt.
    if (actor.side === 'enemy' && skill.heal && !this.alive(actor.side).some((u) => u.hp < u.maxHp * 0.85)) return false;
    return this.validTargets(actor, skill).length > 0;
  }

  validTargets(actor: Unit, skill: SkillDef): Unit[] {
    const foes = this.alive(actor.side === 'party' ? 'enemy' : 'party');
    const friends = this.alive(actor.side);
    switch (skill.target) {
      case 'self':
        return [actor];
      case 'ally':
        return friends;
      case 'allAllies':
        return friends;
      case 'allEnemies':
        return foes;
      case 'enemy': {
        let pool = skill.reach?.length ? foes.filter((u) => skill.reach!.includes(u.rank)) : foes;
        const taunting = pool.filter((u) => u.status.taunt);
        if (taunting.length) pool = taunting;
        return pool;
      }
    }
  }

  /** Resolves a skill. `target` is ignored for group and self skills. */
  act(actor: Unit, skill: SkillDef, target?: Unit): BattleEvent[] {
    if (actor.side === 'enemy' && skill.windup && !actor.status.charging) {
      actor.status.charging = true;
      actor.intent = { skillId: skill.id };
      this.log.push(`${actor.name} charges ${skill.name}`);
      return [
        { type: 'text', text: `${actor.name} begins ${skill.name}! Delay it to break the charge.` },
        { type: 'status', uid: actor.uid, label: 'Charging' },
        { type: 'intent' },
      ];
    }
    const events = this.resolve(actor, skill, target);
    if (actor.side === 'enemy') {
      actor.status.charging = false;
      actor.lastSkill = skill.id;
      if (actor.hp > 0) this.planIntent(actor);
      events.push({ type: 'intent' });
    }
    return events;
  }

  private resolve(actor: Unit, skill: SkillDef, target?: Unit): BattleEvent[] {
    const events: BattleEvent[] = [{ type: 'text', text: `${actor.name}: ${skill.name}` }];
    // Each action ticks the actor's cooldowns down, then starts this skill's.
    const cds = (actor.cooldowns ??= {});
    for (const id of Object.keys(cds)) if (cds[id] > 0) cds[id] -= 1;
    if (skill.cooldown) cds[skill.id] = skill.cooldown;
    const single = skill.target === 'enemy' || skill.target === 'ally';
    this.log.push(`${actor.name} uses ${skill.name}${single && target ? ` on ${target.name}` : ''}`);
    if (skill.rite) this.addZeal(-ZEAL_MAX, events, 'Rite');

    if (skill.id === 'shift') {
      this.shift(actor, events);
      return events;
    }

    if (skill.selfDmgPct) {
      const dmg = Math.min(actor.hp - 1, Math.round(actor.maxHp * skill.selfDmgPct));
      if (dmg > 0) {
        actor.hp -= dmg;
        events.push({ type: 'damage', uid: actor.uid, amount: dmg, blocked: 0 });
      }
    }
    if (skill.summon) {
      this.summon(skill.summon, events);
      return events;
    }

    const group = skill.target === 'allAllies' || skill.target === 'allEnemies';
    const targets = group ? this.validTargets(actor, skill) : skill.target === 'self' ? [actor] : target ? [target] : [];
    let offensive = false;
    let support = false;

    for (const t of targets) {
      if (t.hp <= 0) continue;
      if (skill.mult) {
        offensive = true;
        this.hit(actor, t, skill, events);
      }
      if (t.hp <= 0) continue;
      if (skill.heal || skill.healPct) {
        const amount = Math.round((skill.heal ? actor.atk * skill.heal * this.vary() : t.maxHp * skill.healPct!) * this.healOf(t) * this.symbolHeal(actor, skill));
        const real = Math.min(amount, t.maxHp - t.hp);
        t.hp += real;
        if (real >= t.maxHp * 0.05) support = true;
        events.push({ type: 'heal', uid: t.uid, amount: real });
      }
      if (skill.cleanse && (t.status.poison || t.status.bleed)) {
        t.status.poison = undefined;
        t.status.bleed = undefined;
        events.push({ type: 'status', uid: t.uid, label: 'Cured' });
      }
      if (skill.shieldPct) {
        support = true;
        const amount = Math.round(t.maxHp * skill.shieldPct * this.symbolHeal(actor, skill));
        t.status.shield = amount;
        events.push({ type: 'shield', uid: t.uid, amount });
      }
      if (skill.poison) {
        const plague = actor.passive?.kind === 'plague' ? 1 + (actor.passive.value ?? 0) : 1;
        const burn = actor.side === 'party' ? 1 + this.mods.burnMult : 1;
        const kind = actor.classId === 'censer' ? 'burn' : 'poison';
        const dmg = Math.max(1, Math.round(this.attackOf(actor) * skill.poison.mult * plague * burn * baneMult(actor, t)));
        const old = skill.stackPoison ? t.status.poison : undefined;
        t.status.poison = old ? { dmg: old.dmg + dmg, turns: Math.max(old.turns, skill.poison.turns), kind } : { dmg, turns: skill.poison.turns, kind };
        events.push({ type: 'status', uid: t.uid, label: kind === 'burn' ? 'Burning' : 'Poisoned' });
      }
      if (skill.detonate && t.status.poison) {
        const p = t.status.poison;
        t.status.poison = undefined;
        events.push({ type: 'status', uid: t.uid, label: 'Ignited!' });
        this.pierce(t, Math.round(p.dmg * p.turns * skill.detonate * this.detonateOf(actor)), events);
        if (t.hp <= 0) continue;
      }
      if (skill.spreadPoison && t.status.poison) {
        for (const o of this.alive(t.side)) {
          if (o === t) continue;
          const p = t.status.poison;
          o.status.poison = o.status.poison ? { dmg: o.status.poison.dmg + p.dmg, turns: Math.max(o.status.poison.turns, p.turns) } : { ...p };
          events.push({ type: 'status', uid: o.uid, label: 'Infected' });
        }
      }
      if (skill.pull && t.rank > 1) {
        for (const o of this.alive(t.side)) if (o.rank < t.rank) o.rank += 1;
        t.rank = 1;
        events.push({ type: 'status', uid: t.uid, label: 'Dragged forward' }, { type: 'move', uid: t.uid });
      }
      if (skill.shove && this.moveUnit(t, skill.shove, events)) events.push({ type: 'status', uid: t.uid, label: 'Knocked back' });
      if (skill.empower && skill.empowerTarget) {
        t.status.empower = { ...skill.empower };
        events.push({ type: 'status', uid: t.uid, label: 'Empowered' });
      }
      if (skill.weaken) {
        t.status.weaken = { ...skill.weaken };
        events.push({ type: 'status', uid: t.uid, label: 'Weakened' });
      }
      if (skill.bleed) {
        const dmg = Math.max(1, Math.round(this.attackOf(actor) * skill.bleed.mult * baneMult(actor, t)));
        // Bleeding doesn't stack: a fresh wound replaces a weaker one.
        const old = t.status.bleed;
        t.status.bleed = { dmg: Math.max(dmg, old?.dmg ?? 0), turns: Math.max(old?.turns ?? 0, skill.bleed.turns) };
        events.push({ type: 'status', uid: t.uid, label: 'Bleeding' });
      }
      if (skill.sunder) {
        t.status.sunder = { ...skill.sunder };
        events.push({ type: 'status', uid: t.uid, label: 'Sundered' });
      }
      if (skill.hex) {
        t.status.hex = { ...skill.hex };
        events.push({ type: 'status', uid: t.uid, label: 'Hexed' });
      }
      if (skill.stun) {
        if (t.boss) events.push({ type: 'status', uid: t.uid, label: 'Resists stun' });
        else {
          t.status.stun = Math.max(t.status.stun ?? 0, skill.stun);
          events.push({ type: 'status', uid: t.uid, label: 'Stunned' });
          if (t.status.charging) {
            t.status.charging = false;
            this.planIntent(t, t.intent?.skillId);
            events.push({ type: 'status', uid: t.uid, label: 'Charge broken!' }, { type: 'intent' });
          }
        }
      }
      if (skill.haste) {
        t.status.haste = Math.max(t.status.haste ?? 0, skill.haste);
        events.push({ type: 'status', uid: t.uid, label: 'Hasted' });
      }
      if (skill.regen) {
        t.status.regen = { ...skill.regen };
        events.push({ type: 'status', uid: t.uid, label: 'Regenerating' });
      }
      if (skill.ward) {
        t.status.ward = { ...skill.ward };
        events.push({ type: 'status', uid: t.uid, label: 'Warded' });
      }
      if (skill.accuse) {
        t.status.accused = skill.accuse;
        events.push({ type: 'status', uid: t.uid, label: 'Accused' });
      }
      if (skill.delay) {
        const i = this.queue.indexOf(t.uid);
        if (i >= 0) {
          this.queue.splice(i, 1);
          this.queue.push(t.uid);
        } else t.status.delayed = true;
        events.push({ type: 'status', uid: t.uid, label: 'Delayed' });
        if (t.status.charging) {
          t.status.charging = false;
          this.log.push(`  ${t.name}'s charge is broken`);
          events.push({ type: 'status', uid: t.uid, label: 'Charge broken!' });
          this.planIntent(t, t.intent?.skillId);
          events.push({ type: 'intent' });
        }
      }
    }

    // Skills that carry the user forward or back.
    if (skill.move && actor.hp > 0) this.moveUnit(actor, skill.move, events);

    if (skill.taunt) {
      actor.status.taunt = skill.taunt;
      events.push({ type: 'status', uid: actor.uid, label: 'Taunting' });
    }
    if (skill.empower && !skill.empowerTarget) {
      actor.status.empower = { ...skill.empower };
      events.push({ type: 'status', uid: actor.uid, label: 'Empowered' });
    }
    if (actor.side === 'enemy' && skill.zealDrain) this.addZeal(-skill.zealDrain, events, skill.name);
    if (actor.side === 'party') {
      if (skill.zealGain) this.addZeal(skill.zealGain, events, skill.name);
      // One award per action (the larger one); Rites earn nothing.
      if (!skill.rite && offensive) this.addZeal(ZEAL_ON_ATTACK, events, 'attack');
      else if (!skill.rite && support) this.addZeal(ZEAL_ON_SUPPORT, events, 'support');
    }
    return events;
  }

  /**
   * The enemy's move this turn: its planned intent, re-aimed only if the
   * planned target is gone, out of reach, or a taunt now forces the issue.
   */
  enemyChoose(actor: Unit): { skill: SkillDef; target?: Unit } {
    if (!actor.intent) this.planIntent(actor);
    const skills = skillsFor(actor);
    let skill = skills.find((s) => s.id === actor.intent?.skillId);
    if (!skill || !this.canUse(actor, skill)) {
      this.planIntent(actor);
      skill = skills.find((s) => s.id === actor.intent!.skillId)!;
    }
    const targets = this.validTargets(actor, skill);
    const planned = targets.find((u) => u.uid === actor.intent?.targetUid);
    return { skill, target: planned ?? this.aim(skill, targets) };
  }

  /** Chooses and stores the enemy's next move. `avoid` is skipped when there is another option. */
  planIntent(actor: Unit, avoid?: string) {
    const usable = skillsFor(actor).filter((s) => this.canUse(actor, s));
    if (!usable.length) {
      actor.intent = undefined;
      return;
    }
    // Big moves (summons, wind-ups) never come twice in a row.
    let pool = usable.filter((s) => s.id !== avoid && !((s.summon || s.windup) && s.id === actor.lastSkill));
    if (!pool.length) pool = usable;
    const total = pool.reduce((n, s) => n + (s.weight ?? 1), 0);
    let roll = this.rng() * total;
    let skill = pool[pool.length - 1];
    for (const s of pool) {
      roll -= s.weight ?? 1;
      if (roll < 0) {
        skill = s;
        break;
      }
    }
    const single = skill.target === 'enemy' || skill.target === 'ally';
    const target = single ? this.aim(skill, this.validTargets(actor, skill)) : undefined;
    actor.intent = { skillId: skill.id, targetUid: target?.uid };
  }

  private aim(skill: SkillDef, targets: Unit[]): Unit | undefined {
    if (!targets.length) return undefined;
    const pick = () => targets[Math.floor(this.rng() * targets.length)];
    const by = (f: (u: Unit) => number) => [...targets].sort((a, b) => f(a) - f(b))[0];
    switch (skill.aim) {
      case 'random':
        return pick();
      case 'weakest':
        return by((u) => u.hp / u.maxHp);
      case 'strongest':
        return by((u) => -u.atk);
      case 'back':
        return by((u) => -u.rank);
      case 'front':
        return by((u) => u.rank);
      default:
        return this.rng() < 0.6 ? by((u) => u.hp / u.maxHp) : pick();
    }
  }

  /** What each living enemy is about to do, for the battle screen. */
  intentOf(actor: Unit): IntentView | undefined {
    if (actor.hp <= 0 || !actor.intent) return undefined;
    const skill = skillsFor(actor).find((s) => s.id === actor.intent!.skillId);
    if (!skill) return undefined;
    const charging = !!actor.status.charging;
    if (skill.summon) return { kind: 'summon', skill, targets: [], estimate: 0, charging };
    if (skill.target === 'self' || skill.target === 'ally' || skill.target === 'allAllies') {
      const friends = skill.target === 'self' ? [actor] : skill.target === 'allAllies' ? this.alive(actor.side) : this.validTargets(actor, skill).filter((u) => u.uid === actor.intent!.targetUid);
      const amount = skill.heal ? this.attackOf(actor) * skill.heal : skill.shieldPct && friends[0] ? friends[0].maxHp * skill.shieldPct : 0;
      return { kind: 'buff', skill, targets: friends, estimate: Math.round(amount), charging };
    }
    let targets: Unit[];
    if (skill.target === 'allEnemies') targets = this.alive('party');
    else {
      const valid = this.validTargets(actor, skill);
      const planned = valid.find((u) => u.uid === actor.intent!.targetUid);
      targets = planned ? [planned] : valid.length === 1 ? valid : [];
      // A taunt pulls the hit onto the taunter.
      if (!planned && valid.length && valid.every((u) => u.status.taunt)) targets = [valid[0]];
    }
    const front = targets[0];
    const estimate = skill.mult && front ? Math.round(damageAfterArmor(this.attackOf(actor) * skill.mult, front.armor) * this.guardOf(front)) : 0;
    const kind: IntentKind = skill.windup ? 'charge' : skill.target === 'allEnemies' ? 'aoe' : skill.weaken || skill.poison || skill.bleed || skill.sunder || skill.hex || skill.stun ? 'debuff' : 'attack';
    return { kind, skill, targets, estimate, charging };
  }

  private attackOf(u: Unit) {
    let atk = u.atk;
    if (u.status.weaken) atk *= 1 - u.status.weaken.pct;
    if (u.status.empower) atk *= 1 + u.status.empower.pct;
    if (u.side === 'enemy') atk *= 1 + RAGE_STEP * this.rage;
    else atk *= 1 + (this.hound?.howl.atk ?? 0);
    return atk;
  }

  private vary() {
    return 0.95 + this.rng() * 0.1;
  }

  /** +1 Zeal per full 5% of max HP lost to enemies, capped per round. */
  private hurtZeal(u: Unit, dmg: number, events: BattleEvent[]) {
    this.hurtFrac += dmg / u.maxHp / HURT_STEP;
    const whole = Math.floor(this.hurtFrac);
    if (!whole) return;
    this.hurtFrac -= whole;
    const gain = Math.min(whole, ZEAL_HURT_CAP - this.hurtZealThisRound);
    if (gain <= 0) return;
    this.hurtZealThisRound += gain;
    this.addZeal(gain, events, 'wounds');
  }

  private hit(actor: Unit, t: Unit, skill: SkillDef, events: BattleEvent[]) {
    let raw = this.attackOf(actor) * skill.mult! * this.relicMult(actor, skill) * baneMult(actor, t) * wardOf(t);
    if (skill.lowHpBonus && actor.hp < actor.maxHp / 2) raw *= 1 + skill.lowHpBonus;
    if (t.status.accused) raw *= ACCUSED_MULT * (1 + (skill.bonusIfAccused ?? 0));
    if (t.status.weaken && skill.bonusIfWeak) raw *= 1 + skill.bonusIfWeak;
    if (skill.execute && t.hp < t.maxHp * EXECUTE_AT) raw *= 1 + skill.execute;
    if (actor.passive?.kind === 'executioner' && t.hp < t.maxHp / 2) raw *= 1 + (actor.passive.value ?? 0);
    const crit = (t.status.accused && actor.passive?.kind === 'critOnAccused') || this.rng() < actor.crit;
    if (crit) raw *= CRIT_MULT;
    let dmg = Math.max(1, Math.round(damageAfterArmor(raw, defenceAgainst(t, dmgOf(actor, skill))) * this.vary() * this.guardOf(t)));
    let blocked = 0;
    if (t.status.shield) {
      blocked = Math.min(t.status.shield, dmg);
      t.status.shield -= blocked;
      dmg -= blocked;
    }
    dmg = Math.min(dmg, t.hp);
    if (dmg === t.hp && t.passive?.kind === 'unbroken' && !t.spentUnbroken) {
      t.spentUnbroken = true;
      dmg = t.hp - 1;
      events.push({ type: 'status', uid: t.uid, label: t.passive.name });
    }
    t.hp -= dmg;
    events.push({ type: 'damage', uid: t.uid, amount: dmg, blocked, crit });
    if (t.side === 'party' && actor.side === 'enemy') this.hurtZeal(t, dmg, events);
    if (dmg > 0 && actor.passive?.kind === 'lifesteal' && actor.hp > 0) {
      const real = Math.min(actor.maxHp - actor.hp, Math.round(dmg * (actor.passive.value ?? 0) * this.healOf(actor)));
      if (real > 0) {
        actor.hp += real;
        events.push({ type: 'heal', uid: actor.uid, amount: real });
      }
    }
    if (dmg > 0 && t.passive?.kind === 'thorns' && actor !== t && actor.hp > 0) {
      events.push({ type: 'status', uid: t.uid, label: t.passive.name });
      this.pierce(actor, Math.round(dmg * (t.passive.value ?? 0)), events);
    }
    if (t.hp <= 0) {
      this.kill(t, events);
      if (actor.side === 'party' && actor.passive?.kind === 'zealOnKill') this.addZeal(actor.passive.value ?? 0, events, actor.passive.name);
    } else this.checkPhase(t, events);
  }

  /** Damage multiplier from a living Sister's bulwark passive. */
  private guardOf(t: Unit) {
    if (t.side !== 'party') return 1;
    const g = this.alive('party').find((u) => u.passive?.kind === 'bulwark');
    return (g ? 1 - (g.passive!.value ?? 0) : 1) * (1 - (this.hound?.howl.ward ?? 0)) * (1 - (t.symbol?.guard ?? 0));
  }

  /** Expected damage of a skill on one target, before shields and luck. Used by Auto and target previews. */
  preview(actor: Unit, skill: SkillDef, t: Unit): number {
    let total = 0;
    if (skill.mult) {
      let raw = this.attackOf(actor) * skill.mult * this.relicMult(actor, skill) * baneMult(actor, t) * wardOf(t);
      if (skill.lowHpBonus && actor.hp < actor.maxHp / 2) raw *= 1 + skill.lowHpBonus;
      if (t.status.accused) raw *= ACCUSED_MULT * (1 + (skill.bonusIfAccused ?? 0));
      if (t.status.weaken && skill.bonusIfWeak) raw *= 1 + skill.bonusIfWeak;
      if (skill.execute && t.hp < t.maxHp * EXECUTE_AT) raw *= 1 + skill.execute;
      if (actor.passive?.kind === 'executioner' && t.hp < t.maxHp / 2) raw *= 1 + (actor.passive.value ?? 0);
      const critChance = t.status.accused && actor.passive?.kind === 'critOnAccused' ? 1 : actor.crit;
      raw *= 1 + critChance * (CRIT_MULT - 1);
      total += damageAfterArmor(raw, defenceAgainst(t, dmgOf(actor, skill)));
    }
    if (skill.detonate && t.status.poison) total += t.status.poison.dmg * t.status.poison.turns * skill.detonate * this.detonateOf(actor);
    return Math.round(total);
  }

  /** Damage that ignores armor and shields (detonated poison). */
  private pierce(t: Unit, amount: number, events: BattleEvent[]) {
    const dmg = Math.min(t.hp, Math.max(1, amount));
    t.hp -= dmg;
    events.push({ type: 'damage', uid: t.uid, amount: dmg, blocked: 0 });
    if (t.hp <= 0) this.kill(t, events);
    else this.checkPhase(t, events);
  }

  /** A boss below its threshold enters its second phase: harsher skills and a fresh plan. */
  private checkPhase(u: Unit, events: BattleEvent[]) {
    const p2 = u.side === 'enemy' ? ENEMIES[u.ref].phase2 : undefined;
    if (!p2 || u.phase === 2 || u.hp > u.maxHp * p2.atPct) return;
    u.phase = 2;
    u.atk = Math.round(u.atk * (1 + p2.atkPct));
    u.status.charging = false;
    this.log.push(`  ${u.name} enters phase 2`);
    events.push({ type: 'phase', uid: u.uid, text: p2.text });
    this.planIntent(u);
    events.push({ type: 'intent' });
  }

  private kill(u: Unit, events: BattleEvent[]) {
    u.hp = 0;
    u.status = {};
    events.push({ type: 'death', uid: u.uid });
    this.queue = this.queue.filter((id) => id !== u.uid);
    this.compact(u.side);
    if (u.side === 'party' && this.mods.fallHeal > 0) {
      for (const a of this.alive('party')) {
        const real = Math.min(a.maxHp - a.hp, Math.round(a.maxHp * this.mods.fallHeal * this.healOf(a)));
        if (real > 0) {
          a.hp += real;
          events.push({ type: 'heal', uid: a.uid, amount: real });
        }
      }
    }
    if (u.side === 'party' && u.passive?.kind === 'martyr' && this.alive('party').length) {
      events.push({ type: 'text', text: `${u.name}'s sacrifice sets her Sisters ablaze!` });
      this.addZeal(u.passive.value ?? 0, events, u.passive.name);
      for (const a of this.alive('party')) a.status.empower = { pct: 0.25, turns: 2 };
    }
    const burst = u.side === 'enemy' ? ENEMIES[u.ref].burst : undefined;
    if (burst) {
      events.push({ type: 'text', text: `${u.name} bursts!` });
      const blast: SkillDef = { id: 'burst', name: 'Burst', desc: '', from: [], target: 'allEnemies', mult: burst };
      for (const t of this.alive('party')) this.hit(u, t, blast, events);
    }
  }

  /** Living units close ranks toward the front. */
  private compact(side: Side) {
    this.alive(side).forEach((u, i) => (u.rank = i + 1));
  }

  /**
   * Moves a unit `delta` ranks (negative = toward the front), trading places with
   * whoever stands in the way. Returns how many ranks it actually moved.
   */
  moveUnit(u: Unit, delta: number, events: BattleEvent[]): number {
    let moved = 0;
    const dir = Math.sign(delta);
    for (let i = 0; i < Math.abs(delta); i++) {
      const other = this.alive(u.side).find((o) => o.rank === u.rank + dir);
      if (!other) break;
      [u.rank, other.rank] = [other.rank, u.rank];
      events.push({ type: 'move', uid: other.uid });
      moved++;
    }
    if (moved) events.push({ type: 'move', uid: u.uid });
    return moved;
  }

  /** Sisters this one can Step with: the living ones right beside her. */
  stepTargets(actor: Unit): Unit[] {
    if (actor.side !== 'party' || actor.stepped || actor.hp <= 0) return [];
    return this.alive('party').filter((o) => Math.abs(o.rank - actor.rank) === 1);
  }

  canStep(actor: Unit) {
    return this.stepTargets(actor).length > 0;
  }

  /** The free Step: trade places with a neighbour. Does not end the turn. */
  step(actor: Unit, other: Unit): BattleEvent[] {
    if (!this.stepTargets(actor).includes(other)) return [];
    [actor.rank, other.rank] = [other.rank, actor.rank];
    actor.stepped = true;
    this.log.push(`${actor.name} steps with ${other.name}`);
    return [{ type: 'move', uid: actor.uid }, { type: 'move', uid: other.uid }];
  }

  private shift(actor: Unit, events: BattleEvent[]) {
    const line = this.alive(actor.side);
    const other = line.find((u) => u.rank === (actor.rank === 1 ? 2 : actor.rank - 1));
    if (!other) {
      events.push({ type: 'text', text: `${actor.name} holds her ground.` });
      return;
    }
    [actor.rank, other.rank] = [other.rank, actor.rank];
    events.push({ type: 'move', uid: actor.uid }, { type: 'move', uid: other.uid });
  }

  private summon(type: string, events: BattleEvent[]) {
    const line = this.alive('enemy');
    if (line.length >= 4) return;
    const u = makeEnemy(type, `summon-${++this.summons}`, line.length + 1, this.enemyScale);
    this.units.push(u);
    this.planIntent(u);
    events.push({ type: 'summon', uid: u.uid });
  }

  private addZeal(n: number, events: BattleEvent[], reason: string) {
    if (n > 0 && this.mods.zealMult && (reason === 'attack' || reason === 'support' || reason === 'wounds')) n = Math.max(0, Math.round(n * (1 + this.mods.zealMult)));
    const before = this.zeal;
    this.zeal = Math.max(0, Math.min(ZEAL_MAX, this.zeal + n));
    if (this.zeal !== before) {
      events.push({ type: 'zeal', amount: this.zeal - before, reason });
      this.log.push(`  zeal ${this.zeal - before > 0 ? '+' : ''}${this.zeal - before} (${reason}) = ${this.zeal}`);
    }
  }
}

/** Enemy HP and attack scale, tuned with balance.test.ts against the Auto player. */
export const ENEMY_TUNE = 1.37;
export function makeEnemy(type: string, uid: string, rank: number, scale = 1): Unit {
  const d = ENEMIES[type];
  const hp = Math.round(d.hp * ENEMY_TUNE * scale);
  const a = AFFINITY[type] ?? {};
  return { uid, side: 'enemy', name: d.name, ref: type, rank, maxHp: hp, hp, atk: Math.round(d.atk * ENEMY_TUNE * scale), armor: d.armor, mres: a.mres ?? d.armor, dmg: a.dmg ?? 'physical', spd: d.spd, crit: d.crit ?? 0.05, status: {}, boss: d.boss, bane: a.bane };
}

/** The damage a skill deals: its own type, else its user's tag (Physical by default). */
export const dmgOf = (u: Unit, skill: SkillDef): DmgType => skill.dmg ?? u.dmg ?? 'physical';

/**
 * Order bane: Sisters of the Order an enemy fears hit it harder, and it hits
 * them softer.
 */
export function baneMult(by: Unit | undefined, t: Unit): number {
  if (by?.side === 'party' && by.order && t.bane === by.order) return BANE_MULT;
  if (by?.side === 'enemy' && t.order && by.bane === t.order) return BANE_GUARD;
  return 1;
}

/** The defence a hit meets: Armor (less Sunder) against Physical, Magic Resist (less Hex) against Magic. */
export function defenceAgainst(t: Unit, type: DmgType) {
  if (type === 'magic') return t.mres * (t.status.hex ? 1 - t.status.hex.pct : 1);
  return t.armor * (t.status.sunder ? 1 - t.status.sunder.pct : 1);
}

const wardOf = (t: Unit) => (t.status.ward ? 1 - t.status.ward.pct : 1);

/** Damage after armor: raw / (1 + armor / ARMOR_K). 100 armor halves a hit. */
export function damageAfterArmor(raw: number, armor: number) {
  return raw / (1 + Math.max(0, armor) / ARMOR_K);
}
