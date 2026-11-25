import type { SaveData } from '../state/save';
import { giltOf } from './currency';
import { fastCost } from './campaign';
import { errandsOf, isDone, claimErrand } from './errands';
import { FEAST_REPEATS, FEAST_STAGES, claimMarks, feastName, feastOf, repeatsLeft, sweepStage } from './feast';
import type { Rng } from './gacha';
import { huntEntriesLeft, huntSweepable, sweepHunt } from './hunts';
import { anyBondRewards, claimBondRewards } from './bonds';
import { addBags, bagText, type Bag } from './items';
import { lightCandle, matinsReady, vowCandidates, MATINS } from './matins';
import { PROCESSION_TIERS, offeringsText, processionLeft, processionSweepTier, sweepProcession } from './offerings';
import { claimGifts, giftsWaiting, opened } from './rank';
import { claimMark, claimable, type Period } from './tasks';
import { TIERS, bestStars, entriesLeft, openTrials, spoilsText, sweep, type TrialKind } from './trials';
import { claimVigil, ensureVigil, fastReward, vigilHours } from './vigil';
import { blessingReady, claimBlessing } from './packs';

/**
 * Morning Rounds: one tap does every daily chore that needs no choice from
 * the player: claims the Vigil and its free Fast Reward, lights Matins (unless
 * today's candle asks you to pick a Sister), pays Penance marks and Rank
 * gifts, brings errands home, sweeps mastered Relic Trials and won Feast
 * stages, and pays Feast milestones. What still needs the player is listed,
 * never done for them.
 */
export interface RoundsReport {
  /** One line per chore done. */
  done: string[];
  /** Chores left that need a choice or a fight. */
  left: string[];
  /** Everything gained, added up. */
  seals: number;
  tithes: number;
  gilt: number;
  gear: number;
  items: Bag;
}

/** True when Morning Rounds would do something right now. */
export function roundsReady(save: SaveData, now = Date.now()) {
  const v = save.vigil;
  return (
    (!!v && vigilHours(v, now) >= 1) ||
    (!!v && fastCost(save, now) === 0) ||
    (matinsReady(save, now) && !needsVowPick(save)) ||
    claimable(save, 'daily', now).length + claimable(save, 'weekly', now).length > 0 ||
    giftsWaiting(save).length > 0 ||
    blessingReady(save, now) ||
    anyBondRewards(save) ||
    (save.errands?.active ?? []).some((a) => isDone(a, now)) ||
    sweepableTrial(save, now) !== undefined ||
    (feastOf(save, now).won.length > 0 && repeatsLeft(save, now) > 0) ||
    (opened(save, 'Hunt') && huntSweepable(save, now)) ||
    (opened(save, 'Procession') && processionSweepTier(save, now) !== undefined)
  );
}

const needsVowPick = (save: SaveData) => !!MATINS[save.matins?.lit ?? 0]?.vowToken && vowCandidates(save).length > 0;

/** The best mastered (three-star) trial tier open today, if an entry is left. */
function sweepableTrial(save: SaveData, now: number) {
  if (!opened(save, 'Trials') || entriesLeft(save, now) <= 0) return undefined;
  let best: { kind: TrialKind; tier: number } | undefined;
  for (const t of openTrials(now)) {
    for (let tier = TIERS.length - 1; tier >= 0; tier--) {
      if (bestStars(save, t.kind, tier) >= 3) {
        if (!best || tier > best.tier) best = { kind: t.kind, tier };
        break;
      }
    }
  }
  return best;
}

export function morningRounds(save: SaveData, now = Date.now(), rng: Rng = Math.random): RoundsReport {
  const r: RoundsReport = { done: [], left: [], seals: 0, tithes: 0, gilt: 0, gear: 0, items: {} };
  const before = { seals: save.seals, tithes: save.tithes, gilt: giltOf(save), gear: save.gear?.length ?? 0 };

  // The Vigil, and its free Fast Reward.
  const v = ensureVigil(save, now);
  if (v && vigilHours(v, now) >= 1 / 60) {
    const c = claimVigil(save, now, rng);
    r.items = addBags(r.items, c.items);
    r.done.push(`Vigil claimed (${c.tithes} Tithes${c.gear.length ? `, ${c.gear.length} gear` : ''})`);
  }
  if (v && fastCost(save, now) === 0) {
    const c = fastReward(save, now, rng);
    if (c) {
      r.items = addBags(r.items, c.items);
      r.done.push('Free Fast Reward taken');
    }
  }

  // Matins, unless today's candle asks for a Sister.
  if (matinsReady(save, now)) {
    if (needsVowPick(save)) r.left.push('Matins: today’s candle holds a Vow token. Choose who receives it.');
    else {
      const m = lightCandle(save, now, undefined, rng);
      if (m) r.done.push(`Matins day ${m.day} lit`);
    }
  }

  // Rank gifts and Penance marks.
  if (claimBlessing(save, now)) r.done.push("The Abbess's Blessing claimed");
  if (giftsWaiting(save).length) {
    claimGifts(save);
    r.done.push('Rank gifts claimed');
  }
  let bondPaid = 0;
  for (const id of Object.keys(save.owned)) bondPaid += claimBondRewards(save, id).length;
  if (bondPaid) r.done.push(`${bondPaid} bond reward${bondPaid > 1 ? 's' : ''} claimed`);
  let marks = 0;
  for (const p of ['daily', 'weekly'] as Period[]) {
    for (const m of claimable(save, p, now)) {
      const got = claimMark(save, p, m.at, now);
      if (got?.items) r.items = addBags(r.items, got.items);
      if (got) marks++;
    }
  }
  if (marks) r.done.push(`${marks} Penance mark${marks > 1 ? 's' : ''} claimed`);

  // Errands home.
  const st = errandsOf(save, now);
  let home = 0;
  for (let i = st.active.length - 1; i >= 0; i--) {
    const got = claimErrand(save, i, now);
    if (got) {
      home++;
      if (got.items) r.items = addBags(r.items, got.items);
    }
  }
  if (home) r.done.push(`${home} errand${home > 1 ? 's' : ''} brought home`);

  // Relic Trials: sweep the best mastered tier while entries last.
  let swept = 0;
  for (let t = sweepableTrial(save, now); t; t = sweepableTrial(save, now)) {
    const got = sweep(save, t.kind, t.tier, rng);
    if (!got) break;
    if (got.items) r.items = addBags(r.items, got.items);
    swept++;
    if (swept === 1) r.done.push(`Relic Trials swept: ${spoilsText(got)}`);
  }
  if (swept > 1) r.done[r.done.length - 1] += ` (×${swept})`;
  if (opened(save, 'Trials') && entriesLeft(save, now) > 0) r.left.push(`Relic Trials: ${entriesLeft(save, now)} victories left (no mastered tier to sweep).`);

  // The Feast: sweep the richest won stage, then pay milestones.
  const f = feastOf(save, now);
  if (f.won.length) {
    const top = Math.max(...f.won);
    let candles = 0;
    for (let n = sweepStage(save, top, now); n; n = sweepStage(save, top, now)) candles += n;
    if (candles) r.done.push(`${feastName()}: ${FEAST_STAGES[top].name} swept for ${candles} Candles`);
  } else r.left.push(`${feastName()}: win its first stage to start sweeping (${FEAST_REPEATS} repeats a day).`);
  const paid = claimMarks(save, now);
  if (paid.length) r.done.push(`${paid.length} Feast milestone${paid.length > 1 ? 's' : ''} paid`);

  // Purge Hunts: one sweep counts most of your record against today's beast.
  if (opened(save, 'Hunt')) {
    const h = sweepHunt(save, now);
    if (h) {
      for (const m of h.rewards) {
        if (m.items) r.items = addBags(r.items, m.items);
      }
      r.done.push(`Purge Hunt swept at ${h.score.toLocaleString('en-US')} damage${h.rewards.length ? ` (${h.rewards.length} milestone${h.rewards.length > 1 ? 's' : ''} paid)` : ''}`);
    }
  }
  // The Reliquary Procession: sweep the highest tier won while entries last.
  if (opened(save, 'Procession')) {
    const got: string[] = [];
    let tier = -1;
    for (let p = sweepProcession(save, rng, now); p; p = sweepProcession(save, rng, now)) {
      got.push(...p.offerings);
      tier = p.tier;
    }
    if (got.length) r.done.push(`${PROCESSION_TIERS[tier].name} swept: ${offeringsText(got)}`);
  }

  // What still wants a fight.
  if (opened(save, 'Hunt') && huntEntriesLeft(save, now) > 0) r.left.push(`Purge Hunts: ${huntEntriesLeft(save, now)} hunts left to beat your record.`);
  if (opened(save, 'Procession') && processionLeft(save, now) > 0) r.left.push(`Reliquary Procession: ${processionLeft(save, now)} entries left (win a tier to sweep it).`);

  r.seals = save.seals - before.seals;
  r.tithes = save.tithes - before.tithes;
  r.gilt = giltOf(save) - before.gilt;
  r.gear = Math.max(0, (save.gear?.length ?? 0) - before.gear);
  return r;
}

/** "3 Seals + 1,200 Tithes + ..." for the summary. */
export const roundsTotal = (r: RoundsReport) =>
  [r.seals ? `${r.seals} Seal${r.seals > 1 ? 's' : ''}` : '', r.tithes ? `${r.tithes.toLocaleString()} Tithes` : '', r.gilt ? `${r.gilt} Gilt` : '', r.gear ? `${r.gear} gear` : '', bagText(r.items)].filter(Boolean).join(' + ');
