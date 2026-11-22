import { CRYPTS } from './crusade';
import type { SaveData } from '../state/save';
import { campaignOf } from './campaign';
import { rankInfo } from './rank';
import { seeded } from './rng';
import { towerOf } from './tower';

/**
 * The rival ladder: computer-run Sisterhoods with their own fixed Renown that
 * creeps up a little each day, the same for every player. They are not tuned
 * to you: you see the ones nearest your own Renown, above and below.
 */
export interface Rival {
  name: string;
  renown: number;
  you?: boolean;
}

export const RIVAL_COUNT = 40;
/** Rivals' Renown grows this much per day since the ladder opened. */
const DAILY_GROWTH = 0.004;
const OPENED = new Date(2026, 10, 1).getTime();

const SAINTS = ['Saint Wen', 'Saint Oda', 'Saint Bertil', 'Saint Hesk', 'Saint Mara', 'Saint Corva', 'Saint Lisle', 'Saint Aubade', 'Saint Grael', 'Saint Ysolt'];
const THINGS = ['Ashen Lamp', 'Ninth Nail', 'Weeping Bell', 'Salt Crown', 'Iron Psalm', 'Black Wick', 'Pale Lantern', 'Seventh Veil', 'Bone Choir', 'Bitter Cup', 'Grey Hood', 'Silent Tongue'];
const FORMS = ['Sisters of {s}', 'Order of the {t}', 'Daughters of the {t}', 'Vigil of {s}', 'Convent of the {t}', 'Choir of {s}'];

/** Your Renown: what you have done, counted plainly. */
export function renownOf(save: SaveData): number {
  const crypts = CRYPTS.reduce((n, c) => n + (save.cleared.includes(c.id) ? 120 * (1 + (save.heresy?.[c.id] ?? 0)) : 0), 0);
  return Math.round(towerOf(save).best * 20 + (save.records?.brands ?? 0) * 40 + campaignOf(save).best * 15 + crypts + rankInfo(save).rank * 25);
}

/** The rivals, strongest first. Names and starting Renown never change. */
export function rivals(now = Date.now()): Rival[] {
  const rng = seeded(0x5157e5);
  const used = new Set<string>();
  const days = Math.max(0, Math.floor((now - OPENED) / 864e5));
  const out: Rival[] = [];
  for (let i = 0; i < RIVAL_COUNT; i++) {
    let name = '';
    while (!name || used.has(name)) {
      const form = FORMS[Math.floor(rng() * FORMS.length)];
      name = form.replace('{s}', SAINTS[Math.floor(rng() * SAINTS.length)]).replace('{t}', THINGS[Math.floor(rng() * THINGS.length)]);
    }
    used.add(name);
    // Spread from about 60 to 9000 Renown on a gentle curve.
    const base = 60 * Math.pow(150, i / (RIVAL_COUNT - 1)) * (0.92 + rng() * 0.16);
    out.push({ name: `The ${name}`, renown: Math.round(base * (1 + DAILY_GROWTH * days)) });
  }
  return out.sort((a, b) => b.renown - a.renown);
}

/** The full ladder with you in it, strongest first, and your place (1 = top). */
export function ladder(save: SaveData, now = Date.now()): { rows: Rival[]; place: number } {
  const you: Rival = { name: 'Your Sisterhood', renown: renownOf(save), you: true };
  const rows = [...rivals(now), you].sort((a, b) => b.renown - a.renown || Number(!!b.you) - Number(!!a.you));
  return { rows, place: rows.indexOf(you) + 1 };
}
