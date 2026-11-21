/** Who a skill can be aimed at, relative to the user. */
export type TargetKind = 'enemy' | 'ally' | 'self' | 'allEnemies' | 'allAllies';

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
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
  empower?: { pct: number; turns: number };
  /** Extra damage multiplier against an Accused target. */
  bonusIfAccused?: number;
  /** Extra damage multiplier while the user is under half HP. */
  lowHpBonus?: number;
  cleanse?: boolean;
  /** Spends a full Zeal meter. Usable from any rank. */
  rite?: boolean;
  /** Enemy-only: calls this enemy type into the last free rank. */
  summon?: string;
}

const any: number[] = [];

/** Two skills and a Rite per class. */
export const CLASS_SKILLS: Record<string, [SkillDef, SkillDef, SkillDef]> = {
  warsister: [
    { id: 'penitent-blow', name: 'Penitent Blow', desc: 'Heavy strike on rank 1-2. +40% while she is under half HP.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 1.25, lowHpBonus: 0.4 },
    { id: 'blood-for-zeal', name: 'Blood for Zeal', desc: 'Lose 10% HP. +15 Zeal and +25% attack for 2 turns.', from: any, target: 'self', selfDmgPct: 0.1, zealGain: 15, empower: { pct: 0.25, turns: 2 } },
    { id: 'martyrs-fury', name: "Martyr's Fury", desc: 'RITE: strike every enemy.', from: any, target: 'allEnemies', mult: 1.3, rite: true },
  ],
  hierophant: [
    { id: 'reliquary-bash', name: 'Reliquary Bash', desc: 'Strike rank 1-2 and draw enemy attacks for 2 turns.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 0.8, taunt: 2 },
    { id: 'sanctuary', name: 'Sanctuary', desc: 'Shield an ally for 30% of their max HP.', from: any, target: 'ally', shieldPct: 0.3 },
    { id: 'wall-of-saints', name: 'Wall of Saints', desc: 'RITE: shield every ally for 35% of max HP.', from: any, target: 'allAllies', shieldPct: 0.35, rite: true },
  ],
  inquisitor: [
    { id: 'accuse', name: 'Accuse', desc: 'Light hit on any rank. Accused takes +25% damage for 3 turns.', from: [1, 2, 3], target: 'enemy', mult: 0.6, accuse: 3 },
    { id: 'duelists-thrust', name: "Duelist's Thrust", desc: 'Precise strike on rank 1-3. +50% against the Accused.', from: [1, 2], target: 'enemy', reach: [1, 2, 3], mult: 1.2, bonusIfAccused: 0.5 },
    { id: 'verdict', name: 'Verdict', desc: 'RITE: crushing blow on any enemy. Doubled against the Accused.', from: any, target: 'enemy', mult: 2.5, bonusIfAccused: 1, rite: true },
  ],
  confessor: [
    { id: 'remedy', name: 'Remedy', desc: 'Heal one ally and cure poison.', from: any, target: 'ally', heal: 2.4, cleanse: true },
    { id: 'miasma', name: 'Miasma', desc: 'Poison an enemy on rank 1-3 for 3 turns.', from: any, target: 'enemy', reach: [1, 2, 3], mult: 0.4, poison: { mult: 0.6, turns: 3 } },
    { id: 'last-rites', name: 'Last Rites', desc: 'RITE: heal every ally 40% of max HP and cure poison.', from: any, target: 'allAllies', healPct: 0.4, cleanse: true, rite: true },
  ],
  censer: [
    { id: 'incense-cloud', name: 'Incense Cloud', desc: 'Smoke every enemy: small damage, -25% attack for 2 turns.', from: [2, 3, 4], target: 'allEnemies', mult: 0.35, weaken: { pct: 0.25, turns: 2 } },
    { id: 'burning-thurible', name: 'Burning Thurible', desc: 'Swing at rank 1-2 and set it smouldering for 2 turns.', from: [1, 2, 3], target: 'enemy', reach: [1, 2], mult: 0.9, poison: { mult: 0.45, turns: 2 } },
    { id: 'choking-smoke', name: 'Choking Smoke', desc: 'RITE: damage every enemy, -40% attack for 3 turns.', from: any, target: 'allEnemies', mult: 0.8, weaken: { pct: 0.4, turns: 3 }, rite: true },
  ],
  oracle: [
    { id: 'ash-bolt', name: 'Ash Bolt', desc: 'Heavy occult damage on any rank.', from: [3, 4], target: 'enemy', mult: 1.45 },
    { id: 'foresight', name: 'Foresight', desc: 'Hit any enemy and push its turn to the end.', from: any, target: 'enemy', mult: 0.5, delay: true },
    { id: 'omen-of-ash', name: 'Omen of Ash', desc: 'RITE: heavy damage on every enemy.', from: any, target: 'allEnemies', mult: 1.6, rite: true },
  ],
};

/** Always available: swap places with the ally in front (or behind, from rank 1). */
export const SHIFT_SKILL: SkillDef = { id: 'shift', name: 'Shift', desc: 'Swap places with the neighbouring ally.', from: any, target: 'self' };
