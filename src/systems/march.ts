import type { SaveData } from '../state/save';
import { bondBattle } from './bonds';
import { CHAPTERS, campaignOf, chapterChest, finishStage, nextStage, roadDone, stageBattle, stageDef, stageReward, type StageReward } from './campaign';
import type { Battle } from './combat';
import { expBattle } from './exp';
import { simulateField } from './field';
import type { Rng } from './gacha';
import { battleHosanna } from './hosanna';
import { addBags } from './items';
import { newSeed, seeded } from './rng';
import { sceneAfter, sceneBefore } from '../data/story';
import { seenScene } from './story';
import { VIGIL_SIZE } from './vigil';

/**
 * The March: the Vigil's Sisters push on along the Pilgrim's Road by
 * themselves, one stage after another, on every screen and while the game is
 * closed. Each fight takes as long as it would on the field (at the chosen
 * battle speed); time away is caught up when the game opens. Three defeats in
 * a row at one stage halt it (a wall), and so does the road's end.
 */
export interface MarchState {
  on: boolean;
  /** When the fight under way began (ms since epoch). */
  at: number;
  /** The fight under way: its stage, the Sisters in it, and when it ends. */
  fight?: { n: number; party: string[]; ends: number; seed: number };
  /** Defeats in a row at the stage now fought. */
  tries: number;
  /** Stages cleared since the summary was last looked at. */
  cleared: number[];
  /** EXP each Sister earned over those stages. */
  exp: number;
  /** Why the March halted, until it is looked at. */
  stopped?: { n: number; why: MarchStop };
}

export type MarchStop = 'wall' | 'end' | 'party';

/** Defeats in a row at one stage before the March halts. */
export const MARCH_TRIES = 3;
/** Seconds between fights: the walk to the next stage. */
export const MARCH_WALK = 4;
/** Longest a fight may run before it counts as lost. */
const MAX_FIGHT_SEC = 240;

export const marchOf = (save: SaveData): MarchState | undefined => save.campaign?.march;

/** Fights played but not settled yet, by seed, so a fight is only simulated once per session. */
const played = new Map<number, { battle: Battle; won: boolean; seconds: number }>();

function play(save: SaveData, party: string[], n: number, seed: number) {
  const hit = played.get(seed);
  if (hit) return hit;
  const battle = stageBattle(save, party, n, seeded(seed));
  const r = simulateField(battle, { hosanna: battleHosanna(save, battle), rng: seeded(seed + 1) }, MAX_FIGHT_SEC);
  const out = { battle, won: r.outcome === 'victory', seconds: r.seconds };
  played.set(seed, out);
  return out;
}

const marchParty = (save: SaveData) => (save.vigil?.party ?? []).filter((id) => save.owned[id]).slice(0, VIGIL_SIZE);

/** Switches the March on or off. Switching on clears an old halt and starts at once. */
export function setMarch(save: SaveData, on: boolean, now: number) {
  const c = campaignOf(save);
  const m = (c.march ??= { on: false, at: now, tries: 0, cleared: [], exp: 0 });
  if (on === m.on) return m;
  m.on = on;
  m.fight = undefined;
  m.tries = 0;
  m.at = now;
  if (on) m.stopped = undefined;
  return m;
}

function halt(m: MarchState, n: number, why: MarchStop) {
  m.on = false;
  m.fight = undefined;
  m.stopped = { n, why };
}

/**
 * Plays the March forward to `now`: starts fights, settles those whose time
 * is up, pays first clears like a won stage. `speed` is the battle speed.
 * Returns true if anything changed (so the caller saves).
 */
export function advanceMarch(save: SaveData, now: number, speed = 1, rng: Rng = Math.random): boolean {
  const m = marchOf(save);
  if (!m?.on) return false;
  let changed = false;
  for (let guard = 0; guard < 1000; guard++) {
    if (!m.fight) {
      const party = marchParty(save);
      if (roadDone(save)) {
        halt(m, campaignOf(save).best, 'end');
        return true;
      }
      if (!party.length) {
        halt(m, nextStage(save), 'party');
        return true;
      }
      const n = nextStage(save);
      const seed = Math.floor(rng() * 2 ** 31) || newSeed();
      const f = play(save, party, n, seed);
      m.fight = { n, party, seed, ends: m.at + ((f.seconds + MARCH_WALK) / Math.max(1, speed)) * 1000 };
      changed = true;
    }
    const fight = m.fight;
    if (now < fight.ends) break;
    // Its time is up: settle it.
    const f = play(save, fight.party, fight.n, fight.seed);
    played.delete(fight.seed);
    m.at = fight.ends;
    m.fight = undefined;
    changed = true;
    if (fight.n !== nextStage(save)) continue; // won by hand meanwhile: march on from there
    if (f.won) {
      finishStage(save, fight.n, 'victory');
      m.exp += expBattle(save, f.battle).exp;
      bondBattle(save, f.battle);
      m.cleared.push(fight.n);
      m.tries = 0;
    } else if (++m.tries >= MARCH_TRIES) {
      halt(m, fight.n, 'wall');
      return true;
    }
  }
  return changed;
}

/** What the March has done since its summary was last looked at. */
export interface MarchSummary {
  cleared: number[];
  /** First-clear rewards and chapter chests, added up. */
  reward: StageReward;
  exp: number;
  /** Story scenes passed on the way, waiting in the Chronicle. */
  scenes: number;
  stopped?: { n: number; why: MarchStop };
}

export function marchSummary(save: SaveData): MarchSummary | undefined {
  const m = marchOf(save);
  if (!m || (!m.cleared.length && !m.stopped)) return undefined;
  const reward: StageReward = { tithes: 0, seals: 0, gilt: 0, stigmata: 0, items: {} };
  const add = (r: StageReward) => {
    reward.tithes += r.tithes;
    reward.seals += r.seals;
    reward.gilt += r.gilt;
    reward.stigmata = (reward.stigmata ?? 0) + (r.stigmata ?? 0);
    reward.items = addBags(reward.items, r.items);
  };
  let scenes = 0;
  for (const n of m.cleared) {
    add(stageReward(n));
    const s = stageDef(n);
    if (s.boss) add(chapterChest(s.chapter));
    for (const sc of [sceneBefore(n), sceneAfter(n)]) if (sc && !seenScene(save, sc.id)) scenes++;
  }
  return { cleared: [...m.cleared], reward, exp: m.exp, scenes, stopped: m.stopped };
}

/** The summary has been looked at: start counting afresh. */
export function clearMarchSummary(save: SaveData) {
  const m = marchOf(save);
  if (!m) return;
  m.cleared = [];
  m.exp = 0;
  m.stopped = undefined;
}

/** One line on why the March halted. */
export function stopText(s: { n: number; why: MarchStop }) {
  const label = stageDef(Math.max(1, s.n)).label;
  if (s.why === 'end') return 'The road is walked to its end. Glory!';
  if (s.why === 'party') return 'Halted: no Sister keeps the Vigil. Post the watch!';
  return `Halted at ${label}: driven back ${MARCH_TRIES} times. Strengthen your Sisters and march again!`;
}

/** "1-3 to 2-2", or one stage's label. */
export function clearedText(cleared: number[]) {
  if (!cleared.length) return 'No stage won';
  const a = stageDef(cleared[0]).label;
  const b = stageDef(cleared[cleared.length - 1]).label;
  return `${cleared.length} stage${cleared.length > 1 ? 's' : ''} cleared (${a}${cleared.length > 1 ? ` to ${b}` : ''})`;
}

/** The chapter the March is fighting in now. */
export const marchChapter = (save: SaveData) => CHAPTERS[stageDef(nextStage(save)).chapter];
