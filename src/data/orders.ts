import type { RelicDef } from './relics';

/**
 * Order bonuses: field crusaders of the same order together for a party bonus.
 * Each tier needs `need` members in the party. Bonuses use the relic fields.
 * Order names come from the roster and are placeholders until the name library.
 */
export interface OrderTier extends Omit<RelicDef, 'id' | 'name'> {
  need: number;
}

export const ORDERS: Record<string, OrderTier[]> = {
  'Sepulcher Watch': [{ need: 2, desc: 'Party max HP +10%.', hpPct: 0.1 }],
  'Drowned Litany': [{ need: 2, desc: 'Start every fight with +15 Zeal.', startZeal: 15 }],
  'Glass Confession': [
    { need: 2, desc: 'Crit chance +8%.', critAdd: 0.08 },
    { need: 3, desc: 'Party attack +12%.', atkPct: 0.12 },
  ],
  'Hollow Bell': [{ need: 2, desc: 'The Vigil candle burns 2 rounds longer.', vigilBonus: 2 }],
  'Red Pilgrimage': [{ need: 2, desc: 'Heal 8% after every won fight.', fightHeal: 0.08 }],
  'Iron Vigil': [{ need: 2, desc: 'Party armor +15%.', armorPct: 0.15 }],
  'Candle Choir': [{ need: 2, desc: 'Start every fight with +10 Zeal.', startZeal: 10 }],
  'Pale Reliquary': [{ need: 2, desc: 'Party attack +8%.', atkPct: 0.08 }],
};

/** The order bonuses a party of these orders turns on, as relic-like modifiers. */
export function orderBonuses(orders: string[]): RelicDef[] {
  const count = new Map<string, number>();
  for (const o of orders) count.set(o, (count.get(o) ?? 0) + 1);
  const out: RelicDef[] = [];
  for (const [order, n] of count) {
    for (const tier of ORDERS[order] ?? []) {
      if (n >= tier.need) out.push({ ...tier, id: `order:${order}:${tier.need}`, name: `${order} (${tier.need})` });
    }
  }
  return out;
}
