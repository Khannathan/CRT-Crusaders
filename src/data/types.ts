export type Rarity = 'R' | 'SR' | 'SSR' | 'UR';
export type Role = 'Vanguard' | 'Striker' | 'Mender' | 'Mystic';

export interface ClassDef {
  id: string;
  name: string;
  role: Role;
  summary: string;
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
  | 'swift';

/** SSR and UR crusaders carry one passive. */
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
}
