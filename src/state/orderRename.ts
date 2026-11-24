/**
 * Five Orders took new names (Aaron, 2026-11-24). Their ids (glass-confession,
 * candle-choir, ...) and Sister slot codes (GC-, CC-, HB-, RP-, TC-) did not
 * change, but a few save fields hold the Order's name itself: the banner's
 * Order, Relic Shards per Order, Order bonus ids in an unfinished run. This
 * moves any old name in stored text to the new one. Safe to run on any save.
 */
export const ORDER_RENAMES: [string, string][] = [
  ['Glass Confession', 'Confessors of Glass'],
  ['Candle Choir', 'Choir of the Pyre'],
  ['Hollow Bell', 'Hallowed Belfry'],
  ['Red Pilgrimage', 'Crimson Inquisition'],
  ['Thorn Covenant', 'Verdant Martyrdom'],
];

export const renameOrders = (text: string) => ORDER_RENAMES.reduce((t, [from, to]) => t.split(from).join(to), text);
