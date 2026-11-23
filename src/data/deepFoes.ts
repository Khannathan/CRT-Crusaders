/**
 * The deeper crypts' own hosts (round 9 content explosion). Each of the
 * sixteen crypts past the Belfry gets three foes, an elite and a boss of its
 * own. Every one is built on an existing foe (`tpl`): same stats and skill
 * shapes, its own name, look and skill names, plus one small twist. Each
 * crypt keeps the encounter layout of the crypt it was patterned on, with its
 * own foes swapped in, so the difficulty ramp is unchanged.
 *
 * Until their art arrives, each borrows its template's (see `art`).
 * Names are placeholders like the rest, pending the name library.
 */

/** A small change on top of the template. Each one trades a little power for a habit. */
export type Twist = 'bleed' | 'poison' | 'weaken' | 'zeal' | 'sunder' | 'swift' | 'stout' | 'burst' | 'none';
/** Boss twists: a hunt-style trait, paid for with a little HP. */
export type BossTwist = 'enrage' | 'regen' | 'none';

export interface DeepFoe {
  tpl: string;
  id: string;
  name: string;
  color: number;
  /** New names for the template's skills, in order (missing ones keep theirs). */
  skills: string[];
  twist: Twist;
  bane?: string;
}

export interface DeepBoss {
  id: string;
  name: string;
  color: number;
  /** Skill names, then phase-2 skill names, then the Blasphemy. */
  skills: string[];
  phase2: string[];
  blasphemy: string;
  text: string;
  twist: BossTwist;
  bane: string;
}

export interface DeepCrypt {
  crypt: string;
  foes: DeepFoe[];
  boss: DeepBoss;
}

export const DEEP_HOSTS: DeepCrypt[] = [
  {
    crypt: 'weeping-cloister',
    foes: [
      { tpl: 'husk', id: 'weeping-penitent', name: 'Weeping Penitent', color: 0x7d7f8c, skills: ['Tearful Blow'], twist: 'weaken' },
      { tpl: 'acolyte', id: 'cloister-novice', name: 'Drowned Novice', color: 0x5d7488, skills: ['Wet Rosary', 'Saltwater Vow'], twist: 'none' },
      { tpl: 'ringer', id: 'lament-bell', name: 'Lament Bell', color: 0x9c7a58, skills: ['Peal of Grief'], twist: 'zeal' },
      { tpl: 'warden', id: 'cloister-keeper', name: 'Cloister Keeper', color: 0x66635a, skills: ['Wall of Prayer', 'Grieving Shove'], twist: 'stout' },
    ],
    boss: { id: 'sister-lament', name: 'Sister Lament', color: 0x6b4f6e, skills: ['Endless Weeping', 'Clutch of Sorrow', 'Call the Mourners'], phase2: ['Endless Weeping', 'Clutch of Sorrow', 'Flood of Tears', 'Call the Mourners'], blasphemy: 'Vigil Without End', text: 'Sister Lament lifts her veil. There are no eyes, only tears.', twist: 'none', bane: 'Ashen Mercy' },
  },
  {
    crypt: 'ash-scriptorium',
    foes: [
      { tpl: 'pilgrim', id: 'ink-bloated', name: 'Ink-Bloated Copyist', color: 0x3c3a44, skills: ['Spew Ink'], twist: 'none' },
      { tpl: 'thief', id: 'page-thief', name: 'Page Thief', color: 0xb59a5a, skills: ['Tear the Margin', 'Paper Cut'], twist: 'bleed' },
      { tpl: 'nun', id: 'ash-scribe', name: 'Ash Scribe', color: 0x6e6a5c, skills: ['Burning Psalm', 'Smudged Touch'], twist: 'none' },
      { tpl: 'bishop', id: 'illuminator', name: 'The Illuminator', color: 0x8a6a2a, skills: ['Gilded Letter', 'Quill Hook', 'Raise the Copyist'], twist: 'none' },
    ],
    boss: { id: 'unbound-scribe', name: 'The Unbound Scribe', color: 0x4a3a2a, skills: ['Burning Index', 'Strike from the Record', 'Call the Copyists'], phase2: ['Burning Index', 'Strike from the Record', 'The Last Page', 'Call the Copyists'], blasphemy: 'Damnatio Memoriae', text: 'The Scribe tears out its own pages and sets them alight.', twist: 'enrage', bane: 'Veiled Tribunal' },
  },
  {
    crypt: 'hanging-chapel',
    foes: [
      { tpl: 'hound', id: 'gallows-hound', name: 'Gallows Hound', color: 0xa99a84, skills: ['Noose Bite'], twist: 'swift' },
      { tpl: 'wraith', id: 'swaying-wraith', name: 'Swaying Wraith', color: 0x8b6e9a, skills: ['Last Breath'], twist: 'none' },
      { tpl: 'lurker', id: 'rope-lurker', name: 'Rope Lurker', color: 0x4a4038, skills: ['Hangman\'s Pull', 'Rope Burn'], twist: 'none' },
      { tpl: 'golem', id: 'gibbet-golem', name: 'Gibbet Golem', color: 0x6e5a40, skills: ['Crush and Drop', 'The Long Drop'], twist: 'none' },
    ],
    boss: { id: 'hanged-deacon', name: 'The Hanged Deacon', color: 0x5a3a3a, skills: ['Sermon from the Rope', 'Strangling Grip', 'Cut Down the Hanged'], phase2: ['Sermon from the Rope', 'Strangling Grip', 'Snap of the Rope', 'Cut Down the Hanged'], blasphemy: 'The Gallows Mass', text: 'The rope snaps. The Deacon does not fall.', twist: 'none', bane: 'Hollow Bell' },
  },
  {
    crypt: 'bone-orchard',
    foes: [
      { tpl: 'pilgrim', id: 'pale-fruit', name: 'Pale Fruit', color: 0xd8d0b0, skills: ['Burst of Rot'], twist: 'burst' },
      { tpl: 'thief', id: 'orchard-crow', name: 'Orchard Crow', color: 0x2a2a30, skills: ['Peck the Eyes', 'Rake'], twist: 'swift' },
      { tpl: 'nun', id: 'root-nun', name: 'Root-Bound Nun', color: 0x5a6a3a, skills: ['Psalm of Spores', 'Grasping Root'], twist: 'stout' },
      { tpl: 'golem', id: 'ossuary-tree', name: 'Ossuary Tree', color: 0x8a8068, skills: ['Root Heave', 'Falling Bough'], twist: 'none' },
    ],
    boss: { id: 'the-gardener', name: 'The Gardener', color: 0x4f5a30, skills: ['Prune', 'Graft', 'Sow the Dead'], phase2: ['Prune', 'Graft', 'Harvest', 'Sow the Dead'], blasphemy: 'The Bitter Harvest', text: 'The Gardener kneels, and the whole orchard bends toward you.', twist: 'regen', bane: 'Thorn Covenant' },
  },
  {
    crypt: 'salt-catacomb',
    foes: [
      { tpl: 'husk', id: 'salt-mummy', name: 'Salt Mummy', color: 0xd8d4c8, skills: ['Brine Fist'], twist: 'stout' },
      { tpl: 'hound', id: 'brine-jackal', name: 'Brine Jackal', color: 0xb0a890, skills: ['Salt the Wound'], twist: 'bleed' },
      { tpl: 'priest', id: 'pickling-priest', name: 'Pickling Priest', color: 0x5a6a70, skills: ['Rite of Preserving', 'Salt Lash'], twist: 'none' },
      { tpl: 'warden', id: 'salt-warden', name: 'Salt Warden', color: 0xc0b8a0, skills: ['Crust of Salt', 'Salt-Pillar Bash'], twist: 'none' },
    ],
    boss: { id: 'salt-matron', name: 'The Salt Matron', color: 0xa09880, skills: ['Desiccate', 'Embalming Grip', 'Unpack the Dead'], phase2: ['Desiccate', 'Embalming Grip', 'Pillar of Salt', 'Unpack the Dead'], blasphemy: 'Remember Lot\'s Wife', text: 'The Matron cracks open like a jar. The salt pours out, and so does she.', twist: 'none', bane: 'Sepulcher Watch' },
  },
  {
    crypt: 'flooded-nave',
    foes: [
      { tpl: 'lurker', id: 'nave-eel', name: 'Nave Eel', color: 0x2a4a50, skills: ['Coil and Drag', 'Eel Bite'], twist: 'none' },
      { tpl: 'thief', id: 'drowned-sexton', name: 'Drowned Sexton', color: 0x6a7a80, skills: ['Snuff the Taper', 'Sexton\'s Knife'], twist: 'none' },
      { tpl: 'nun', id: 'kelp-nun', name: 'Kelp-Veiled Nun', color: 0x3a5a4a, skills: ['Psalm of the Deep', 'Cold Touch'], twist: 'weaken' },
      { tpl: 'bishop', id: 'tide-bishop', name: 'Tide Bishop', color: 0x2a3a5a, skills: ['Blessing of the Tide', 'Anchor Hook', 'Raise the Drowned'], twist: 'none' },
    ],
    boss: { id: 'drowned-verger', name: 'The Drowned Verger', color: 0x2a4048, skills: ['Toll Underwater', 'Cast into the Font', 'Call the Bloated'], phase2: ['Toll Underwater', 'Cast into the Font', 'High Tide', 'Call the Bloated'], blasphemy: 'Baptism of the Deep', text: 'The nave floods to the rafters. The Verger swims up to meet you.', twist: 'enrage', bane: 'Drowned Litany' },
  },
  {
    crypt: 'iron-oubliette',
    foes: [
      { tpl: 'husk', id: 'shackled-husk', name: 'Shackled Husk', color: 0x5a5a60, skills: ['Chain Swing'], twist: 'sunder' },
      { tpl: 'wraith', id: 'oubliette-whisper', name: 'Oubliette Whisper', color: 0x7a6a8a, skills: ['Forgotten Breath'], twist: 'none' },
      { tpl: 'hound', id: 'jail-mastiff', name: 'Jail Mastiff', color: 0x6a5040, skills: ['Lockjaw'], twist: 'stout' },
      { tpl: 'golem', id: 'iron-maiden', name: 'The Iron Maiden', color: 0x4a4a50, skills: ['Embrace', 'Slam Shut'], twist: 'none' },
    ],
    boss: { id: 'the-jailer', name: 'The Jailer', color: 0x3a3a40, skills: ['Rattle the Keys', 'Into the Pit', 'Release the Prisoners'], phase2: ['Rattle the Keys', 'Into the Pit', 'Lock Them All', 'Release the Prisoners'], blasphemy: 'Forgotten Forever', text: 'The Jailer throws away the keys. No one leaves now.', twist: 'none', bane: 'Iron Vigil' },
  },
  {
    crypt: 'candle-maze',
    foes: [
      { tpl: 'pilgrim', id: 'tallow-pilgrim', name: 'Tallow Pilgrim', color: 0xe0c890, skills: ['Hot Wax'], twist: 'none' },
      { tpl: 'thief', id: 'wick-snuffer', name: 'Wick Snuffer', color: 0x403830, skills: ['Snuff the Soul', 'Pinch'], twist: 'zeal' },
      { tpl: 'ringer', id: 'chime-of-flame', name: 'Chime of Flame', color: 0xd08a40, skills: ['Burning Peal'], twist: 'none' },
      { tpl: 'bishop', id: 'chandler-bishop', name: 'Chandler Bishop', color: 0x8a5a2a, skills: ['Kindle', 'Hook of Wire', 'Pour a Candle'], twist: 'none' },
    ],
    boss: { id: 'wick-keeper', name: 'The Wick-Keeper', color: 0xc08030, skills: ['Ten Thousand Flames', 'Snuff a Soul', 'Light Another'], phase2: ['Ten Thousand Flames', 'Snuff a Soul', 'The Great Flare', 'Light Another'], blasphemy: 'Every Candle Out', text: 'The Wick-Keeper pinches out its own flame. The maze goes dark.', twist: 'regen', bane: 'Candle Choir' },
  },
  {
    crypt: 'red-refectory',
    foes: [
      { tpl: 'husk', id: 'glutton-brother', name: 'Glutton Brother', color: 0x8a5a50, skills: ['Gorge'], twist: 'stout' },
      { tpl: 'acolyte', id: 'server-acolyte', name: 'Serving Acolyte', color: 0x6a3a3a, skills: ['Ladle Strike', 'Bitter Grace'], twist: 'poison' },
      { tpl: 'lurker', id: 'table-lurker', name: 'Under-Table Lurker', color: 0x4a2a2a, skills: ['Pull to the Table', 'Gnaw'], twist: 'none' },
      { tpl: 'warden', id: 'refectory-cook', name: 'The Cook', color: 0x7a5a4a, skills: ['Lid of the Pot', 'Cleaver Shove'], twist: 'bleed' },
    ],
    boss: { id: 'the-cellarer', name: 'The Cellarer', color: 0x7a2030, skills: ['Pour the Red', 'Seat at the Table', 'More Guests'], phase2: ['Pour the Red', 'Seat at the Table', 'The Last Supper', 'More Guests'], blasphemy: 'Grace Before Meat', text: 'The Cellarer rings for the next course. You are on the menu.', twist: 'enrage', bane: 'Red Pilgrimage' },
  },
  {
    crypt: 'choir-loft',
    foes: [
      { tpl: 'pilgrim', id: 'hoarse-pilgrim', name: 'Hoarse Pilgrim', color: 0x7a7a50, skills: ['Cough of Psalms'], twist: 'none' },
      { tpl: 'ringer', id: 'loft-ringer', name: 'Loft Ringer', color: 0xa08060, skills: ['Descant Peal'], twist: 'none' },
      { tpl: 'nun', id: 'alto-nun', name: 'Alto Nun', color: 0x6a5a7a, skills: ['Dissonant Hymn', 'Hush'], twist: 'zeal' },
      { tpl: 'bishop', id: 'precentor', name: 'The Precentor', color: 0x5a3a5a, skills: ['Keep Time', 'Baton Hook', 'Summon the Choir'], twist: 'none' },
    ],
    boss: { id: 'the-cantor', name: 'The Cantor', color: 0x6a2a4a, skills: ['Endless Antiphon', 'Silence the Soloist', 'Call the Basses'], phase2: ['Endless Antiphon', 'Silence the Soloist', 'The Highest Note', 'Call the Basses'], blasphemy: 'Requiem for the Living', text: 'The Cantor holds a note that never ends.', twist: 'none', bane: 'Hollow Bell' },
  },
  {
    crypt: 'penitent-well',
    foes: [
      { tpl: 'lurker', id: 'well-climber', name: 'Well Climber', color: 0x3a4a3a, skills: ['Drag to the Bucket', 'Cold Bite'], twist: 'none' },
      { tpl: 'wraith', id: 'sin-wisp', name: 'Climbing Sin', color: 0x9a6a5a, skills: ['Whisper of Guilt'], twist: 'weaken' },
      { tpl: 'husk', id: 'stone-penitent', name: 'Stone Penitent', color: 0x7a7a70, skills: ['Kneeling Blow'], twist: 'none' },
      { tpl: 'golem', id: 'well-head', name: 'The Well-Head', color: 0x6a6a5a, skills: ['Grind of the Windlass', 'Bucket Drop'], twist: 'none' },
    ],
    boss: { id: 'well-warden', name: 'The Well-Warden', color: 0x3a5050, skills: ['Draw Up the Sins', 'Down You Go', 'Call the Sins'], phase2: ['Draw Up the Sins', 'Down You Go', 'The Bottomless', 'Call the Sins'], blasphemy: 'Every Sin Returned', text: 'Everything thrown down the well climbs out at once.', twist: 'regen', bane: 'Glass Confession' },
  },
  {
    crypt: 'thorned-sacristy',
    foes: [
      { tpl: 'thief', id: 'briar-thief', name: 'Briar Thief', color: 0x5a6a3a, skills: ['Thorny Snatch', 'Bramble Cut'], twist: 'bleed' },
      { tpl: 'nun', id: 'rust-nun', name: 'Rust Nun', color: 0x8a4a2a, skills: ['Psalm of Rust', 'Rusted Touch'], twist: 'none' },
      { tpl: 'husk', id: 'vestment-husk', name: 'Empty Vestment', color: 0x6a3a5a, skills: ['Smother'], twist: 'none' },
      { tpl: 'bishop', id: 'thorn-sacristan', name: 'Thorn Sacristan', color: 0x4a5a2a, skills: ['Crown of Briars', 'Bramble Hook', 'Grow a Penitent'], twist: 'none' },
    ],
    boss: { id: 'thorn-priest', name: 'The Thorn Priest', color: 0x3a4a20, skills: ['Mass of Thorns', 'Crowning', 'Seed the Pews'], phase2: ['Mass of Thorns', 'Crowning', 'The Briar Rises', 'Seed the Pews'], blasphemy: 'Crown for Every Head', text: 'The Priest\'s vestments split, and the briars pour out.', twist: 'none', bane: 'Thorn Covenant' },
  },
  {
    crypt: 'mirror-crypt',
    foes: [
      { tpl: 'husk', id: 'mirror-husk', name: 'Mirrored Husk', color: 0x9aa0b0, skills: ['Your Own Blow'], twist: 'none' },
      { tpl: 'acolyte', id: 'glass-acolyte', name: 'Glass Acolyte', color: 0x8ab0c0, skills: ['Shard Strike', 'Distorted Vow'], twist: 'none' },
      { tpl: 'wraith', id: 'reflection-wisp', name: 'Reflection', color: 0xb0b8d0, skills: ['Stolen Breath'], twist: 'swift' },
      { tpl: 'warden', id: 'mirror-warden', name: 'Mirror Warden', color: 0x7a8090, skills: ['Silvered Shield', 'Glass Bash'], twist: 'none' },
    ],
    boss: { id: 'the-reflection', name: 'The Reflection', color: 0x8a90b0, skills: ['Mock', 'Turn the Blade', 'Another Mirror'], phase2: ['Mock', 'Turn the Blade', 'Shatter', 'Another Mirror'], blasphemy: 'Which One Is You', text: 'The Reflection steps out of the glass. Now there are two of every Sister.', twist: 'enrage', bane: 'Glass Confession' },
  },
  {
    crypt: 'plague-hospice',
    foes: [
      { tpl: 'pilgrim', id: 'plague-patient', name: 'Plague Patient', color: 0x6a7a3a, skills: ['Fever Retch'], twist: 'poison' },
      { tpl: 'nun', id: 'beak-nun', name: 'Beaked Nun', color: 0x3a3a30, skills: ['Miasma Psalm', 'Lancet'], twist: 'none' },
      { tpl: 'thief', id: 'bodysnatcher', name: 'Bodysnatcher', color: 0x5a4a3a, skills: ['Lift the Purse', 'Scalpel'], twist: 'none' },
      { tpl: 'bishop', id: 'leech-bishop', name: 'Leech Bishop', color: 0x4a2a2a, skills: ['Bloodletting', 'Leech Hook', 'Admit the Sick'], twist: 'none' },
    ],
    boss: { id: 'the-physician', name: 'The Physician', color: 0x2a2a2a, skills: ['Purge', 'Amputate', 'Next Patient'], phase2: ['Purge', 'Amputate', 'Quarantine', 'Next Patient'], blasphemy: 'The Cure Is Death', text: 'The Physician removes the beak. Underneath is another beak.', twist: 'regen', bane: 'Ashen Mercy' },
  },
  {
    crypt: 'abyssal-ossuary',
    foes: [
      { tpl: 'husk', id: 'elder-husk', name: 'Elder Husk', color: 0x4a4a52, skills: ['Ancient Crush'], twist: 'stout' },
      { tpl: 'hound', id: 'abyss-hound', name: 'Abyss Hound', color: 0x8a8070, skills: ['Abyssal Maul'], twist: 'none' },
      { tpl: 'ringer', id: 'deep-bell', name: 'The Deep Bell', color: 0x6a5038, skills: ['Peal from Below'], twist: 'weaken' },
      { tpl: 'golem', id: 'bone-colossus', name: 'Bone Reliquary', color: 0x7a7058, skills: ['Grind the Faithful', 'Avalanche of Bone'], twist: 'none' },
    ],
    boss: { id: 'bone-choir', name: 'The Bone Choir', color: 0x5a2a3a, skills: ['Hymn of Marrow', 'Rib-Cage Grip', 'Call the Old Dead'], phase2: ['Hymn of Marrow', 'Rib-Cage Grip', 'Ossuary Anthem', 'Call the Old Dead'], blasphemy: 'All Bones Sing', text: 'Every bone in the Ossuary takes up the song.', twist: 'none', bane: 'Sepulcher Watch' },
  },
  {
    crypt: 'last-altar',
    foes: [
      { tpl: 'pilgrim', id: 'first-pilgrim', name: 'The First Pilgrim', color: 0x8a7a5a, skills: ['Heretic\'s Vomit'], twist: 'none' },
      { tpl: 'thief', id: 'relic-thief', name: 'Relic Thief', color: 0xc0a050, skills: ['Steal the Grace', 'Holy Knife'], twist: 'zeal' },
      { tpl: 'nun', id: 'apostate-nun', name: 'Apostate Nun', color: 0x7a2a3a, skills: ['Inverted Psalm', 'Profane Touch'], twist: 'weaken' },
      { tpl: 'bishop', id: 'antipope', name: 'The Antipope', color: 0x6a1a2a, skills: ['False Blessing', 'Crook of Heresy', 'Ordain the Dead'], twist: 'none' },
    ],
    boss: { id: 'first-heretic', name: 'The First Heretic', color: 0x2a0a1a, skills: ['The First Lie', 'Unmake the Faithful', 'Gather the Heretics'], phase2: ['The First Lie', 'Unmake the Faithful', 'It Was Always Mine', 'Gather the Heretics'], blasphemy: 'Anathema', text: 'The First Heretic stands. Every candle in the world flickers.', twist: 'enrage', bane: 'Iron Vigil' },
  },
];
