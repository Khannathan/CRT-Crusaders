import { ROSTER } from '../data/roster';
import { RETIRED } from '../data/retired';
import { copiesFor, MAX_VOW, tierOf } from '../systems/tiers';
import { expTotal } from '../systems/exp';

/**
 * Moves a save from the old 90-Sister roster (ids CC-W###) to the 500-Sister
 * roster (ids IV-LUR, IV-SSR-ARB, ...). 89 Sisters came back in matching
 * slots, so everything of theirs (levels, Vows, gear, bonds, Holy Symbols,
 * parties, errands, history) simply follows them to their new id.
 *
 * Junia Hypsaea did not come back: her Drowned Litany Executioner slot went to
 * Gurges Submersa. A player who had Junia gets Gurges in her place (with Junia's
 * levels and Vows) or, if Gurges is already sworn, Junia's copies as Gurges's
 * Vow tokens.
 *
 * Then the 500 shrank to 200 (roster 3, 2026-11-25): see retire() below.
 */
export const ROSTER_VERSION = 3;
/** The 500-Sister roster; version 3 is the 200-Sister roster (data/retired.ts). */
const V500 = 2;

const JUNIA = 'CC-W007';
const SEVERA_OLD = 'CC-W220';
const MAP = new Map<string, string>(ROSTER.filter((c) => c.legacy).map((c) => [c.legacy!, c.id]));
MAP.set(JUNIA, MAP.get(SEVERA_OLD)!);

type Json = unknown;

/** Junia's traces, where Gurges is there too, are dropped rather than doubled. */
function foldJunia(v: Json): Json {
  if (Array.isArray(v)) {
    const out = v.map(foldJunia);
    return out.includes(JUNIA) && out.includes(SEVERA_OLD) ? out.filter((x) => x !== JUNIA) : out;
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, Json>;
    const out: Record<string, Json> = {};
    for (const [k, x] of Object.entries(o)) {
      if (k === JUNIA && SEVERA_OLD in o) continue;
      out[k] = foldJunia(x);
    }
    return out;
  }
  return v;
}

/** Party keys ("id+id+id", sorted) stay sorted under the new ids. */
const resortKey = (k: string) => (/^[A-Z0-9-]+(\+[A-Z0-9-]+)+$/.test(k) ? k.split('+').sort().join('+') : k);
function resortKeys(v: Json): Json {
  if (Array.isArray(v)) return v.map(resortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, Json>).map(([k, x]) => [resortKey(k), resortKeys(x)]));
  return typeof v === 'string' ? resortKey(v) : v;
}

/** Old ids in any stored text (a crypt run left unfinished) moved to the new ones. */
export const moveIds = (text: string) => retireIds(text.replace(/CC-W\d{3}/g, (id) => MAP.get(id) ?? id));

/** Retired Sisters' ids in stored text moved to the Sister who took their place. */
const RETIRED_RE = new RegExp(`\\b(${Object.keys(RETIRED).join('|')})\\b`, 'g');
export const retireIds = (text: string) => text.replace(RETIRED_RE, (id) => RETIRED[id] ?? id);

/** True for a save still on the old roster. */
export const needsRosterMigration = (data: { roster?: number }) => (data.roster ?? 1) < ROSTER_VERSION;

/** Returns the save moved to the new roster (a new object; the input is not changed). */
export function migrateRoster<T extends { roster?: number; owned?: Record<string, { vow?: number; tokens?: number }> }>(data: T): T {
  if (!needsRosterMigration(data)) return data;
  return (data.roster ?? 1) < V500 ? retire(to500(data)) : retire(data);
}

/** The old 90 to the 500-Sister roster (roster 2). */
function to500<T extends { roster?: number; owned?: Record<string, { vow?: number; tokens?: number }> }>(data: T): T {
  const save = JSON.parse(JSON.stringify(data)) as T;
  const owned = save.owned ?? {};
  const junia = owned[JUNIA];
  const severa = owned[SEVERA_OLD];
  if (junia && severa) {
    // Gurges is already sworn: each copy of Junia becomes a Vow token for her.
    severa.tokens = (severa.tokens ?? 0) + 1 + (junia.vow ?? 0) + (junia.tokens ?? 0);
    delete owned[JUNIA];
  }
  const folded = foldJunia(save);
  const text = JSON.stringify(folded).replace(/CC-W\d{3}/g, (id) => MAP.get(id) ?? id);
  const out = resortKeys(JSON.parse(text)) as T;
  out.roster = V500;
  return out;
}

type Owned = { level: number; exp?: number; vow: number; tokens?: number; tier?: number };
type Gear = { on?: string };

/** Every copy a record holds: herself, the copies her Vows and tiers took, and the spares. */
export function copiesHeld(o: Owned): number {
  let n = 1 + (o.tokens ?? 0);
  for (let t = 0; t <= tierOf(o); t++) for (let v = 0; v < (t < tierOf(o) ? MAX_VOW : o.vow); v++) n += copiesFor(t, v);
  return n;
}

/** How far along a record is: tier, then Vows, then level and EXP. */
const progress = (o: Owned) => [tierOf(o), o.vow, o.level, o.exp ?? 0];
const ahead = (a: Owned, b: Owned) => {
  const pa = progress(a), pb = progress(b);
  for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i];
  return false;
};

/** Unctions worth this much EXP, largest first (the remainder rounds up to one more Lesser Unction). */
function unctionsFor(exp: number): Record<string, number> {
  const out: Record<string, number> = {};
  const big = Math.floor(exp / 7500);
  if (big) out.unction3 = big;
  const left = exp - big * 7500;
  if (left > 0) out.unction1 = Math.ceil(left / 300);
  return out;
}

/** Drops the second and later copies of an id from every list (a party that held both Sisters). */
function dedupe(v: Json): Json {
  if (Array.isArray(v)) return v.map(dedupe).filter((x, i, a) => typeof x !== 'string' || a.indexOf(x) === i);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, Json>).map(([k, x]) => [k, dedupe(x)]));
  return v;
}

/**
 * The 500-Sister roster to the 200 (roster 3). A retired Sister becomes the
 * Sister who took her place (same Order, rarity and role) with everything of
 * hers. Where the player has both, the further-along record stays; the other
 * one's copies become Vow copies, her EXP comes back as Unctions and her gear
 * goes back to the Satchel.
 */
function retire<T extends { roster?: number; owned?: Record<string, { vow?: number; tokens?: number }> }>(data: T): T {
  const save = JSON.parse(JSON.stringify(data)) as T & { owned: Record<string, Owned>; gear?: Gear[]; items?: Record<string, number> };
  const owned = save.owned ?? {};
  /** Successor id -> the id (before the move) whose record stays with her. */
  const kept = new Map<string, string>();
  for (const id of Object.keys(owned)) if (!RETIRED[id]) kept.set(id, id);
  for (const [cut, to] of Object.entries(RETIRED)) {
    const a = owned[cut];
    if (!a) continue;
    // Records stay under their old ids until the end; `kept` says which one holds her.
    const holder = kept.get(to);
    const b = holder ? owned[holder] : undefined;
    if (!holder || !b) {
      kept.set(to, cut);
      continue;
    }
    // Both sworn: the further-along record stays; the other gives her copies, EXP and gear back.
    const [stayId, goId] = ahead(a, b) ? [cut, holder] : [holder, cut];
    const stay = owned[stayId];
    const go = owned[goId];
    for (const g of save.gear ?? []) if (g.on === goId) g.on = undefined;
    stay.tokens = (stay.tokens ?? 0) + copiesHeld(go);
    const items = (save.items ??= {});
    for (const [id, n] of Object.entries(unctionsFor(expTotal(go.level) + (go.exp ?? 0)))) items[id] = (items[id] ?? 0) + n;
    delete owned[goId];
    kept.set(to, stayId);
  }
  // Records keyed by a Sister (bonds, Relic Rites, ...): only the staying record's entry moves.
  const isLoser = (id: string) => {
    const to = RETIRED[id] ?? id;
    return kept.has(to) && kept.get(to) !== id;
  };
  const prune = (v: Json): Json => {
    if (Array.isArray(v)) return v.map(prune);
    if (v && typeof v === 'object') {
      const o = v as Record<string, Json>;
      const keys = Object.keys(o);
      const out: Record<string, Json> = {};
      for (const k of keys) {
        const to = RETIRED[k] ?? k;
        const rivals = keys.filter((x) => (RETIRED[x] ?? x) === to);
        if (rivals.length > 1 && isLoser(k) && rivals.some((x) => !isLoser(x))) continue;
        out[k] = prune(o[k]);
      }
      return out;
    }
    return v;
  };
  const out = resortKeys(dedupe(JSON.parse(retireIds(JSON.stringify(prune(save)))))) as T;
  out.roster = ROSTER_VERSION;
  return out;
}
