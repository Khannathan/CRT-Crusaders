import type { ClassDef, CrusaderDef, Rarity } from './types';
import type { DmgType } from './skills';

export const CLASSES: Record<string, ClassDef> = {
  warsister: { id: 'warsister', name: 'Penitent War-Sister', role: 'Vanguard', summary: 'Scourges her own flesh for power. The nearer to death, the harder she strikes.' },
  hierophant: { id: 'hierophant', name: 'Reliquary Hierophant', role: 'Vanguard', summary: 'Bears the reliquary as a shield and calls the enemy\'s wrath upon herself.' },
  inquisitor: { id: 'inquisitor', name: 'Inquisitor', role: 'Striker', summary: 'Names the heretic. The Accused suffer more from every blow.' },
  confessor: { id: 'confessor', name: 'Plague Confessor', role: 'Mender', summary: 'Mends the faithful and rots the unrepentant.' },
  censer: { id: 'censer', name: 'Censer Priestess', role: 'Mystic', summary: 'Holy smoke chokes, burns and weakens every foe.' },
  oracle: { id: 'oracle', name: 'Ash Oracle', role: 'Mystic', summary: "Reads doom in the ashes. She delays fate and strikes from afar." },
};

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
export const CLASS_DMG: Record<string, DmgType> = { warsister: 'physical', hierophant: 'physical', inquisitor: 'physical', confessor: 'magic', censer: 'magic', oracle: 'magic' };
export const dmgTagOf = (c: Pick<CrusaderDef, 'classId' | 'dmg'>): DmgType => c.dmg ?? CLASS_DMG[c.classId] ?? 'physical';
