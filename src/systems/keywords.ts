/**
 * The ten Order keywords: one mechanic per Order that its Sisters feed or spend
 * (design: the Sister identity rework). The rules live in Battle (combat.ts);
 * this file holds their numbers, names and the party-wide counters.
 *
 * - Iron Vigil, Overwatch: a Sister on Overwatch reacts once, out of turn, when
 *   the next foe acts. A reaction on a charging boss drains Wrath.
 * - Ashen Mercy, Mercy: a non-boss foe left under the Mercy line by a Mercy
 *   Sister's hit dies, and the party heals. Bosses under it take more and lose Wrath.
 * - Veiled Tribunal, Guilt: Tribunal hits on the Accused add Guilt (max 5);
 *   each Guilt means more damage taken. Sentence skills spend it.
 * - Sepulcher Watch, Remains: every fall (foe, add or Sister) gives the party
 *   Remains while a Watch Sister stands; bosses give them at 75/50/25% HP.
 * - Choir of the Pyre, Hymn: a party aura for a few rounds. A second Choir Hymn
 *   harmonises (both play) and gives every Sister Zeal.
 * - Verdant Martyrdom, Scars: a Martyrdom Sister scars from her own skills and from
 *   bleeding; each Scar adds damage for the fight.
 * - Drowned Litany, Tide: rises each round while a Drowned Sister stands; Ebb
 *   skills spend it all.
 * - Confessors of Glass, Confess: a Confessed foe's crits Shatter for more damage.
 * - Crimson Inquisition, Stride: an Inquisitor gains Stride whenever she changes rank.
 * - Hallowed Belfry, Toll: Belfry Sisters' skills ring the Bell; every 3rd toll is a
 *   Peal, the 12th is Midnight, which raises the fallen once a fight.
 */
import type { SkillDef } from '../data/skills';

export const KW_ORDER = {
  overwatch: 'Iron Vigil',
  mercy: 'Ashen Mercy',
  guilt: 'Veiled Tribunal',
  remains: 'Sepulcher Watch',
  hymn: 'Choir of the Pyre',
  scars: 'Verdant Martyrdom',
  tide: 'Drowned Litany',
  confess: 'Confessors of Glass',
  stride: 'Crimson Inquisition',
  toll: 'Hallowed Belfry',
} as const;
export type Keyword = keyof typeof KW_ORDER;

/** The keyword an Order's Sisters use. */
export const ORDER_KW: Record<string, Keyword> = Object.fromEntries(Object.entries(KW_ORDER).map(([k, o]) => [o, k as Keyword]));

export const KW_NAME: Record<Keyword, string> = {
  overwatch: 'Overwatch', mercy: 'Mercy', guilt: 'Guilt', remains: 'Remains', hymn: 'Hymn',
  scars: 'Scars', tide: 'Tide', confess: 'Confess', stride: 'Stride', toll: 'Toll',
};

/** Overwatch: Wrath a reaction drains from a charging boss; own turns it waits before lapsing. */
export const OVERWATCH_WRATH = 10;
export const OVERWATCH_TURNS = 2;
/** The basic reaction when a skill gives Overwatch without its own. */
export const OVERWATCH_HIT: SkillDef = { id: 'overwatch', name: 'Overwatch', desc: '', from: [], target: 'enemy', mult: 0.6 };

/** Mercy: the line, the party heal on a Mercy kill, and a boss hit under the line. */
export const MERCY_LINE = 0.15;
export const MERCY_HEAL = 0.05;
export const MERCY_BOSS = 0.3;
export const MERCY_WRATH = 10;

/** Guilt: cap, damage taken per Guilt. */
export const GUILT_MAX = 5;
export const GUILT_DMG = 0.04;

/** Remains: cap, and the boss HP marks that each give one. */
export const REMAINS_MAX = 6;
export const REMAINS_MARKS = [0.75, 0.5, 0.25];

/** Hymn: at most this many play at once (a harmony), and the Zeal a harmony gives. */
export const HYMN_MAX = 2;
export const HARMONY_ZEAL = 5;

/** Scars: one per this share of max HP lost to herself or bleeding; cap; damage per Scar. */
export const SCAR_STEP = 0.05;
export const SCARS_MAX = 10;
export const SCAR_DMG = 0.02;

/** Tide: cap. */
export const TIDE_MAX = 5;

/** Confess: extra critical damage against the Confessed (Shatter). */
export const SHATTER = 0.2;

/** Stride: cap. */
export const STRIDE_MAX = 5;

/** Toll: a Peal every this many tolls, Midnight at this many, and Midnight's raise. */
export const PEAL_EVERY = 3;
export const MIDNIGHT_AT = 12;
export const MIDNIGHT_RAISE = 0.2;
/** Zeal every Belfry Sister gains on a Peal. */
export const PEAL_ZEAL = 5;

/** A Hymn playing over the party. */
export interface Hymn {
  by: string;
  name: string;
  rounds: number;
  allies?: Partial<SkillDef>;
  foes?: Partial<SkillDef>;
  /** Sung by a Choir of the Pyre Sister (only those harmonise). */
  choir: boolean;
  /** Plays at double strength (Burns at Both Ends). */
  double?: boolean;
}

/** The party-wide Order counters in one battle. */
export interface PartyKeywords {
  remains: number;
  remainsMax: number;
  tide: number;
  toll: number;
  midnight: boolean;
  hymns: Hymn[];
  /** Boss uid -> how many Remains marks it has passed. */
  marks: Record<string, number>;
}

export const freshKeywords = (): PartyKeywords => ({ remains: 0, remainsMax: REMAINS_MAX, tide: 0, toll: 0, midnight: false, hymns: [], marks: {} });

/** One-line summary of the party counters that are in play, for the battle screen. */
export function keywordLine(k: PartyKeywords, orders: string[]): string {
  const has = (kw: Keyword) => orders.includes(KW_ORDER[kw]);
  const parts: string[] = [];
  if (has('remains')) parts.push(`Remains ${k.remains}/${k.remainsMax}`);
  if (has('tide')) parts.push(`Tide ${k.tide}/${TIDE_MAX}`);
  if (has('toll')) parts.push(`Toll ${k.toll % PEAL_EVERY}/${PEAL_EVERY}${k.midnight ? '' : ` · Midnight ${Math.min(k.toll, MIDNIGHT_AT)}/${MIDNIGHT_AT}`}`);
  for (const h of k.hymns) parts.push(`${h.name} ${h.rounds}`);
  return parts.join('  ·  ');
}
