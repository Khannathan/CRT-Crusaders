import { ENEMIES } from '../data/enemies';
import { CLASS_SKILLS, SHIFT_SKILL, type SkillDef } from '../data/skills';
import type { PassiveDef } from '../data/types';
import type { Rng } from './gacha';

export type Side = 'party' | 'enemy';

export interface Status {
  poison?: { dmg: number; turns: number };
  weaken?: { pct: number; turns: number };
  empower?: { pct: number; turns: number };
  accused?: number;
  taunt?: number;
  shield?: number;
  delayed?: boolean;
}

export interface Unit {
  uid: string;
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
  spd: number;
  crit: number;
  status: Status;
  boss?: boolean;
  passive?: PassiveDef;
  /** Set once an Unbroken passive has saved this unit. */
  spentUnbroken?: boolean;
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
  | { type: 'text'; text: string };

export interface TurnStart {
  actor?: Unit;
  events: BattleEvent[];
  outcome?: 'victory' | 'defeat';
}

/** Bump when combat numbers change, so logged runs can be compared fairly. */
export const BALANCE_VERSION = '0.2';

export const ZEAL_MAX = 100;
export const VIGIL_DEFAULT = 8;
/** Enemy attack bonus per round after the Vigil candle goes out. */
export const RAGE_STEP = 0.15;
const ACCUSED_MULT = 1.25;
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
  if (u.side === 'enemy') return ENEMIES[u.ref].skills;
  return [...CLASS_SKILLS[u.classId!], SHIFT_SKILL];
}

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

  constructor(party: Unit[], enemies: Unit[], opts: { rng?: Rng; vigil?: number; zeal?: number } = {}) {
    this.units = [...party, ...enemies];
    this.rng = opts.rng ?? Math.random;
    this.vigil = opts.vigil ?? VIGIL_DEFAULT;
    const passiveZeal = party.reduce((s, u) => s + (u.passive?.kind === 'startZeal' ? u.passive.value ?? 0 : 0), 0);
    this.zeal = Math.min(ZEAL_MAX, (opts.zeal ?? 0) + passiveZeal);
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
    if (this.round > 1) {
      if (this.vigil > 0) {
        this.vigil -= 1;
        if (this.vigil === 0) events.push({ type: 'text', text: 'The Vigil candle gutters out. The dark grows bolder.' });
      } else {
        this.rage += 1;
        events.push({ type: 'text', text: 'In the dark, the enemy grows stronger.' });
      }
    }
    const order = this.alive().sort((a, b) => {
      const da = a.status.delayed ? 1 : 0;
      const db = b.status.delayed ? 1 : 0;
      if (da !== db) return da - db;
      if (b.spd !== a.spd) return b.spd - a.spd;
      if (a.side !== b.side) return a.side === 'party' ? -1 : 1;
      return a.rank - b.rank;
    });
    order.forEach((u) => (u.status.delayed = false));
    this.queue = order.map((u) => u.uid);
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
      }
      if (st.weaken && --st.weaken.turns <= 0) st.weaken = undefined;
      if (st.empower && --st.empower.turns <= 0) st.empower = undefined;
      if (st.accused && --st.accused <= 0) st.accused = undefined;
      if (st.taunt && --st.taunt <= 0) st.taunt = undefined;
      return { actor, events };
    }
    return { events, outcome: this.outcome() };
  }

  canUse(actor: Unit, skill: SkillDef): boolean {
    if (skill.rite && this.zeal < ZEAL_MAX) return false;
    if (skill.from.length && !skill.from.includes(actor.rank)) return false;
    if (skill.summon && this.alive('enemy').length >= 4) return false;
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
    const events: BattleEvent[] = [{ type: 'text', text: `${actor.name}: ${skill.name}` }];
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
        const amount = Math.round(skill.heal ? actor.atk * skill.heal * this.vary() : t.maxHp * skill.healPct!);
        const real = Math.min(amount, t.maxHp - t.hp);
        t.hp += real;
        if (real >= t.maxHp * 0.05) support = true;
        events.push({ type: 'heal', uid: t.uid, amount: real });
      }
      if (skill.cleanse && t.status.poison) {
        t.status.poison = undefined;
        events.push({ type: 'status', uid: t.uid, label: 'Cured' });
      }
      if (skill.shieldPct) {
        support = true;
        const amount = Math.round(t.maxHp * skill.shieldPct);
        t.status.shield = amount;
        events.push({ type: 'shield', uid: t.uid, amount });
      }
      if (skill.poison) {
        const dmg = Math.max(1, Math.round(this.attackOf(actor) * skill.poison.mult));
        t.status.poison = { dmg, turns: skill.poison.turns };
        events.push({ type: 'status', uid: t.uid, label: actor.side === 'party' && actor.classId === 'censer' ? 'Burning' : 'Poisoned' });
      }
      if (skill.weaken) {
        t.status.weaken = { ...skill.weaken };
        events.push({ type: 'status', uid: t.uid, label: 'Weakened' });
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
      }
    }

    if (skill.taunt) {
      actor.status.taunt = skill.taunt;
      events.push({ type: 'status', uid: actor.uid, label: 'Taunting' });
    }
    if (skill.empower) {
      actor.status.empower = { ...skill.empower };
      events.push({ type: 'status', uid: actor.uid, label: 'Empowered' });
    }
    if (actor.side === 'party') {
      if (skill.zealGain) this.addZeal(skill.zealGain, events, skill.name);
      // One award per action (the larger one); Rites earn nothing.
      if (!skill.rite && offensive) this.addZeal(ZEAL_ON_ATTACK, events, 'attack');
      else if (!skill.rite && support) this.addZeal(ZEAL_ON_SUPPORT, events, 'support');
    }
    return events;
  }

  /** Simple enemy AI: a random usable skill, aimed at the weakest or a random target. */
  enemyChoose(actor: Unit): { skill: SkillDef; target?: Unit } {
    const usable = skillsFor(actor).filter((s) => this.canUse(actor, s));
    let skill = usable[Math.floor(this.rng() * usable.length)];
    // The boss calls for help only now and then.
    if (skill.summon && this.rng() < 0.6) skill = usable.find((s) => !s.summon) ?? skill;
    const targets = this.validTargets(actor, skill);
    let target = targets[Math.floor(this.rng() * targets.length)];
    if (skill.target === 'enemy' && this.rng() < 0.6) {
      target = [...targets].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    }
    return { skill, target };
  }

  private attackOf(u: Unit) {
    let atk = u.atk;
    if (u.status.weaken) atk *= 1 - u.status.weaken.pct;
    if (u.status.empower) atk *= 1 + u.status.empower.pct;
    if (u.side === 'enemy') atk *= 1 + RAGE_STEP * this.rage;
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
    let raw = this.attackOf(actor) * skill.mult!;
    if (skill.lowHpBonus && actor.hp < actor.maxHp / 2) raw *= 1 + skill.lowHpBonus;
    if (t.status.accused) raw *= ACCUSED_MULT * (1 + (skill.bonusIfAccused ?? 0));
    const crit = (t.status.accused && actor.passive?.kind === 'critOnAccused') || this.rng() < actor.crit;
    if (crit) raw *= CRIT_MULT;
    let dmg = Math.max(1, Math.round(damageAfterArmor(raw, t.armor) * this.vary()));
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
    if (t.hp <= 0) this.kill(t, events);
  }

  private kill(u: Unit, events: BattleEvent[]) {
    u.hp = 0;
    u.status = {};
    events.push({ type: 'death', uid: u.uid });
    this.queue = this.queue.filter((id) => id !== u.uid);
    this.compact(u.side);
  }

  /** Living units close ranks toward the front. */
  private compact(side: Side) {
    this.alive(side).forEach((u, i) => (u.rank = i + 1));
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
    const u = makeEnemy(type, `summon-${++this.summons}`, line.length + 1);
    this.units.push(u);
    events.push({ type: 'summon', uid: u.uid });
  }

  private addZeal(n: number, events: BattleEvent[], reason: string) {
    const before = this.zeal;
    this.zeal = Math.max(0, Math.min(ZEAL_MAX, this.zeal + n));
    if (this.zeal !== before) {
      events.push({ type: 'zeal', amount: this.zeal - before, reason });
      this.log.push(`  zeal ${this.zeal - before > 0 ? '+' : ''}${this.zeal - before} (${reason}) = ${this.zeal}`);
    }
  }
}

export function makeEnemy(type: string, uid: string, rank: number): Unit {
  const d = ENEMIES[type];
  return { uid, side: 'enemy', name: d.name, ref: type, rank, maxHp: d.hp, hp: d.hp, atk: d.atk, armor: d.armor, spd: d.spd, crit: d.crit ?? 0.05, status: {}, boss: d.boss };
}

/** Damage after armor: raw / (1 + armor / ARMOR_K). 100 armor halves a hit. */
export function damageAfterArmor(raw: number, armor: number) {
  return raw / (1 + Math.max(0, armor) / ARMOR_K);
}
