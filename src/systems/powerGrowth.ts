import { CRUSADERS } from '../data/crusaders';
import type { SaveData } from '../state/save';
import { earn } from './currency';
import { accountPower, sisterPower } from './power';
import { skillLevels } from './skillLevels';
import { MAX_ASCENSION, levelCap } from './stats';
import { SYMBOL_MAX } from './symbols';

/**
 * Power you can feel: every rise in account Power pops on screen, and round
 * milestones pay Gilt and give the account a rank of devotion. The walls have
 * no top (Tower, Heresy), so neither do the reasons to grow.
 */
export interface PowerMilestone {
  at: number;
  name: string;
  gilt: number;
}

export const POWER_MILESTONES: PowerMilestone[] = [
  { at: 10_000, name: 'Ardent', gilt: 50 },
  { at: 25_000, name: 'Zealous', gilt: 100 },
  { at: 50_000, name: 'Fervent', gilt: 150 },
  { at: 100_000, name: 'Consecrated', gilt: 200 },
  { at: 175_000, name: 'Anointed', gilt: 250 },
  { at: 250_000, name: 'Sainted', gilt: 300 },
  { at: 400_000, name: 'Exalted', gilt: 350 },
  { at: 600_000, name: 'Seraphic', gilt: 400 },
  { at: 850_000, name: 'Apostolic', gilt: 450 },
  { at: 1_100_000, name: 'Undying', gilt: 500 },
];

export const milestonesReached = (save: SaveData) => save.powerMilestone ?? 0;
export const nextMilestone = (save: SaveData) => POWER_MILESTONES[milestonesReached(save)];
export const devotionName = (save: SaveData) => POWER_MILESTONES[milestonesReached(save) - 1]?.name;

export interface PowerNote {
  /** Power gained since the last look (0 when none, or on the first look). */
  gain: number;
  power: number;
  /** Milestones crossed just now; their Gilt is already paid. */
  reached: PowerMilestone[];
}

/** Records account Power, pays any milestone crossed, and says how much it rose. */
export function notePower(save: SaveData): PowerNote {
  const power = accountPower(save);
  const seen = save.powerSeen;
  save.powerSeen = power;
  const reached: PowerMilestone[] = [];
  while (milestonesReached(save) < POWER_MILESTONES.length && power >= POWER_MILESTONES[milestonesReached(save)].at) {
    const m = POWER_MILESTONES[milestonesReached(save)];
    earn(save, m.gilt);
    reached.push(m);
    save.powerMilestone = milestonesReached(save) + 1;
  }
  return { gain: seen === undefined ? 0 : Math.max(0, power - seen), power, reached };
}

export interface GrowTarget {
  id: string;
  name: string;
  hint: string;
}

/** Where a short party should grow first: the weakest of the strongest four, and her next step. */
export function growTarget(save: SaveData, party?: string[]): GrowTarget | undefined {
  const pool = (party?.length ? CRUSADERS.filter((c) => party.includes(c.id)) : CRUSADERS)
    .filter((c) => save.owned[c.id])
    .map((c) => ({ c, p: sisterPower(save, c) }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 4);
  const weakest = pool.at(-1)?.c;
  if (!weakest) return undefined;
  const o = save.owned[weakest.id];
  const hint =
    o.level < levelCap(o)
      ? 'Level her up'
      : (o.asc ?? 0) < MAX_ASCENSION
        ? 'Ascend her'
        : skillLevels(save, weakest.id).some((l) => l < 5)
          ? 'Raise her skills'
          : (o.symbol ?? -1) < SYMBOL_MAX
            ? 'Raise her Holy Symbol'
            : 'Take her Vows, and arm her';
  return { id: weakest.id, name: weakest.name.split(' ')[0], hint };
}
