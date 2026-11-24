/** Who a skill can be aimed at, relative to the user. */
/**
 * Damage types. Physical damage is cut by Armor, Magic damage by Magic Resist.
 * Every Sister deals one or the other (her tag); Bleeding is Physical, burns
 * and poisons Magic. Foes are thick in one defence and thin in the other.
 */
export type DmgType = 'physical' | 'magic';
export const DMG_NAME: Record<DmgType, string> = { physical: 'Physical', magic: 'Magic' };
export const DMG_COLOR: Record<DmgType, number> = { physical: 0xd8b48a, magic: 0x9ab8f0 };

export type TargetKind = 'enemy' | 'ally' | 'self' | 'allEnemies' | 'allAllies';

/**
 * Ground a skill lays on the field for some rounds:
 * - hallowed: every Sister Regenerates 4% of max HP a round
 * - ash: each foe that falls heals every Sister 6% of max HP
 * - flood: foes take 10% more damage and act later
 * - thorns: each foe takes 15% of the caster's attack every round
 * - lantern: each round the Sister with the least HP goes on Overwatch
 */
export type GroundKind = 'hallowed' | 'ash' | 'flood' | 'thorns' | 'lantern';

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  /** Art id for its icon (skill-<icon>.png) when it differs from its id (a twisted staple keeps its staple's icon). */
  icon?: string;
  /** Damage type of its hit; unset = the user's own tag. */
  dmg?: DmgType;
  /** Hexed targets have this much less Magic Resist. */
  hex?: { pct: number; turns: number };
  /** Bleeding: Physical damage each turn that ignores armor, as a multiple of attack. */
  bleed?: { mult: number; turns: number };
  /** Stunned targets lose their next turn(s). Bosses resist. */
  stun?: number;
  /** Sundered targets have this much less armor. */
  sunder?: { pct: number; turns: number };
  /** Hasted targets act first next round, for this many rounds. */
  haste?: number;
  /** Regenerating targets heal this share of max HP at the start of each turn. */
  regen?: { pct: number; turns: number };
  /** Warded targets take this much less damage. */
  ward?: { pct: number; turns: number };
  /** Ranks (1 = front) the user must stand in. Empty = any. */
  from: number[];
  target: TargetKind;
  /** Opposing ranks a single-target attack can reach. Empty = any. Always includes 1. */
  reach?: number[];
  /** Damage as a multiple of attack. */
  mult?: number;
  /** Healing as a multiple of attack. */
  heal?: number;
  /** Healing as a share of each target's max HP (group heals). */
  healPct?: number;
  /** Shield worth this share of the target's max HP, lasting until the target's next turn. */
  shieldPct?: number;
  poison?: { mult: number; turns: number };
  weaken?: { pct: number; turns: number };
  /** Accused: takes 25% more damage for this many of its own turns. */
  accuse?: number;
  /** Enemies must target the user for this many of the user's turns. */
  taunt?: number;
  /** Pushes the target to the end of the turn order. */
  delay?: boolean;
  /** User loses this share of max HP. */
  selfDmgPct?: number;
  zealGain?: number;
  /** zealGain goes to every Sister, not just the user. */
  zealAll?: boolean;
  empower?: { pct: number; turns: number };
  /** Extra damage multiplier against an Accused target. */
  bonusIfAccused?: number;
  /** Extra damage multiplier while the user is under half HP. */
  lowHpBonus?: number;
  cleanse?: boolean;
  /** After use, unusable for this many of the user's own turns. */
  cooldown?: number;
  /** Extra damage multiplier against a Weakened target. */
  bonusIfWeak?: number;
  /** Extra damage multiplier against a target under 30% HP. */
  execute?: number;
  /** Poison adds onto poison already there instead of replacing it. */
  stackPoison?: boolean;
  /** Copies the target's poison or burn onto every other enemy. */
  spreadPoison?: boolean;
  /** Deals the target's remaining poison damage at once, times this, and clears it. */
  detonate?: number;
  /** Empowers the target (an ally) instead of the user. */
  empowerTarget?: boolean;
  /** Spends a full Zeal meter. Usable from any rank. */
  rite?: boolean;
  /** Enemy-only: calls this enemy type into the last free rank. */
  summon?: string;
  /** Enemy-only: how the AI picks a single target. Default: usually the most hurt. */
  aim?: 'weakest' | 'strongest' | 'back' | 'front' | 'random';
  /** Enemy-only: spends a turn charging first. Foresight (delay) interrupts the charge. */
  windup?: boolean;
  /** Enemy-only: drains this much party Zeal. */
  zealDrain?: number;
  /** Drags the target to rank 1. */
  pull?: boolean;
  /** The user moves this many ranks after the skill: negative steps forward, positive steps back. */
  move?: number;
  /** Knocks the target this many ranks back. */
  shove?: number;
  /** Enemy-only: relative chance the AI plans this skill. Default 1. */
  weight?: number;
  /** The user strikes back for this multiple of attack whenever she is hit, for this many turns. */
  counter?: { mult: number; turns: number };
  /** The user heals this share of the damage she deals. */
  drain?: number;
  /** Every living ally heals this share of the damage dealt. */
  lifelink?: number;
  /** Thorned targets return this share of damage taken to the attacker. */
  thorns?: { pct: number; turns: number };
  /** Raises each fallen ally with this share of max HP (group ally skills). */
  revive?: number;
  /** Raises the targets' critical chance. */
  critUp?: { pct: number; turns: number };
  /** Extra critical chance on this skill's hits. */
  critChance?: number;
  /** Drains this much boss Wrath. */
  wrathDrain?: number;
  /** Ignores this share of the target's Armor and Magic Resist. */
  armorPierce?: number;
  /** Hits go straight through shields. */
  pierceShield?: boolean;
  /** Strips the target's shield, Empower, Ward, Regenerate and Haste. */
  purge?: boolean;
  /** Extra damage multiplier against bosses. */
  bossBonus?: number;

  // ---- Zealot Initiative effects (see systems/combat.ts) ----
  /** Penance: each time the target acts it takes this share of its own attack, for `turns` of its turns. */
  penance?: { pct: number; turns: number };
  /** Brand: the next hit any foe of the target lands on it deals this much more, then the Brand is spent. */
  brand?: number;
  /** Silenced foes can use only their first, plainest skill, and a charge is broken. Bosses resist (1 turn less). */
  silence?: number;
  /** Rapture: the targets take no damage from foes for this many of their own turns. */
  rapture?: number;
  /** Mirror Images on the targets (up to 3): each one swallows a whole hit. */
  images?: number;
  /** The user gains this many Fervor (up to 5): each gives +6% damage for the rest of the fight. */
  fervor?: number;
  /** Stigmata: a Bleed whose every tick heals the user for half of it. */
  stigmata?: { mult: number; turns: number };
  /** Martyrdom: for this many of her turns the user takes `pct` of every blow aimed at another Sister. */
  martyrdom?: { pct: number; turns: number };
  /** Holy ground under the party for this many rounds (one ground at a time; see GROUND in combat.ts). */
  ground?: { kind: GroundKind; rounds: number };

  // ---- Order keywords (see systems/keywords.ts) ----
  /** Adds this much Guilt to the target (Veiled Tribunal). */
  guilt?: number;
  /** Gains for the party's or the user's Order counters. */
  gain?: Partial<Record<'remains' | 'tide' | 'stride' | 'scars' | 'toll', number>>;
  /**
   * Spends an Order counter for more effect: `n` points (all when unset), each
   * adding `per`. Guilt is spent from the target, Scars and Pursuit from the user,
   * Remains and Tide from the party.
   */
  spend?: {
    kw: 'guilt' | 'remains' | 'tide' | 'scars' | 'stride';
    n?: number;
    /** Needs `n` points: without them the skill can't be used, or becomes `orElse`. */
    need?: boolean;
    orElse?: Partial<SkillDef>;
    /** Added when a full 5 Guilt is spent. */
    full?: Partial<SkillDef>;
    per: { multPct?: number; multAdd?: number; shieldPct?: number; healPct?: number; zeal?: number; armorPierce?: number };
  };
  /** Confesses the target for this many of its turns. */
  confess?: number;
  /** Foretold: the target's Mercy line is this much higher. */
  foretell?: { pct: number; turns: number };
  /** Puts the target (an ally, or the user) on Overwatch: this reaction fires at the next enemy to act. */
  overwatch?: SkillDef;
  /** Starts a Hymn: a party aura that re-applies its effects every round. */
  hymn?: { name: string; rounds: number; allies?: Partial<SkillDef>; foes?: Partial<SkillDef> };
  /** The hit can't kill: the foe is left at its Mercy line or 1 HP. */
  cannotKill?: boolean;

  // ---- Sister kits (data/kits.ts) ----
  /** A single-target hit lands this many times. */
  hits?: number;
  /** Every Sister gains this much Zeal for each hit that lands. */
  zealPerHit?: number;
  /** When the hit kills: Zeal for the user, party Remains, extra tolls of the Bell. */
  onKill?: { zeal?: number; remains?: number; toll?: number };
  /** Grows with the Guilt of the most guilty foe (or the target's, for partyHealPct). */
  perGuilt?: { shieldPct?: number; empowerPct?: number; partyHealPct?: number };
  /** Every foe is Weakened by this much per Guilt it carries, for 2 turns. */
  guiltWeaken?: number;
  /** Grows with the Tide: `per` for each point, and `then` once the Tide is at least `at`. */
  byTide?: { per?: { multPct?: number; drain?: number; shieldPct?: number; critPct?: number; regenPct?: number }; at?: number; then?: Partial<SkillDef> };
  /** +this share of damage for each Pursuit the user holds (not spent). */
  perStride?: number;
  /** +this share of damage for each Scar the user holds (not spent). */
  perScar?: number;
  /** Gives each target this much Pursuit. */
  giveStride?: number;
  /** The whole party steps one rank: the front Sister goes to the back. */
  rotate?: boolean;
  /** Shields the Sister right behind the user for this share of her max HP. */
  shieldBehind?: number;
  /** Takes the target's Empower, Ward, Haste and shield for the party's strongest Sister. */
  steal?: boolean;
  /** Heals the most hurt Sister this share of max HP. */
  mendLowest?: number;
  /** Each target ally loses this share of max HP (Scars for the Martyrdom). */
  hurtAllies?: number;
  /** Summoned foes arrive Delayed for the rest of the fight. */
  lockSummons?: boolean;
  /** Summoned foes lose this many turns. */
  stunSummons?: number;
  /** Spends up to this many Remains: one hit at a random foe for each. */
  volley?: number;
  /** Group skills only land on these ranks. */
  onlyRanks?: number[];
  /** Puts every Sister on Overwatch with this reaction. */
  overwatchAll?: SkillDef;
  /** The Bell rings up to its next Peal at once. */
  pealNow?: boolean;
  /** The target's kind takes +5% damage from the party for the rest of the fight. */
  catalogue?: boolean;
  /** Pushes the fastest foe's turn to the end. */
  delayFastest?: boolean;
  /** Burn ticks on the target add 1 Guilt each. */
  burnGuilt?: boolean;
  /** A Mercy line of at least this for this skill's hits. */
  mercyLine?: number;
  /** Extra effects on targets that meet the condition. */
  cond?: { if: 'confessed' | 'underHalf' | 'burning' | 'accused' | 'boss' | 'overwatch' | 'hymn'; then: Partial<SkillDef> };
  /** Effects laid on every living foe, or every living Sister, as well. */
  alsoFoes?: Partial<SkillDef>;
  alsoAllies?: Partial<SkillDef>;
}

const any: number[] = [];

/** Three skills and a Litany per class. Combos: Weakened, Accused, poison and burns feed each other. */
export const CLASS_SKILLS: Record<string, [SkillDef, SkillDef, SkillDef, SkillDef]> = {
  warsister: [
    { id: 'penitent-blow', name: 'Penitent Blow', desc: 'Smite rank 1-2 hard and leave it Bleeding for 2 turns. +40% while she is under half HP.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 1.25, lowHpBonus: 0.4, bleed: { mult: 0.2, turns: 2 }},
    { id: 'blood-for-zeal', name: 'Blood for Zeal', desc: 'Sacrifice 10% HP. +30 of her own Zeal and +25% attack for 2 turns. Cooldown 2.', from: any, target: 'self', selfDmgPct: 0.1, zealGain: 30, empower: { pct: 0.25, turns: 2 }, cooldown: 2 },
    { id: 'flagellants-charge', name: "Flagellant's Charge", desc: 'Crash into rank 1-3 and charge a rank forward. +60% against the Weakened. Cooldown 2.', from: [1, 2], target: 'enemy', reach: [1, 2, 3], mult: 1.35, bonusIfWeak: 0.6, cooldown: 2, move: -1},
    { id: 'martyrs-fury', name: "Martyr's Fury", desc: 'LITANY: strike every enemy and leave them Bleeding for 2 turns.', from: any, target: 'allEnemies', mult: 0.95, rite: true, bleed: { mult: 0.25, turns: 2 }},
  ],
  hierophant: [
    { id: 'reliquary-bash', name: 'Reliquary Bash', desc: 'Strike rank 1-2, knock it a rank back and draw enemy attacks for 2 turns.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 0.8, taunt: 2, shove: 1},
    { id: 'sanctuary', name: 'Sanctuary', desc: 'Shield an ally for 30% of max HP and Ward her: -15% damage taken for 2 turns. Cooldown 1.', from: any, target: 'ally', shieldPct: 0.3, cooldown: 1 , ward: { pct: 0.15, turns: 2 }},
    { id: 'vigil-bell', name: 'Vigil Bell', desc: 'Shield every ally for 15% of max HP and cure poison, burns and bleeding. Cooldown 3.', from: any, target: 'allAllies', shieldPct: 0.15, cleanse: true, cooldown: 3 },
    { id: 'wall-of-saints', name: 'Wall of Saints', desc: 'LITANY: shield every ally for 25% of max HP and Ward them: -20% damage taken for 2 turns.', from: any, target: 'allAllies', shieldPct: 0.25, rite: true , ward: { pct: 0.2, turns: 2 }},
  ],
  inquisitor: [
    { id: 'accuse', name: 'Accuse', desc: 'Light hit on any rank. Accused takes +25% damage, and is Sundered (-25% armor), for 3 turns.', from: [1, 2, 3], target: 'enemy', mult: 0.6, accuse: 3, sunder: { pct: 0.25, turns: 3 }},
    { id: 'duelists-thrust', name: "Duelist's Thrust", desc: 'Lunge a rank forward into rank 1-3. +50% against the Accused.', from: [1, 2], target: 'enemy', reach: [1, 2, 3], mult: 1.2, bonusIfAccused: 0.5, move: -1},
    { id: 'sentence', name: 'Sentence', desc: 'Drag any foe to the front and strike it. Double damage under 30% HP. Cooldown 2.', from: [1, 2, 3], target: 'enemy', mult: 1.0, execute: 1, cooldown: 2, pull: true},
    { id: 'verdict', name: 'Verdict', desc: 'LITANY: crushing blow on any enemy, doubled against the Accused. Stuns it for a turn (not bosses).', from: any, target: 'enemy', mult: 1.8, bonusIfAccused: 1, rite: true, stun: 1},
  ],
  confessor: [
    { id: 'remedy', name: 'Remedy', desc: 'Heal one ally, cure poison, burns and bleeding, and let her Regenerate 3% a turn for 2 turns.', from: any, target: 'ally', heal: 2.4, cleanse: true , regen: { pct: 0.03, turns: 2 }},
    { id: 'miasma', name: 'Miasma', desc: 'Smite rank 1-3 and Poison it for 3 turns. Stacks on poison or burns.', from: any, target: 'enemy', reach: [1, 2, 3], mult: 0.4, poison: { mult: 0.6, turns: 3 }, stackPoison: true},
    { id: 'contagion', name: 'Contagion', desc: "Spread one enemy's poison or burn to every other enemy. Cooldown 3.", from: any, target: 'enemy', mult: 0.3, spreadPoison: true, cooldown: 3},
    { id: 'last-rites', name: 'Last Rites', desc: 'LITANY: heal every ally 30% of max HP, cure poison, burns and bleeding, and Regenerate 5% a turn for 3 turns.', from: any, target: 'allAllies', healPct: 0.3, cleanse: true, rite: true , regen: { pct: 0.05, turns: 3 }},
  ],
  censer: [
    { id: 'incense-cloud', name: 'Incense Cloud', desc: 'Smoke every enemy and fall back a rank: small damage, -25% attack for 2 turns.', from: [2, 3, 4], target: 'allEnemies', mult: 0.35, weaken: { pct: 0.25, turns: 2 }, move: 1},
    { id: 'burning-thurible', name: 'Burning Thurible', desc: 'Step a rank forward, swing at rank 1-2 and set it Burning for 2 turns. Stacks on poison.', from: [1, 2, 3], target: 'enemy', reach: [1, 2], mult: 0.9, poison: { mult: 0.45, turns: 2 }, stackPoison: true, move: -1},
    { id: 'fan-the-flames', name: 'Fan the Flames', desc: 'Ignite all the poison or burn on one enemy at once, for 1.5x. Cooldown 2.', from: any, target: 'enemy', mult: 0.3, detonate: 1.5, cooldown: 2},
    { id: 'choking-smoke', name: 'Choking Smoke', desc: 'LITANY: smite every enemy, -30% attack for 2 turns.', from: any, target: 'allEnemies', mult: 0.6, weaken: { pct: 0.3, turns: 2 }, rite: true},
  ],
  oracle: [
    { id: 'ash-bolt', name: 'Ash Bolt', desc: 'Smite any rank hard. The recoil throws her a rank back.', from: [3, 4], target: 'enemy', mult: 1.45, move: 1},
    { id: 'foresight', name: 'Foresight', desc: 'Smite any enemy, push its turn to the end and Hex it (-25% Magic Resist) for 2 turns. Breaks a charge. Cooldown 2.', from: any, target: 'enemy', mult: 0.5, delay: true, cooldown: 2, hex: { pct: 0.25, turns: 2 }},
    { id: 'grim-augury', name: 'Grim Augury', desc: 'Grant an ally +30% attack for 2 turns and Haste (acts first next round), and every Sister 10 Zeal. Cooldown 3.', from: any, target: 'ally', empower: { pct: 0.3, turns: 2 }, empowerTarget: true, zealGain: 10, zealAll: true, cooldown: 3 , haste: 1},
    { id: 'omen-of-ash', name: 'Omen of Ash', desc: 'LITANY: heavy damage on every enemy.', from: any, target: 'allEnemies', mult: 1.15, rite: true},
  ],
  sentinel: [
    { id: 'gravewarden-strike', name: 'Gravewarden Strike', desc: 'Strike rank 1-2 and draw enemy attacks for 2 turns. For 2 turns she strikes back at anyone who hits her.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 0.75, taunt: 2, counter: { mult: 0.5, turns: 2 } },
    { id: 'tomb-stance', name: 'Tomb Stance', desc: 'Brace: -30% damage taken for 2 turns and draw enemy attacks. Cooldown 2.', from: any, target: 'self', ward: { pct: 0.3, turns: 2 }, taunt: 2, cooldown: 2 },
    { id: 'funeral-bash', name: 'Funeral Bash', desc: 'Crack rank 1-2 with the tomb key: Sundered (-25% armor) for 2 turns and Stunned for a turn (not bosses). Cooldown 3.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 1.0, sunder: { pct: 0.25, turns: 2 }, stun: 1, cooldown: 3 },
    { id: 'sealed-sepulcher', name: 'Sealed Sepulcher', desc: 'LITANY: Ward every ally (-25% damage taken) for 2 turns. She draws every attack and strikes back hard for 2 turns.', from: any, target: 'allAllies', ward: { pct: 0.25, turns: 2 }, rite: true, taunt: 2, counter: { mult: 0.9, turns: 2 } },
  ],
  martyr: [
    { id: 'radiant-smite', name: 'Radiant Smite', desc: 'Strike rank 1-2 and heal for 35% of the damage dealt.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 1.1, drain: 0.35 },
    { id: 'intercession', name: 'Intercession', desc: 'Draw enemy attacks for 2 turns, Ward herself (-20% damage) and Regenerate 5% a turn. Cooldown 2.', from: any, target: 'self', taunt: 2, ward: { pct: 0.2, turns: 2 }, regen: { pct: 0.05, turns: 2 }, cooldown: 2 },
    { id: 'blood-oath', name: 'Blood Oath', desc: 'Sacrifice 12% HP. Every ally gains +20% attack for 2 turns. Cooldown 3.', from: any, target: 'allAllies', selfDmgPct: 0.12, empower: { pct: 0.2, turns: 2 }, empowerTarget: true, cooldown: 3 },
    { id: 'dawnbreak', name: 'Dawnbreak', desc: 'LITANY: burn every enemy with light, heal for 50% of the damage dealt and draw attacks for 2 turns.', from: any, target: 'allEnemies', mult: 0.8, drain: 0.5, rite: true, taunt: 2 },
  ],
  hospitaller: [
    { id: 'chalice-draught', name: 'Chalice Draught', desc: 'Heal one ally, shield her for 15% of max HP and cure poison, burns and bleeding.', from: any, target: 'ally', heal: 2.3, shieldPct: 0.15, cleanse: true },
    { id: 'tending-hands', name: 'Tending Hands', desc: 'Heal every ally 6% of max HP, then Regenerate 6% a turn for 3 turns. Cooldown 2.', from: any, target: 'allAllies', healPct: 0.06, regen: { pct: 0.06, turns: 3 }, cooldown: 2 },
    { id: 'lance-of-mercy', name: 'Lance of Mercy', desc: 'Strike rank 1-3 with the hospital lance: -25% attack for 2 turns.', from: [1, 2, 3], target: 'enemy', reach: [1, 2, 3], mult: 1.2, weaken: { pct: 0.25, turns: 2 } },
    { id: 'grail-of-return', name: 'Grail of Return', desc: 'LITANY: raise every fallen Sister with 35% HP, heal every ally 30% of max HP and Regenerate 4% a turn for 2 turns.', from: any, target: 'allAllies', healPct: 0.3, revive: 0.35, regen: { pct: 0.04, turns: 2 }, rite: true },
  ],
  abbess: [
    { id: 'thorned-rebuke', name: 'Thorned Rebuke', desc: 'Lash rank 1-3, leaving it Bleeding for 2 turns. Every Sister heals 45% of the damage dealt.', from: any, target: 'enemy', reach: [1, 2, 3], mult: 1.25, bleed: { mult: 0.2, turns: 2 }, lifelink: 0.45 },
    { id: 'briar-mantle', name: 'Briar Mantle', desc: 'Heal every ally 5% of max HP and dress them in thorns: foes that strike them take 35% back, for 2 turns. Cooldown 2.', from: any, target: 'allAllies', healPct: 0.05, thorns: { pct: 0.35, turns: 2 }, cooldown: 2 },
    { id: 'pruning', name: 'Pruning', desc: 'Heal one ally, cure poison, burns and bleeding, and let her Regenerate 3% a turn for 2 turns.', from: any, target: 'ally', heal: 2.6, cleanse: true, regen: { pct: 0.03, turns: 2 } },
    { id: 'garden-of-thorns', name: 'Garden of Thorns', desc: 'LITANY: rake every enemy, leaving them Bleeding for 2 turns. Every Sister heals 40% of the damage dealt.', from: any, target: 'allEnemies', mult: 0.8, bleed: { mult: 0.25, turns: 2 }, lifelink: 0.4, rite: true },
  ],
  cantor: [
    { id: 'hymn-of-iron', name: 'Hymn of Iron', desc: 'Every ally gains +30% attack for 2 turns. Cooldown 2.', from: any, target: 'allAllies', empower: { pct: 0.3, turns: 2 }, empowerTarget: true, cooldown: 2 },
    { id: 'keening-note', name: 'Keening Note', desc: 'Smite any enemy: Sundered (-20% armor) and Hexed (-20% Magic Resist) for 2 turns.', from: any, target: 'enemy', mult: 1.35, sunder: { pct: 0.2, turns: 2 }, hex: { pct: 0.2, turns: 2 } },
    { id: 'psalm-of-blades', name: 'Psalm of Blades', desc: 'Every ally gains +20% critical chance for 2 turns, and every Sister 8 Zeal. Cooldown 3.', from: any, target: 'allAllies', critUp: { pct: 0.2, turns: 2 }, zealGain: 8, zealAll: true, cooldown: 3 },
    { id: 'requiem-chorus', name: 'Requiem Chorus', desc: 'LITANY: every ally gains +30% attack and +25% critical chance for 2 turns, and Haste.', from: any, target: 'allAllies', empower: { pct: 0.3, turns: 2 }, empowerTarget: true, critUp: { pct: 0.25, turns: 2 }, haste: 1, rite: true },
  ],
  adjudicator: [
    { id: 'reflected-sentence', name: 'Reflected Sentence', desc: 'Smite any enemy: -25% attack for 2 turns. Drains 15 Wrath from a boss.', from: any, target: 'enemy', mult: 0.7, weaken: { pct: 0.25, turns: 2 }, wrathDrain: 15 },
    { id: 'mirror-ward', name: 'Mirror Ward', desc: 'Ward an ally (-25% damage) and give her thorns (30% back) for 2 turns. Cooldown 2.', from: any, target: 'ally', ward: { pct: 0.25, turns: 2 }, thorns: { pct: 0.3, turns: 2 }, cooldown: 2 },
    { id: 'censure', name: 'Censure', desc: 'Every enemy: -20% attack and Sundered (-15% armor) for 2 turns. Cooldown 3.', from: any, target: 'allEnemies', mult: 0.3, weaken: { pct: 0.2, turns: 2 }, sunder: { pct: 0.15, turns: 2 }, cooldown: 3 },
    { id: 'final-judgment', name: 'Final Judgment', desc: 'LITANY: every enemy is Weakened (-30% attack) for 2 turns and loses 40 Wrath.', from: any, target: 'allEnemies', mult: 0.6, weaken: { pct: 0.3, turns: 2 }, wrathDrain: 40, rite: true },
  ],
  veilblade: [
    { id: 'veil-strike', name: 'Veil Strike', desc: 'Strike any rank, with +25% critical chance.', from: [1, 2, 3], target: 'enemy', mult: 1.05, critChance: 0.25 },
    { id: 'shadowstep', name: 'Shadowstep', desc: 'Haste herself, +20% attack and +30% critical chance for 2 turns. Cooldown 2.', from: any, target: 'self', haste: 1, empower: { pct: 0.2, turns: 2 }, critUp: { pct: 0.3, turns: 2 }, cooldown: 2 },
    { id: 'hamstring', name: 'Hamstring', desc: 'Cut any foe: Bleeding for 3 turns and its turn pushed to the end. Cooldown 2.', from: [1, 2, 3], target: 'enemy', mult: 0.7, bleed: { mult: 0.3, turns: 3 }, delay: true, cooldown: 2 },
    { id: 'thousand-cuts', name: 'Thousand Cuts', desc: 'LITANY: savage blow on any enemy, +50% critical chance, double damage under 30% HP.', from: any, target: 'enemy', mult: 1.9, critChance: 0.5, execute: 1, rite: true },
  ],
  arbalist: [
    { id: 'blessed-bolt', name: 'Blessed Bolt', desc: 'A heavy bolt on any rank that ignores 30% of its Armor.', from: [2, 3, 4], target: 'enemy', mult: 1.25, armorPierce: 0.3 },
    { id: 'marking-shot', name: 'Marking Shot', desc: 'Light bolt that Accuses any foe (+25% damage taken) for 2 turns. Cooldown 1.', from: any, target: 'enemy', mult: 0.6, accuse: 2, cooldown: 1 },
    { id: 'shieldbreaker', name: 'Shieldbreaker', desc: 'A bolt through any shield: Sundered (-30% armor) for 2 turns. Cooldown 2.', from: any, target: 'enemy', mult: 1.0, pierceShield: true, sunder: { pct: 0.3, turns: 2 }, cooldown: 2 },
    { id: 'saints-ballista', name: "Saint's Ballista", desc: 'LITANY: a crushing bolt on any enemy, through shields and half its Armor.', from: any, target: 'enemy', mult: 2.3, armorPierce: 0.5, pierceShield: true, rite: true },
  ],
  exorcist: [
    { id: 'lantern-flare', name: 'Lantern Flare', desc: 'Smite any enemy and strip its shield and blessings. +30% against bosses.', from: any, target: 'enemy', mult: 0.9, purge: true, bossBonus: 0.3 },
    { id: 'witchfire', name: 'Witchfire', desc: 'Set any enemy Burning for 3 turns. Stacks on poison or burns.', from: any, target: 'enemy', mult: 0.45, poison: { mult: 0.42, turns: 3 }, stackPoison: true },
    { id: 'rite-of-expulsion', name: 'Rite of Expulsion', desc: 'Strip the shield and blessings of every enemy. Cooldown 3.', from: any, target: 'allEnemies', mult: 0.4, purge: true, cooldown: 3 },
    { id: 'banishment', name: 'Banishment', desc: 'LITANY: searing light on any enemy, stripping its blessings. +60% against bosses.', from: any, target: 'enemy', mult: 1.6, purge: true, bossBonus: 0.6, rite: true },
  ],
};

/**
 * Step: once a turn, for free, swap places with the Sister next to you (in front
 * or behind), then still act. It is not a skill turn; the battle screen handles it.
 */
export const SHIFT_SKILL: SkillDef = { id: 'shift', name: 'Step', desc: 'Free, once a turn: swap with the Sister beside you, then still act. Tap Step, then the Sister to trade places with.', from: any, target: 'self' };

/** A skill's description without its closing "Cooldown N.", for places that already show the cooldown as a tag. */
export const descNoCooldown = (desc: string) => desc.replace(/\s*Cooldown \d+\.\s*$/, '');
