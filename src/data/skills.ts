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

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
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
}

const any: number[] = [];

/** Three skills and a Rite per class. Combos: Weakened, Accused, poison and burns feed each other. */
export const CLASS_SKILLS: Record<string, [SkillDef, SkillDef, SkillDef, SkillDef]> = {
  warsister: [
    { id: 'penitent-blow', name: 'Penitent Blow', desc: 'Heavy strike on rank 1-2 that leaves it Bleeding for 2 turns. +40% while she is under half HP.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 1.25, lowHpBonus: 0.4, bleed: { mult: 0.2, turns: 2 }},
    { id: 'blood-for-zeal', name: 'Blood for Zeal', desc: 'Lose 10% HP. +30 of her own Zeal and +25% attack for 2 turns. Cooldown 2.', from: any, target: 'self', selfDmgPct: 0.1, zealGain: 30, empower: { pct: 0.25, turns: 2 }, cooldown: 2 },
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
    { id: 'miasma', name: 'Miasma', desc: 'Hit on rank 1-3 that Poisons for 3 turns. Stacks on poison or burns.', from: any, target: 'enemy', reach: [1, 2, 3], mult: 0.4, poison: { mult: 0.6, turns: 3 }, stackPoison: true},
    { id: 'contagion', name: 'Contagion', desc: "Spread one enemy's poison or burn to every other enemy. Cooldown 3.", from: any, target: 'enemy', mult: 0.3, spreadPoison: true, cooldown: 3},
    { id: 'last-rites', name: 'Last Rites', desc: 'LITANY: heal every ally 30% of max HP, cure poison, burns and bleeding, and Regenerate 5% a turn for 3 turns.', from: any, target: 'allAllies', healPct: 0.3, cleanse: true, rite: true , regen: { pct: 0.05, turns: 3 }},
  ],
  censer: [
    { id: 'incense-cloud', name: 'Incense Cloud', desc: 'Smoke every enemy and fall back a rank: small damage, -25% attack for 2 turns.', from: [2, 3, 4], target: 'allEnemies', mult: 0.35, weaken: { pct: 0.25, turns: 2 }, move: 1},
    { id: 'burning-thurible', name: 'Burning Thurible', desc: 'Step a rank forward, swing at rank 1-2 and set it Burning for 2 turns. Stacks on poison.', from: [1, 2, 3], target: 'enemy', reach: [1, 2], mult: 0.9, poison: { mult: 0.45, turns: 2 }, stackPoison: true, move: -1},
    { id: 'fan-the-flames', name: 'Fan the Flames', desc: 'Ignite all the poison or burn on one enemy at once, for 1.5x. Cooldown 2.', from: any, target: 'enemy', mult: 0.3, detonate: 1.5, cooldown: 2},
    { id: 'choking-smoke', name: 'Choking Smoke', desc: 'LITANY: damage every enemy, -30% attack for 2 turns.', from: any, target: 'allEnemies', mult: 0.6, weaken: { pct: 0.3, turns: 2 }, rite: true},
  ],
  oracle: [
    { id: 'ash-bolt', name: 'Ash Bolt', desc: 'Heavy damage on any rank. The recoil throws her a rank back.', from: [3, 4], target: 'enemy', mult: 1.45, move: 1},
    { id: 'foresight', name: 'Foresight', desc: 'Hit any enemy, push its turn to the end and Hex it (-25% Magic Resist) for 2 turns. Breaks a charge. Cooldown 2.', from: any, target: 'enemy', mult: 0.5, delay: true, cooldown: 2, hex: { pct: 0.25, turns: 2 }},
    { id: 'grim-augury', name: 'Grim Augury', desc: 'Grant an ally +30% attack for 2 turns and Haste (acts first next round), and every Sister 10 Zeal. Cooldown 3.', from: any, target: 'ally', empower: { pct: 0.3, turns: 2 }, empowerTarget: true, zealGain: 10, zealAll: true, cooldown: 3 , haste: 1},
    { id: 'omen-of-ash', name: 'Omen of Ash', desc: 'LITANY: heavy damage on every enemy.', from: any, target: 'allEnemies', mult: 1.15, rite: true},
  ],
};

/**
 * Step: once a turn, for free, swap places with the Sister next to you (in front
 * or behind), then still act. It is not a skill turn; the battle screen handles it.
 */
export const SHIFT_SKILL: SkillDef = { id: 'shift', name: 'Step', desc: 'Free, once a turn: swap with the Sister beside you, then still act. Tap Step, then the Sister to trade places with.', from: any, target: 'self' };
