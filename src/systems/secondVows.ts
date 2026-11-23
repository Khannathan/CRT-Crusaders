import { CRUSADERS } from '../data/crusaders';
import type { OwnedCrusader, SaveData } from '../state/save';
import { VOW_LITANY, VOW_STAT, VOW_ZEAL, canonOf } from './canon';

export { VOW_LITANY, VOW_STAT, VOW_ZEAL };
import { hardOf } from './hardRoad';
import { countOf, spend } from './items';

/**
 * Second Vows: a canonized Sister's advanced class. Four trials, then she
 * takes a new title for good: all stats lift, her Litany strikes harder and
 * she opens every fight with Zeal. (The new look is her sprite's crimson
 * aura until her own art arrives.)
 */
export const VOW_CANON = 10;
export const VOW_PENITENT = 20;
export const VOW_HOLD = 5;
export const VOW_SEALS = 3;
export const VOW_TITHES = 50000;

/** The advanced title for each class. */
export const SECOND_TITLE: Record<string, string> = {
  hierophant: 'Reliquary Bastion',
  sentinel: 'Thorn Warden',
  martyr: 'Red Saint',
  confessor: 'Grand Confessor',
  hospitaller: 'Keeper of the Last Bed',
  abbess: 'Mother of Thorns',
  oracle: 'Ash Seer',
  cantor: 'Choir Mistress',
  adjudicator: 'High Adjudicator',
  warsister: 'Flagellant Saint',
  inquisitor: 'Headsman of Heaven',
  veilblade: 'Shroud of Knives',
  censer: 'Thurifer of Wrath',
  arbalist: 'Siege Arbalist',
  exorcist: 'Scourge of Spirits',
};

export const tookVows = (o: Pick<OwnedCrusader, 'secondVow'> | undefined) => !!o?.secondVow;
export const secondTitle = (classId: string) => SECOND_TITLE[classId] ?? 'Exalted Sister';

/** Most Hold the Line waves held with her in the party. */
export const heldWith = (save: SaveData, id: string) => save.holdLine?.withHer?.[id] ?? 0;

export interface Trial {
  label: string;
  done: boolean;
}

export function vowTrials(save: SaveData, id: string): Trial[] {
  const o = save.owned[id];
  return [
    { label: `Reach Canon rank X`, done: canonOf(o) >= VOW_CANON },
    { label: `Clear the Penitent Road to stage ${VOW_PENITENT}`, done: hardOf(save, 'penitent').best >= VOW_PENITENT },
    { label: `Hold ${VOW_HOLD} waves of Hold the Line with her (best ${Math.min(VOW_HOLD, heldWith(save, id))})`, done: heldWith(save, id) >= VOW_HOLD },
    { label: `Offer ${VOW_SEALS} Canon Seals and ${VOW_TITHES.toLocaleString('en-US')} Tithes (held ${countOf(save, 'canon3')})`, done: countOf(save, 'canon3') >= VOW_SEALS && save.tithes >= VOW_TITHES },
  ];
}

export function vowBlock(save: SaveData, id: string): string | undefined {
  const o = save.owned[id];
  if (!o) return 'Not in your Order';
  if (tookVows(o)) return 'She has taken her Second Vows';
  const left = vowTrials(save, id).filter((t) => !t.done);
  return left.length ? `${left.length} trial${left.length === 1 ? '' : 's'} left` : undefined;
}

export function takeSecondVows(save: SaveData, id: string): boolean {
  if (vowBlock(save, id)) return false;
  if (!spend(save, { canon3: VOW_SEALS })) return false;
  save.tithes -= VOW_TITHES;
  save.owned[id].secondVow = true;
  return true;
}

export const sistersWithVows = (save: SaveData) => CRUSADERS.filter((c) => tookVows(save.owned[c.id]));
