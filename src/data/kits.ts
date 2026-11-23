/**
 * Every Sister's own kit (design: the Sister identity rework). Her class is the
 * verb, her Order's keyword the accent, the kit the sentence.
 *
 * - R: two class staples, one skill of her own, her class's Litany.
 * - SR: two class staples, one skill of her own, a Litany of her own.
 * - SSR: three skills and a Litany of her own, and a signature on her Order's keyword.
 * - UR: as SSR, plus a Saint's Seal that fires once a fight.
 *
 * Staples are the class skills from skills.ts, shared as they are. Own skill ids
 * start with the Sister's number so Vow upgrades never mix them up. The rules
 * behind `sig` and `seal` live in Battle (systems/combat.ts).
 */
import { CLASS_SKILLS, type SkillDef } from './skills';
import type { PassiveDef } from './types';
import { OVERWATCH_HIT } from '../systems/keywords';

/** What a Bell Sister's Peal does (every third toll). */
export interface Peal {
  /** She strikes every foe for this multiple of attack. */
  strikeAll?: number;
  /** Every foe is Accused for this many turns. */
  accuseAll?: number;
  /** Every Sister gains this much Zeal. */
  zealAll?: number;
  /** She strikes the foe with the lowest HP for this multiple of attack. */
  strikeLowest?: number;
  /** Every Sister is shielded for this share of max HP. */
  shieldAll?: number;
  /** She heals this share of her max HP. */
  healSelf?: number;
  /** Every foe Burns for this multiple of her attack, 2 turns. */
  burnAll?: number;
}

/** A Sister's signature rules. Every field is optional; Battle reads the ones set. */
export interface Sig {
  // Damage
  dmgUnderHalf?: number;
  dmgUnder30?: number;
  critUnderHalf?: boolean;
  /** +damage from rank 3 or 4. */
  backRankDmg?: number;
  /** +damage while a Hymn plays. */
  hymnAtk?: number;
  /** +damage for each fallen Sister. */
  atkPerFallen?: number;
  strideDmg?: number;
  /** +damage per Guilt on her target, on top of Guilt's own. */
  guiltDmg?: number;
  critPerRemains?: number;
  /** Armor pierce per Scar. */
  scarPierce?: number;
  /** Her hits double under this HP line: base + per Tide. */
  executeTide?: { base: number; per: number };
  /** Her crits spend the target's Guilt for this much per stack. */
  critConsumeGuilt?: number;
  /** A foe she kills passes its Guilt to the next. */
  passGuilt?: boolean;
  /** Crits on a foe both Confessed and Accused: extra crit damage, and a share splashes on its neighbours. */
  shatter?: { crit: number; splash: number };
  lifesteal?: number;
  strideLifesteal?: { base: number; per: number };
  /** Her healing past max HP shields the Sister behind her. */
  overhealBehind?: boolean;
  // Burns and poisons
  dotMult?: number;
  dotPerStride?: number;
  dotConfessed?: number;
  hymnBurnTwice?: boolean;
  /** Each round the foe acting first Burns for this many turns. */
  burnFirst?: number;
  // Overwatch
  openOverwatch?: boolean;
  owZeal?: number;
  /** In rank 1: the Sister behind takes this much less, and fires with her Overwatch. */
  rampart?: number;
  unbrokenOverwatch?: boolean;
  owCounter?: number;
  owWeaken?: number;
  // Mercy
  mercyUp?: number;
  mercyZeal?: number;
  mercyExtra?: boolean;
  mercyCure?: number;
  shieldBreakWeaken?: number;
  lowShield?: number;
  thornsMercy?: boolean;
  unbrokenHeal?: number;
  // Guilt
  guiltWhenStruck?: number;
  guiltOnWarded?: boolean;
  guiltCounter?: boolean;
  overhealShield?: boolean;
  healPerGuilt?: number;
  /** While she stands, every Sister takes this much less damage. */
  guard?: number;
  // Remains
  remainsGuard?: number;
  remainsSpendHeal?: number;
  remainsHeal?: number;
  /** At the start of her turn she may spend 3 Remains to raise a fallen Sister with this share of HP. */
  raise3?: number;
  remainsZeal?: number;
  remainsAtk?: { per: number; cap: number };
  remainsCap?: number;
  guardBody?: boolean;
  foeFallHeal?: number;
  foeFallThorns?: number;
  auraRemains?: number;
  remainsAtkAll?: number;
  // Hymn
  hymnDouble?: number;
  hymnStrikeZeal?: number;
  hymnWrath?: number;
  weakenPlus?: number;
  hymnTauntWard?: number;
  burnRound?: { hp: number; zeal: number };
  hymnOnFall?: boolean;
  // Scars
  scarOnHit?: number;
  counterPerScar?: number;
  counterBleed?: number;
  fallGift?: { zeal: number; empower: number; scarsShare: number };
  scarZeal?: number;
  // Tide
  tideHeal?: number;
  tideTaunt?: boolean;
  tideStart?: number;
  tideZeal?: number;
  tideWeakAccused?: number;
  tideGuard?: number;
  // Confess
  confessAll?: number;
  firstRound?: boolean;
  throwCures?: boolean;
  // Stride
  doubleStep?: boolean;
  singStride?: number;
  // Toll
  doubleRingLow?: boolean;
  peal?: Peal;
  startZeal?: number;
}

export type SealKind =
  | 'neverSleep'
  | 'lastRites'
  | 'forbidden'
  | 'wallSaint'
  | 'onlyOne'
  | 'notYet'
  | 'noteHeld'
  | 'reflect'
  | 'unmasked'
  | 'drowned'
  | 'highWater'
  | 'seenBefore'
  | 'bellNoOne'
  | 'walkBefore'
  | 'unbrokenMidnight';

/** A UR's Saint's Seal: fires once a fight, on its own. */
export interface Seal {
  name: string;
  desc: string;
  kind: SealKind;
}

export interface Kit {
  skills: [SkillDef, SkillDef, SkillDef, SkillDef];
  /** Shown as her passive. Unset: her class's R/SR passive (data/passives.ts). */
  passive?: PassiveDef;
  sig?: Sig;
  seal?: Seal;
  /** Content she is built for ("Shines in"). */
  shines?: string[];
}

const any: number[] = [];
type Own = Omit<SkillDef, 'id' | 'from'> & { from?: number[] };

/** A class staple, shared as it is. */
const st = (cls: string, id: string): SkillDef => {
  const s = CLASS_SKILLS[cls]?.find((x) => x.id === id);
  if (!s) throw new Error(`no staple ${cls}/${id}`);
  return s;
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sig = (name: string, desc: string): PassiveDef => ({ name, desc, kind: 'signature' });
/** An Overwatch reaction. */
const ow = (mult: number, extra: Partial<SkillDef> = {}): SkillDef => ({ id: 'overwatch', name: 'Overwatch', desc: '', from: [], target: 'enemy', mult, ...extra });

export const KITS: Record<string, Kit> = {};
function K(id: string, build: (own: (s: Own) => SkillDef) => Kit) {
  const pre = id.replace('CC-', '').toLowerCase();
  KITS[id] = build((s) => ({ from: any, ...s, id: `${pre}-${slug(s.name)}` }));
}

// ======================= Iron Vigil: Overwatch =======================

K('CC-W040', (own) => ({
  passive: sig('Watchfire', 'At the start of each round she sets the foe that acts first Burning for 2 turns. Her burns and poisons are 15% stronger.'),
  sig: { burnFirst: 2, dotMult: 0.15 },
  skills: [
    own({ name: 'Beacon Smoke', desc: 'Smoke every enemy (-20% attack for 2 turns) and go on Overwatch: the next foe to act is struck and set Burning.', target: 'allEnemies', mult: 0.3, weaken: { pct: 0.2, turns: 2 }, overwatch: ow(0.3, { poison: { mult: 0.45, turns: 2 }, stackPoison: true }), cooldown: 2 }),
    own({ name: 'Iron Thurible', desc: 'Swing at rank 1-2 and set it Burning for 2 turns (stacks). If it was already Burning, it is also Sundered (-20% armor) for 2 turns.', from: [1, 2, 3], target: 'enemy', reach: [1, 2], mult: 0.9, poison: { mult: 0.45, turns: 2 }, stackPoison: true, cond: { if: 'burning', then: { sunder: { pct: 0.2, turns: 2 } } } }),
    own({ name: 'Tower Lamp', desc: "Spread one foe's burn to every other foe, then ignite it all at once on that foe. Cooldown 3.", target: 'enemy', mult: 0.3, spreadPoison: true, detonate: 1.0, cooldown: 3 }),
    own({ name: 'The Wall Is Lit', desc: 'LITANY: every enemy Burns for 3 turns (stacks), and every Sister goes on Overwatch.', target: 'allEnemies', mult: 0.5, poison: { mult: 0.5, turns: 3 }, stackPoison: true, overwatchAll: OVERWATCH_HIT, rite: true }),
  ],
  seal: { name: 'Never Sleep', desc: 'The first time a boss starts charging, every burn on it ignites at once and it loses 20 Wrath.', kind: 'neverSleep' },
  shines: ['Choirmaster Hunt', 'Pilgrim\'s Road and crypt waves', 'Chapter Siege'],
}));

K('CC-W049', (own) => ({
  passive: sig("Sentry's Omen", 'At the start of each fight your fastest Sister goes on Overwatch. A Sister whose Overwatch fires gains 10 Zeal.'),
  sig: { openOverwatch: true, owZeal: 10 },
  skills: [
    own({ name: 'Ash on the Wind', desc: 'Hit any enemy and Hex it (-20% Magic Resist) for 2 turns.', target: 'enemy', mult: 1.15, hex: { pct: 0.2, turns: 2 } }),
    own({ name: 'Stand Watch', desc: 'Haste an ally and put her on Overwatch. Cooldown 2.', target: 'ally', haste: 1, overwatch: OVERWATCH_HIT, cooldown: 2 }),
    own({ name: 'Night Shift', desc: 'Every ally +15% attack for 2 turns; allies on Overwatch +30% instead. Cooldown 3.', target: 'allAllies', empower: { pct: 0.15, turns: 2 }, empowerTarget: true, cond: { if: 'overwatch', then: { empower: { pct: 0.3, turns: 2 } } }, cooldown: 3 }),
    own({ name: 'Watchtower Omen', desc: 'LITANY: every Sister goes on Overwatch with a strong reaction (0.9x) and gains Haste.', target: 'allAllies', overwatchAll: ow(0.9), haste: 1, rite: true }),
  ],
  shines: ['Red Cardinal Hunt', 'Iron Vigil Order Tower', 'Real-time field'],
}));

K('CC-W058', (own) => ({
  passive: sig('Rampart', 'While she stands in rank 1, the Sister behind her takes 20% less damage and fires a free hit whenever her Overwatch does.'),
  sig: { rampart: 0.2 },
  skills: [
    own({ name: 'Shrine Bash', desc: 'Strike rank 1-2, knock it a rank back and draw enemy attacks for 2 turns.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 0.85, taunt: 2, shove: 1 }),
    own({ name: 'Iron Rampart', desc: 'Shield the Sisters in ranks 1 and 2 for 28% of max HP. Cooldown 1.', target: 'allAllies', onlyRanks: [1, 2], shieldPct: 0.28, cooldown: 1 }),
    own({ name: 'Hold the Gate', desc: 'Overwatch: the next foe to act is struck and Stunned (bosses are Delayed instead). Cooldown 3.', target: 'self', overwatch: ow(0.8, { stun: 1, cond: { if: 'boss', then: { delay: true } } }), cooldown: 3 }),
    own({ name: 'Walls of Iron', desc: 'LITANY: shield every ally for 25% of max HP, draw every attack for 2 turns, and every Sister gains 10 Zeal.', target: 'allAllies', shieldPct: 0.25, taunt: 2, zealGain: 10, zealAll: true, rite: true }),
  ],
  shines: ['Guarding the back rank (Choir Below, Colossus Hunt)', 'Iron Vigil Order Tower'],
}));

K('CC-W094', (own) => ({
  passive: { name: 'Last Watch', desc: 'Once a fight a killing blow leaves her at 1 HP, and she goes on Overwatch.', kind: 'unbroken' },
  sig: { unbrokenOverwatch: true },
  skills: [
    st('martyr', 'radiant-smite'),
    st('martyr', 'blood-oath'),
    own({ name: 'Dawn Picket', desc: 'Draw attacks for 2 turns and go on Overwatch; her reaction heals her for 50% of its damage. Cooldown 2.', target: 'self', taunt: 2, overwatch: ow(0.6, { drain: 0.5 }), cooldown: 2 }),
    own({ name: 'First Light', desc: 'LITANY: hit every enemy and heal for 40% of the damage dealt.', target: 'allEnemies', mult: 0.85, drain: 0.4, rite: true }),
  ],
}));

K('CC-W085', (own) => ({
  passive: sig('Key Ward', 'Her counter-hits deal 30% more while she is on Overwatch.'),
  sig: { owCounter: 0.3 },
  skills: [
    st('sentinel', 'gravewarden-strike'),
    st('sentinel', 'funeral-bash'),
    own({ name: 'Lock the Postern', desc: 'Overwatch: the next foe to act is struck and Delayed. Cooldown 2.', target: 'self', overwatch: ow(0.5, { delay: true }), cooldown: 2 }),
    own({ name: 'Sealed Postern', desc: 'LITANY: Ward every ally (-25% damage taken) for 2 turns; she draws every attack and counters.', target: 'allAllies', ward: { pct: 0.25, turns: 2 }, taunt: 2, counter: { mult: 0.8, turns: 2 }, overwatch: OVERWATCH_HIT, rite: true }),
  ],
}));

K('CC-W001', (own) => ({
  passive: { name: 'Watchful Eyes', desc: '+1 speed: she acts sooner.', kind: 'swift', value: 1 },
  skills: [
    st('inquisitor', 'accuse'),
    st('inquisitor', 'duelists-thrust'),
    own({ name: 'Seal the Watch', desc: 'A light hit that Accuses for 2 turns, then she goes on Overwatch. Cooldown 2.', from: [1, 2, 3], target: 'enemy', mult: 0.5, accuse: 2, overwatch: OVERWATCH_HIT, cooldown: 2 }),
    st('inquisitor', 'verdict'),
  ],
}));

K('CC-W232', (own) => ({
  passive: sig('Wall Gunner', '+15% damage from rank 3 or 4.'),
  sig: { backRankDmg: 0.15 },
  skills: [
    st('arbalist', 'blessed-bolt'),
    st('arbalist', 'marking-shot'),
    own({ name: 'Crenel Shot', desc: 'Overwatch: shoot the next foe to act, through 30% of its Armor. Cooldown 2.', target: 'self', overwatch: ow(1.0, { armorPierce: 0.3 }), cooldown: 2 }),
    st('arbalist', 'saints-ballista'),
  ],
}));

K('CC-W103', (own) => ({
  passive: { name: 'Iron Rose', desc: 'Foes that strike her take 10% of the damage back.', kind: 'thorns', value: 0.1 },
  skills: [
    st('abbess', 'thorned-rebuke'),
    st('abbess', 'pruning'),
    own({ name: 'Rose on the Rampart', desc: 'Overwatch: when the next foe acts, she heals the most hurt Sister 15% of max HP. Cooldown 2.', target: 'self', overwatch: { id: 'overwatch', name: 'Rose on the Rampart', desc: '', from: [], target: 'ally', healPct: 0.15 }, cooldown: 2 }),
    st('abbess', 'garden-of-thorns'),
  ],
}));

// ======================= Ashen Mercy: Mercy =======================

K('CC-W050', (own) => ({
  passive: sig('Omen of Release', "Raises the party's Mercy line from 15% to 25%. Every Mercy kill gives every Sister 10 Zeal."),
  sig: { mercyUp: 0.1, mercyZeal: 10 },
  skills: [
    own({ name: 'Ashen Reading', desc: 'Hit any enemy, Hex it (-20% Magic Resist) and Foretell it: its Mercy line is 15% higher, for 2 turns.', target: 'enemy', mult: 1.0, hex: { pct: 0.2, turns: 2 }, foretell: { pct: 0.15, turns: 2 } }),
    own({ name: 'Grant Peace', desc: 'An ally gains +35% attack for 2 turns and Haste. Cooldown 2.', target: 'ally', empower: { pct: 0.35, turns: 2 }, empowerTarget: true, haste: 1, cooldown: 2 }),
    own({ name: 'Smoke of the Pyre', desc: 'Every enemy is Weakened (-20% attack) for 2 turns; foes under half HP are also Delayed. Cooldown 3.', target: 'allEnemies', weaken: { pct: 0.2, turns: 2 }, cond: { if: 'underHalf', then: { delay: true } }, cooldown: 3 }),
    own({ name: 'Absolution', desc: 'LITANY: heavy magic damage on every enemy; any common foe left under 30% HP is granted Mercy at once.', target: 'allEnemies', mult: 1.3, mercyLine: 0.3, rite: true }),
  ],
  seal: { name: 'Last Rites Heard', desc: 'The first time a Sister would fall, she is healed 30% instead and her attacker is Foretold.', kind: 'lastRites' },
  shines: ['Waves and summons', "Pilgrim's Road", 'Crypt runs'],
}));

K('CC-W059', (own) => ({
  passive: sig('Shield of Ash', 'When a shield she gave breaks, the attacker is Weakened (-15% attack) for a turn. Her shields on a Sister under 30% HP are 50% larger.'),
  sig: { shieldBreakWeaken: 0.15, lowShield: 0.5 },
  skills: [
    own({ name: 'Pyre Bash', desc: 'Strike rank 1-2, knock it back and draw enemy attacks for 2 turns.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 0.8, taunt: 2, shove: 1 }),
    own({ name: 'Mantle of Ash', desc: 'Shield an ally for 30% of max HP. Cooldown 1.', target: 'ally', shieldPct: 0.3, cooldown: 1 }),
    own({ name: 'Merciful Stand', desc: 'Draw attacks for 2 turns; every foe under half HP is Weakened (-25% attack) for 2 turns. Cooldown 2.', target: 'self', taunt: 2, alsoFoes: { cond: { if: 'underHalf', then: { weaken: { pct: 0.25, turns: 2 } } } }, cooldown: 2 }),
    own({ name: 'Ashen Wall', desc: 'LITANY: shield every ally for 25% of max HP and Ward them (-15% damage taken) for 2 turns.', target: 'allAllies', shieldPct: 0.25, ward: { pct: 0.15, turns: 2 }, rite: true }),
  ],
  shines: ['Red Cardinal and Rot-Mother Hunts', 'Crypt runs'],
}));

K('CC-W077', (own) => ({
  passive: sig('Coup de Grâce', 'Her hits on foes under half HP always crit. Once a round, a Mercy kill gives her another action.'),
  sig: { critUnderHalf: true, mercyExtra: true },
  skills: [
    own({ name: 'Measured Cut', desc: 'A strike on rank 1-3 that cannot kill: it leaves the foe at its Mercy line at least.', from: [1, 2], target: 'enemy', reach: [1, 2, 3], mult: 1.45, cannotKill: true }),
    own({ name: 'Riposte Thrust', desc: 'Strike rank 1-2 and counter anyone who hits her until her next turn.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 1.2, counter: { mult: 0.6, turns: 1 } }),
    own({ name: "Duelist's Salute", desc: '+25% attack and +20% critical chance for 2 turns. Cooldown 2.', target: 'self', empower: { pct: 0.25, turns: 2 }, critUp: { pct: 0.2, turns: 2 }, cooldown: 2 }),
    own({ name: 'Mercy Stroke', desc: 'LITANY: strike every enemy, double against foes under half HP.', target: 'allEnemies', mult: 0.9, cond: { if: 'underHalf', then: { mult: 1.8 } }, rite: true }),
  ],
  shines: ['Clearing adds and summons', 'Ashen Mercy Order Tower'],
}));

K('CC-W095', (own) => ({
  passive: { name: 'Ashes Rise', desc: 'Once a fight a killing blow leaves her at 1 HP, and every Sister heals 5%.', kind: 'unbroken' },
  sig: { unbrokenHeal: 0.05 },
  skills: [
    st('martyr', 'radiant-smite'),
    st('martyr', 'blood-oath'),
    own({ name: 'Burnt Offering', desc: 'Lose 10% HP; every ally heals 8% of max HP. Cooldown 2.', target: 'allAllies', selfDmgPct: 0.1, healPct: 0.08, cooldown: 2 }),
    own({ name: 'Pyre Dawn', desc: "LITANY: hit every enemy, heal 40% of the damage, and raise every foe's Mercy line by 10% for a turn.", target: 'allEnemies', mult: 0.8, drain: 0.4, foretell: { pct: 0.1, turns: 1 }, rite: true }),
  ],
}));

K('CC-W104', (own) => ({
  passive: { name: 'Ash Briars', desc: 'Foes that strike her take 15% back; a foe killed by her thorns counts as a Mercy kill.', kind: 'thorns', value: 0.15 },
  sig: { thornsMercy: true },
  skills: [
    st('abbess', 'pruning'),
    st('abbess', 'thorned-rebuke'),
    own({ name: 'Bandage of Ash', desc: 'Heal an ally, cure poison, burns and bleeding, and Ward her (-10% damage) for 2 turns.', target: 'ally', heal: 2.2, cleanse: true, ward: { pct: 0.1, turns: 2 } }),
    own({ name: 'Ash Garden', desc: 'LITANY: rake every enemy (Bleeding for 2 turns); every Sister heals 40% of the damage.', target: 'allEnemies', mult: 0.8, bleed: { mult: 0.25, turns: 2 }, lifelink: 0.4, rite: true }),
  ],
}));

K('CC-W011', (own) => ({
  skills: [
    st('warsister', 'penitent-blow'),
    st('warsister', 'blood-for-zeal'),
    own({ name: 'Finish It', desc: 'Strike rank 1-2; a kill gives her 15 Zeal.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 1.1, onKill: { zeal: 15 } }),
    st('warsister', 'martyrs-fury'),
  ],
}));

K('CC-W233', (own) => ({
  passive: sig('Clean Death', '+20% damage to foes under 30% HP.'),
  sig: { dmgUnder30: 0.2 },
  skills: [
    st('arbalist', 'blessed-bolt'),
    st('arbalist', 'marking-shot'),
    own({ name: 'Grace Bolt', desc: 'A bolt on any rank whose Mercy line is 25%.', from: [2, 3, 4], target: 'enemy', mult: 1.1, mercyLine: 0.25 }),
    st('arbalist', 'saints-ballista'),
  ],
}));

K('CC-W131', (own) => ({
  skills: [
    st('exorcist', 'lantern-flare'),
    st('exorcist', 'witchfire'),
    own({ name: 'Ash Lantern', desc: "Strip a foe's shield and blessings and Weaken it (-20% attack) for 2 turns. Cooldown 2.", target: 'enemy', mult: 0.5, purge: true, weaken: { pct: 0.2, turns: 2 }, cooldown: 2 }),
    st('exorcist', 'banishment'),
  ],
}));

// ======================= Veiled Tribunal: Guilt =======================

K('CC-W060', (own) => ({
  passive: sig('Testimony', 'Each time she is struck, the attacker gains 1 Guilt. While she stands, foes that strike a Warded Sister gain Guilt too.'),
  sig: { guiltWhenStruck: 1, guiltOnWarded: true },
  skills: [
    own({ name: 'Weighing Blow', desc: 'Strike rank 1-2, Accuse it and draw enemy attacks, for 2 turns.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 0.8, accuse: 2, taunt: 2 }),
    own({ name: 'The Scale', desc: 'Shield an ally for 20% of max HP, plus 5% for each Guilt on the most guilty foe. Cooldown 1.', target: 'ally', shieldPct: 0.2, perGuilt: { shieldPct: 0.05 }, cooldown: 1 }),
    own({ name: 'Bear Witness', desc: 'Ward every ally (-15% damage taken) for 2 turns. Cooldown 3.', target: 'allAllies', ward: { pct: 0.15, turns: 2 }, cooldown: 3 }),
    own({ name: 'Sealed Testimony', desc: "LITANY: shield every ally for 25% of max HP; every foe's Guilt Weakens it (-5% attack per Guilt) for 2 turns.", target: 'allAllies', shieldPct: 0.25, guiltWeaken: 0.05, rite: true }),
  ],
  seal: { name: 'Forbidden Testimony', desc: 'The first time she would fall, she stays at 1 HP and every foe gains 3 Guilt.', kind: 'forbidden' },
  shines: ['Chapter Siege', 'Colossus Hunt', 'Veiled Tribunal Order Tower'],
}));

K('CC-W069', (own) => ({
  passive: sig('Vindication', 'While she stands, every Sister takes 8% less damage. Her counters add 1 Guilt; on a foe with 5 Guilt her counter becomes Vindicate and spends it for a heavy blow.'),
  sig: { guiltCounter: true, guard: 0.08 },
  skills: [
    own({ name: 'Oath Strike', desc: 'Strike rank 1-2, draw attacks and counter anyone who hits her, for 2 turns.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 0.8, taunt: 2, counter: { mult: 0.5, turns: 2 } }),
    own({ name: "Templar's Stand", desc: 'Ward herself (-30% damage) and draw attacks for 2 turns. Cooldown 2.', target: 'self', ward: { pct: 0.3, turns: 2 }, taunt: 2, cooldown: 2 }),
    own({ name: 'Unsheathe the Oath', desc: "Spend a foe's Guilt: 0.8x plus 0.3x per Guilt. At 5 Guilt it is also Stunned (not bosses). Cooldown 2.", from: [1, 2, 3], target: 'enemy', mult: 0.8, spend: { kw: 'guilt', per: { multAdd: 0.3 }, full: { stun: 1 } }, cooldown: 2 }),
    own({ name: 'Judgment of the Wall', desc: 'LITANY: Ward every ally (-25% damage) for 2 turns; she draws every attack and counters at full attack.', target: 'allAllies', ward: { pct: 0.25, turns: 2 }, taunt: 2, counter: { mult: 1.0, turns: 2 }, rite: true }),
  ],
  seal: { name: 'Saint of the Wall', desc: 'Once a fight, when a Sister would take a hit worth over 30% of her max HP, Isolde steps in and takes it at half damage.', kind: 'wallSaint' },
  shines: ['One-shot bosses in the deeper crypts', 'Inquisition trials', 'Her Feast'],
}));

K('CC-W180', (own) => ({
  passive: sig('Without Appeal', "Her crits spend the target's Guilt for +20% damage per stack. When she kills a foe, its Guilt passes to the next."),
  sig: { critConsumeGuilt: 0.2, passGuilt: true },
  skills: [
    own({ name: 'Hidden Blade', desc: 'Strike any rank and add 2 Guilt.', from: [1, 2, 3], target: 'enemy', mult: 1.0, guilt: 2 }),
    own({ name: 'Faceless', desc: 'Haste herself and +30% critical chance for 2 turns. Cooldown 2.', target: 'self', haste: 1, critUp: { pct: 0.3, turns: 2 }, cooldown: 2 }),
    st('veilblade', 'hamstring'),
    own({ name: 'Execution', desc: 'LITANY: a savage blow on any enemy, +50% critical chance; spends all its Guilt for +25% damage each.', target: 'enemy', mult: 1.9, critChance: 0.5, spend: { kw: 'guilt', per: { multPct: 0.25 } }, rite: true }),
  ],
  shines: ['Back-rank priority foes', 'Red Cardinal burst check'],
}));

K('CC-W198', (own) => ({
  passive: sig('Chalice of Witness', 'Her overhealing becomes a shield. Her heals are 3% stronger for each Guilt on the most guilty foe.'),
  sig: { overhealShield: true, healPerGuilt: 0.03 },
  skills: [
    st('hospitaller', 'chalice-draught'),
    own({ name: 'Testimony of Wounds', desc: 'Hit any foe and add 2 Guilt; every Sister heals 4% for each Guilt it carries.', target: 'enemy', mult: 0.9, guilt: 2, perGuilt: { partyHealPct: 0.04 } }),
    own({ name: 'Quiet Hands', desc: 'Every ally Regenerates 5% a turn for 3 turns. Cooldown 2.', target: 'allAllies', regen: { pct: 0.05, turns: 3 }, cooldown: 2 }),
    own({ name: 'Grail Sealed', desc: 'LITANY: raise fallen Sisters with 30% HP, heal every ally 25%, and add 2 Guilt to every foe.', target: 'allAllies', revive: 0.3, healPct: 0.25, alsoFoes: { guilt: 2 }, rite: true }),
  ],
  shines: ['Hit-everyone bosses', 'Crypt runs', 'Veiled Tribunal Order Tower'],
}));

K('CC-W114', (own) => ({
  passive: { name: 'Grave Note', desc: 'Each foe she kills gives her 9 Zeal.', kind: 'zealOnKill', value: 9 },
  skills: [
    st('cantor', 'psalm-of-blades'),
    st('cantor', 'keening-note'),
    own({ name: 'Dirge of Accusation', desc: 'Every foe gains 1 Guilt and is Accused for a turn. Cooldown 2.', target: 'allEnemies', guilt: 1, accuse: 1, cooldown: 2 }),
    own({ name: 'Requiem of the Court', desc: 'LITANY: every ally +30% attack for 2 turns, +5% more per Guilt on the most guilty foe.', target: 'allAllies', empower: { pct: 0.3, turns: 2 }, empowerTarget: true, perGuilt: { empowerPct: 0.05 }, rite: true }),
  ],
}));

K('CC-W234', (own) => ({
  skills: [
    st('arbalist', 'blessed-bolt'),
    st('arbalist', 'shieldbreaker'),
    own({ name: 'Warrant Bolt', desc: 'Accuse a foe for 2 turns and add 1 Guilt. Cooldown 1.', target: 'enemy', mult: 0.6, accuse: 2, guilt: 1, cooldown: 1 }),
    own({ name: 'Sentence Bolt', desc: 'LITANY: a crushing bolt through 30% of its Armor; spends its Guilt for +25% damage each.', target: 'enemy', mult: 2.0, armorPierce: 0.3, spend: { kw: 'guilt', per: { multPct: 0.25 } }, rite: true }),
  ],
}));

K('CC-W012', (own) => ({
  skills: [
    st('warsister', 'penitent-blow'),
    st('warsister', 'flagellants-charge'),
    own({ name: 'Penitent Witness', desc: 'Lose 8% HP; the foe in rank 1 is struck lightly and gains 2 Guilt. Cooldown 1.', target: 'enemy', reach: [1], selfDmgPct: 0.08, mult: 0.4, guilt: 2, cooldown: 1 }),
    st('warsister', 'martyrs-fury'),
  ],
}));

K('CC-W141', (own) => ({
  passive: { name: 'Witchfire Wick', desc: 'Her burns are 15% stronger.', kind: 'plague', value: 0.15 },
  skills: [
    st('exorcist', 'witchfire'),
    st('exorcist', 'lantern-flare'),
    own({ name: "Heretic's Pyre", desc: 'Set a foe Burning for 3 turns (stacks); each burn tick on it adds 1 Guilt. Cooldown 2.', target: 'enemy', mult: 0.4, poison: { mult: 0.4, turns: 3 }, stackPoison: true, burnGuilt: true, cooldown: 2 }),
    st('exorcist', 'banishment'),
  ],
}));

// ======================= Sepulcher Watch: Remains =======================

K('CC-W070', (own) => ({
  passive: sig('Ossuary Oath', 'At 3 or more Remains, she and the Sisters beside her take 15% less damage. Each Remains the party spends heals her 4%.'),
  sig: { remainsGuard: 0.15, remainsSpendHeal: 0.04 },
  skills: [
    own({ name: 'Bonewarden Strike', desc: 'Strike rank 1-2, draw attacks and counter anyone who hits her, for 2 turns.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 0.8, taunt: 2, counter: { mult: 0.5, turns: 2 } }),
    own({ name: 'Ossuary Wall', desc: 'Spend 2 Remains to shield every ally for 20% of max HP; with fewer, shield only herself for 25%. Cooldown 2.', target: 'allAllies', shieldPct: 0.2, spend: { kw: 'remains', n: 2, need: true, orElse: { target: 'self', shieldPct: 0.25 }, per: {} }, cooldown: 2 }),
    own({ name: 'Walked Home', desc: 'Ward herself (-30% damage) and draw attacks for 2 turns; the party gains 1 Remains. Cooldown 2.', target: 'self', ward: { pct: 0.3, turns: 2 }, taunt: 2, gain: { remains: 1 }, cooldown: 2 }),
    own({ name: 'None Shall Wake', desc: 'LITANY: Ward every ally (-25%) for 2 turns, draw every attack and counter; summoned foes lose their next turn.', target: 'allAllies', ward: { pct: 0.25, turns: 2 }, taunt: 2, counter: { mult: 0.9, turns: 2 }, stunSummons: 1, rite: true }),
  ],
  seal: { name: 'The Only One Home', desc: 'If she is the last Sister standing, she heals 50%, gains Haste and +40% attack for the rest of the fight.', kind: 'onlyOne' },
  shines: ['Summoner bosses', 'Add-heavy deeper crypts', 'Sepulcher Watch Order Tower'],
}));

K('CC-W199', (own) => ({
  passive: sig('Overflowing Chalice', 'Each Remains the party gains heals every Sister 6%. At the start of her turn she spends 3 Remains to raise a fallen Sister with 40% HP.'),
  sig: { remainsHeal: 0.06, raise3: 0.4 },
  skills: [
    st('hospitaller', 'chalice-draught'),
    own({ name: 'Ossuary Tending', desc: 'Every ally Regenerates 6% a turn for 3 turns; spend 2 Remains to also Ward them (-15%) for 2 turns. Cooldown 2.', target: 'allAllies', regen: { pct: 0.06, turns: 3 }, ward: { pct: 0.15, turns: 2 }, spend: { kw: 'remains', n: 2, need: true, orElse: { ward: undefined }, per: {} }, cooldown: 2 }),
    own({ name: 'Unmask the Fraud', desc: 'Hit any foe and strip its shield and blessings. Cooldown 2.', target: 'enemy', mult: 1.1, purge: true, cooldown: 2 }),
    own({ name: 'Chalice of Bones', desc: 'LITANY: raise every fallen Sister with 40% HP, heal every ally 30%, and the party gains 2 Remains.', target: 'allAllies', revive: 0.4, healPct: 0.3, gain: { remains: 2 }, rite: true }),
  ],
  seal: { name: 'Not Yet', desc: 'The first Sister to fall each fight is raised at once with 25% HP.', kind: 'notYet' },
  shines: ['Bell Tower and Heresy', 'Hunts', 'Her Feast'],
}));

K('CC-W079', (own) => ({
  passive: sig('Harvest', 'Each Remains the party gains gives her 8 Zeal and +5% attack for the fight (up to +25%).'),
  sig: { remainsZeal: 8, remainsAtk: { per: 0.05, cap: 0.25 } },
  skills: [
    own({ name: "Duelist's Lunge", desc: 'Lunge a rank forward and strike rank 1-3.', from: [1, 2, 3], target: 'enemy', reach: [1, 2, 3], mult: 1.35, move: -1 }),
    own({ name: 'Grave Feint', desc: 'Counter anyone who hits her for 2 turns, at 0.6x. Cooldown 2.', target: 'self', counter: { mult: 0.6, turns: 2 }, cooldown: 2 }),
    own({ name: 'Reap', desc: 'Spend 2 Remains to strike ranks 1 and 2 at once. Cooldown 1.', target: 'allEnemies', onlyRanks: [1, 2], mult: 1.4, spend: { kw: 'remains', n: 2, need: true, per: {} }, cooldown: 1 }),
    own({ name: 'Harvest of Heretics', desc: 'LITANY: strike every enemy; each kill adds 1 Remains.', target: 'allEnemies', mult: 1.0, onKill: { remains: 1 }, rite: true }),
  ],
  shines: ['Swarm fights', "Pilgrim's Road"],
}));

K('CC-W088', (own) => ({
  passive: sig('Keeper of the Keys', 'The Remains cap is 8 with her. When a Sister falls, she guards the body: draws attacks and counters for 2 turns.'),
  sig: { remainsCap: 8, guardBody: true },
  skills: [
    st('sentinel', 'funeral-bash'),
    own({ name: 'Lock the Crypt', desc: 'Spend 2 Remains: summoned foes arrive Delayed for the rest of the fight, and she draws attacks for 2 turns. Cooldown 3.', target: 'self', taunt: 2, lockSummons: true, spend: { kw: 'remains', n: 2, need: true, per: {} }, cooldown: 3 }),
    st('sentinel', 'tomb-stance'),
    st('sentinel', 'sealed-sepulcher'),
  ],
  shines: ['Colossus Hunt', 'Summoner bosses'],
}));

K('CC-W235', (own) => ({
  passive: sig('Saint-Fletched', 'Her bolts are cut from saints\' bones: each Remains she spends gives that bolt +20% damage and 15% more armor pierce.'),
  sig: {},
  skills: [
    own({ name: 'Bone Bolt', desc: 'A heavy bolt on any rank; spend 1 Remains to also Sunder it (-25% armor) for 2 turns.', from: [2, 3, 4], target: 'enemy', mult: 1.4, armorPierce: 0.2, sunder: { pct: 0.25, turns: 2 }, spend: { kw: 'remains', n: 1, need: true, orElse: { sunder: undefined }, per: { multPct: 0.2, armorPierce: 0.15 } } }),
    st('arbalist', 'marking-shot'),
    own({ name: 'Reliquary Volley', desc: 'Spend up to 4 Remains: one bolt (1.1x, through 15% of its Armor) at a random foe for each. Cooldown 2.', target: 'allEnemies', mult: 1.1, armorPierce: 0.15, volley: 4, cooldown: 2 }),
    own({ name: 'Ossuary Ballista', desc: 'LITANY: a crushing bolt through shields and 30% of its Armor; spends every Remains for more.', target: 'enemy', mult: 2.4, armorPierce: 0.3, pierceShield: true, spend: { kw: 'remains', per: { multPct: 0.2, armorPierce: 0.15 } }, rite: true }),
  ],
  shines: ['Flayed Saint Hunt', 'Bosses with adds'],
}));

K('CC-W106', (own) => ({
  passive: sig('Grave Garden', 'Each fallen foe leaves a briar: every Sister heals 6% and gains Thorns (15% back) for a turn.'),
  sig: { foeFallHeal: 0.06, foeFallThorns: 0.15 },
  skills: [
    st('abbess', 'thorned-rebuke'),
    own({ name: 'Root the Dead', desc: 'Spend 2 Remains to heal every ally 15% and cure poison, burns and bleeding. Cooldown 2.', target: 'allAllies', healPct: 0.15, cleanse: true, spend: { kw: 'remains', n: 2, need: true, per: {} }, cooldown: 2 }),
    st('abbess', 'briar-mantle'),
    st('abbess', 'garden-of-thorns'),
  ],
  shines: ['Rot-Mother Hunt', 'Flayed Saint Hunt', 'Crypt runs'],
}));

K('CC-W022', (own) => ({
  passive: { name: 'Embalmer', desc: 'At the start of her turn every Sister heals 2% of max HP; 3% while the party holds any Remains.', kind: 'healAura', value: 0.02 },
  sig: { auraRemains: 0.01 },
  skills: [
    st('confessor', 'remedy'),
    st('confessor', 'miasma'),
    own({ name: 'Corpse Miasma', desc: 'Spend 1 Remains to hit every enemy and Poison them for 3 turns (stacks). Cooldown 2.', target: 'allEnemies', mult: 0.3, poison: { mult: 0.4, turns: 3 }, stackPoison: true, spend: { kw: 'remains', n: 1, need: true, per: {} }, cooldown: 2 }),
    own({ name: 'Last Rites of the Watch', desc: 'LITANY: heal every ally 30%, cure poison, burns and bleeding, and the party gains 1 Remains.', target: 'allAllies', healPct: 0.3, cleanse: true, gain: { remains: 1 }, rite: true }),
  ],
}));

K('CC-W013', (own) => ({
  skills: [
    st('warsister', 'penitent-blow'),
    st('warsister', 'blood-for-zeal'),
    own({ name: 'Grave Penance', desc: 'Strike rank 1-2; a kill adds 1 Remains.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 1.1, onKill: { remains: 1 } }),
    st('warsister', 'martyrs-fury'),
  ],
}));

K('CC-W151', (own) => ({
  passive: sig('Funeral Banner', 'While the party holds any Remains, every Sister has +5% attack.'),
  sig: { remainsAtkAll: 0.05 },
  skills: [
    st('confessor', 'remedy'),
    st('confessor', 'miasma'),
    own({ name: 'Raise the Pennant', desc: 'Heal every ally 8% of max HP. Cooldown 1.', target: 'allAllies', healPct: 0.08, cooldown: 1 }),
    st('confessor', 'last-rites'),
  ],
}));

// ======================= Candle Choir: Hymn =======================

const HYMN = 2; // turns a Hymn's status lasts, so it holds until each Sister's own turn

K('CC-W080', (own) => ({
  passive: sig('Duet', 'While any Hymn plays, each of her strikes lands twice (the second at 60%), and every strike gives the party 3 Zeal.'),
  sig: { hymnDouble: 0.6, hymnStrikeZeal: 3 },
  skills: [
    own({ name: 'Cadence Thrust', desc: 'Lunge into rank 1-3; +50% while a Hymn plays.', from: [1, 2], target: 'enemy', reach: [1, 2, 3], mult: 1.3, cond: { if: 'hymn', then: { mult: 1.95 } } }),
    own({ name: 'Hymn of the Blade', desc: 'A Hymn for 3 rounds: every ally +15% critical chance. Cooldown 3.', target: 'self', hymn: { name: 'Hymn of the Blade', rounds: 3, allies: { critUp: { pct: 0.15, turns: HYMN } } }, cooldown: 3 }),
    own({ name: 'Candle Cut', desc: 'Strike rank 1-2, leave it Bleeding for 2 turns and push its turn to the end. Cooldown 2.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 1.0, bleed: { mult: 0.25, turns: 2 }, delay: true, cooldown: 2 }),
    own({ name: 'Crescendo', desc: 'LITANY: five strikes on any enemy at 0.45x each; each one gives the party 4 Zeal.', target: 'enemy', mult: 0.45, hits: 5, zealPerHit: 4, rite: true }),
  ],
  seal: { name: 'The Note Held', desc: 'The first time a Hymn would end, it plays 2 more rounds.', kind: 'noteHeld' },
  shines: ['Red Cardinal Hunt', 'Hunt damage scores', 'Candle Choir Order Tower'],
}));

K('CC-W209', (own) => ({
  passive: sig('The Mirror Judges', 'A boss that starts charging while a Hymn plays loses 25 Wrath. Her Weakens last a turn longer.'),
  sig: { hymnWrath: 25, weakenPlus: 1 },
  skills: [
    st('adjudicator', 'reflected-sentence'),
    own({ name: 'Hymn of Silence', desc: 'A Hymn for 3 rounds: every foe -15% attack. Cooldown 3.', target: 'self', hymn: { name: 'Hymn of Silence', rounds: 3, foes: { weaken: { pct: 0.15, turns: HYMN } } }, cooldown: 3 }),
    st('adjudicator', 'mirror-ward'),
    own({ name: 'Final Judgment', desc: 'LITANY: every enemy is Weakened (-30%) for 3 turns and loses 50 Wrath.', target: 'allEnemies', mult: 0.9, weaken: { pct: 0.3, turns: 3 }, wrathDrain: 50, rite: true }),
  ],
  seal: { name: 'Reflected Blasphemy', desc: 'Once a fight, a Blasphemy is turned back: the Sisters take half, and the boss takes the other half.', kind: 'reflect' },
  shines: ["Every boss's Blasphemy", 'Chapter Siege', 'Her Feast'],
}));

K('CC-W089', (own) => ({
  passive: sig('Bass Note', 'While she draws attacks and a Hymn plays, every Sister takes 10% less damage.'),
  sig: { hymnTauntWard: 0.1 },
  skills: [
    own({ name: 'Tolling Strike', desc: 'Strike rank 1-2, draw attacks and counter, for 2 turns.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 0.75, taunt: 2, counter: { mult: 0.5, turns: 2 } }),
    own({ name: 'Hold the Note', desc: 'A Hymn for 3 rounds: every ally Warded (-10% damage). Cooldown 3.', target: 'self', hymn: { name: 'Hold the Note', rounds: 3, allies: { ward: { pct: 0.1, turns: HYMN } } }, cooldown: 3 }),
    st('sentinel', 'funeral-bash'),
    own({ name: 'Choir of Stone', desc: 'LITANY: Ward every ally (-25%) for 2 turns, draw every attack, and start Hold the Note.', target: 'allAllies', ward: { pct: 0.25, turns: 2 }, taunt: 2, hymn: { name: 'Hold the Note', rounds: 3, allies: { ward: { pct: 0.1, turns: HYMN } } }, rite: true }),
  ],
  shines: ['Hit-everyone bosses', 'The Choir Below'],
}));

K('CC-W098', (own) => ({
  passive: sig('Burns at Both Ends', 'Each round she loses 4% HP and the party gains 6 Zeal. When she falls, the Hymns playing double in strength until they end.'),
  sig: { burnRound: { hp: 0.04, zeal: 6 }, hymnOnFall: true },
  skills: [
    st('martyr', 'radiant-smite'),
    own({ name: 'Vigil Hymn', desc: 'A Hymn for 3 rounds: every ally Regenerates 4% a turn. Cooldown 3.', target: 'self', hymn: { name: 'Vigil Hymn', rounds: 3, allies: { regen: { pct: 0.04, turns: HYMN } } }, cooldown: 3 }),
    st('martyr', 'blood-oath'),
    own({ name: 'Dawn Chorus', desc: 'LITANY: burn every enemy with light, heal for 50% of the damage, and draw attacks for 2 turns.', target: 'allEnemies', mult: 0.85, drain: 0.5, taunt: 2, rite: true }),
  ],
  shines: ['Litany-chain parties', 'Zeal-steal bosses'],
}));

K('CC-W134', (own) => ({
  passive: sig('Lantern Hymn', 'While a Hymn plays, her burns tick twice.'),
  sig: { hymnBurnTwice: true },
  skills: [
    st('exorcist', 'lantern-flare'),
    st('exorcist', 'witchfire'),
    own({ name: 'Hymn of Unmaking', desc: "A Hymn for 3 rounds: each round strips every foe's shield and blessings. Cooldown 3.", target: 'self', hymn: { name: 'Hymn of Unmaking', rounds: 3, foes: { purge: true } }, cooldown: 3 }),
    st('exorcist', 'banishment'),
  ],
  shines: ['Choirmaster Hunt', 'Shielded and warded foes', 'Twofold Reliquary'],
}));

K('CC-W014', (own) => ({
  passive: sig('Marching Step', '+10% damage while a Hymn plays.'),
  sig: { hymnAtk: 0.1 },
  skills: [
    st('warsister', 'penitent-blow'),
    st('warsister', 'flagellants-charge'),
    own({ name: 'Marching Hymn', desc: 'A Hymn for 3 rounds: every ally +10% attack. Cooldown 3.', target: 'self', hymn: { name: 'Marching Hymn', rounds: 3, allies: { empower: { pct: 0.1, turns: HYMN } } }, cooldown: 3 }),
    own({ name: 'Last Verse', desc: 'LITANY: strike every enemy and leave them Bleeding for 2 turns.', target: 'allEnemies', mult: 0.95, bleed: { mult: 0.25, turns: 2 }, rite: true }),
  ],
}));

K('CC-W032', (own) => ({
  skills: [
    st('censer', 'incense-cloud'),
    st('censer', 'burning-thurible'),
    own({ name: 'Incense Verse', desc: 'A Hymn for 2 rounds: every foe -10% attack. Cooldown 3.', target: 'self', hymn: { name: 'Incense Verse', rounds: 2, foes: { weaken: { pct: 0.1, turns: HYMN } } }, cooldown: 3 }),
    st('censer', 'choking-smoke'),
  ],
}));

K('CC-W161', (own) => ({
  skills: [
    st('cantor', 'hymn-of-iron'),
    st('cantor', 'keening-note'),
    own({ name: 'Iron Verse', desc: 'A Hymn for 2 rounds (it harmonises with other Choir Hymns), and every Sister gains 8 Zeal now. Cooldown 3.', target: 'self', hymn: { name: 'Iron Verse', rounds: 2 }, zealGain: 8, zealAll: true, cooldown: 3 }),
    st('cantor', 'requiem-chorus'),
  ],
}));

// ======================= Thorn Covenant: Scars =======================

K('CC-W090', (own) => ({
  passive: sig('Crown of Living Briar', 'Each hit she takes gives her 1 Scar. Her counters deal 4% more per Scar and leave the attacker Bleeding for 2 turns.'),
  sig: { scarOnHit: 1, counterPerScar: 0.04, counterBleed: 2 },
  skills: [
    own({ name: 'Briar Guard', desc: 'Strike rank 1-2, draw attacks and counter, for 2 turns.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 0.75, taunt: 2, counter: { mult: 0.5, turns: 2 } }),
    own({ name: 'Scourge Stance', desc: 'Lose 10% HP; Ward herself (-30%) and draw attacks for 2 turns. Cooldown 2.', target: 'self', selfDmgPct: 0.1, ward: { pct: 0.3, turns: 2 }, taunt: 2, cooldown: 2 }),
    own({ name: 'Rend the Fraud', desc: "Spend 5 Scars to strip a foe's shield and blessings and Stun it (bosses are Delayed instead). Cooldown 3.", target: 'enemy', mult: 0.6, purge: true, stun: 1, cond: { if: 'boss', then: { delay: true } }, spend: { kw: 'scars', n: 5, need: true, per: {} }, cooldown: 3 }),
    own({ name: 'Thicket', desc: 'LITANY: every ally gains Thorns (30% back) for 2 turns; she draws every attack.', target: 'allAllies', thorns: { pct: 0.3, turns: 2 }, taunt: 2, rite: true }),
  ],
  seal: { name: 'Unmasked', desc: 'The first time she drops under 30% HP, she heals 25% and goes to 10 Scars.', kind: 'unmasked' },
  shines: ['Flayed Saint Hunt', 'Thorn Covenant Order Tower', 'Rivals'],
}));

K('CC-W099', (own) => ({
  passive: sig("Martyr's Gift", 'When she falls, every Sister gains 40 Zeal and +25% attack for 2 turns, and each Covenant Sister 1 Scar for every 2 she held.'),
  sig: { fallGift: { zeal: 40, empower: 0.25, scarsShare: 0.5 } },
  skills: [
    own({ name: 'Bleeding Smite', desc: 'Strike rank 1-2, leave it Bleeding for 2 turns, and heal for 35% of the damage.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 1.1, bleed: { mult: 0.2, turns: 2 }, drain: 0.35 }),
    own({ name: 'Offering of Scars', desc: 'Spend all her Scars: every ally heals 2% of max HP per Scar. Cooldown 2.', target: 'allAllies', spend: { kw: 'scars', per: { healPct: 0.02 } }, cooldown: 2 }),
    st('martyr', 'blood-oath'),
    own({ name: 'Dawn of Thorns', desc: 'LITANY: burn every enemy with light, heal 50% of the damage, and draw attacks for 2 turns.', target: 'allEnemies', mult: 0.85, drain: 0.5, taunt: 2, rite: true }),
  ],
  shines: ['Rivals', 'Inquisition trials', 'Thorn Covenant Order Tower'],
}));

K('CC-W117', (own) => ({
  passive: sig('Hymn of the Lash', 'Each Scar any Covenant Sister gains gives the party 2 Zeal.'),
  sig: { scarZeal: 2 },
  skills: [
    own({ name: 'Psalm of Penance', desc: 'Every ally loses 5% HP and gains +35% attack for 2 turns (Covenant Sisters Scar from it). Cooldown 3.', target: 'allAllies', hurtAllies: 0.05, empower: { pct: 0.35, turns: 2 }, empowerTarget: true, cooldown: 3 }),
    st('cantor', 'keening-note'),
    st('cantor', 'psalm-of-blades'),
    st('cantor', 'requiem-chorus'),
  ],
  shines: ['Flayed Saint Hunt', 'Twofold Reliquary'],
}));

K('CC-W006', (own) => ({
  skills: [
    st('inquisitor', 'accuse'),
    st('inquisitor', 'sentence'),
    own({ name: 'Bloody Confession', desc: 'Lose 8% HP; strike any foe, +50% against the Accused.', from: [1, 2, 3], target: 'enemy', selfDmgPct: 0.08, mult: 1.1, bonusIfAccused: 0.5 }),
    own({ name: 'Scarred Verdict', desc: 'LITANY: a crushing blow on any enemy, +5% per Scar she holds.', target: 'enemy', mult: 1.9, perScar: 0.05, rite: true }),
  ],
}));

K('CC-W144', (own) => ({
  skills: [
    st('exorcist', 'witchfire'),
    st('exorcist', 'rite-of-expulsion'),
    own({ name: 'Thornfire', desc: 'Set a foe Burning and Bleeding for 2 turns. Cooldown 1.', target: 'enemy', mult: 0.45, poison: { mult: 0.42, turns: 2 }, stackPoison: true, bleed: { mult: 0.2, turns: 2 }, cooldown: 1 }),
    own({ name: 'Briar Pyre', desc: 'LITANY: burn every enemy for 2 turns, and every one Bleeds as well.', target: 'allEnemies', mult: 0.7, poison: { mult: 0.4, turns: 2 }, stackPoison: true, bleed: { mult: 0.2, turns: 2 }, rite: true }),
  ],
}));

K('CC-W042', (own) => ({
  skills: [
    st('oracle', 'ash-bolt'),
    st('oracle', 'grim-augury'),
    own({ name: 'Blood Augury', desc: 'Lose 10% HP; every Sister gains 12 Zeal. Cooldown 3.', target: 'self', selfDmgPct: 0.1, zealGain: 12, zealAll: true, cooldown: 3 }),
    st('oracle', 'omen-of-ash'),
  ],
}));

K('CC-W171', (own) => ({
  skills: [
    st('veilblade', 'veil-strike'),
    st('veilblade', 'hamstring'),
    own({ name: 'Briar Knife', desc: 'Strike any rank and leave it Bleeding for 3 turns. Cooldown 1.', from: [1, 2, 3], target: 'enemy', mult: 0.8, bleed: { mult: 0.3, turns: 3 }, cooldown: 1 }),
    st('veilblade', 'thousand-cuts'),
  ],
}));

K('CC-W033', (own) => ({
  skills: [
    st('censer', 'incense-cloud'),
    st('censer', 'burning-thurible'),
    own({ name: 'Bitter Smoke', desc: 'Lose 5% HP; Poison every enemy for 2 turns (stacks). Cooldown 2.', target: 'allEnemies', selfDmgPct: 0.05, poison: { mult: 0.5, turns: 2 }, stackPoison: true, cooldown: 2 }),
    st('censer', 'choking-smoke'),
  ],
}));

// ======================= Drowned Litany: Tide =======================

K('CC-W100', (own) => ({
  passive: sig('Drowned Heart', 'At the start of her turn every Sister heals 1% per Tide. At Tide 5 she draws attacks on her own.'),
  sig: { tideHeal: 0.01, tideTaunt: true },
  skills: [
    own({ name: 'Brine Smite', desc: 'Strike rank 1-2 and heal for 35% of the damage, plus 5% per Tide.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 1.1, drain: 0.35, byTide: { per: { drain: 0.05 } } }),
    own({ name: 'Sink', desc: 'Ebb: spend all the Tide to shield every ally for 6% of max HP per Tide. Cooldown 2.', target: 'allAllies', spend: { kw: 'tide', per: { shieldPct: 0.06 } }, cooldown: 2 }),
    own({ name: 'Bell Under Water', desc: 'Draw attacks for 2 turns, Ward herself (-20%) and Regenerate 5% a turn. Cooldown 2.', target: 'self', taunt: 2, ward: { pct: 0.2, turns: 2 }, regen: { pct: 0.05, turns: 2 }, cooldown: 2 }),
    own({ name: 'Flood Tide', desc: 'LITANY: hit every enemy and heal for 50% of the damage; the Tide rises to 5.', target: 'allEnemies', mult: 0.85, drain: 0.5, gain: { tide: 5 }, rite: true }),
  ],
  seal: { name: 'Drowned and Returned', desc: 'The first time she falls, she rises at the start of the next round with 50% HP, and the Tide goes to 5.', kind: 'drowned' },
  shines: ['Hunt damage scores', 'Chapter Siege', 'Deep Bell Tower floors'],
}));

K('CC-W229', (own) => ({
  passive: sig('Tide of Omens', 'The Tide starts at 2. At the start of each round every Sister gains 3 Zeal per Tide.'),
  sig: { tideStart: 2, tideZeal: 3 },
  skills: [
    own({ name: 'Sunken Sight', desc: 'Hit any enemy, Hex it (-25% Magic Resist) for 2 turns and push its turn to the end. Breaks a charge. Cooldown 2.', target: 'enemy', mult: 0.5, hex: { pct: 0.25, turns: 2 }, delay: true, cooldown: 2 }),
    own({ name: 'Riptide Blessing', desc: 'An ally gains +25% attack for 2 turns and Haste; at Tide 4 or more, every ally does. Cooldown 3.', target: 'ally', empower: { pct: 0.25, turns: 2 }, empowerTarget: true, haste: 1, byTide: { at: 4, then: { target: 'allAllies' } }, cooldown: 3 }),
    own({ name: 'Ebb of Omens', desc: 'Ebb: spend all the Tide; every Sister gains 10 Zeal per Tide spent. Cooldown 3.', target: 'self', zealAll: true, spend: { kw: 'tide', per: { zeal: 10 } }, cooldown: 3 }),
    own({ name: 'Deluge Omen', desc: 'LITANY: heavy magic damage on every enemy, +10% per Tide.', target: 'allEnemies', mult: 1.3, byTide: { per: { multPct: 0.1 } }, rite: true }),
  ],
  seal: { name: 'High Water', desc: 'The first time the Tide reaches 5, every Sister gains 25 Zeal.', kind: 'highWater' },
  shines: ['Litany-chain parties', 'Red Cardinal Hunt', 'Her Feast'],
}));

K('CC-W220', (own) => ({
  passive: sig('Drowning Bell', 'Her hits deal double damage under 30% HP, plus 4% per Tide (50% at Tide 5).'),
  sig: { executeTide: { base: 0.3, per: 0.04 } },
  skills: [
    st('inquisitor', 'accuse'),
    own({ name: 'Toll of the Deep', desc: 'Lunge into rank 1-3 and push its turn to the end. +50% against the Accused. Cooldown 2.', from: [1, 2], target: 'enemy', reach: [1, 2, 3], mult: 1.15, bonusIfAccused: 0.5, delay: true, cooldown: 2 }),
    st('inquisitor', 'sentence'),
    st('inquisitor', 'verdict'),
  ],
  shines: ['Finishing Hunt bosses', "Pilgrim's Road chapter bosses"],
}));

K('CC-W007', (own) => ({
  passive: sig('Baptism', 'Accused foes lose 5% attack per Tide.'),
  sig: { tideWeakAccused: 0.05 },
  skills: [
    own({ name: 'Accuse the Drowned', desc: 'A light hit on any rank: Accused and Hexed (-25% Magic Resist) for 3 turns.', from: [1, 2, 3], target: 'enemy', mult: 0.6, accuse: 3, hex: { pct: 0.25, turns: 3 } }),
    own({ name: 'Hold Under', desc: 'Strike rank 1-2; at Tide 3 or more, Stun it (bosses are Delayed instead). Cooldown 3.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 1.1, byTide: { at: 3, then: { stun: 1, cond: { if: 'boss', then: { delay: true } } } }, cooldown: 3 }),
    st('inquisitor', 'sentence'),
    own({ name: 'Last Baptism', desc: 'LITANY: Ebb: a crushing blow on any enemy, +15% per Tide spent.', target: 'enemy', mult: 1.8, bonusIfAccused: 0.5, spend: { kw: 'tide', per: { multPct: 0.15 } }, rite: true }),
  ],
  shines: ['Red Cardinal Hunt', 'Bosses that grow stronger'],
}));

K('CC-W043', (own) => ({
  skills: [
    st('oracle', 'foresight'),
    st('oracle', 'grim-augury'),
    own({ name: 'High Water Omen', desc: 'The Tide rises by 1 now; every ally +10% attack for 2 turns. Cooldown 3.', target: 'allAllies', empower: { pct: 0.1, turns: 2 }, empowerTarget: true, gain: { tide: 1 }, cooldown: 3 }),
    own({ name: 'Undertow', desc: 'LITANY: heavy damage on every enemy; the fastest is Delayed.', target: 'allEnemies', mult: 1.1, delayFastest: true, rite: true }),
  ],
}));

K('CC-W154', (own) => ({
  skills: [
    st('confessor', 'remedy'),
    st('confessor', 'contagion'),
    own({ name: 'Banner of the Flood', desc: 'Every ally Regenerates 2% plus 1% per Tide a turn for 3 turns. Cooldown 2.', target: 'allAllies', regen: { pct: 0.02, turns: 3 }, byTide: { per: { regenPct: 0.01 } }, cooldown: 2 }),
    own({ name: 'Baptismal Rite', desc: 'LITANY: heal every ally 30% and cure poison, burns and bleeding.', target: 'allAllies', healPct: 0.3, cleanse: true, rite: true }),
  ],
}));

K('CC-W163', (own) => ({
  skills: [
    st('cantor', 'hymn-of-iron'),
    st('cantor', 'psalm-of-blades'),
    own({ name: 'Song Beneath Water', desc: 'Every ally +5% critical chance per Tide for 2 turns. Cooldown 2.', target: 'allAllies', critUp: { pct: 0, turns: 2 }, byTide: { per: { critPct: 0.05 } }, cooldown: 2 }),
    own({ name: 'Drowned Choir', desc: 'LITANY: every ally +30% attack for 2 turns and Haste.', target: 'allAllies', empower: { pct: 0.3, turns: 2 }, empowerTarget: true, haste: 1, rite: true }),
  ],
}));

K('CC-W052', (own) => ({
  skills: [
    st('hierophant', 'reliquary-bash'),
    st('hierophant', 'sanctuary'),
    own({ name: 'Floodgate', desc: 'Shield every ally for 6% of max HP, plus 3% per Tide. Cooldown 2.', target: 'allAllies', shieldPct: 0.06, byTide: { per: { shieldPct: 0.03 } }, cooldown: 2 }),
    st('hierophant', 'wall-of-saints'),
  ],
}));

K('CC-W061', (own) => ({
  skills: [
    st('sentinel', 'gravewarden-strike'),
    st('sentinel', 'tomb-stance'),
    own({ name: 'Breakwater', desc: 'Draw attacks for 2 turns; at Tide 3 or more, also Ward herself (-20%). Cooldown 1.', target: 'self', taunt: 2, byTide: { at: 3, then: { ward: { pct: 0.2, turns: 2 } } }, cooldown: 1 }),
    st('sentinel', 'sealed-sepulcher'),
  ],
}));

// ======================= Glass Confession: Confess =======================

K('CC-W230', (own) => ({
  passive: sig('Nothing Hidden', 'Every foe starts the fight Confessed for 3 turns, and she acts first in round 1.'),
  sig: { confessAll: 3, firstRound: true },
  skills: [
    own({ name: 'Glass Augury', desc: 'Hit any enemy, Hex it (-25% Magic Resist) for 2 turns, Confess it and push its turn to the end. Breaks a charge. Cooldown 2.', target: 'enemy', mult: 0.8, hex: { pct: 0.25, turns: 2 }, confess: 2, delay: true, cooldown: 2 }),
    own({ name: 'Mirror the Sin', desc: "Take a foe's Empower, Ward, Haste and shield for your strongest Sister. Cooldown 3.", target: 'enemy', mult: 0.4, steal: true, cooldown: 3 }),
    own({ name: 'Pane of Black Glass', desc: 'Every ally +30% critical chance for 2 turns, and every Sister 10 Zeal. Cooldown 3.', target: 'allAllies', critUp: { pct: 0.3, turns: 2 }, zealGain: 10, zealAll: true, cooldown: 3 }),
    own({ name: 'Shattered Confession', desc: 'LITANY: heavy magic damage on every enemy; their blessings pass to your strongest Sister.', target: 'allEnemies', mult: 1.3, steal: true, rite: true }),
  ],
  seal: { name: 'Seen Before', desc: 'The first time a Blasphemy lands, she saw it coming: every Sister is Warded (-40%) against it.', kind: 'seenBefore' },
  shines: ['Twofold Reliquary', 'Inquisition trials', 'Self-buffing bosses'],
}));

K('CC-W110', (own) => ({
  passive: sig('Mirrored Penance', 'Whenever she cures a Sister, the poison, burn or bleed she removed is thrown onto the foe with the most HP.'),
  sig: { throwCures: true },
  skills: [
    own({ name: 'Glass Thorn', desc: 'Lash rank 1-3 (Bleeding for 2 turns) and Confess it; every Sister heals 45% of the damage.', target: 'enemy', reach: [1, 2, 3], mult: 1.2, bleed: { mult: 0.2, turns: 2 }, lifelink: 0.45, confess: 2 }),
    st('abbess', 'pruning'),
    own({ name: 'Briar Mirror', desc: 'Every ally gains Thorns (35% back) and is Warded (-10%) for 2 turns. Cooldown 2.', target: 'allAllies', thorns: { pct: 0.35, turns: 2 }, ward: { pct: 0.1, turns: 2 }, cooldown: 2 }),
    own({ name: 'Garden of Glass', desc: 'LITANY: cure every ally (each cure is thrown back), heal every ally 25%, and rake every enemy (Bleeding 2 turns).', target: 'allAllies', cleanse: true, healPct: 0.25, alsoFoes: { mult: 0.6, bleed: { mult: 0.2, turns: 2 } }, rite: true }),
  ],
  shines: ['Rot-Mother Hunt', 'Flayed Saint Hunt'],
}));

K('CC-W008', (own) => ({
  passive: sig('Glass Confession', 'Her crits on a foe both Confessed and Accused Shatter for +20% more crit damage, and 30% of the hit splashes onto the foes beside it.'),
  sig: { shatter: { crit: 0.2, splash: 0.3 } },
  skills: [
    own({ name: 'Accuse and Confess', desc: 'A light hit on any rank: Accused, Sundered (-25% armor) and Confessed for 3 turns.', from: [1, 2, 3], target: 'enemy', mult: 0.6, accuse: 3, sunder: { pct: 0.25, turns: 3 }, confess: 3 }),
    own({ name: 'Shard Thrust', desc: 'Lunge into rank 1-3 with +30% critical chance.', from: [1, 2], target: 'enemy', reach: [1, 2, 3], mult: 1.2, critChance: 0.3, move: -1 }),
    st('inquisitor', 'sentence'),
    own({ name: 'Mirror Verdict', desc: 'LITANY: a crushing blow on any enemy, doubled against the Accused; always a crit against the Confessed.', target: 'enemy', mult: 1.8, bonusIfAccused: 1, cond: { if: 'confessed', then: { critChance: 1 } }, rite: true }),
  ],
  shines: ['Rivals', 'Glass Confession Order Tower', 'Packed foes'],
}));

K('CC-W035', (own) => ({
  skills: [
    st('censer', 'incense-cloud'),
    st('censer', 'burning-thurible'),
    own({ name: 'Glass Smoke', desc: 'Smoke one foe: Confessed and Weakened (-20%) for 2 turns. Cooldown 1.', target: 'enemy', mult: 0.3, confess: 2, weaken: { pct: 0.2, turns: 2 }, cooldown: 1 }),
    own({ name: 'Smoke and Mirrors', desc: 'LITANY: damage every enemy; every Confessed foe also Burns for 3 turns.', target: 'allEnemies', mult: 0.7, cond: { if: 'confessed', then: { poison: { mult: 0.5, turns: 3 }, stackPoison: true } }, rite: true }),
  ],
}));

K('CC-W026', (own) => ({
  skills: [
    st('confessor', 'remedy'),
    st('confessor', 'miasma'),
    own({ name: 'Hear the Sin', desc: 'Confess a foe for 2 turns and heal the most hurt Sister 10%. Cooldown 1.', target: 'enemy', mult: 0.3, confess: 2, mendLowest: 0.1, cooldown: 1 }),
    st('confessor', 'last-rites'),
  ],
}));

K('CC-W182', (own) => ({
  skills: [
    st('adjudicator', 'reflected-sentence'),
    st('adjudicator', 'mirror-ward'),
    own({ name: 'Catalogue', desc: 'Confess a foe for 2 turns; for the rest of the fight its kind takes +5% damage from your party. Cooldown 2.', target: 'enemy', mult: 0.4, confess: 2, catalogue: true, cooldown: 2 }),
    st('adjudicator', 'final-judgment'),
  ],
}));

K('CC-W191', (own) => ({
  skills: [
    st('hospitaller', 'chalice-draught'),
    st('hospitaller', 'tending-hands'),
    own({ name: 'Clear Water', desc: 'Cure every ally of poison, burns and bleeding, and heal them 5%. Cooldown 2.', target: 'allAllies', cleanse: true, healPct: 0.05, cooldown: 2 }),
    st('hospitaller', 'grail-of-return'),
  ],
}));

// ======================= Red Pilgrimage: Stride =======================

K('CC-W009', (own) => ({
  passive: sig('The Red Road', 'Each Stride gives her +6% damage. She may Step twice a turn instead of once.'),
  sig: { strideDmg: 0.06, doubleStep: true },
  skills: [
    own({ name: 'Accuse on the March', desc: 'Hit any rank, Accuse it for 3 turns and step a rank forward.', target: 'enemy', mult: 0.6, accuse: 3, move: -1 }),
    own({ name: 'Barefoot Lunge', desc: 'Lunge two ranks forward into rank 1-3; +15% per Stride.', from: [2, 3, 4], target: 'enemy', reach: [1, 2, 3], mult: 1.1, perStride: 0.15, move: -2 }),
    own({ name: 'Retreat in Blood', desc: 'Step two ranks back; the foe in rank 1 Bleeds for 2 turns. Cooldown 1.', from: [1, 2], target: 'enemy', reach: [1], mult: 0.4, bleed: { mult: 0.25, turns: 2 }, move: 2, cooldown: 1 }),
    own({ name: "Pilgrim's Verdict", desc: 'LITANY: spend all Stride: a crushing blow on any enemy, 1.6x plus 0.3x per Stride, doubled against the Accused.', target: 'enemy', mult: 1.6, bonusIfAccused: 1, spend: { kw: 'stride', per: { multAdd: 0.3 } }, rite: true }),
  ],
  seal: { name: 'The Bell No One Hears', desc: 'The first time a Sister falls, Ysabet gains 5 Stride and Haste.', kind: 'bellNoOne' },
  shines: ['Free-movement Vigil and real-time field', 'Red Cardinal Hunt', 'Red Pilgrimage Order Tower'],
}));

K('CC-W129', (own) => ({
  passive: sig('Oath of Blood', 'She heals for 25% of the damage she deals. Healing past her max HP becomes a shield on the Sister behind her.'),
  sig: { lifesteal: 0.25, overhealBehind: true },
  skills: [
    own({ name: 'Oath Strike', desc: 'Strike rank 1-2, draw attacks for 2 turns, and heal for 35% of the damage.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 1.0, taunt: 2, drain: 0.35 }),
    own({ name: 'Break the Vial', desc: 'Lose 15% HP; every ally gains +25% attack for 2 turns and 1 Stride. Cooldown 3.', target: 'allAllies', selfDmgPct: 0.15, empower: { pct: 0.25, turns: 2 }, empowerTarget: true, giveStride: 1, cooldown: 3 }),
    own({ name: "Pilgrim's Vanguard", desc: 'Step forward to rank 1, Ward herself (-25%) and draw attacks for 2 turns. Cooldown 2.', target: 'self', move: -3, ward: { pct: 0.25, turns: 2 }, taunt: 2, cooldown: 2 }),
    own({ name: 'Crimson Pilgrimage', desc: 'LITANY: strike every enemy; every Sister heals 50% of the damage.', target: 'allEnemies', mult: 0.9, lifelink: 0.5, rite: true }),
  ],
  seal: { name: 'I Walk Before You', desc: 'Once a fight, a killing blow meant for another Sister lands on her instead, if she can survive it.', kind: 'walkBefore' },
  shines: ['Chapter Siege', 'Deeper-crypt bosses', 'Her Feast'],
}));

K('CC-W120', (own) => ({
  passive: sig('Marching Song', 'Whenever she sings (any of her skills), every Pilgrim gains 1 Stride.'),
  sig: { singStride: 1 },
  skills: [
    own({ name: 'Processional', desc: 'The whole party steps one rank: the front Sister goes to the back, and the new front gains Haste; every Sister gains 8 Zeal. Cooldown 2.', target: 'self', rotate: true, zealGain: 8, zealAll: true, cooldown: 2 }),
    st('cantor', 'hymn-of-iron'),
    st('cantor', 'psalm-of-blades'),
    own({ name: 'Song of the Long Road', desc: 'LITANY: every ally +30% attack for 2 turns and Haste; each gains 2 Stride.', target: 'allAllies', empower: { pct: 0.3, turns: 2 }, empowerTarget: true, haste: 1, giveStride: 2, rite: true }),
  ],
  shines: ['Rank-movement parties', 'Shove-heavy foes', 'Real-time field'],
}));

K('CC-W018', (own) => ({
  passive: sig('Communion of Blood', 'Heals for 15% of the damage she deals, +5% per Stride, and deals 5% more per Stride. Each fallen Sister gives her +15% attack.'),
  sig: { strideLifesteal: { base: 0.15, per: 0.05 }, atkPerFallen: 0.15, strideDmg: 0.05 },
  skills: [
    st('warsister', 'flagellants-charge'),
    st('warsister', 'blood-for-zeal'),
    st('warsister', 'penitent-blow'),
    own({ name: 'Road of Martyrs', desc: 'LITANY: strike every enemy, Bleeding for 2 turns; +10% per Stride.', target: 'allEnemies', mult: 0.95, bleed: { mult: 0.25, turns: 2 }, perStride: 0.1, rite: true }),
  ],
  shines: ['Bell Tower and Heresy', 'Last-stand fights'],
}));

K('CC-W054', (own) => ({
  skills: [
    st('hierophant', 'reliquary-bash'),
    st('hierophant', 'vigil-bell'),
    own({ name: 'Shrine on the Road', desc: 'Step a rank forward and shield the Sister now behind her for 25% of max HP. Cooldown 1.', target: 'self', move: -1, shieldBehind: 0.25, cooldown: 1 }),
    own({ name: 'Wayside Wall', desc: 'LITANY: shield every ally for 25% of max HP.', target: 'allAllies', shieldPct: 0.25, rite: true }),
  ],
}));

K('CC-W174', (own) => ({
  skills: [
    st('veilblade', 'veil-strike'),
    st('veilblade', 'hamstring'),
    own({ name: 'Roadside Ambush', desc: 'Step back a rank and strike any foe with +25% critical chance. Cooldown 1.', from: [1, 2, 3], target: 'enemy', mult: 1.0, critChance: 0.25, move: 1, cooldown: 1 }),
    own({ name: 'Red Knife', desc: 'LITANY: a savage blow on any enemy, +50% critical chance; +10% per Stride.', target: 'enemy', mult: 1.9, critChance: 0.5, perStride: 0.1, rite: true }),
  ],
}));

K('CC-W201', (own) => ({
  skills: [
    st('adjudicator', 'reflected-sentence'),
    st('adjudicator', 'censure'),
    own({ name: 'Toll Gate', desc: 'Hit a foe, knock it a rank back and Weaken it (-20%) for 2 turns. Cooldown 2.', target: 'enemy', mult: 0.5, shove: 1, weaken: { pct: 0.2, turns: 2 }, cooldown: 2 }),
    own({ name: 'Judgment on the Road', desc: 'LITANY: every enemy is Weakened (-30%) for 2 turns.', target: 'allEnemies', mult: 0.6, weaken: { pct: 0.3, turns: 2 }, rite: true }),
  ],
}));

K('CC-W192', (own) => ({
  skills: [
    st('hospitaller', 'chalice-draught'),
    st('hospitaller', 'lance-of-mercy'),
    own({ name: 'Footbath', desc: 'Heal an ally 15% of max HP and give her 1 Stride. Cooldown 1.', target: 'ally', healPct: 0.15, giveStride: 1, cooldown: 1 }),
    own({ name: "Pilgrim's Grail", desc: 'LITANY: raise fallen Sisters with 30% HP and heal every ally 25%.', target: 'allAllies', revive: 0.3, healPct: 0.25, rite: true }),
  ],
}));

K('CC-W183', (own) => ({
  skills: [
    st('adjudicator', 'reflected-sentence'),
    st('adjudicator', 'censure'),
    own({ name: 'Road Ledger', desc: 'Every Sister gains 1 Stride and 5 Zeal. Cooldown 2.', target: 'allAllies', giveStride: 1, zealGain: 5, zealAll: true, cooldown: 2 }),
    st('adjudicator', 'final-judgment'),
  ],
}));

// ======================= Hollow Bell: Toll =======================

K('CC-W019', (own) => ({
  passive: sig('Cracked Bell', 'While she is under half HP, her skills ring the Bell twice. Peal: she strikes every enemy for 0.7x.'),
  sig: { doubleRingLow: true, peal: { strikeAll: 0.7 } },
  skills: [
    own({ name: 'Clapper Blow', desc: 'A heavy strike on rank 1-2; +40% while she is under half HP.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 1.4, lowHpBonus: 0.4 }),
    own({ name: 'Ring the Hours', desc: 'Lose 10% HP; +25 of her own Zeal, and the Bell rings twice. Cooldown 2.', target: 'self', selfDmgPct: 0.1, zealGain: 25, gain: { toll: 1 }, cooldown: 2 }),
    own({ name: 'Toll for the Wicked', desc: 'Strike rank 1-3 and push its turn to the end. Cooldown 2.', from: [1, 2], target: 'enemy', reach: [1, 2, 3], mult: 1.1, delay: true, cooldown: 2 }),
    own({ name: 'Midnight Toll', desc: 'LITANY: strike every enemy; the Bell rings three times.', target: 'allEnemies', mult: 0.95, gain: { toll: 2 }, rite: true }),
  ],
  seal: { name: 'Unbroken Vow', desc: 'The first killing blow leaves her at 1 HP, and Midnight comes at once if it has not yet.', kind: 'unbrokenMidnight' },
  shines: ['Choirmaster Hunt', 'Bell Tower', 'Hollow Bell Order Tower'],
}));

K('CC-W010', (own) => ({
  passive: sig('Knell of Judgement', 'Peal: every foe is Accused for a turn.'),
  sig: { peal: { accuseAll: 1 } },
  skills: [
    st('inquisitor', 'accuse'),
    own({ name: 'Death Knell', desc: 'Lunge into rank 1-3; +50% against the Accused, and the Bell rings twice more if it kills.', from: [1, 2], target: 'enemy', reach: [1, 2, 3], mult: 1.2, bonusIfAccused: 0.5, onKill: { toll: 2 } }),
    st('inquisitor', 'sentence'),
    own({ name: 'Last Peal', desc: 'LITANY: a crushing blow on any enemy, doubled against the Accused, then the Bell Peals at once.', target: 'enemy', mult: 1.8, bonusIfAccused: 1, pealNow: true, rite: true }),
  ],
  shines: ['Chapter Siege', 'Crypt waves'],
}));

K('CC-W047', (own) => ({
  passive: sig('Matins', 'Your Sisters start every fight with +15 Zeal. Peal: every Sister gains 8 Zeal.'),
  sig: { startZeal: 15, peal: { zealAll: 8 } },
  skills: [
    st('oracle', 'ash-bolt'),
    own({ name: 'Call to Prayer', desc: 'An ally gains +30% attack for 2 turns and Haste. Cooldown 2.', target: 'ally', empower: { pct: 0.3, turns: 2 }, empowerTarget: true, haste: 1, cooldown: 2 }),
    own({ name: 'Toll the Hour', desc: 'The Bell rings twice and every Sister gains 6 Zeal. Cooldown 3.', target: 'self', gain: { toll: 1 }, zealGain: 6, zealAll: true, cooldown: 3 }),
    own({ name: 'Vespers', desc: 'LITANY: heavy damage on every enemy; every Sister gains 15 Zeal.', target: 'allEnemies', mult: 1.15, zealGain: 15, zealAll: true, rite: true }),
  ],
  shines: ['The Choir Below', 'Red Cardinal Hunt'],
}));

K('CC-W175', (own) => ({
  passive: sig('The Last Veil', '+35% damage to foes under half HP. Peal: she strikes the foe with the lowest HP.'),
  sig: { dmgUnderHalf: 0.35, peal: { strikeLowest: 1.0 } },
  skills: [
    st('veilblade', 'veil-strike'),
    own({ name: 'Between Tolls', desc: 'Haste herself and +30% critical chance for 2 turns. Cooldown 2.', target: 'self', haste: 1, critUp: { pct: 0.3, turns: 2 }, cooldown: 2 }),
    st('veilblade', 'hamstring'),
    own({ name: 'Funeral Knife', desc: 'LITANY: a savage blow on any enemy, double damage under 30% HP.', target: 'enemy', mult: 1.9, execute: 1, rite: true }),
  ],
  shines: ['Back-rank healers in deeper crypts', 'Bell Tower boss floors'],
}));

K('CC-W055', (own) => ({
  passive: { name: 'Reliquary Ward', desc: 'While she stands, your Sisters take 5% less damage. Peal: shield every Sister for 8% of max HP.', kind: 'bulwark', value: 0.05 },
  sig: { peal: { shieldAll: 0.08 } },
  skills: [
    st('hierophant', 'reliquary-bash'),
    st('hierophant', 'vigil-bell'),
    own({ name: 'Sanctus Bell', desc: 'Shield an ally for 25% of max HP and ring the Bell. Cooldown 1.', target: 'ally', shieldPct: 0.25, cooldown: 1 }),
    own({ name: 'Cathedral Wall', desc: 'LITANY: shield every ally for 25% of max HP; the Bell rings twice.', target: 'allAllies', shieldPct: 0.25, gain: { toll: 1 }, rite: true }),
  ],
}));

K('CC-W091', (own) => ({
  passive: { name: 'Last Breath', desc: 'Once a fight a killing blow leaves her at 1 HP. Peal: she heals 8%.', kind: 'unbroken' },
  sig: { peal: { healSelf: 0.08 } },
  skills: [
    st('martyr', 'radiant-smite'),
    st('martyr', 'intercession'),
    own({ name: 'Ring for the Dead', desc: 'Ring the Bell and draw attacks for a turn. Cooldown 1.', target: 'self', taunt: 1, cooldown: 1 }),
    st('martyr', 'dawnbreak'),
  ],
}));

// ============ Limited SSRs (the Altar). Kits wait here until they join the roster. ============

K('CC-W078', (own) => ({
  passive: sig('Weight of Sin', '+6% damage per Guilt on her target, on top of what Guilt already adds.'),
  sig: { guiltDmg: 0.06 },
  skills: [
    own({ name: 'Scourge of Witness', desc: 'Strike rank 1-2, Accuse it for 2 turns and add 1 Guilt.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 1.2, accuse: 2, guilt: 1 }),
    own({ name: 'Confess Through Pain', desc: 'Lose 10% HP; +25 of her own Zeal and +25% attack for 2 turns. Cooldown 2.', target: 'self', selfDmgPct: 0.1, zealGain: 25, empower: { pct: 0.25, turns: 2 }, cooldown: 2 }),
    own({ name: 'Weighed and Found Wanting', desc: 'Strike rank 1-3, spending its Guilt for +25% damage each. Cooldown 2.', from: [1, 2], target: 'enemy', reach: [1, 2, 3], mult: 1.0, spend: { kw: 'guilt', per: { multPct: 0.25 } }, cooldown: 2 }),
    own({ name: 'Penance of the Court', desc: 'LITANY: strike every enemy, add 1 Guilt and leave them Bleeding for 2 turns.', target: 'allEnemies', mult: 0.9, guilt: 1, bleed: { mult: 0.25, turns: 2 }, rite: true }),
  ],
  shines: ['Chapter Siege', 'Veiled Tribunal Order Tower'],
}));

K('CC-W187', (own) => ({
  passive: sig('Standing Order', 'Every Overwatch reaction also Weakens its foe (-20% attack) for 2 turns.'),
  sig: { owWeaken: 0.2 },
  skills: [
    st('adjudicator', 'reflected-sentence'),
    own({ name: 'Watch Order', desc: 'Put an ally on Overwatch and Ward her (-20%) for 2 turns. Cooldown 2.', target: 'ally', overwatch: OVERWATCH_HIT, ward: { pct: 0.2, turns: 2 }, cooldown: 2 }),
    st('adjudicator', 'censure'),
    own({ name: 'Judgment at the Gate', desc: 'LITANY: every Sister goes on Overwatch, and every foe loses 30 Wrath.', target: 'allAllies', overwatchAll: OVERWATCH_HIT, alsoFoes: { wrathDrain: 30 }, rite: true }),
  ],
  shines: ['Blasphemy bosses', 'Iron Vigil Order Tower'],
}));

K('CC-W147', (own) => ({
  passive: sig('Lantern on the Road', 'Her burns are 10% stronger for each Stride she holds.'),
  sig: { dotPerStride: 0.1 },
  skills: [
    own({ name: "Wayfarer's Flare", desc: 'Step a rank forward, hit any enemy and strip its shield and blessings.', from: [2, 3, 4], target: 'enemy', mult: 0.9, purge: true, move: -1 }),
    st('exorcist', 'witchfire'),
    own({ name: 'Ember Retreat', desc: 'Set a foe Burning for 3 turns (stacks) and step a rank back. Cooldown 1.', target: 'enemy', mult: 0.5, poison: { mult: 0.4, turns: 3 }, stackPoison: true, move: 1, cooldown: 1 }),
    own({ name: 'Road of Ash', desc: 'LITANY: burn every enemy for 3 turns (stacks); spends her Stride for +10% each.', target: 'allEnemies', mult: 0.8, poison: { mult: 0.4, turns: 3 }, stackPoison: true, spend: { kw: 'stride', per: { multPct: 0.1 } }, rite: true }),
  ],
  shines: ['Real-time field', 'Red Pilgrimage Order Tower'],
}));

K('CC-W197', (own) => ({
  passive: sig('Ash Unction', 'Mercy kills also heal every Sister 5% more and cure them.'),
  sig: { mercyCure: 0.05 },
  skills: [
    st('hospitaller', 'chalice-draught'),
    own({ name: 'Last Unction', desc: 'Strike rank 1-3 and Foretell it (+15% Mercy line) for 2 turns; every Sister heals 30% of the damage.', target: 'enemy', reach: [1, 2, 3], mult: 1.1, foretell: { pct: 0.15, turns: 2 }, lifelink: 0.3 }),
    own({ name: 'Ashen Rest', desc: 'Heal every ally 10% and let them Regenerate 5% a turn for 2 turns. Cooldown 2.', target: 'allAllies', healPct: 0.1, regen: { pct: 0.05, turns: 2 }, cooldown: 2 }),
    own({ name: 'Rest in Ash', desc: 'LITANY: raise fallen Sisters with 30% HP, heal every ally 25%, and Foretell every foe for 2 turns.', target: 'allAllies', revive: 0.3, healPct: 0.25, alsoFoes: { foretell: { pct: 0.15, turns: 2 } }, rite: true }),
  ],
  shines: ['Crypt runs', 'Ashen Mercy Order Tower'],
}));

K('CC-W218', (own) => ({
  passive: sig('Psalm of the Accuser', '+25% damage while a Hymn plays.'),
  sig: { hymnAtk: 0.25 },
  skills: [
    st('inquisitor', 'accuse'),
    own({ name: 'Choir of Accusers', desc: 'A Hymn for 3 rounds: every foe is Accused. Cooldown 3.', target: 'self', hymn: { name: 'Choir of Accusers', rounds: 3, foes: { accuse: 1 } }, cooldown: 3 }),
    own({ name: 'Sentence in Song', desc: 'Drag any foe to the front and strike it; double damage under 30% HP. Cooldown 2.', from: [1, 2, 3], target: 'enemy', mult: 1.05, execute: 1, pull: true, cooldown: 2 }),
    own({ name: 'Verdict in Chorus', desc: 'LITANY: a crushing blow on any enemy, doubled against the Accused; every Sister gains 10 Zeal.', target: 'enemy', mult: 1.8, bonusIfAccused: 1, zealGain: 10, zealAll: true, rite: true }),
  ],
  shines: ['Hunt damage scores', 'Candle Choir Order Tower'],
}));

K('CC-W137', (own) => ({
  passive: sig('Lantern of Glass', 'Her burns on Confessed foes are 60% stronger.'),
  sig: { dotConfessed: 0.6 },
  skills: [
    own({ name: 'Glass Lantern', desc: 'Hit any enemy, strip its shield and blessings, Confess it and set it Burning for 2 turns.', target: 'enemy', mult: 0.9, purge: true, confess: 2, poison: { mult: 0.35, turns: 2 }, stackPoison: true }),
    st('exorcist', 'witchfire'),
    own({ name: 'Mirror Flame', desc: 'Ignite all the burn on one foe at once for 1.5x; 2x on the Confessed. Cooldown 2.', target: 'enemy', mult: 0.3, detonate: 1.5, cond: { if: 'confessed', then: { detonate: 2 } }, cooldown: 2 }),
    own({ name: 'Pane of Fire', desc: 'LITANY: burn every enemy for 3 turns (stacks) and Confess them.', target: 'allEnemies', mult: 0.8, confess: 2, poison: { mult: 0.4, turns: 3 }, stackPoison: true, rite: true }),
  ],
  shines: ['Self-buffing bosses', 'Glass Confession Order Tower'],
}));

K('CC-W217', (own) => ({
  passive: sig('Grave Judge', '+5% critical chance for each Remains the party holds.'),
  sig: { critPerRemains: 0.05 },
  skills: [
    st('inquisitor', 'accuse'),
    own({ name: 'Exhume', desc: 'Lunge into rank 1-3, +50% against the Accused; the party gains 1 Remains. Cooldown 2.', from: [1, 2], target: 'enemy', reach: [1, 2, 3], mult: 1.0, bonusIfAccused: 0.5, gain: { remains: 1 }, cooldown: 2 }),
    own({ name: 'Bone Sentence', desc: 'Drag any foe to the front and strike it, double under 30% HP; spends up to 2 Remains for +25% each. Cooldown 2.', from: [1, 2, 3], target: 'enemy', mult: 1.0, execute: 1, pull: true, spend: { kw: 'remains', n: 2, per: { multPct: 0.25 } }, cooldown: 2 }),
    own({ name: 'Judgment of the Ossuary', desc: 'LITANY: a crushing blow on any enemy, doubled against the Accused; spends every Remains for +15% each.', target: 'enemy', mult: 1.6, bonusIfAccused: 1, spend: { kw: 'remains', per: { multPct: 0.15 } }, rite: true }),
  ],
  shines: ['Summoner bosses', 'Sepulcher Watch Order Tower'],
}));

K('CC-W148', (own) => ({
  passive: sig('Bell of Embers', 'Peal: every foe Burns for 2 turns.'),
  sig: { peal: { burnAll: 0.3 } },
  skills: [
    st('exorcist', 'lantern-flare'),
    own({ name: 'Tolling Flame', desc: 'Set any enemy Burning for 3 turns (stacks); the Bell rings twice.', target: 'enemy', mult: 0.45, poison: { mult: 0.42, turns: 3 }, stackPoison: true, gain: { toll: 1 } }),
    own({ name: 'Cracked Bell Rite', desc: 'Strip the shield and blessings of every enemy. Cooldown 3.', target: 'allEnemies', mult: 0.4, purge: true, cooldown: 3 }),
    own({ name: 'Vespers of Flame', desc: 'LITANY: searing light on every enemy, then the Bell Peals at once.', target: 'allEnemies', mult: 0.9, pealNow: true, rite: true }),
  ],
  shines: ['Bell Tower', 'Hollow Bell Order Tower'],
}));

K('CC-W127', (own) => ({
  passive: sig('Deep Vigil', 'While she stands, every Sister takes 2% less damage per Tide.'),
  sig: { tideGuard: 0.02 },
  skills: [
    st('martyr', 'radiant-smite'),
    own({ name: 'Undertow Oath', desc: 'Draw attacks for 2 turns, Ward herself (-20%) and Regenerate 3% plus 1% per Tide a turn. Cooldown 2.', target: 'self', taunt: 2, ward: { pct: 0.2, turns: 2 }, regen: { pct: 0.03, turns: 2 }, byTide: { per: { regenPct: 0.01 } }, cooldown: 2 }),
    own({ name: 'Drowning Offering', desc: 'Lose 10% HP; Ebb: shield every ally for 5% of max HP per Tide spent. Cooldown 3.', target: 'allAllies', selfDmgPct: 0.1, spend: { kw: 'tide', per: { shieldPct: 0.05 } }, cooldown: 3 }),
    own({ name: 'Deep Vigil', desc: 'LITANY: hit every enemy, heal 50% of the damage, draw attacks for 2 turns, and the Tide rises by 2.', target: 'allEnemies', mult: 0.85, drain: 0.5, taunt: 2, gain: { tide: 2 }, rite: true }),
  ],
  shines: ['Hunts', 'Chapter Siege'],
}));

K('CC-W237', (own) => ({
  passive: sig('Bone-Deep Aim', 'Each Scar she holds lets her hits ignore 5% more Armor.'),
  sig: { scarPierce: 0.05 },
  skills: [
    own({ name: 'Bloodied Bolt', desc: 'Lose 5% HP; a heavy bolt on any rank through 20% of its Armor.', from: [2, 3, 4], target: 'enemy', selfDmgPct: 0.05, mult: 1.3, armorPierce: 0.2 }),
    st('arbalist', 'marking-shot'),
    own({ name: 'Briar Bolt', desc: 'A bolt that leaves any foe Bleeding for 3 turns. Cooldown 2.', target: 'enemy', mult: 1.0, bleed: { mult: 0.3, turns: 3 }, cooldown: 2 }),
    own({ name: 'Penitent Ballista', desc: 'LITANY: a crushing bolt through shields; spends her Scars for +8% each.', target: 'enemy', mult: 2.0, pierceShield: true, spend: { kw: 'scars', per: { multPct: 0.08 } }, rite: true }),
  ],
  shines: ['Flayed Saint Hunt', 'Thorn Covenant Order Tower'],
}));

/** Her four skills: her kit's, or her class's until she has one. */
export function kitSkills(id: string, classId: string): [SkillDef, SkillDef, SkillDef, SkillDef] {
  return KITS[id]?.skills ?? CLASS_SKILLS[classId];
}
