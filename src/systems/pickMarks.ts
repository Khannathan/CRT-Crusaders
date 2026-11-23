import { CLASSES, dmgTagOf } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';
import { ARMOR_K, type Battle, type Unit } from './combat';
import { skirmish, type CryptDef } from './crusade';
import { baneOf, recommendFor, weakTo, type HuntDef } from './hunts';
import { raidCrypts } from './raid';

/**
 * Marks on a party picker's cards: which Sisters this content favours. Each
 * mode builds its own, so only what matters there is shown (a Feast's bonus
 * Sisters, a beast's bane Order, an errand's rarity, her own Rite...).
 */
export type MarkKind = 'bonus' | 'need' | 'pick' | 'bane' | 'dmg';

export interface Mark {
  kind: MarkKind;
  /** Short, on the card: "BANE", "MAGIC", "+50%". */
  label: string;
}

export interface LegendLine {
  kind: MarkKind;
  label: string;
  /** What the mark means here, in a few words. */
  text: string;
}

export interface PickMarks {
  /** The marks on one Sister, given the party picked so far. */
  of: (c: CrusaderDef, picked: string[]) => Mark[];
  legend: LegendLine[];
}

/** Which mark leads when a card has several (the first is drawn first). */
const ORDER: MarkKind[] = ['need', 'bonus', 'pick', 'bane', 'dmg'];

/** Several modes' marks as one; legend lines keep their order. */
export function joinMarks(...all: (PickMarks | undefined)[]): PickMarks {
  const some = all.filter((m): m is PickMarks => !!m);
  return {
    of: (c, picked) => some.flatMap((m) => m.of(c, picked)).sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)),
    legend: some.flatMap((m) => m.legend),
  };
}

export const DMG_LABEL = { physical: 'PHYSICAL', magic: 'MAGIC' } as const;

/** Bane Orders and the damage type that pierces this set of foes. */
export function foeWeakness(units: Unit[]): { banes: string[]; weak?: 'physical' | 'magic' } {
  const foes = units.filter((u) => u.side === 'enemy');
  // A boss fight is about the boss; otherwise every foe counts by its HP.
  const bosses = foes.filter((u) => u.boss);
  const focus = bosses.length ? bosses : foes;
  if (!focus.length) return { banes: [] };
  const total = focus.reduce((n, u) => n + u.maxHp, 0) || 1;
  const byBane: Record<string, number> = {};
  for (const u of focus) if (u.bane) byBane[u.bane] = (byBane[u.bane] ?? 0) + u.maxHp;
  // Banes that stand behind at least a third of the foes' HP, at most two.
  const banes = Object.entries(byBane)
    .filter(([, hp]) => hp / total >= 1 / 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([o]) => o);
  // A foe that swaps its guard is weak to neither for long.
  if (focus.some((u) => u.traits?.swap)) return { banes };
  const armor = focus.reduce((n, u) => n + u.armor * u.maxHp, 0) / total;
  const mres = focus.reduce((n, u) => n + u.mres * u.maxHp, 0) / total;
  // Only a real gap counts: one side's blows land at least 10% harder.
  const gap = (1 + Math.max(armor, mres) / ARMOR_K) / (1 + Math.min(armor, mres) / ARMOR_K);
  return { banes, weak: gap >= 1.1 ? (armor < mres ? 'physical' : 'magic') : undefined };
}

/** Who the legend speaks of: "it"/"its", "them"/"their", "the boss"/"the boss's". */
type Who = [string, string];
const IT: Who = ['it', 'its'];
const THEM: Who = ['them', 'their'];

function weaknessMarks(banes: string[], weak: 'physical' | 'magic' | undefined, [obj, poss]: Who): PickMarks {
  const legend: LegendLine[] = [];
  if (banes.length) legend.push({ kind: 'bane', label: 'BANE', text: `${banes.join(' & ')} strike${banes.length > 1 ? '' : 's'} ${obj} deeper` });
  if (weak) legend.push({ kind: 'dmg', label: DMG_LABEL[weak], text: `${weak === 'physical' ? 'Physical' : 'Magic'} pierces ${poss} guard` });
  return {
    of: (c) => {
      const out: Mark[] = [];
      if (banes.includes(c.order)) out.push({ kind: 'bane', label: 'BANE' });
      if (weak && dmgTagOf(c) === weak) out.push({ kind: 'dmg', label: DMG_LABEL[weak] });
      return out;
    },
    legend,
  };
}

/** Bane and damage marks for the foes of one or more fights (built with an empty party). */
export function fightMarks(...battles: Battle[]): PickMarks {
  const units = battles.flatMap((b) => b.units);
  const foes = units.filter((u) => u.side === 'enemy');
  const one = foes.filter((u) => u.boss).length === 1 || foes.length === 1;
  const w = foeWeakness(units);
  return weaknessMarks(w.banes, w.weak, one ? IT : THEM);
}

/** A crypt (or the Hold's crypt of the day) is judged by the boss at its heart. */
export function cryptMarks(save: SaveData, crypt: CryptDef, heresy = 0): PickMarks {
  const w = foeWeakness(skirmish(save, [], crypt.boss, heresy, undefined, crypt).units);
  return weaknessMarks(w.banes, w.weak, ['its boss', "its boss's"]);
}

/** The week's Raid: any boss's bane is worth a Squad; a damage type only if all three fear it. */
export function raidMarks(save: SaveData, now = Date.now()): PickMarks {
  const each = raidCrypts(now).map((cr) => foeWeakness(skirmish(save, [], cr.boss, 0, undefined, { ...cr, power: 1 }).units));
  const banes = [...new Set(each.flatMap((w) => w.banes))];
  const weak = each.every((w) => w.weak && w.weak === each[0].weak) ? each[0].weak : undefined;
  return weaknessMarks(banes, weak, ['a boss', "every boss's"]);
}

/** A hunted beast: its best answers from your roster, its bane Order and the damage it fears. */
export function huntMarks(save: SaveData, hunt: HuntDef): PickMarks {
  const picks = new Set(recommendFor(save, hunt).map((p) => p.c.id));
  const weak = weakTo(hunt);
  const bane = baneOf(hunt);
  const base = weaknessMarks(bane ? [bane] : [], weak.length === 1 ? weak[0] : undefined, IT);
  return joinMarks(
    {
      of: (c) => (picks.has(c.id) ? [{ kind: 'pick', label: 'PICK' }] : []),
      legend: picks.size ? [{ kind: 'pick', label: 'PICK', text: 'answers its mechanics' }] : [],
    },
    base,
  );
}

/** Sisters a mode rewards for bringing (Feast Candles, an errand's +50%...). */
export function bonusMarks(is: (c: CrusaderDef) => boolean, text: string, label = 'BONUS'): PickMarks {
  return { of: (c) => (is(c) ? [{ kind: 'bonus', label }] : []), legend: [{ kind: 'bonus', label, text }] };
}

/** One Sister who must go. */
export function needMarks(id: string, label: string, text: string): PickMarks {
  return { of: (c) => (c.id === id ? [{ kind: 'need', label }] : []), legend: [{ kind: 'need', label, text }] };
}

/** "One SR or better": marks those who qualify until one is picked. */
export function rarityNeedMarks(min: string, ok: (c: CrusaderDef) => boolean): PickMarks {
  const has = (picked: string[]) => picked.some((id) => CRUSADERS.some((c) => c.id === id && ok(c)));
  return {
    of: (c, picked) => (ok(c) && !has(picked) ? [{ kind: 'need', label: `${min}+` }] : []),
    legend: [{ kind: 'need', label: `${min}+`, text: 'one must go' }],
  };
}

/** A class or Order bonus as a short label for the legend. */
export const bonusWho = (kind: 'order' | 'class', value: string) => (kind === 'order' ? value : `${CLASSES[value]?.name ?? value}s`);

/** Legend lines that actually mark someone among `pool` (so a legend never promises what isn't there). */
export function liveLegend(marks: PickMarks, pool: CrusaderDef[], picked: string[]): LegendLine[] {
  const seen = new Set(pool.flatMap((c) => marks.of(c, picked).map((m) => `${m.kind}:${m.label}`)));
  return marks.legend.filter((l) => seen.has(`${l.kind}:${l.label}`));
}
