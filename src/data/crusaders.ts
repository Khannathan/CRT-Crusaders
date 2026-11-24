import type { CrusaderDef } from './types';
import { basePassive } from './passives';
import { KITS } from './kits';
import { ROSTER } from './roster';
import { genKits } from './kitGen';
import { forgeKits } from './kitForge';
import { CLASS_SKILLS } from './skills';
import { realtimeText } from './realtimeText';

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
// ...and the Kit Forge makes each one hers alone: twists, her own passive, her Relic, her battle cry.
for (const c of CRUSADERS) c.passive ??= basePassive(c);
forgeKits(CRUSADERS);

// Every Sister carries a passive: her kit's signature (data/kits.ts), else her class's R/SR one.
for (const c of CRUSADERS) c.passive = KITS[c.id]?.passive ?? c.passive ?? basePassive(c);

// Combat is real time: every line a player reads speaks in seconds and positions
// (data/realtimeText.ts). In place: kits share their class staples by reference.
const rt = (x: { desc: string } | undefined) => {
  if (x) x.desc = realtimeText(x.desc);
};
for (const kit of Object.values(KITS)) {
  for (const s of kit.skills) rt(s);
  rt(kit.passive);
  rt(kit.seal);
  rt(kit.relic);
}
for (const set of Object.values(CLASS_SKILLS)) for (const s of set) rt(s);
for (const c of CRUSADERS) rt(c.passive);

const BY_ID = new Map(CRUSADERS.map((c) => [c.id, c]));
/** The Sister with this id. */
export const crusaderById = (id: string) => BY_ID.get(id);

/** Her rank in her Order: Conscript (R), Officer (SR), Commander (SSR), Saintess (UR) or Living Saint (Limited UR). */
export const rankTitle = (c: Pick<CrusaderDef, 'rarity' | 'limited'>) =>
  c.rarity === 'UR' && c.limited ? 'Living Saint' : ({ R: 'Conscript', SR: 'Officer', SSR: 'Commander', UR: 'Saintess' } as const)[c.rarity];
