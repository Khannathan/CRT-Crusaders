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
    tiers: [{ need: 2, desc: 'Armor +15%.', armorPct: 0.15 }, { need: 3, desc: 'Armor +15% more, max HP +8%.', armorPct: 0.15, hpPct: 0.08 }, { need: 4, desc: 'Max HP +12%. When a Sister falls, the rest heal 15%.', hpPct: 0.12, fallHeal: 0.15 }],
  },
  {
    id: 'ashen-mercy', name: 'Ashen Mercy', color: 0xc9c2b8, accent: 0x652b3b,
    creed: 'Mercy is a blade sheathed in ash.',
    lore: 'Hospitallers of the burned cities. They grant the last rites, and sometimes they grant the last blow.',
    tiers: [{ need: 2, desc: 'Heal 8% after every won fight.', fightHeal: 0.08 }, { need: 3, desc: 'Heal 7% more after fights, max HP +8%.', fightHeal: 0.07, hpPct: 0.08 }, { need: 4, desc: 'When a Sister falls, the rest heal 20%. Start with +10 Zeal.', fallHeal: 0.2, startZeal: 10 }],
  },
  {
    id: 'veiled-tribunal', name: 'Veiled Tribunal', color: 0x6e5a8c, accent: 0xc6baa4,
    creed: 'Every heart is guilty until it is weighed.',
    lore: 'Faceless judges who travel with a scale, a blade and no appeal.',
    tiers: [{ need: 2, desc: 'Crit chance +8%.', critAdd: 0.08 }, { need: 3, desc: 'Crit +6% more, attack +6%.', critAdd: 0.06, atkPct: 0.06 }, { need: 4, desc: 'Attack +10%. Rites hit 20% harder.', atkPct: 0.1, riteMult: 0.2 }],
  },
  {
    id: 'sepulcher-watch', name: 'Sepulcher Watch', color: 0xb8ab8a, accent: 0x383845,
    creed: 'The dead are ours to keep, and none shall wake them.',
    lore: 'Keepers of the holy ossuaries, who know every saint by the shape of her skull.',
    tiers: [{ need: 2, desc: 'Max HP +10%.', hpPct: 0.1 }, { need: 3, desc: 'Max HP +8% more, armor +8%.', hpPct: 0.08, armorPct: 0.08 }, { need: 4, desc: 'Max HP +10%. Below half HP, a Sister hits 20% harder.', hpPct: 0.1, lowHpAtk: 0.2 }],
  },
  {
    id: 'candle-choir', name: 'Candle Choir', color: 0xd6a15f, accent: 0x652b3b,
    creed: 'Sing, and the dark recoils.',
    lore: 'Their hymns have not stopped in three hundred years. When one voice fails, another takes the note.',
    tiers: [{ need: 2, desc: 'Start every fight with +10 Zeal.', startZeal: 10 }, { need: 3, desc: '+10 more starting Zeal, +3 Zeal every round.', startZeal: 10, roundZeal: 3 }, { need: 4, desc: 'Zeal gains +20%. Rites hit 15% harder.', zealMult: 0.2, riteMult: 0.15 }],
  },
  {
    id: 'thorn-covenant', name: 'Thorn Covenant', color: 0x5a7a3a, accent: 0x9a2a33,
    creed: 'Bleed, and be made holy.',
    lore: 'Flagellants who wear crowns of living briar and count their sins in scars.',
    tiers: [{ need: 2, desc: 'Attack +8%.', atkPct: 0.08 }, { need: 3, desc: 'Attack +7% more, crit +4%.', atkPct: 0.07, critAdd: 0.04 }, { need: 4, desc: 'Attack +10%. Below half HP, a Sister hits 15% harder.', atkPct: 0.1, lowHpAtk: 0.15 }],
  },
  {
    id: 'drowned-litany', name: 'Drowned Litany', color: 0x3f6e78, accent: 0xc6baa4,
    creed: 'What the water takes, it consecrates.',
    lore: 'Survivors of the flooded abbeys, baptised so deep they came back speaking with the drowned.',
    tiers: [{ need: 2, desc: 'Start every fight with +15 Zeal.', startZeal: 15 }, { need: 3, desc: 'The Vigil candle burns 2 rounds longer, +5 Zeal.', vigilBonus: 2, startZeal: 5 }, { need: 4, desc: '+4 Zeal every round, the candle 1 round longer.', roundZeal: 4, vigilBonus: 1 }],
  },
  {
    id: 'glass-confession', name: 'Glass Confession', color: 0x9cc3d0, accent: 0x6e5a8c,
    creed: 'Nothing is hidden from the mirror.',
    lore: 'Confessors who hear sins through a pane of black glass, and remember every one.',
    tiers: [{ need: 2, desc: 'Crit chance +8%.', critAdd: 0.08 }, { need: 3, desc: 'Attack +8%.', atkPct: 0.08 }, { need: 4, desc: 'Crit +6% more. Rites hit 25% harder.', critAdd: 0.06, riteMult: 0.25 }],
  },
  {
    id: 'red-pilgrimage', name: 'Red Pilgrimage', color: 0x9a2a33, accent: 0xd6a15f,
    creed: 'Every step toward the shrine is paid in blood.',
    lore: 'Pilgrims who walk barefoot to the holy places and leave a red road behind them.',
    tiers: [{ need: 2, desc: 'Heal 8% after every won fight.', fightHeal: 0.08 }, { need: 3, desc: 'Attack +8%.', atkPct: 0.08 }, { need: 4, desc: 'Attack +6%. Each fallen Sister gives the rest +15% attack.', atkPct: 0.06, fallenAtk: 0.15 }],
  },
  {
    id: 'hollow-bell', name: 'Hollow Bell', color: 0x8b6848, accent: 0xc6baa4,
    creed: 'When it tolls, the faithful rise.',
    lore: 'Bell-ringers of the cracked cathedral. Its toll can be heard by the living and the dead alike.',
    tiers: [{ need: 2, desc: 'The Vigil candle burns 2 rounds longer.', vigilBonus: 2 }, { need: 3, desc: 'Start every fight with +15 Zeal.', startZeal: 15 }, { need: 4, desc: '+3 Zeal every round, the candle 1 round longer.', roundZeal: 3, vigilBonus: 1 }],
  },
];

export const ORDERS: Record<string, OrderDef> = Object.fromEntries(ORDER_LIST.map((o) => [o.name, o]));

/**
 * The Order bonuses a party of these Orders turns on, as relic-like modifiers.
 * Each Order's bonus grows with every Sister of it in the party (2, 3, 4): a
 * full party of one Order gets all three steps, and a 2-2 split gets the first
 * step of two Orders.
 */
export function orderBonuses(orders: string[]): RelicDef[] {
  const count = new Map<string, number>();
  for (const o of orders) count.set(o, (count.get(o) ?? 0) + 1);
  const out: RelicDef[] = [];
  for (const [order, n] of count) {
    for (const tier of ORDERS[order]?.tiers ?? []) {
      if (n >= tier.need) out.push({ ...tier, id: `order:${order}:${tier.need}`, name: `${order} ${tier.need}` });
    }
  }
  return out;
}

/** One line per Order in the party: its count and what it gives now, and what the next Sister would add. */
export function orderLines(orders: string[]): { order: string; n: number; now: string[]; next?: string }[] {
  const count = new Map<string, number>();
  for (const o of orders) count.set(o, (count.get(o) ?? 0) + 1);
  return [...count]
    .sort((a, b) => b[1] - a[1])
    .map(([order, n]) => {
      const tiers = ORDERS[order]?.tiers ?? [];
      return { order, n, now: tiers.filter((t) => n >= t.need).map((t) => t.desc), next: tiers.find((t) => t.need > n)?.desc };
    });
}
