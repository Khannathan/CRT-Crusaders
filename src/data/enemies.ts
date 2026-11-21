import type { SkillDef } from './skills';

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  atk: number;
  armor: number;
  spd: number;
  /** Defaults to 5%. */
  crit?: number;
  boss?: boolean;
  /** On death, hits every crusader for this multiple of its attack. */
  burst?: number;
  /** Placeholder art colour until real enemy art exists. */
  color: number;
  shape: 'husk' | 'hood' | 'bell' | 'hound' | 'wisp' | 'choir' | 'warden' | 'priest' | 'golem' | 'lurker' | 'pilgrim' | 'thief' | 'nun' | 'bishop' | 'abbess';
  skills: SkillDef[];
  /** Bosses: below this share of HP, swap to a harsher skill set. */
  phase2?: { atPct: number; text: string; atkPct: number; skills: SkillDef[] };
}

const any: number[] = [];

export const ENEMIES: Record<string, EnemyDef> = {
  husk: {
    id: 'husk', name: 'Penitent Husk', hp: 105, atk: 13, armor: 56, spd: 5, color: 0x72717b, shape: 'husk',
    skills: [{ id: 'crush', name: 'Crush', desc: '', from: any, target: 'enemy', reach: [1, 2], mult: 1.0, aim: 'front' }],
  },
  acolyte: {
    id: 'acolyte', name: 'Drowned Acolyte', hp: 70, atk: 15, armor: 24, spd: 8, color: 0x4f6170, shape: 'hood',
    skills: [
      { id: 'waterlogged-strike', name: 'Waterlogged Strike', desc: '', from: any, target: 'enemy', reach: [1, 2], mult: 1.0 },
      { id: 'brine-curse', name: 'Brine Curse', desc: '', from: any, target: 'enemy', mult: 0.5, weaken: { pct: 0.2, turns: 2 }, aim: 'strongest' },
    ],
  },
  ringer: {
    id: 'ringer', name: 'Bell Ringer', hp: 55, atk: 12, armor: 16, spd: 11, color: 0x8b6848, shape: 'bell',
    skills: [{ id: 'dolorous-peal', name: 'Dolorous Peal', desc: '', from: any, target: 'allEnemies', mult: 0.45 }],
  },
  hound: {
    id: 'hound', name: 'Ossuary Hound', hp: 65, atk: 17, armor: 24, spd: 13, color: 0xc6baa4, shape: 'hound',
    skills: [{ id: 'maul', name: 'Maul', desc: '', from: any, target: 'enemy', reach: [1, 2, 3], mult: 1.1, aim: 'weakest' }],
  },
  wraith: {
    id: 'wraith', name: 'Censer Wraith', hp: 50, atk: 15, armor: 8, spd: 9, color: 0x9b78a3, shape: 'wisp',
    skills: [{ id: 'grave-breath', name: 'Grave Breath', desc: '', from: any, target: 'enemy', mult: 0.6, poison: { mult: 0.45, turns: 3 }, aim: 'random' }],
  },
  choir: {
    id: 'choir', name: 'The Choir Below', hp: 530, atk: 20, armor: 48, spd: 10, boss: true, color: 0x652b3b, shape: 'choir',
    skills: [
      { id: 'hymn-of-drowning', name: 'Hymn of Drowning', desc: '', from: any, target: 'allEnemies', mult: 0.6 },
      { id: 'grasping-hands', name: 'Grasping Hands', desc: '', from: any, target: 'enemy', mult: 1.4, weaken: { pct: 0.25, turns: 2 } },
      { id: 'call-the-drowned', name: 'Call the Drowned', desc: '', from: any, target: 'self', summon: 'acolyte', weight: 0.5 },
    ],
    phase2: {
      atPct: 0.5,
      text: 'The Choir rises from the water, singing louder!',
      atkPct: 0.15,
      skills: [
        { id: 'hymn-of-drowning', name: 'Hymn of Drowning', desc: '', from: any, target: 'allEnemies', mult: 0.6 },
        { id: 'grasping-hands', name: 'Grasping Hands', desc: '', from: any, target: 'enemy', mult: 1.4, weaken: { pct: 0.25, turns: 2 }, aim: 'back' },
        { id: 'requiem', name: 'Requiem', desc: '', from: any, target: 'allEnemies', mult: 1.1, windup: true, weight: 1.2 },
        { id: 'call-the-drowned', name: 'Call the Drowned', desc: '', from: any, target: 'self', summon: 'acolyte', weight: 0.4 },
      ],
    },
  },

  // ---- added in the map update: each one asks for a different answer ----
  warden: {
    id: 'warden', name: 'Ossuary Warden', hp: 120, atk: 11, armor: 70, spd: 6, color: 0x5d5a52, shape: 'warden',
    skills: [
      { id: 'bone-bulwark', name: 'Bone Bulwark', desc: 'Shields the most hurt ally.', from: any, target: 'ally', shieldPct: 0.3, aim: 'weakest', weight: 1.4 },
      { id: 'shield-bash', name: 'Shield Bash', desc: '', from: any, target: 'enemy', reach: [1, 2], mult: 0.9, aim: 'front' },
    ],
  },
  priest: {
    id: 'priest', name: 'Mourning Priest', hp: 60, atk: 12, armor: 16, spd: 10, color: 0x3e3550, shape: 'priest',
    skills: [
      { id: 'dirge-of-mending', name: 'Dirge of Mending', desc: 'Heals the most hurt ally.', from: any, target: 'ally', heal: 2.2, aim: 'weakest', weight: 1.5 },
      { id: 'sorrow-lash', name: 'Sorrow Lash', desc: '', from: any, target: 'enemy', mult: 0.7 },
    ],
  },
  golem: {
    id: 'golem', name: 'Reliquary Golem', hp: 190, atk: 20, armor: 150, spd: 3, color: 0x8a7d63, shape: 'golem',
    skills: [
      { id: 'grind', name: 'Grind', desc: '', from: any, target: 'enemy', reach: [1, 2], mult: 0.9, aim: 'front' },
      { id: 'reliquary-fall', name: 'Reliquary Fall', desc: 'A crushing blow after a turn of charging.', from: any, target: 'enemy', reach: [1, 2, 3], mult: 2.2, windup: true, aim: 'weakest' },
    ],
  },
  lurker: {
    id: 'lurker', name: 'Undertow Lurker', hp: 70, atk: 15, armor: 20, spd: 12, color: 0x2f4f5a, shape: 'lurker',
    skills: [
      { id: 'drag-under', name: 'Drag Under', desc: 'Drags a back-rank crusader to the front.', from: any, target: 'enemy', reach: [3, 4], mult: 0.8, pull: true, aim: 'back', weight: 1.3 },
      { id: 'undertow-bite', name: 'Undertow Bite', desc: '', from: any, target: 'enemy', reach: [1, 2], mult: 1.0 },
    ],
  },
  pilgrim: {
    id: 'pilgrim', name: 'Bloated Pilgrim', hp: 85, atk: 14, armor: 10, spd: 4, burst: 0.9, color: 0x6f7a4a, shape: 'pilgrim',
    skills: [{ id: 'retch', name: 'Retch', desc: '', from: any, target: 'enemy', reach: [1, 2], mult: 0.6, poison: { mult: 0.4, turns: 2 } }],
  },
  thief: {
    id: 'thief', name: 'Candle Thief', hp: 45, atk: 13, armor: 12, spd: 15, color: 0xa08a4a, shape: 'thief',
    skills: [
      { id: 'snuff', name: 'Snuff', desc: 'Steals 15 Zeal.', from: any, target: 'enemy', mult: 0.5, zealDrain: 15, aim: 'random', weight: 1.5 },
      { id: 'cut-purse', name: 'Cut Purse', desc: '', from: any, target: 'enemy', mult: 0.9, aim: 'weakest' },
    ],
  },
  nun: {
    id: 'nun', name: 'Plague Nun', hp: 65, atk: 13, armor: 18, spd: 9, color: 0x5b6b3c, shape: 'nun',
    skills: [
      { id: 'pestilent-psalm', name: 'Pestilent Psalm', desc: 'Poisons every crusader.', from: any, target: 'allEnemies', mult: 0.2, poison: { mult: 0.35, turns: 3 } },
      { id: 'rot-touch', name: 'Rot Touch', desc: '', from: any, target: 'enemy', mult: 0.8 },
    ],
  },
  bishop: {
    id: 'bishop', name: 'Grave Bishop', hp: 260, atk: 17, armor: 45, spd: 8, color: 0x4a2a3a, shape: 'bishop',
    skills: [
      { id: 'grave-blessing', name: 'Grave Blessing', desc: 'Empowers itself for 3 turns.', from: any, target: 'self', empower: { pct: 0.3, turns: 3 }, weight: 0.7 },
      { id: 'crozier', name: 'Crozier', desc: '', from: any, target: 'enemy', mult: 1.2, aim: 'weakest' },
      { id: 'raise-the-penitent', name: 'Raise the Penitent', desc: '', from: any, target: 'self', summon: 'husk', weight: 0.5 },
    ],
  },
  abbess: {
    id: 'abbess', name: 'The Hollow Abbess', hp: 720, atk: 22, armor: 60, spd: 9, boss: true, color: 0x3a3048, shape: 'abbess',
    skills: [
      { id: 'toll-of-silence', name: 'Toll of Silence', desc: 'Hits everyone and steals Zeal.', from: any, target: 'allEnemies', mult: 0.55, zealDrain: 10 },
      { id: 'excommunicate', name: 'Excommunicate', desc: '', from: any, target: 'enemy', mult: 1.5, aim: 'strongest' },
      { id: 'call-the-bloated', name: 'Call the Bloated', desc: '', from: any, target: 'self', summon: 'pilgrim', weight: 0.5 },
    ],
    phase2: {
      atPct: 0.5,
      text: 'The Abbess tears off her veil. The great bell begins to swing.',
      atkPct: 0.15,
      skills: [
        { id: 'toll-of-silence', name: 'Toll of Silence', desc: 'Hits everyone and steals Zeal.', from: any, target: 'allEnemies', mult: 0.55, zealDrain: 10 },
        { id: 'excommunicate', name: 'Excommunicate', desc: '', from: any, target: 'enemy', mult: 1.5, aim: 'strongest' },
        { id: 'last-bell', name: 'The Last Bell', desc: '', from: any, target: 'allEnemies', mult: 1.2, windup: true, weight: 1.3 },
        { id: 'call-the-bloated', name: 'Call the Bloated', desc: '', from: any, target: 'self', summon: 'pilgrim', weight: 0.4 },
      ],
    },
  },
};

/** Enemy line-ups, rank 1 first. */
export const ENCOUNTERS: Record<string, string[]> = {
  // The Drowned Ossuary
  'ossuary-1': ['husk', 'acolyte', 'ringer'],
  'ossuary-2': ['hound', 'hound', 'wraith'],
  'ossuary-3': ['husk', 'hound', 'wraith', 'ringer'],
  'ossuary-4': ['warden', 'acolyte', 'priest'],
  'ossuary-5': ['lurker', 'husk', 'wraith'],
  'ossuary-elite-1': ['golem', 'priest'],
  'ossuary-elite-2': ['warden', 'hound', 'hound', 'priest'],
  choir: ['choir', 'ringer', 'ringer'],
  // The Sunken Belfry
  'belfry-1': ['pilgrim', 'thief', 'ringer'],
  'belfry-2': ['husk', 'nun', 'thief'],
  'belfry-3': ['warden', 'lurker', 'nun'],
  'belfry-4': ['pilgrim', 'pilgrim', 'priest'],
  'belfry-5': ['hound', 'lurker', 'thief', 'nun'],
  'belfry-elite-1': ['bishop', 'warden'],
  'belfry-elite-2': ['golem', 'nun', 'priest'],
  abbess: ['abbess', 'thief', 'nun'],
};
