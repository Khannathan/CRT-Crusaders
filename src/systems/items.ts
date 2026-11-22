import type { SaveData } from '../state/save';
import type { Rng } from './gacha';

/**
 * Materials: six families, three tiers each, kept in the Inventory. Each
 * family feeds one growth system, so a player can tell at a glance what a drop
 * is for. Five of a tier refine into one of the next.
 */
export type Family = 'ash' | 'page' | 'iron' | 'incense' | 'writ' | 'unction' | 'grace';
export type Tier = 1 | 2 | 3;
export type ItemId = `${Family}${Tier}`;
export type Bag = Partial<Record<ItemId, number>>;

export interface FamilyDef {
  id: Family;
  name: string;
  /** What the family is spent on. */
  use: string;
  color: number;
}

export const FAMILIES: FamilyDef[] = [
  { id: 'ash', name: "Martyr's Ash", use: 'Ascension: raises a Sister\'s level cap', color: 0xc98a5a },
  { id: 'page', name: 'Psalter Pages', use: 'Skill levels', color: 0xd8c79a },
  { id: 'iron', name: 'Blessed Iron', use: 'Gear refinement and rerolls', color: 0x9aa7b4 },
  { id: 'incense', name: 'Incense', use: 'The Reliquary, the account-wide tree', color: 0xb592c8 },
  { id: 'writ', name: 'Order Writs', use: 'Order Codex levels', color: 0xd36a5c },
  { id: 'grace', name: 'Grace', use: 'Holy Symbols: wake and raise a Sister\'s own relic', color: 0xf0d27a },
  { id: 'unction', name: 'Unction', use: 'Sister EXP: fed on her Grow tab', color: 0x7fc4a0 },
];

export interface ItemDef {
  id: ItemId;
  family: Family;
  tier: Tier;
  name: string;
  flavor: string;
}

const def = (family: Family, tier: Tier, name: string, flavor: string): ItemDef => ({ id: `${family}${tier}`, family, tier, name, flavor });

/** Names are placeholders until the name library arrives. */
export const ITEMS: ItemDef[] = [
  def('ash', 1, 'Grave Ash', 'Swept from the ossuary floor. Some of it was holy.'),
  def('ash', 2, "Martyr's Ash", 'What the pyre left of one who would not recant.'),
  def('ash', 3, "Saint's Ash", 'It is warm. It is always warm.'),
  def('page', 1, 'Torn Page', 'A psalm, half burned, still legible.'),
  def('page', 2, 'Psalter Leaf', 'Copied by a nun who went blind finishing it.'),
  def('page', 3, 'Illuminated Folio', 'Gold leaf over a prayer no one is allowed to say aloud.'),
  def('iron', 1, 'Coffin Nail', 'Pulled from a lid that had been scratched from inside.'),
  def('iron', 2, 'Blessed Iron', 'Quenched in holy water, then in blood.'),
  def('iron', 3, 'Reliquary Steel', 'Forged around a saint\'s finger bone.'),
  def('incense', 1, 'Myrrh', 'For the dead, and for those who keep them.'),
  def('incense', 2, 'Frankincense', 'The smoke rises straight even in a draught.'),
  def('incense', 3, 'Holy Chrism', 'One drop anoints a bishop. You have a phial.'),
  def('writ', 1, 'Writ of Passage', 'Lets a Sister pass the gates of another house.'),
  def('writ', 2, 'Writ of Office', 'Sealed by a Prioress. It names a duty.'),
  def('writ', 3, 'Papal Bull', 'Lead-sealed. It names a crusade.'),
  def('grace', 1, 'Ember of Grace', 'A spark that will not go out. Raises a Holy Symbol to +5.'),
  def('grace', 2, 'Tear of Grace', 'Wept by a statue in a sealed chapel. Raises a Holy Symbol to +10.'),
  def('grace', 3, 'Crown of Grace', 'A circlet of light no hand can hold for long. Raises a Holy Symbol to +15.'),
  def('unction', 1, 'Lesser Unction', 'Oil for the sick. 300 EXP.'),
  def('unction', 2, 'Blessed Unction', 'Oil for the dying. 1,500 EXP.'),
  def('unction', 3, 'Extreme Unction', 'Oil for the last rites. She wakes stronger. 7,500 EXP.'),
];

export const itemDef = (id: ItemId) => ITEMS.find((i) => i.id === id)!;
export const familyDef = (f: Family) => FAMILIES.find((x) => x.id === f)!;
export const itemIds = (f: Family): ItemId[] => [`${f}1`, `${f}2`, `${f}3`];
/** Art slot: src/assets/ui/item-<id>.png (96 x 96). */
export const itemKey = (id: ItemId) => `item-${id}`;

export const itemsOf = (save: SaveData) => (save.items ??= {});
export const countOf = (save: SaveData, id: ItemId) => itemsOf(save)[id] ?? 0;

export function give(save: SaveData, bag: Bag) {
  const inv = itemsOf(save);
  for (const [id, n] of Object.entries(bag) as [ItemId, number][]) if (n > 0) inv[id] = (inv[id] ?? 0) + n;
}

export const hasAll = (save: SaveData, bag: Bag) => (Object.entries(bag) as [ItemId, number][]).every(([id, n]) => countOf(save, id) >= n);

/** Spends the bag if all of it is there. */
export function spend(save: SaveData, bag: Bag): boolean {
  if (!hasAll(save, bag)) return false;
  const inv = itemsOf(save);
  for (const [id, n] of Object.entries(bag) as [ItemId, number][]) inv[id] = (inv[id] ?? 0) - n;
  return true;
}

export function addBags(...bags: (Bag | undefined)[]): Bag {
  const out: Bag = {};
  for (const b of bags) for (const [id, n] of Object.entries(b ?? {}) as [ItemId, number][]) if (n) out[id] = (out[id] ?? 0) + n;
  return out;
}

export const bagEmpty = (bag: Bag | undefined) => !bag || Object.values(bag).every((n) => !n);

/** "3 Grave Ash, 1 Psalter Leaf", in family and tier order. */
export const bagText = (bag: Bag | undefined) =>
  ITEMS.filter((i) => (bag?.[i.id] ?? 0) > 0)
    .map((i) => `${bag![i.id]} ${i.name}`)
    .join(', ');

/** Five of a tier make one of the next. */
export const REFINE = 5;

export function refine(save: SaveData, id: ItemId, times = 1): boolean {
  const d = itemDef(id);
  if (d.tier === 3 || times < 1) return false;
  if (!spend(save, { [id]: REFINE * times })) return false;
  give(save, { [`${d.family}${d.tier + 1}` as ItemId]: times });
  return true;
}

// ---- Drops ---------------------------------------------------------------

const pick = <T>(rng: Rng, xs: T[]) => xs[Math.floor(rng() * xs.length) % xs.length];
const n = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

/** Families that crypt rooms and the Vigil drop. Writs come from the Tower and the Inquisition. */
export const FIELD: Family[] = ['ash', 'page', 'iron', 'incense'];

/**
 * A crypt room's materials. `depth` is how hard the crypt is: Heresy tier plus
 * one for the Belfry. Deeper crypts drop more and rarer.
 */
export function roomDrops(kind: 'fight' | 'elite' | 'boss', depth: number, rng: Rng = Math.random): Bag {
  const bag: Bag = {};
  const add = (id: ItemId, k: number) => k > 0 && (bag[id] = (bag[id] ?? 0) + k);
  if (kind === 'fight') {
    if (rng() < 0.5 + 0.05 * depth) add(`${pick(rng, FIELD)}1`, n(rng, 1, 2));
    if (rng() < 0.35) add('unction1', 1);
  } else if (kind === 'elite') {
    add('unction1', 2 + depth);
    add(`${pick(rng, FIELD)}1`, n(rng, 2, 3) + depth);
    if (rng() < 0.3 + 0.1 * depth) add(`${pick(rng, FIELD)}2`, 1);
  } else {
    for (const f of FIELD) add(`${f}1`, n(rng, 1, 2) + depth);
    add('unction2', 1 + Math.floor(depth / 2));
    add(`${pick(rng, FIELD)}2`, n(rng, 1, 2) + Math.floor(depth / 2));
    if (rng() < 0.1 + 0.1 * depth) add(`${pick(rng, FIELD)}3`, 1);
    if (rng() < 0.25 + 0.1 * depth) add('writ1', 1);
    // Grace for Holy Symbols: Embers from every boss, Tears and Crowns from deep Heresy.
    add('grace1', 2 + depth);
    if (depth >= 2) add('grace2', 1 + Math.floor((depth - 2) / 2));
    if (depth >= 5) add('grace3', 1);
  }
  return bag;
}

/** What the Vigil gathers: about one tier-1 material every two hours, a tier-2 now and then, and Unction. */
export function vigilDrops(hours: number, rng: Rng = Math.random): Bag {
  const bag: Bag = {};
  const oil = Math.floor(hours * 0.4 + rng());
  if (oil) bag.unction1 = oil;
  if (hours >= 4 && rng() < hours / 24) bag.unction2 = 1;
  const count = Math.floor(hours * 0.5 + rng());
  for (let i = 0; i < count; i++) {
    const id: ItemId = `${pick(rng, FIELD)}${rng() < 0.1 ? 2 : 1}`;
    bag[id] = (bag[id] ?? 0) + 1;
  }
  return bag;
}

/** A Tower floor's first clear: Blessed Iron and Writs, rarer with height. */
export function floorDrops(floor: number): Bag {
  const boss = floor % 10 === 0;
  const bag: Bag = { iron1: 2 + Math.floor(floor / 6) };
  if (floor > 15) bag.iron2 = Math.floor(floor / 15);
  if (floor % 5 === 0) bag.writ1 = 2;
  if (boss) {
    bag.writ2 = Math.floor(floor / 10);
    if (floor >= 30) bag.iron3 = 1;
  }
  return bag;
}
