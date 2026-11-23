import { settings } from '../state/settings';

/**
 * Sound effects. Each cue plays its recording from src/assets/sfx/<cue>.ogg
 * (or .mp3): dark chip sounds through an old TV's speaker, made by
 * tools/make-sfx.py. Any cue can be swapped by dropping in a new file.
 *
 * Until a file has loaded (the first moments after the first tap), a small
 * synthesized chip sound stands in.
 */

export type Cue =
  | 'tap'
  | 'hit'
  | 'hitMagic'
  | 'crit'
  | 'hurt'
  | 'dot'
  | 'block'
  | 'heal'
  | 'shield'
  | 'kill'
  | 'fall'
  | 'litany'
  | 'blasphemy'
  | 'chain'
  | 'dodge'
  | 'perfect'
  | 'coin'
  | 'candle'
  | 'levelUp'
  | 'slam'
  | 'seal'
  | 'sealRare'
  // Recordings only (a stand-in cue plays until the file loads):
  | 'tab'
  | 'open'
  | 'close'
  | 'deny'
  | 'claim'
  | 'fightStart'
  | 'telegraph'
  | 'delay'
  | 'unction'
  | 'bossAppear'
  | 'pull'
  | 'urReveal'
  | 'ascend'
  | 'forge'
  | 'powerUp'
  | 'rankUp'
  | 'bell'
  | 'chest'
  | 'step'
  | 'whistle';

type SynthCue = Exclude<Cue, keyof typeof STAND_IN>;

/** What plays for a recordings-only cue while its file loads. */
const STAND_IN = {
  tab: 'tap',
  open: 'tap',
  close: 'tap',
  deny: 'block',
  claim: 'coin',
  fightStart: 'slam',
  telegraph: 'block',
  delay: 'crit',
  unction: 'heal',
  bossAppear: 'blasphemy',
  pull: 'litany',
  urReveal: 'sealRare',
  ascend: 'levelUp',
  forge: 'block',
  powerUp: 'coin',
  rankUp: 'levelUp',
  bell: 'candle',
  chest: 'coin',
  step: 'tap',
  whistle: 'dodge',
} as const satisfies Record<string, Cue>;

/** Recorded replacements, if any were dropped into src/assets/sfx/. */
const FILES = import.meta.glob('../assets/sfx/*.{ogg,mp3}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
let useOgg: boolean | undefined;
function fileFor(cue: Cue) {
  useOgg ??= typeof Audio !== 'undefined' && new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== '';
  return (useOgg && FILES[`../assets/sfx/${cue}.ogg`]) || FILES[`../assets/sfx/${cue}.mp3`];
}
const buffers = new Map<string, AudioBuffer | null>();

let ctx: AudioContext | undefined;
let master: GainNode | undefined;
let noiseBuf: AudioBuffer | undefined;
const lastAt = new Map<Cue, number>();
let voices = 0;

function audio(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return undefined;
    try {
      ctx = new AC();
    } catch {
      return undefined;
    }
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    document.addEventListener('visibilitychange', () => (document.hidden ? ctx?.suspend() : ctx?.resume()));
  }
  if (ctx.state === 'suspended' && !document.hidden) void ctx.resume();
  return ctx;
}

function noise(c: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    // Stepped noise (held samples) sounds like a chip, not hiss.
    let v = 0;
    for (let i = 0; i < d.length; i++) {
      if (i % 3 === 0) v = Math.random() * 2 - 1;
      d[i] = v;
    }
  }
  return noiseBuf;
}

interface Tone {
  type?: OscillatorType;
  /** Start and end pitch (Hz). */
  f0: number;
  f1?: number;
  at?: number;
  dur: number;
  vol?: number;
}

function tone(c: AudioContext, out: AudioNode, t0: number, s: Tone) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = s.type ?? 'square';
  const start = t0 + (s.at ?? 0);
  o.frequency.setValueAtTime(s.f0, start);
  if (s.f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, s.f1), start + s.dur);
  const v = s.vol ?? 0.5;
  g.gain.setValueAtTime(v, start);
  g.gain.setValueAtTime(v, start + s.dur * 0.6);
  g.gain.linearRampToValueAtTime(0.0001, start + s.dur);
  o.connect(g).connect(out);
  o.start(start);
  o.stop(start + s.dur + 0.02);
}

function hiss(c: AudioContext, out: AudioNode, t0: number, dur: number, vol = 0.5, at = 0, freq = 2200) {
  const n = c.createBufferSource();
  n.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 0.7;
  const g = c.createGain();
  const start = t0 + at;
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  n.connect(f).connect(g).connect(out);
  n.start(start, Math.random() * 0.5);
  n.stop(start + dur + 0.02);
}

/** How each cue is built. `n` nudges pitch (chain count, rarity...). */
const RECIPES: Record<SynthCue, (c: AudioContext, o: AudioNode, t: number, n: number) => number> = {
  tap: (c, o, t) => (tone(c, o, t, { f0: 1320, dur: 0.03, vol: 0.18 }), 0.03),
  hit: (c, o, t) => {
    hiss(c, o, t, 0.06, 0.45, 0, 1800);
    tone(c, o, t, { f0: 220, f1: 90, dur: 0.06, vol: 0.3 });
    return 0.07;
  },
  hitMagic: (c, o, t) => {
    tone(c, o, t, { type: 'triangle', f0: 1100, f1: 330, dur: 0.09, vol: 0.45 });
    hiss(c, o, t, 0.05, 0.2, 0, 4000);
    return 0.09;
  },
  crit: (c, o, t) => {
    hiss(c, o, t, 0.12, 0.7, 0, 1400);
    tone(c, o, t, { f0: 700, f1: 110, dur: 0.12, vol: 0.45 });
    tone(c, o, t, { f0: 1400, f1: 900, dur: 0.05, vol: 0.2, at: 0.01 });
    return 0.13;
  },
  hurt: (c, o, t) => {
    hiss(c, o, t, 0.07, 0.4, 0, 900);
    tone(c, o, t, { f0: 160, f1: 70, dur: 0.08, vol: 0.35 });
    return 0.08;
  },
  dot: (c, o, t) => (hiss(c, o, t, 0.05, 0.22, 0, 3200), 0.05),
  block: (c, o, t) => {
    tone(c, o, t, { f0: 1760, dur: 0.04, vol: 0.2 });
    tone(c, o, t, { f0: 2350, dur: 0.06, vol: 0.15, at: 0.02 });
    return 0.08;
  },
  heal: (c, o, t) => {
    [523, 659, 784].forEach((f, i) => tone(c, o, t, { type: 'triangle', f0: f, dur: 0.07, vol: 0.32, at: i * 0.045 }));
    return 0.2;
  },
  shield: (c, o, t) => {
    tone(c, o, t, { f0: 440, dur: 0.05, vol: 0.22 });
    tone(c, o, t, { f0: 660, dur: 0.08, vol: 0.22, at: 0.04 });
    return 0.12;
  },
  kill: (c, o, t) => {
    hiss(c, o, t, 0.3, 0.55, 0, 700);
    tone(c, o, t, { f0: 330, f1: 40, dur: 0.28, vol: 0.4 });
    return 0.3;
  },
  fall: (c, o, t) => {
    [392, 330, 262, 196].forEach((f, i) => tone(c, o, t, { type: 'triangle', f0: f, dur: 0.12, vol: 0.35, at: i * 0.1 }));
    return 0.5;
  },
  litany: (c, o, t) => {
    hiss(c, o, t, 0.45, 0.35, 0, 1200);
    [262, 330, 392, 523, 659].forEach((f, i) => tone(c, o, t, { f0: f, dur: 0.1, vol: 0.28, at: i * 0.05 }));
    tone(c, o, t, { type: 'triangle', f0: 523, dur: 0.45, vol: 0.3, at: 0.25 });
    tone(c, o, t, { type: 'triangle', f0: 784, dur: 0.45, vol: 0.25, at: 0.25 });
    return 0.7;
  },
  blasphemy: (c, o, t) => {
    for (let i = 0; i < 6; i++) tone(c, o, t, { f0: 70 - i * 4, dur: 0.07, vol: 0.45, at: i * 0.07 });
    hiss(c, o, t, 0.45, 0.4, 0, 400);
    return 0.45;
  },
  chain: (c, o, t, n) => {
    const f = 660 * Math.pow(2, Math.min(n, 12) / 12);
    tone(c, o, t, { f0: f, dur: 0.05, vol: 0.3 });
    tone(c, o, t, { f0: f * 1.5, dur: 0.07, vol: 0.25, at: 0.05 });
    return 0.12;
  },
  dodge: (c, o, t) => (hiss(c, o, t, 0.12, 0.35, 0, 5000), 0.12),
  perfect: (c, o, t) => {
    hiss(c, o, t, 0.1, 0.3, 0, 5000);
    [988, 1319, 1976].forEach((f, i) => tone(c, o, t, { f0: f, dur: 0.06, vol: 0.25, at: 0.04 + i * 0.04 }));
    return 0.2;
  },
  coin: (c, o, t) => {
    tone(c, o, t, { f0: 988, dur: 0.05, vol: 0.25 });
    tone(c, o, t, { f0: 1319, dur: 0.12, vol: 0.25, at: 0.05 });
    return 0.17;
  },
  candle: (c, o, t, n) => {
    const base = [523, 659, 784][Math.max(0, Math.min(2, n))];
    tone(c, o, t, { type: 'triangle', f0: base, dur: 0.35, vol: 0.4 });
    tone(c, o, t, { type: 'triangle', f0: base * 2, dur: 0.2, vol: 0.15 });
    hiss(c, o, t, 0.15, 0.2, 0, 6000);
    return 0.35;
  },
  levelUp: (c, o, t) => {
    [523, 659, 784, 1047].forEach((f, i) => tone(c, o, t, { f0: f, dur: 0.07, vol: 0.25, at: i * 0.06 }));
    return 0.3;
  },
  slam: (c, o, t) => {
    hiss(c, o, t, 0.25, 0.6, 0, 500);
    tone(c, o, t, { f0: 110, f1: 45, dur: 0.25, vol: 0.5 });
    return 0.25;
  },
  seal: (c, o, t) => {
    hiss(c, o, t, 0.08, 0.5, 0, 2500);
    tone(c, o, t, { type: 'triangle', f0: 784, dur: 0.18, vol: 0.3, at: 0.04 });
    return 0.2;
  },
  sealRare: (c, o, t, n) => {
    hiss(c, o, t, 0.15, 0.6, 0, 2000);
    const notes = n >= 2 ? [523, 659, 784, 1047, 1319] : [523, 659, 784, 1047];
    notes.forEach((f, i) => tone(c, o, t, { f0: f, dur: 0.1, vol: 0.28, at: 0.06 + i * 0.07 }));
    tone(c, o, t, { type: 'triangle', f0: notes[notes.length - 1], dur: 0.6, vol: 0.3, at: 0.06 + notes.length * 0.07 });
    return 1;
  },
};

/** Shortest gap between two plays of one cue, so a flurry stays a rattle, not a roar. */
const GAP: Partial<Record<Cue, number>> = { hit: 45, hitMagic: 45, hurt: 60, dot: 90, block: 80, heal: 90, shield: 90, coin: 40, tap: 30, tab: 30, step: 60, telegraph: 150, powerUp: 200, chain: 60, kill: 50 };
const MAX_VOICES = 10;

/** Pitch of a recording per `n`: each Chain step climbs a semitone, each Candle a third. */
function rateOf(cue: Cue, n: number) {
  if (cue === 'chain') return Math.pow(2, Math.min(Math.max(0, n - 2), 12) / 12);
  if (cue === 'candle') return [1, 1.26, 1.5][Math.max(0, Math.min(2, n))];
  return 1;
}

function load(c: AudioContext, url: string) {
  if (buffers.has(url) || loading.has(url)) return;
  loading.add(url);
  fetch(url)
    .then((r) => r.arrayBuffer())
    .then((b) => c.decodeAudioData(b))
    .then((buf) => buffers.set(url, buf))
    .catch(() => buffers.set(url, null))
    .finally(() => loading.delete(url));
}
const loading = new Set<string>();

/** Plays the cue's recording; false when it has not loaded (or cannot). */
function playFile(c: AudioContext, url: string, rate: number) {
  const buf = buffers.get(url);
  if (!buf) {
    if (buf === undefined) load(c, url);
    return false;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  src.connect(master!);
  src.start();
  voices++;
  window.setTimeout(() => voices--, (buf.duration / rate) * 1000 + 30);
  return true;
}

let soft: number | undefined;

/**
 * Plays a cue now. `n` nudges it (chain length, rarity rank, candle number).
 * A `soft` cue (a button's tap) waits a moment and gives way if the tap's own
 * action plays a sound of its own, so a Claim or an Ascend is not doubled.
 */
export function sfx(cue: Cue, n = 0, opts: { soft?: boolean } = {}) {
  if (!settings.sfx) return;
  if (opts.soft) {
    window.clearTimeout(soft);
    soft = window.setTimeout(() => ((soft = undefined), play(cue, n)), 0);
    return;
  }
  window.clearTimeout(soft);
  soft = undefined;
  play(cue, n);
}

function play(cue: Cue, n: number) {
  const c = audio();
  if (!c || !master || c.state !== 'running') return;
  const now = performance.now();
  if (now - (lastAt.get(cue) ?? -1e9) < (GAP[cue] ?? 0)) return;
  if (voices >= MAX_VOICES) return;
  lastAt.set(cue, now);
  const url = fileFor(cue);
  if (url && playFile(c, url, rateOf(cue, n))) return;
  const synth: SynthCue = cue in STAND_IN ? STAND_IN[cue as keyof typeof STAND_IN] : (cue as SynthCue);
  voices++;
  const len = RECIPES[synth](c, master, c.currentTime + 0.005, n);
  window.setTimeout(() => voices--, len * 1000 + 30);
}

/** Wakes the audio on the first tap (browsers keep it asleep until then) and loads every recording. */
export function unlockSfx() {
  const c = audio();
  if (!c || preloaded) return;
  preloaded = true;
  for (const url of new Set((Object.keys(STAND_IN) as Cue[]).concat(Object.keys(RECIPES) as Cue[]).map(fileFor))) if (url) load(c, url);
}
let preloaded = false;
