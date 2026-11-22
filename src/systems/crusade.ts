import { BOND_XP, addBond } from './bonds';
import { GILT_FIRST_CLEAR, GILT_HERESY, earn } from './currency';
import { CLASSES } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { ENCOUNTERS, ENEMIES } from '../data/enemies';
import { EVENTS, type EventOutcome } from '../data/events';
import { orderBonuses } from '../data/orders';
import { FAMILY_BONUS, RELICS, relicById, type RelicDef, type RelicFamily } from '../data/relics';
import type { SaveData } from '../state/save';
import { Battle, VIGIL_DEFAULT, makeEnemy, type Unit } from './combat';
import type { Rng } from './gacha';
import { claimGear, makeGear, rollGearRarity, type GearItem } from './gear';
import { recommendedPower } from './power';
import { addBags, give, roomDrops, type Bag } from './items';
import { levelUpCost, sisterStats } from './stats';
import { rankOf } from './rank';
import { noteClear, type Beaten } from './records';
import { track, weekKey } from './tasks';
import { skillVow } from './tiers';

export type NodeKind = 'fight' | 'elite' | 'event' | 'shrine' | 'reliquary' | 'boss' | 'miracle';

/** One stop on the crypt map. `next` lists reachable node indices on the floor above. */
export interface MapNode {
  kind: NodeKind;
  encounter?: string;
  event?: string;
  next: number[];
  /** Act (1-3) the node belongs to. */
  act?: number;
  /** A boss node's own name (Wardens and the bosses of earlier acts). */
  name?: string;
  /** A Warden: the lesser boss in the middle of a long act. */
  warden?: boolean;
  /** The boss that closes an act before the last: beating it opens a Sanctuary. */
  actEnd?: boolean;
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
  /** Enemy stat multiplier for deeper crypts (1 when absent). */
  power?: number;
  /** Name of the Warden met mid-act. */
  wardenName?: string;
  /** Names for the acts after the first ("The Flooded Nave", ...). */
  actNames?: string[];
}

/**
 * The floor ramp: each crypt is one step (5 to 10 floors in one act, then 15 to
 * 20 in two, then 25 to 30 in three), and a crypt's Heresy tiers climb the same
 * ramp from its own size so its last tier always reaches 30 floors.
 */
export const RAMP = [5, 6, 7, 8, 9, 10, 15, 16, 17, 18, 19, 20, 25, 26, 27, 28, 29, 30];
export const MAX_FLOORS = 30;
/** An act this long or longer also has a Warden halfway. */
export const WARDEN_ACT = 8;
/** Share of max HP each Sister gets back at a Sanctuary between acts. */
export const SANCTUARY_HEAL = 0.4;
/** Enemies grow this much stronger with each act. */
export const ACT_ENEMY = 0.15;

/** Floors split into acts: up to 10 in the first, then the rest in acts of up to 10. */
export function actsOf(floors: number): number[] {
  const out: number[] = [];
  let left = floors;
  while (left > 0) {
    out.push(Math.min(10, left));
    left -= 10;
  }
  return out;
}

/** Floors a crypt has at a Heresy tier: its own size at Normal, 30 at the last tier. */
export function cryptFloors(crypt: CryptDef, heresy = 0): number {
  const base = crypt.floors;
  if (base >= MAX_FLOORS || heresy <= 0) return base;
  const want = base + ((MAX_FLOORS - base) * Math.min(heresy, MAX_HERESY)) / MAX_HERESY;
  return RAMP.reduce((best, f) => (f >= base && Math.abs(f - want) < Math.abs(best - want) ? f : best), base);
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
  wardenName: 'The Ossuary Keeper',
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
  wardenName: 'The Bell-Ringer',
  rewardMult: 1.6,
  unlockAfter: 'drowned-ossuary',
};

/**
 * The deeper crypts, one ramp step each. Until their own enemies and art
 * arrive they reuse the Ossuary and Belfry hosts, made stronger by `power`.
 * Names are placeholders.
 */
const DEEP: [string, string, string, string][] = [
  ['weeping-cloister', 'The Weeping Cloister', 'Nuns who never stopped praying, long after they stopped breathing.', 'Sister Lament'],
  ['ash-scriptorium', 'The Ash Scriptorium', 'The copyists burned with their books. The ink still moves.', 'The Unbound Scribe'],
  ['hanging-chapel', 'The Hanging Chapel', 'A chapel slung beneath a bridge, swaying over black water.', 'The Hanged Deacon'],
  ['bone-orchard', 'The Bone Orchard', 'An orchard planted in a plague pit. The fruit is pale.', 'The Gardener'],
  ['salt-catacomb', 'The Salt Catacomb', 'Bodies packed in salt, waiting to be remembered.', 'The Salt Matron'],
  ['flooded-nave', 'The Flooded Nave', 'A cathedral sunk to its rafters. The bells ring underwater.', 'The Drowned Verger'],
  ['iron-oubliette', 'The Iron Oubliette', 'A prison for the unrepentant, and for what they became.', 'The Jailer'],
  ['candle-maze', 'The Candle Maze', 'Ten thousand candles, and each one is a soul.', 'The Wick-Keeper'],
  ['red-refectory', 'The Red Refectory', 'The brothers still sit down to dinner. Do not ask what is served.', 'The Cellarer'],
  ['choir-loft', 'The Endless Choir Loft', 'A stair of pews that climbs into the dark, singing.', 'The Cantor'],
  ['penitent-well', "The Penitent's Well", 'Pilgrims threw their sins down here. The sins climbed back.', 'The Well-Warden'],
  ['thorned-sacristy', 'The Thorned Sacristy', 'Vestments of briar, chalices of rust, a priest of thorns.', 'The Thorn Priest'],
  ['mirror-crypt', 'The Mirror Crypt', 'Every Sister who enters meets herself, and she is hungry.', 'The Reflection'],
  ['plague-hospice', 'The Plague Hospice', 'The sick were walled in to save the city. The walls are thin now.', 'The Physician'],
  ['abyssal-ossuary', 'The Abyssal Ossuary', 'Below the first Ossuary, older bones arranged in older prayers.', 'The Bone Choir'],
  ['last-altar', 'The Last Altar', 'Where the heresy began. Where it will end.', 'The First Heretic'],
];
const DEEP_CRYPTS: CryptDef[] = DEEP.map(([id, name, blurb, warden], i) => {
  const step = i + 2; // the Ossuary and the Belfry are steps 0 and 1
  const like = i % 2 === 0 ? OSSUARY : BELFRY;
  return {
    ...like,
    id,
    name,
    blurb,
    floors: RAMP[step],
    unlockAfter: i === 0 ? BELFRY.id : DEEP[i - 1][0],
    power: Math.round(Math.pow(1.17, step - 1) * 100) / 100,
    rewardMult: Math.round(BELFRY.rewardMult * Math.pow(1.15, step - 1) * 100) / 100,
    wardenName: warden,
  };
});

export const CRYPTS: CryptDef[] = [OSSUARY, BELFRY, ...DEEP_CRYPTS];

export const cryptUnlocked = (save: SaveData, c: CryptDef) => !c.unlockAfter || save.cleared.includes(c.unlockAfter);

export const REWARDS = {
  fightTithes: 45,
  eliteTithes: 90,
  eliteSeals: 1,
  bossTithes: 150,
  bossSeals: 2,
  completeSeals: 3,
  firstClearSeals: 5,
  /** Share of unbanked Tithes and materials kept after a defeat (banked spoils are always safe). */
  defeatKeep: 0.75,
  /** Chance an ordinary fight drops a piece of gear (elites drop one, bosses two). */
  fightGearChance: 0.35,
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
  /** The waiting relic choice comes from this family. */
  offerFamily?: RelicFamily;
  /** Heresy tier: 0 is the base crypt, each tier is harder and pays more. */
  heresy: number;
  /** Gear found so far, claimed when the run ends, win or lose. */
  loot: GearItem[];
  /** Materials found so far: all kept on victory or retreat; on defeat, see banked. */
  items?: Bag;
  /** Tithes and materials made safe at the last Sanctuary: kept in full even on defeat. */
  banked?: { tithes: number; items: Bag };
  /** Faith and each Sister's level and EXP when the run began, so the results can show what moved. */
  start?: RunStart;
  /** Battle rounds fought so far, for the fastest-clear record. */
  rounds?: number;
  /** Extra Zeal for the next fight only. */
  blessZeal?: number;
  /** Shorter Vigil for the next fight only. */
  curseVigil?: number;
  /** Set to the act just finished while the party rests at a Sanctuary. */
  sanctuary?: number;
}

export interface RunStart {
  faith: number;
  exp: Record<string, { level: number; exp: number }>;
}

export function runStart(save: SaveData, ids: string[]): RunStart {
  const exp: RunStart['exp'] = {};
  for (const id of ids) exp[id] = { level: save.owned[id]?.level ?? 1, exp: save.owned[id]?.exp ?? 0 };
  return { faith: rankOf(save).xp, exp };
}

/** Boss encounters an earlier act may end on (the crypt's own boss closes the last act). */
const ACT_BOSSES = ['choir', 'abbess'];

/**
 * Builds a branching map in acts: 2-3 choices per floor, fights first, an
 * elite floor in each act, a rest floor before each act's boss, and a Warden
 * halfway through an act of 8 or more floors.
 */
export function generateMap(crypt: CryptDef, rng: Rng = Math.random, floors = crypt.floors): MapNode[][] {
  const pick = <T>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
  const events = Object.keys(EVENTS);
  const map: MapNode[][] = [];
  const acts = actsOf(floors);
  acts.forEach((len, a) => {
    const act = a + 1;
    const last = a === acts.length - 1;
    const wardenAt = len >= WARDEN_ACT ? Math.floor(len / 2) : -1;
    const eliteFloor = wardenAt > 0 ? Math.max(1, Math.floor(wardenAt / 2) + 1) : Math.floor(len / 2) + (len > 5 ? 1 : 0);
    for (let f = 0; f < len; f++) {
      if (f === wardenAt) {
        const encounter = pick(crypt.elites);
        map.push([{ kind: 'boss', encounter, next: [], act, warden: true, name: crypt.wardenName ?? 'The Warden' }]);
        continue;
      }
      const width = f === 0 && a === 0 ? 2 : 2 + Math.floor(rng() * 2);
      const floor: MapNode[] = [];
      for (let i = 0; i < width; i++) {
        let kind: NodeKind;
        if (f === 0 && a === 0) kind = 'fight';
        else if (f === len - 1) kind = i === 0 ? 'shrine' : i === 1 ? 'reliquary' : 'event';
        else if (f === eliteFloor) kind = i === 0 ? 'elite' : pick(['fight', 'event', 'fight']);
        else kind = pick(['fight', 'fight', 'fight', 'event', 'event', 'shrine', 'reliquary', ...(f > 1 || a > 0 ? ['elite' as const] : [])]);
        const node: MapNode = { kind, next: [], act };
        if (kind === 'fight') node.encounter = pick(f < 2 && a === 0 ? crypt.early : crypt.late);
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
    if (last) map.push([{ kind: 'boss', encounter: crypt.boss, next: [], act, name: crypt.bossName }]);
    else {
      const others = ACT_BOSSES.filter((b) => b !== crypt.boss);
      const enc = others[a % others.length] ?? crypt.boss;
      const foe = ENEMIES[ENCOUNTERS[enc][0]]?.name ?? 'The Keeper';
      map.push([{ kind: 'boss', encounter: enc, next: [], act, actEnd: true, name: foe }]);
    }
  });

  // A Miracle: in about one crypt in fifteen, one ordinary room is a Miracle.
  if (rng() < MIRACLE_CHANCE) {
    const spots: [number, number][] = [];
    map.forEach((floor, f) => floor.forEach((n, i) => f > 0 && (n.kind === 'fight' || n.kind === 'event' || n.kind === 'shrine') && spots.push([f, i])));
    if (spots.length) {
      const [f, i] = spots[Math.floor(rng() * spots.length)];
      map[f][i] = { kind: 'miracle', next: [], act: map[f][i].act };
    }
  }

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
  const run: RunState = { crypt, map: generateMap(crypt, rng, cryptFloors(crypt, heresy)), party: ids, hp: {}, path: [], floor: -1, at: 0, resolved: true, heresy, relics: [], tithes: 0, seals: 0, loot: [] };
  for (const id of ids) run.hp[id] = maxHpOf(save, run, id);
  run.start = runStart(save, ids);
  save.lastParty = ids;
  return run;
}

/** How many relics of each family the run holds. */
export function familyCounts(run: RunState): Record<RelicFamily, number> {
  const out: Record<RelicFamily, number> = { burn: 0, bell: 0, martyr: 0 };
  for (const id of run.relics) {
    const f = relicById(id)?.family;
    if (f) out[f] += 1;
  }
  return out;
}

/** The family synergies a run has switched on. */
export function familyBonuses(run: RunState): RelicDef[] {
  const out: RelicDef[] = [];
  for (const [f, n] of Object.entries(familyCounts(run)) as [RelicFamily, number][]) {
    if (n >= 2) out.push(FAMILY_BONUS[f][0]);
    if (n >= 3) out.push(FAMILY_BONUS[f][1]);
  }
  return out;
}

/** Everything that modifies the party this run: relics, burdens, family synergies and Order bonuses. */
export function relicsOf(run: RunState): RelicDef[] {
  const relics = [...run.relics.map((id) => relicById(id)).filter((r): r is RelicDef => !!r), ...familyBonuses(run)];
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

export const rewardMult = (run: RunState) =>
  run.crypt.rewardMult * (1 + HERESY_REWARD * run.heresy) * Math.max(0.1, 1 + relicsOf(run).reduce((n, r) => n + (r.tithesMult ?? 0), 0));

export function maxHpOf(save: SaveData, run: RunState, id: string) {
  const c = CRUSADERS.find((x) => x.id === id)!;
  const hpPct = relicsOf(run).reduce((s, r) => s + (r.hpPct ?? 0), 0);
  return Math.round(sisterStats(save, c).hp * (1 + hpPct));
}

/** Builds a battle for the current room from the run's party and HP. */
export function makeBattle(save: SaveData, run: RunState, encounter: string, rng?: Rng, scale?: number): Battle {
  const relics = relicsOf(run);
  const atkPct = relics.reduce((s, r) => s + (r.atkPct ?? 0), 0);
  const zeal = relics.reduce((s, r) => s + (r.startZeal ?? 0), 0) + (run.blessZeal ?? 0);
  const armorPct = relics.reduce((s, r) => s + (r.armorPct ?? 0), 0);
  // Heresy shortens the candle by a round every second tier.
  const vigil = Math.max(2, VIGIL_DEFAULT + relics.reduce((s, r) => s + (r.vigilBonus ?? 0), 0) - (run.curseVigil ?? 0) - Math.floor(run.heresy / 2));
  // Heresy, the crypt's depth and the act the party has reached all harden the foes.
  const act = run.map[run.floor]?.[run.at]?.act ?? 1;
  const enemyScale = (scale ?? 1 + HERESY_ENEMY * run.heresy) * (run.crypt.power ?? 1) * (1 + ACT_ENEMY * (act - 1));

  let rank = 0;
  const party: Unit[] = [];
  for (const id of run.party) {
    if (run.hp[id] <= 0) continue;
    const c = CRUSADERS.find((x) => x.id === id)!;
    const st = sisterStats(save, c);
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
      vow: skillVow(save.owned[id]),
      skillLv: save.owned[id].skills,
      crit: st.crit + relics.reduce((n, r) => n + (r.critAdd ?? 0), 0),
      passive: c.passive,
      spd: st.spd + (c.passive?.kind === 'swift' ? c.passive.value ?? 0 : 0),
      status: {},
    });
  }
  const enemies = ENCOUNTERS[encounter].map((type, i) => makeEnemy(type, `e${i}`, i + 1, enemyScale));
  const sum = (k: keyof RelicDef) => relics.reduce((n, r) => n + ((r[k] as number | undefined) ?? 0), 0);
  const mods = {
    burnMult: sum('burnMult'),
    detonateMult: sum('detonateMult'),
    openingBurn: sum('openingBurn'),
    roundZeal: sum('roundZeal'),
    zealMult: sum('zealMult'),
    riteMult: sum('riteMult'),
    lowHpAtk: sum('lowHpAtk'),
    fallenAtk: sum('fallenAtk'),
    fallHeal: sum('fallHeal'),
  };
  return new Battle(party, enemies, { rng, vigil, zeal, enemyScale, mods });
}

/**
 * A one-off fight outside a crypt run (Vigil, Trials, Tower, Inquisition): the
 * given Sisters at full health against one encounter, at a Heresy-like tier.
 */
export function skirmish(save: SaveData, party: string[], encounter: string, tier = 0, rng?: Rng, crypt: CryptDef = OSSUARY, scale?: number): Battle {
  const ids = party.filter((id) => save.owned[id]).slice(0, MAX_PARTY);
  const run: RunState = { crypt, map: [], party: ids, hp: {}, floor: 0, at: 0, path: [], resolved: false, relics: [], tithes: 0, seals: 0, heresy: tier, loot: [] };
  for (const id of ids) run.hp[id] = maxHpOf(save, run, id);
  return makeBattle(save, run, encounter, rng, scale);
}

/** Recommended party power for a crypt at a Heresy tier: what its boss asks. */
export const cryptRecommended = (save: SaveData, crypt: CryptDef, heresy = 0) => {
  const acts = actsOf(cryptFloors(crypt, heresy)).length;
  const scale = (1 + HERESY_ENEMY * heresy) * (1 + ACT_ENEMY * (acts - 1));
  return recommendedPower(skirmish(save, [], crypt.boss, heresy, undefined, crypt, scale));
};

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
  run.rounds = (run.rounds ?? 0) + Math.max(1, battle.round);
}

/** Rewards a won fight and marks the node done. */
export function winRoom(run: RunState, save?: SaveData, rng: Rng = Math.random) {
  const node = currentNode(run)!;
  // Gear: better odds deeper in, in harder crypts and at higher Heresy.
  const luck = Math.min(0.3, 0.03 * run.heresy + (run.crypt.rewardMult - 1) * 0.1 + (node.kind === 'boss' ? 0.12 : node.kind === 'elite' ? 0.06 : 0));
  const drops = node.kind === 'boss' ? 2 : node.kind === 'elite' ? 1 : rng() < REWARDS.fightGearChance ? 1 : 0;
  (run.loot ??= []);
  for (let i = 0; i < drops; i++) run.loot.push(makeGear(rng, rollGearRarity(rng, luck)));
  run.items = addBags(run.items, roomDrops(node.kind === 'boss' ? 'boss' : node.kind === 'elite' ? 'elite' : 'fight', run.heresy + (run.crypt.rewardMult > 1 ? 1 : 0), rng));
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
  // An act's boss falls: a Sanctuary before the next act.
  if (node.actEnd && run.floor < run.map.length - 1) {
    run.sanctuary = node.act ?? 1;
    run.banked = { tithes: run.tithes, items: { ...(run.items ?? {}) } };
    if (save) healAll(save, run, SANCTUARY_HEAL);
  }
  if (save) {
    addBond(save, run.party.filter((id) => (run.hp[id] ?? 0) > 0), node.kind === 'boss' ? BOND_XP.boss : node.kind === 'elite' ? BOND_XP.elite : BOND_XP.fight);
    track(save, 'fightWon');
    if (node.kind === 'elite') track(save, 'eliteWon');
    if (node.kind === 'boss') track(save, 'bossWon');
  }
}

function healAll(save: SaveData, run: RunState, pct: number) {
  for (const id of run.party) {
    if (run.hp[id] <= 0) continue;
    const max = maxHpOf(save, run, id);
    run.hp[id] = Math.min(max, run.hp[id] + Math.round(max * pct));
  }
}

/** Chance a crypt's map holds a Miracle room. */
export const MIRACLE_CHANCE = 1 / 15;
export const MIRACLE_SEALS = 3;

/** A Miracle: every Sister rises and is made whole, Seals, and a relic of your choice. */
export function miracle(save: SaveData, run: RunState) {
  for (const id of run.party) run.hp[id] = maxHpOf(save, run, id);
  run.seals += MIRACLE_SEALS;
  run.pendingRelic = relicOffer(run).length > 0;
  run.resolved = true;
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
  if (out.tithes) run.tithes = Math.max(0, run.tithes + out.tithes);
  if (out.seals) run.seals += out.seals;
  if (out.blessZeal) run.blessZeal = (run.blessZeal ?? 0) + out.blessZeal;
  if (out.curseVigil) run.curseVigil = (run.curseVigil ?? 0) + out.curseVigil;
  if (out.gainRelic && !run.relics.includes(out.gainRelic)) addRelic(save, run, out.gainRelic);
  if (out.dropRelic) {
    const held = run.relics.filter((id) => !relicById(id)?.burden);
    const lost = held[Math.floor(rng() * held.length)];
    if (lost) run.relics = run.relics.filter((id) => id !== lost);
  }
  if (out.relic && relicOffer(run, Math.random, out.family).length) {
    run.pendingRelic = true;
    run.offerFamily = out.family;
  }
  run.resolved = true;
  return out;
}

/** Three relics not yet held, in random order (from one family when an event says so). */
export function relicOffer(run: RunState, rng: Rng = Math.random, family = run.offerFamily): RelicDef[] {
  const all = RELICS.filter((r) => !run.relics.includes(r.id));
  const fam = family ? all.filter((r) => r.family === family) : [];
  const pool = fam.length ? fam : all;
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

/** Adds a relic or burden; a change in max HP is felt at once (never killing). */
function addRelic(save: SaveData, run: RunState, relicId: string) {
  const before: Record<string, number> = {};
  for (const id of run.party) before[id] = maxHpOf(save, run, id);
  run.relics.push(relicId);
  for (const id of run.party) if (run.hp[id] > 0) run.hp[id] = Math.max(1, Math.min(maxHpOf(save, run, id), run.hp[id] + maxHpOf(save, run, id) - before[id]));
}

export function takeRelic(save: SaveData, run: RunState, relicId: string) {
  addRelic(save, run, relicId);
  run.pendingRelic = false;
  run.offerFamily = undefined;
  run.resolved = true;
}

/**
 * Weekly Pilgrimage: crypt runs are always free, and the first PILGRIMAGE_CLEARS
 * victories each week (Monday reset) pay a blessed bonus on top.
 */
export const PILGRIMAGE_CLEARS = 3;
export const PILGRIMAGE_BONUS = { seals: 4, tithes: 200 };

export interface PilgrimageState {
  week: string;
  used: number;
}

/** Blessed clears left this week. */
export function pilgrimageLeft(save: SaveData, now = Date.now()) {
  const p = save.pilgrimage;
  return p && p.week === weekKey(now) ? Math.max(0, PILGRIMAGE_CLEARS - p.used) : PILGRIMAGE_CLEARS;
}

/** Spends one blessed clear if any are left; returns the bonus paid. */
function blessClear(save: SaveData, now = Date.now()) {
  if (pilgrimageLeft(save, now) <= 0) return undefined;
  const week = weekKey(now);
  save.pilgrimage = { week, used: (save.pilgrimage?.week === week ? save.pilgrimage.used : 0) + 1 };
  return { ...PILGRIMAGE_BONUS };
}

export interface RunResult {
  outcome: 'victory' | 'defeat' | 'retreat';
  tithes: number;
  seals: number;
  firstClear: boolean;
  /** Heresy tier just cleared for the first time, if any. */
  heresyCleared?: number;
  fallen: string[];
  /** Gear brought home. */
  gear: GearItem[];
  /** Tithes from gear melted because the armory was full. */
  melted: number;
  /** Materials brought home. */
  items: Bag;
  /** Gilt for a first clear or a new Heresy tier. */
  gilt: number;
  /** The weekly Pilgrimage bonus, if this victory was one of the week's blessed clears. */
  pilgrimage?: { seals: number; tithes: number; left: number };
  party: string[];
  start?: RunStart;
  /** A personal best this run set (fewest rounds to clear). */
  record?: Beaten;
}

/** Ends the run: pays out, marks the fallen as recovering, and lets others recover. */
export function finishRun(save: SaveData, run: RunState, outcome: RunResult['outcome']): RunResult {
  let tithes = run.tithes;
  let seals = run.seals;
  let firstClear = false;
  let heresyCleared: number | undefined;
  let pilgrimage: RunResult['pilgrimage'];
  let gilt = 0;
  let record: Beaten | undefined;
  if (outcome === 'victory') {
    if (run.rounds) record = noteClear(save, run.crypt.id, run.heresy, run.rounds, run.crypt.name);
    track(save, 'cryptCleared');
    const bonus = blessClear(save);
    if (bonus) {
      seals += bonus.seals;
      tithes += bonus.tithes;
      pilgrimage = { ...bonus, left: pilgrimageLeft(save) };
    }
    seals += REWARDS.completeSeals;
    if (!save.cleared.includes(run.crypt.id)) {
      firstClear = true;
      seals += REWARDS.firstClearSeals;
      gilt += GILT_FIRST_CLEAR;
      save.cleared.push(run.crypt.id);
    }
    const best = (save.heresy ??= {})[run.crypt.id] ?? 0;
    if (run.heresy > best) {
      save.heresy[run.crypt.id] = run.heresy;
      seals += HERESY_FIRST_CLEAR_SEALS;
      gilt += GILT_HERESY;
      heresyCleared = run.heresy;
    }
  } else if (outcome === 'defeat') {
    tithes = keepOnDefeat(tithes, run.banked?.tithes ?? 0);
  }

  for (const [id, o] of Object.entries(save.owned)) {
    if (!run.party.includes(id) && o.recovering) o.recovering -= 1;
  }
  const fallen = run.party.filter((id) => run.hp[id] <= 0);
  for (const id of fallen) save.owned[id].recovering = 1;

  const gear = run.loot ?? [];
  const melted = claimGear(save, gear);
  const items: Bag = {};
  for (const [id, n] of Object.entries(run.items ?? {}) as [keyof Bag, number][]) {
    const kept = outcome === 'defeat' ? keepOnDefeat(n, run.banked?.items[id] ?? 0) : n;
    if (kept) items[id] = kept;
  }
  give(save, items);
  earn(save, gilt);
  save.tithes += tithes;
  save.seals += seals;
  return { outcome, tithes, seals, firstClear, heresyCleared, fallen, gear, melted, items, gilt, pilgrimage, party: run.party, start: run.start, record };
}

/** A defeat keeps everything banked at a Sanctuary, and most of what was found since. */
export function keepOnDefeat(found: number, banked: number) {
  const safe = Math.min(found, banked);
  return safe + Math.floor((found - safe) * REWARDS.defeatKeep);
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
  const byStrength = [...ready].sort((a, b) => sisterStats(save, b).atk - sisterStats(save, a).atk);
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
