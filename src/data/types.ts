export type Rarity = 'R' | 'SR' | 'SSR' | 'UR';
export type Role = 'Vanguard' | 'Striker' | 'Mender' | 'Mystic';

export interface ClassDef {
  id: string;
  name: string;
  role: Role;
  summary: string;
}

export type PassiveKind = 'unbroken' | 'critOnAccused' | 'startZeal';

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
  rarity: Rarity;
  order: string;
  age: number;
  hook: string;
  passive?: PassiveDef;
}
