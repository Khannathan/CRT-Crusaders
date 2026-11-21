import type { RelicDef } from './relics';

/** A party bonus tier: needs `need` Sisters of the Order in the party. Uses the relic fields. */
export interface OrderTier extends Omit<RelicDef, 'id' | 'name'> {
  need: number;
}

export interface OrderDef {
  id: string;
  name: string;
  /** One line of creed, shown on its banner. */
  creed: string;
  /** What the Order is known for, a sentence for the banner. */
  lore: string;
  /** Banner colours: main and accent. */
  color: number;
  accent: number;
  tiers: OrderTier[];
}

/**
 * The ten Orders. Each has a banner at the Sealed Altar and a party bonus for
 * fielding its Sisters together. Sigil art: src/assets/ui/sigil-<id>.png; banner
 * art: src/assets/ui/banner-<id>.webp. Both fall back to drawn stand-ins.
 */
export const ORDER_LIST: OrderDef[] = [
  {
    id: 'iron-vigil', name: 'Iron Vigil', color: 0x8a8f99, accent: 0xd6a15f,
    creed: 'We do not sleep while the dark still breathes.',
    lore: 'Sentinels of the outer walls, sworn to watch until their bones rust in their armour.',
    tiers: [{ need: 2, desc: 'Party armor +15%.', armorPct: 0.15 }, { need: 3, desc: 'Party max HP +10%.', hpPct: 0.1 }],
  },
  {
    id: 'ashen-mercy', name: 'Ashen Mercy', color: 0xc9c2b8, accent: 0x652b3b,
    creed: 'Mercy is a blade sheathed in ash.',
    lore: 'Hospitallers of the burned cities. They grant the last rites, and sometimes they grant the last blow.',
    tiers: [{ need: 2, desc: 'Heal 8% after every won fight.', fightHeal: 0.08 }, { need: 3, desc: 'Start every fight with +10 Zeal.', startZeal: 10 }],
  },
  {
    id: 'veiled-tribunal', name: 'Veiled Tribunal', color: 0x6e5a8c, accent: 0xc6baa4,
    creed: 'Every heart is guilty until it is weighed.',
    lore: 'Faceless judges who travel with a scale, a blade and no appeal.',
    tiers: [{ need: 2, desc: 'Crit chance +8%.', critAdd: 0.08 }, { need: 3, desc: 'Party attack +10%.', atkPct: 0.1 }],
  },
  {
    id: 'sepulcher-watch', name: 'Sepulcher Watch', color: 0xb8ab8a, accent: 0x383845,
    creed: 'The dead are ours to keep, and none shall wake them.',
    lore: 'Keepers of the holy ossuaries, who know every saint by the shape of her skull.',
    tiers: [{ need: 2, desc: 'Party max HP +10%.', hpPct: 0.1 }, { need: 3, desc: 'Party armor +10%.', armorPct: 0.1 }],
  },
  {
    id: 'candle-choir', name: 'Candle Choir', color: 0xd6a15f, accent: 0x652b3b,
    creed: 'Sing, and the dark recoils.',
    lore: 'Their hymns have not stopped in three hundred years. When one voice fails, another takes the note.',
    tiers: [{ need: 2, desc: 'Start every fight with +10 Zeal.', startZeal: 10 }, { need: 3, desc: 'Start with +15 more Zeal.', startZeal: 15 }],
  },
  {
    id: 'thorn-covenant', name: 'Thorn Covenant', color: 0x5a7a3a, accent: 0x9a2a33,
    creed: 'Bleed, and be made holy.',
    lore: 'Flagellants who wear crowns of living briar and count their sins in scars.',
    tiers: [{ need: 2, desc: 'Party attack +8%.', atkPct: 0.08 }, { need: 3, desc: 'Crit chance +8%.', critAdd: 0.08 }],
  },
  {
    id: 'drowned-litany', name: 'Drowned Litany', color: 0x3f6e78, accent: 0xc6baa4,
    creed: 'What the water takes, it consecrates.',
    lore: 'Survivors of the flooded abbeys, baptised so deep they came back speaking with the drowned.',
    tiers: [{ need: 2, desc: 'Start every fight with +15 Zeal.', startZeal: 15 }, { need: 3, desc: 'The Vigil candle burns 2 rounds longer.', vigilBonus: 2 }],
  },
  {
    id: 'glass-confession', name: 'Glass Confession', color: 0x9cc3d0, accent: 0x6e5a8c,
    creed: 'Nothing is hidden from the mirror.',
    lore: 'Confessors who hear sins through a pane of black glass, and remember every one.',
    tiers: [{ need: 2, desc: 'Crit chance +8%.', critAdd: 0.08 }, { need: 3, desc: 'Party attack +12%.', atkPct: 0.12 }],
  },
  {
    id: 'red-pilgrimage', name: 'Red Pilgrimage', color: 0x9a2a33, accent: 0xd6a15f,
    creed: 'Every step toward the shrine is paid in blood.',
    lore: 'Pilgrims who walk barefoot to the holy places and leave a red road behind them.',
    tiers: [{ need: 2, desc: 'Heal 8% after every won fight.', fightHeal: 0.08 }, { need: 3, desc: 'Party attack +10%.', atkPct: 0.1 }],
  },
  {
    id: 'hollow-bell', name: 'Hollow Bell', color: 0x8b6848, accent: 0xc6baa4,
    creed: 'When it tolls, the faithful rise.',
    lore: 'Bell-ringers of the cracked cathedral. Its toll can be heard by the living and the dead alike.',
    tiers: [{ need: 2, desc: 'The Vigil candle burns 2 rounds longer.', vigilBonus: 2 }, { need: 3, desc: 'Start every fight with +15 Zeal.', startZeal: 15 }],
  },
];

export const ORDERS: Record<string, OrderDef> = Object.fromEntries(ORDER_LIST.map((o) => [o.name, o]));

/** The order bonuses a party of these orders turns on, as relic-like modifiers. */
export function orderBonuses(orders: string[]): RelicDef[] {
  const count = new Map<string, number>();
  for (const o of orders) count.set(o, (count.get(o) ?? 0) + 1);
  const out: RelicDef[] = [];
  for (const [order, n] of count) {
    for (const tier of ORDERS[order]?.tiers ?? []) {
      if (n >= tier.need) out.push({ ...tier, id: `order:${order}:${tier.need}`, name: `${order} (${tier.need})` });
    }
  }
  return out;
}
