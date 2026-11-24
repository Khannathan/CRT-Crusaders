import type { CrusaderDef } from './types';
import { basePassive } from './passives';
import { KITS } from './kits';
import { ROSTER } from './roster';
import { genKits } from './kitGen';

/**
 * The Sisters: Aaron's 500-Sister roster (sister bible, roster-500), built into
 * data/roster.ts by tools/roster/build_roster.py. Per Order: a Living Saint
 * (Limited UR), two Limited Commanders (Limited SSR) tied to her, two
 * Saintesses (UR), and a Commander (SSR), Officer (SR) and Conscript (R) of
 * each of the 15 classes.
 *
 * Ids are her slot in the bible (IV-LUR, IV-SSR-ARB, ...) and name her art
 * files: src/assets/portraits/<id>.png, full-body/<id>.png, splash/<id>.png.
 * Sisters without art yet stand in as an Order-and-class silhouette
 * (ui/standIn.ts). The 89 Sisters who came back from the old roster carry
 * their old id as `legacy` (old saves move over in state/rosterMigration.ts).
 * `title` is her roster title; `classId` the combat class she fights as. Every
 * first name is unique, because the UI often shows first names alone.
 */
export const CRUSADERS: CrusaderDef[] = ROSTER;

// Sisters without a hand-made kit get one from their Order's skills (data/kitGen.ts).
genKits(CRUSADERS);

// Every Sister carries a passive: her kit's signature (data/kits.ts), else her class's R/SR one.
for (const c of CRUSADERS) c.passive = KITS[c.id]?.passive ?? c.passive ?? basePassive(c);

const BY_ID = new Map(CRUSADERS.map((c) => [c.id, c]));
/** The Sister with this id. */
export const crusaderById = (id: string) => BY_ID.get(id);

/** Her rank in her Order: Conscript (R), Officer (SR), Commander (SSR), Saintess (UR) or Living Saint (Limited UR). */
export const rankTitle = (c: Pick<CrusaderDef, 'rarity' | 'limited'>) =>
  c.rarity === 'UR' && c.limited ? 'Living Saint' : ({ R: 'Conscript', SR: 'Officer', SSR: 'Commander', UR: 'Saintess' } as const)[c.rarity];
