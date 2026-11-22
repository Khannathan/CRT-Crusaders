/** A relic family: holding two or three of one family adds a synergy bonus (see FAMILY_BONUS). */
export type RelicFamily = 'burn' | 'bell' | 'martyr';

export interface RelicDef {
  id: string;
  name: string;
  desc: string;
  family?: RelicFamily;
  /** A burden from an event: a lasting trade-off, never offered at a reliquary. */
  burden?: boolean;
  atkPct?: number;
  hpPct?: number;
  startZeal?: number;
  vigilBonus?: number;
  /** Party armor bonus. */
  armorPct?: number;
  /** Added to every crusader's crit chance. */
  critAdd?: number;
  /** Heals the party this share of max HP after each won fight. */
  fightHeal?: number;
  // Battle hooks (summed into the Battle's mods; see combat.ts).
  /** Burns and poisons your Sisters apply deal this much more. */
  burnMult?: number;
  /** Detonations (Fan the Flames) deal this much more. */
  detonateMult?: number;
  /** Fights open with every foe Burning for 3 turns, at this share of the party's average attack each turn. */
  openingBurn?: number;
  /** Zeal at the start of every round. */
  roundZeal?: number;
  /** Zeal gains from attacks, support and wounds are this much larger. */
  zealMult?: number;
  /** Litanies hit this much harder. */
  riteMult?: number;
  /** A Sister below half HP hits this much harder. */
  lowHpAtk?: number;
  /** Each fallen Sister gives the rest this much more attack. */
  fallenAtk?: number;
  /** When a Sister falls, the rest heal this share of max HP. */
  fallHeal?: number;
  /** Tithes from fights are multiplied by (1 + this). Negative for a burden. */
  tithesMult?: number;
}

/** Run-only relics offered at a reliquary. */
export const RELICS: RelicDef[] = [
  // Unaligned
  { id: 'knucklebone', name: "Saint's Knucklebone", desc: 'Party attack +15%.', atkPct: 0.15 },
  { id: 'holy-water', name: 'Vial of Holy Water', desc: 'Party max HP +20%.', hpPct: 0.2 },
  { id: 'bone-dice', name: 'Bone Dice', desc: 'Every Sister crits 10% more often.', critAdd: 0.1 },
  { id: 'pilgrims-flask', name: "Pilgrim's Flask", desc: 'Heal 10% after every won fight.', fightHeal: 0.1 },
  { id: 'reliquary-nail', name: 'Reliquary Nail', desc: 'Party attack and max HP +8%.', atkPct: 0.08, hpPct: 0.08 },
  { id: 'pilgrim-staff', name: "Pilgrim's Staff", desc: 'Party armor and max HP +10%.', armorPct: 0.1, hpPct: 0.1 },
  { id: 'gilded-psalter', name: 'Gilded Psalter', desc: 'Party attack +10%. Start every fight with 15 Zeal.', atkPct: 0.1, startZeal: 15 },
  { id: 'saints-tooth', name: "Saint's Tooth", desc: 'Crits +8%, party attack +5%.', critAdd: 0.08, atkPct: 0.05 },
  { id: 'alms-purse', name: 'Bottomless Alms Purse', desc: 'Fights pay 30% more Tithes.', tithesMult: 0.3 },

  // Burn: fire and poison
  { id: 'censer-coal', name: 'Censer Coal', family: 'burn', desc: 'Burns and poisons your Sisters apply deal +25%.', burnMult: 0.25 },
  { id: 'pitch-reliquary', name: 'Pitch Reliquary', family: 'burn', desc: 'Every fight opens with all foes Burning for 3 turns.', openingBurn: 0.35 },
  { id: 'phoenix-quill', name: 'Phoenix Quill', family: 'burn', desc: 'Fan the Flames and other detonations deal +40%.', detonateMult: 0.4 },
  { id: 'thurible-chain', name: 'Thurible Chain', family: 'burn', desc: 'Burns +15%, party attack +5%.', burnMult: 0.15, atkPct: 0.05 },
  { id: 'ash-of-saint-wen', name: 'Ash of Saint Wen', family: 'burn', desc: 'Foes open Burning (lightly); burns +10%.', openingBurn: 0.2, burnMult: 0.1 },
  { id: 'branding-iron', name: 'Branding Iron', family: 'burn', desc: 'Crits +5%, burns +15%.', critAdd: 0.05, burnMult: 0.15 },
  { id: 'kindling-psalter', name: 'Kindling Psalter', family: 'burn', desc: 'Detonations +25%. Start fights with 10 Zeal.', detonateMult: 0.25, startZeal: 10 },

  // Bell: Zeal and Rites
  { id: 'iron-rosary', name: 'Iron Rosary', family: 'bell', desc: 'Start every fight with 35 Zeal.', startZeal: 35 },
  { id: 'ember-candle', name: 'Ember Candle', family: 'bell', desc: 'The Vigil candle burns 3 rounds longer.', vigilBonus: 3 },
  { id: 'sanctus-bell', name: 'Sanctus Hand-bell', family: 'bell', desc: '+6 Zeal at the start of every round.', roundZeal: 6 },
  { id: 'bell-rope', name: 'Frayed Bell-rope', family: 'bell', desc: 'All Zeal gains +25%.', zealMult: 0.25 },
  { id: 'cracked-clapper', name: 'Cracked Clapper', family: 'bell', desc: 'Litanies hit 30% harder.', riteMult: 0.3 },
  { id: 'tower-bronze', name: 'Tower Bronze', family: 'bell', desc: 'Party armor +15%, +3 Zeal each round.', armorPct: 0.15, roundZeal: 3 },
  { id: 'vesper-bell', name: 'Vesper Bell', family: 'bell', desc: 'Start fights with 25 Zeal; Zeal gains +10%.', startZeal: 25, zealMult: 0.1 },

  // Martyr: strength in suffering
  { id: 'flagellum', name: "Penitent's Flagellum", family: 'martyr', desc: 'A Sister below half HP hits 30% harder.', lowHpAtk: 0.3 },
  { id: 'martyrs-shroud', name: "Martyr's Shroud", family: 'martyr', desc: 'When a Sister falls, the rest heal 25%.', fallHeal: 0.25 },
  { id: 'bloodied-veil', name: 'Bloodied Veil', family: 'martyr', desc: 'Each fallen Sister gives the rest +20% attack.', fallenAtk: 0.2 },
  { id: 'nail-of-the-wound', name: 'Nail of the Wound', family: 'martyr', desc: 'Below half HP, +15% damage. Max HP +10%.', lowHpAtk: 0.15, hpPct: 0.1 },
  { id: 'reliquary-heart', name: 'Reliquary Heart', family: 'martyr', desc: 'Max HP +25%.', hpPct: 0.25 },
  { id: 'thorn-circlet', name: 'Thorn Circlet', family: 'martyr', desc: 'Below half HP, +20% damage. Crits +5%.', lowHpAtk: 0.2, critAdd: 0.05 },
  { id: 'last-candle', name: 'The Last Candle', family: 'martyr', desc: 'When a Sister falls, the rest heal 15% and gain +10% attack.', fallHeal: 0.15, fallenAtk: 0.1 },
];

/** Burdens: lasting trade-offs taken at events. Held like relics, never offered. */
export const BURDENS: RelicDef[] = [
  { id: 'oath-of-poverty', name: 'Oath of Poverty', burden: true, desc: 'Party attack +20%. Fights pay half the Tithes.', atkPct: 0.2, tithesMult: -0.5 },
  { id: 'blood-pact', name: 'Blood Pact', burden: true, desc: 'Party attack +25%. Max HP -15%.', atkPct: 0.25, hpPct: -0.15 },
  { id: 'vow-of-silence', name: 'Vow of Silence', burden: true, desc: 'Start fights with 40 Zeal. Zeal gains -30%.', startZeal: 40, zealMult: -0.3 },
  { id: 'heretics-brand', name: "Heretic's Brand", burden: true, desc: 'Crits +15%. Armor -20%.', critAdd: 0.15, armorPct: -0.2 },
  { id: 'gutted-candle', name: 'Gutted Candle', burden: true, desc: 'Litanies +40%. The Vigil candle is 2 rounds shorter.', riteMult: 0.4, vigilBonus: -2 },
];

export const FAMILY_NAME: Record<RelicFamily, string> = { burn: 'Burn', bell: 'Bell', martyr: 'Martyr' };
export const FAMILY_COLOR: Record<RelicFamily, number> = { burn: 0xff8a3d, bell: 0xd6c27a, martyr: 0xc0504d };

/** Synergy for holding 2 and 3 relics of a family. */
export const FAMILY_BONUS: Record<RelicFamily, [RelicDef, RelicDef]> = {
  burn: [
    { id: 'family:burn:2', name: 'Kindled (2 Burn)', desc: 'Burns +20%.', burnMult: 0.2 },
    { id: 'family:burn:3', name: 'Pyre (3 Burn)', desc: 'Burns +20% more, and foes open Burning.', burnMult: 0.2, openingBurn: 0.25 },
  ],
  bell: [
    { id: 'family:bell:2', name: 'Peal (2 Bell)', desc: '+3 Zeal each round.', roundZeal: 3 },
    { id: 'family:bell:3', name: 'Carillon (3 Bell)', desc: '+3 more Zeal each round. Litanies +25%.', roundZeal: 3, riteMult: 0.25 },
  ],
  martyr: [
    { id: 'family:martyr:2', name: 'Stigmata (2 Martyr)', desc: 'Below half HP, +15% damage.', lowHpAtk: 0.15 },
    { id: 'family:martyr:3', name: 'Passion (3 Martyr)', desc: 'When a Sister falls, the rest heal 20% and gain +15% attack.', fallHeal: 0.2, fallenAtk: 0.15 },
  ],
};

export const relicById = (id: string): RelicDef | undefined => RELICS.find((r) => r.id === id) ?? BURDENS.find((r) => r.id === id);
