import type { RelicDef } from './relics';

/** A party bonus tier: needs `need` Sisters of the Order in the party. Uses the relic fields. */
export interface OrderTier extends Omit<RelicDef, 'id' | 'name'> {
  need: number;
}

export interface OrderDef {
  id: string;
  name: string;
  /** One line of creed, shown in the Order Book. */
  creed: string;
  /** Who they are and what their god demands of them: the Orders are not good. */
  lore: string;
  /** The Order it feuds with (by name). Every Order has one sworn rival, and the pairs match. */
  rival: string;
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
    creed: 'The wall stands. Let the outside burn.',
    lore: 'Sentinels who never sleep and never yield a wall. When the dark nears a village beyond it, they bar the gate and let it die.',
    rival: 'Drowned Litany',
    tiers: [{ need: 2, desc: 'Armor +15%.', armorPct: 0.15 }, { need: 3, desc: 'Armor +15% more, max HP +8%.', armorPct: 0.15, hpPct: 0.08 }, { need: 4, desc: 'Max HP +12%. When a Sister falls, the rest heal 15%.', hpPct: 0.12, fallHeal: 0.15 }],
  },
  {
    id: 'ashen-mercy', name: 'Ashen Mercy', color: 0xc9c2b8, accent: 0x652b3b,
    creed: 'All mercy ends in fire.',
    lore: 'Hospitallers of the burned cities. The sick, the cursed and the doubtful are spared in the flames, and plague villages burn with the living inside.',
    rival: 'Sepulcher Watch',
    tiers: [{ need: 2, desc: 'Heal 8% after every won fight.', fightHeal: 0.08 }, { need: 3, desc: 'Heal 7% more after fights, max HP +8%.', fightHeal: 0.07, hpPct: 0.08 }, { need: 4, desc: 'When a Sister falls, the rest heal 20%. Start with +10 Zeal.', fallHeal: 0.2, startZeal: 10 }],
  },
  {
    id: 'veiled-tribunal', name: 'Veiled Tribunal', color: 0x6e5a8c, accent: 0xc6baa4,
    creed: 'Guilty by decree. Weighed after.',
    lore: 'Faceless judges with a scale, a blade and no appeal. They have never acquitted a soul, and a Sister who hesitates is the next one weighed.',
    rival: 'Crimson Inquisition',
    tiers: [{ need: 2, desc: 'Crit chance +8%.', critAdd: 0.08 }, { need: 3, desc: 'Crit +6% more, attack +6%.', critAdd: 0.06, atkPct: 0.06 }, { need: 4, desc: 'Attack +10%. Litanies hit 20% harder.', atkPct: 0.1, riteMult: 0.2 }],
  },
  {
    id: 'sepulcher-watch', name: 'Sepulcher Watch', color: 0xb8ab8a, accent: 0x383845,
    creed: 'The dead are ours. So are you.',
    lore: 'Keepers of the ossuaries. The dead belong to their god alone; mourners who will not let go are buried with them.',
    rival: 'Ashen Mercy',
    tiers: [{ need: 2, desc: 'Max HP +10%.', hpPct: 0.1 }, { need: 3, desc: 'Max HP +8% more, armor +8%.', hpPct: 0.08, armorPct: 0.08 }, { need: 4, desc: 'Max HP +10%. Below half HP, a Sister hits 20% harder.', hpPct: 0.1, lowHpAtk: 0.2 }],
  },
  {
    id: 'candle-choir', name: 'Choir of the Pyre', color: 0xd6a15f, accent: 0x652b3b,
    creed: 'The hymn never stops. Feed it.',
    lore: 'Their hymn has burned for three hundred years. A singer who falters is fed to the pyre, and whole congregations burn as an offering of song.',
    rival: 'Hallowed Belfry',
    tiers: [{ need: 2, desc: 'Start every fight with +10 Zeal.', startZeal: 10 }, { need: 3, desc: '+10 more starting Zeal, +3 Zeal every round.', startZeal: 10, roundZeal: 3 }, { need: 4, desc: 'Zeal gains +20%. Litanies hit 15% harder.', zealMult: 0.2, riteMult: 0.15 }],
  },
  {
    id: 'thorn-covenant', name: 'Verdant Martyrdom', color: 0x5a7a3a, accent: 0x9a2a33,
    creed: 'Feed the roots. Your blood or theirs.',
    lore: 'Martyrs crowned in living briar. They bleed for the garden every day, and at harvest the unwilling are bound into the hedges to feed it.',
    rival: 'Confessors of Glass',
    tiers: [{ need: 2, desc: 'Attack +8%.', atkPct: 0.08 }, { need: 3, desc: 'Attack +7% more, crit +4%.', atkPct: 0.07, critAdd: 0.04 }, { need: 4, desc: 'Attack +10%. Below half HP, a Sister hits 15% harder.', atkPct: 0.1, lowHpAtk: 0.15 }],
  },
  {
    id: 'drowned-litany', name: 'Drowned Litany', color: 0x3f6e78, accent: 0xc6baa4,
    creed: 'What the water takes, it consecrates.',
    lore: 'Survivors of the flooded abbeys. They drown the doubtful to baptise them, and sink whole villages that stray.',
    rival: 'Iron Vigil',
    tiers: [{ need: 2, desc: 'Start every fight with +15 Zeal.', startZeal: 15 }, { need: 3, desc: 'The Vigil candle burns 2 rounds longer, +5 Zeal.', vigilBonus: 2, startZeal: 5 }, { need: 4, desc: '+4 Zeal every round, the candle 1 round longer.', roundZeal: 4, vigilBonus: 1 }],
  },
  {
    id: 'glass-confession', name: 'Confessors of Glass', color: 0x9cc3d0, accent: 0x6e5a8c,
    creed: 'Every sin shows. Every sinner shatters.',
    lore: 'Faceless confessors of living glass. Their god took their faces for sight, and any soul whose reflection shows sin is broken, Sisters too.',
    rival: 'Verdant Martyrdom',
    tiers: [{ need: 2, desc: 'Crit chance +8%.', critAdd: 0.08 }, { need: 3, desc: 'Attack +8%.', atkPct: 0.08 }, { need: 4, desc: 'Crit +6% more. Litanies hit 25% harder.', critAdd: 0.06, riteMult: 0.25 }],
  },
  {
    id: 'red-pilgrimage', name: 'Crimson Inquisition', color: 0x9a2a33, accent: 0xd6a15f,
    creed: 'Confess, and burn clean.',
    lore: 'Inquisitors with writs and branding irons. Their god wants a confession every day, and when none comes, they brand one out of the innocent.',
    rival: 'Veiled Tribunal',
    tiers: [{ need: 2, desc: 'Heal 8% after every won fight.', fightHeal: 0.08 }, { need: 3, desc: 'Attack +8%.', atkPct: 0.08 }, { need: 4, desc: 'Attack +6%. Each fallen Sister gives the rest +15% attack.', atkPct: 0.06, fallenAtk: 0.15 }],
  },
  {
    id: 'hollow-bell', name: 'Hallowed Belfry', color: 0x8b6848, accent: 0xc6baa4,
    creed: 'Every toll is paid in blood.',
    lore: 'Ringers of the hallowed tower. Each toll costs a life, and the bell-ropes are braided from the hair of the punished.',
    rival: 'Choir of the Pyre',
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
