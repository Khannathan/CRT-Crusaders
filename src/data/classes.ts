import type { ClassDef, Rarity } from './types';

export const CLASSES: Record<string, ClassDef> = {
  warsister: { id: 'warsister', name: 'Penitent War-Sister', role: 'Vanguard', summary: 'Hits hard by hurting herself; stronger as her health drops.' },
  hierophant: { id: 'hierophant', name: 'Reliquary Hierophant', role: 'Vanguard', summary: 'Shields allies and draws enemy attacks.' },
  inquisitor: { id: 'inquisitor', name: 'Inquisitor', role: 'Striker', summary: 'Marks a target as Accused so the party hits it harder.' },
  confessor: { id: 'confessor', name: 'Plague Confessor', role: 'Mender', summary: 'Heals one ally; poisons enemies over time.' },
  censer: { id: 'censer', name: 'Censer Priestess', role: 'Mystic', summary: 'Incense smoke weakens every enemy and burns them a little.' },
  oracle: { id: 'oracle', name: 'Ash Oracle', role: 'Mystic', summary: "Foresight delays an enemy's turn; heavy occult damage." },
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
