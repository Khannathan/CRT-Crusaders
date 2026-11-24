import { ROSTER } from '../data/roster';

/**
 * Moves a save from the old 90-Sister roster (ids CC-W###) to the 500-Sister
 * roster (ids IV-LUR, IV-SSR-ARB, ...). 89 Sisters came back in matching
 * slots, so everything of theirs (levels, Vows, gear, bonds, Holy Symbols,
 * parties, errands, history) simply follows them to their new id.
 *
 * Junia Hypsaea did not come back: her Drowned Litany Executioner slot went to
 * Severa Ahala. A player who had Junia gets Severa in her place (with Junia's
 * levels and Vows) or, if Severa is already sworn, Junia's copies as Severa's
 * Vow tokens.
 */
export const ROSTER_VERSION = 2;

const JUNIA = 'CC-W007';
const SEVERA_OLD = 'CC-W220';
const MAP = new Map<string, string>(ROSTER.filter((c) => c.legacy).map((c) => [c.legacy!, c.id]));
MAP.set(JUNIA, MAP.get(SEVERA_OLD)!);

type Json = unknown;

/** Junia's traces, where Severa is there too, are dropped rather than doubled. */
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
export const moveIds = (text: string) => text.replace(/CC-W\d{3}/g, (id) => MAP.get(id) ?? id);

/** True for a save still on the old roster. */
export const needsRosterMigration = (data: { roster?: number }) => (data.roster ?? 1) < ROSTER_VERSION;

/** Returns the save moved to the new roster (a new object; the input is not changed). */
export function migrateRoster<T extends { roster?: number; owned?: Record<string, { vow?: number; tokens?: number }> }>(data: T): T {
  if (!needsRosterMigration(data)) return data;
  const save = JSON.parse(JSON.stringify(data)) as T;
  const owned = save.owned ?? {};
  const junia = owned[JUNIA];
  const severa = owned[SEVERA_OLD];
  if (junia && severa) {
    // Severa is already sworn: each copy of Junia becomes a Vow token for her.
    severa.tokens = (severa.tokens ?? 0) + 1 + (junia.vow ?? 0) + (junia.tokens ?? 0);
    delete owned[JUNIA];
  }
  const folded = foldJunia(save);
  const text = moveIds(JSON.stringify(folded));
  const out = resortKeys(JSON.parse(text)) as T;
  out.roster = ROSTER_VERSION;
  return out;
}
