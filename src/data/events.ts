/** What an event choice does to the run. Percentages are of each crusader's max HP. */
export interface EventOutcome {
  text: string;
  heal?: number;
  hurt?: number;
  tithes?: number;
  seals?: number;
  /** Opens a relic choice. */
  relic?: boolean;
  /** Extra Zeal at the start of the next fight. */
  blessZeal?: number;
  /** The next fight's Vigil candle is this many rounds shorter. */
  curseVigil?: number;
}

export interface EventOption {
  label: string;
  /** Shown under the label so the player knows the stakes. */
  hint: string;
  /** Chance of `outcome`; otherwise `fail`. Omit for a sure thing. */
  chance?: number;
  outcome: EventOutcome;
  fail?: EventOutcome;
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  options: EventOption[];
}

/** Crypt events. Names and wording are placeholders until the name library arrives. */
export const EVENTS: Record<string, EventDef> = {
  'drowned-altar': {
    id: 'drowned-altar',
    title: 'A Drowned Altar',
    text: 'Black water laps at an altar still warm with candle wax.',
    options: [
      { label: 'Pray', hint: 'Heal everyone 25%.', outcome: { text: 'A calm settles over the party.', heal: 0.25 } },
      { label: 'Bleed on it', hint: 'Lose 15% HP. Next fight starts with +50 Zeal.', outcome: { text: 'The altar drinks. Your blood sings.', hurt: 0.15, blessZeal: 50 } },
    ],
  },
  'sealed-coffer': {
    id: 'sealed-coffer',
    title: 'A Sealed Coffer',
    text: 'An iron coffer, chained and stamped with an unfamiliar order.',
    options: [
      { label: 'Force it open', hint: 'Lose 10% HP. Take a relic.', outcome: { text: 'The chains bite, but the lid gives.', hurt: 0.1, relic: true } },
      { label: 'Leave it', hint: 'Nothing happens.', outcome: { text: 'Some seals are best left unbroken.' } },
    ],
  },
  'tithe-box': {
    id: 'tithe-box',
    title: 'The Tithe Box',
    text: "A poor box, overflowing. The dead won't miss it. Probably.",
    options: [
      { label: 'Take the coins', hint: '+80 Tithes. The next Vigil candle is 3 rounds shorter.', outcome: { text: 'Somewhere, a candle gutters.', tithes: 80, curseVigil: 3 } },
      { label: 'Leave it', hint: 'Nothing happens.', outcome: { text: 'You walk on with clean hands.' } },
    ],
  },
  'whispering-bones': {
    id: 'whispering-bones',
    title: 'Whispering Bones',
    text: 'A heap of skulls murmurs the names of the faithful.',
    options: [
      { label: 'Listen closely', hint: '50%: +2 Seals. Otherwise lose 20% HP.', chance: 0.5, outcome: { text: 'They whisper where the old seals lie.', seals: 2 }, fail: { text: 'The whispers turn to screams.', hurt: 0.2 } },
      { label: 'Walk on', hint: 'Nothing happens.', outcome: { text: 'The murmuring follows you a while.' } },
    ],
  },
  'lost-penitent': {
    id: 'lost-penitent',
    title: 'A Lost Penitent',
    text: 'A pilgrim kneels in the dark, too weak to stand.',
    options: [
      { label: 'Share your water', hint: 'Lose 5% HP. Heal 15% and +20 Zeal next fight.', outcome: { text: 'She blesses each of you by name.', hurt: 0.05, heal: 0.15, blessZeal: 20 } },
      { label: 'Ask the way', hint: '+40 Tithes.', outcome: { text: 'She points to a hidden purse in the wall.', tithes: 40 } },
    ],
  },
};
