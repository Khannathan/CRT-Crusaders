import { AFFINITY, ENEMIES } from '../data/enemies';
import { CLASS_SKILLS, SHIFT_SKILL, type DmgType, type SkillDef } from '../data/skills';
import type { PassiveDef } from '../data/types';
import type { Howl } from '../data/hounds';
import { howlShort } from './hounds';
import type { Rng } from './gacha';
import * as KW from './keywords';
import { ORDER_KW, freshKeywords, type PartyKeywords } from './keywords';
import { KITS, exaltSig, type Seal, type SealKind, type Sig } from '../data/kits';

export type Side = 'party' | 'enemy';

/** A hound's howl as a battle sees it. */
export interface HoundHowl {
  name: string;
  howlName: string;
  howl: Howl;
}

export interface Status {
  /** Burn (Fire) or Poison (Blight): damage each turn, ignoring armor. */
  poison?: { dmg: number; turns: number; kind?: 'burn' | 'poison'; by?: string; guilt?: boolean };
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
  /** Who gave the shield (a Sister's uid). */
  shieldBy?: string;
  delayed?: boolean;
  /** Enemy is winding up its planned skill; it fires next turn unless delayed. */
  charging?: boolean;
  /** Strikes back for this multiple of attack when hit. */
  counter?: { mult: number; turns: number };
  /** Returns this share of damage taken to the attacker. */
  thorns?: { pct: number; turns: number };
  /** Extra critical chance. */
  critUp?: { pct: number; turns: number };
  /** Iron Vigil: reacts with this at the next foe to act; lapses after `turns` of her own. */
  overwatch?: { skill: SkillDef; turns: number };
  /** Glass Confession: crits against it Shatter. Its own turns left. */
  confessed?: number;
  /** Ashen Mercy: its Mercy line is this much higher. */
  foretold?: { pct: number; turns: number };
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
  /** HP a hunt boss has won back, so its score counts every blow. */
  healed?: number;
  /** Hunt-boss mechanics. */
  traits?: import('../data/enemies').EnemyTraits;
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
  /** Extra critical damage on top of CRIT_MULT (gear). */
  critDmg?: number;
  status: Status;
  boss?: boolean;
  passive?: PassiveDef;
  /** Set once an Unbroken passive has saved this unit. */
  spentUnbroken?: boolean;
  /** Enemies: the move planned for their next turn. */
  intent?: Intent;
  /** Enemies: the skill used last turn, to avoid repeating big moves. */
  lastSkill?: string;
  /** Sisters: her own Zeal, 0-ZEAL_MAX. Full, her Sacrament is ready. */
  zeal?: number;
  /** Bosses: Wrath, 0-ZEAL_MAX. Full, the boss readies its Blasphemy. */
  wrath?: number;
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
  /** Veiled Tribunal Guilt on a foe, 0-5. */
  guilt?: number;
  /** Thorn Covenant Scars on a Sister, 0-10. */
  scars?: number;
  /** Red Pilgrimage Stride on a Sister, 0-5. */
  stride?: number;
  /** Sisters: her kit's signature rules and Saint's Seal (data/kits.ts). */
  sig?: Sig;
  seal?: Seal;
  sealUsed?: boolean;
  /** Attack she has gained for the rest of the fight. */
  bonusAtk?: number;
  /** Steps taken this turn. */
  steps?: number;
}

export type BattleEvent =
  | { type: 'damage'; uid: string; amount: number; blocked: number; crit?: boolean }
  | { type: 'heal'; uid: string; amount: number }
  | { type: 'shield'; uid: string; amount: number }
  | { type: 'status'; uid: string; label: string }
  | { type: 'death'; uid: string }
  | { type: 'summon'; uid: string }
  | { type: 'revive'; uid: string }
  | { type: 'move'; uid: string }
  | { type: 'zeal'; amount: number; reason: string; uid?: string }
  | { type: 'intent' }
  | { type: 'phase'; uid: string; text: string }
  | { type: 'text'; text: string };

export interface TurnStart {
  actor?: Unit;
  events: BattleEvent[];
  outcome?: 'victory' | 'defeat';
}

/** Bump when combat numbers change, so logged runs can be compared fairly. */
export const BALANCE_VERSION = '1.1';
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

// Zeal economy: every Sister fills her own bar, a first Sacrament around rounds 4-6.
/** To the Sister, per action of hers that hits an enemy, however many targets. */
export const ZEAL_ON_ATTACK = 14;
/** To the Sister, per action of hers that heals someone at least 5% of max HP, or shields. */
export const ZEAL_ON_SUPPORT = 13;
/** +2 to a Sister per full 5% of her max HP lost to enemies... */
const HURT_STEP = 0.05;
const HURT_ZEAL = 2;
/** ...up to this much per Sister per round. */
export const ZEAL_HURT_CAP = 10;
/** Boss Wrath: per boss action, and per full 2% of its max HP lost. */
export const WRATH_ON_ACT = 20;
const WRATH_STEP = 0.02;

export function skillsFor(u: Unit): SkillDef[] {
  if (u.side === 'enemy') {
    const d = ENEMIES[u.ref];
    const base = u.phase === 2 && d.phase2 ? d.phase2.skills : d.skills;
    return d.blasphemy && (u.wrath ?? 0) >= ZEAL_MAX ? [...base, d.blasphemy] : base;
  }
  const vow = u.vow ?? 0;
  return [
    ...(KITS[u.ref]?.skills ?? CLASS_SKILLS[u.classId!]).map((s, i) => leveled(VOW_UPGRADES.some(([v, idx]) => idx === i && vow >= v) ? upgraded(s) : s, u.skillLv?.[i] ?? 1)),
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
  round = 0;
  vigil: number;
  rage = 0;
  /** uids still to act this round, in order. */
  queue: string[] = [];
  /** Every action and Zeal change, for balance comparisons. */
  log: string[] = [];
  private rng: Rng;
  private summons = 0;
  /** Litany Chain bonus on the Litany being cast now (1 = none); set by the field. */
  chainMult = 1;
  /** True while a riposte resolves, so ripostes never chain. */
  private countering = false;
  /** Per Sister (uid): fraction toward the next wound Zeal, and wound Zeal taken this round. */
  private hurtFrac: Record<string, number> = {};
  private hurtZealThisRound: Record<string, number> = {};
  private wrathFrac: Record<string, number> = {};
  private enemyScale: number;
  /** Multiplies healing the party receives (an Inquisition edict halves it). */
  partyHeal = 1;
  /** Crypt relic effects. */
  mods: BattleMods = { ...NO_MODS };
  /** The party's hound: it howls at the start of every round. */
  hound?: HoundHowl;
  /** Scored fights (Hallowed Hunts) end after this many rounds. */
  roundLimit?: number;
  /** True once the round limit has passed. */
  timeUp = false;
  /** The party's Order counters: Remains, Tide, the Bell, Hymns. */
  kw: PartyKeywords = freshKeywords();
  /** Per Sister: fraction toward her next Scar. */
  private scarFrac: Record<string, number> = {};
  /** Foe kinds a Bone Archivist has Catalogued. */
  private catalogued = new Set<string>();
  /** Per Sister: the round her Mercy kill last gave her another action. */
  private extraRound: Record<string, number> = {};
  /** Sisters who rise at the start of the next round (Drowned and Returned). */
  private pendingRise: string[] = [];
  /** A Blasphemy being turned back: half its damage goes to the boss. */
  private reflecting?: { boss: Unit; sum: number };
  /** Summoned foes arrive Delayed (Lock the Crypt). */
  private locked = false;
  /**
   * Space, when the fight is played on an open field (systems/field.ts). Left
   * unset in turn-based fights, where every Hymn reaches every ally and every
   * Sister on Overwatch reacts to every foe.
   */
  space?: {
    /** This ally stands inside the singer's Hymn. */
    inHymn(singer: Unit, u: Unit): boolean;
    /** This foe has stepped into the watcher's Overwatch zone. */
    inOverwatch(watcher: Unit, foe: Unit): boolean;
  };

  constructor(party: Unit[], enemies: Unit[], opts: { rng?: Rng; vigil?: number; zeal?: number; enemyScale?: number; mods?: Partial<BattleMods>; hound?: HoundHowl } = {}) {
    this.mods = { ...NO_MODS, ...opts.mods };
    this.hound = opts.hound;
    this.enemyScale = opts.enemyScale ?? 1;
    this.units = [...party, ...enemies];
    this.rng = opts.rng ?? Math.random;
    this.vigil = opts.vigil ?? VIGIL_DEFAULT;
    // Kits: each Sister's signature and Seal, fresh for this fight.
    for (const u of party) {
      const k = KITS[u.ref];
      if (k) {
        u.sig ??= (u.symbol?.exalt && exaltSig(k.sig, u.symbol.exalt)) || k.sig;
        u.seal ??= k.seal;
      }
      u.sealUsed = false;
      u.bonusAtk = 0;
      u.steps = 0;
    }
    // Opening Zeal (Holy Symbols, the Sisters' own passives) goes to every Sister.
    const passiveZeal = party.reduce((s, u) => s + (u.passive?.kind === 'startZeal' ? u.passive.value ?? 0 : 0) + (u.sig?.startZeal ?? 0), 0);
    for (const u of party) u.zeal = Math.min(ZEAL_MAX, (u.zeal ?? 0) + (opts.zeal ?? 0) + passiveZeal);
    for (const e of enemies) if (e.boss && ENEMIES[e.ref]?.blasphemy) e.wrath = e.wrath ?? 0;
    for (const e of enemies) this.planIntent(e);
    this.openKits(party, enemies);
    // Relics that set the foes alight before the first blow.
    if (this.mods.openingBurn > 0 && party.length) {
      const avg = party.reduce((n, u) => n + u.atk, 0) / party.length;
      const dmg = Math.max(1, Math.round(avg * this.mods.openingBurn * (1 + this.mods.burnMult)));
      for (const e of enemies) e.status.poison = { dmg, turns: 3, kind: 'burn' };
    }
  }

  /** The fullest living Sister's Zeal (one number for logs and older callers). */
  get zeal(): number {
    return Math.max(0, ...this.alive('party').map((u) => u.zeal ?? 0));
  }

  /** A party member's damage multiplier from relics: wounded, fallen Sisters, Rites. */
  private relicMult(actor: Unit, skill: SkillDef) {
    if (actor.side !== 'party') return 1;
    const m = this.mods;
    const fallen = this.units.filter((u) => u.side === 'party' && u.hp <= 0).length;
    let f = (1 + fallen * m.fallenAtk + (actor.hp < actor.maxHp / 2 ? m.lowHpAtk : 0)) * (actor.symbol?.mult ?? 1);
    if (skill.rite) f *= (1 + m.riteMult) * (1 + (actor.symbol?.rite ?? 0)) * this.chainMult;
    return f;
  }

  /** Holy Symbol: +10% at +5, a Confessor's +20% at +10, and the Rite bonus at +15. */
  private symbolHeal(actor: Unit, skill: SkillDef) {
    const chain = skill.rite && actor.side === 'party' ? this.chainMult : 1;
    const sy = actor.symbol;
    if (!sy) return chain;
    return sy.mult * sy.heal * (skill.rite ? 1 + sy.rite : 1) * chain;
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
    if (!this.alive('party').length || this.timeUp) return 'defeat';
    if (!this.alive('enemy').length) return 'victory';
    return undefined;
  }

  /** Turn order for display: who acts after the current actor this round. */
  upcoming(): Unit[] {
    return this.queue.map((id) => this.get(id)).filter((u) => u.hp > 0);
  }

  /** A new round: the candle, relic Zeal, the howl, boss traits and the turn order. Real-time fights call it on a clock. */
  startRound(events: BattleEvent[]) {
    this.round += 1;
    this.hurtZealThisRound = {};
    this.log.push(`-- round ${this.round} (zeal ${this.alive('party').map((u) => u.zeal ?? 0).join('/')}, vigil ${this.vigil})`);
    if (this.mods.roundZeal > 0 && this.alive('party').length) this.addZeal(this.mods.roundZeal, events, 'relics');
    this.howl(events);
    this.bossTraits(events);
    this.roundKeywords(events);
    for (const uid of this.pendingRise.splice(0)) {
      const u = this.get(uid);
      if (u.hp > 0) continue;
      this.raiseOne(u, 0.5, events, 'Returned!');
      this.raiseTide(KW.TIDE_MAX, events);
    }
    if (this.round > 1) {
      if (this.vigil > 0) {
        this.vigil -= 1;
        if (this.vigil === 0) events.push({ type: 'text', text: 'The Vigil candle gutters out. Pray harder, Sisters.' });
      } else {
        this.rage += 1;
        events.push({ type: 'text', text: 'The candle is dead. The heretics grow bolder.' });
      }
    }
    if (this.locked) for (const e of this.alive('enemy')) if (e.uid.startsWith('summon-')) e.status.delayed = true;
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
    // Watchfire: the foe that acts first this round is set Burning.
    const fire = this.sigHolder('burnFirst');
    const first = order.find((u) => u.side === 'enemy');
    if (fire && first) {
      const dmg = Math.max(1, Math.round(this.attackOf(fire) * 0.45 * (1 + (fire.sig!.dotMult ?? 0)) * baneMult(fire, first)));
      const old = first.status.poison;
      first.status.poison = old ? { ...old, dmg: old.dmg + dmg, turns: Math.max(old.turns, fire.sig!.burnFirst!) } : { dmg, turns: fire.sig!.burnFirst!, kind: 'burn', by: fire.uid };
      events.push({ type: 'status', uid: first.uid, label: 'Watchfire' });
    }
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

  /** Hunt-boss mechanics at the start of a round: regeneration, rage, and swapping its guard. */
  private bossTraits(events: BattleEvent[]) {
    for (const u of this.alive('enemy')) {
      const t = u.traits;
      if (!t) continue;
      if (t.regen) {
        const cut = u.status.bleed || u.status.poison ? 0.5 : 1;
        const real = Math.min(u.maxHp - u.hp, Math.round(u.maxHp * t.regen * cut));
        if (real > 0) {
          u.hp += real;
          u.healed = (u.healed ?? 0) + real;
          events.push({ type: 'heal', uid: u.uid, amount: real });
        }
      }
      if (t.enrage && this.round > 1) {
        u.status.empower = { pct: Math.round(t.enrage * (this.round - 1) * 100) / 100, turns: 2 };
        events.push({ type: 'status', uid: u.uid, label: `Rage +${Math.round(t.enrage * (this.round - 1) * 100)}%` });
      }
      if (t.swap && this.round > 1 && (this.round - 1) % t.swap === 0) {
        [u.armor, u.mres] = [u.mres, u.armor];
        events.push({ type: 'text', text: `${u.name} turns its guard: now weak to ${u.armor < u.mres ? 'Physical' : 'Magic'}.` });
      }
    }
  }

  /** Advances to the next living actor and applies its start-of-turn effects. */
  nextTurn(): TurnStart {
    const events: BattleEvent[] = [];
    for (let guard = 0; guard < 100; guard++) {
      const done = this.outcome();
      if (done) return { events, outcome: done };
      if (!this.queue.length) {
        if (this.roundLimit && this.round >= this.roundLimit) {
          this.timeUp = true;
          events.push({ type: 'text', text: 'The hunt is over. The beast withdraws into the dark.' });
          return { events, outcome: 'defeat' };
        }
        this.startRound(events);
      }
      const actor = this.get(this.queue.shift()!);
      if (actor.hp <= 0) continue;
      if (!this.beginTurn(actor, events)) continue;
      return { actor, events };
    }
    return { events, outcome: this.outcome() };
  }

  /**
   * Start-of-turn effects for one unit: shield drops, damage over time, regen,
   * auras, statuses tick down. False when it dies or is stunned and loses the turn.
   * Real-time fights call it before each of a unit's actions.
   */
  beginTurn(actor: Unit, events: BattleEvent[]): boolean {
    const st = actor.status;
    st.shield = 0;
    actor.stepped = false;
    if (st.poison) {
      const by = st.poison.by ? this.units.find((u) => u.uid === st.poison!.by) : undefined;
      const twice = by && by.hp > 0 && by.sig?.hymnBurnTwice && this.kw.hymns.length && st.poison.kind === 'burn' ? 2 : 1;
      const dmg = Math.min(actor.hp, st.poison.dmg * twice);
      actor.hp -= dmg;
      events.push({ type: 'damage', uid: actor.uid, amount: dmg, blocked: 0 });
      if (actor.side === 'party') this.hurtZeal(actor, dmg, events);
      if (st.poison.guilt && actor.hp > 0) this.addGuilt(actor, 1, events);
      st.poison.turns -= 1;
      if (st.poison.turns <= 0) st.poison = undefined;
      if (actor.hp <= 0) {
        this.kill(actor, events);
        return false;
      }
      this.checkPhase(actor, events);
    }
    if (st.bleed) {
      const dmg = Math.min(actor.hp, st.bleed.dmg);
      actor.hp -= dmg;
      events.push({ type: 'damage', uid: actor.uid, amount: dmg, blocked: 0 });
      if (actor.side === 'party') this.hurtZeal(actor, dmg, events);
      this.scar(actor, dmg, events);
      if (--st.bleed.turns <= 0) st.bleed = undefined;
      if (actor.hp <= 0) {
        this.kill(actor, events);
        return false;
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
    actor.steps = 0;
    if (actor.passive?.kind === 'healAura') {
      const aura = (actor.passive.value ?? 0) + (this.kw.remains > 0 ? actor.sig?.auraRemains ?? 0 : 0);
      for (const a of this.alive(actor.side)) {
        const real = Math.min(a.maxHp - a.hp, Math.round(a.maxHp * aura * this.healOf(a)));
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
    if (st.counter && --st.counter.turns <= 0) st.counter = undefined;
    if (st.thorns && --st.thorns.turns <= 0) st.thorns = undefined;
    if (st.critUp && --st.critUp.turns <= 0) st.critUp = undefined;
    if (st.overwatch && --st.overwatch.turns <= 0) st.overwatch = undefined;
    if (st.confessed && --st.confessed <= 0) st.confessed = undefined;
    if (st.foretold && --st.foretold.turns <= 0) st.foretold = undefined;
    this.turnKits(actor, events);
    if (st.stun) {
      st.stun -= 1;
      if (st.stun <= 0) st.stun = undefined;
      this.log.push(`${actor.name} is stunned`);
      events.push({ type: 'status', uid: actor.uid, label: 'Stunned' });
      return false;
    }
    return true;
  }

  canUse(actor: Unit, skill: SkillDef): boolean {
    if ((actor.cooldowns?.[skill.id] ?? 0) > 0) return false;
    if (skill.rite && actor.side === 'party' && (actor.zeal ?? 0) < ZEAL_MAX) return false;
    if (skill.rite && actor.side === 'enemy' && (actor.wrath ?? 0) < ZEAL_MAX) return false;
    if (skill.from.length && !skill.from.includes(actor.rank)) return false;
    if (skill.summon && this.alive('enemy').length >= 4) return false;
    if (skill.volley && this.kw.remains <= 0) return false;
    const sp = skill.spend;
    if (sp?.need && !sp.orElse && sp.kw !== 'guilt') {
      const have = sp.kw === 'remains' ? this.kw.remains : sp.kw === 'tide' ? this.kw.tide : sp.kw === 'scars' ? actor.scars ?? 0 : actor.stride ?? 0;
      if (have < (sp.n ?? 1)) return false;
    }
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
    if (actor.side === 'enemy') {
      const pre = this.overwatch(actor);
      if (actor.hp <= 0) return [...pre, { type: 'intent' }];
      if (pre.length) {
        const again = this.enemyChoose(actor);
        return [...pre, ...this.act(actor, again.skill, again.target)];
      }
    }
    if (actor.side === 'enemy' && skill.windup && !actor.status.charging) {
      actor.status.charging = true;
      const pre: BattleEvent[] = [];
      this.chargeKits(actor, pre);
      if (actor.hp <= 0) return [...pre, { type: 'intent' }];
      actor.intent = { skillId: skill.id };
      this.log.push(`${actor.name} charges ${skill.name}`);
      return [
        ...pre,
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
    if (skill.rite && actor.side === 'party') this.addZeal(-ZEAL_MAX, events, 'Sacrament', actor);
    if (skill.rite && actor.side === 'enemy') {
      actor.wrath = 0;
      events.push({ type: 'phase', uid: actor.uid, text: `BLASPHEMY: ${skill.name}` });
      this.blasphemyKits(actor, events);
    }

    if (skill.id === 'shift') {
      this.shift(actor, events);
      return events;
    }

    if (skill.selfDmgPct) {
      const dmg = Math.min(actor.hp - 1, Math.round(actor.maxHp * skill.selfDmgPct));
      if (dmg > 0) {
        actor.hp -= dmg;
        events.push({ type: 'damage', uid: actor.uid, amount: dmg, blocked: 0 });
        this.scar(actor, dmg, events);
      }
    }
    if (skill.spend) skill = this.spendFor(actor, skill, target, events);
    if (skill.byTide) skill = this.tideFor(skill);
    if (actor.side === 'party') skill = this.growFor(actor, skill);
    if (skill.summon) {
      this.summon(skill.summon, events);
      return events;
    }

    if (skill.revive) this.revive(actor, skill.revive, events);

    const group = skill.target === 'allAllies' || skill.target === 'allEnemies';
    let targets = skill.volley ? this.volleyTargets(actor, skill.volley, events) : group ? this.validTargets(actor, skill) : skill.target === 'self' ? [actor] : target ? [target] : [];
    if (group && skill.onlyRanks) targets = targets.filter((t) => skill.onlyRanks!.includes(t.rank));
    let offensive = false;
    let support = false;

    for (const t of targets) {
      if (t.hp <= 0) continue;
      const sk = this.condFor(skill, t);
      if (sk.mult) {
        offensive = true;
        this.strike(actor, t, sk, events);
      }
      if (t.hp <= 0) continue;
      if (this.applyEffects(actor, t, sk, events)) support = true;
      if (sk.perGuilt?.partyHealPct && t.guilt && t.side !== actor.side) for (const a of this.alive(actor.side)) this.mend(a, a.maxHp * sk.perGuilt.partyHealPct * t.guilt, events);
    }
    if (this.reflecting) {
      const r = this.reflecting;
      this.reflecting = undefined;
      if (r.sum > 0 && r.boss.hp > 0) {
        events.push({ type: 'text', text: `${r.boss.name}'s Blasphemy turns back on it!` });
        this.pierce(r.boss, r.sum, events);
      }
    }
    if (actor.side === 'party' && actor.hp > 0) this.extraKits(actor, skill, events);

    // Skills that carry the user forward or back.
    if (skill.move && actor.hp > 0) this.moveUnit(actor, skill.move, events);
    if (skill.shieldBehind && actor.hp > 0) {
      const b = this.alive(actor.side).find((u) => u.rank === actor.rank + 1);
      if (b) {
        const amount = Math.round(b.maxHp * skill.shieldBehind);
        b.status.shield = Math.max(b.status.shield ?? 0, amount);
        b.status.shieldBy = actor.uid;
        events.push({ type: 'shield', uid: b.uid, amount });
      }
    }

    if (skill.taunt) {
      actor.status.taunt = skill.taunt;
      events.push({ type: 'status', uid: actor.uid, label: 'Taunting' });
    }
    if (skill.counter && actor.hp > 0) {
      actor.status.counter = { ...skill.counter };
      events.push({ type: 'status', uid: actor.uid, label: 'On guard' });
    }
    if (skill.empower && !skill.empowerTarget) {
      actor.status.empower = { ...skill.empower };
      events.push({ type: 'status', uid: actor.uid, label: 'Empowered' });
    }
    // Zeal stolen: from the Sister struck, or from every Sister for a sweeping blow.
    if (actor.side === 'enemy' && skill.zealDrain) {
      if (single && target) this.addZeal(-skill.zealDrain, events, skill.name, target);
      else this.addZeal(-skill.zealDrain, events, skill.name);
    }
    if (actor.side === 'party') {
      if (skill.zealGain) this.addZeal(skill.zealGain, events, skill.name, skill.zealAll ? undefined : actor);
      // One award per action (the larger one); Sacraments earn nothing.
      if (!skill.rite && offensive) this.addZeal(ZEAL_ON_ATTACK, events, 'attack', actor);
      else if (!skill.rite && support) this.addZeal(ZEAL_ON_SUPPORT, events, 'support', actor);
    }
    if (actor.side === 'enemy' && actor.wrath !== undefined && !skill.rite) this.addWrath(actor, WRATH_ON_ACT, events);
    if (actor.side === 'party') this.afterSkill(actor, skill, events);
    return events;
  }

  /** A skill's effects on one target, after its hit. True when it gave real support (Zeal). */
  private applyEffects(actor: Unit, t: Unit, skill: SkillDef, events: BattleEvent[]): boolean {
    let support = false;
    if (skill.heal || skill.healPct) {
      let amount = Math.round((skill.heal ? actor.atk * skill.heal * this.vary() : t.maxHp * skill.healPct!) * this.healOf(t) * this.symbolHeal(actor, skill));
      if (actor.sig?.healPerGuilt) amount = Math.round(amount * (1 + actor.sig.healPerGuilt * Math.max(0, ...this.alive('enemy').map((e) => e.guilt ?? 0))));
      const real = Math.min(amount, t.maxHp - t.hp);
      t.hp += real;
      if (real >= t.maxHp * 0.05) support = true;
      events.push({ type: 'heal', uid: t.uid, amount: real });
      if (actor.sig?.overhealShield && amount > real && t.side === actor.side) {
        t.status.shield = Math.max(t.status.shield ?? 0, amount - real);
        events.push({ type: 'shield', uid: t.uid, amount: amount - real });
      }
    }
    if (skill.cleanse && (t.status.poison || t.status.bleed)) {
      const thrown = actor.sig?.throwCures && t.side === actor.side ? { p: t.status.poison, b: t.status.bleed } : undefined;
      t.status.poison = undefined;
      t.status.bleed = undefined;
      events.push({ type: 'status', uid: t.uid, label: 'Cured' });
      const foe = thrown && [...this.alive(actor.side === 'party' ? 'enemy' : 'party')].sort((a, b) => b.hp - a.hp)[0];
      if (thrown && foe) {
        if (thrown.p) {
          const o = foe.status.poison;
          foe.status.poison = o ? { ...o, dmg: o.dmg + thrown.p.dmg, turns: Math.max(o.turns, thrown.p.turns) } : { ...thrown.p, by: actor.uid, guilt: undefined };
        }
        if (thrown.b) foe.status.bleed = { dmg: Math.max(thrown.b.dmg, foe.status.bleed?.dmg ?? 0), turns: Math.max(thrown.b.turns, foe.status.bleed?.turns ?? 0) };
        events.push({ type: 'status', uid: foe.uid, label: 'Thrown back' });
      }
    }
    if (skill.shieldPct) {
      support = true;
      let amount = Math.round(t.maxHp * skill.shieldPct * this.symbolHeal(actor, skill));
      if (actor.sig?.lowShield && t.hp < t.maxHp * 0.3) amount = Math.round(amount * (1 + actor.sig.lowShield));
      t.status.shield = amount;
      t.status.shieldBy = actor.uid;
      events.push({ type: 'shield', uid: t.uid, amount });
    }
    if (skill.poison) {
      const plague = actor.passive?.kind === 'plague' ? 1 + (actor.passive.value ?? 0) : 1;
      const burn = actor.side === 'party' ? 1 + this.mods.burnMult : 1;
      const kind = actor.classId === 'censer' || actor.classId === 'exorcist' ? 'burn' : 'poison';
      const g = actor.sig;
      const kit = 1 + (g?.dotMult ?? 0) + (g?.dotPerStride ?? 0) * (actor.stride ?? 0) + (g?.dotConfessed && t.status.confessed ? g.dotConfessed : 0);
      const dmg = Math.max(1, Math.round(this.attackOf(actor) * skill.poison.mult * plague * burn * kit * baneMult(actor, t)));
      const old = skill.stackPoison ? t.status.poison : undefined;
      const guilt = skill.burnGuilt || old?.guilt || undefined;
      t.status.poison = old ? { dmg: old.dmg + dmg, turns: Math.max(old.turns, skill.poison.turns), kind, by: old.by ?? actor.uid, guilt } : { dmg, turns: skill.poison.turns, kind, by: actor.uid, guilt };
      events.push({ type: 'status', uid: t.uid, label: kind === 'burn' ? 'Burning' : 'Poisoned' });
    }
    if (skill.spreadPoison && t.status.poison) {
      for (const o of this.alive(t.side)) {
        if (o === t) continue;
        const p = t.status.poison;
        o.status.poison = o.status.poison ? { dmg: o.status.poison.dmg + p.dmg, turns: Math.max(o.status.poison.turns, p.turns) } : { ...p };
        events.push({ type: 'status', uid: o.uid, label: 'Infected' });
      }
    }
    if (skill.detonate && t.status.poison) {
      const p = t.status.poison;
      t.status.poison = undefined;
      events.push({ type: 'status', uid: t.uid, label: 'Ignited!' });
      this.pierce(t, Math.round(p.dmg * p.turns * skill.detonate * this.detonateOf(actor)), events);
      if (t.hp <= 0) return support;
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
      t.status.weaken = { ...skill.weaken, turns: skill.weaken.turns + (actor.sig?.weakenPlus ?? 0) };
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
    if (skill.thorns) {
      t.status.thorns = { ...skill.thorns };
      events.push({ type: 'status', uid: t.uid, label: 'Thorned' });
    }
    if (skill.critUp) {
      t.status.critUp = { ...skill.critUp };
      events.push({ type: 'status', uid: t.uid, label: 'Keen' });
    }
    if (skill.purge && t.side !== actor.side) {
      const st = t.status;
      if (st.shield || st.empower || st.ward || st.regen || st.haste || st.thorns || st.counter || st.critUp) {
        st.shield = 0;
        st.empower = st.ward = st.regen = st.thorns = st.counter = st.critUp = undefined;
        st.haste = undefined;
        events.push({ type: 'status', uid: t.uid, label: 'Purged' });
      }
    }
    if (skill.wrathDrain && t.wrath !== undefined && t.wrath > 0) {
      t.wrath = Math.max(0, t.wrath - skill.wrathDrain);
      events.push({ type: 'status', uid: t.uid, label: `-${skill.wrathDrain} Wrath` });
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
    this.keywordEffects(actor, t, skill, events);
    return support;
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
    const prof = actor.side === 'enemy' ? ENEMIES[actor.ref]?.blasphemy : undefined;
    if (prof && (actor.wrath ?? 0) >= ZEAL_MAX && this.canUse(actor, prof)) {
      const single = prof.target === 'enemy' || prof.target === 'ally';
      const target = single ? this.aim(prof, this.validTargets(actor, prof)) : undefined;
      actor.intent = { skillId: prof.id, targetUid: target?.uid };
      return;
    }
    const usable = skillsFor(actor).filter((s) => this.canUse(actor, s) && !s.rite);
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
    if (u.side === 'enemy') {
      atk *= 1 + RAGE_STEP * this.rage;
      const bap = u.status.accused ? this.sigHolder('tideWeakAccused') : undefined;
      if (bap) atk *= Math.max(0.5, 1 - bap.sig!.tideWeakAccused! * this.kw.tide);
    } else {
      atk *= 1 + (this.hound?.howl.atk ?? 0);
      atk *= 1 + (u.bonusAtk ?? 0);
      const g = u.sig;
      if (g?.hymnAtk && this.kw.hymns.length) atk *= 1 + g.hymnAtk;
      if (g?.atkPerFallen) atk *= 1 + g.atkPerFallen * this.units.filter((x) => x.side === 'party' && x.hp <= 0).length;
      const banner = this.kw.remains > 0 ? this.sigHolder('remainsAtkAll') : undefined;
      if (banner) atk *= 1 + banner.sig!.remainsAtkAll!;
    }
    return atk;
  }

  private vary() {
    return 0.95 + this.rng() * 0.1;
  }

  /** A Sister's own Zeal: +HURT_ZEAL per full 5% of her max HP lost to enemies, capped per round. */
  private hurtZeal(u: Unit, dmg: number, events: BattleEvent[]) {
    this.hurtFrac[u.uid] = (this.hurtFrac[u.uid] ?? 0) + dmg / u.maxHp / HURT_STEP;
    const whole = Math.floor(this.hurtFrac[u.uid]);
    if (!whole) return;
    this.hurtFrac[u.uid] -= whole;
    const taken = this.hurtZealThisRound[u.uid] ?? 0;
    const gain = Math.min(whole * HURT_ZEAL, ZEAL_HURT_CAP - taken);
    if (gain <= 0) return;
    this.hurtZealThisRound[u.uid] = taken + gain;
    this.addZeal(gain, events, 'wounds', u);
  }

  /** A boss's Wrath: from its own deeds and the blows it takes. Full, it readies its Blasphemy. */
  private addWrath(u: Unit, n: number, events: BattleEvent[]) {
    if (u.wrath === undefined || u.hp <= 0) return;
    const before = u.wrath;
    u.wrath = Math.min(ZEAL_MAX, before + n);
    if (before < ZEAL_MAX && u.wrath >= ZEAL_MAX) {
      const prof = ENEMIES[u.ref].blasphemy!;
      events.push({ type: 'text', text: `${u.name} seethes with Wrath. ${prof.name} is coming!` });
      if (!u.status.charging) {
        u.intent = undefined;
        this.planIntent(u);
        events.push({ type: 'intent' });
      }
    }
  }

  private woundWrath(t: Unit, dmg: number, events: BattleEvent[]) {
    if (t.wrath === undefined) return;
    this.wrathFrac[t.uid] = (this.wrathFrac[t.uid] ?? 0) + dmg / t.maxHp / WRATH_STEP;
    const whole = Math.floor(this.wrathFrac[t.uid]);
    if (!whole) return;
    this.wrathFrac[t.uid] -= whole;
    this.addWrath(t, whole, events);
  }

  private hit(actor: Unit, t: Unit, skill: SkillDef, events: BattleEvent[]) {
    let raw = this.attackOf(actor) * skill.mult! * this.relicMult(actor, skill) * baneMult(actor, t) * wardOf(t);
    if (skill.bossBonus && t.boss) raw *= 1 + skill.bossBonus;
    if (skill.lowHpBonus && actor.hp < actor.maxHp / 2) raw *= 1 + skill.lowHpBonus;
    if (t.status.accused) raw *= ACCUSED_MULT * (1 + (skill.bonusIfAccused ?? 0));
    if (t.status.weaken && skill.bonusIfWeak) raw *= 1 + skill.bonusIfWeak;
    raw *= this.executeMult(actor, t, skill);
    if (actor.passive?.kind === 'executioner' && t.hp < t.maxHp / 2) raw *= 1 + (actor.passive.value ?? 0);
    raw *= this.keywordMult(actor, t) * this.sigMult(actor, t);
    const mercyBoss = t.boss && this.isKw(actor, 'mercy') && t.hp < t.maxHp * this.mercyLine(t);
    if (mercyBoss) raw *= 1 + KW.MERCY_BOSS;
    const g = actor.side === 'party' ? actor.sig : undefined;
    const crit = (t.status.accused && actor.passive?.kind === 'critOnAccused') || (!!g?.critUnderHalf && t.hp < t.maxHp / 2) || this.rng() < critOf(actor, skill) + this.critBonus(actor);
    const shatter = crit && !!g?.shatter && !!t.status.confessed && !!t.status.accused;
    if (crit) {
      raw *= CRIT_MULT + (actor.critDmg ?? 0) + (t.status.confessed ? KW.SHATTER : 0) + (shatter ? g!.shatter!.crit : 0);
      if (g?.critConsumeGuilt && t.guilt) {
        raw *= 1 + g.critConsumeGuilt * t.guilt;
        events.push({ type: 'status', uid: t.uid, label: `Guilt -${t.guilt}` });
        t.guilt = 0;
      }
    }
    const pierceArmor = Math.min(1, (skill.armorPierce ?? 0) + (g?.scarPierce ?? 0) * (actor.scars ?? 0));
    let dmg = Math.max(1, Math.round(damageAfterArmor(raw, defenceAgainst(t, dmgOf(actor, skill)) * (1 - pierceArmor)) * this.vary() * this.guardOf(t)));
    let blocked = 0;
    if (t.status.shield && !skill.pierceShield) {
      blocked = Math.min(t.status.shield, dmg);
      t.status.shield -= blocked;
      dmg -= blocked;
    }
    dmg = Math.min(dmg, t.hp);
    if (skill.cannotKill && t.side !== actor.side) dmg = Math.max(0, Math.min(dmg, t.hp - Math.max(1, Math.ceil(t.maxHp * this.mercyLine(t)))));
    if (actor.side === 'enemy' && t.side === 'party') dmg = this.guardKits(actor, t, dmg, events);
    if (dmg === t.hp && t.passive?.kind === 'unbroken' && !t.spentUnbroken) {
      t.spentUnbroken = true;
      dmg = t.hp - 1;
      events.push({ type: 'status', uid: t.uid, label: t.passive.name });
      if (t.sig?.unbrokenOverwatch) {
        t.status.overwatch = { skill: KW.OVERWATCH_HIT, turns: KW.OVERWATCH_TURNS };
        events.push({ type: 'status', uid: t.uid, label: 'Overwatch' });
      }
      if (t.sig?.unbrokenHeal) for (const a of this.alive('party')) if (a !== t) this.mend(a, a.maxHp * t.sig.unbrokenHeal, events);
    }
    t.hp -= dmg;
    events.push({ type: 'damage', uid: t.uid, amount: dmg, blocked, crit });
    if (t.side === 'party' && actor.side === 'enemy') this.hurtZeal(t, dmg, events);
    if (t.side === 'enemy' && actor.side === 'party') this.woundWrath(t, dmg, events);
    if (t.side === 'party' && dmg > 0) this.struckKits(actor, t, events);
    if (blocked > 0 && !t.status.shield && t.status.shieldBy) {
      const by = this.units.find((u) => u.uid === t.status.shieldBy);
      t.status.shieldBy = undefined;
      const w = by && by.hp > 0 ? by.sig?.shieldBreakWeaken : undefined;
      if (w && actor.hp > 0 && actor.side !== t.side) {
        actor.status.weaken = { pct: w, turns: 2 };
        events.push({ type: 'status', uid: actor.uid, label: 'Shield of Ash' });
      }
    }
    const leech = (actor.passive?.kind === 'lifesteal' ? actor.passive.value ?? 0 : 0) + (g?.lifesteal ?? 0) + (g?.strideLifesteal ? g.strideLifesteal.base + g.strideLifesteal.per * (actor.stride ?? 0) : 0);
    if (dmg > 0 && leech > 0 && actor.hp > 0) this.leech(actor, dmg * leech, events);
    if (dmg > 0 && skill.drain && actor.hp > 0) this.mend(actor, dmg * skill.drain, events);
    if (dmg > 0 && skill.lifelink) for (const a of this.alive(actor.side)) this.mend(a, dmg * skill.lifelink, events);
    const thorns = (t.passive?.kind === 'thorns' ? (t.passive.value ?? 0) : 0) + (t.status.thorns?.pct ?? 0);
    if (dmg > 0 && thorns > 0 && actor !== t && actor.hp > 0) {
      events.push({ type: 'status', uid: t.uid, label: t.status.thorns ? 'Thorns' : t.passive!.name });
      this.pierce(actor, Math.round(dmg * thorns), events);
      if (actor.hp <= 0 && t.sig?.thornsMercy) {
        events.push({ type: 'status', uid: actor.uid, label: 'Mercy' });
        for (const a of this.alive('party')) this.mend(a, a.maxHp * KW.MERCY_HEAL, events);
      }
    }
    // Riposte: a Sentinel on guard (or with the passive) strikes back once per blow.
    let counter = (t.status.counter?.mult ?? 0) + (t.passive?.kind === 'riposte' ? (t.passive.value ?? 0) : 0);
    if (dmg > 0 && counter > 0 && !this.countering && t.hp > 0 && actor.hp > 0 && actor.side !== t.side) {
      const tg = t.side === 'party' ? t.sig : undefined;
      if (tg?.owCounter && t.status.overwatch) counter *= 1 + tg.owCounter;
      if (tg?.counterPerScar && t.scars) counter *= 1 + tg.counterPerScar * t.scars;
      const vindicate = !!tg?.guiltCounter && (actor.guilt ?? 0) >= KW.GUILT_MAX;
      if (vindicate) {
        counter += 0.3 * actor.guilt!;
        actor.guilt = 0;
      }
      this.countering = true;
      events.push({ type: 'status', uid: t.uid, label: vindicate ? 'Vindicate!' : 'Riposte!' });
      this.hit(t, actor, { id: 'riposte', name: 'Riposte', desc: '', from: [], target: 'enemy', mult: counter }, events);
      this.countering = false;
      if (actor.hp > 0 && tg?.counterBleed) this.applyEffects(t, actor, { id: 'riposte', name: 'Riposte', desc: '', from: [], target: 'enemy', bleed: { mult: 0.2, turns: tg.counterBleed } }, events);
      if (actor.hp > 0 && tg?.guiltCounter && !vindicate) this.addGuilt(actor, 1, events);
    }
    if (mercyBoss && t.wrath) {
      t.wrath = Math.max(0, t.wrath - KW.MERCY_WRATH);
      events.push({ type: 'status', uid: t.uid, label: `Mercy -${KW.MERCY_WRATH} Wrath` });
    }
    // Guilt: a Tribunal Sister's hit on the Accused weighs on it.
    if (t.hp > 0 && t.status.accused && this.isKw(actor, 'guilt') && skill.id !== 'riposte') this.addGuilt(t, 1, events);
    // Mercy: a common foe left under the line is ended, and the party heals on its ash.
    let mercy = false;
    if (t.hp > 0 && !t.boss && !skill.cannotKill && this.isKw(actor, 'mercy') && t.hp < t.maxHp * Math.max(this.mercyLine(t), skill.mercyLine ?? 0)) {
      events.push({ type: 'status', uid: t.uid, label: 'Mercy' });
      this.log.push(`  ${actor.name} grants ${t.name} Mercy`);
      const rest = t.hp;
      t.hp = 0;
      mercy = true;
      events.push({ type: 'damage', uid: t.uid, amount: rest, blocked: 0 });
      for (const a of this.alive('party')) this.mend(a, a.maxHp * KW.MERCY_HEAL, events);
    }
    // Shatter: the blow splashes onto the foes beside it.
    if (shatter && dmg > 0) {
      const near = this.alive(t.side).filter((o) => o !== t && Math.abs(o.rank - t.rank) === 1);
      for (const o of near) this.pierce(o, Math.round(dmg * g!.shatter!.splash), events);
    }
    if (t.hp <= 0) {
      const guiltLeft = t.guilt ?? 0;
      this.kill(t, events);
      if (mercy) this.mercyKill(actor, events);
      if (g?.passGuilt && guiltLeft > 0) {
        const next = this.alive(t.side).sort((a, b) => a.rank - b.rank)[0];
        if (next) this.addGuilt(next, guiltLeft, events);
      }
      if (actor.side === 'party' && actor.passive?.kind === 'zealOnKill') this.addZeal(actor.passive.value ?? 0, events, actor.passive.name, actor);
    } else this.checkPhase(t, events);
  }

  /** Heals a unit (no overheal), with a heal event. */
  private mend(u: Unit, amount: number, events: BattleEvent[]) {
    if (u.hp <= 0) return;
    const real = Math.min(u.maxHp - u.hp, Math.round(amount * this.healOf(u)));
    if (real > 0) {
      u.hp += real;
      events.push({ type: 'heal', uid: u.uid, amount: real });
    }
  }

  /** Raises every fallen unit on the user's side with this share of max HP, behind the living. */
  private revive(actor: Unit, pct: number, events: BattleEvent[]) {
    for (const u of this.units) {
      if (u.side !== actor.side || u.hp > 0) continue;
      u.hp = Math.max(1, Math.round(u.maxHp * pct));
      u.status = {};
      u.rank = this.alive(actor.side).length;
      if (u.zeal !== undefined) u.zeal = 0;
      this.log.push(`  ${u.name} rises`);
      events.push({ type: 'revive', uid: u.uid }, { type: 'status', uid: u.uid, label: 'Raised!' });
    }
  }

  /** Damage multiplier from a living Sister's bulwark passive. */
  private guardOf(t: Unit) {
    if (t.side !== 'party') {
      const g = t.traits?.guarded;
      return g && this.alive('enemy').some((u) => u !== t) ? 1 - g : 1;
    }
    const party = this.alive('party');
    const g = party.find((u) => u.passive?.kind === 'bulwark');
    let f = (g ? 1 - (g.passive!.value ?? 0) : 1) * (1 - (this.hound?.howl.ward ?? 0)) * (1 - (t.symbol?.guard ?? 0));
    for (const u of party) {
      const s = u.sig;
      if (!s) continue;
      if (s.guard) f *= 1 - s.guard;
      if (s.remainsGuard && this.kw.remains >= 3 && Math.abs(u.rank - t.rank) <= 1) f *= 1 - s.remainsGuard;
      if (s.rampart && u.rank === 1 && t.rank === 2) f *= 1 - s.rampart;
      if (s.hymnTauntWard && u.status.taunt && this.kw.hymns.length) f *= 1 - s.hymnTauntWard;
      if (s.tideGuard && this.kw.tide) f *= 1 - s.tideGuard * this.kw.tide;
    }
    return f;
  }

  /** Expected damage of a skill on one target, before shields and luck. Used by Auto and target previews. */
  preview(actor: Unit, skill: SkillDef, t: Unit): number {
    let total = 0;
    if (skill.mult) {
      let raw = this.attackOf(actor) * skill.mult * this.relicMult(actor, skill) * baneMult(actor, t) * wardOf(t);
      if (skill.bossBonus && t.boss) raw *= 1 + skill.bossBonus;
      if (skill.lowHpBonus && actor.hp < actor.maxHp / 2) raw *= 1 + skill.lowHpBonus;
      if (t.status.accused) raw *= ACCUSED_MULT * (1 + (skill.bonusIfAccused ?? 0));
      if (t.status.weaken && skill.bonusIfWeak) raw *= 1 + skill.bonusIfWeak;
      raw *= this.executeMult(actor, t, skill);
      if (actor.passive?.kind === 'executioner' && t.hp < t.maxHp / 2) raw *= 1 + (actor.passive.value ?? 0);
      raw *= this.keywordMult(actor, t) * this.sigMult(actor, t);
      const critChance = t.status.accused && actor.passive?.kind === 'critOnAccused' ? 1 : Math.min(1, critOf(actor, skill));
      raw *= 1 + critChance * (CRIT_MULT - 1 + (actor.critDmg ?? 0));
      total += damageAfterArmor(raw, defenceAgainst(t, dmgOf(actor, skill)) * (1 - (skill.armorPierce ?? 0))) * this.guardOf(t);
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
    if (u.boss && u.side === 'enemy') {
      const passed = KW.REMAINS_MARKS.filter((m) => u.hp <= u.maxHp * m).length;
      const had = this.kw.marks[u.uid] ?? 0;
      if (passed > had) {
        this.kw.marks[u.uid] = passed;
        this.gainRemains(passed - had, events);
      }
    }
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
    this.gainRemains(1, events);
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
    if (u.side === 'enemy') this.foeFellKits(events);
    else this.sisterFellKits(u, events);
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
    if (moved) {
      events.push({ type: 'move', uid: u.uid });
      this.stride(u, events);
    }
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
    actor.steps = (actor.steps ?? 0) + 1;
    actor.stepped = !(actor.sig?.doubleStep && actor.steps < 2);
    this.log.push(`${actor.name} steps with ${other.name}`);
    const events: BattleEvent[] = [{ type: 'move', uid: actor.uid }, { type: 'move', uid: other.uid }];
    this.stride(actor, events);
    return events;
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
    this.stride(actor, events);
  }

  private summon(type: string, events: BattleEvent[]) {
    const line = this.alive('enemy');
    if (line.length >= 4) return;
    const u = makeEnemy(type, `summon-${++this.summons}`, line.length + 1, this.enemyScale);
    if (this.locked) u.status.delayed = true;
    this.units.push(u);
    this.planIntent(u);
    events.push({ type: 'summon', uid: u.uid });
  }

  // ---------------- Order keywords (systems/keywords.ts) ----------------

  /** True when a Sister of the keyword's Order is the actor. */
  private isKw(u: Unit | undefined, kw: KW.Keyword) {
    return !!u && u.side === 'party' && !!u.order && ORDER_KW[u.order] === kw;
  }

  /** A living Sister of the keyword's Order is in the fight. */
  private partyHas(kw: KW.Keyword) {
    return this.alive('party').some((u) => this.isKw(u, kw));
  }

  /** A foe's Mercy line: the base, plus Foretold. */
  mercyLine(t: Unit) {
    return KW.MERCY_LINE + (t.status.foretold?.pct ?? 0) + (this.sigHolder('mercyUp')?.sig!.mercyUp ?? 0);
  }

  /** Damage from Guilt on the target and the actor's Scars. */
  private keywordMult(actor: Unit, t: Unit) {
    let f = 1;
    if (t.side === 'enemy' && t.guilt) f *= 1 + KW.GUILT_DMG * t.guilt;
    if (this.isKw(actor, 'scars') && actor.scars) f *= 1 + KW.SCAR_DMG * actor.scars;
    return f;
  }

  private addGuilt(t: Unit, n: number, events: BattleEvent[]) {
    const before = t.guilt ?? 0;
    t.guilt = Math.min(KW.GUILT_MAX, before + n);
    if (t.guilt > before) events.push({ type: 'status', uid: t.uid, label: `Guilt ${t.guilt}` });
  }

  private gainRemains(n: number, events: BattleEvent[]) {
    if (n <= 0 || !this.partyHas('remains')) return;
    const before = this.kw.remains;
    this.kw.remains = Math.min(this.kw.remainsMax, before + n);
    const got = this.kw.remains - before;
    if (got > 0) {
      events.push({ type: 'text', text: `Remains ${this.kw.remains}/${this.kw.remainsMax}` });
      this.log.push(`  remains ${this.kw.remains}`);
      const rh = this.sigHolder('remainsHeal');
      if (rh) for (const a of this.alive('party')) this.mend(a, a.maxHp * rh.sig!.remainsHeal! * got, events);
      for (const u of this.alive('party')) {
        if (u.sig?.remainsZeal) this.addZeal(u.sig.remainsZeal * got, events, 'Harvest', u);
        if (u.sig?.remainsAtk) u.bonusAtk = Math.min(u.sig.remainsAtk.cap, (u.bonusAtk ?? 0) + u.sig.remainsAtk.per * got);
      }
    }
  }

  /** Thorn Covenant: a Scar for each full step of max HP she loses to herself or bleeding. */
  private scar(u: Unit, dmg: number, events: BattleEvent[]) {
    if (!this.isKw(u, 'scars') || dmg <= 0) return;
    this.scarFrac[u.uid] = (this.scarFrac[u.uid] ?? 0) + dmg / u.maxHp / KW.SCAR_STEP;
    const whole = Math.floor(this.scarFrac[u.uid]);
    if (!whole) return;
    this.scarFrac[u.uid] -= whole;
    this.addScars(u, whole, events);
  }

  /** Red Pilgrimage: Stride whenever a Pilgrim changes rank. */
  private stride(u: Unit, events: BattleEvent[], n = 1) {
    if (!this.isKw(u, 'stride') || u.hp <= 0) return;
    const before = u.stride ?? 0;
    u.stride = Math.min(KW.STRIDE_MAX, before + n);
    if (u.stride > before) events.push({ type: 'status', uid: u.uid, label: `Stride ${u.stride}` });
  }

  /** Start of a round: the Tide rises and Hymns play. */
  private roundKeywords(events: BattleEvent[]) {
    if (this.partyHas('tide') && this.kw.tide < KW.TIDE_MAX) {
      this.raiseTide(1, events);
      events.push({ type: 'text', text: `The Tide rises: ${this.kw.tide}/${KW.TIDE_MAX}` });
    }
    const omens = this.sigHolder('tideZeal');
    if (omens && this.kw.tide > 0) this.addZeal(omens.sig!.tideZeal! * this.kw.tide, events, 'Tide of Omens');
    for (const u of this.alive('party')) {
      const br = u.sig?.burnRound;
      if (!br) continue;
      const d = Math.min(u.hp - 1, Math.round(u.maxHp * br.hp));
      if (d > 0) {
        u.hp -= d;
        events.push({ type: 'damage', uid: u.uid, amount: d, blocked: 0 });
        this.scar(u, d, events);
      }
      this.addZeal(br.zeal, events, 'Burns at Both Ends');
    }
    for (const h of this.kw.hymns) this.playHymn(h, events);
    this.kw.hymns = this.kw.hymns.filter((h) => {
      if (--h.rounds > 0) return true;
      const nh = this.sealHolder('noteHeld');
      if (!nh) return false;
      this.breakSeal(nh, events);
      h.rounds = 2;
      return true;
    });
  }

  /** A Hymn's verse: its effects on every living ally (and foe), lasting the round. */
  private playHymn(h: KW.Hymn, events: BattleEvent[]) {
    const singer = this.units.find((u) => u.uid === h.by);
    if (!singer) return;
    const verse = (part: Partial<SkillDef>, who: Unit[]) => {
      const base: SkillDef = { id: `hymn-${h.name}`, name: h.name, desc: '', from: [], target: 'ally', ...(h.double ? doubled(part) : part) };
      for (const u of who) {
        // A Hymn never wears down a stronger blessing or curse already there.
        const sk = { ...base };
        for (const k of ['empower', 'ward', 'critUp', 'weaken', 'regen'] as const) {
          const cur = u.status[k];
          if (cur && sk[k] && cur.pct > sk[k]!.pct) sk[k] = undefined;
        }
        this.applyEffects(singer, u, sk, events);
      }
    };
    if (h.allies) verse(h.allies, this.alive('party').filter((u) => !this.space || this.space.inHymn(singer, u)));
    if (h.foes) verse(h.foes, this.alive('enemy'));
  }

  /** Iron Vigil: every Sister on Overwatch reacts to this foe before it acts. */
  private overwatch(foe: Unit): BattleEvent[] {
    const events: BattleEvent[] = [];
    for (const u of this.alive('party')) {
      const ow = u.status.overwatch;
      if (!ow || foe.hp <= 0) continue;
      if (this.space && !this.space.inOverwatch(u, foe)) continue;
      u.status.overwatch = undefined;
      events.push({ type: 'status', uid: u.uid, label: 'Overwatch!' });
      this.log.push(`  ${u.name} reacts on Overwatch`);
      if (ow.skill.target === 'ally') {
        // A guardian's reaction: it mends the most hurt Sister.
        const low = [...this.alive('party')].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (low) this.applyEffects(u, low, ow.skill, events);
      } else {
        const sk = this.condFor(ow.skill, foe);
        if (sk.mult) this.hit(u, foe, sk, events);
        if (foe.hp > 0) this.applyEffects(u, foe, sk, events);
        const behind = u.sig?.rampart && u.rank === 1 ? this.alive('party').find((x) => x.rank === 2) : undefined;
        if (behind && foe.hp > 0) {
          events.push({ type: 'status', uid: behind.uid, label: 'Rampart!' });
          this.hit(behind, foe, KW.OVERWATCH_HIT, events);
        }
        const so = this.sigHolder('owWeaken');
        if (so && foe.hp > 0) {
          foe.status.weaken = { pct: so.sig!.owWeaken!, turns: 2 };
          events.push({ type: 'status', uid: foe.uid, label: 'Weakened' });
        }
        if (foe.hp > 0 && foe.status.charging && foe.wrath !== undefined) {
          foe.wrath = Math.max(0, foe.wrath - KW.OVERWATCH_WRATH);
          events.push({ type: 'status', uid: foe.uid, label: `-${KW.OVERWATCH_WRATH} Wrath` });
        }
      }
      const oz = this.sigHolder('owZeal');
      if (oz) this.addZeal(oz.sig!.owZeal!, events, "Sentry's Omen", u);
    }
    return events;
  }

  /** Spends an Order counter: the skill comes back stronger by `per` for each point spent. */
  private spendFor(actor: Unit, skill: SkillDef, target: Unit | undefined, events: BattleEvent[]): SkillDef {
    const sp = skill.spend!;
    const have = sp.kw === 'remains' ? this.kw.remains : sp.kw === 'tide' ? this.kw.tide : sp.kw === 'guilt' ? target?.guilt ?? 0 : sp.kw === 'scars' ? actor.scars ?? 0 : actor.stride ?? 0;
    if (sp.need && have < (sp.n ?? 1)) return sp.orElse ? { ...skill, ...sp.orElse, spend: undefined } : skill;
    const n = Math.min(have, sp.n ?? have);
    if (n <= 0) return skill;
    if (sp.kw === 'remains') {
      this.kw.remains -= n;
      this.spentRemains(n, events);
    }
    else if (sp.kw === 'tide') this.kw.tide -= n;
    else if (sp.kw === 'guilt') target!.guilt = (target!.guilt ?? 0) - n;
    else if (sp.kw === 'scars') actor.scars = (actor.scars ?? 0) - n;
    else actor.stride = (actor.stride ?? 0) - n;
    events.push({ type: 'status', uid: actor.uid, label: `${KW.KW_NAME[sp.kw as KW.Keyword]} -${n}` });
    this.log.push(`  ${actor.name} spends ${n} ${sp.kw}`);
    const p = sp.per;
    const full = sp.kw === 'guilt' && n >= KW.GUILT_MAX ? sp.full ?? {} : {};
    return {
      ...skill,
      ...full,
      mult: skill.mult !== undefined ? (skill.mult + (p.multAdd ?? 0) * n) * (1 + (p.multPct ?? 0) * n) : skill.mult,
      shieldPct: p.shieldPct ? (skill.shieldPct ?? 0) + p.shieldPct * n : skill.shieldPct,
      healPct: p.healPct ? (skill.healPct ?? 0) + p.healPct * n : skill.healPct,
      zealGain: p.zeal ? (skill.zealGain ?? 0) + p.zeal * n : skill.zealGain,
      armorPierce: p.armorPierce ? Math.min(1, (skill.armorPierce ?? 0) + p.armorPierce * n) : skill.armorPierce,
    };
  }

  /** Keyword effects a skill lays on one target. */
  private keywordEffects(actor: Unit, t: Unit, skill: SkillDef, events: BattleEvent[]) {
    if (skill.guilt && t.side !== actor.side) this.addGuilt(t, skill.guilt, events);
    if (skill.confess && t.side !== actor.side) {
      t.status.confessed = Math.max(t.status.confessed ?? 0, skill.confess);
      events.push({ type: 'status', uid: t.uid, label: 'Confessed' });
    }
    if (skill.foretell && t.side !== actor.side) {
      t.status.foretold = { ...skill.foretell };
      events.push({ type: 'status', uid: t.uid, label: 'Foretold' });
    }
    if (skill.overwatch && t.side === actor.side) {
      t.status.overwatch = { skill: skill.overwatch, turns: KW.OVERWATCH_TURNS };
      events.push({ type: 'status', uid: t.uid, label: 'Overwatch' });
    }
    if (skill.giveStride && t.side === actor.side) this.stride(t, events, skill.giveStride);
    if (skill.hurtAllies && t.side === actor.side) {
      const d = Math.min(t.hp - 1, Math.round(t.maxHp * skill.hurtAllies));
      if (d > 0) {
        t.hp -= d;
        events.push({ type: 'damage', uid: t.uid, amount: d, blocked: 0 });
        this.scar(t, d, events);
      }
    }
    if (skill.steal && t.side !== actor.side) this.steal(t, events);
    if (skill.catalogue && t.side !== actor.side && !this.catalogued.has(t.ref)) {
      this.catalogued.add(t.ref);
      events.push({ type: 'status', uid: t.uid, label: 'Catalogued' });
    }
  }

  /** After a Sister's skill: Hymns, counter gains, and the Bell. */
  private afterSkill(actor: Unit, skill: SkillDef, events: BattleEvent[]) {
    if (skill.id === 'shift') return;
    if (skill.hymn) {
      const choir = this.isKw(actor, 'hymn');
      const h: KW.Hymn = { by: actor.uid, name: skill.hymn.name, rounds: skill.hymn.rounds, allies: skill.hymn.allies, foes: skill.hymn.foes, choir };
      const others = this.kw.hymns.filter((o) => o.name !== h.name);
      if (choir && others.some((o) => o.choir)) {
        this.kw.hymns = [...others.filter((o) => o.choir).slice(-(KW.HYMN_MAX - 1)), h];
        events.push({ type: 'text', text: `Harmony: ${this.kw.hymns.map((x) => x.name).join(' and ')}` });
        this.addZeal(KW.HARMONY_ZEAL, events, 'harmony');
      } else this.kw.hymns = [h];
      this.playHymn(h, events);
    }
    const g = skill.gain;
    if (g?.remains) this.gainRemains(g.remains, events);
    if (g?.tide) this.raiseTide(g.tide, events);
    if (g?.stride) this.stride(actor, events, g.stride);
    if (g?.scars) this.addScars(actor, g.scars, events);
    if (skill.overwatch && (skill.target === 'enemy' || skill.target === 'allEnemies') && actor.hp > 0) {
      actor.status.overwatch = { skill: skill.overwatch, turns: KW.OVERWATCH_TURNS };
      events.push({ type: 'status', uid: actor.uid, label: 'Overwatch' });
    }
    if (skill.guiltWeaken) {
      for (const e of this.alive('enemy')) {
        if (!e.guilt) continue;
        e.status.weaken = { pct: Math.min(0.5, skill.guiltWeaken * e.guilt), turns: 2 };
        events.push({ type: 'status', uid: e.uid, label: 'Weakened' });
      }
    }
    if (actor.sig?.singStride) for (const u of this.alive('party')) this.stride(u, events, actor.sig.singStride);
    if (this.isKw(actor, 'toll') && actor.hp > 0) {
      const twice = actor.sig?.doubleRingLow && actor.hp < actor.maxHp / 2 ? 2 : 1;
      this.ring((1 + (g?.toll ?? 0)) * twice, events);
    }
    if (skill.pealNow) this.ring(KW.PEAL_EVERY - (this.kw.toll % KW.PEAL_EVERY), events);
  }

  /** Hollow Bell: each toll rings; every third is a Peal; the twelfth is Midnight. */
  private ring(n: number, events: BattleEvent[]) {
    for (let i = 0; i < n; i++) {
      this.kw.toll += 1;
      if (this.kw.toll % KW.PEAL_EVERY === 0) {
        events.push({ type: 'text', text: 'The Bell peals!' });
        for (const u of this.alive('party')) if (this.isKw(u, 'toll')) this.addZeal(KW.PEAL_ZEAL, events, 'Peal', u);
        this.peal(events);
      }
      if (this.kw.toll >= KW.MIDNIGHT_AT && !this.kw.midnight) {
        this.kw.midnight = true;
        events.push({ type: 'text', text: 'Midnight tolls. The faithful rise.' });
        const bell = this.alive('party').find((u) => this.isKw(u, 'toll'));
        if (bell) this.revive(bell, KW.MIDNIGHT_RAISE, events);
      }
    }
  }

  // ---------------- Sister kits: signatures and Seals (data/kits.ts) ----------------

  /** A living Sister whose signature sets this rule. */
  private sigHolder<K extends keyof Sig>(k: K): Unit | undefined {
    return this.alive('party').find((u) => u.sig?.[k] !== undefined && u.sig[k] !== false);
  }

  /** A Sister whose Seal of this kind has not fired yet (alive unless `dead` is allowed). */
  private sealHolder(kind: SealKind, dead = false): Unit | undefined {
    return this.units.find((u) => u.side === 'party' && (dead || u.hp > 0) && u.seal?.kind === kind && !u.sealUsed);
  }

  /** Fires a Seal: marks it used and announces it. */
  private breakSeal(u: Unit, events: BattleEvent[]) {
    u.sealUsed = true;
    events.push({ type: 'phase', uid: u.uid, text: `SAINT'S SEAL: ${u.seal!.name}` });
    this.log.push(`  ${u.name}'s Seal: ${u.seal!.name}`);
  }

  /** Fight-start signatures: Tide, Remains cap, Confessed foes, an opening Overwatch, a first move. */
  private openKits(party: Unit[], enemies: Unit[]) {
    for (const u of party) {
      const g = u.sig;
      if (!g) continue;
      if (g.tideStart && this.isKw(u, 'tide')) this.kw.tide = Math.min(KW.TIDE_MAX, Math.max(this.kw.tide, g.tideStart));
      if (g.remainsCap) this.kw.remainsMax = Math.max(this.kw.remainsMax, g.remainsCap);
      if (g.confessAll) for (const e of enemies) e.status.confessed = Math.max(e.status.confessed ?? 0, g.confessAll);
      if (g.firstRound) u.status.haste = Math.max(u.status.haste ?? 0, 1);
      if (g.openOverwatch) {
        const fast = [...party].filter((x) => x.hp > 0).sort((a, b) => b.spd - a.spd)[0];
        if (fast) fast.status.overwatch = { skill: KW.OVERWATCH_HIT, turns: KW.OVERWATCH_TURNS };
      }
    }
  }

  /** Damage from a Sister's signature for this hit (beyond attack). */
  private sigMult(actor: Unit, t: Unit) {
    const g = actor.sig;
    if (!g || actor.side !== 'party') return this.catalogued.has(t.ref) && actor.side === 'party' ? 1.05 : 1;
    let f = this.catalogued.has(t.ref) ? 1.05 : 1;
    if (g.dmgUnderHalf && t.hp < t.maxHp / 2) f *= 1 + g.dmgUnderHalf;
    if (g.dmgUnder30 && t.hp < t.maxHp * EXECUTE_AT) f *= 1 + g.dmgUnder30;
    if (g.backRankDmg && actor.rank >= 3) f *= 1 + g.backRankDmg;
    if (g.strideDmg && actor.stride) f *= 1 + g.strideDmg * actor.stride;
    if (g.guiltDmg && t.guilt) f *= 1 + g.guiltDmg * t.guilt;
    return f;
  }

  /** The skill with its condition met for this target. */
  private condFor(skill: SkillDef, t: Unit): SkillDef {
    const c = skill.cond;
    if (!c) return skill;
    const st = t.status;
    const met =
      c.if === 'confessed' ? !!st.confessed
      : c.if === 'underHalf' ? t.hp < t.maxHp / 2
      : c.if === 'burning' ? st.poison?.kind === 'burn'
      : c.if === 'accused' ? !!st.accused
      : c.if === 'boss' ? !!t.boss
      : c.if === 'overwatch' ? !!st.overwatch
      : this.kw.hymns.length > 0;
    if (!met) return skill;
    const out = { ...skill, ...c.then };
    // A boss resists the stun the condition replaces.
    if (c.if === 'boss' && c.then.delay) out.stun = undefined;
    return out;
  }

  /** The skill grown by the Tide. */
  private tideFor(skill: SkillDef): SkillDef {
    const b = skill.byTide!;
    const n = this.kw.tide;
    let out: SkillDef = { ...skill };
    const p = b.per;
    if (p && n > 0) {
      if (p.multPct && out.mult) out.mult *= 1 + p.multPct * n;
      if (p.drain) out.drain = (out.drain ?? 0) + p.drain * n;
      if (p.shieldPct) out.shieldPct = (out.shieldPct ?? 0) + p.shieldPct * n;
      if (p.critPct) out.critUp = { pct: (out.critUp?.pct ?? 0) + p.critPct * n, turns: out.critUp?.turns ?? 2 };
      if (p.regenPct) out.regen = { pct: (out.regen?.pct ?? 0) + p.regenPct * n, turns: out.regen?.turns ?? 2 };
    }
    if (b.at !== undefined && b.then && n >= b.at) out = { ...out, ...b.then };
    return out;
  }

  /** The skill grown by the Guilt of the most guilty foe, and by the user's Stride and Scars. */
  private growFor(actor: Unit, skill: SkillDef): SkillDef {
    let out = skill;
    if (skill.perGuilt) {
      const g = Math.max(0, ...this.alive('enemy').map((e) => e.guilt ?? 0));
      const p = skill.perGuilt;
      out = { ...out };
      if (p.shieldPct && out.shieldPct) out.shieldPct += p.shieldPct * g;
      if (p.empowerPct && out.empower) out.empower = { ...out.empower, pct: out.empower.pct + p.empowerPct * g };
    }
    if (skill.perStride && actor.stride && out.mult) out = { ...out, mult: out.mult * (1 + skill.perStride * actor.stride) };
    if (skill.perScar && actor.scars && out.mult) out = { ...out, mult: out.mult * (1 + skill.perScar * actor.scars) };
    return out;
  }

  /** Random living foes for a Reliquary Volley: one per Remains spent. */
  private volleyTargets(actor: Unit, max: number, events: BattleEvent[]): Unit[] {
    const n = Math.min(max, this.kw.remains);
    if (n <= 0) return [];
    this.kw.remains -= n;
    events.push({ type: 'status', uid: actor.uid, label: `Remains -${n}` });
    this.spentRemains(n, events);
    const out: Unit[] = [];
    for (let i = 0; i < n; i++) {
      const foes = this.alive('enemy');
      if (foes.length) out.push(foes[Math.floor(this.rng() * foes.length)]);
    }
    return out;
  }

  /** Signatures that answer the party spending Remains. */
  private spentRemains(n: number, events: BattleEvent[]) {
    for (const u of this.alive('party')) if (u.sig?.remainsSpendHeal) this.mend(u, u.maxHp * u.sig.remainsSpendHeal * n, events);
  }

  /** Adds Scars to a Covenant Sister, with the Zeal they ring out. */
  private addScars(u: Unit, n: number, events: BattleEvent[]) {
    if (!this.isKw(u, 'scars') || n <= 0) return;
    const before = u.scars ?? 0;
    u.scars = Math.min(KW.SCARS_MAX, before + n);
    const got = u.scars - before;
    if (got <= 0) return;
    events.push({ type: 'status', uid: u.uid, label: `Scars ${u.scars}` });
    const lash = this.sigHolder('scarZeal');
    if (lash) this.addZeal(lash.sig!.scarZeal! * got, events, 'Hymn of the Lash');
  }

  /** Sets the Tide (up to its cap), with High Water the first time it is full. */
  private raiseTide(n: number, events: BattleEvent[]) {
    if (!this.partyHas('tide') || n <= 0) return;
    this.kw.tide = Math.min(KW.TIDE_MAX, this.kw.tide + n);
    if (this.kw.tide >= KW.TIDE_MAX) {
      const hw = this.sealHolder('highWater');
      if (hw) {
        this.breakSeal(hw, events);
        this.addZeal(25, events, hw.seal!.name);
      }
    }
  }

  /** Raises one fallen Sister with this share of HP. */
  private raiseOne(u: Unit, pct: number, events: BattleEvent[], label = 'Raised!') {
    u.hp = Math.max(1, Math.round(u.maxHp * pct));
    u.status = {};
    u.rank = this.alive(u.side).length;
    if (u.zeal !== undefined) u.zeal = 0;
    this.log.push(`  ${u.name} rises`);
    events.push({ type: 'revive', uid: u.uid }, { type: 'status', uid: u.uid, label });
  }

  /** A Mercy kill's extra rewards from signatures. */
  private mercyKill(actor: Unit, events: BattleEvent[]) {
    const z = this.sigHolder('mercyZeal');
    if (z) this.addZeal(z.sig!.mercyZeal!, events, 'Mercy');
    const c = this.sigHolder('mercyCure');
    if (c) {
      for (const a of this.alive('party')) {
        this.mend(a, a.maxHp * c.sig!.mercyCure!, events);
        if (a.status.poison || a.status.bleed) {
          a.status.poison = a.status.bleed = undefined;
          events.push({ type: 'status', uid: a.uid, label: 'Cured' });
        }
      }
    }
    if (actor.sig?.mercyExtra && actor.hp > 0 && this.extraRound[actor.uid] !== this.round) {
      this.extraRound[actor.uid] = this.round;
      this.queue = [actor.uid, ...this.queue.filter((id) => id !== actor.uid)];
      events.push({ type: 'status', uid: actor.uid, label: 'Coup de Grâce: again!' });
    }
  }

  /** Peals: each Bell Sister's own Peal effect. */
  private peal(events: BattleEvent[]) {
    for (const u of this.alive('party')) {
      const p = u.sig?.peal;
      if (!p) continue;
      const foes = () => this.alive('enemy');
      if (p.strikeAll) for (const e of foes()) this.hit(u, e, { id: 'peal', name: 'Peal', desc: '', from: [], target: 'enemy', mult: p.strikeAll }, events);
      if (p.strikeLowest) {
        const low = [...foes()].sort((a, b) => a.hp - b.hp)[0];
        if (low) this.hit(u, low, { id: 'peal', name: 'Peal', desc: '', from: [], target: 'enemy', mult: p.strikeLowest }, events);
      }
      if (p.accuseAll) for (const e of foes()) e.status.accused = Math.max(e.status.accused ?? 0, p.accuseAll);
      if (p.accuseAll && foes().length) events.push({ type: 'text', text: `${u.name}'s Peal: every foe is Accused.` });
      if (p.burnAll) {
        const dmg = Math.max(1, Math.round(this.attackOf(u) * p.burnAll));
        for (const e of foes()) {
          const old = e.status.poison;
          e.status.poison = old ? { ...old, dmg: old.dmg + dmg, turns: Math.max(old.turns, 2) } : { dmg, turns: 2, kind: 'burn', by: u.uid };
          events.push({ type: 'status', uid: e.uid, label: 'Burning' });
        }
      }
      if (p.zealAll) this.addZeal(p.zealAll, events, 'Peal');
      if (p.shieldAll) {
        for (const a of this.alive('party')) {
          const amount = Math.round(a.maxHp * p.shieldAll);
          a.status.shield = Math.max(a.status.shield ?? 0, amount);
          events.push({ type: 'shield', uid: a.uid, amount });
        }
      }
      if (p.healSelf) this.mend(u, u.maxHp * p.healSelf, events);
    }
  }

  /** Start-of-turn signatures: the Drowned Heart, its taunt, and the Overflowing Chalice's raising. */
  private turnKits(actor: Unit, events: BattleEvent[]) {
    const g = actor.sig;
    if (!g || actor.side !== 'party') return;
    if (g.tideHeal && this.kw.tide > 0) for (const a of this.alive('party')) this.mend(a, a.maxHp * g.tideHeal * this.kw.tide, events);
    if (g.tideTaunt && this.kw.tide >= KW.TIDE_MAX) {
      actor.status.taunt = Math.max(actor.status.taunt ?? 0, 1);
      events.push({ type: 'status', uid: actor.uid, label: 'Taunting' });
    }
    if (g.raise3 && this.kw.remains >= 3) {
      const fallen = this.units.find((u) => u.side === 'party' && u.hp <= 0);
      if (fallen) {
        this.kw.remains -= 3;
        this.spentRemains(3, events);
        events.push({ type: 'status', uid: actor.uid, label: 'Remains -3' });
        this.raiseOne(fallen, g.raise3, events);
      }
    }
  }

  /** A foe starts charging: The Mirror Judges and Never Sleep answer it. */
  private chargeKits(foe: Unit, events: BattleEvent[]) {
    const mj = this.sigHolder('hymnWrath');
    if (mj && this.kw.hymns.length && foe.wrath) {
      foe.wrath = Math.max(0, foe.wrath - mj.sig!.hymnWrath!);
      events.push({ type: 'status', uid: foe.uid, label: `-${mj.sig!.hymnWrath} Wrath` });
    }
    const ns = foe.boss ? this.sealHolder('neverSleep') : undefined;
    if (ns) {
      this.breakSeal(ns, events);
      if (foe.wrath) foe.wrath = Math.max(0, foe.wrath - 20);
      events.push({ type: 'status', uid: foe.uid, label: '-20 Wrath' });
      const p = foe.status.poison;
      if (p) {
        foe.status.poison = undefined;
        events.push({ type: 'status', uid: foe.uid, label: 'Ignited!' });
        this.pierce(foe, Math.round(p.dmg * p.turns), events);
      }
    }
  }

  /** One strike of a skill on a target: its repeats, the Duet's echo, and what a kill brings. */
  private strike(actor: Unit, t: Unit, sk: SkillDef, events: BattleEvent[]) {
    const n = sk.target === 'enemy' ? sk.hits ?? 1 : 1;
    const g = actor.side === 'party' ? actor.sig : undefined;
    const duet = !!g?.hymnDouble && this.kw.hymns.length > 0 && sk.target === 'enemy';
    for (let i = 0; i < n && t.hp > 0 && actor.hp > 0; i++) {
      this.hit(actor, t, sk, events);
      if (sk.zealPerHit) this.addZeal(sk.zealPerHit, events, sk.name);
      if (duet) {
        if (g!.hymnStrikeZeal) this.addZeal(g!.hymnStrikeZeal, events, 'Duet');
        if (t.hp > 0) this.hit(actor, t, { ...sk, id: 'duet', name: 'Duet', mult: sk.mult! * g!.hymnDouble! }, events);
      }
    }
    if (t.hp <= 0 && sk.onKill) {
      const k = sk.onKill;
      if (k.zeal) this.addZeal(k.zeal, events, sk.name, actor);
      if (k.remains) this.gainRemains(k.remains, events);
      if (k.toll && this.isKw(actor, 'toll')) this.ring(k.toll, events);
    }
  }

  /** Double damage under the execute line: the skill's own, or a Drowning Bell that rises with the Tide. */
  private executeMult(actor: Unit, t: Unit, skill: SkillDef) {
    const et = actor.side === 'party' ? actor.sig?.executeTide : undefined;
    const line = et ? et.base + et.per * this.kw.tide : EXECUTE_AT;
    const ex = Math.max(skill.execute ?? 0, et ? 1 : 0);
    return ex && t.hp < t.maxHp * line ? 1 + ex : 1;
  }

  /** Extra critical chance from a signature. */
  private critBonus(actor: Unit) {
    const g = actor.side === 'party' ? actor.sig : undefined;
    return g?.critPerRemains ? g.critPerRemains * this.kw.remains : 0;
  }

  /** Heals the user (life drained); a Blood Oath turns the overflow into a shield behind her. */
  private leech(u: Unit, amount: number, events: BattleEvent[]) {
    const want = Math.round(amount * this.healOf(u));
    const real = Math.min(u.maxHp - u.hp, want);
    if (real > 0) {
      u.hp += real;
      events.push({ type: 'heal', uid: u.uid, amount: real });
    }
    const over = want - Math.max(0, real);
    const b = over > 0 && u.sig?.overhealBehind ? this.alive(u.side).find((x) => x.rank === u.rank + 1) : undefined;
    if (b) {
      b.status.shield = (b.status.shield ?? 0) + over;
      events.push({ type: 'shield', uid: b.uid, amount: over });
    }
  }

  /**
   * A foe's blow on a Sister, before it lands: a Blasphemy turned back, Saints who
   * step in, and Seals that refuse a death. Returns the damage she still takes.
   */
  private guardKits(foe: Unit, t: Unit, dmg: number, events: BattleEvent[]): number {
    if (this.reflecting && this.reflecting.boss === foe) {
      const half = Math.floor(dmg / 2);
      this.reflecting.sum += dmg - half;
      dmg = half;
    }
    const ws = this.sealHolder('wallSaint');
    if (ws && ws !== t && dmg > t.maxHp * 0.3) {
      this.breakSeal(ws, events);
      events.push({ type: 'status', uid: t.uid, label: 'Guarded by the Wall' });
      this.pierce(ws, Math.round(dmg / 2), events);
      return 0;
    }
    if (dmg < t.hp) return dmg;
    const wb = this.sealHolder('walkBefore');
    if (wb && wb !== t && wb.hp > dmg) {
      this.breakSeal(wb, events);
      wb.hp -= dmg;
      events.push({ type: 'damage', uid: wb.uid, amount: dmg, blocked: 0 });
      return 0;
    }
    if (t.seal?.kind === 'forbidden' && !t.sealUsed) {
      this.breakSeal(t, events);
      for (const e of this.alive('enemy')) this.addGuilt(e, 3, events);
      return t.hp - 1;
    }
    if (t.seal?.kind === 'unbrokenMidnight' && !t.sealUsed) {
      this.breakSeal(t, events);
      if (!this.kw.midnight) this.ring(Math.max(1, KW.MIDNIGHT_AT - this.kw.toll), events);
      return t.hp - 1;
    }
    const lr = this.sealHolder('lastRites');
    if (lr) {
      this.breakSeal(lr, events);
      this.mend(t, t.maxHp * 0.3, events);
      foe.status.foretold = { pct: 0.15, turns: 2 };
      events.push({ type: 'status', uid: foe.uid, label: 'Foretold' });
      return 0;
    }
    return dmg;
  }

  /** After a Sister is struck: Scars, Testimony's Guilt, and Unmasked. */
  private struckKits(actor: Unit, t: Unit, events: BattleEvent[]) {
    const g = t.sig;
    if (g?.scarOnHit && t.hp > 0) this.addScars(t, g.scarOnHit, events);
    if (actor.side === 'enemy' && actor.hp > 0) {
      if (g?.guiltWhenStruck) this.addGuilt(actor, g.guiltWhenStruck, events);
      else if (t.status.ward && this.sigHolder('guiltOnWarded')) this.addGuilt(actor, 1, events);
    }
    if (t.hp > 0 && t.hp < t.maxHp * 0.3 && t.seal?.kind === 'unmasked' && !t.sealUsed) {
      this.breakSeal(t, events);
      this.mend(t, t.maxHp * 0.25, events);
      this.addScars(t, KW.SCARS_MAX, events);
    }
  }

  /** A Blasphemy is about to land: Seen Before and Reflected Blasphemy. */
  private blasphemyKits(boss: Unit, events: BattleEvent[]) {
    const sb = this.sealHolder('seenBefore');
    if (sb) {
      this.breakSeal(sb, events);
      for (const a of this.alive('party')) {
        a.status.ward = { pct: Math.max(0.4, a.status.ward?.pct ?? 0), turns: Math.max(1, a.status.ward?.turns ?? 0) };
        events.push({ type: 'status', uid: a.uid, label: 'Warded' });
      }
    }
    const rf = this.sealHolder('reflect');
    if (rf) {
      this.breakSeal(rf, events);
      this.reflecting = { boss, sum: 0 };
    }
  }

  /** A Sister's skill, after its targets: effects on the whole field. */
  private extraKits(actor: Unit, skill: SkillDef, events: BattleEvent[]) {
    const wide = (part: Partial<SkillDef>, side: Side) => {
      for (const u of this.alive(side)) {
        const sk = this.condFor({ id: `${skill.id}-also`, name: skill.name, desc: '', from: [], target: side === actor.side ? 'ally' : 'enemy', ...part }, u);
        if (sk.mult) this.hit(actor, u, sk, events);
        if (u.hp > 0) this.applyEffects(actor, u, sk, events);
      }
    };
    if (skill.alsoFoes) wide(skill.alsoFoes, 'enemy');
    if (skill.alsoAllies) wide(skill.alsoAllies, 'party');
    if (skill.delayFastest) {
      const fast = [...this.alive('enemy')].sort((a, b) => b.spd - a.spd)[0];
      if (fast) this.applyEffects(actor, fast, { id: 'undertow', name: skill.name, desc: '', from: [], target: 'enemy', delay: true }, events);
    }
    if (skill.stunSummons) {
      for (const e of this.alive('enemy')) {
        if (!e.uid.startsWith('summon-')) continue;
        e.status.stun = Math.max(e.status.stun ?? 0, skill.stunSummons);
        events.push({ type: 'status', uid: e.uid, label: 'Stunned' });
      }
    }
    if (skill.lockSummons && !this.locked) {
      this.locked = true;
      events.push({ type: 'text', text: 'The crypt is locked: summoned foes will act last.' });
    }
    if (skill.mendLowest) {
      const low = [...this.alive('party')].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (low) this.mend(low, low.maxHp * skill.mendLowest, events);
    }
    if (skill.overwatchAll) {
      for (const a of this.alive('party')) a.status.overwatch = { skill: skill.overwatchAll, turns: KW.OVERWATCH_TURNS };
      events.push({ type: 'text', text: 'The whole line stands on Overwatch.' });
    }
    if (skill.rotate) {
      const line = this.alive('party');
      if (line.length > 1) {
        for (const u of line) {
          u.rank = u.rank === 1 ? line.length : u.rank - 1;
          events.push({ type: 'move', uid: u.uid });
          this.stride(u, events);
        }
        const front = line.find((u) => u.rank === 1)!;
        front.status.haste = Math.max(front.status.haste ?? 0, 1);
        events.push({ type: 'status', uid: front.uid, label: 'Hasted' });
      }
    }
  }

  /** A Sister has fallen: gifts, guards, and the Seals that answer a death. */
  private sisterFellKits(u: Unit, events: BattleEvent[]) {
    const g = u.sig;
    if (g?.fallGift && this.alive('party').length) {
      events.push({ type: 'text', text: `${u.name}'s gift passes to her Sisters.` });
      this.addZeal(g.fallGift.zeal, events, 'Martyr\'s Gift');
      const share = Math.floor((u.scars ?? 0) * g.fallGift.scarsShare);
      for (const a of this.alive('party')) {
        a.status.empower = { pct: Math.max(g.fallGift.empower, a.status.empower?.pct ?? 0), turns: 2 };
        this.addScars(a, share, events);
      }
    }
    if (g?.hymnOnFall) for (const h of this.kw.hymns) h.double = true;
    if (u.seal?.kind === 'drowned' && !u.sealUsed) {
      this.breakSeal(u, events);
      this.pendingRise.push(u.uid);
    }
    const bn = this.sealHolder('bellNoOne');
    if (bn) {
      this.breakSeal(bn, events);
      this.stride(bn, events, KW.STRIDE_MAX);
      bn.status.haste = Math.max(bn.status.haste ?? 0, 1);
    }
    const gb = this.sigHolder('guardBody');
    if (gb) {
      gb.status.taunt = Math.max(gb.status.taunt ?? 0, 2);
      gb.status.counter = { mult: Math.max(0.5, gb.status.counter?.mult ?? 0), turns: 2 };
      events.push({ type: 'status', uid: gb.uid, label: 'Guards the body' });
    }
    const ny = this.sealHolder('notYet');
    if (ny && !this.pendingRise.includes(u.uid)) {
      this.breakSeal(ny, events);
      this.raiseOne(u, 0.25, events, 'Not yet!');
    }
    const living = this.alive('party');
    const last = living.length === 1 ? living[0] : undefined;
    if (last && last.seal?.kind === 'onlyOne' && !last.sealUsed) {
      this.breakSeal(last, events);
      this.mend(last, last.maxHp * 0.5, events);
      last.status.haste = Math.max(last.status.haste ?? 0, 1);
      last.bonusAtk = (last.bonusAtk ?? 0) + 0.4;
    }
  }

  /** A foe has fallen: the Grave Garden. */
  private foeFellKits(events: BattleEvent[]) {
    const gg = this.sigHolder('foeFallHeal');
    if (!gg) return;
    const sg = gg.sig!;
    for (const a of this.alive('party')) {
      this.mend(a, a.maxHp * sg.foeFallHeal!, events);
      if (sg.foeFallThorns && (a.status.thorns?.pct ?? 0) < sg.foeFallThorns) a.status.thorns = { pct: sg.foeFallThorns, turns: 1 };
    }
  }

  /** Takes a foe's blessings for the party's strongest Sister. */
  private steal(t: Unit, events: BattleEvent[]) {
    const st = t.status;
    if (!(st.empower || st.ward || st.haste || st.shield)) return;
    const to = [...this.alive('party')].sort((a, b) => b.atk - a.atk)[0];
    if (to) {
      if (st.empower) to.status.empower = { ...st.empower };
      if (st.ward) to.status.ward = { ...st.ward };
      if (st.haste) to.status.haste = Math.max(to.status.haste ?? 0, st.haste);
      if (st.shield) to.status.shield = Math.max(to.status.shield ?? 0, st.shield);
      events.push({ type: 'status', uid: to.uid, label: 'Blessing taken' });
    }
    st.empower = st.ward = st.haste = undefined;
    st.shield = 0;
    events.push({ type: 'status', uid: t.uid, label: 'Stripped' });
  }

  /** A Litany Chain grows: every other living Sister gains a little Zeal. */
  kindle(n: number, caster: Unit): BattleEvent[] {
    const events: BattleEvent[] = [];
    for (const u of this.alive('party')) if (u !== caster) this.addZeal(n, events, 'chain', u);
    return events;
  }

  /** Changes Zeal for one Sister, or (no `to`) for every living Sister. */
  private addZeal(n: number, events: BattleEvent[], reason: string, to?: Unit) {
    if (n > 0 && this.mods.zealMult && (reason === 'attack' || reason === 'support' || reason === 'wounds')) n = Math.max(0, Math.round(n * (1 + this.mods.zealMult)));
    const who = to ? (to.side === 'party' && to.hp > 0 ? [to] : []) : this.alive('party');
    for (const u of who) {
      const before = u.zeal ?? 0;
      u.zeal = Math.max(0, Math.min(ZEAL_MAX, before + n));
      if (u.zeal !== before) {
        events.push({ type: 'zeal', amount: u.zeal - before, reason, uid: u.uid });
        this.log.push(`  zeal ${u.name} ${u.zeal - before > 0 ? '+' : ''}${u.zeal - before} (${reason}) = ${u.zeal}`);
      }
    }
  }

}

/** A Hymn's verse at double strength. */
function doubled(part: Partial<SkillDef>): Partial<SkillDef> {
  const d = <T extends { pct: number }>(x?: T) => (x ? { ...x, pct: x.pct * 2 } : x);
  return { ...part, empower: d(part.empower), ward: d(part.ward), critUp: d(part.critUp), weaken: d(part.weaken), regen: d(part.regen) };
}

/** Enemy HP and attack scale, tuned with balance.test.ts against the Auto player. */
export const ENEMY_TUNE = 1.6;
export function makeEnemy(type: string, uid: string, rank: number, scale = 1): Unit {
  const d = ENEMIES[type];
  const hp = Math.round(d.hp * ENEMY_TUNE * scale);
  const a = AFFINITY[type] ?? {};
  return { uid, side: 'enemy', name: d.name, ref: type, rank, maxHp: hp, hp, atk: Math.round(d.atk * ENEMY_TUNE * scale), armor: d.armor, mres: a.mres ?? d.armor, dmg: a.dmg ?? 'physical', spd: d.spd, crit: d.crit ?? 0.05, status: {}, boss: d.boss, bane: a.bane, traits: d.traits };
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

/** Critical chance of a unit's hit with this skill. */
const critOf = (u: Unit, skill: SkillDef) => u.crit + (u.status.critUp?.pct ?? 0) + (skill.critChance ?? 0);

const wardOf = (t: Unit) => (t.status.ward ? 1 - t.status.ward.pct : 1);

/** Damage after armor: raw / (1 + armor / ARMOR_K). 100 armor halves a hit. */
export function damageAfterArmor(raw: number, armor: number) {
  return raw / (1 + Math.max(0, armor) / ARMOR_K);
}
