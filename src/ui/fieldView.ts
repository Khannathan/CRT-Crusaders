import Phaser from 'phaser';
import { FONT, PAL, hex } from '../config';
import type { SkillDef } from '../data/skills';
import { ZEAL_MAX, type BattleEvent, type Unit } from '../systems/combat';
import type { Body, FieldBattle, FieldEvent } from '../systems/field';
import { enemyKey } from './enemyArt';
import { portraitKey } from './placeholderPortrait';
import { shake } from './juice';
import { SKILL_FX, burstFx, fxForEnemy, makeFxTextures, type Fx } from './portraitFx';
import { SisterSprite, fullKey, FIGURE_H } from './sisterSprite';

/**
 * Draws a FieldBattle: figures that walk, strike, cast and fall where the
 * engine puts them, health bars over their heads, bolts flying to their
 * targets, numbers popping off the struck. Used by the Sanctum's Vigil (small)
 * and the real-time battle screen (large).
 *
 * Sisters with animation sheets (src/assets/anim/<id>_<anim>.png) play them;
 * the rest move with the tweened motion built from their still figure.
 */

/** The eight animations a Sister's sheets can hold (2 x 2 frames each). */
export const ANIMS = ['idle', 'run', 'attack', 'skill', 'litany', 'hit', 'death', 'victory'] as const;
export type AnimName = (typeof ANIMS)[number];
export const animKey = (id: string, a: AnimName) => `anim-${id}-${a}`;

export interface FieldFigure {
  root: Phaser.GameObjects.Container;
  dead: boolean;
  face(dir: 1 | -1): void;
  walk(on: boolean): void;
  strike(nx: number, ny: number): void;
  cast(color: number, big?: boolean): void;
  pulse(color: number): void;
  hit(hurt: boolean): void;
  die(done?: () => void): void;
  cheer(delay?: number): void;
  /** A boss winding up its Blasphemy (its Blasphemy pose, where it has one). */
  charge?(on: boolean): void;
  /** Height on screen, feet to crown. */
  readonly height: number;
}

/** Tweened figure from one still (the current motion), with a facing and a walk. */
class StillFigure implements FieldFigure {
  constructor(private sprite: SisterSprite) {}
  get root() {
    return this.sprite.root;
  }
  get dead() {
    return this.sprite.dead;
  }
  get height() {
    return this.sprite.height;
  }
  face(dir: 1 | -1) {
    this.sprite.face(dir);
  }
  walk(on: boolean) {
    this.sprite.walk(on);
  }
  strike(nx: number, ny: number) {
    this.sprite.strike(nx, ny);
  }
  cast(color: number, big = false) {
    this.sprite.cast(color, big);
  }
  pulse(color: number) {
    this.sprite.pulse(color);
  }
  hit(hurt: boolean) {
    this.sprite.hit(hurt);
  }
  die(done?: () => void) {
    this.sprite.walk(false);
    this.sprite.die(done);
  }
  cheer(delay = 0) {
    this.sprite.walk(false);
    this.sprite.cheer(delay);
  }
}

/** A Sister with real animation sheets: frames instead of tweens. Missing sheets fall back to her still. */
class SheetFigure implements FieldFigure {
  root: Phaser.GameObjects.Container;
  dead = false;
  private img: Phaser.GameObjects.Sprite;
  private moving = false;
  private busy = false;
  constructor(
    private scene: Phaser.Scene,
    private id: string,
    x: number,
    y: number,
    private s: number,
  ) {
    const shadow = scene.add.ellipse(0, 0, 70 * s, 12 * s, 0x000000, 0.5);
    this.img = scene.add.sprite(0, 8 * s, fullKey(id)).setOrigin(0.5, 1).setScale(s);
    this.root = scene.add.container(x, y, [shadow, this.img]);
    for (const a of ANIMS) {
      const key = animKey(id, a);
      if (!scene.textures.exists(key) || scene.anims.exists(key)) continue;
      const once = a !== 'idle' && a !== 'run';
      scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }), frameRate: a === 'idle' ? 4 : a === 'run' ? 10 : a === 'hit' ? 14 : 9, repeat: once ? 0 : -1 });
    }
    this.img.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (anim.key.endsWith('-death') || anim.key.endsWith('-victory')) return; // held
      this.busy = false;
      this.loop();
    });
    this.loop();
  }
  get height() {
    return (FIGURE_H - 24) * this.s;
  }
  private has(a: AnimName) {
    return this.scene.anims.exists(animKey(this.id, a));
  }
  private play(a: AnimName, fallback?: () => void) {
    if (this.has(a)) {
      this.busy = a !== 'idle' && a !== 'run';
      this.img.play(animKey(this.id, a), true);
    } else fallback?.();
  }
  private loop() {
    if (this.dead || this.busy) return;
    const a: AnimName = this.moving ? 'run' : 'idle';
    if (this.has(a)) this.img.play(animKey(this.id, a), true);
    else {
      this.img.stop();
      this.img.setTexture(fullKey(this.id));
    }
  }
  face(dir: 1 | -1) {
    this.img.setFlipX(dir < 0); // the run sheet faces right
  }
  walk(on: boolean) {
    if (on === this.moving) return;
    this.moving = on;
    this.loop();
  }
  strike(nx: number) {
    this.face(nx >= 0 ? 1 : -1);
    this.play('attack', () => this.scene.tweens.add({ targets: this.img, x: nx * 16 * this.s, duration: 90, yoyo: true }));
  }
  cast(color: number, big = false) {
    this.play(big ? 'litany' : 'skill', () => this.pulse(color));
  }
  pulse(color: number) {
    this.img.setTint(color);
    this.scene.time.delayedCall(160, () => !this.dead && this.img.clearTint());
  }
  hit(hurt: boolean) {
    if (!hurt) return;
    this.img.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => !this.dead && this.img.clearTint());
    this.play('hit');
  }
  die(done?: () => void) {
    if (this.dead) return;
    this.dead = true;
    if (this.has('death')) {
      this.img.play(animKey(this.id, 'death'));
      this.scene.tweens.add({ targets: this.root, alpha: 0.35, delay: 900, duration: 500, onComplete: () => done?.() });
    } else this.scene.tweens.add({ targets: this.root, alpha: 0, duration: 500, onComplete: () => done?.() });
  }
  cheer(delay = 0) {
    this.scene.time.delayedCall(delay, () => {
      this.moving = false;
      this.play('victory', () => this.scene.tweens.add({ targets: this.img, y: this.img.y - 12 * this.s, duration: 140, yoyo: true, repeat: 1 }));
    });
  }
}

/**
 * A foe with full-body art (src/assets/enemy-full/<id>.png, loaded as
 * full-enemy-<id>, 128 x 192 with feet 8 rows up). Bosses stand larger and
 * take their Blasphemy pose while they wind it up.
 */
const enemyFullKey = (ref: string) => `full-enemy-${ref}`;

class EnemyFigure implements FieldFigure {
  root: Phaser.GameObjects.Container;
  dead = false;
  private pose: Phaser.GameObjects.Container;
  private img: Phaser.GameObjects.Image;
  private bob: Phaser.Tweens.Tween;
  private s: number;
  private facing: 1 | -1 = -1;
  constructor(
    private scene: Phaser.Scene,
    private u: Unit,
    x: number,
    y: number,
    s: number,
  ) {
    this.s = s * (u.boss ? 1.4 : 1);
    const shadow = scene.add.ellipse(0, 0, 76 * this.s, 13 * this.s, 0x000000, 0.55);
    const ring = scene.add.ellipse(0, 0, 96 * this.s, 20 * this.s).setStrokeStyle(2 * s, u.boss ? 0xc0392b : PAL.oxblood, 0.6);
    this.img = scene.add.image(0, 8 * this.s, enemyFullKey(u.ref)).setOrigin(0.5, 1).setScale(this.s);
    this.pose = scene.add.container(0, 0, [this.img]);
    this.root = scene.add.container(x, y, [ring, shadow, this.pose]);
    this.bob = scene.tweens.add({ targets: this.img, y: this.img.y - 2 * this.s, duration: 600 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
  get height() {
    return (FIGURE_H - 24) * this.s;
  }
  face(dir: 1 | -1) {
    this.facing = dir;
    this.pose.scaleX = dir; // the art is drawn facing the viewer, so either way reads
  }
  walk(on: boolean) {
    if (this.dead) return;
    this.bob.timeScale = on ? 3 : 1;
    this.pose.setAngle(on ? Math.sin(this.scene.time.now / 90) * 2 : 0);
  }
  strike(nx: number, ny: number) {
    if (this.dead) return;
    const s = this.s;
    this.scene.tweens.killTweensOf(this.pose);
    this.pose.setPosition(0, 0);
    this.scene.tweens.chain({
      targets: this.pose,
      tweens: [
        { x: -nx * 5 * s, y: -ny * 5 * s, duration: 90, ease: 'Quad.out' },
        { x: nx * 24 * s, y: ny * 24 * s, duration: 80, ease: 'Quad.in' },
        { x: 0, y: 0, duration: 200, ease: 'Quad.out' },
      ],
    });
  }
  cast(color: number, big = false) {
    if (this.dead) return;
    this.img.setTint(color);
    this.scene.tweens.add({ targets: this.pose, y: (big ? -14 : -8) * this.s, duration: 160, yoyo: true, hold: big ? 360 : 160, onComplete: () => !this.dead && this.img.clearTint() });
  }
  charge(on: boolean) {
    if (this.dead) return;
    const pose = `${enemyFullKey(this.u.ref)}-blasphemy`;
    this.img.setTexture(on && this.scene.textures.exists(pose) ? pose : enemyFullKey(this.u.ref));
  }
  pulse(color: number) {
    if (this.dead) return;
    this.img.setTint(color);
    this.scene.time.delayedCall(180, () => !this.dead && this.img.clearTint());
  }
  hit(hurt: boolean) {
    if (this.dead || !hurt) return;
    this.img.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => !this.dead && this.img.setTint(0xff7070));
    this.scene.time.delayedCall(200, () => !this.dead && this.img.clearTint());
    this.scene.tweens.add({ targets: this.img, x: { from: -4 * this.s, to: 4 * this.s }, duration: 40, yoyo: true, repeat: 2, onComplete: () => this.img.setX(0) });
  }
  die(done?: () => void) {
    if (this.dead) return;
    this.dead = true;
    this.bob.remove();
    this.img.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => this.img.setTint(0x6a6070));
    this.scene.tweens.add({ targets: this.pose, scaleY: 0.3, scaleX: 1.15 * this.facing, alpha: 0, delay: 160, duration: 480, ease: 'Quad.in' });
    this.scene.tweens.add({ targets: this.root, alpha: 0, delay: 600, duration: 250, onComplete: () => done?.() });
  }
  cheer() {}
}

/**
 * A foe on the field without full-body art: its portrait is cut into
 * a round reliquary medallion that bobs over its shadow.
 */
class EnemyToken implements FieldFigure {
  root: Phaser.GameObjects.Container;
  dead = false;
  private body: Phaser.GameObjects.Container;
  private img: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Arc;
  private bob: Phaser.Tweens.Tween;
  private size: number;
  constructor(
    private scene: Phaser.Scene,
    u: Unit,
    x: number,
    y: number,
    s: number,
  ) {
    this.size = (u.boss ? 170 : 96) * s;
    const key = tokenTexture(scene, u.ref);
    const shadow = scene.add.ellipse(0, 0, this.size * 0.8, this.size * 0.18, 0x000000, 0.55);
    this.img = scene.add.image(0, 0, key).setDisplaySize(this.size, this.size);
    this.ring = scene.add.circle(0, 0, this.size / 2).setStrokeStyle(Math.max(2, 3 * s), u.boss ? 0xc0392b : PAL.oxblood, 1);
    this.body = scene.add.container(0, -this.size / 2 - 6 * s, [this.img, this.ring]);
    this.root = scene.add.container(x, y, [shadow, this.body]);
    this.bob = scene.tweens.add({ targets: this.body, y: this.body.y - 4 * s, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
  get height() {
    return this.size + 6;
  }
  face() {
    // a medallion has no facing
  }
  walk(on: boolean) {
    this.bob.timeScale = on ? 3 : 1;
  }
  strike(nx: number, ny: number) {
    if (this.dead) return;
    this.scene.tweens.add({ targets: this.img, x: nx * 18, y: ny * 18, duration: 90, yoyo: true, ease: 'Quad.out' });
    this.scene.tweens.add({ targets: this.ring, x: nx * 18, y: ny * 18, duration: 90, yoyo: true, ease: 'Quad.out' });
  }
  cast(color: number, big = false) {
    if (this.dead) return;
    this.ring.setStrokeStyle(big ? 6 : 4, color, 1);
    this.scene.tweens.add({ targets: this.body, scale: big ? 1.25 : 1.1, duration: 180, yoyo: true, hold: big ? 300 : 100, onComplete: () => !this.dead && this.ring.setStrokeStyle(3, PAL.oxblood, 1) });
  }
  pulse(color: number) {
    if (this.dead) return;
    this.img.setTint(color);
    this.scene.time.delayedCall(180, () => !this.dead && this.img.clearTint());
  }
  hit(hurt: boolean) {
    if (this.dead || !hurt) return;
    this.img.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => !this.dead && this.img.setTint(0xff7070));
    this.scene.time.delayedCall(180, () => !this.dead && this.img.clearTint());
    this.scene.tweens.add({ targets: this.body, x: { from: -4, to: 4 }, duration: 40, yoyo: true, repeat: 2, onComplete: () => this.body.setX(0) });
  }
  die(done?: () => void) {
    if (this.dead) return;
    this.dead = true;
    this.bob.remove();
    this.img.setTint(0x6a6070);
    this.scene.tweens.add({ targets: this.body, scaleY: 0.2, scaleX: 1.2, alpha: 0, y: this.body.y + this.size * 0.3, delay: 120, duration: 420, ease: 'Quad.in' });
    this.scene.tweens.add({ targets: this.root, alpha: 0, delay: 450, duration: 300, onComplete: () => done?.() });
  }
  cheer() {
    // foes do not celebrate on screen
  }
}

/** The round medallion cut from an enemy's portrait, made once per enemy type. */
function tokenTexture(scene: Phaser.Scene, ref: string): string {
  const key = `token-${ref}`;
  if (scene.textures.exists(key)) return key;
  const src = scene.textures.exists(enemyKey(ref)) ? scene.textures.get(enemyKey(ref)).getSourceImage() : undefined;
  const size = 128;
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return enemyKey(ref);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#140e16';
  ctx.fillRect(0, 0, size, size);
  if (src) ctx.drawImage(src as CanvasImageSource, 0, 0, (src as HTMLImageElement).width, (src as HTMLImageElement).height, 0, 0, size, size);
  ctx.restore();
  tex.refresh();
  return key;
}

interface View {
  fig: FieldFigure;
  hpBack: Phaser.GameObjects.Rectangle;
  hp: Phaser.GameObjects.Rectangle;
  shield: Phaser.GameObjects.Rectangle;
  meter?: Phaser.GameObjects.Rectangle;
  charge?: Phaser.GameObjects.Ellipse;
  barW: number;
}

export interface FieldViewOpts {
  /** Screen position of the field's top-left corner (field units are pixels). */
  x: number;
  y: number;
  /** Figure scale: 0.5 in the Vigil, 0.75 on the battle screen. */
  scale: number;
  /** Numbers, bars and effects sized down for the Vigil. */
  compact?: boolean;
  /** Depth range for figures (sorted by feet within it). */
  depth?: number;
  onText?: (text: string) => void;
  onDeath?: (u: Unit) => void;
  /** A Litany or Blasphemy goes off (the big screen stamps its name). */
  onUltimate?: (u: Unit, skill: SkillDef, charging: boolean) => void;
}

export class FieldView {
  private views = new Map<string, View>();
  private depth: number;
  private gone = false;
  readonly objects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private scene: Phaser.Scene,
    readonly field: FieldBattle,
    private o: FieldViewOpts,
  ) {
    this.depth = o.depth ?? 10;
    makeFxTextures(scene);
    for (const u of field.battle.units) this.add(u);
    this.sync();
  }

  private get b() {
    return this.field.battle;
  }

  private add(u: Unit) {
    const body = this.field.bodies.get(u.uid);
    if (!body || this.views.has(u.uid)) return;
    const s = this.o.scale;
    const x = this.o.x + body.x;
    const y = this.o.y + body.y;
    let fig: FieldFigure;
    if (u.side === 'party' && this.scene.textures.exists(fullKey(u.ref))) {
      const sheets = ANIMS.some((a) => this.scene.textures.exists(animKey(u.ref, a)));
      fig = sheets ? new SheetFigure(this.scene, u.ref, x, y, s) : new StillFigure(new SisterSprite(this.scene, u.ref, x, y, s, PAL.amber));
    } else if (u.side === 'party') {
      fig = new PortraitFigure(this.scene, u, x, y, s);
    } else fig = this.scene.textures.exists(enemyFullKey(u.ref)) ? new EnemyFigure(this.scene, u, x, y, s) : new EnemyToken(this.scene, u, x, y, s);
    fig.face(body.face);
    const barW = Math.round((u.boss ? 110 : 58) * (this.o.compact ? 0.8 : 1) * (s / 0.75 > 1 ? 1.15 : 1));
    const bh = this.o.compact ? 4 : 6;
    const hpBack = this.scene.add.rectangle(0, 0, barW + 2, bh + 2, 0x000000, 0.8).setOrigin(0, 0.5);
    const hp = this.scene.add.rectangle(0, 0, barW, bh, u.side === 'party' ? 0x7aba5a : 0xc0392b).setOrigin(0, 0.5);
    const shield = this.scene.add.rectangle(0, 0, 0, 2, 0x8fb6d8).setOrigin(0, 0.5);
    const hasMeter = u.side === 'party' || u.wrath !== undefined;
    const meter = hasMeter ? this.scene.add.rectangle(0, 0, 0, this.o.compact ? 2 : 3, u.side === 'party' ? PAL.amber : 0xff5a3a).setOrigin(0, 0.5) : undefined;
    const v: View = { fig, hpBack, hp, shield, meter, barW };
    this.views.set(u.uid, v);
    this.objects.push(fig.root, hpBack, hp, shield, ...(meter ? [meter] : []));
  }

  /** Puts every figure where the engine says, sorted by depth, with bars over their heads. */
  sync() {
    if (this.gone) return;
    for (const u of this.b.units) {
      const v = this.views.get(u.uid);
      const body = this.field.bodies.get(u.uid);
      if (!v || !body) continue;
      const x = this.o.x + body.x;
      const y = this.o.y + body.y;
      v.fig.root.setPosition(x, y).setDepth(this.depth + body.y / 1000);
      if (!v.fig.dead) {
        v.fig.face(body.face);
        v.fig.walk(body.moving);
      }
      const top = y - v.fig.height - (this.o.compact ? 4 : 8);
      const left = x - v.barW / 2;
      const alive = u.hp > 0;
      const d = this.depth + 0.9;
      v.hpBack.setPosition(left - 1, top).setVisible(alive).setDepth(d);
      v.hp.setPosition(left, top).setSize(Math.max(0, (v.barW * u.hp) / u.maxHp), v.hp.height).setVisible(alive).setDepth(d);
      const sh = u.status.shield ?? 0;
      v.shield.setPosition(left, top - v.hp.height / 2 - 1).setSize(Math.min(v.barW, (v.barW * sh) / u.maxHp), 2).setVisible(alive && sh > 0).setDepth(d);
      if (v.meter) {
        const m = u.side === 'party' ? u.zeal ?? 0 : u.wrath ?? 0;
        v.meter.setPosition(left, top + v.hp.height / 2 + 2).setSize((v.barW * Math.min(m, ZEAL_MAX)) / ZEAL_MAX, v.meter.height).setVisible(alive).setDepth(d);
        v.meter.setFillStyle(m >= ZEAL_MAX ? 0xfff1d6 : u.side === 'party' ? PAL.amber : 0xff5a3a);
      }
      if (v.charge) {
        v.charge.setPosition(x, y).setDepth(this.depth - 0.5);
        if (!u.status.charging || !alive) {
          v.fig.charge?.(false);
          v.charge.destroy();
          v.charge = undefined;
        }
      }
    }
  }

  private pos(uid: string) {
    const body = this.field.bodies.get(uid)!;
    const v = this.views.get(uid);
    const h = v?.fig.height ?? 60;
    return { x: this.o.x + body.x, y: this.o.y + body.y - h * 0.5, feet: this.o.y + body.y, body };
  }

  /** Draws what the engine reports. */
  handle(events: FieldEvent[]) {
    for (const e of events) {
      if (e.kind === 'spawn') {
        this.add(this.b.get(e.uid));
        this.sync();
      } else if (e.kind === 'tick') this.show(e.events);
      else if (e.kind === 'act') this.act(e);
    }
  }

  private fxOf(u: Unit, skill: SkillDef): Fx {
    return (u.side === 'party' ? SKILL_FX[skill.id] : fxForEnemy(u.ref)) ?? { motif: 'blade', color: PAL.amber };
  }

  private act(e: Extract<FieldEvent, { kind: 'act' }>) {
    const u = this.b.get(e.uid);
    const v = this.views.get(e.uid);
    if (!v) return;
    const fx = this.fxOf(u, e.skill);
    const from = this.pos(e.uid);
    const s = e.skill;
    if (e.charge) {
      // The Blasphemy winds up: a red ring grows under the boss until it lands.
      v.fig.cast(0xff3a2a, true);
      v.fig.charge?.(true);
      const r = (u.boss ? 90 : 60) * this.o.scale * 1.4;
      v.charge?.destroy();
      v.charge = this.scene.add.ellipse(from.x, from.feet, r * 2, r * 0.7).setStrokeStyle(3, 0xff3a2a, 0.9).setFillStyle(0xff3a2a, 0.12);
      this.scene.tweens.add({ targets: v.charge, scaleX: 1.25, scaleY: 1.25, alpha: 0.5, duration: 500, yoyo: true, repeat: -1 });
      this.objects.push(v.charge);
      this.o.onUltimate?.(u, s, true);
      this.show(e.events);
      return;
    }
    if (e.litany) {
      v.fig.cast(fx.color, true);
      burstFx(this.scene, from.x, from.y, (this.o.compact ? 70 : 130) * (this.o.scale / 0.75), { ...fx, power: 1.6 }, this.depth + 2);
      if (!this.o.compact) shake(this.scene, 'crit');
      this.o.onUltimate?.(u, s, false);
    }
    // Who it lands on: every unit the events touch.
    const hitUids = [...new Set(e.events.filter((x) => x.type === 'damage' || x.type === 'heal' || x.type === 'shield' || x.type === 'status').map((x) => (x as { uid: string }).uid))];
    const offensive = s.target === 'enemy' || s.target === 'allEnemies';
    if (offensive && !e.litany) {
      const t = e.targetUid ?? hitUids.find((id) => this.b.get(id)?.side !== u.side);
      if (t && this.field.bodies.get(t)) {
        const to = this.pos(t);
        const d = Math.hypot(to.x - from.x, to.y - from.y) || 1;
        if (e.ranged) v.fig.cast(fx.color);
        else v.fig.strike((to.x - from.x) / d, (to.y - from.y) / d);
      } else v.fig.cast(fx.color);
    } else if (!e.litany) v.fig.cast(fx.color);

    if (offensive && e.ranged) {
      // Bolts fly; numbers wait for them.
      let longest = 0;
      for (const id of hitUids) {
        if (this.b.get(id)?.side === u.side || !this.field.bodies.get(id)) continue;
        const to = this.pos(id);
        const ms = Math.min(420, Math.hypot(to.x - from.x, to.y - from.y) * 1.3 + 60);
        longest = Math.max(longest, ms);
        this.bolt(from.x, from.y - 10, to.x, to.y, fx.color, ms);
      }
      this.scene.time.delayedCall(longest, () => this.land(e, fx, hitUids));
    } else this.scene.time.delayedCall(offensive ? 140 : 60, () => this.land(e, fx, hitUids));
  }

  private land(e: Extract<FieldEvent, { kind: 'act' }>, fx: Fx, hitUids: string[]) {
    if (this.gone) return;
    const u = this.b.get(e.uid);
    for (const id of hitUids) {
      if (!this.field.bodies.get(id)) continue;
      const p = this.pos(id);
      const foe = this.b.get(id)?.side !== u.side;
      burstFx(this.scene, p.x, p.y, (this.o.compact ? 40 : 80) * (this.o.scale / 0.75) * (foe ? 1 : 0.7), { ...fx, power: (fx.power ?? 1) * (foe ? 0.7 : 0.5) }, this.depth + 1);
    }
    this.show(e.events);
  }

  private bolt(x0: number, y0: number, x1: number, y1: number, color: number, ms: number) {
    const size = this.o.compact ? 5 : 8;
    const head = this.scene.add.rectangle(x0, y0, size, size, 0xfff1d6).setDepth(this.depth + 2).setAngle(45);
    const glow = this.scene.add.rectangle(x0, y0, size * 2, size * 2, color, 0.7).setDepth(this.depth + 1.9).setAngle(45);
    this.scene.tweens.add({ targets: [head, glow], x: x1, y: y1, duration: ms, ease: 'Quad.in', onComplete: () => [head, glow].forEach((o) => o.destroy()) });
    // A short trail of embers.
    for (let i = 1; i <= 3; i++) {
      this.scene.time.delayedCall((ms / 4) * i, () => {
        if (!head.active) return;
        const ember = this.scene.add.rectangle(head.x, head.y, size * 0.7, size * 0.7, color).setDepth(this.depth + 1.8);
        this.scene.tweens.add({ targets: ember, alpha: 0, scale: 0.2, duration: 260, onComplete: () => ember.destroy() });
      });
    }
  }

  private floatStack = new Map<string, { at: number; n: number }>();

  private float(uid: string, label: string, color: number, big = false) {
    if (!this.field.bodies.get(uid)) return;
    const p = this.pos(uid);
    const v = this.views.get(uid);
    const size = (this.o.compact ? 14 : 20) + (big ? 6 : 0);
    // several pops on one body at once stack upward instead of printing over each other
    const now = this.scene.time.now;
    const prev = this.floatStack.get(uid);
    const n = prev && now - prev.at < 450 ? prev.n + 1 : 0;
    this.floatStack.set(uid, { at: now, n });
    const y = p.feet - (v?.fig.height ?? 60) - (this.o.compact ? 10 : 18) - (n % 4) * (size + 4);
    const t = this.scene.add
      .text(p.x + Phaser.Math.Between(-10, 10), y, label, { fontFamily: FONT, fontSize: `${size}px`, color: hex(color), stroke: '#000000', strokeThickness: this.o.compact ? 3 : 5 })
      .setOrigin(0.5)
      .setDepth(this.depth + 3)
      .setScale(big ? 1.4 : 1);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 120 });
    this.scene.tweens.add({ targets: t, y: y - (this.o.compact ? 24 : 40), alpha: 0, delay: 250, duration: 650, onComplete: () => t.destroy() });
  }

  private show(events: BattleEvent[]) {
    if (this.gone) return;
    for (const e of events) {
      const v = 'uid' in e && e.uid ? this.views.get(e.uid) : undefined;
      switch (e.type) {
        case 'damage':
          this.float(e.uid, e.amount ? `${e.amount}` : 'BLOCKED', e.crit ? PAL.amber : PAL.ivory, !!e.crit);
          v?.fig.hit(e.amount > 0);
          if (e.crit && !this.o.compact) shake(this.scene, 'crit');
          break;
        case 'heal':
          this.float(e.uid, `+${e.amount}`, 0x9ad08a);
          v?.fig.pulse(0x9ad08a);
          break;
        case 'shield':
          this.float(e.uid, `+${e.amount}`, 0x8fb6d8);
          v?.fig.pulse(0x8fb6d8);
          break;
        case 'status':
          if (!this.o.compact) this.float(e.uid, e.label, PAL.steel);
          break;
        case 'death': {
          const u = this.b.get(e.uid);
          v?.fig.die();
          if (u) this.o.onDeath?.(u);
          break;
        }
        case 'phase':
        case 'text':
          this.o.onText?.(e.text);
          break;
      }
    }
    this.sync();
  }

  /** Victory: the living Sisters celebrate. */
  cheer() {
    let i = 0;
    for (const u of this.b.alive('party')) this.views.get(u.uid)?.fig.cheer(i++ * 90);
  }

  /** The figure for a unit (for taps). */
  figureOf(uid: string) {
    return this.views.get(uid)?.fig;
  }

  /** The body under a screen point, if any (taps on the field). */
  bodyAt(x: number, y: number): Body | undefined {
    let best: Body | undefined;
    let bd = 50;
    for (const u of this.b.alive()) {
      const b = this.field.bodies.get(u.uid)!;
      const h = this.views.get(u.uid)?.fig.height ?? 60;
      const d = Math.hypot(this.o.x + b.x - x, this.o.y + b.y - h / 2 - y);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  destroy() {
    this.gone = true;
    for (const v of this.views.values()) [v.fig.root, v.hpBack, v.hp, v.shield, v.meter, v.charge].forEach((o) => o?.destroy());
    this.views.clear();
  }
}

/** A Sister with no full-body art yet: her portrait in a small frame that walks. */
class PortraitFigure implements FieldFigure {
  root: Phaser.GameObjects.Container;
  dead = false;
  private body: Phaser.GameObjects.Container;
  private img: Phaser.GameObjects.Image;
  private size: number;
  private bob?: Phaser.Tweens.Tween;
  constructor(
    private scene: Phaser.Scene,
    u: Unit,
    x: number,
    y: number,
    s: number,
  ) {
    this.size = 88 * s;
    const shadow = scene.add.ellipse(0, 0, this.size * 0.8, this.size * 0.18, 0x000000, 0.55);
    const frame = scene.add.rectangle(0, 0, this.size + 4, this.size + 4, 0x110b13).setStrokeStyle(2, PAL.amber);
    this.img = scene.add.image(0, 0, portraitKey(u.ref)).setDisplaySize(this.size, this.size);
    this.body = scene.add.container(0, -this.size / 2 - 4, [frame, this.img]);
    this.root = scene.add.container(x, y, [shadow, this.body]);
  }
  get height() {
    return this.size + 6;
  }
  face() {}
  walk(on: boolean) {
    if (on === !!this.bob || this.dead) return;
    if (on) this.bob = this.scene.tweens.add({ targets: this.body, angle: { from: -3, to: 3 }, duration: 160, yoyo: true, repeat: -1 });
    else {
      this.bob?.remove();
      this.bob = undefined;
      this.body.setAngle(0);
    }
  }
  strike(nx: number, ny: number) {
    this.scene.tweens.add({ targets: this.img, x: nx * 14, y: ny * 14, duration: 90, yoyo: true });
  }
  cast(color: number) {
    this.pulse(color);
  }
  pulse(color: number) {
    this.img.setTint(color);
    this.scene.time.delayedCall(180, () => !this.dead && this.img.clearTint());
  }
  hit(hurt: boolean) {
    if (!hurt) return;
    this.img.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => !this.dead && this.img.clearTint());
  }
  die(done?: () => void) {
    this.dead = true;
    this.bob?.remove();
    this.img.setTint(0x333333);
    this.scene.tweens.add({ targets: this.root, alpha: 0.25, duration: 500, onComplete: () => done?.() });
  }
  cheer(delay = 0) {
    this.scene.tweens.add({ targets: this.body, y: this.body.y - 10, delay, duration: 140, yoyo: true, repeat: 1 });
  }
}

