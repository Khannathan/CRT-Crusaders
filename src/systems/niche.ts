/**
 * The niche sim (design: the Sister identity rework). Each Sister steps into a
 * plain all-R party in her role's slot and fights every Hallowed Hunt at a fixed
 * level; her score in a hunt is the beast's damage, averaged over seeded fights.
 * Scores are then read against the best SSR of her role (= 100), the scale the
 * rarity budget is written in: R 75, SR 85, SSR 100, UR up to 110 in her niche.
 *
 * Tanks and Healers are read at a harder tier (SURVIVAL_TIER), where the plain
 * party starts to fall inside the hunt's clock: there, keeping Sisters standing
 * is what keeps the damage coming, so her worth shows in the score.
 */
import { CLASSES } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import type { CrusaderDef, Rarity, Role } from '../data/types';
import { newSave } from '../state/save';
import { autoBattle } from './autoplay';
import { HUNTS, huntBattle, huntScore, type HuntDef } from './hunts';
import { seeded } from './rng';

/** The plain party a Sister joins: one per role slot. */
export const FILLER: Record<'tank' | 'healer' | 'dps' | 'flex', string> = {
  tank: 'CC-W052', // Aquilia Lepida, R Hierophant
  healer: 'CC-W151', // Antonia Libo, R Confessor
  dps: 'CC-W013', // Decima Cursor, R War-Sister
  flex: 'CC-W171', // Lollia Casca, R Veilblade
};

/** Which filler she replaces. */
const SLOT: Record<Role, keyof typeof FILLER> = { Tank: 'tank', Healer: 'healer', 'Melee DPS': 'dps', 'Ranged DPS': 'flex', Buffer: 'flex' };

/** Tier each role is read at: damage roles at DAMAGE_TIER, Tanks and Healers where deaths happen. */
export const DAMAGE_TIER = 3;
export const SURVIVAL_TIER = 5;
export const tierFor = (role: Role): number => (role === 'Tank' || role === 'Healer' ? SURVIVAL_TIER : DAMAGE_TIER);

export const roleOf = (c: CrusaderDef): Role => CLASSES[c.classId].role;

export function partyFor(id: string): string[] {
  const c = CRUSADERS.find((x) => x.id === id)!;
  const slot = SLOT[roleOf(c)];
  return (['tank', 'dps', 'flex', 'healer'] as const).map((s) => (s === slot ? id : FILLER[s]));
}

/** Her average damage on the beast, over `seeds` fights at this level and tier. */
export function huntRun(id: string, hunt: HuntDef, opts: { level?: number; tier?: number; seeds?: number } = {}): number {
  const level = opts.level ?? 20;
  const party = partyFor(id);
  const save = newSave();
  for (const p of party) save.owned[p] = { level, vow: 0 };
  let total = 0;
  const n = opts.seeds ?? 6;
  for (let s = 0; s < n; s++) {
    const b = huntBattle(save, party, hunt, opts.tier ?? tierFor(roleOf(CRUSADERS.find((x) => x.id === id)!)), seeded(1000 + s * 7919));
    autoBattle(b, 600);
    total += huntScore(b, hunt);
  }
  return total / n;
}

/** Relative scores count up to this much toward best and avg. */
export const REL_CAP = 150;

export interface NicheRow {
  id: string;
  name: string;
  rarity: Rarity;
  role: Role;
  /** Hunt id -> score against the best SSR of her role there (100). */
  rel: Record<string, number>;
  /** Her best and average relative score. */
  best: number;
  avg: number;
}

/** Runs every Sister through every hunt and scales each role against its best SSR. */
export function nicheTable(opts: { seeds?: number; level?: number; tier?: number; ids?: string[] } = {}): NicheRow[] {
  const sisters = CRUSADERS.filter((c) => !opts.ids || opts.ids.includes(c.id));
  const raw = new Map<string, Record<string, number>>();
  for (const c of sisters) raw.set(c.id, Object.fromEntries(HUNTS.map((h) => [h.id, huntRun(c.id, h, opts)])));
  const rows: NicheRow[] = [];
  for (const c of sisters) {
    const role = roleOf(c);
    const rel: Record<string, number> = {};
    for (const h of HUNTS) {
      const top = Math.max(1, ...sisters.filter((o) => o.rarity === 'SSR' && roleOf(o) === role).map((o) => raw.get(o.id)![h.id]));
      rel[h.id] = Math.round((raw.get(c.id)![h.id] / top) * 100);
    }
    // A hunt where the role's best SSR barely scratches the beast gives wild ratios: clip them.
    const vals = Object.values(rel).map((v) => Math.min(REL_CAP, v));
    rows.push({ id: c.id, name: c.name, rarity: c.rarity, role, rel, best: Math.max(...vals), avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) });
  }
  return rows;
}

/** Rank (1 = best) of a Sister among her role in one hunt. */
export function rankIn(rows: NicheRow[], id: string, hunt: string): number {
  const me = rows.find((r) => r.id === id)!;
  return rows.filter((r) => r.role === me.role && r.rel[hunt] > me.rel[hunt]).length + 1;
}

/** How a hunt is named in a Sister's "Shines in" list. */
export const SHINE_LABEL: Record<string, string> = {
  'flayed-saint': 'Flayed Saint Hunt',
  'twofold-reliquary': 'Twofold Reliquary Hunt',
  colossus: 'Colossus Hunt',
  'rot-mother': 'Rot-Mother Hunt',
  choirmaster: 'Choirmaster Hunt',
  'red-cardinal': 'Red Cardinal Hunt',
  'font-leviathan': 'Font Leviathan Hunt',
  'iron-abbot': 'Iron Abbot Hunt',
};
