import type { SaveData } from '../state/save';

/**
 * Party presets: saved parties of up to four Sisters, each with an icon picked
 * from a long list. The icon shows on the portrait of every Sister in it, so
 * you can see at a glance who belongs to which party.
 */
export interface PartyPreset {
  name: string;
  /** A texture key from PRESET_ICONS. */
  icon: string;
  party: string[];
}

export const PRESET_MAX = 10;

/** Art keys a preset may wear, in the order the picker shows them. Missing art is skipped at draw time. */
export const PRESET_ICONS: string[] = [
  ...['blade', 'shield', 'flame', 'book', 'seal', 'sigil', 'sanctum', 'vow', 'gilt', 'tithe', 'alms', 'devotion', 'matins-candle', 'vigil-candle', 'reliquary', 'roster'].map((n) => `ui-${n}`),
  ...['warsister', 'hierophant', 'inquisitor', 'confessor', 'censer', 'oracle', 'sentinel', 'martyr', 'hospitaller', 'abbess', 'cantor', 'adjudicator', 'veilblade', 'arbalist', 'exorcist'].map((n) => `class-${n}`),
  ...['ashen-mercy', 'candle-choir', 'drowned-litany', 'glass-confession', 'hollow-bell', 'iron-vigil', 'pale-reliquary', 'red-pilgrimage', 'sepulcher-watch', 'thorn-covenant', 'veiled-tribunal'].map((n) => `sigil-${n}`),
  ...['accuse', 'ash-bolt', 'blood-for-zeal', 'burning-thurible', 'choking-smoke', 'contagion', 'duelists-thrust', 'fan-the-flames', 'flagellants-charge', 'foresight', 'grim-augury', 'incense-cloud', 'last-rites', 'martyrs-fury', 'miasma', 'omen-of-ash', 'penitent-blow', 'reliquary-bash', 'remedy', 'sanctuary', 'sentence', 'verdict', 'vigil-bell', 'wall-of-saints'].map((n) => `skill-${n}`),
  ...['bone-dice', 'crown', 'ember-candle', 'holy-water', 'iron-rosary', 'knucklebone', 'pilgrims-flask', 'reliquary-nail', 'faith5', 'wrath5', 'zeal5'].map((n) => `relic-${n}`),
  ...['ash3', 'incense3', 'iron3', 'page3', 'writ3'].map((n) => `item-${n}`),
  ...['boss', 'elite', 'event', 'fight', 'reliquary', 'shrine'].map((n) => `node-${n}`),
  ...['R', 'SR', 'SSR', 'UR'].map((n) => `seal-${n}`),
  ...['attack', 'aoe', 'buff', 'charge', 'debuff', 'summon'].map((n) => `icon-${n}`),
];

export const presetsOf = (save: SaveData): PartyPreset[] => (save.presets ??= []);

/** Saves a party as preset `index`, or as a new one when `index` is undefined. Returns its index, or -1 when full. */
export function savePreset(save: SaveData, party: string[], icon: string, index?: number): number {
  const list = presetsOf(save);
  const ids = party.filter((id) => save.owned[id]).slice(0, 4);
  if (index !== undefined && list[index]) {
    list[index] = { ...list[index], party: ids, icon };
    return index;
  }
  if (list.length >= PRESET_MAX) return -1;
  list.push({ name: `Party ${list.length + 1}`, icon, party: ids });
  return list.length - 1;
}

export function setPresetIcon(save: SaveData, index: number, icon: string) {
  const p = presetsOf(save)[index];
  if (p) p.icon = icon;
}

export function deletePreset(save: SaveData, index: number) {
  presetsOf(save).splice(index, 1);
}

/** The icons of every preset a Sister belongs to. */
export function presetIconsFor(save: SaveData, id: string): string[] {
  return (save.presets ?? []).filter((p) => p.party.includes(id)).map((p) => p.icon);
}
