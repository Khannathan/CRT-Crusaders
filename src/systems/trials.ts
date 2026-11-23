import type { SaveData } from '../state/save';
import { BELFRY, OSSUARY, skirmish, type CryptDef } from './crusade';
import type { Battle } from './combat';
import type { Rng } from './gacha';
import { claimGear, makeGear, rollGearRarity, type GearItem, type GearSlot } from './gear';
import { dayKey, track } from './tasks';
import { bagText, give, type Bag } from './items';

/**
 * Relic Trials: one short fight a day per kind of spoil. Each weekday opens
 * one trial (weekends open all). Three victories a day in total; an entry is
 * only spent on a win. Three stars on a tier lets you sweep it after that.
 * Pays in gear, Tithes, Seals, Martyr's Ash or Psalter Pages.
 */
export type TrialKind = GearSlot | 'tithes' | 'seals' | 'ash' | 'page';

export interface TrialDef {
  kind: TrialKind;
  name: string;
  flavor: string;
  /** Weekdays it opens (0 = Sunday). Weekends open every trial. */
  days: number[];
}

export const TRIALS: TrialDef[] = [
  { kind: 'blade', name: 'Trial of the Blade', flavor: 'The armory of the fallen. Their swords still want hands.', days: [1] },
  { kind: 'habit', name: 'Trial of the Habit', flavor: 'Burial shrouds that turned aside a heretic blade.', days: [2] },
  { kind: 'rosary', name: 'Trial of the Rosary', flavor: 'Prayer beads strung on the fingerbones of saints.', days: [3] },
  { kind: 'veil', name: 'Trial of the Veil', flavor: 'A cloister of veiled statues. Lift one and something lifts back.', days: [2, 4] },
  { kind: 'sabatons', name: 'Trial of the Road', flavor: 'The pilgrim road, paved with the boots of the faithful who fell on it.', days: [3, 5] },
  { kind: 'tithes', name: 'Trial of the Coffer', flavor: 'A tithe-barn the dead still guard.', days: [4] },
  { kind: 'seals', name: 'Trial of Wax', flavor: 'The sealing-chamber. Every seal is paid for in blood.', days: [5] },
  { kind: 'ash', name: 'Trial of Ash', flavor: 'The pyre-yard, where the martyrs were burned. Their ash remembers.', days: [1, 4] },
  { kind: 'page', name: 'Trial of the Psalter', flavor: 'A scriptorium sealed since the plague. The monks still copy.', days: [2, 5] },
];

export interface TierDef {
  encounter: string;
  /** Heresy-like scaling of the foes. */
  heresy: number;
  crypt: CryptDef;
}

export const TIERS: TierDef[] = [
  { encounter: 'ossuary-2', heresy: 0, crypt: OSSUARY },
  { encounter: 'ossuary-4', heresy: 0, crypt: OSSUARY },
  { encounter: 'ossuary-elite-1', heresy: 1, crypt: OSSUARY },
  { encounter: 'belfry-3', heresy: 1, crypt: BELFRY },
  { encounter: 'belfry-elite-2', heresy: 2, crypt: BELFRY },
];

export const TRIAL_ENTRIES = 3;
/** Rounds within which a flawless win earns the third star. */
export const SWIFT_ROUNDS = 6;

export interface TrialState {
  day: string;
  /** Victories (or sweeps) spent today. */
  used: number;
  /** Best stars per `${kind}-${tier}`. */
  best: Record<string, number>;
}

export function trialsOf(save: SaveData, now = Date.now()): TrialState {
  const t = (save.trials ??= { day: dayKey(now), used: 0, best: {} });
  if (t.day !== dayKey(now)) {
    t.day = dayKey(now);
    t.used = 0;
  }
  return t;
}

export const entriesLeft = (save: SaveData, now = Date.now()) => Math.max(0, TRIAL_ENTRIES - trialsOf(save, now).used);

/** Trials open today. */
export function openTrials(now = Date.now()): TrialDef[] {
  const d = new Date(now).getDay();
  return d === 0 || d === 6 ? TRIALS : TRIALS.filter((t) => t.days.includes(d));
}

export const bestStars = (save: SaveData, kind: TrialKind, tier: number) => trialsOf(save).best[`${kind}-${tier}`] ?? 0;

/** A tier opens once the one below it has been won. */
export const tierOpen = (save: SaveData, kind: TrialKind, tier: number) => tier === 0 || bestStars(save, kind, tier - 1) > 0;

export function trialBattle(save: SaveData, party: string[], tier: number, rng?: Rng): Battle {
  const t = TIERS[tier];
  return skirmish(save, party, t.encounter, t.heresy, rng, t.crypt);
}

/** 1 star for a win, 2 with no Sister fallen, 3 if also within SWIFT_ROUNDS. */
export function starsFor(battle: Battle): number {
  if (battle.outcome() !== 'victory') return 0;
  const fallen = battle.units.some((u) => u.side === 'party' && u.hp <= 0);
  if (fallen) return 1;
  return battle.round <= SWIFT_ROUNDS ? 3 : 2;
}

export interface TrialSpoils {
  tithes: number;
  seals: number;
  gear: GearItem[];
  items?: Bag;
}

/** Ash and Psalter trials: more and rarer with the tier. */
export function materialSpoils(family: 'ash' | 'page', tier: number): Bag {
  const bag: Bag = { [`${family}1`]: 6 + 3 * tier };
  if (tier >= 1) bag[`${family}2`] = tier;
  if (tier >= 4) bag[`${family}3`] = 1;
  return bag;
}

export function spoilsText(s: TrialSpoils) {
  return [s.tithes ? `${s.tithes} Tithes` : '', s.seals ? `${s.seals} Seal${s.seals > 1 ? 's' : ''}` : '', bagText(s.items), ...s.gear.map((g) => `${g.name} (${g.rarity})`)].filter(Boolean).join(', ');
}

/** What a tier pays, described before the fight. */
export function spoilsPreview(kind: TrialKind, tier: number) {
  if (kind === 'ash' || kind === 'page') return bagText(materialSpoils(kind, tier));
  if (kind === 'tithes') return `${300 * (tier + 1)} Tithes`;
  if (kind === 'seals') return `${[1, 1, 2, 2, 3][tier]} Seal${tier > 1 ? 's' : ''} + ${60 * (tier + 1)} Tithes`;
  return `${tier >= 2 ? 2 : 1} ${kind} gear, rarer at higher tiers${tier >= 3 ? ` + ${tier - 2} Saint's Fragment` : ''}`;
}

function pay(save: SaveData, kind: TrialKind, tier: number, rng: Rng): TrialSpoils {
  const out: TrialSpoils = { tithes: 0, seals: 0, gear: [] };
  if (kind === 'ash' || kind === 'page') {
    out.items = materialSpoils(kind, tier);
    give(save, out.items);
  } else if (kind === 'tithes') out.tithes = 300 * (tier + 1);
  else if (kind === 'seals') {
    out.seals = [1, 1, 2, 2, 3][tier];
    out.tithes = 60 * (tier + 1);
  } else {
    const pieces = Array.from({ length: tier >= 2 ? 2 : 1 }, () => makeGear(rng, rollGearRarity(rng, 0.05 * tier), kind));
    const before = save.gear?.length ?? 0;
    claimGear(save, pieces);
    out.gear = (save.gear ?? []).slice(before);
    // The two hardest tiers leave a Saint's Fragment, toward UR gear.
    if (tier >= 3) give(save, (out.items = { armory1: tier - 2 }));
  }
  save.tithes += out.tithes;
  save.seals += out.seals;
  return out;
}

/** Records a fought trial. Pays and spends an entry only on a win. */
export function finishTrial(save: SaveData, kind: TrialKind, tier: number, battle: Battle, rng: Rng = Math.random) {
  const stars = starsFor(battle);
  if (!stars || entriesLeft(save) <= 0) return { stars, spoils: undefined };
  const st = trialsOf(save);
  st.used += 1;
  const key = `${kind}-${tier}`;
  st.best[key] = Math.max(st.best[key] ?? 0, stars);
  track(save, 'trialWon');
  return { stars, spoils: pay(save, kind, tier, rng) };
}

/** Sweep: a three-starred tier pays out at once for one entry. */
export function sweep(save: SaveData, kind: TrialKind, tier: number, rng: Rng = Math.random): TrialSpoils | undefined {
  if (bestStars(save, kind, tier) < 3 || entriesLeft(save) <= 0) return undefined;
  trialsOf(save).used += 1;
  track(save, 'trialWon');
  return pay(save, kind, tier, rng);
}
