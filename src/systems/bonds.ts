import { CLASSES } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { ORDER_LIST } from '../data/orders';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';
import type { Battle } from './combat';
import { earn } from './currency';
import { give, itemDef } from './items';

const offeringName = (id: string) => ({ tallow: 'Tallow Candle', psalter: 'Pocket Psalter', veil: 'Lace Veil', myrrh: 'Vial of Myrrh', thorn: 'Crown Thorn', tear: "Saint's Tear", nail: 'True Nail' } as Record<string, string>)[id] ?? id;
const itemName = (id: string) => itemDef(id as never)?.name ?? id;

/**
 * Sister bonds (Confession), rebuilt in round 9. Fighting beside a Sister,
 * keeping Vigil with her, lighting candles and bringing offerings raise her
 * bond, now over 30 levels on a steep curve (100 + 10 x level squared XP per
 * level): a favourite reaches bond X in a few weeks, bond XX in a few months,
 * and bond XXX is a long devotion.
 *
 * - Bond I to X: +1% ATK and HP a level, a reward to claim at every level, and
 *   her five confessions at II, IV, VI, VIII and X.
 * - Bond XI to XXX: each level adds a small Devotion buff, rotating through
 *   ATK, HP, Armor, Magic Resist and critical chance, with a bigger reward
 *   every fifth level.
 */
export interface BondState {
  xp: number;
  /** Confessions read (highest bond level heard). */
  heard: number;
  /** Highest bond level whose reward has been claimed. */
  claimed?: number;
}

export const MAX_BOND = 30;
/** Bond levels where the flat ATK and HP bonus stops and Devotion buffs begin. */
export const BOND_CORE = 10;
/** XP to go from `level - 1` to `level`. */
export const bondNeed = (level: number) => 100 + 10 * level * level;
/** Total bond XP needed for each level, 1 to MAX_BOND. */
export const BOND_AT: number[] = (() => {
  const out: number[] = [];
  let t = 0;
  for (let l = 1; l <= MAX_BOND; l++) out.push((t += bondNeed(l)));
  return out;
})();
/** ATK and HP per bond level, up to BOND_CORE. */
export const BOND_STAT = 0.01;
/** Bond levels that open a confession. */
export const CONFESSION_AT = [2, 4, 6, 8, 10];

export type DevotionStat = 'atk' | 'hp' | 'armor' | 'mres' | 'crit';
/** The Devotion buff each level past BOND_CORE gives, in turn. */
export const DEVOTION: { stat: DevotionStat; value: number; label: string }[] = [
  { stat: 'atk', value: 0.01, label: '+1% ATK' },
  { stat: 'hp', value: 0.012, label: '+1.2% HP' },
  { stat: 'armor', value: 0.02, label: '+2% Armor' },
  { stat: 'mres', value: 0.02, label: '+2% Magic Resist' },
  { stat: 'crit', value: 0.005, label: '+0.5% critical chance' },
];
export const devotionAt = (level: number) => DEVOTION[(level - BOND_CORE - 1) % DEVOTION.length];

export const BOND_XP = { fight: 4, elite: 6, boss: 10, challenge: 6, vigilHour: 2, candle: 40 };

export interface BondReward {
  seals?: number;
  tithes?: number;
  gilt?: number;
  /** Offerings by id. */
  offerings?: Record<string, number>;
  /** Items by id (Unction and the like). */
  items?: Record<string, number>;
  /** A title: "<her first name>'s Confidant". */
  title?: boolean;
}

/** The reward for reaching each bond level (index 0 = bond I). Every level to X, then every fifth. */
export const BOND_REWARDS: Record<number, BondReward> = {
  1: { tithes: 500, offerings: { tallow: 1 } },
  2: { seals: 1, items: { unction1: 3 } },
  3: { tithes: 1000, offerings: { psalter: 1 } },
  4: { seals: 1, gilt: 10 },
  5: { seals: 2, items: { unction2: 2 } },
  6: { tithes: 2000, offerings: { veil: 1 } },
  7: { seals: 2, gilt: 15 },
  8: { items: { unction2: 4 }, offerings: { myrrh: 1 } },
  9: { seals: 3, tithes: 3000 },
  10: { seals: 5, gilt: 30, title: true },
  15: { seals: 5, gilt: 30, offerings: { thorn: 1 } },
  20: { seals: 8, gilt: 50, items: { unction3: 2 } },
  25: { seals: 10, gilt: 60, offerings: { tear: 1 } },
  30: { seals: 15, gilt: 100, offerings: { nail: 1 } },
};

export const bondsOf = (save: SaveData) => (save.bonds ??= {});
export const bondOf = (save: SaveData, id: string): BondState => bondsOf(save)[id] ?? { xp: 0, heard: 0 };

export function bondLevel(xp: number) {
  let lv = 0;
  while (lv < MAX_BOND && xp >= BOND_AT[lv]) lv++;
  return lv;
}

/** Highest confession level opened by this bond level (0, 2, 4 ... 10). */
export const confessionLevel = (level: number) => CONFESSION_AT.filter((at) => level >= at).length;

export function bondInfo(save: SaveData, id: string) {
  const b = bondOf(save, id);
  const level = bondLevel(b.xp);
  const from = level ? BOND_AT[level - 1] : 0;
  const to = level < MAX_BOND ? BOND_AT[level] : from;
  const opened = confessionLevel(level);
  return { level, xp: b.xp, into: b.xp - from, need: to - from, max: level >= MAX_BOND, unheard: opened > b.heard, rewards: rewardsWaiting(b, level) };
}

/** Reward levels reached but not yet claimed. */
function rewardsWaiting(b: BondState, level: number) {
  return Object.keys(BOND_REWARDS)
    .map(Number)
    .filter((l) => l <= level && l > (b.claimed ?? 0));
}

/** Her bond stats: ATK and HP from bond I to X, then each Devotion buff. */
export function bondStats(level: number): Record<DevotionStat, number> {
  const out: Record<DevotionStat, number> = { atk: 0, hp: 0, armor: 0, mres: 0, crit: 0 };
  out.atk = out.hp = BOND_STAT * Math.min(level, BOND_CORE);
  for (let l = BOND_CORE + 1; l <= level; l++) {
    const d = devotionAt(l);
    out[d.stat] += d.value;
  }
  return out;
}

/** "+10% ATK, +12% HP, +4% Armor ..." for the bond summary. */
export function bondStatText(level: number) {
  const s = bondStats(level);
  const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
  return [s.atk && `+${pct(s.atk)} ATK`, s.hp && `+${pct(s.hp)} HP`, s.armor && `+${pct(s.armor)} Armor`, s.mres && `+${pct(s.mres)} Magic Resist`, s.crit && `+${pct(s.crit)} crit`].filter(Boolean).join(', ');
}

/** ATK and HP multiplier from bond (kept for Power and the stat sheet). */
export const bondMult = (save: SaveData, id: string) => 1 + BOND_STAT * Math.min(BOND_CORE, bondLevel(bondOf(save, id).xp));
/** Her bond stats now. */
export const bondStatsOf = (save: SaveData, id: string) => bondStats(bondLevel(bondOf(save, id).xp));

/** Adds bond XP to each owned Sister listed. Returns those who reached a new level. */
export function addBond(save: SaveData, ids: string[], xp: number): string[] {
  const up: string[] = [];
  if (xp <= 0) return up;
  const all = bondsOf(save);
  for (const id of new Set(ids)) {
    if (!save.owned[id]) continue;
    const b = (all[id] ??= { xp: 0, heard: 0 });
    const before = bondLevel(b.xp);
    b.xp = Math.min(BOND_AT[MAX_BOND - 1], b.xp + xp);
    if (bondLevel(b.xp) > before) up.push(id);
  }
  return up;
}

export function bondRewardText(r: BondReward, first = 'Her') {
  const off = Object.entries(r.offerings ?? {}).map(([k, n]) => `${n} ${offeringName(k)}`);
  const items = Object.entries(r.items ?? {}).map(([k, n]) => `${n} ${itemName(k)}`);
  return [r.seals && `${r.seals} Seal${r.seals > 1 ? 's' : ''}`, r.gilt && `${r.gilt} Gilt`, r.tithes && `${r.tithes.toLocaleString('en-US')} Tithes`, ...items, ...off, r.title && `the title "${first}'s Confidant"`].filter(Boolean).join(' + ');
}

/** Claims every bond reward she has reached. Returns the levels paid. */
export function claimBondRewards(save: SaveData, id: string): number[] {
  if (!save.owned[id]) return [];
  const all = bondsOf(save);
  const b = (all[id] ??= { xp: 0, heard: 0 });
  const levels = rewardsWaiting(b, bondLevel(b.xp));
  const first = CRUSADERS.find((c) => c.id === id)?.name.split(' ')[0] ?? 'Her';
  for (const l of levels) {
    const r = BOND_REWARDS[l];
    if (r.seals) save.seals += r.seals;
    if (r.tithes) save.tithes += r.tithes;
    if (r.gilt) earn(save, r.gilt);
    if (r.items) give(save, r.items);
    if (r.offerings) for (const [k, n] of Object.entries(r.offerings)) (save.offerings ??= {})[k] = (save.offerings[k] ?? 0) + n;
    if (r.title) {
      const t = `${first}'s Confidant`;
      if (!(save.titles ??= []).includes(t)) save.titles.push(t);
    }
    b.claimed = l;
  }
  return levels;
}

export const anyBondRewards = (save: SaveData) => Object.keys(save.owned).some((id) => bondInfo(save, id).rewards.length > 0);

/** After a won side-mode fight: every Sister who fought draws closer. */
export function bondBattle(save: SaveData, battle: Battle) {
  if (battle.outcome() !== 'victory') return [];
  return addBond(save, battle.units.filter((u) => u.side === 'party').map((u) => u.ref), BOND_XP.challenge);
}

/** Marks her confessions up to her bond level as heard. */
export function hear(save: SaveData, id: string) {
  const all = bondsOf(save);
  const b = (all[id] ??= { xp: 0, heard: 0 });
  b.heard = Math.max(b.heard, confessionLevel(bondLevel(b.xp)));
}

export const anyUnheard = (save: SaveData) => Object.keys(save.owned).some((id) => bondInfo(save, id).unheard);

export interface Confession {
  title: string;
  body: string;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** What each combat class carries into the confessional. */
const CLASS_SIN: Record<string, string> = {
  warsister: 'She shows you the scars beneath her hairshirt, one for every Sister she could not shield. "I count them when I cannot sleep. The count is never finished."',
  hierophant: 'She sets her relic on the sill between you. "It is heavier every year. I think it is the prayers. I think they are not all mine."',
  inquisitor: 'She speaks of the first heretic she ever judged. "He wept and named his children. I did not stop. I tell myself the Lord would not have stopped either."',
  confessor: 'She laughs, low and tired. "I hear a hundred sins a week. No one asks who hears mine. So I came to you."',
  censer: 'Smoke still clings to her habit. "The fire is clean," she says. "That is what they told me. They did not tell me it remembers."',
  sentinel: 'She keeps the funerary key on a cord against her skin. "Every door I guard has someone behind it I could not save. I stand there so no one else has to."',
  martyr: 'She turns her palms up. The scars there are old and deliberate. "They say a martyr dies once. I have done it four times now. It gets no easier. It only gets quieter."',
  hospitaller: 'She washes her hands twice before she speaks. "I have raised the dead, Father. They come back cold. They thank me. I do not think they mean it."',
  abbess: 'She picks a thorn from her sleeve and sets it on the sill. "I prune the garden and I prune the faithful. Both bleed. Only one of them forgives me."',
  cantor: 'She hums before she speaks, a low funeral note. "Every hymn I know is for the dead. I have never once been asked to sing at a wedding."',
  adjudicator: 'She will not meet your eyes, only your reflection in the grate. "I judge by the mirror. It never lies. That is why I have stopped looking into it myself."',
  veilblade: 'She speaks so quietly you lean in to hear. "No one sees me do it. Not the heretic, not my Sisters. Some nights I wonder if the Lord sees it either."',
  arbalist: 'She turns a blessed bolt over in her fingers. "From that far away they look like anyone. That is the mercy of it. That is the sin of it too."',
  exorcist: 'Her lantern gutters as she talks. "I cast them out, and they go somewhere. I have never asked where. I am afraid it is into me."',
  oracle: 'Her eyes stay closed throughout. "I have seen how I die. It is not in the crypts. I will not tell you where, only that you were not there."',
};

/** Her five confessions, at bond II, IV, VI, VIII and X. Placeholder voice until the name library and lore arrive. */
export function confessions(c: CrusaderDef): Confession[] {
  const first = c.name.split(' ')[0];
  const order = ORDER_LIST.find((o) => o.name === c.order);
  const joined = Math.max(7, Math.min(c.age - 6, 6 + (c.age % 9)));
  const cls = CLASSES[c.classId]?.name ?? c.title ?? 'Sister';
  return [
    {
      title: 'The Grate',
      body: `${first} kneels at the grate and says nothing for a long while. Then, barely a breath: "${order?.creed ?? 'We endure.'}" It is the creed of the ${c.order}. She says it as if it might still save her.`,
    },
    {
      title: 'The Burden',
      body: `She speaks of it at last: ${lower(c.hook)} "Do not tell the Prioress," she whispers. "She would call it pride. I call it the only thing I have kept."`,
    },
    {
      title: `The ${cls}`,
      body: CLASS_SIN[c.classId] ?? `She speaks of her calling as a ${cls}, and of what it has cost.`,
    },
    {
      title: 'The Order',
      body: `"The ${c.order} took me when I was ${joined}," she says. ${order?.lore ?? ''} She does not say whether she was grateful. You do not ask.`,
    },
    {
      title: 'Absolution',
      body: `${first} asks for no absolution. She asks only that you remember her name when the candles go out. You promise. When she rises, she does not kneel to you. She takes your hand, as a Sister would.`,
    },
  ];
}

export const sisterDef = (id: string) => CRUSADERS.find((c) => c.id === id);
