import type { SkillDef } from '../data/skills';
import type { SaveData } from '../state/save';
import type { Battle, BattleEvent, Unit } from './combat';
import { unlocked } from './rank';

/**
 * Hosanna: the party's shared rite. Every action a Sister takes fills one bar
 * for the whole party (a Litany fills more); full, the player calls the
 * Hosanna (Auto calls it on its own). Each party picks one Hosanna, and the
 * pick is kept for that exact party, so a boss team and a crypt team can sing
 * different ones. More Hosannas open with Rank of Faith.
 */
export const HOSANNA_MAX = 45;
export const HOSANNA_PER_ACT = 1;
export const HOSANNA_PER_LITANY = 4;

export interface HosannaDef {
  id: string;
  name: string;
  desc: string;
  /** Rank of Faith that opens it. */
  rank: number;
  /** Auto waits for this before calling it. */
  wait?: 'wounded' | 'wrath';
  skill: Omit<SkillDef, 'id' | 'name' | 'desc' | 'from'>;
}

const ALL = [1, 2, 3, 4];

export const HOSANNAS: HosannaDef[] = [
  { id: 'wrath-choir', name: 'Choir of Wrath', desc: 'Heavy holy damage on every foe; they are Weakened (-15%) for 2 turns.', rank: 1, skill: { target: 'allEnemies', dmg: 'magic', mult: 1.2, weaken: { pct: 0.15, turns: 2 } } },
  { id: 'saints-mantle', name: "Saints' Mantle", desc: 'Every Sister gains a shield of 25% of her max HP.', rank: 1, wait: 'wounded', skill: { target: 'allAllies', shieldPct: 0.25 } },
  { id: 'living-waters', name: 'Living Waters', desc: 'Every Sister heals 30% of her max HP and is cleansed.', rank: 1, wait: 'wounded', skill: { target: 'allAllies', healPct: 0.3, cleanse: true } },
  { id: 'kindled-hearts', name: 'Kindled Hearts', desc: 'Every Sister gains 40 Zeal. Chain the Litanies that follow!', rank: 3, skill: { target: 'allAllies', zealGain: 40, zealAll: true } },
  { id: 'silence', name: 'Silence the Heretic', desc: 'Light damage on every foe; each loses 60 Wrath and is Delayed.', rank: 5, wait: 'wrath', skill: { target: 'allEnemies', dmg: 'magic', mult: 0.6, wrathDrain: 60, delay: true } },
  { id: 'host-banner', name: 'Banner of the Host', desc: 'Every Sister +30% attack for 3 turns, and Haste.', rank: 7, skill: { target: 'allAllies', empower: { pct: 0.3, turns: 3 }, haste: 1 } },
  { id: 'many-verdict', name: 'Verdict of the Many', desc: 'A crushing blow on the strongest foe: ignores 30% armor, +30% on bosses.', rank: 9, skill: { target: 'enemy', aim: 'strongest', dmg: 'magic', mult: 3, armorPierce: 0.3, bossBonus: 0.3 } },
  { id: 'vigil-unbroken', name: 'Vigil Unbroken', desc: 'Every Sister regenerates 8% HP for 4 turns and takes 25% less damage for 3.', rank: 11, wait: 'wounded', skill: { target: 'allAllies', regen: { pct: 0.08, turns: 4 }, ward: { pct: 0.25, turns: 3 } } },
];

export const HOSANNA = Object.fromEntries(HOSANNAS.map((h) => [h.id, h])) as Record<string, HosannaDef>;
export const DEFAULT_HOSANNA = 'wrath-choir';

/** The SkillDef a Hosanna resolves as. */
export const hosannaSkill = (h: HosannaDef): SkillDef => ({ id: `hosanna-${h.id}`, name: h.name, desc: h.desc, from: ALL, ...h.skill });

export const hosannaOpen = (save: SaveData, h: HosannaDef) => unlocked(save, h.rank);

/** One key per party, whatever order the Sisters stand in. */
export const partyKey = (ids: string[]) => [...ids].sort().join('+');

/** The Hosanna this party sings (its own pick, else the last one picked, else Choir of Wrath). */
export function hosannaFor(save: SaveData, ids: string[]): HosannaDef {
  const pick = save.hosanna?.byParty?.[partyKey(ids)] ?? save.hosanna?.last;
  const h = pick ? HOSANNA[pick] : undefined;
  return h && hosannaOpen(save, h) ? h : HOSANNA[DEFAULT_HOSANNA];
}

export function pickHosanna(save: SaveData, ids: string[], id: string) {
  if (!HOSANNA[id] || !hosannaOpen(save, HOSANNA[id])) return false;
  const h = (save.hosanna ??= {});
  (h.byParty ??= {})[partyKey(ids)] = id;
  h.last = id;
  return true;
}

/** Auto: is now a good moment? (Healing waits for a wound, Silence for a Blasphemy building.) */
export function hosannaWorthIt(b: Battle, h: HosannaDef): boolean {
  if (h.wait === 'wounded') return b.alive('party').some((u) => u.hp < u.maxHp * 0.6);
  if (h.wait === 'wrath') return b.alive('enemy').some((u) => (u.wrath ?? 0) >= 50 || !!u.status.charging);
  return true;
}

/** Resolves a Hosanna through the strongest living Sister, without touching her cooldowns or Zeal. */
export function castHosanna(b: Battle, h: HosannaDef): { caster: Unit; skill: SkillDef; targetUid?: string; events: BattleEvent[] } | undefined {
  const party = b.alive('party');
  if (!party.length) return undefined;
  const caster = [...party].sort((x, y) => y.atk - x.atk)[0];
  const skill = hosannaSkill(h);
  const target = skill.target === 'enemy' ? [...b.alive('enemy')].sort((x, y) => (y.boss ? 1e9 : 0) + y.atk - ((x.boss ? 1e9 : 0) + x.atk))[0] : undefined;
  if (skill.target === 'enemy' && !target) return undefined;
  const cds = caster.cooldowns ? { ...caster.cooldowns } : undefined;
  const zeal = caster.zeal;
  const events = b.act(caster, skill, target);
  caster.cooldowns = cds;
  // Only Kindled Hearts may change her Zeal.
  if (!skill.zealGain) caster.zeal = zeal;
  events.unshift({ type: 'phase', uid: caster.uid, text: `HOSANNA: ${h.name.toUpperCase()}` });
  return { caster, skill, targetUid: target?.uid, events };
}

/** The Hosanna for the Sisters fighting in this battle. */
export const battleHosanna = (save: SaveData, b: Battle) => hosannaFor(save, b.units.filter((u) => u.side === 'party').map((u) => u.ref));
