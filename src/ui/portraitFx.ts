import Phaser from 'phaser';

/**
 * Code-drawn effects around battle portraits: a burst when a skill is cast, an
 * impact on each target, and a looping aura for every kind of enemy. Each skill
 * has its own mix of motif, colour and motion, grouped into themes so they stay
 * distinct without any art.
 */

export type Motif =
  | 'blood' // red drops spraying and falling
  | 'ward' // golden rings and hexes
  | 'bell' // sound waves rolling out
  | 'chain' // links orbiting and snapping shut
  | 'blade' // slash streaks
  | 'mend' // green motes rising
  | 'poison' // bubbling green
  | 'smoke' // grey puffs drifting up
  | 'fire' // flame tongues rising
  | 'ash' // grey flakes falling with embers
  | 'omen' // violet runes orbiting
  | 'water' // drips and ripples
  | 'static' // CRT noise flecks
  | 'stone' // chips and dust
  | 'shadow' // dark wisps
  | 'holy'; // a bright halo pulse

export interface Fx {
  motif: Motif;
  color: number;
  /** Second colour for embers, rims and so on. */
  accent?: number;
  /** 0.5 to 2: how big and busy. */
  power?: number;
}

/** Every Sister skill: its own motif and colours. */
export const SKILL_FX: Record<string, Fx> = {
  // War Sister: blood and fury
  'penitent-blow': { motif: 'blood', color: 0xb02a2a, accent: 0xff6a5a },
  'blood-for-zeal': { motif: 'blood', color: 0x8a1020, accent: 0xffc36a, power: 1.3 },
  'flagellants-charge': { motif: 'blade', color: 0xd04040, accent: 0xffd0c0, power: 1.2 },
  'martyrs-fury': { motif: 'fire', color: 0xd02a2a, accent: 0xffb060, power: 1.8 },
  // Hierophant: wards and bells
  'reliquary-bash': { motif: 'stone', color: 0xd6c27a, accent: 0xfff1d6 },
  sanctuary: { motif: 'ward', color: 0xe8c27a, accent: 0xfff1d6 },
  'vigil-bell': { motif: 'bell', color: 0xd6a15f, accent: 0xfff1d6, power: 1.3 },
  'wall-of-saints': { motif: 'ward', color: 0xfff1d6, accent: 0xd6a15f, power: 1.8 },
  // Inquisitor: chains and judgement
  accuse: { motif: 'chain', color: 0xa9a9b8, accent: 0xd65f5f },
  'duelists-thrust': { motif: 'blade', color: 0xdfe6ff, accent: 0x8aa0ff },
  sentence: { motif: 'blade', color: 0xe04848, accent: 0xffffff, power: 1.4 },
  verdict: { motif: 'chain', color: 0xd6a15f, accent: 0xffffff, power: 1.8 },
  // Confessor: mercy and plague
  remedy: { motif: 'mend', color: 0x9fd27a, accent: 0xfff1d6 },
  miasma: { motif: 'poison', color: 0x7fb04a, accent: 0xd6f08a },
  contagion: { motif: 'poison', color: 0x5a9a3a, accent: 0xb0e060, power: 1.4 },
  'last-rites': { motif: 'holy', color: 0xbfe8a0, accent: 0xfff1d6, power: 1.8 },
  // Censer: smoke and flame
  'incense-cloud': { motif: 'smoke', color: 0xc8b8d8, accent: 0xfff1d6 },
  'burning-thurible': { motif: 'fire', color: 0xff8a3d, accent: 0xffe08a },
  'fan-the-flames': { motif: 'fire', color: 0xff5a1a, accent: 0xfff0a0, power: 1.5 },
  'choking-smoke': { motif: 'smoke', color: 0x6a6070, accent: 0xa090b0, power: 1.8 },
  // Oracle: ash and omens
  'ash-bolt': { motif: 'ash', color: 0xb8b0a8, accent: 0xff9a4a },
  foresight: { motif: 'omen', color: 0x9b78d3, accent: 0xe0d0ff },
  'grim-augury': { motif: 'omen', color: 0x6a3a9a, accent: 0xd65f5f, power: 1.3 },
  'omen-of-ash': { motif: 'ash', color: 0x8a8078, accent: 0xff7a2a, power: 1.8 },
  shift: { motif: 'shadow', color: 0x8b6848, accent: 0xc6baa4, power: 0.6 },
};

/** Every enemy: an idle aura, also used for its attacks. */
export const ENEMY_FX: Record<string, Fx> = {
  husk: { motif: 'stone', color: 0x8a8680, accent: 0x5a5650, power: 0.7 },
  acolyte: { motif: 'water', color: 0x5a8aa8, accent: 0xa8d0e0 },
  ringer: { motif: 'bell', color: 0xb08850, accent: 0xe0c090, power: 0.8 },
  hound: { motif: 'shadow', color: 0x3a2a28, accent: 0xff3a2a, power: 0.9 },
  wraith: { motif: 'static', color: 0xc0a8d0, accent: 0x9b78a3 },
  choir: { motif: 'water', color: 0x8a3040, accent: 0xd06070, power: 1.6 },
  warden: { motif: 'chain', color: 0x7a7870, accent: 0xb0a890, power: 0.8 },
  priest: { motif: 'smoke', color: 0x7a6a80, accent: 0xc0a0c8, power: 0.9 },
  golem: { motif: 'stone', color: 0x9a9078, accent: 0xd6c27a, power: 1.2 },
  lurker: { motif: 'water', color: 0x2a5a60, accent: 0x6ab0b0, power: 1.1 },
  pilgrim: { motif: 'poison', color: 0x8a9a4a, accent: 0xc8d070, power: 0.9 },
  thief: { motif: 'shadow', color: 0x2a2030, accent: 0xd6a15f, power: 0.8 },
  nun: { motif: 'poison', color: 0x5a7a3a, accent: 0x9ad060 },
  bishop: { motif: 'holy', color: 0xd6a15f, accent: 0x8a1020, power: 1.3 },
  abbess: { motif: 'omen', color: 0x4a2050, accent: 0xd65f5f, power: 1.6 },
};

export const fxForEnemy = (ref: string): Fx => ENEMY_FX[ref] ?? { motif: 'shadow', color: 0x4a3a40, accent: 0x9a8a90 };

// ---------- textures ----------

const TEX = { dot: 'fx-dot', soft: 'fx-soft', drop: 'fx-drop', ring: 'fx-ring', link: 'fx-link', streak: 'fx-streak', flake: 'fx-flake', rune: 'fx-rune', flame: 'fx-flame' };

/** Small white shapes, tinted per effect. Built once. */
export function makeFxTextures(scene: Phaser.Scene) {
  const make = (key: string, w: number, h: number, paint: (g: Phaser.GameObjects.Graphics) => void) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({}, false);
    paint(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  // Drawn at about twice the on-screen size of a pixel so they read on a phone.
  make(TEX.dot, 6, 6, (g) => g.fillStyle(0xffffff).fillRect(0, 0, 6, 6));
  make(TEX.soft, 48, 48, (g) => {
    for (let r = 24; r > 0; r -= 3) g.fillStyle(0xffffff, 0.1).fillCircle(24, 24, r);
  });
  make(TEX.drop, 14, 22, (g) => g.fillStyle(0xffffff).fillCircle(7, 15, 7).fillTriangle(7, 0, 1.5, 12, 12.5, 12));
  make(TEX.ring, 32, 32, (g) => g.lineStyle(3, 0xffffff).strokeCircle(16, 16, 13));
  make(TEX.link, 24, 16, (g) => g.lineStyle(4, 0xffffff).strokeRoundedRect(2, 2, 20, 12, 6));
  make(TEX.streak, 90, 8, (g) => {
    g.fillStyle(0xffffff, 0.3).fillRect(0, 2, 90, 4);
    g.fillStyle(0xffffff).fillTriangle(10, 4, 50, 0, 50, 8).fillTriangle(50, 0, 90, 4, 50, 8);
  });
  make(TEX.flake, 12, 12, (g) => g.fillStyle(0xffffff).fillTriangle(0, 0, 12, 4, 4, 12));
  make(TEX.rune, 24, 24, (g) => {
    g.lineStyle(3, 0xffffff).strokeCircle(12, 12, 10);
    g.fillStyle(0xffffff).fillRect(10.5, 3, 3, 18).fillRect(5, 9, 14, 3);
  });
  make(TEX.flame, 18, 30, (g) => {
    g.fillStyle(0xffffff).fillTriangle(9, 0, 0, 20, 18, 20).fillCircle(9, 20, 9);
  });
}

type EmitterConfig = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
type Zone = Phaser.Types.GameObjects.Particles.EmitZoneData;
/** Phaser's zone typings disagree with its own Geom shapes; the shapes work at runtime. */
const zone = (type: 'edge' | 'random', source: Phaser.Geom.Rectangle | Phaser.Geom.Circle | Phaser.Geom.Line, quantity?: number) => ({ type, source, quantity }) as unknown as Zone;

/** Particle settings for a motif. `burst` is a one-shot cast or hit; otherwise a gentle loop. */
function recipe(fx: Fx, size: number, burst: boolean): { tex: string; cfg: EmitterConfig; count: number; frequency: number } {
  const p = fx.power ?? 1;
  const h = size / 2;
  const tint = fx.accent !== undefined ? [fx.color, fx.accent] : [fx.color];
  const edge = (q = 32) => zone('edge', new Phaser.Geom.Rectangle(-h - 2, -h - 2, size + 4, size + 4), q);
  const inside = () => zone('random', new Phaser.Geom.Rectangle(-h * 0.9, -h * 0.9, size * 0.9, size * 0.9));
  const ring = (r: number) => zone('random', new Phaser.Geom.Circle(0, 0, r));
  const n = (k: number) => Math.round(k * p);
  switch (fx.motif) {
    case 'blood':
      return {
        tex: TEX.drop,
        count: n(18),
        frequency: 260,
        cfg: { emitZone: burst ? ring(h * 0.3) : edge(), speed: burst ? { min: 120, max: 260 } : { min: 4, max: 20 }, gravityY: 420, lifespan: burst ? 700 : 900, scale: { start: 0.9, end: 0.4 }, alpha: { start: 1, end: 0 }, tint, rotate: { min: -20, max: 20 } },
      };
    case 'ward':
      return {
        tex: TEX.ring,
        count: n(5),
        frequency: 900,
        cfg: { emitZone: ring(4), speed: 0, lifespan: burst ? 700 : 1600, scale: burst ? { start: 0.6, end: (size / 32) * 1.6 } : { start: (size / 32) * 0.9, end: (size / 32) * 1.25 }, alpha: { start: burst ? 0.9 : 0.4, end: 0 }, tint, blendMode: 'ADD' },
      };
    case 'bell':
      return {
        tex: TEX.ring,
        count: n(4),
        frequency: 1100,
        cfg: { emitZone: ring(2), speed: 0, lifespan: burst ? 800 : 1400, scaleX: { start: 0.5, end: (size / 32) * (burst ? 2.2 : 1.4) }, scaleY: { start: 0.35, end: (size / 32) * (burst ? 1.3 : 0.9) }, alpha: { start: 0.8, end: 0 }, tint, delay: 0 },
      };
    case 'chain':
      return {
        tex: TEX.link,
        count: n(16),
        frequency: 300,
        cfg: burst
          ? { emitZone: zone('edge', new Phaser.Geom.Circle(0, 0, h * 1.25), n(16)), moveToX: 0, moveToY: 0, lifespan: 500, scale: { start: 1.3, end: 0.8 }, alpha: { start: 1, end: 0.2 }, tint, rotate: { min: 0, max: 360 } }
          : { emitZone: edge(24), speed: { min: 2, max: 8 }, lifespan: 1400, scale: 0.9, alpha: { start: 0.6, end: 0 }, tint, rotate: { start: 0, end: 90 } },
      };
    case 'blade':
      return {
        tex: TEX.streak,
        count: n(5),
        frequency: 900,
        cfg: burst
          ? { emitZone: zone('random', new Phaser.Geom.Line(-h * 0.8, h * 0.8, h * 0.8, -h * 0.8) ), speed: { min: 40, max: 120 }, angle: -45, rotate: -45, lifespan: 450, scaleX: { start: 0.6, end: 1.6 * p }, scaleY: { start: 1.2, end: 0.2 }, alpha: { start: 1, end: 0 }, tint, blendMode: 'ADD' }
          : { emitZone: edge(16), speed: 0, rotate: { min: -50, max: -40 }, lifespan: 500, scaleX: { start: 0.1, end: 0.5 }, scaleY: 0.5, alpha: { start: 0.7, end: 0 }, tint, blendMode: 'ADD' },
      };
    case 'mend':
      return {
        tex: TEX.soft,
        count: n(16),
        frequency: 160,
        cfg: { emitZone: inside(), speedY: { min: -70, max: -30 }, speedX: { min: -10, max: 10 }, lifespan: burst ? 900 : 1400, scale: { start: 0.55, end: 0.1 }, alpha: { start: 1, end: 0 }, tint, blendMode: 'ADD' },
      };
    case 'poison':
      return {
        tex: TEX.soft,
        count: n(16),
        frequency: 220,
        cfg: { emitZone: burst ? ring(h * 0.6) : edge(20), speedY: { min: -40, max: -10 }, speedX: { min: -14, max: 14 }, lifespan: 1100, scale: { start: 0.25, end: 0.6 }, alpha: { start: 0.9, end: 0 }, tint },
      };
    case 'smoke':
      return {
        tex: TEX.soft,
        count: n(14),
        frequency: 240,
        cfg: { emitZone: burst ? ring(h * 0.5) : edge(20), speedY: { min: -40, max: -15 }, speedX: { min: -25, max: 25 }, lifespan: burst ? 1300 : 2000, scale: { start: 0.3, end: 1.2 }, alpha: { start: 0.45, end: 0 }, tint },
      };
    case 'fire':
      return {
        tex: TEX.flame,
        count: n(20),
        frequency: 120,
        cfg: { emitZone: burst ? ring(h * 0.6) : edge(30), speedY: { min: -120, max: -50 }, speedX: { min: -12, max: 12 }, lifespan: burst ? 600 : 700, scale: { start: 1.1, end: 0.2 }, alpha: { start: 1, end: 0 }, tint, blendMode: 'ADD' },
      };
    case 'ash':
      return {
        tex: TEX.flake,
        count: n(22),
        frequency: 150,
        cfg: { emitZone: burst ? ring(h * 0.7) : zone('random', new Phaser.Geom.Rectangle(-h, -h - 10, size, 10)), speedY: burst ? { min: -80, max: 60 } : { min: 15, max: 35 }, speedX: { min: -30, max: 30 }, gravityY: 40, lifespan: 1400, scale: { start: 1.1, end: 0.5 }, alpha: { start: 0.9, end: 0 }, tint, rotate: { min: 0, max: 360 } },
      };
    case 'omen':
      return {
        tex: TEX.rune,
        count: n(8),
        frequency: 500,
        cfg: { emitZone: zone('edge', new Phaser.Geom.Circle(0, 0, h * 1.05), 12), speed: burst ? { min: 30, max: 90 } : 6, lifespan: burst ? 900 : 1800, scale: { start: 1.1, end: 0.5 }, alpha: { start: 0.9, end: 0 }, tint, rotate: { start: 0, end: 180 }, blendMode: 'ADD' },
      };
    case 'water':
      return {
        tex: burst ? TEX.drop : TEX.ring,
        count: n(12),
        frequency: 700,
        cfg: burst
          ? { emitZone: ring(h * 0.4), speed: { min: 90, max: 200 }, gravityY: 380, lifespan: 700, scale: { start: 0.9, end: 0.4 }, alpha: { start: 1, end: 0 }, tint }
          : { emitZone: zone('random', new Phaser.Geom.Rectangle(-h, h - 6, size, 6)), speed: 0, lifespan: 1300, scaleX: { start: 0.3, end: 1.8 }, scaleY: { start: 0.12, end: 0.5 }, alpha: { start: 0.9, end: 0 }, tint },
      };
    case 'static':
      return {
        tex: TEX.dot,
        count: n(30),
        frequency: 60,
        cfg: { emitZone: burst ? inside() : edge(40), speed: 0, lifespan: { min: 90, max: 260 }, scaleX: { min: 0.8, max: 4 }, scaleY: 0.6, alpha: { start: 0.9, end: 0.2 }, tint },
      };
    case 'stone':
      return {
        tex: TEX.dot,
        count: n(18),
        frequency: 380,
        cfg: { emitZone: burst ? ring(h * 0.3) : zone('random', new Phaser.Geom.Rectangle(-h, h - 4, size, 4)), speed: burst ? { min: 120, max: 240 } : { min: 5, max: 20 }, angle: burst ? { min: 0, max: 360 } : { min: 250, max: 290 }, gravityY: 300, lifespan: burst ? 700 : 600, scale: { min: 0.8, max: 1.8 }, alpha: { start: 1, end: 0 }, tint, rotate: { min: 0, max: 90 } },
      };
    case 'shadow':
      return {
        tex: TEX.soft,
        count: n(18),
        frequency: 200,
        cfg: burst
          ? { emitZone: inside(), speedY: { min: -90, max: -30 }, speedX: { min: -30, max: 30 }, lifespan: 900, scale: { start: 0.7, end: 0.1 }, alpha: { start: 1, end: 0 }, tint: fx.accent !== undefined ? [fx.accent, fx.color, fx.color] : tint }
          : { emitZone: edge(24), speedY: { min: -30, max: -8 }, speedX: { min: -12, max: 12 }, lifespan: 1500, scale: { start: 0.45, end: 0.1 }, alpha: { start: 0.8, end: 0 }, tint: fx.accent !== undefined ? [fx.accent, fx.color] : tint },
      };
    case 'holy':
      return {
        tex: TEX.ring,
        count: n(6),
        frequency: 1200,
        cfg: { emitZone: zone('random', new Phaser.Geom.Rectangle(-2, -h - 6, 4, 4)), speed: 0, lifespan: 1300, scaleX: { start: 0.6, end: 2.2 }, scaleY: { start: 0.2, end: 0.6 }, alpha: { start: 0.9, end: 0 }, tint, blendMode: 'ADD' },
      };
  }
}

/** Crossing slashes drawn over the card, one after another. */
function slashes(scene: Phaser.Scene, x: number, y: number, size: number, fx: Fx, depth: number) {
  const n = Math.max(1, Math.round(2 * (fx.power ?? 1)));
  const objs: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < n; i++) {
    const ang = (i % 2 ? 45 : -45) + Phaser.Math.Between(-12, 12);
    const off = Phaser.Math.Between(-size / 6, size / 6);
    const rad = Phaser.Math.DegToRad(ang + 90);
    const s = scene.add
      .image(x + Math.cos(rad) * off, y + Math.sin(rad) * off, TEX.streak)
      .setDepth(depth)
      .setAngle(ang)
      .setTint(i % 2 && fx.accent !== undefined ? fx.accent : fx.color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.1, 1.4)
      .setAlpha(0);
    objs.push(s);
    scene.time.delayedCall(i * 90, () => s.setAlpha(1));
    scene.tweens.add({ targets: s, delay: i * 90, scaleX: { from: 0.2, to: (size / 90) * 1.5 }, scaleY: { from: 2.6, to: 1 }, duration: 200, ease: 'Quad.easeOut' });
    scene.tweens.add({ targets: s, delay: i * 90 + 220, alpha: 0, scaleY: 0.3, duration: 260 });
  }
  scene.time.delayedCall(n * 90 + 500, () => objs.forEach((o) => o.destroy()));
}

/** A ring of links that closes in around the card and holds a moment. */
function shackle(scene: Phaser.Scene, x: number, y: number, size: number, fx: Fx, depth: number) {
  const n = Math.round(14 * Math.min(1.5, fx.power ?? 1));
  const state = { r: size * 0.85, a: 0 };
  const links = Array.from({ length: n }, (_, i) =>
    scene.add.image(x, y, TEX.link).setDepth(depth).setTint(i % 3 === 0 && fx.accent !== undefined ? fx.accent : fx.color).setAlpha(0),
  );
  const place = () =>
    links.forEach((l, i) => {
      const t = (i / n) * Math.PI * 2 + state.a;
      l.setPosition(x + Math.cos(t) * state.r, y + Math.sin(t) * state.r * 0.9).setRotation(t + Math.PI / 2);
    });
  place();
  scene.tweens.add({ targets: links, alpha: 1, duration: 120 });
  scene.tweens.add({ targets: state, r: size * 0.52, a: 0.8, duration: 380, ease: 'Back.easeIn', onUpdate: place });
  scene.tweens.add({ targets: links, alpha: 0, delay: 650, duration: 300, onComplete: () => links.forEach((l) => l.destroy()) });
}

/** A one-shot effect centred on a card (a cast on the actor, or a hit on a target). */
export function burstFx(scene: Phaser.Scene, x: number, y: number, size: number, fx: Fx, depth = 28) {
  makeFxTextures(scene);
  if (fx.motif === 'blade') return slashes(scene, x, y, size, fx, depth);
  if (fx.motif === 'chain') return shackle(scene, x, y, size, fx, depth);
  const r = recipe(fx, size, true);
  const em = scene.add.particles(x, y, r.tex, { ...r.cfg, emitting: false }).setDepth(depth);
  // Wards, bells and halos roll out a few rings in a row; static crackles in waves; the rest burst at once.
  if (fx.motif === 'ward' || fx.motif === 'bell' || fx.motif === 'holy') {
    for (let i = 0; i < r.count; i++) scene.time.delayedCall(i * 120, () => em.active && em.explode(1));
  } else if (fx.motif === 'static') {
    for (let i = 0; i < 6; i++) scene.time.delayedCall(i * 80, () => em.active && em.explode(Math.ceil(r.count / 6)));
  } else em.explode(r.count);
  // A halo also lifts motes of light.
  if (fx.motif === 'holy') burstFx(scene, x, y, size, { ...fx, motif: 'mend' }, depth);
  scene.time.delayedCall(2200, () => em.destroy());
}

/** A looping aura inside a card's container. Returns the emitter (destroyed with the card). */
export function auraFx(scene: Phaser.Scene, box: Phaser.GameObjects.Container, size: number, fx: Fx, above?: Phaser.GameObjects.GameObject) {
  makeFxTextures(scene);
  const r = recipe(fx, size, false);
  // Auras glow (additive) so they read over dark portraits; a shadow aura shows in its accent colour.
  const glow = fx.motif !== 'smoke' && fx.motif !== 'stone';
  const tint = fx.motif === 'shadow' && fx.accent !== undefined ? fx.accent : r.cfg.tint;
  const em = scene.add.particles(0, 0, r.tex, { ...r.cfg, tint, frequency: Math.round(r.frequency * 0.45), quantity: 1, ...(glow ? { blendMode: 'ADD' } : {}) });
  box.addAt(em, above ? box.getIndex(above) + 1 : 1);
  return em;
}
