import type { SaveData } from '../state/save';
import type { Battle } from './combat';
import { OSSUARY, MAX_PARTY, skirmish, suggestParty } from './crusade';
import { boostedSSRs, type Rng } from './gacha';
import { partyPower, recommendedPower } from './power';

/**
 * The banner trial: try the banner's featured Sisters before you pull. Her UR
 * and her two boosted SSRs, lent at a fair level, fight the Choir Below beside
 * your strongest Sister. Nothing is paid and nothing is spent: the fight is
 * only a taste.
 */
export const TRIAL_LEVEL = 30;
/** The Choir is built to the party's Power: a real fight that a good party wins (Auto wins about 9 in 10). */
export const TRIAL_EDGE = 1;

/** The Sisters this trial lends you (the banner's UR first). */
export function trialLoan(save: SaveData, now = Date.now()): string[] {
  const target = save.banner?.target;
  return [...(target ? [target] : []), ...boostedSSRs(save, now).map((c) => c.id)].slice(0, MAX_PARTY);
}

/**
 * A copy of the save in which the loaned Sisters are sworn to you at the
 * trial level (or your best Sister's level, if higher). The real save is not
 * touched.
 */
export function trialSave(save: SaveData, now = Date.now()): SaveData {
  const shadow = structuredClone(save);
  const top = Math.max(TRIAL_LEVEL, ...Object.values(save.owned).map((o) => o.level));
  for (const id of trialLoan(save, now)) shadow.owned[id] = { level: top, vow: 0 };
  return shadow;
}

/** The loaned Sisters, then your strongest Sister not already among them. */
export function trialParty(save: SaveData, now = Date.now()): string[] {
  const loan = trialLoan(save, now);
  const own = suggestParty(save).find((id) => !loan.includes(id));
  return [...loan, ...(own ? [own] : [])].slice(0, MAX_PARTY);
}

/** Builds the trial fight against the Choir Below, matched to the party's Power. */
export function trialBattle(save: SaveData, rng?: Rng, now = Date.now()): Battle {
  const shadow = trialSave(save, now);
  const party = trialParty(save, now);
  const rec = recommendedPower(skirmish(shadow, [], OSSUARY.boss, 0, undefined, OSSUARY, 1));
  const scale = Math.max(0.5, (partyPower(shadow, party) * TRIAL_EDGE) / Math.max(1, rec));
  return skirmish(shadow, party, OSSUARY.boss, 0, rng, OSSUARY, scale);
}
