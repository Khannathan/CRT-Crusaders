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
  /** Placeholder art colour until real enemy art exists. */
  color: number;
  shape: 'husk' | 'hood' | 'bell' | 'hound' | 'wisp' | 'choir';
  skills: SkillDef[];
}

const any: number[] = [];

export const ENEMIES: Record<string, EnemyDef> = {
  husk: {
    id: 'husk', name: 'Penitent Husk', hp: 105, atk: 13, armor: 56, spd: 5, color: 0x72717b, shape: 'husk',
    skills: [{ id: 'crush', name: 'Crush', desc: '', from: any, target: 'enemy', reach: [1, 2], mult: 1.0 }],
  },
  acolyte: {
    id: 'acolyte', name: 'Drowned Acolyte', hp: 70, atk: 15, armor: 24, spd: 8, color: 0x4f6170, shape: 'hood',
    skills: [
      { id: 'waterlogged-strike', name: 'Waterlogged Strike', desc: '', from: any, target: 'enemy', reach: [1, 2], mult: 1.0 },
      { id: 'brine-curse', name: 'Brine Curse', desc: '', from: any, target: 'enemy', mult: 0.5, weaken: { pct: 0.2, turns: 2 } },
    ],
  },
  ringer: {
    id: 'ringer', name: 'Bell Ringer', hp: 55, atk: 12, armor: 16, spd: 11, color: 0x8b6848, shape: 'bell',
    skills: [{ id: 'dolorous-peal', name: 'Dolorous Peal', desc: '', from: any, target: 'allEnemies', mult: 0.45 }],
  },
  hound: {
    id: 'hound', name: 'Ossuary Hound', hp: 65, atk: 17, armor: 24, spd: 13, color: 0xc6baa4, shape: 'hound',
    skills: [{ id: 'maul', name: 'Maul', desc: '', from: any, target: 'enemy', reach: [1, 2, 3], mult: 1.1 }],
  },
  wraith: {
    id: 'wraith', name: 'Censer Wraith', hp: 50, atk: 15, armor: 8, spd: 9, color: 0x9b78a3, shape: 'wisp',
    skills: [{ id: 'grave-breath', name: 'Grave Breath', desc: '', from: any, target: 'enemy', mult: 0.6, poison: { mult: 0.45, turns: 3 } }],
  },
  choir: {
    id: 'choir', name: 'The Choir Below', hp: 530, atk: 20, armor: 48, spd: 10, boss: true, color: 0x652b3b, shape: 'choir',
    skills: [
      { id: 'hymn-of-drowning', name: 'Hymn of Drowning', desc: '', from: any, target: 'allEnemies', mult: 0.6 },
      { id: 'grasping-hands', name: 'Grasping Hands', desc: '', from: any, target: 'enemy', mult: 1.4, weaken: { pct: 0.25, turns: 2 } },
      { id: 'call-the-drowned', name: 'Call the Drowned', desc: '', from: any, target: 'self', summon: 'acolyte' },
    ],
  },
};

/** Enemy line-ups, rank 1 first. */
export const ENCOUNTERS: Record<string, string[]> = {
  'ossuary-1': ['husk', 'acolyte', 'ringer'],
  'ossuary-side': ['hound', 'hound', 'wraith'],
  'ossuary-2': ['husk', 'hound', 'wraith', 'ringer'],
  'choir': ['choir', 'ringer', 'ringer'],
};
