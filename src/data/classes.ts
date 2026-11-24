import type { ClassDef, CrusaderDef, Rarity } from './types';
import type { DmgType } from './skills';

/**
 * Fifteen classes, three per role: a steady pick, a greedy pick and a utility
 * pick. Each Sister's roster title decides her class (TITLE_CLASS). `icon` is
 * the class whose emblem a new class borrows until its own art arrives.
 */
export const CLASSES: Record<string, ClassDef> = {
  // Tank
  hierophant: { id: 'hierophant', name: 'Hierophant', role: 'Tank', summary: 'Bears the reliquary as a shield. Shields and Wards the whole party.' },
  sentinel: { id: 'sentinel', name: 'Sentinel', role: 'Tank', icon: 'hierophant', summary: 'Plants herself before the tomb. Draws every blow and strikes back at each one.' },
  martyr: { id: 'martyr', name: 'Martyr', role: 'Tank', icon: 'warsister', summary: 'Bleeds so her Sisters need not. Heals by the wounds she deals and rises once from death.' },
  // Healer
  confessor: { id: 'confessor', name: 'Confessor', role: 'Healer', summary: 'Mends the faithful and rots the unrepentant. Big heals and cures.' },
  hospitaller: { id: 'hospitaller', name: 'Hospitaller', role: 'Healer', icon: 'confessor', summary: 'Tends the whole line at once, and calls the fallen back from the grave.' },
  abbess: { id: 'abbess', name: 'Abbess', role: 'Healer', icon: 'confessor', summary: 'Heals her Sisters with every wound she gives, and dresses them in thorns.' },
  // Buffer
  oracle: { id: 'oracle', name: 'Oracle', role: 'Buffer', summary: 'Reads doom in the ashes. Hastes the party and fills its Zeal.' },
  cantor: { id: 'cantor', name: 'Cantor', role: 'Buffer', icon: 'oracle', summary: 'Sings hymns of war: more attack and more critical hits for every Sister.' },
  adjudicator: { id: 'adjudicator', name: 'Adjudicator', role: 'Buffer', icon: 'oracle', summary: 'Judges the foe instead of blessing the faithful. Weakens enemies and drains boss Wrath.' },
  // Melee DPS
  warsister: { id: 'warsister', name: 'War-Sister', role: 'Melee DPS', summary: 'Scourges her own flesh for power. The nearer to death, the harder she strikes.' },
  inquisitor: { id: 'inquisitor', name: 'Executioner', role: 'Melee DPS', summary: 'Names the heretic, then finishes it. Accused and wounded foes fall fast.' },
  veilblade: { id: 'veilblade', name: 'Veilblade', role: 'Melee DPS', icon: 'inquisitor', summary: 'Slips past the front line to the back ranks. Few strikes, huge critical hits.' },
  // Ranged DPS
  censer: { id: 'censer', name: 'Censer', role: 'Ranged DPS', summary: 'Holy smoke chokes, burns and weakens every foe.' },
  arbalist: { id: 'arbalist', name: 'Arbalist', role: 'Ranged DPS', icon: 'oracle', summary: 'Heavy blessed bolts on one foe at a time, through armor and shields.' },
  exorcist: { id: 'exorcist', name: 'Exorcist', role: 'Ranged DPS', icon: 'censer', summary: 'Witchfire and lantern-light. Strips the foe\'s blessings and scours bosses.' },
};

/** The class each roster title fights as. */
export const TITLE_CLASS: Record<string, string> = {
  'Reliquary Hierophant': 'hierophant',
  'Sepulcher Sentinel': 'sentinel',
  'Templar Vindicator': 'sentinel',
  'Dawn Martyr': 'martyr',
  'Blood Oath Knight': 'martyr',
  'Plague Confessor': 'confessor',
  'Banner Confessor': 'confessor',
  'Chalice Hospitaller': 'hospitaller',
  'Thorn Abbess': 'abbess',
  'Ash Oracle': 'oracle',
  'Drowned Sibyl': 'oracle',
  'Grave Cantor': 'cantor',
  'Iron Cantatrix': 'cantor',
  'Mirror Adjudicator': 'adjudicator',
  'Bone Archivist': 'adjudicator',
  'Penitent War-Sister': 'warsister',
  'Crusader Duelist': 'warsister',
  Inquisitor: 'inquisitor',
  'Bell Executioner': 'inquisitor',
  'Veilblade Sister': 'veilblade',
  'Censer Priestess': 'censer',
  'Saintbound Arbalist': 'arbalist',
  'Witchfire Deacon': 'exorcist',
  'Lantern Exorcist': 'exorcist',
};

/** Her class emblem's texture key (new classes borrow an old emblem until their art arrives). */
export const classIcon = (id: string) => `class-${CLASSES[id]?.icon ?? id}`;
/** Texture key with its own art first, then the borrowed emblem. */
export const classIconFor = (scene: { textures: { exists(k: string): boolean } }, id: string) => (scene.textures.exists(`class-${id}`) ? `class-${id}` : classIcon(id));

/** Base-stat multiplier per rarity (design doc: +0/10/25/40%). */
export const RARITY_MULT: Record<Rarity, number> = { R: 1, SR: 1.1, SSR: 1.25, UR: 1.4 };

/** Frame colour per rarity, drawn as a separate UI layer over portraits (UI preview colours). */
export const RARITY_COLOR: Record<Rarity, number> = {
  R: 0xb6adb9, // pale steel
  SR: 0xc5a4d5, // violet
  SSR: 0xefbc79, // gold
  UR: 0xe19cc4, // rose
};

/** Each class's usual damage; a Sister may carry her own tag (CrusaderDef.dmg). */
export const CLASS_DMG: Record<string, DmgType> = {
  hierophant: 'physical', sentinel: 'physical', martyr: 'physical',
  confessor: 'magic', hospitaller: 'magic', abbess: 'physical',
  oracle: 'magic', cantor: 'magic', adjudicator: 'magic',
  warsister: 'physical', inquisitor: 'physical', veilblade: 'physical',
  censer: 'magic', arbalist: 'physical', exorcist: 'magic',
};
/** Her damage type: her own (data/roster.ts sets it for Sisters who hit unlike their class), else her class's. */
export const dmgTagOf = (c: Pick<CrusaderDef, 'classId' | 'dmg'>): DmgType => c.dmg ?? CLASS_DMG[c.classId] ?? 'physical';
