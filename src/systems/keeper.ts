import type { SaveData } from '../state/save';
import { CRUSADERS } from '../data/crusaders';
import type { CrusaderDef } from '../data/types';
import { addBond, bondLevel, bondOf } from './bonds';
import { dayKey } from './tasks';
import { sisterPower } from './power';

/**
 * The Keeper of the Sanctum: a Sister the player picks stands on the home
 * screen and speaks. What she says follows the hour, her bond and what waits
 * to be done. Speaking with her once a day adds a little bond.
 */
export const KEEPER_BOND = 25;

export interface KeeperState {
  id?: string;
  /** Local day of the last daily blessing. */
  day?: string;
}

const keeperState = (save: SaveData): KeeperState => (save.keeper ??= {});

/** Her chosen Keeper, or (until one is chosen) the strongest Sister sworn, those `prefer` likes first (e.g. with finished art). */
export function keeperOf(save: SaveData, prefer: (id: string) => boolean = () => true): CrusaderDef | undefined {
  const st = keeperState(save);
  if (st.id && save.owned[st.id]) return CRUSADERS.find((c) => c.id === st.id);
  const owned = CRUSADERS.filter((c) => save.owned[c.id]);
  return owned.sort((a, b) => Number(prefer(b.id)) - Number(prefer(a.id)) || sisterPower(save, b) - sisterPower(save, a))[0];
}

export function chooseKeeper(save: SaveData, id: string) {
  if (!save.owned[id]) return false;
  keeperState(save).id = id;
  return true;
}

export const blessingReady = (save: SaveData, now = Date.now()) => !!keeperOf(save) && keeperState(save).day !== dayKey(now);

/** The first word with her each day: a little bond. Returns the bond gained. */
export function visitKeeper(save: SaveData, now = Date.now()): number {
  const c = keeperOf(save);
  if (!c || !blessingReady(save, now)) return 0;
  keeperState(save).day = dayKey(now);
  addBond(save, [c.id], KEEPER_BOND);
  return KEEPER_BOND;
}

const HOUR: Record<'dawn' | 'day' | 'dusk' | 'night', string[]> = {
  dawn: ['Matins rang an hour ago. The dead do not sleep in.', 'Dawn. Wash, pray, sharpen. In that order.'],
  day: ['The sun is high and the crypts are dark. March!', 'Idle hands are the heretic\'s workshop.'],
  dusk: ['Vespers soon. Light a pyre for the fallen.', 'The shadows lengthen. So does my patience. Barely.'],
  night: ['You keep late vigil. Good. So do the damned.', 'Rest, if you must. I will watch the door, and the other Orders.'],
};

const BOND: Record<'low' | 'mid' | 'high', string[]> = {
  low: ['I serve the Order. You command my sword. Nothing more.', 'Prove your zeal, and I may prove my trust.'],
  mid: ['You fight well for one who prays so little.', 'I have started saving you a seat at Compline.'],
  high: ['Name a city and I will burn it. I will not even ask why.', 'When I pray now, your name is in it. Do not tell the Abbess.'],
};

const ORDER_LINES: Record<string, string[]> = {
  'Iron Vigil': ['The wall holds because I hold. Whoever is outside it is already dead.', 'The Drowned Litany calls our walls a sin against the tide. Let them try the gate.'],
  'Ashen Mercy': ['Mercy is fire. Everything else is cowardice.', 'I have closed a thousand eyes. The Sepulcher Watch wanted their bones. They got ash.'],
  'Veiled Tribunal': ['Every soul is guilty. I am only patient.', 'The Inquisition brands without a verdict. Amateurs.'],
  'Sepulcher Watch': ['The dead are ours. The Ashen Mercy burns what is ours. Remember that.', 'A widow wept at the vault door. She is inside it now.'],
  'Choir of the Pyre': ['Sing with me, or feed the pyre. Those are the choices.', 'That Belfry rings over our hymn. One day we will melt their bell.'],
  'Verdant Martyrdom': ['I bled for the roots this morning. Have you?', 'The Confessors have no blood to give. Glass is a coward\'s flesh.'],
  'Drowned Litany': ['The tide rises for the faithful and drowns the rest. It is a kindness.', 'The Iron Vigil builds walls against the sea. The sea is patient.'],
  'Confessors of Glass': ['I see the sin in you. Do not make me look closer.', 'The Martyrdom calls its bleeding faith. It is only meat.'],
  'Crimson Inquisition': ['Confess, and burn clean. Then we hunt again!', 'The Tribunal weighs. We already know.'],
  'Hallowed Belfry': ['Every toll is a life. I ring often.', 'The Choir sings to drown out our bell. Nothing drowns the bell.'],
};

const hourOf = (now: number) => {
  const h = new Date(now).getHours();
  return h >= 5 && h < 11 ? 'dawn' : h >= 11 && h < 17 ? 'day' : h >= 17 && h < 21 ? 'dusk' : 'night';
};

/** Things waiting to be done, said plainly. Passed in by the Sanctum so this file stays free of every system. */
export interface KeeperNudges {
  vigilFull?: boolean;
  novitiate?: boolean;
  deeds?: boolean;
  penance?: boolean;
}

/** What she may say now, nudges first. */
export function keeperLines(save: SaveData, c: CrusaderDef, nudges: KeeperNudges = {}, now = Date.now()): string[] {
  const lv = bondLevel(bondOf(save, c.id).xp);
  const out: string[] = [];
  if (nudges.vigilFull) out.push('The Vigil\'s coffers overflow. Claim them before they spoil!');
  if (nudges.novitiate) out.push('The Novitiate has rewards for you. Go, novice!');
  if (nudges.deeds) out.push('Your deeds are written. Claim their glory in the Cloister.');
  if (nudges.penance) out.push('Your Penance is done. Collect its wax.');
  out.push(...HOUR[hourOf(now)]);
  out.push(...(ORDER_LINES[c.order] ?? []));
  out.push(...BOND[lv >= 15 ? 'high' : lv >= 5 ? 'mid' : 'low']);
  return out;
}
