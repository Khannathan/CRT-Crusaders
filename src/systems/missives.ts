import type { SaveData } from '../state/save';
import { grant, rewardText, type Reward } from './tasks';
import { addStigmata } from './tiers';

/** What a letter can carry: the usual purses plus Stigmata, a Saint's Favor and a title. */
export type LetterReward = Reward & { stigmata?: number; favor?: { id: string; name: string; n: number }; title?: string };

export const letterText = (r: LetterReward) =>
  [rewardText(r), r.stigmata ? `${r.stigmata} Stigmata` : '', r.favor?.n ? `${r.favor.n} ${r.favor.name}'s Favor` : '', r.title ? `the title "${r.title}"` : ''].filter(Boolean).join(' + ');

function grantLetter(save: SaveData, r: LetterReward) {
  grant(save, r);
  if (r.stigmata) addStigmata(save, r.stigmata);
  if (r.favor?.n) (save.shards ??= {})[r.favor.id] = (save.shards?.[r.favor.id] ?? 0) + r.favor.n;
  if (r.title && !(save.titles ??= []).includes(r.title)) save.titles.push(r.title);
}

/**
 * Missives: the Sanctum's letterbox. Rewards a player could otherwise miss (a
 * Feast's unclaimed milestones, a season's unclaimed Pass tiers, a league week
 * judged while away) arrive here as letters, as do gifts and news written into
 * NEWS below. A letter with a reward waits 30 days, then crumbles; a claimed or
 * read letter is swept away after 30 days. Everything is local to the save.
 */

export interface Letter {
  id: string;
  from: string;
  title: string;
  body: string;
  reward?: LetterReward;
  /** When it arrived (ms). */
  sent: number;
  /** When an unclaimed reward crumbles (ms). */
  expires?: number;
  claimed?: boolean;
  read?: boolean;
}

export interface MissivesState {
  letters: Letter[];
  /** NEWS ids already delivered. */
  news: string[];
  /** A counter for letter ids. */
  next: number;
}

export const KEEP_DAYS = 30;
const DAY = 864e5;

/**
 * News and gifts from the Abbey (the game's makers), delivered once to every
 * save after `from`. Add a line here to send every player a letter with an update.
 */
export const NEWS: { id: string; from: number; title: string; body: string; reward?: LetterReward }[] = [
  {
    id: 'missives-open',
    from: Date.UTC(2026, 10, 23),
    title: 'The letterbox is open!',
    body: 'Rewards you miss now wait here for you. Feasts, seasons and the Ordeals send what you left behind. Read, claim, and march on!',
    reward: { seals: 5, tithes: 500 },
  },
];

export function missivesOf(save: SaveData, now = Date.now()): MissivesState {
  const m = (save.missives ??= { letters: [], news: [], next: 1 });
  // Deliver news not yet sent, then sweep away old letters.
  for (const n of NEWS) {
    if (now < n.from || m.news.includes(n.id)) continue;
    m.news.push(n.id);
    send(save, { from: 'The Abbey', title: n.title, body: n.body, reward: n.reward }, now);
  }
  m.letters = m.letters.filter((l) => {
    if (hasReward(l) && !l.claimed) return !l.expires || now < l.expires;
    return now - l.sent < KEEP_DAYS * DAY;
  });
  return m;
}

const hasReward = (l: Letter) => !!l.reward && !!letterText(l.reward);

/** Sends a letter. A letter with nothing in it and no words is not sent. */
export function send(save: SaveData, l: Pick<Letter, 'from' | 'title' | 'body' | 'reward'>, now = Date.now()): Letter {
  const m = (save.missives ??= { letters: [], news: [], next: 1 });
  const letter: Letter = { ...l, id: `m${m.next++}`, sent: now };
  if (hasReward(letter)) letter.expires = now + KEEP_DAYS * DAY;
  m.letters.unshift(letter);
  return letter;
}

/** Letters newest first. */
export const letters = (save: SaveData, now = Date.now()) => [...missivesOf(save, now).letters].sort((a, b) => b.sent - a.sent);

export const claimable = (l: Letter) => hasReward(l) && !l.claimed;

/** Letters to claim or still unread (for the rail's dot and count). */
export const missivesWaiting = (save: SaveData, now = Date.now()) => missivesOf(save, now).letters.filter((l) => claimable(l) || !l.read).length;
export const missivesReady = (save: SaveData, now = Date.now()) => missivesWaiting(save, now) > 0;

export function markRead(save: SaveData, id: string, now = Date.now()) {
  const l = missivesOf(save, now).letters.find((x) => x.id === id);
  if (l) l.read = true;
}

/** Claims one letter. Returns its reward. */
export function claimLetter(save: SaveData, id: string, now = Date.now()): LetterReward | undefined {
  const l = missivesOf(save, now).letters.find((x) => x.id === id);
  if (!l || !claimable(l)) return undefined;
  l.claimed = true;
  l.read = true;
  grantLetter(save, l.reward!);
  return l.reward;
}

/** Claims every letter with a reward and marks every letter read. Returns the rewards paid. */
export function claimAllLetters(save: SaveData, now = Date.now()): LetterReward[] {
  const out: LetterReward[] = [];
  for (const l of missivesOf(save, now).letters) {
    const r = claimLetter(save, l.id, now);
    if (r) out.push(r);
    l.read = true;
  }
  return out;
}

/** Days left before an unclaimed reward crumbles. */
export const daysLeft = (l: Letter, now = Date.now()) => (l.expires ? Math.max(0, Math.ceil((l.expires - now) / DAY)) : undefined);

/** Rewards summed, for one line of text. */
export function sumLetters(rs: LetterReward[]): LetterReward {
  const out: LetterReward = {};
  for (const r of rs) {
    for (const k of ['seals', 'tithes', 'gilt', 'alms', 'stigmata'] as const) if (r[k]) out[k] = (out[k] ?? 0) + r[k]!;
    for (const [k, v] of Object.entries(r.items ?? {})) (out.items ??= {})[k as keyof NonNullable<Reward['items']>] = ((out.items?.[k as keyof NonNullable<Reward['items']>] ?? 0) as number) + (v as number);
    if (r.favor) out.favor = out.favor && out.favor.id === r.favor.id ? { ...out.favor, n: out.favor.n + r.favor.n } : { ...r.favor };
    if (r.title) out.title = r.title;
  }
  return out;
}
