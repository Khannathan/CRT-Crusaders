export interface RelicDef {
  id: string;
  name: string;
  desc: string;
  atkPct?: number;
  hpPct?: number;
  startZeal?: number;
  vigilBonus?: number;
  /** Added to every crusader's crit chance. */
  critAdd?: number;
  /** Heals the party this share of max HP after each won fight. */
  fightHeal?: number;
}

/** Run-only relics offered at a reliquary. */
export const RELICS: RelicDef[] = [
  { id: 'knucklebone', name: "Saint's Knucklebone", desc: 'Party attack +15%.', atkPct: 0.15 },
  { id: 'holy-water', name: 'Vial of Holy Water', desc: 'Party max HP +20%.', hpPct: 0.2 },
  { id: 'iron-rosary', name: 'Iron Rosary', desc: 'Start every fight with 35 Zeal.', startZeal: 35 },
  { id: 'ember-candle', name: 'Ember Candle', desc: 'The Vigil candle burns 3 rounds longer.', vigilBonus: 3 },
  { id: 'bone-dice', name: 'Bone Dice', desc: 'Every crusader crits 10% more often.', critAdd: 0.1 },
  { id: 'pilgrims-flask', name: "Pilgrim's Flask", desc: 'Heal 10% after every won fight.', fightHeal: 0.1 },
  { id: 'reliquary-nail', name: 'Reliquary Nail', desc: 'Party attack and max HP +8%.', atkPct: 0.08, hpPct: 0.08 },
];
