import type { Rarity } from './types';

/**
 * Hounds: the Church's war-dogs. One goes with the party into every fight, in a
 * slot of its own, and howls at the start of each round. A howl can lift the
 * Sisters' attack, blunt the blows they take, mend them, shield the front
 * Sister, feed Zeal, or scent out the foes (lowering their Armor and Magic
 * Resist). Rarer hounds howl two blessings at once.
 */
export interface Howl {
  /** Sisters deal this much more damage. */
  atk?: number;
  /** Sisters take this much less damage. */
  ward?: number;
  /** Heal the most wounded Sister this share of her max HP. */
  mend?: number;
  /** Zeal gained. */
  zeal?: number;
  /** Shield the front Sister for this share of her max HP. */
  shield?: number;
  /** Lower every foe's Armor and Magic Resist by this share (Sunder and Hex). */
  scent?: number;
}

export interface HoundDef {
  id: string;
  name: string;
  rarity: Rarity;
  howlName: string;
  howl: Howl;
  flavor: string;
  /** Coat colours for the placeholder art. */
  coat: number;
  eye: number;
}

export const HOUNDS: HoundDef[] = [
  { id: 'cur', name: 'Kennel Cur', rarity: 'R', howlName: 'Low Growl', howl: { atk: 0.05 }, flavor: 'Bred in the cloister yard. Bites what it is told to.', coat: 0x7a5a3a, eye: 0xffd27a },
  { id: 'mutt', name: 'Almshouse Mutt', rarity: 'R', howlName: 'Soft Whine', howl: { mend: 0.025 }, flavor: 'Fed on the poor-box scraps. It stays by the wounded.', coat: 0x9a8a6a, eye: 0xc8e0ff },
  { id: 'lurcher', name: 'Censer Lurcher', rarity: 'SR', howlName: 'Smoke Bay', howl: { zeal: 3 }, flavor: 'Runs ahead of the procession through the incense smoke.', coat: 0x5a5560, eye: 0xffb04a },
  { id: 'mastiff', name: 'Bell Mastiff', rarity: 'SR', howlName: 'Guard Bark', howl: { ward: 0.07 }, flavor: 'Sleeps under the great bell and wakes to every toll.', coat: 0x4a3a2a, eye: 0xffe08a },
  { id: 'beagle', name: 'Relic Beagle', rarity: 'SR', howlName: 'Scenting Cry', howl: { scent: 0.12 }, flavor: 'Can smell a false relic, and a heretic, through stone.', coat: 0xb08050, eye: 0xa0ffb0 },
  { id: 'pyre', name: 'Pyre Hound', rarity: 'SSR', howlName: 'Ashen Howl', howl: { atk: 0.06, scent: 0.1 }, flavor: 'Whelped in the ashes of a burning. Its breath smells of smoke.', coat: 0x3a2020, eye: 0xff6a2a },
  { id: 'grave', name: 'Grave Mastiff', rarity: 'SSR', howlName: 'Churchyard Watch', howl: { ward: 0.06, shield: 0.12 }, flavor: 'Guards the graves of the Sisters. Nothing gets past it twice.', coat: 0x2e3238, eye: 0x9ad0ff },
  { id: 'shuck', name: 'Black Shuck', rarity: 'UR', howlName: 'Doom Howl', howl: { atk: 0.08, zeal: 3 }, flavor: 'A great black dog with eyes like coals. To hear it is to know the end is near, for someone.', coat: 0x15121a, eye: 0xff3a3a },
  { id: 'wolfhound', name: "Saint's Wolfhound", rarity: 'UR', howlName: 'Sworn Chorus', howl: { ward: 0.06, mend: 0.04 }, flavor: 'Said to have walked beside the first Abbess. It has not aged a day.', coat: 0xe8e0d0, eye: 0xffd700 },
];

export const houndDef = (id: string) => HOUNDS.find((h) => h.id === id);
