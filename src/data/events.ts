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
      { label: 'Take the coins', hint: '+80 Tithes. The next Vigil candle is 6s shorter.', outcome: { text: 'Somewhere above, a votive candle gutters out.', tithes: 80, curseVigil: 3 } },
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
      { label: 'Ring it', hint: 'Choose a Bell relic. The next Vigil candle is 4s shorter.', outcome: { text: 'The note shakes dust from the vaults. Something below hears it too.', relic: true, family: 'bell', curseVigil: 2 } },
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
      { label: 'Take the Gutted Candle', hint: 'Lasting: Litanies +40%, but every Vigil candle is 4s shorter.', outcome: { text: 'It flares in your hand, hungry.', gainRelic: 'gutted-candle' } },
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
      { label: 'Swim for it', hint: '60%: a relic. Otherwise lose 15% HP.', chance: 0.6, outcome: { text: 'Your fingers close on a relic.', relic: true }, fail: { text: 'Something below closes on you instead.', hurt: 0.15 } },
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
      { label: 'Bottle the tears', hint: '+2 Seals.', outcome: { text: 'Consecrated oil fetches a fat price.', seals: 2 } },
    ],
  },
  'confessor-ghost': {
    id: 'confessor-ghost',
    title: 'A Confessor\'s Ghost',
    text: 'A dead priest sits in a confessional. "Speak your sins, and I shall weigh them."',
    options: [
      { label: 'Confess everything', hint: '50%: +3 Seals. Otherwise the next Vigil is 6s shorter.', chance: 0.5, outcome: { text: '"You are forgiven." He presses wax into your hand.', seals: 3 }, fail: { text: '"Unforgivable." The candles gutter.', curseVigil: 3 } },
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
  'marble-saint': {
    id: 'marble-saint',
    title: 'A Marble Saint',
    text: 'A marble saint weeps real tears into a cracked basin.',
    options: [
      { label: 'Bathe your wounds', hint: 'Heal everyone 30%. The next Vigil candle is 4s shorter.', outcome: { text: 'The tears are warm. The candle above you is not.', heal: 0.3, curseVigil: 2 } },
      { label: 'Collect the tears', hint: '+1 Seal.', outcome: { text: 'You stopper a phial of consecrated grief.', seals: 1 } },
    ],
  },
  'confession-booth': {
    id: 'confession-booth',
    title: 'An Occupied Confessional',
    text: 'Someone is in the confessional. They have been waiting a very long time for a priest.',
    options: [
      { label: 'Hear the confession', hint: '60%: choose a relic. Otherwise lose 15% HP.', chance: 0.6, outcome: { text: 'The sin is old and heavy. They give you something to carry it.', relic: true }, fail: { text: 'It was not a confession. It was a hunger.', hurt: 0.15 } },
      { label: 'Draw the curtain', hint: 'Nothing happens.', outcome: { text: 'The breathing behind the curtain stops when you leave.' } },
    ],
  },
  'ossuary-wall': {
    id: 'ossuary-wall',
    title: 'A Wall of Skulls',
    text: 'Thousands of skulls stacked in neat rows. One row has a gap, the size of a hand.',
    options: [
      { label: 'Reach into the gap', hint: '+120 Tithes. Lose 10% HP.', outcome: { text: 'Cold coins, colder teeth.', tithes: 120, hurt: 0.1 } },
      { label: 'Add a prayer for them', hint: 'Next fight: +25 Zeal.', outcome: { text: 'The skulls seem to lean closer, listening.', blessZeal: 25 } },
    ],
  },
  'flooded-sacristy': {
    id: 'flooded-sacristy',
    title: 'A Flooded Sacristy',
    text: 'Vestments float in black water. Something gleams below.',
    options: [
      { label: 'Dive for it', hint: '50%: a relic of the bell family. Otherwise lose 20% HP.', chance: 0.5, outcome: { text: 'You surface with a bell that rings underwater.', relic: true, family: 'bell' }, fail: { text: 'Hands in the water hold you down a moment too long.', hurt: 0.2 } },
      { label: 'Wring out a stole', hint: 'Heal everyone 10%.', outcome: { text: 'Damp, but consecrated.', heal: 0.1 } },
    ],
  },
  'pyre-embers': {
    id: 'pyre-embers',
    title: 'A Martyr\'s Pyre',
    text: 'The stake still stands. The embers at its foot have never gone out.',
    options: [
      { label: 'Take an ember', hint: 'Choose a relic of the burn family. Lose 10% HP.', outcome: { text: 'It burns your palm and does not let go.', relic: true, family: 'burn', hurt: 0.1 } },
      { label: 'Kneel in the ash', hint: 'Choose a relic of the martyr family. The next Vigil candle is 6s shorter.', outcome: { text: 'The ash settles on your shoulders like a mantle.', relic: true, family: 'martyr', curseVigil: 3 } },
    ],
  },
  'beggar-saint': {
    id: 'beggar-saint',
    title: 'A Beggar in the Dark',
    text: 'A beggar sits by the path with an empty bowl. Her eyes are too bright.',
    options: [
      { label: 'Give her Tithes', hint: '-60 Tithes. Heal everyone 20% and +20 Zeal next fight.', outcome: { text: 'She blesses you in a tongue no one has spoken for a thousand years.', tithes: -60, heal: 0.2, blessZeal: 20 } },
      { label: 'Pass her by', hint: 'Nothing happens. Probably.', outcome: { text: 'Behind you, the bowl is suddenly full.' } },
    ],
  },
  'cracked-reliquary': {
    id: 'cracked-reliquary',
    title: 'A Cracked Reliquary',
    text: 'A gilded box split down the middle. The finger bone inside points the way you came.',
    options: [
      { label: 'Trade a relic for it', hint: 'Lose one relic you hold. Choose a new one.', outcome: { text: 'One relic for another. The bone points forward now.', dropRelic: true, relic: true } },
      { label: 'Follow where it points', hint: 'Heal everyone 15%.', outcome: { text: 'You step back into a pocket of quiet and catch your breath.', heal: 0.15 } },
    ],
  },
  'hanging-bells': {
    id: 'hanging-bells',
    title: 'A Forest of Bells',
    text: 'Hundreds of small bells hang from the ceiling. None of them has a clapper.',
    options: [
      { label: 'Ring one anyway', hint: '50%: +2 Seals. Otherwise the next Vigil candle is 8s shorter.', chance: 0.5, outcome: { text: 'It rings. Something far away answers with gold.', seals: 2 }, fail: { text: 'It rings, and every candle in the crypt leans toward the sound.', curseVigil: 4 } },
      { label: 'Walk through quietly', hint: 'Next fight: +10 Zeal.', outcome: { text: 'Not one bell stirs. Your Sisters steady their breath.', blessZeal: 10 } },
    ],
  },
  'scriptorium-desk': {
    id: 'scriptorium-desk',
    title: 'A Copyist\'s Desk',
    text: 'An unfinished psalm. The ink is wet. The copyist is not here.',
    options: [
      { label: 'Finish the verse', hint: 'Next fight: +40 Zeal. Lose 10% HP.', outcome: { text: 'The words come too easily. They take something to come.', blessZeal: 40, hurt: 0.1 } },
      { label: 'Take the gold leaf', hint: '+90 Tithes.', outcome: { text: 'You scrape the gilding into your purse.', tithes: 90 } },
    ],
  },
  'dead-cart': {
    id: 'dead-cart',
    title: 'A Cart of the Dead',
    text: 'A cart of the dead, abandoned mid-route. A purse hangs from the driver\'s belt.',
    options: [
      { label: 'Take the purse', hint: '+150 Tithes. Lose 20% HP.', outcome: { text: 'The coins are fine. Your Sisters are coughing.', tithes: 150, hurt: 0.2 } },
      { label: 'Say the rites for them', hint: '+1 Seal. Heal everyone 10%.', outcome: { text: 'Someone had to. The air clears a little.', seals: 1, heal: 0.1 } },
    ],
  },
  'mirror-pool': {
    id: 'mirror-pool',
    title: 'A Still Pool',
    text: 'Your Sisters\' reflections in the pool are wounded where they are not.',
    options: [
      { label: 'Touch the water', hint: '50%: heal everyone 40%. Otherwise lose 15% HP.', chance: 0.5, outcome: { text: 'The reflections take your wounds and sink.', heal: 0.4 }, fail: { text: 'The reflections give you theirs.', hurt: 0.15 } },
      { label: 'Look away', hint: 'Nothing happens.', outcome: { text: 'You do not look back. You are fairly sure they do.' } },
    ],
  },
  'iron-maiden': {
    id: 'iron-maiden',
    title: 'An Open Iron Maiden',
    text: 'The spikes are clean. A relic rests inside, where the heart would be.',
    options: [
      { label: 'Reach in', hint: 'Choose a relic. Lose 20% HP.', outcome: { text: 'The lid shifts. You were quick enough. Almost.', relic: true, hurt: 0.2 } },
      { label: 'Close it', hint: '+40 Tithes from the lock.', outcome: { text: 'The lock is worth something to someone.', tithes: 40 } },
    ],
  },
};
