import { CLASSES } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { ENCOUNTERS } from '../data/enemies';
import { EVENTS, type EventOutcome } from '../data/events';
import { orderBonuses } from '../data/orders';
import { RELICS, type RelicDef } from '../data/relics';
import type { SaveData } from '../state/save';
import { Battle, VIGIL_DEFAULT, makeEnemy, type Unit } from './combat';
import type { Rng } from './gacha';
import { levelUpCost, statsFor } from './stats';

export type NodeKind = 'fight' | 'elite' | 'event' | 'shrine' | 'reliquary' | 'boss';

/** One stop on the crypt map. `next` lists reachable node indices on the floor above. */
export interface MapNode {
  kind: NodeKind;
  encounter?: string;
  event?: string;
  next: number[];
}

export interface CryptDef {
  id: string;
  name: string;
  blurb: string;
  /** Floors before the boss. */
  floors: number;
  /** Fight pools: the first two floors draw from `early`, later ones from `late`. */
  early: string[];
  late: string[];
  elites: string[];
  boss: string;
  bossName: string;
  /** Reward multiplier for harder crypts. */
  rewardMult: number;
  /** Crypt id that must be cleared first. */
  unlockAfter?: string;
}

export const OSSUARY: CryptDef = {
  id: 'drowned-ossuary',
  name: 'The Drowned Ossuary',
  blurb: 'A flooded charnel house. The drowned still sing.',
  floors: 5,
  early: ['ossuary-1', 'ossuary-2'],
  late: ['ossuary-3', 'ossuary-4', 'ossuary-5'],
  elites: ['ossuary-elite-1', 'ossuary-elite-2'],
  boss: 'choir',
  bossName: 'The Choir Below',
  rewardMult: 1,
};

export const BELFRY: CryptDef = {
  id: 'sunken-belfry',
  name: 'The Sunken Belfry',
  blurb: 'A belfry in the marsh, still ringing for vespers.',
  floors: 6,
  early: ['belfry-1', 'belfry-2'],
  late: ['belfry-3', 'belfry-4', 'belfry-5'],
  elites: ['belfry-elite-1', 'belfry-elite-2'],
  boss: 'abbess',
  bossName: 'The Hollow Abbess',
  rewardMult: 1.6,
  unlockAfter: 'drowned-ossuary',
};

export const CRYPTS: CryptDef[] = [OSSUARY, BELFRY];

export const cryptUnlocked = (save: SaveData, c: CryptDef) => !c.unlockAfter || save.cleared.includes(c.unlockAfter);

export const REWARDS = {
  fightTithes: 45,
  eliteTithes: 90,
  eliteSeals: 1,
  bossTithes: 150,
  bossSeals: 2,
  completeSeals: 3,
  firstClearSeals: 5,
  /** Share of Tithes kept after a defeat. */
  defeatKeep: 0.5,
  shrineHealPct: 0.4,
};

export interface RunState {
  crypt: CryptDef;
  map: MapNode[][];
  /** Crusader ids in rank order (rank 1 first). */
  party: string[];
  hp: Record<string, number>;
  /** Floor of the current or last node; -1 before the first step. */
  floor: number;
  /** Index of that node on its floor. */
  at: number;
  /** Node index chosen on each floor so far. */
  path: number[];
  /** True once the current node is done. */
  resolved: boolean;
  relics: string[];
  tithes: number;
  seals: number;
  /** A relic choice is waiting (after an elite or an event). */
  pendingRelic?: boolean;
  /** Heresy tier: 0 is the base crypt, each tier is harder and pays more. */
  heresy: number;
  /** Extra Zeal for the next fight only. */
  blessZeal?: number;
  /** Shorter Vigil for the next fight only. */
  curseVigil?: number;
}

/**
 * Builds a branching map: 2-3 choices per floor, fights first, an elite floor
 * in the middle, a rest floor (shrine or reliquary) before the boss.
 */
export function generateMap(crypt: CryptDef, rng: Rng = Math.random): MapNode[][] {
  const pick = <T>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
  const events = Object.keys(EVENTS);
  const map: MapNode[][] = [];
  const eliteFloor = Math.floor(crypt.floors / 2) + (crypt.floors > 5 ? 1 : 0);
  for (let f = 0; f < crypt.floors; f++) {
    const width = f === 0 ? 2 : 2 + Math.floor(rng() * 2);
    const floor: MapNode[] = [];
    for (let i = 0; i < width; i++) {
      let kind: NodeKind;
      if (f === 0) kind = 'fight';
      else if (f === crypt.floors - 1) kind = i === 0 ? 'shrine' : i === 1 ? 'reliquary' : 'event';
      else if (f === eliteFloor) kind = i === 0 ? 'elite' : pick(['fight', 'event', 'fight']);
      else kind = pick(['fight', 'fight', 'fight', 'event', 'event', 'shrine', 'reliquary', ...(f > 1 ? ['elite' as const] : [])]);
      const node: MapNode = { kind, next: [] };
      if (kind === 'fight') node.encounter = pick(f < 2 ? crypt.early : crypt.late);
      if (kind === 'elite') node.encounter = pick(crypt.elites);
      if (kind === 'event') node.event = pick(events);
      floor.push(node);
    }
    // Shuffle so the elite, shrine and so on are not always on the left.
    for (let i = floor.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [floor[i], floor[j]] = [floor[j], floor[i]];
    }
    map.push(floor);
  }
  map.push([{ kind: 'boss', encounter: crypt.boss, next: [] }]);

  // Paths: each node reaches the nearest node(s) above; every node is reachable.
  for (let f = 0; f < map.length - 1; f++) {
    const here = map[f];
    const up = map[f + 1];
    const pos = (i: number, n: number) => (n === 1 ? 0.5 : i / (n - 1));
    here.forEach((node, i) => {
      const p = pos(i, here.length);
      const near = up.map((_, j) => j).sort((a, b) => Math.abs(pos(a, up.length) - p) - Math.abs(pos(b, up.length) - p));
      node.next = [near[0]];
      if (near.length > 1 && rng() < 0.55) node.next.push(near[1]);
    });
    up.forEach((_, j) => {
      if (here.some((n) => n.next.includes(j))) return;
      const p = pos(j, up.length);
      const from = here.map((_, i) => i).sort((a, b) => Math.abs(pos(a, here.length) - p) - Math.abs(pos(b, here.length) - p))[0];
      here[from].next.push(j);
    });
    here.forEach((n) => n.next.sort((a, b) => a - b));
  }
  return map;
}

export const MAX_PARTY = 4;

export function canMuster(save: SaveData, id: string) {
  const o = save.owned[id];
  return !!o && !o.recovering;
}

export const reviveCost = (level: number) => Math.round(levelUpCost(level) * 0.6);

export function startRun(save: SaveData, party: string[], crypt: CryptDef = OSSUARY, rng: Rng = Math.random, heresy = 0): RunState {
  const ids = party.filter((id) => canMuster(save, id)).slice(0, MAX_PARTY);
  const run: RunState = { crypt, map: generateMap(crypt, rng), party: ids, hp: {}, path: [], floor: -1, at: 0, resolved: true, heresy, relics: [], tithes: 0, seals: 0 };
  for (const id of ids) run.hp[id] = maxHpOf(save, run, id);
  save.lastParty = ids;
  return run;
}

/** Everything that modifies the party this run: relics plus Order bonuses. */
function relicsOf(run: RunState): RelicDef[] {
  const relics = run.relics.map((id) => RELICS.find((r) => r.id === id)!).filter(Boolean);
  const orders = run.party.map((id) => CRUSADERS.find((c) => c.id === id)?.order ?? '');
  return [...relics, ...orderBonuses(orders)];
}

export const MAX_HERESY = 5;
export const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
/** Enemy HP and attack per Heresy tier. */
export const HERESY_ENEMY = 0.25;
/** Reward bonus per Heresy tier. */
export const HERESY_REWARD = 0.3;
export const HERESY_FIRST_CLEAR_SEALS = 3;

/** Highest Heresy tier the player may pick for a crypt: one past the best cleared. */
export function heresyAvailable(save: SaveData, crypt: CryptDef): number {
  if (!save.cleared.includes(crypt.id)) return 0;
  return Math.min(MAX_HERESY, (save.heresy?.[crypt.id] ?? 0) + 1);
}

export const rewardMult = (run: RunState) => run.crypt.rewardMult * (1 + HERESY_REWARD * run.heresy);

export function maxHpOf(save: SaveData, run: RunState, id: string) {
  const c = CRUSADERS.find((x) => x.id === id)!;
  const hpPct = relicsOf(run).reduce((s, r) => s + (r.hpPct ?? 0), 0);
  return Math.round(statsFor(c, save.owned[id]).hp * (1 + hpPct));
}

/** Builds a battle for the current room from the run's party and HP. */
export function makeBattle(save: SaveData, run: RunState, encounter: string, rng?: Rng): Battle {
  const relics = relicsOf(run);
  const atkPct = relics.reduce((s, r) => s + (r.atkPct ?? 0), 0);
  const zeal = relics.reduce((s, r) => s + (r.startZeal ?? 0), 0) + (run.blessZeal ?? 0);
  const armorPct = relics.reduce((s, r) => s + (r.armorPct ?? 0), 0);
  // Heresy shortens the candle by a round every second tier.
  const vigil = Math.max(2, VIGIL_DEFAULT + relics.reduce((s, r) => s + (r.vigilBonus ?? 0), 0) - (run.curseVigil ?? 0) - Math.floor(run.heresy / 2));
  const enemyScale = 1 + HERESY_ENEMY * run.heresy;

  let rank = 0;
  const party: Unit[] = [];
  for (const id of run.party) {
    if (run.hp[id] <= 0) continue;
    const c = CRUSADERS.find((x) => x.id === id)!;
    const st = statsFor(c, save.owned[id]);
    party.push({
      uid: id,
      side: 'party',
      name: c.name.split(' ')[0],
      ref: id,
      classId: c.classId,
      rank: ++rank,
      maxHp: maxHpOf(save, run, id),
      hp: run.hp[id],
      atk: Math.round(st.atk * (1 + atkPct)),
      armor: Math.round(st.armor * (1 + armorPct)),
      vow: save.owned[id].vow,
      crit: st.crit + relics.reduce((n, r) => n + (r.critAdd ?? 0), 0),
      passive: c.passive,
      spd: st.spd + (c.passive?.kind === 'swift' ? c.passive.value ?? 0 : 0),
      status: {},
    });
  }
  const enemies = ENCOUNTERS[encounter].map((type, i) => makeEnemy(type, `e${i}`, i + 1, enemyScale));
  return new Battle(party, enemies, { rng, vigil, zeal, enemyScale });
}

/** The node being played, if it is not finished yet. */
export function currentNode(run: RunState): MapNode | undefined {
  return run.floor >= 0 && !run.resolved ? run.map[run.floor][run.at] : undefined;
}

/** Node indices on the next floor the party may step to. */
export function choices(run: RunState): number[] {
  if (!run.resolved || run.pendingRelic) return [];
  if (run.floor < 0) return run.map[0].map((_, i) => i);
  if (run.floor >= run.map.length - 1) return [];
  return run.map[run.floor][run.at].next;
}

export function enterNode(run: RunState, index: number): MapNode {
  if (!choices(run).includes(index)) throw new Error('not reachable');
  run.floor += 1;
  run.at = index;
  run.path.push(index);
  run.resolved = false;
  return run.map[run.floor][index];
}

/** True once the boss is beaten. */
export function cryptCleared(run: RunState) {
  return run.floor === run.map.length - 1 && run.resolved;
}

/** Copies HP and rank order back from a finished battle. */
export function absorbBattle(run: RunState, battle: Battle) {
  const party = battle.units.filter((u) => u.side === 'party');
  for (const u of party) run.hp[u.ref] = u.hp;
  const living = party.filter((u) => u.hp > 0).sort((a, b) => a.rank - b.rank).map((u) => u.ref);
  const fallen = run.party.filter((id) => run.hp[id] <= 0);
  run.party = [...living, ...fallen];
  // One-fight blessings and curses are spent.
  run.blessZeal = undefined;
  run.curseVigil = undefined;
}

/** Rewards a won fight and marks the node done. */
export function winRoom(run: RunState, save?: SaveData) {
  const node = currentNode(run)!;
  const fightHeal = relicsOf(run).reduce((n, r) => n + (r.fightHeal ?? 0), 0);
  if (save && fightHeal) healAll(save, run, fightHeal);
  const m = rewardMult(run);
  if (node.kind === 'boss') {
    run.tithes += Math.round(REWARDS.bossTithes * m);
    run.seals += REWARDS.bossSeals;
  } else if (node.kind === 'elite') {
    run.tithes += Math.round(REWARDS.eliteTithes * m);
    run.seals += REWARDS.eliteSeals;
    run.pendingRelic = relicOffer(run).length > 0;
  } else {
    run.tithes += Math.round(REWARDS.fightTithes * m);
  }
  run.resolved = true;
}

function healAll(save: SaveData, run: RunState, pct: number) {
  for (const id of run.party) {
    if (run.hp[id] <= 0) continue;
    const max = maxHpOf(save, run, id);
    run.hp[id] = Math.min(max, run.hp[id] + Math.round(max * pct));
  }
}

export function shrine(save: SaveData, run: RunState) {
  healAll(save, run, REWARDS.shrineHealPct);
  run.resolved = true;
}

/** Plays an event choice. Returns the outcome that happened, for the message. */
export function chooseEvent(save: SaveData, run: RunState, optionIndex: number, rng: Rng = Math.random): EventOutcome {
  const node = currentNode(run)!;
  const opt = EVENTS[node.event!].options[optionIndex];
  const out = opt.chance === undefined || rng() < opt.chance ? opt.outcome : opt.fail ?? opt.outcome;
  if (out.hurt) {
    for (const id of run.party) {
      if (run.hp[id] <= 0) continue;
      // Events wound but never kill.
      run.hp[id] = Math.max(1, run.hp[id] - Math.round(maxHpOf(save, run, id) * out.hurt));
    }
  }
  if (out.heal) healAll(save, run, out.heal);
  if (out.tithes) run.tithes += out.tithes;
  if (out.seals) run.seals += out.seals;
  if (out.blessZeal) run.blessZeal = (run.blessZeal ?? 0) + out.blessZeal;
  if (out.curseVigil) run.curseVigil = (run.curseVigil ?? 0) + out.curseVigil;
  if (out.relic && relicOffer(run).length) run.pendingRelic = true;
  run.resolved = true;
  return out;
}

/** Three relics not yet held, in random order. */
export function relicOffer(run: RunState, rng: Rng = Math.random): RelicDef[] {
  const pool = RELICS.filter((r) => !run.relics.includes(r.id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

export function takeRelic(save: SaveData, run: RunState, relicId: string) {
  const before: Record<string, number> = {};
  for (const id of run.party) before[id] = maxHpOf(save, run, id);
  run.relics.push(relicId);
  // Extra max HP arrives as healing too, so the bonus is felt at once.
  for (const id of run.party) if (run.hp[id] > 0) run.hp[id] += maxHpOf(save, run, id) - before[id];
  run.pendingRelic = false;
  run.resolved = true;
}

export interface RunResult {
  outcome: 'victory' | 'defeat' | 'retreat';
  tithes: number;
  seals: number;
  firstClear: boolean;
  /** Heresy tier just cleared for the first time, if any. */
  heresyCleared?: number;
  fallen: string[];
}

/** Ends the run: pays out, marks the fallen as recovering, and lets others recover. */
export function finishRun(save: SaveData, run: RunState, outcome: RunResult['outcome']): RunResult {
  let tithes = run.tithes;
  let seals = run.seals;
  let firstClear = false;
  let heresyCleared: number | undefined;
  if (outcome === 'victory') {
    seals += REWARDS.completeSeals;
    if (!save.cleared.includes(run.crypt.id)) {
      firstClear = true;
      seals += REWARDS.firstClearSeals;
      save.cleared.push(run.crypt.id);
    }
    const best = (save.heresy ??= {})[run.crypt.id] ?? 0;
    if (run.heresy > best) {
      save.heresy[run.crypt.id] = run.heresy;
      seals += HERESY_FIRST_CLEAR_SEALS;
      heresyCleared = run.heresy;
    }
  } else if (outcome === 'defeat') {
    tithes = Math.round(tithes * REWARDS.defeatKeep);
    seals = 0;
  }

  for (const [id, o] of Object.entries(save.owned)) {
    if (!run.party.includes(id) && o.recovering) o.recovering -= 1;
  }
  const fallen = run.party.filter((id) => run.hp[id] <= 0);
  for (const id of fallen) save.owned[id].recovering = 1;

  save.tithes += tithes;
  save.seals += seals;
  return { outcome, tithes, seals, firstClear, heresyCleared, fallen };
}

export function revive(save: SaveData, id: string): boolean {
  const o = save.owned[id];
  if (!o?.recovering) return false;
  const cost = reviveCost(o.level);
  if (save.tithes < cost) return false;
  save.tithes -= cost;
  o.recovering = 0;
  return true;
}

/** Suggested ranks: Vanguards front, Strikers next, Mystics, Menders at the back. */
export function suggestParty(save: SaveData): string[] {
  const order = { Vanguard: 0, Striker: 1, Mystic: 2, Mender: 3 } as const;
  const ready = CRUSADERS.filter((c) => canMuster(save, c.id));
  const byStrength = [...ready].sort((a, b) => statsFor(b, save.owned[b.id]).atk - statsFor(a, save.owned[a.id]).atk);
  // one of each role first, then the strongest of the rest
  const picked: typeof ready = [];
  for (const role of Object.keys(order) as (keyof typeof order)[]) {
    const best = byStrength.find((c) => CLASSES[c.classId].role === role && !picked.includes(c));
    if (best) picked.push(best);
  }
  for (const c of byStrength) if (picked.length < MAX_PARTY && !picked.includes(c)) picked.push(c);
  return picked
    .slice(0, MAX_PARTY)
    .sort((a, b) => order[CLASSES[a.classId].role] - order[CLASSES[b.classId].role])
    .map((c) => c.id);
}
