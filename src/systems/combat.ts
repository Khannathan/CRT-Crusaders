import { ENEMIES } from '../data/enemies';
import { CLASS_SKILLS, SHIFT_SKILL, type SkillDef } from '../data/skills';
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
  def: number;
  spd: number;
  status: Status;
  boss?: boolean;
}

export type BattleEvent =
  | { type: 'damage'; uid: string; amount: number; blocked: number }
  | { type: 'heal'; uid: string; amount: number }
  | { type: 'shield'; uid: string; amount: number }
  | { type: 'status'; uid: string; label: string }
  | { type: 'death'; uid: string }
  | { type: 'summon'; uid: string }
  | { type: 'move'; uid: string }
  | { type: 'zeal'; amount: number }
  | { type: 'text'; text: string };

export interface TurnStart {
  actor?: Unit;
  events: BattleEvent[];
  outcome?: 'victory' | 'defeat';
}

export const ZEAL_MAX = 100;
export const VIGIL_DEFAULT = 8;
/** Enemy attack bonus per round after the Vigil candle goes out. */
export const RAGE_STEP = 0.15;
const ACCUSED_MULT = 1.25;

const ZEAL_ON_ATTACK = 10;
const ZEAL_ON_SUPPORT = 8;
const ZEAL_ON_HURT = 4;

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
  private rng: Rng;
  private summons = 0;

  constructor(party: Unit[], enemies: Unit[], opts: { rng?: Rng; vigil?: number; zeal?: number } = {}) {
    this.units = [...party, ...enemies];
    this.rng = opts.rng ?? Math.random;
    this.vigil = opts.vigil ?? VIGIL_DEFAULT;
    this.zeal = Math.min(ZEAL_MAX, opts.zeal ?? 0);
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
    if (skill.rite) this.addZeal(-ZEAL_MAX, events);

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
        support = true;
        const amount = Math.round(skill.heal ? actor.atk * skill.heal * this.vary() : t.maxHp * skill.healPct!);
        const real = Math.min(amount, t.maxHp - t.hp);
        t.hp += real;
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
      let gain = skill.zealGain ?? 0;
      if (!skill.rite) gain += offensive ? ZEAL_ON_ATTACK : support ? ZEAL_ON_SUPPORT : 0;
      if (gain) this.addZeal(gain, events);
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
    return 0.9 + this.rng() * 0.2;
  }

  private hit(actor: Unit, t: Unit, skill: SkillDef, events: BattleEvent[]) {
    let raw = this.attackOf(actor) * skill.mult!;
    if (skill.lowHpBonus && actor.hp < actor.maxHp / 2) raw *= 1 + skill.lowHpBonus;
    if (t.status.accused) raw *= ACCUSED_MULT * (1 + (skill.bonusIfAccused ?? 0));
    let dmg = Math.max(1, Math.round((raw - t.def * 0.5) * this.vary()));
    let blocked = 0;
    if (t.status.shield) {
      blocked = Math.min(t.status.shield, dmg);
      t.status.shield -= blocked;
      dmg -= blocked;
    }
    dmg = Math.min(dmg, t.hp);
    t.hp -= dmg;
    events.push({ type: 'damage', uid: t.uid, amount: dmg, blocked });
    if (t.side === 'party' && dmg > 0) this.addZeal(ZEAL_ON_HURT, events);
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

  private addZeal(n: number, events: BattleEvent[]) {
    const before = this.zeal;
    this.zeal = Math.max(0, Math.min(ZEAL_MAX, this.zeal + n));
    if (this.zeal !== before) events.push({ type: 'zeal', amount: this.zeal - before });
  }
}

export function makeEnemy(type: string, uid: string, rank: number): Unit {
  const d = ENEMIES[type];
  return { uid, side: 'enemy', name: d.name, ref: type, rank, maxHp: d.hp, hp: d.hp, atk: d.atk, def: d.def, spd: d.spd, status: {}, boss: d.boss };
}
