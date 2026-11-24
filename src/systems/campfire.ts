import type { SaveData } from '../state/save';
import { addBond } from './bonds';

/**
 * The Campfire: before a Crypt descent, the party sits round a fire and two
 * Sisters speak, each on a topic she loves. The others react: a topic they
 * love lifts Morale, one they loathe sours it. Morale holds for the whole
 * descent and blesses every fight in it (ATK and opening Zeal). Speaking and
 * listening add a little bond. A descent with no camp (Auto runs, skipping)
 * has no Morale and plays as before.
 */
export interface Topic {
  id: string;
  name: string;
  /** What the speaker says, second person, short. */
  line: string;
}

export const TOPICS: Topic[] = [
  { id: 'saints', name: 'The Saints', line: 'They bled for less than you will. Be worthy!' },
  { id: 'sin', name: 'Sin', line: 'Every sin is a door. Burn it down, Sister!' },
  { id: 'home', name: 'Home', line: 'There was a bell tower, once. You could hear it from the fields.' },
  { id: 'battle', name: 'The Battle Ahead', line: 'Front rank holds. No one breaks. No one!' },
  { id: 'relics', name: 'Relics', line: 'This finger bone has outlived three Abbesses.' },
  { id: 'martyrs', name: 'Martyrdom', line: 'If you fall, fall forward. Into glory!' },
  { id: 'silence', name: 'Silence', line: '...' },
  { id: 'feasts', name: 'Feast Days', line: 'Honey cakes on Saint Wen\'s day. Remember the honey cakes?' },
  { id: 'penance', name: 'Penance', line: 'The scourge teaches. Listen to it.' },
  { id: 'dead', name: 'The Dead', line: 'They are listening. They always listen.' },
  { id: 'hounds', name: 'The Hounds', line: 'Good dogs. More loyal than the other Orders.' },
  { id: 'vows', name: 'Vows', line: 'You swore. So did I. We keep them, whatever they cost.' },
];

export const MORALE_BASE = 20;
export const MORALE_MAX = 100;
export const REACT = { love: 12, neutral: 3, loathe: -8 } as const;
export type Reaction = keyof typeof REACT;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Her two loved topics and the one she loathes (fixed for each Sister). */
export function topicsOf(id: string): { loves: [string, string]; loathes: string } {
  const h = hash(id);
  const n = TOPICS.length;
  const a = h % n;
  const b = (a + 1 + ((h >>> 8) % (n - 1))) % n;
  let c = (h >>> 16) % n;
  while (c === a || c === b) c = (c + 1) % n;
  return { loves: [TOPICS[a].id, TOPICS[b].id], loathes: TOPICS[c].id };
}

export function reactionOf(listener: string, topic: string): Reaction {
  const t = topicsOf(listener);
  if (t.loves.includes(topic)) return 'love';
  if (t.loathes === topic) return 'loathe';
  return 'neutral';
}

export interface Talk {
  speaker: string;
  topic: string;
}

/** Each listener's reaction to a talk. */
export const reactions = (party: string[], talk: Talk) => party.filter((id) => id !== talk.speaker).map((id) => ({ id, reaction: reactionOf(id, talk.topic) }));

export function moraleOf(party: string[], talks: Talk[]) {
  let m = MORALE_BASE;
  for (const t of talks) for (const r of reactions(party, t)) m += REACT[r.reaction];
  return Math.max(0, Math.min(MORALE_MAX, m));
}

/** What Morale gives every fight of the descent. */
export function moraleBuff(morale?: number): { atkPct: number; zeal: number; name: string } {
  if (morale === undefined || morale < 50) return { atkPct: 0, zeal: 0, name: 'No boon' };
  if (morale >= 90) return { atkPct: 0.1, zeal: 15, name: 'Fervent' };
  if (morale >= 70) return { atkPct: 0.06, zeal: 10, name: 'Resolute' };
  return { atkPct: 0.03, zeal: 5, name: 'Steady' };
}

/** The best two talks for a party (for a hint, and tests). */
export function bestTalks(party: string[]): { talks: Talk[]; morale: number } {
  const options: Talk[] = party.flatMap((speaker) => topicsOf(speaker).loves.map((topic) => ({ speaker, topic })));
  let best = { talks: [] as Talk[], morale: MORALE_BASE };
  for (const a of options) for (const b of options) {
    if (a.speaker === b.speaker) continue;
    const m = moraleOf(party, [a, b]);
    if (m > best.morale) best = { talks: [a, b], morale: m };
  }
  return best;
}

/** Bond for sitting at the fire: speakers more than listeners. */
export const CAMP_BOND = { speaker: 20, listener: 10 };

/** Sets the run's Morale from the talks and pays the bond. */
export function makeCamp(save: SaveData, run: { party: string[]; morale?: number }, talks: Talk[]) {
  run.morale = moraleOf(run.party, talks);
  const speakers = talks.map((t) => t.speaker);
  addBond(save, speakers, CAMP_BOND.speaker);
  addBond(save, run.party.filter((id) => !speakers.includes(id)), CAMP_BOND.listener);
  return run.morale;
}
