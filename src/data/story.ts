/**
 * The story of the Pilgrim's Road, told in short scenes between stages.
 * Each scene plays once, the first time its stage is reached (`before`) or
 * first won (`after`), and stays in the Chronicle to replay.
 *
 * A line's `who` is a Sister id (she stands on the stage), `foe:<enemy id>`
 * (the foe's figure, if it has art) or `narrator` (no one stands).
 */
export interface StoryLine {
  who: string;
  text: string;
}

export interface StoryScene {
  id: string;
  /** Pilgrim's Road stage (1-50). */
  stage: number;
  when: 'before' | 'after';
  title: string;
  lines: StoryLine[];
}

// The cast: the Vigil's company on the road.
export const AURELIA = 'IV-UR1'; // Mother Aurelia, Iron Vigil, leads the march
export const PEREGRINA = 'RP-UR1'; // Peregrina, Crimson Inquisition, walked the road before
export const OCTAVIA = 'VT-SSR-VEI'; // Octavia, Veiled Tribunal, the knife in the dark
export const PERPETUA = 'TC-UR1'; // Perpetua, Verdant Martyrdom, the wall
export const CASSIA = 'IV-SSR-ORA'; // Cassia, Ash Oracle, reads the omens
export const MARINA = 'DL-UR1'; // Marina, Drowned Litany, hears the water

export const CAST = [AURELIA, PEREGRINA, OCTAVIA, PERPETUA, CASSIA, MARINA];

const N = 'narrator';

export const STORY: StoryScene[] = [
  // Chapter I: The Drowned Road
  {
    id: 'c1-open', stage: 1, when: 'before', title: 'The Bells Fall Silent',
    lines: [
      { who: N, text: 'For three hundred years the cathedral bells rang over the marsh. Last night, they stopped.' },
      { who: AURELIA, text: 'When the bells stop, the dead start. We march at dawn.' },
      { who: PEREGRINA, text: 'I walked this road as a novice. The causeway floods at dusk. Keep to the stones!' },
      { who: AURELIA, text: 'Then we purge it by daylight. Every horror on this road dies today.' },
    ],
  },
  {
    id: 'c1-mid', stage: 6, when: 'before', title: 'Voices in the Water',
    lines: [
      { who: MARINA, text: 'Listen. Under the water. They are singing.' },
      { who: OCTAVIA, text: 'Drowned men do not sing, Sister.' },
      { who: MARINA, text: 'These do. A hymn, backwards. It ends where the ossuary begins.' },
      { who: AURELIA, text: 'Then we follow the hymn and silence the throat it comes from.' },
    ],
  },
  {
    id: 'c1-boss', stage: 10, when: 'before', title: 'The Choir Below',
    lines: [
      { who: 'foe:choir', text: 'Kneel, little candles. Sing with us. The water is warm.' },
      { who: PERPETUA, text: 'I kneel to one God. You are not Him.' },
      { who: AURELIA, text: 'Sisters! Break the choir. Leave no voice standing!' },
    ],
  },
  {
    id: 'c1-close', stage: 10, when: 'after', title: 'A Bell Under the Reeds',
    lines: [
      { who: N, text: 'The Choir falls silent. In the hush, far off, one bell answers. Then another.' },
      { who: CASSIA, text: 'The ash speaks plainly. The bells were not silenced. They were taken.' },
      { who: AURELIA, text: 'Then we take them back. On to the marsh!' },
    ],
  },
  // Chapter II: The Marsh Bells
  {
    id: 'c2-open', stage: 11, when: 'before', title: 'The Marsh Bells',
    lines: [
      { who: N, text: 'Bells hang from dead trees across the marsh, ringing with no wind.' },
      { who: OCTAVIA, text: 'Someone hung them. Someone is ringing them. I would like a word.' },
      { who: PEREGRINA, text: 'The Sunken Belfry. An abbey once. The Abbess drowned with her nuns rather than flee.' },
      { who: AURELIA, text: 'Faithful in life. We will see what she is in death.' },
    ],
  },
  {
    id: 'c2-mid', stage: 16, when: 'before', title: 'The Bell-Ringer',
    lines: [
      { who: PERPETUA, text: 'Bodies, roped to the bell-pulls. They ring as they rot.' },
      { who: CASSIA, text: 'Every toll calls another. The marsh is filling with them.' },
      { who: AURELIA, text: 'Cut the ropes as you pass. Let them rest, and let them stay down.' },
    ],
  },
  {
    id: 'c2-boss', stage: 20, when: 'before', title: 'The Hollow Abbess',
    lines: [
      { who: 'foe:abbess', text: 'You come late, daughters. Vespers began a hundred years ago.' },
      { who: AURELIA, text: 'Mother, your vigil is over. Lay down your bell.' },
      { who: 'foe:abbess', text: 'He gave me the bell. He will give me you.' },
      { who: OCTAVIA, text: '"He." Remember that word, Sisters. Now cut her down!' },
    ],
  },
  {
    id: 'c2-close', stage: 20, when: 'after', title: 'Who Gave the Bell',
    lines: [
      { who: N, text: 'The Abbess crumbles. Her bell cracks, and inside is a seal of black wax.' },
      { who: CASSIA, text: 'A deacon\'s seal. From the cathedral itself.' },
      { who: AURELIA, text: 'Rot, from the heart of the Church. Say nothing of it outside this company.' },
    ],
  },
  // Chapter III: The Weeping Mile
  {
    id: 'c3-open', stage: 21, when: 'before', title: 'The Weeping Mile',
    lines: [
      { who: N, text: 'A mile of wayside shrines. At every one, a nun kneels and weeps, and will not stop.' },
      { who: PEREGRINA, text: 'Pilgrims called it the Mile of Mercy. You stopped at each shrine and were fed.' },
      { who: MARINA, text: 'They are not weeping water.' },
      { who: AURELIA, text: 'Eyes front. Pity is a door, and something waits behind it.' },
    ],
  },
  {
    id: 'c3-mid', stage: 26, when: 'before', title: 'A Familiar Face',
    lines: [
      { who: PEREGRINA, text: 'That shrine. Sister Lament fed me there, when I was twelve.' },
      { who: OCTAVIA, text: 'Is she still feeding pilgrims?' },
      { who: PEREGRINA, text: 'She is still kneeling. She has been kneeling for thirty years.' },
      { who: PERPETUA, text: 'Then we will help her rise. One way or another.' },
    ],
  },
  {
    id: 'c3-boss', stage: 30, when: 'before', title: 'Sister Lament',
    lines: [
      { who: N, text: 'At the end of the mile, a nun turns. Her face is wet with black tears.' },
      { who: PEREGRINA, text: 'Sister. It is me. The pilgrim girl.' },
      { who: N, text: 'Sister Lament smiles. Her mouth opens far too wide.' },
      { who: AURELIA, text: 'She is gone, Peregrina. Grieve later. Strike now!' },
    ],
  },
  {
    id: 'c3-close', stage: 30, when: 'after', title: 'Mercy, Given',
    lines: [
      { who: PEREGRINA, text: 'She thanked me. At the end, she thanked me.' },
      { who: AURELIA, text: 'That is our work. To free the faithful from what wears them.' },
      { who: CASSIA, text: 'The ash points north, to the scriptorium. Something is still being written there.' },
    ],
  },
  // Chapter IV: The Ash Fields
  {
    id: 'c4-open', stage: 31, when: 'before', title: 'The Ash Fields',
    lines: [
      { who: N, text: 'The scriptoria burned a generation ago. The fields are grey, and the ink still crawls.' },
      { who: CASSIA, text: 'I was born here. Ash in the cradle, ash in the bread. I learned to read it before I learned to read.' },
      { who: AURELIA, text: 'Then read us a path, Oracle.' },
      { who: CASSIA, text: 'Every path here ends in the same book.' },
    ],
  },
  {
    id: 'c4-mid', stage: 36, when: 'before', title: 'Ink That Walks',
    lines: [
      { who: OCTAVIA, text: 'The ink moves when you look away. It is writing on the stones.' },
      { who: CASSIA, text: 'Names. Ours. It is writing our names.' },
      { who: PERPETUA, text: 'Let it write. A name on a stone has never stopped my shield.' },
    ],
  },
  {
    id: 'c4-boss', stage: 40, when: 'before', title: 'The Unbound Scribe',
    lines: [
      { who: 'foe:unbound-scribe', text: 'Your names are in my book, Sisters. Your endings too. Shall I read them?' },
      { who: AURELIA, text: 'Read this. We end you here.' },
      { who: CASSIA, text: 'Burn the book! Burn it and he unravels!' },
    ],
  },
  {
    id: 'c4-close', stage: 40, when: 'after', title: 'The Last Page',
    lines: [
      { who: N, text: 'The book burns. One page will not catch. On it, the black seal again, and a single word: Deacon.' },
      { who: OCTAVIA, text: 'A deacon gave the Abbess her bell. A deacon kept this book. The same hand.' },
      { who: AURELIA, text: 'The Hanging Way leads to the cathedral door. We will find him there.' },
    ],
  },
  // Chapter V: The Hanging Way
  {
    id: 'c5-open', stage: 41, when: 'before', title: 'The Hanging Way',
    lines: [
      { who: N, text: 'The last road before the cathedral. Chains hang from the sky, and things hang from the chains.' },
      { who: PERPETUA, text: 'They are still moving.' },
      { who: AURELIA, text: 'Then they are still a threat. Shields up, heads down, march!' },
    ],
  },
  {
    id: 'c5-mid', stage: 46, when: 'before', title: 'Doubt',
    lines: [
      { who: MARINA, text: 'Mother Aurelia. If the rot is in the cathedral, who sent us?' },
      { who: AURELIA, text: 'God sent us, Marina. The cathedral only signed the order.' },
      { who: OCTAVIA, text: 'And if the one who signed it is waiting at the door?' },
      { who: AURELIA, text: 'Then he will learn what he sent.' },
    ],
  },
  {
    id: 'c5-boss', stage: 50, when: 'before', title: 'The Hanged Deacon',
    lines: [
      { who: 'foe:hanged-deacon', text: 'Welcome, Sisters. I rang the bells. I wrote the book. I signed your orders.' },
      { who: AURELIA, text: 'Why?' },
      { who: 'foe:hanged-deacon', text: 'Because the cathedral needed faithful dead. And none are more faithful than you.' },
      { who: AURELIA, text: 'Sisters. For every bell he stole. Bring him down!' },
    ],
  },
  {
    id: 'c5-close', stage: 50, when: 'after', title: 'The Cathedral Door',
    lines: [
      { who: N, text: 'The Deacon falls, and the chains fall with him. Before the company stands the cathedral door, black and shut.' },
      { who: CASSIA, text: 'He was not the end. He was a servant. Something inside is still ringing.' },
      { who: AURELIA, text: 'Then we go in. Rest tonight, Sisters. Tomorrow we purge the house of God itself.' },
      { who: N, text: 'The road is walked. The cathedral waits.' },
    ],
  },
];

export const sceneBefore = (stage: number) => STORY.find((s) => s.stage === stage && s.when === 'before');
export const sceneAfter = (stage: number) => STORY.find((s) => s.stage === stage && s.when === 'after');
