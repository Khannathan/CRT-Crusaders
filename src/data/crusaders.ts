import type { CrusaderDef } from './types';

/**
 * Starter cast: 12 crusaders, 2 per class, taken from ROSTER_240.csv.
 * Adding a crusader = adding a row here and a portrait at public/portraits/<id>.png.
 */
export const CRUSADERS: CrusaderDef[] = [
  { id: 'CC-W013', name: 'Aveline Valecourt', classId: 'warsister', rarity: 'R', order: 'Sepulcher Watch', age: 29, hook: 'She believes mercy is a discipline that must be defended.' },
  { id: 'CC-W019', name: 'Mirelle Thorne', classId: 'warsister', rarity: 'UR', order: 'Hollow Bell', age: 41, hook: 'She protects travelers while quietly questioning her own hierarchy.' },
  { id: 'CC-W052', name: 'Seraphine Ashcombe', classId: 'hierophant', rarity: 'R', order: 'Drowned Litany', age: 47, hook: 'She serves a ruined chapel that still receives anonymous candles.' },
  { id: 'CC-W054', name: 'Catrine Mourne', classId: 'hierophant', rarity: 'SR', order: 'Red Pilgrimage', age: 28, hook: 'She hears a bell that no one else admits is ringing.' },
  { id: 'CC-W001', name: 'Ysabet Veyr', classId: 'inquisitor', rarity: 'R', order: 'Iron Vigil', age: 26, hook: 'She keeps the relic of a mentor whose last order she refused.' },
  { id: 'CC-W008', name: 'Lenore Rookmere', classId: 'inquisitor', rarity: 'SSR', order: 'Glass Confession', age: 36, hook: "She hunts the fraud who wore her order's sacred vestments." },
  { id: 'CC-W022', name: 'Mariel Ashcombe', classId: 'confessor', rarity: 'R', order: 'Sepulcher Watch', age: 29, hook: 'She believes mercy is a discipline that must be defended.' },
  { id: 'CC-W026', name: 'Vivienne Harrow', classId: 'confessor', rarity: 'SR', order: 'Glass Confession', age: 36, hook: "She hunts the fraud who wore her order's sacred vestments." },
  { id: 'CC-W032', name: 'Isolde Ashcombe', classId: 'censer', rarity: 'R', order: 'Candle Choir', age: 43, hook: 'She guards a forbidden testimony hidden inside her relic.' },
  { id: 'CC-W035', name: 'Solenne Duskell', classId: 'censer', rarity: 'SR', order: 'Glass Confession', age: 36, hook: "She hunts the fraud who wore her order's sacred vestments." },
  { id: 'CC-W043', name: 'Morgane Valecourt', classId: 'oracle', rarity: 'R', order: 'Drowned Litany', age: 47, hook: 'She serves a ruined chapel that still receives anonymous candles.' },
  { id: 'CC-W047', name: 'Amara Bellgrave', classId: 'oracle', rarity: 'SSR', order: 'Pale Reliquary', age: 26, hook: 'She keeps the relic of a mentor whose last order she refused.' },
];
