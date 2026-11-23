export type Rarity = 'R' | 'SR' | 'SSR' | 'UR';
export type Role = 'Tank' | 'Healer' | 'Buffer' | 'Melee DPS' | 'Ranged DPS';

export interface ClassDef {
  id: string;
  name: string;
  role: Role;
  summary: string;
  /** The class whose emblem it borrows until its own art arrives. */
  icon?: string;
}

export type PassiveKind =
  | 'unbroken'
  | 'critOnAccused'
  | 'startZeal'
  | 'lifesteal'
  | 'executioner'
  | 'bulwark'
  | 'thorns'
  | 'zealOnKill'
  | 'healAura'
  | 'plague'
  | 'martyr'
  | 'swift'
  | 'riposte'
  /** A Sister's own signature from her kit (data/kits.ts); the rules sit in its `sig`. */
  | 'signature';

/** Every Sister carries one passive; rarer Sisters' are stronger (see data/passives.ts). */
export interface PassiveDef {
  name: string;
  desc: string;
  kind: PassiveKind;
  value?: number;
}

export interface CrusaderDef {
  /** Roster id; also the portrait file name: public/portraits/<id>.png */
  id: string;
  name: string;
  classId: string;
  /** Physical or Magic damage; defaults to her class's (see CLASS_DMG). */
  dmg?: import('./skills').DmgType;
  /** Her title from the roster (e.g. "Witchfire Deacon"); she fights as `classId`. */
  title?: string;
  rarity: Rarity;
  order: string;
  age: number;
  hook: string;
  passive?: PassiveDef;
  /** Her signature relic from the roster: what her Holy Symbol is. */
  relic?: string;
  /** A limited Saint: only on the Limited banner while her window is open (systems/limited.ts). */
  limited?: true;
}
