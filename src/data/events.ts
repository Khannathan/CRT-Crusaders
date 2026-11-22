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
  /** Gain this relic or burden for the rest of the run. */
  gainRelic?: string;
  /** Lose one relic you hold (never a burden). */
  dropRelic?: boolean;
  /** The relic choice comes from this family. */
  family?: 'burn' | 'bell' | 'martyr';
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
      { label: 'Pray', hint: 'Heal everyone 25%.', outcome: { text: 'The Mother\'s silence falls over you. Wounds close.', heal: 0.25 } },
      { label: 'Bleed on it', hint: 'Lose 15% HP. Next fight starts with +50 Zeal.', outcome: { text: 'The altar drinks deep. Your blood sings hymns.', hurt: 0.15, blessZeal: 50 } },
    ],
  },
  'sealed-coffer': {
    id: 'sealed-coffer',
    title: 'A Sealed Coffer',
    text: 'An iron coffer, chained and stamped with an unfamiliar order.',
    options: [
      { label: 'Force it open', hint: 'Lose 10% HP. Take a relic.', outcome: { text: 'The chains bite, but the lid gives.', hurt: 0.1, relic: true } },
      { label: 'Leave it', hint: 'Nothing happens.', outcome: { text: 'Some seals were set by better women than you.' } },
    ],
  },
  'tithe-box': {
    id: 'tithe-box',
    title: 'The Tithe Box',
    text: "A poor box, overflowing. The dead won't miss it. Probably.",
    options: [
      { label: 'Take the coins', hint: '+80 Tithes. The next Vigil candle is 3 rounds shorter.', outcome: { text: 'Somewhere above, a votive candle gutters out.', tithes: 80, curseVigil: 3 } },
      { label: 'Leave it', hint: 'Nothing happens.', outcome: { text: 'You walk on, hands clean, purse light.' } },
    ],
  },
  'whispering-bones': {
    id: 'whispering-bones',
    title: 'Whispering Bones',
    text: 'A heap of martyrs\' skulls murmurs the names of the faithful.',
    options: [
      { label: 'Listen closely', hint: '50%: +2 Seals. Otherwise lose 20% HP.', chance: 0.5, outcome: { text: 'They whisper where the old seals lie.', seals: 2 }, fail: { text: 'The whispers turn to screams.', hurt: 0.2 } },
      { label: 'Walk on', hint: 'Nothing happens.', outcome: { text: 'The murmuring follows you a while.' } },
    ],
  },
  'lost-penitent': {
    id: 'lost-penitent',
    title: 'A Lost Penitent',
    text: 'A flagellant kneels in the dark, too weak to rise.',
    options: [
      { label: 'Share your water', hint: 'Lose 5% HP. Heal 15% and +20 Zeal next fight.', outcome: { text: 'She traces the sign of the Wound on each brow.', hurt: 0.05, heal: 0.15, blessZeal: 20 } },
      { label: 'Ask the way', hint: '+40 Tithes.', outcome: { text: 'She points to a hidden purse in the wall.', tithes: 40 } },
    ],
  },
  'burning-scriptorium': {
    id: 'burning-scriptorium',
    title: 'The Burning Scriptorium',
    text: 'Heretical books smoulder on their shelves. The fire has not touched one reliquary.',
    options: [
      { label: 'Reach through the flames', hint: 'Lose 15% HP. Choose a Burn relic.', outcome: { text: 'Your sleeves catch, but the coal in your palm stays warm.', hurt: 0.15, relic: true, family: 'burn' } },
      { label: 'Fan the fire', hint: 'Next fight: +30 Zeal.', outcome: { text: 'The heresy burns brighter. So does your fervour.', blessZeal: 30 } },
    ],
  },
  'silent-belfry': {
    id: 'silent-belfry',
    title: 'A Silent Belfry',
    text: 'A rope hangs from a bell that has not rung in a century.',
    options: [
      { label: 'Ring it', hint: 'Choose a Bell relic. The next Vigil candle is 2 rounds shorter.', outcome: { text: 'The note shakes dust from the vaults. Something below hears it too.', relic: true, family: 'bell', curseVigil: 2 } },
      { label: 'Cut the rope', hint: '+60 Tithes.', outcome: { text: 'Hemp of good quality. The sexton will pay.', tithes: 60 } },
    ],
  },
  'ossuary-of-the-willing': {
    id: 'ossuary-of-the-willing',
    title: 'Ossuary of the Willing',
    text: 'Martyrs who chose their deaths lie here, each skull crowned in thorns.',
    options: [
      { label: 'Take a crown of thorns', hint: 'Lose 20% HP. Choose a Martyr relic.', outcome: { text: 'The thorns find your brow as if they knew it.', hurt: 0.2, relic: true, family: 'martyr' } },
      { label: 'Pray for them', hint: 'Heal everyone 20%.', outcome: { text: 'Their peace becomes yours, for a while.', heal: 0.2 } },
    ],
  },
  'mendicant-friar': {
    id: 'mendicant-friar',
    title: 'The Mendicant Friar',
    text: '"Poverty is the shortest road to God, Sisters. I can show you."',
    options: [
      { label: 'Swear the Oath of Poverty', hint: 'Lasting: attack +20%, but fights pay half the Tithes.', outcome: { text: 'Your purse feels lighter. Your blade, keener.', gainRelic: 'oath-of-poverty' } },
      { label: 'Give him alms', hint: '-40 Tithes. Heal everyone 30%.', outcome: { text: 'He blesses you with a dirty thumb. It works.', tithes: -40, heal: 0.3 } },
    ],
  },
  'blood-font': {
    id: 'blood-font',
    title: 'The Blood Font',
    text: 'A font of red water. The carving reads: GIVE, AND BE GIVEN STRENGTH.',
    options: [
      { label: 'Drink deep', hint: 'Lasting: attack +25%, max HP -15%.', outcome: { text: 'It tastes of iron and old promises.', gainRelic: 'blood-pact' } },
      { label: 'Wash your wounds', hint: 'Heal everyone 15%.', outcome: { text: 'The water stings, then soothes.', heal: 0.15 } },
    ],
  },
  'hermit-of-silence': {
    id: 'hermit-of-silence',
    title: 'The Hermit of Silence',
    text: 'A hermit who has not spoken in forty years offers you a slate: VOW?',
    options: [
      { label: 'Take the Vow of Silence', hint: 'Lasting: start fights with 40 Zeal, but Zeal gains -30%.', outcome: { text: 'Your Sisters fall silent. Their prayers grow loud inside.', gainRelic: 'vow-of-silence' } },
      { label: 'Shake your head', hint: 'Nothing happens.', outcome: { text: 'He nods, unsurprised, and writes nothing more.' } },
    ],
  },
  'inquisitor-ledger': {
    id: 'inquisitor-ledger',
    title: "An Inquisitor's Ledger",
    text: 'A ledger of names marked for burning. Yours is near the bottom.',
    options: [
      { label: 'Accept the Brand', hint: "Lasting: crits +15%, armor -20%.", outcome: { text: 'Branded a heretic, you fight like one.', gainRelic: 'heretics-brand' } },
      { label: 'Burn the page', hint: '+1 Seal.', outcome: { text: 'Your name curls into smoke.', seals: 1 } },
    ],
  },
  'guttering-reliquary': {
    id: 'guttering-reliquary',
    title: 'A Guttering Reliquary',
    text: 'A candle burns down to the wick inside a cage of saint-bones.',
    options: [
      { label: 'Take the Gutted Candle', hint: 'Lasting: Litanies +40%, but every Vigil candle is 2 rounds shorter.', outcome: { text: 'It flares in your hand, hungry.', gainRelic: 'gutted-candle' } },
      { label: 'Let it burn out', hint: 'Next fight: +20 Zeal.', outcome: { text: 'You watch it die and feel its last warmth.', blessZeal: 20 } },
    ],
  },
  'relic-merchant': {
    id: 'relic-merchant',
    title: 'The Relic Merchant',
    text: 'A pale man with a cart of bones. "A fair trade, Sisters. One of yours for one of mine."',
    options: [
      { label: 'Trade a relic', hint: 'Lose a random relic you hold. Choose a new one.', outcome: { text: 'He wraps your old relic in sackcloth and smiles.', dropRelic: true, relic: true } },
      { label: 'Sell him nothing', hint: '+30 Tithes for your trouble.', outcome: { text: 'He tosses you a coin for wasting his time.', tithes: 30 } },
    ],
  },
  'flooded-chapel': {
    id: 'flooded-chapel',
    title: 'The Flooded Chapel',
    text: 'Pews float in black water. Something glints at the altar.',
    options: [
      { label: 'Swim for it', hint: '60%: a relic. Otherwise lose 15% HP.', chance: 0.6, outcome: { text: 'Your fingers close on something holy.', relic: true }, fail: { text: 'Something below closes on you instead.', hurt: 0.15 } },
      { label: 'Skirt the water', hint: 'Nothing happens.', outcome: { text: 'You keep your boots, and your blood.' } },
    ],
  },
  'plague-cart': {
    id: 'plague-cart',
    title: 'A Plague Cart',
    text: 'The dead are stacked high, and their purses with them.',
    options: [
      { label: 'Search the dead', hint: '+120 Tithes. Lose 10% HP.', outcome: { text: 'You find coin, and a cough.', tithes: 120, hurt: 0.1 } },
      { label: 'Give them rites', hint: 'Next fight: +25 Zeal. Heal 10%.', outcome: { text: 'They rest. You feel lighter.', blessZeal: 25, heal: 0.1 } },
    ],
  },
  'weeping-statue': {
    id: 'weeping-statue',
    title: 'The Weeping Statue',
    text: 'A statue of the Mother weeps oil that smells of myrrh.',
    options: [
      { label: 'Anoint the Sisters', hint: 'Heal everyone 35%.', outcome: { text: 'The oil closes every wound it touches.', heal: 0.35 } },
      { label: 'Bottle the tears', hint: '+2 Seals.', outcome: { text: 'Holy oil fetches a holy price.', seals: 2 } },
    ],
  },
  'confessor-ghost': {
    id: 'confessor-ghost',
    title: 'A Confessor\'s Ghost',
    text: 'A dead priest sits in a confessional. "Speak your sins, and I shall weigh them."',
    options: [
      { label: 'Confess everything', hint: '50%: +3 Seals. Otherwise the next Vigil is 3 rounds shorter.', chance: 0.5, outcome: { text: '"You are forgiven." He presses wax into your hand.', seals: 3 }, fail: { text: '"Unforgivable." The candles gutter.', curseVigil: 3 } },
      { label: 'Confess nothing', hint: 'Nothing happens.', outcome: { text: 'He sighs, and fades.' } },
    ],
  },
  'pilgrim-camp': {
    id: 'pilgrim-camp',
    title: 'A Pilgrim Camp',
    text: 'Living pilgrims, lost on their way to the crypt\'s heart, share their fire.',
    options: [
      { label: 'Rest with them', hint: 'Heal everyone 20%. Next fight: +15 Zeal.', outcome: { text: 'Bread, songs, a little hope.', heal: 0.2, blessZeal: 15 } },
      { label: 'Ask for their relic', hint: 'Choose a relic. -50 Tithes as a gift.', outcome: { text: 'They part with it gladly, for the cause.', relic: true, tithes: -50 } },
    ],
  },
};