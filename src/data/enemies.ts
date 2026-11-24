import type { DmgType, SkillDef } from './skills';
import { DEEP_HOSTS, type DeepCrypt, type Twist } from './deepFoes';

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
  /** Reuse another foe's art until this one has its own. */
  art?: string;
  /** Hunt-boss mechanics, run at the start of each round (see systems/combat.ts). */
  traits?: EnemyTraits;
  /** Bosses: below this share of HP, swap to a harsher skill set. */
  phase2?: { atPct: number; text: string; atkPct: number; skills: SkillDef[] };
  /** Bosses: the Blasphemy unleashed when Wrath is full (a charged move, with a turn of warning). */
  blasphemy?: SkillDef;
}

/** Hunt-boss mechanics. */
export interface EnemyTraits {
  /** Heals this share of max HP each round; half while it Bleeds, Burns or is Poisoned. */
  regen?: number;
  /** Takes this much less damage while any of its servants stand. */
  guarded?: number;
  /** Gains this much attack every round. */
  enrage?: number;
  /** Swaps its Armor and Magic Resist every this many rounds. */
  swap?: number;
}

const any: number[] = [];

/**
 * Each foe's Magic Resist (its defence against Magic; armor is its defence against
 * Physical), the damage it deals, and its bane: the Order whose Sisters hit it
 * 25% harder and take 15% less from it. Every Order is some foe's bane.
 */
export const AFFINITY: Record<string, { mres: number; dmg?: DmgType; bane: string }> = {
  husk: { mres: 20, bane: 'Ashen Mercy' },
  acolyte: { mres: 40, dmg: 'magic', bane: 'Veiled Tribunal' },
  ringer: { mres: 50, dmg: 'magic', bane: 'Hallowed Belfry' },
  hound: { mres: 20, bane: 'Verdant Martyrdom' },
  wraith: { mres: 70, dmg: 'magic', bane: 'Choir of the Pyre' },
  choir: { mres: 48, dmg: 'magic', bane: 'Drowned Litany' },
  warden: { mres: 15, bane: 'Iron Vigil' },
  priest: { mres: 55, dmg: 'magic', bane: 'Crimson Inquisition' },
  golem: { mres: 10, bane: 'Sepulcher Watch' },
  lurker: { mres: 40, bane: 'Drowned Litany' },
  pilgrim: { mres: 45, bane: 'Crimson Inquisition' },
  thief: { mres: 30, bane: 'Confessors of Glass' },
  nun: { mres: 55, dmg: 'magic', bane: 'Confessors of Glass' },
  bishop: { mres: 70, dmg: 'magic', bane: 'Veiled Tribunal' },
  abbess: { mres: 60, dmg: 'magic', bane: 'Verdant Martyrdom' },
  // Hallowed Hunt bosses
  'flayed-saint': { mres: 90, bane: 'Ashen Mercy' },
  'twofold-reliquary': { mres: 20, dmg: 'magic', bane: 'Confessors of Glass' },
  colossus: { mres: 15, bane: 'Sepulcher Watch' },
  'rot-mother': { mres: 70, dmg: 'magic', bane: 'Choir of the Pyre' },
  choirmaster: { mres: 45, dmg: 'magic', bane: 'Hallowed Belfry' },
  'red-cardinal': { mres: 50, bane: 'Crimson Inquisition' },
  'font-leviathan': { mres: 45, dmg: 'magic', bane: 'Drowned Litany' },
  'iron-abbot': { mres: 30, bane: 'Iron Vigil' },
};

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
    skills: [{ id: 'maul', name: 'Maul', desc: 'Leaves a Sister Bleeding.', from: any, target: 'enemy', reach: [1, 2, 3], mult: 1.0, aim: 'weakest', bleed: { mult: 0.2, turns: 2 } }],
  },
  wraith: {
    id: 'wraith', name: 'Censer Wraith', hp: 50, atk: 15, armor: 8, spd: 9, color: 0x9b78a3, shape: 'wisp',
    skills: [{ id: 'grave-breath', name: 'Grave Breath', desc: '', from: any, target: 'enemy', mult: 0.6, poison: { mult: 0.45, turns: 3 }, aim: 'random' }],
  },
  choir: {
    id: 'choir', name: 'The Choir Below', hp: 530, atk: 18, armor: 48, spd: 10, boss: true, color: 0x652b3b, shape: 'choir',
    blasphemy: { id: 'drowning-requiem', name: 'Drowning Requiem', desc: 'BLASPHEMY: drowns every Sister, steals 25 of their Zeal and weakens them.', from: any, target: 'allEnemies', mult: 1.4, zealDrain: 25, weaken: { pct: 0.3, turns: 2 }, rite: true, windup: true },
    skills: [
      { id: 'hymn-of-drowning', name: 'Hymn of Drowning', desc: '', from: any, target: 'allEnemies', mult: 0.6 },
      { id: 'grasping-hands', name: 'Grasping Hands', desc: '', from: any, target: 'enemy', mult: 1.4, weaken: { pct: 0.25, turns: 2 } },
      { id: 'call-the-drowned', name: 'Call the Drowned', desc: '', from: any, target: 'self', summon: 'acolyte', weight: 0.5 },
    ],
    phase2: {
      atPct: 0.5,
      text: 'The Choir rises from the black water, its drowned hymn swelling!',
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
      { id: 'shield-bash', name: 'Shield Bash', desc: 'Hurls a Sister back.', from: any, target: 'enemy', reach: [1, 2], mult: 0.9, aim: 'front', shove: 1 },
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
      { id: 'grind', name: 'Grind', desc: 'Hurls a Sister far back and Sunders her armor.', from: any, target: 'enemy', reach: [1, 2], mult: 0.9, aim: 'front', shove: 2, sunder: { pct: 0.3, turns: 2 } },
      { id: 'reliquary-fall', name: 'Reliquary Fall', desc: 'A crushing blow after a wind-up. Stuns its target.', from: any, target: 'enemy', reach: [1, 2, 3], mult: 2.2, windup: true, aim: 'weakest', stun: 1 },
    ],
  },
  lurker: {
    id: 'lurker', name: 'Undertow Lurker', hp: 70, atk: 15, armor: 20, spd: 12, color: 0x2f4f5a, shape: 'lurker',
    skills: [
      { id: 'drag-under', name: 'Drag Under', desc: 'Drags a Rearguard Sister into the Vanguard.', from: any, target: 'enemy', reach: [3, 4], mult: 0.8, pull: true, aim: 'back', weight: 1.3 },
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
      { id: 'cut-purse', name: 'Cut Purse', desc: 'Leaves a Sister Bleeding.', from: any, target: 'enemy', mult: 0.8, aim: 'weakest', bleed: { mult: 0.2, turns: 2 } },
    ],
  },
  nun: {
    id: 'nun', name: 'Plague Nun', hp: 65, atk: 13, armor: 18, spd: 9, color: 0x5b6b3c, shape: 'nun',
    skills: [
      { id: 'pestilent-psalm', name: 'Pestilent Psalm', desc: 'Poisons every Sister.', from: any, target: 'allEnemies', mult: 0.2, poison: { mult: 0.35, turns: 3 } },
      { id: 'rot-touch', name: 'Rot Touch', desc: '', from: any, target: 'enemy', mult: 0.8 },
    ],
  },
  bishop: {
    id: 'bishop', name: 'Grave Bishop', hp: 260, atk: 17, armor: 45, spd: 8, color: 0x4a2a3a, shape: 'bishop',
    skills: [
      { id: 'grave-blessing', name: 'Grave Blessing', desc: 'Empowers itself for 6s.', from: any, target: 'self', empower: { pct: 0.3, turns: 3 }, weight: 0.7 },
      { id: 'crozier', name: 'Crozier', desc: 'Hooks a Sister and drags her to the front.', from: any, target: 'enemy', mult: 1.2, aim: 'weakest', pull: true },
      { id: 'raise-the-penitent', name: 'Raise the Penitent', desc: '', from: any, target: 'self', summon: 'husk', weight: 0.5 },
    ],
  },
  abbess: {
    id: 'abbess', name: 'The Hollow Abbess', hp: 720, atk: 22, armor: 60, spd: 9, boss: true, color: 0x3a3048, shape: 'abbess',
    blasphemy: { id: 'excommunion', name: 'Excommunion', desc: 'BLASPHEMY: casts out every Sister, stealing 30 Zeal and Sundering their armor.', from: any, target: 'allEnemies', mult: 1.6, zealDrain: 30, sunder: { pct: 0.3, turns: 2 }, rite: true, windup: true },
    skills: [
      { id: 'toll-of-silence', name: 'Toll of Silence', desc: 'Hits everyone and steals Zeal.', from: any, target: 'allEnemies', mult: 0.55, zealDrain: 10 },
      { id: 'excommunicate', name: 'Excommunicate', desc: 'Casts a Sister far back.', from: any, target: 'enemy', mult: 1.5, aim: 'strongest', shove: 2 },
      { id: 'call-the-bloated', name: 'Call the Bloated', desc: '', from: any, target: 'self', summon: 'pilgrim', weight: 0.5 },
    ],
    phase2: {
      atPct: 0.5,
      text: 'The Abbess tears off her veil. The great bell begins to swing.',
      atkPct: 0.15,
      skills: [
        { id: 'toll-of-silence', name: 'Toll of Silence', desc: 'Hits everyone and steals Zeal.', from: any, target: 'allEnemies', mult: 0.55, zealDrain: 10 },
        { id: 'excommunicate', name: 'Excommunicate', desc: 'Casts a Sister far back.', from: any, target: 'enemy', mult: 1.5, aim: 'strongest', shove: 2 },
        { id: 'last-bell', name: 'The Last Bell', desc: '', from: any, target: 'allEnemies', mult: 1.2, windup: true, weight: 1.3 },
        { id: 'call-the-bloated', name: 'Call the Bloated', desc: '', from: any, target: 'self', summon: 'pilgrim', weight: 0.4 },
      ],
    },
  },

  // ---- Hallowed Hunt bosses: one a day, scored by the damage dealt ----
  'flayed-saint': {
    id: 'flayed-saint', name: 'The Flayed Saint', hp: 3200, atk: 21, armor: 20, spd: 7, boss: true, color: 0x8a4a4a, shape: 'abbess', art: 'abbess',
    traits: { regen: 0.04 },
    blasphemy: { id: 'stigmata-rain', name: 'Rain of Stigmata', desc: 'BLASPHEMY: every Sister bleeds heavily for 6s.', from: any, target: 'allEnemies', mult: 1.1, bleed: { mult: 0.4, turns: 3 }, rite: true, windup: true },
    skills: [
      { id: 'martyrs-embrace', name: "Martyr's Embrace", desc: '', from: any, target: 'enemy', mult: 1.3, aim: 'strongest' },
      { id: 'weeping-wounds', name: 'Weeping Wounds', desc: 'Every Sister Bleeds.', from: any, target: 'allEnemies', mult: 0.45, bleed: { mult: 0.25, turns: 2 } },
    ],
  },
  'twofold-reliquary': {
    id: 'twofold-reliquary', name: 'The Twofold Reliquary', hp: 3000, atk: 20, armor: 150, spd: 6, boss: true, color: 0xa08a5a, shape: 'golem', art: 'golem',
    traits: { swap: 3 },
    blasphemy: { id: 'gilded-judgment', name: 'Gilded Judgment', desc: 'BLASPHEMY: a blaze of gold on every Sister that Sunders their armor.', from: any, target: 'allEnemies', mult: 1.5, sunder: { pct: 0.4, turns: 2 }, rite: true, windup: true },
    skills: [
      { id: 'gilded-crush', name: 'Gilded Crush', desc: '', from: any, target: 'enemy', reach: [1, 2], mult: 1.4, aim: 'front' },
      { id: 'reliquary-glare', name: 'Reliquary Glare', desc: 'Hits everyone.', from: any, target: 'allEnemies', mult: 0.6 },
    ],
  },
  colossus: {
    id: 'colossus', name: 'The Ossuary Colossus', hp: 3600, atk: 24, armor: 140, spd: 3, boss: true, color: 0x6a6052, shape: 'golem', art: 'warden',
    blasphemy: { id: 'ossuary-collapse', name: 'Ossuary Collapse', desc: 'BLASPHEMY: brings the crypt down on every Sister.', from: any, target: 'allEnemies', mult: 1.7, rite: true, windup: true },
    skills: [
      { id: 'grave-slam', name: 'Grave Slam', desc: 'A huge blow on the front Sister after a wind-up.', from: any, target: 'enemy', reach: [1], mult: 3.2, windup: true, aim: 'front', weight: 1.4 },
      { id: 'bone-sweep', name: 'Bone Sweep', desc: '', from: any, target: 'enemy', reach: [1, 2], mult: 1.1, aim: 'front' },
      { id: 'raise-the-dead', name: 'Raise the Dead', desc: '', from: any, target: 'self', summon: 'husk', weight: 0.4 },
    ],
  },
  'rot-mother': {
    id: 'rot-mother', name: 'Mother of Rot', hp: 2800, atk: 18, armor: 25, spd: 8, boss: true, color: 0x5b6b3c, shape: 'nun', art: 'nun',
    blasphemy: { id: 'plague-flood', name: 'Plague Flood', desc: 'BLASPHEMY: drowns every Sister in a deep, lasting poison.', from: any, target: 'allEnemies', mult: 0.6, poison: { mult: 0.9, turns: 3 }, rite: true, windup: true },
    skills: [
      { id: 'blight-psalm', name: 'Blight Psalm', desc: 'Poisons every Sister.', from: any, target: 'allEnemies', mult: 0.3, poison: { mult: 0.5, turns: 3 }, weight: 1.4 },
      { id: 'festering-touch', name: 'Festering Touch', desc: '', from: any, target: 'enemy', mult: 1.1, poison: { mult: 0.6, turns: 3 }, aim: 'weakest' },
    ],
  },
  choirmaster: {
    id: 'choirmaster', name: 'The Choirmaster', hp: 3000, atk: 19, armor: 40, spd: 9, boss: true, color: 0x652b3b, shape: 'choir', art: 'choir',
    traits: { guarded: 0.5 },
    blasphemy: { id: 'hymn-eternal', name: 'Hymn Eternal', desc: 'BLASPHEMY: a hymn that hurts every Sister and steals 20 Zeal.', from: any, target: 'allEnemies', mult: 1.3, zealDrain: 20, rite: true, windup: true },
    skills: [
      { id: 'summon-choir', name: 'Summon the Choir', desc: 'Calls a Bell Ringer to sing for it.', from: any, target: 'self', summon: 'ringer', weight: 0.8 },
      { id: 'dread-chorus', name: 'Dread Chorus', desc: 'Hits everyone.', from: any, target: 'allEnemies', mult: 0.65 },
    ],
  },
  'font-leviathan': {
    id: 'font-leviathan', name: 'The Font Leviathan', hp: 3400, atk: 19, armor: 60, spd: 6, boss: true, color: 0x24485a, shape: 'lurker', art: 'lurker',
    traits: { regen: 0.02, enrage: 0.04 },
    blasphemy: { id: 'deluge', name: 'The Deluge', desc: 'BLASPHEMY: a flood over every Sister that steals 20 Zeal.', from: any, target: 'allEnemies', mult: 1.5, zealDrain: 20, rite: true, windup: true },
    skills: [
      { id: 'tidal-surge', name: 'Tidal Surge', desc: 'Hits everyone and weakens them.', from: any, target: 'allEnemies', mult: 0.6, weaken: { pct: 0.15, turns: 2 } },
      { id: 'swallow', name: 'Swallow', desc: 'Winds up, then swallows the strongest Sister and stuns her.', from: any, target: 'enemy', mult: 1.8, windup: true, aim: 'strongest', stun: 1, weight: 1.2 },
    ],
  },
  'iron-abbot': {
    id: 'iron-abbot', name: 'The Iron Abbot', hp: 3000, atk: 18, armor: 90, spd: 7, boss: true, color: 0x4a4a52, shape: 'bishop', art: 'bishop',
    traits: { guarded: 0.4, swap: 4 },
    blasphemy: { id: 'iron-interdict', name: 'Iron Interdict', desc: 'BLASPHEMY: every Sister is struck, Sundered and robbed of 15 Zeal.', from: any, target: 'allEnemies', mult: 1.4, zealDrain: 15, sunder: { pct: 0.3, turns: 2 }, rite: true, windup: true },
    skills: [
      { id: 'call-the-wardens', name: 'Call the Wardens', desc: 'Calls an Ossuary Warden to his side.', from: any, target: 'self', summon: 'warden', weight: 0.7 },
      { id: 'iron-sermon', name: 'Iron Sermon', desc: 'Hits everyone and Sunders their armor.', from: any, target: 'allEnemies', mult: 0.55, sunder: { pct: 0.2, turns: 2 } },
      { id: 'anvil-blow', name: 'Anvil Blow', desc: '', from: any, target: 'enemy', reach: [1, 2], mult: 1.6, aim: 'front' },
    ],
  },
  'red-cardinal': {
    id: 'red-cardinal', name: 'The Red Cardinal', hp: 2900, atk: 17, armor: 45, spd: 10, boss: true, color: 0x8a1f2a, shape: 'bishop', art: 'bishop',
    traits: { enrage: 0.08 },
    blasphemy: { id: 'crimson-conclave', name: 'Crimson Conclave', desc: 'BLASPHEMY: every Sister bleeds and is weakened.', from: any, target: 'allEnemies', mult: 1.3, bleed: { mult: 0.3, turns: 2 }, weaken: { pct: 0.25, turns: 2 }, rite: true, windup: true },
    skills: [
      { id: 'scarlet-edict', name: 'Scarlet Edict', desc: 'Steals 15 Zeal.', from: any, target: 'allEnemies', mult: 0.5, zealDrain: 15 },
      { id: 'cardinals-rod', name: "Cardinal's Rod", desc: '', from: any, target: 'enemy', mult: 1.4, aim: 'weakest' },
    ],
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
  // Purge Hunts
  'hunt-flayed-saint': ['flayed-saint'],
  'hunt-twofold-reliquary': ['twofold-reliquary'],
  'hunt-colossus': ['colossus'],
  'hunt-rot-mother': ['rot-mother'],
  'hunt-choirmaster': ['choirmaster', 'ringer', 'ringer'],
  'hunt-red-cardinal': ['red-cardinal'],
  'hunt-font-leviathan': ['font-leviathan'],
  'hunt-iron-abbot': ['iron-abbot', 'warden'],
};

// ---- The deeper crypts' own hosts (data/deepFoes.ts) ----------------------

/** Each deep crypt's pattern boss: the Ossuary's (even) or the Belfry's (odd), as in crusade.ts. */
const DEEP_LIKE: Record<string, 'choir' | 'abbess'> = Object.fromEntries(DEEP_HOSTS.map((h, i) => [h.crypt, i % 2 === 0 ? 'choir' : 'abbess']));

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hits = (s: SkillDef) => (s.mult ?? 0) > 0 && (s.target === 'enemy' || s.target === 'allEnemies');

/** The first damaging skill gets the twist; it gives up a little damage for it. */
function twistSkills(skills: SkillDef[], twist: Twist): SkillDef[] {
  const i = skills.findIndex(hits);
  if (i < 0) return skills;
  const s = { ...skills[i] };
  if (twist === 'bleed' && !s.bleed) (s.bleed = { mult: 0.15, turns: 2 }), (s.mult = s.mult! * 0.9);
  else if (twist === 'poison' && !s.poison) (s.poison = { mult: 0.3, turns: 2 }), (s.mult = s.mult! * 0.85);
  else if (twist === 'weaken' && !s.weaken) (s.weaken = { pct: 0.15, turns: 2 }), (s.mult = s.mult! * 0.9);
  else if (twist === 'zeal' && !s.zealDrain) (s.zealDrain = 10), (s.mult = s.mult! * 0.9);
  else if (twist === 'sunder' && !s.sunder) (s.sunder = { pct: 0.2, turns: 2 }), (s.mult = s.mult! * 0.9);
  else return skills;
  s.mult = Math.round(s.mult! * 100) / 100;
  return skills.map((x, k) => (k === i ? s : x));
}

const rename = (skills: SkillDef[], names: string[], owner: string): SkillDef[] =>
  skills.map((s, i) => (names[i] ? { ...s, id: `${owner}-${slug(names[i])}`, name: names[i] } : s));

/** Its crypt's own version of a template, for summons and encounter swaps. */
const variantIn = (host: DeepCrypt, tpl: string) => host.foes.find((f) => f.tpl === tpl)?.id ?? tpl;

const summonIn = (host: DeepCrypt, skills: SkillDef[]) => skills.map((s) => (s.summon ? { ...s, summon: variantIn(host, s.summon) } : s));

for (const host of DEEP_HOSTS) {
  for (const f of host.foes) {
    const t = ENEMIES[f.tpl];
    const e: EnemyDef = { ...t, id: f.id, name: f.name, color: f.color, art: t.art ?? t.id, boss: t.boss, skills: summonIn(host, twistSkills(rename(t.skills, f.skills, f.id), f.twist)) };
    if (f.twist === 'swift') (e.spd += 3), (e.hp = Math.round(e.hp * 0.9));
    if (f.twist === 'stout') (e.hp = Math.round(e.hp * 1.15)), (e.spd = Math.max(2, e.spd - 2));
    if (f.twist === 'burst') (e.burst = (e.burst ?? 0) + 0.5), (e.hp = Math.round(e.hp * 0.9));
    ENEMIES[f.id] = e;
    AFFINITY[f.id] = { ...AFFINITY[f.tpl], bane: f.bane ?? AFFINITY[f.tpl].bane };
  }
  const b = host.boss;
  const like = DEEP_LIKE[host.crypt];
  const t = ENEMIES[like];
  const p2 = t.phase2!;
  const boss: EnemyDef = {
    ...t,
    id: b.id,
    name: b.name,
    color: b.color,
    art: t.art ?? t.id,
    skills: summonIn(host, rename(t.skills, b.skills, b.id)),
    phase2: { ...p2, text: b.text, skills: summonIn(host, rename(p2.skills, b.phase2, b.id)) },
    blasphemy: t.blasphemy && { ...t.blasphemy, id: `${b.id}-${slug(b.blasphemy)}`, name: b.blasphemy },
  };
  if (b.twist !== 'none') {
    boss.traits = b.twist === 'enrage' ? { enrage: 0.02 } : { regen: 0.01 };
    boss.hp = Math.round(boss.hp * 0.88);
  }
  ENEMIES[b.id] = boss;
  AFFINITY[b.id] = { ...AFFINITY[like], bane: b.bane };
  // Its crypt's encounters: the pattern crypt's layout with this crypt's foes swapped in.
  const prefix = like === 'choir' ? 'ossuary' : 'belfry';
  for (const [key, list] of Object.entries(ENCOUNTERS)) {
    if (!key.startsWith(`${prefix}-`)) continue;
    ENCOUNTERS[`${host.crypt}${key.slice(prefix.length)}`] = list.map((id) => variantIn(host, id));
  }
  ENCOUNTERS[`${host.crypt}-boss`] = ENCOUNTERS[like].map((id, i) => (i === 0 ? b.id : variantIn(host, id)));
}
