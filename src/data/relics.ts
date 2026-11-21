export interface RelicDef {
  id: string;
  name: string;
  desc: string;
  atkPct?: number;
  hpPct?: number;
  startZeal?: number;
  vigilBonus?: number;
}

/** Run-only relics offered at a reliquary. */
export const RELICS: RelicDef[] = [
  { id: 'knucklebone', name: "Saint's Knucklebone", desc: 'Party attack +15%.', atkPct: 0.15 },
  { id: 'holy-water', name: 'Vial of Holy Water', desc: 'Party max HP +20%.', hpPct: 0.2 },
  { id: 'iron-rosary', name: 'Iron Rosary', desc: 'Start every fight with 35 Zeal.', startZeal: 35 },
  { id: 'ember-candle', name: 'Ember Candle', desc: 'The Vigil candle burns 3 rounds longer.', vigilBonus: 3 },
];
