import { saveSettings, settings } from '../state/settings';

/** Every encoded track in src/assets/audio, by file name: altar.ogg, altar.mp3 and so on. */
const AUDIO_URLS = import.meta.glob<string>('../assets/audio/*.{ogg,mp3}', { eager: true, query: '?url', import: 'default' });

/**
 * The soundtrack. Loops crossfade between screens and into themselves, stingers
 * play over the top, and nothing sounds until the first tap (browser autoplay
 * rules). Files are fetched only when first needed so the first load stays light;
 * the originals are re-encoded by tools/encode-music.sh.
 */
export type LoopId =
  | 'sanctum' | 'altar' | 'crypt' | 'battle' | 'boss'
  // Round 9 tracks. Each falls back to an older loop until its file arrives (see FALLBACK).
  | 'armory' | 'chapter' | 'tower' | 'deep-crypt' | 'deep-battle' | 'deep-boss' | 'hunt' | 'heretic';
export type StingerId = 'victory' | 'defeat' | 'ur';
type TrackId = LoopId | StingerId;

/** The loop a newer track borrows until its own file is in src/assets/audio. */
const FALLBACK: Partial<Record<LoopId, LoopId>> = {
  armory: 'altar',
  chapter: 'sanctum',
  tower: 'sanctum',
  'deep-crypt': 'crypt',
  'deep-battle': 'battle',
  'deep-boss': 'boss',
  hunt: 'boss',
  heretic: 'deep-boss',
};

const fileOf = (id: TrackId, ext: 'ogg' | 'mp3') => AUDIO_URLS[`../assets/audio/${id === 'ur' ? 'ur-stinger' : id}.${ext}`];
const hasTrack = (id: TrackId) => !!fileOf(id, 'mp3');
/** The track that actually plays for an id: its own file, else its fallback's. */
export function resolveTrack(id: LoopId): LoopId {
  let at: LoopId | undefined = id;
  while (at && !hasTrack(at)) at = FALLBACK[at];
  return at ?? id;
}

/** Which loop each screen plays. Battle picks its own (see battleLoop), and a screen may pick by state (see setSceneMusic). */
const SCENE_MUSIC: Record<string, LoopId | (() => LoopId)> = {
  Sanctum: 'sanctum',
  Penance: 'sanctum',
  Matins: 'sanctum',
  Rank: 'sanctum',
  Trials: 'sanctum',
  Tower: 'tower',
  Armory: 'armory',
  Chapter: 'chapter',
  Inquisition: 'sanctum',
  Confession: 'sanctum',
  Inventory: 'sanctum',
  Shop: 'sanctum',
  Reliquary: 'sanctum',
  Roster: 'sanctum',
  Results: 'sanctum',
  Recruit: 'altar',
  Reveal: 'altar',
  Crusade: 'crypt',
  Muster: 'crypt',
  Crypt: 'crypt',
};

/** Seconds a screen change takes to crossfade. */
const SCENE_FADE = 1.2;
/** Seconds a loop overlaps itself when it wraps around. */
const LOOP_FADE = 3;
/** Loop volume while the UR stinger plays. */
const DUCK = 0.18;

interface Playing {
  id: LoopId;
  /** Fades the whole track in and out on screen changes. */
  bus: GainNode;
  /** When the copy after the newest one starts (context seconds). */
  nextAt: number;
  sources: AudioBufferSourceNode[];
}

class Music {
  private ctx?: AudioContext;
  private master?: GainNode;
  /** Loops pass through here so a stinger can lower them. */
  private duck?: GainNode;
  private buffers = new Map<TrackId, Promise<AudioBuffer | undefined>>();
  private current?: Playing;
  private wanted?: LoopId;
  /** A loop asked for during a victory/defeat stinger waits until it ends. */
  private holdUntil = 0;
  private holdPending: Promise<unknown> = Promise.resolve();
  private request = 0;

  /** Call once at startup: makes the audio context and waits for the first tap. */
  init() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx || this.ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.duck = this.ctx.createGain();
    this.duck.connect(this.master);
    this.applyVolume(0);

    const unlock = () => {
      if (document.hidden) return;
      void this.ctx!.resume().then(() => {
        if (this.ctx!.state !== 'running') return;
        for (const e of GESTURES) window.removeEventListener(e, unlock, true);
      });
    };
    const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];
    for (const e of GESTURES) window.addEventListener(e, unlock, true);
    // Stop the music when the tab or app is in the background.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.ctx!.suspend();
      else if (this.unlocked) void this.ctx!.resume();
    });
    // Schedules each loop's next pass a few seconds ahead.
    setInterval(() => this.pump(), 500);
  }

  private get unlocked() {
    return !!this.ctx && (this.ctx.state === 'running' || this.wasUnlocked);
  }
  private wasUnlocked = false;

  /** Plays the loop for a screen, if it has one. */
  forScene(key: string) {
    const pick = SCENE_MUSIC[key];
    const id = typeof pick === 'function' ? pick() : pick;
    if (id) this.play(id);
  }

  /** Crossfades to a loop. Asking for the loop already playing does nothing. */
  play(want: LoopId) {
    if (!this.ctx) return;
    const id = resolveTrack(want);
    if (this.wanted === id) return;
    this.wanted = id;
    const req = ++this.request;
    this.fadeOutCurrent(SCENE_FADE);
    void Promise.all([this.load(id), this.holdPending]).then(([buf]) => {
      if (!buf || req !== this.request || !this.ctx) return;
      const ctx = this.ctx;
      const at = Math.max(ctx.currentTime + 0.05, this.holdUntil);
      const bus = ctx.createGain();
      bus.gain.setValueAtTime(0, at);
      bus.gain.linearRampToValueAtTime(1, at + SCENE_FADE);
      bus.connect(this.duck!);
      const p: Playing = { id, bus, nextAt: at, sources: [] };
      this.current = p;
      this.queuePass(p, buf, true);
    });
  }

  /** Fades the loop out and leaves silence. */
  stop(fade = SCENE_FADE) {
    this.wanted = undefined;
    this.request++;
    this.fadeOutCurrent(fade);
  }

  /**
   * A short cue over the music. `end` (victory, defeat) fades the loop out first
   * and holds the next loop until the cue is nearly over; otherwise the loop is
   * ducked under it and comes back after.
   */
  stinger(id: StingerId, mode: 'end' | 'duck') {
    if (!this.ctx) return;
    if (mode === 'end') this.stop(0.6);
    const done = this.load(id).then((buf) => {
      if (!buf || !this.ctx) return;
      const ctx = this.ctx;
      const at = ctx.currentTime + (mode === 'end' ? 0.25 : 0.02);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.master!);
      src.start(at);
      const end = at + buf.duration;
      if (mode === 'end') this.holdUntil = end - 1.5;
      else {
        const g = this.duck!.gain;
        g.cancelScheduledValues(ctx.currentTime);
        g.setValueAtTime(g.value, ctx.currentTime);
        g.linearRampToValueAtTime(DUCK, at + 0.25);
        g.setValueAtTime(DUCK, end - 1.2);
        g.linearRampToValueAtTime(1, end + 0.8);
      }
    });
    if (mode === 'end') this.holdPending = done;
  }

  /** Fetches the cue now so it is ready the moment it is needed. */
  preload(...ids: TrackId[]) {
    if (this.ctx) for (const id of ids) void this.load(id);
  }

  /** Re-reads volume and mute from settings. */
  applyVolume(fade = 0.15) {
    if (!this.ctx || !this.master) return;
    const v = settings.musicMuted ? 0 : settings.musicVolume * settings.musicVolume; // squared feels even
    const g = this.master.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(v, now + fade);
  }

  setVolume(v: number) {
    settings.musicVolume = Math.max(0, Math.min(1, v));
    if (settings.musicVolume > 0) settings.musicMuted = false;
    saveSettings();
    this.applyVolume();
  }

  setMuted(muted: boolean) {
    settings.musicMuted = muted;
    saveSettings();
    this.applyVolume();
  }

  /** What is playing, for automated play-tests. */
  get state() {
    return { context: this.ctx?.state, loop: this.current?.id, wanted: this.wanted, loaded: [...this.buffers.keys()] };
  }

  // ---------- internals ----------

  private fadeOutCurrent(fade: number) {
    const p = this.current;
    if (!p || !this.ctx) return;
    this.current = undefined;
    const now = this.ctx.currentTime;
    p.bus.gain.cancelScheduledValues(now);
    p.bus.gain.setValueAtTime(p.bus.gain.value, now);
    p.bus.gain.linearRampToValueAtTime(0, now + fade);
    for (const s of p.sources) {
      try {
        s.stop(now + fade + 0.05);
      } catch {
        // never started
      }
    }
    setTimeout(() => p.bus.disconnect(), (fade + 0.5) * 1000);
  }

  /** Starts one pass of a loop; the next pass overlaps its last LOOP_FADE seconds. */
  private queuePass(p: Playing, buf: AudioBuffer, first: boolean) {
    const ctx = this.ctx!;
    const at = p.nextAt;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    const dur = buf.duration;
    if (first) g.gain.setValueAtTime(1, at);
    else {
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(1, at + LOOP_FADE);
    }
    g.gain.setValueAtTime(1, at + dur - LOOP_FADE);
    g.gain.linearRampToValueAtTime(0, at + dur);
    src.connect(g).connect(p.bus);
    src.start(at);
    src.onended = () => {
      p.sources = p.sources.filter((s) => s !== src);
      g.disconnect();
    };
    p.sources.push(src);
    p.nextAt = at + dur - LOOP_FADE;
  }

  private pump() {
    if (!this.ctx) return;
    if (this.ctx.state === 'running') this.wasUnlocked = true;
    const p = this.current;
    if (!p || this.ctx.currentTime < p.nextAt - 5) return;
    void this.load(p.id).then((buf) => {
      if (buf && this.current === p && this.ctx!.currentTime >= p.nextAt - 5) this.queuePass(p, buf, false);
    });
  }

  private load(id: TrackId): Promise<AudioBuffer | undefined> {
    let b = this.buffers.get(id);
    if (!b) {
      const ogg = new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== '';
      const order = (ogg ? [fileOf(id, 'ogg'), fileOf(id, 'mp3')] : [fileOf(id, 'mp3')]).filter((u): u is string => !!u);
      b = (async () => {
        for (const url of order) {
          try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.arrayBuffer();
            // The callback form works on older Safari as well.
            return await new Promise<AudioBuffer>((ok, fail) => this.ctx!.decodeAudioData(data, ok, fail));
          } catch {
            // try the next format
          }
        }
        this.buffers.delete(id); // let a later request retry
        return undefined;
      })();
      this.buffers.set(id, b);
    }
    return b;
  }
}

export const music = new Music();

/** Lets a screen choose its loop from game state when it opens (for example, the deeper crypts). */
export function setSceneMusic(key: string, pick: () => LoopId) {
  SCENE_MUSIC[key] = pick;
}
