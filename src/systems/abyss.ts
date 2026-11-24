import { CRUSADERS } from '../data/crusaders';
import { EDICTS, edictDef, MAX_IP, type EdictId } from '../data/loot';
import type { SaveData } from '../state/save';
import type { Battle } from './combat';
import { BELFRY, OSSUARY, skirmish } from './crusade';
import type { Rng } from './gacha';
import { claimGear, GEAR_SLOTS, makeGear, rollGearRarity, smartFavour, type GearItem, type GearSlot } from './gear';
import { addBags, give, type Bag } from './items';
import { recommendedPower } from './power';
import { floorDef, foesOf } from './tower';

/**
 * The Abyssal Crypt: the endless gear farm. No entry limit and no stamina;
 * every descent is one fight. Tiers have no end: each is ABYSS_GROWTH tougher
 * than the last, and Item Power climbs with them, reaching Ancient (725) near
 * tier 50. It pays gear and Consecrated Iron (plus Saint's Fragments on a
 * tier's first clear), never Seals or Gilt, so farming it can't move the pull economy.
 *
 * A Sigil (paid in Tithes) aims the descent: one slot, one Edict, or both.
 * The Penitent's Due counts dry descents; at DUE_MAX the next one is sure to
 * drop an Anathema piece (with the Sigil's Edict, if one is set).
 */

export const ABYSS_GROWTH = 1.09;
export const ABYSS_BASE = 0.8;
export const abyssScale = (tier: number) => ABYSS_BASE * ABYSS_GROWTH ** (tier - 1);

/** Content IP of a tier: 160 at tier 1, Ancient near tier 50, capped at MAX_IP. */
export const abyssIp = (tier: number) => Math.min(MAX_IP, Math.round(150 + 11.5 * tier));

/** Dry descents before an Anathema piece is sure. */
export const DUE_MAX = 10;
/** Pieces a won descent drops: 2, one more every 15 tiers, at most 4. */
export const piecesFor = (tier: number) => Math.min(4, 2 + Math.floor(tier / 15));
/** Chance of a Saint's Arms piece, from tier 30. */
export const ARMS_CHANCE = 0.004;
export const ARMS_FROM = 30;

export interface Sigil {
  slot?: GearSlot;
  edict?: EdictId;
}

export interface AbyssState {
  /** Highest tier cleared. */
  best: number;
  /** Dry descents since the last Anathema-or-better drop. */
  due: number;
  /** Descents won, all time. */
  runs: number;
  /** The Sigil carried into the next descents, kept until changed. */
  sigil?: Sigil;
}

export const abyssOf = (save: SaveData): AbyssState => (save.abyss ??= { best: 0, due: 0, runs: 0 });

/** Highest tier the player may enter: one past the best. */
export const maxTier = (save: SaveData) => abyssOf(save).best + 1;

/** Tithes a Sigil costs per descent: a slot or an Edict 40%, both 100%. */
export function sigilCost(tier: number, sigil?: Sigil): number {
  if (!sigil || (!sigil.slot && !sigil.edict)) return 0;
  const base = 200 + 30 * tier;
  return Math.round(base * (sigil.slot && sigil.edict ? 1 : 0.4));
}

/** Why a Sigil can't be used, or undefined. */
export function sigilBlock(save: SaveData, tier: number, sigil?: Sigil): string | undefined {
  if (sigil?.slot && sigil.edict && !edictDef(sigil.edict)?.slots.includes(sigil.slot)) return 'That Edict never binds to that slot';
  if (save.tithes < sigilCost(tier, sigil)) return 'Not enough Tithes for the Sigil';
  return undefined;
}

/** Edicts a Sigil may name: those that fit its slot, or all. */
export const sigilEdicts = (slot?: GearSlot) => EDICTS.filter((e) => !slot || e.slots.includes(slot));

/** Chamber layout: the Tower's halls, cycled every 60 tiers (a boss every 10th, an elite every 3rd). */
export function tierDef(tier: number) {
  const f = floorDef(((tier - 1) % 60) + 1);
  return { tier, encounter: f.encounter, boss: f.boss, elite: !!f.elite, scale: abyssScale(tier), ip: abyssIp(tier) };
}

export const tierFoes = (tier: number) => foesOf({ ...tierDef(tier), floor: tier, rule: undefined });

export function abyssBattle(save: SaveData, party: string[], tier: number, rng?: Rng): Battle {
  const d = tierDef(tier);
  return skirmish(save, party, d.encounter, 0, rng, tier > 30 ? BELFRY : OSSUARY, d.scale);
}

export const tierRecommended = (save: SaveData, tier: number) => recommendedPower(abyssBattle(save, [], tier));

/**
 * Iron every won descent pays, and Saint's Fragments on a tier's first clear
 * only: the farm is endless, so the Saint's Arms it feeds must not be.
 */
export function tierSpoils(tier: number, first = false): Bag {
  const boss = tier % 10 === 0;
  return addBags(
    { iron1: 2 + Math.floor(tier / 8) },
    tier >= 20 ? { iron2: 1 + Math.floor((tier - 20) / 20) } : {},
    tier >= 40 && boss ? { iron3: 1 } : {},
    first ? { armory1: (boss ? 3 : 1) + Math.floor(tier / 25) } : {},
  );
}

/** Quality luck: rises with the tier, so deep descents roll Sworn and Anathema more. */
export const tierLuck = (tier: number) => Math.min(0.25, 0.04 + tier * 0.004);

export interface DescentResult {
  won: boolean;
  /** Pieces kept (filtered or overflow pieces are melted). */
  gear: GearItem[];
  /** Every piece that dropped, kept or melted, best grade first. */
  dropped: GearItem[];
  items: Bag;
  /** Tithes from pieces melted by the loot filter. */
  melted: number;
  /** The Penitent's Due paid out this descent. */
  duePaid: boolean;
  newBest: boolean;
  sigilPaid: number;
}

const GOOD = new Set(['anathema', 'arms', 'godforged']);

/** Rolls the pieces of a won descent. Exported for tests. */
export function rollDescent(save: SaveData, tier: number, party: string[], rng: Rng, sigil?: Sigil): { pieces: GearItem[]; duePaid: boolean } {
  const st = abyssOf(save);
  const classIds = party.map((id) => CRUSADERS.find((c) => c.id === id)?.classId);
  const ip = abyssIp(tier);
  const pieces: GearItem[] = [];
  const n = piecesFor(tier);
  for (let i = 0; i < n; i++) {
    // The Sigil aims the first piece of each descent; the rest fall where they will.
    const aimed = i === 0 ? sigil : undefined;
    const slot = aimed?.slot ?? (aimed?.edict ? edictDef(aimed.edict)!.slots[Math.floor(rng() * edictDef(aimed.edict)!.slots.length)] : undefined);
    const pieceIp = Math.max(1, Math.min(MAX_IP, Math.round(ip - 15 + rng() * 25)));
    if (tier >= ARMS_FROM && rng() < ARMS_CHANCE) {
      pieces.push(makeGear(rng, 'UR', slot ?? GEAR_SLOTS[Math.floor(rng() * GEAR_SLOTS.length)]));
      continue;
    }
    const band = rollGearRarity(rng, tierLuck(tier));
    pieces.push(makeGear(rng, band, slot, { ip: pieceIp, favour: smartFavour(rng, classIds), edict: aimed?.edict }));
  }
  let duePaid = false;
  if (pieces.some((p) => GOOD.has(p.grade))) st.due = 0;
  else if (++st.due >= DUE_MAX) {
    const slot = sigil?.slot ?? (sigil?.edict ? edictDef(sigil.edict)!.slots[0] : undefined);
    pieces[0] = makeGear(rng, 'SSR', slot, { ip, grade: 'anathema', edict: sigil?.edict, favour: smartFavour(rng, classIds) });
    st.due = 0;
    duePaid = true;
  }
  return { pieces, duePaid };
}

const GRADE_RANK: Record<string, number> = { worn: 0, consecrated: 1, sworn: 2, anathema: 3, arms: 4, godforged: 5 };

/** Settles a descent: pays the Sigil, then on a win drops gear, iron and Fragments. */
export function finishDescent(save: SaveData, tier: number, party: string[], battle: Battle, rng: Rng = Math.random): DescentResult {
  const st = abyssOf(save);
  const won = battle.outcome() === 'victory';
  const sigil = st.sigil;
  const sigilPaid = won && !sigilBlock(save, tier, sigil) ? sigilCost(tier, sigil) : 0;
  const empty: DescentResult = { won, gear: [], dropped: [], items: {}, melted: 0, duePaid: false, newBest: false, sigilPaid: 0 };
  if (!won) return empty;
  save.tithes -= sigilPaid;
  const { pieces, duePaid } = rollDescent(save, tier, party, rng, sigilPaid || !sigil ? sigil : undefined);
  const before = new Set((save.gear ?? []).map((g) => g.uid));
  const melted = claimGear(save, pieces);
  const gear = (save.gear ?? []).filter((g) => !before.has(g.uid));
  const newBest = tier > st.best;
  if (newBest) st.best = tier;
  const items = tierSpoils(tier, newBest);
  give(save, items);
  st.runs++;
  const dropped = [...pieces].sort((a, b) => GRADE_RANK[b.grade] - GRADE_RANK[a.grade] || b.ip - a.ip);
  return { won, gear, dropped, items, melted, duePaid, newBest, sigilPaid };
}
