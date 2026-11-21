import { CLASSES } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { ENCOUNTERS } from '../data/enemies';
import { RELICS, type RelicDef } from '../data/relics';
import type { SaveData } from '../state/save';
import { Battle, VIGIL_DEFAULT, makeEnemy, type Unit } from './combat';
import type { Rng } from './gacha';
import { levelUpCost, statsFor } from './stats';

export type Room =
  | { kind: 'fight'; encounter: string }
  | { kind: 'choice' }
  | { kind: 'boss'; encounter: string };

export interface CryptDef {
  id: string;
  name: string;
  rooms: Room[];
}

export const OSSUARY: CryptDef = {
  id: 'drowned-ossuary',
  name: 'The Drowned Ossuary',
  rooms: [{ kind: 'fight', encounter: 'ossuary-1' }, { kind: 'choice' }, { kind: 'fight', encounter: 'ossuary-2' }, { kind: 'boss', encounter: 'choir' }],
};

export type ChoiceKind = 'fight' | 'shrine' | 'reliquary';

export const REWARDS = {
  fightTithes: 60,
  sideFightTithes: 100,
  sideFightSeals: 1,
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
  /** Crusader ids in rank order (rank 1 first). */
  party: string[];
  hp: Record<string, number>;
  roomIndex: number;
  relics: string[];
  tithes: number;
  seals: number;
  /** Set when the middle room's choice was a fight. */
  sideFight?: boolean;
}

export const MAX_PARTY = 4;

export function canMuster(save: SaveData, id: string) {
  const o = save.owned[id];
  return !!o && !o.recovering;
}

export const reviveCost = (level: number) => Math.round(levelUpCost(level) * 0.6);

export function startRun(save: SaveData, party: string[], crypt: CryptDef = OSSUARY): RunState {
  const ids = party.filter((id) => canMuster(save, id)).slice(0, MAX_PARTY);
  const run: RunState = { crypt, party: ids, hp: {}, roomIndex: 0, relics: [], tithes: 0, seals: 0 };
  for (const id of ids) run.hp[id] = maxHpOf(save, run, id);
  save.lastParty = ids;
  return run;
}

function relicsOf(run: RunState): RelicDef[] {
  return run.relics.map((id) => RELICS.find((r) => r.id === id)!).filter(Boolean);
}

export function maxHpOf(save: SaveData, run: RunState, id: string) {
  const c = CRUSADERS.find((x) => x.id === id)!;
  const hpPct = relicsOf(run).reduce((s, r) => s + (r.hpPct ?? 0), 0);
  return Math.round(statsFor(c, save.owned[id]).hp * (1 + hpPct));
}

/** Builds a battle for the current room from the run's party and HP. */
export function makeBattle(save: SaveData, run: RunState, encounter: string, rng?: Rng): Battle {
  const relics = relicsOf(run);
  const atkPct = relics.reduce((s, r) => s + (r.atkPct ?? 0), 0);
  const zeal = relics.reduce((s, r) => s + (r.startZeal ?? 0), 0);
  const vigil = VIGIL_DEFAULT + relics.reduce((s, r) => s + (r.vigilBonus ?? 0), 0);

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
      def: st.def,
      spd: st.spd,
      status: {},
    });
  }
  const enemies = ENCOUNTERS[encounter].map((type, i) => makeEnemy(type, `e${i}`, i + 1));
  return new Battle(party, enemies, { rng, vigil, zeal });
}

export function currentRoom(run: RunState): Room | undefined {
  return run.crypt.rooms[run.roomIndex];
}

/** Copies HP and rank order back from a finished battle. */
export function absorbBattle(run: RunState, battle: Battle) {
  const party = battle.units.filter((u) => u.side === 'party');
  for (const u of party) run.hp[u.ref] = u.hp;
  const living = party.filter((u) => u.hp > 0).sort((a, b) => a.rank - b.rank).map((u) => u.ref);
  const fallen = run.party.filter((id) => run.hp[id] <= 0);
  run.party = [...living, ...fallen];
}

/** Rewards a won room and moves to the next. */
export function winRoom(run: RunState) {
  const room = currentRoom(run)!;
  if (room.kind === 'boss') {
    run.tithes += REWARDS.bossTithes;
    run.seals += REWARDS.bossSeals;
  } else if (room.kind === 'choice' && run.sideFight) {
    run.tithes += REWARDS.sideFightTithes;
    run.seals += REWARDS.sideFightSeals;
  } else {
    run.tithes += REWARDS.fightTithes;
  }
  run.roomIndex += 1;
}

export function shrine(save: SaveData, run: RunState) {
  for (const id of run.party) {
    if (run.hp[id] <= 0) continue;
    const max = maxHpOf(save, run, id);
    run.hp[id] = Math.min(max, run.hp[id] + Math.round(max * REWARDS.shrineHealPct));
  }
  run.roomIndex += 1;
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
  run.roomIndex += 1;
}

export interface RunResult {
  outcome: 'victory' | 'defeat' | 'retreat';
  tithes: number;
  seals: number;
  firstClear: boolean;
  fallen: string[];
}

/** Ends the run: pays out, marks the fallen as recovering, and lets others recover. */
export function finishRun(save: SaveData, run: RunState, outcome: RunResult['outcome']): RunResult {
  let tithes = run.tithes;
  let seals = run.seals;
  let firstClear = false;
  if (outcome === 'victory') {
    seals += REWARDS.completeSeals;
    if (!save.cleared.includes(run.crypt.id)) {
      firstClear = true;
      seals += REWARDS.firstClearSeals;
      save.cleared.push(run.crypt.id);
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
  return { outcome, tithes, seals, firstClear, fallen };
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
