import Phaser from 'phaser';
import { pixelShadow, rimKey } from './pixelFx';
import { MINI_SCALE, POSE, glowKey, miniKey, posesKey, type PoseName } from './spriteAssets';
import { hasFullBody } from './placeholderPortrait';
import { standInKey } from './standIn';

/**
 * A Sister's full-body pixel figure, brought to life with sprite-style motion
 * built from her one still image (src/assets/full-body/<id>.png, 128 x 192):
 *
 * - idle: her upper body sinks a pixel or two over her planted legs (breathing)
 * - attack: a step back, her STRIKE pose thrown at the foe, a settle back
 * - cast: her CAST pose (LITANY for a Litany), a lift and a coloured glow round her silhouette
 * - hit: her HURT pose, white flash, red tint, a jolt back
 * - death: HURT goes grey, sinks and crumbles into rising ash
 * - active: she steps forward on a brightened floor ring
 *
 * The poses come from her pose sheet (src/assets/poses/<id>.png, see
 * spriteAssets.ts) when she has one; without it the still makes the same moves.
 * Pixel art stays on its grid: the art is only ever drawn at whole-number
 * scales and moves in whole-pixel steps, never squashed, stretched or tilted.
 * Small figures (the Vigil) use a mini texture shrunk once (miniKey).
 *
 * Layers: stance (steps forward when active) > pose (lunges, squash, death)
 * > halo + legs + upper body. Everything is positioned so (0, 0) is between her feet.
 */

/** Native size of the full-body art. */
export const FIGURE_W = 128;
export const FIGURE_H = 192;
/** Rows of empty margin under her feet in the art. */
const FOOT_PAD = 8;
/** Rows above the waist split: the upper body breathes, the legs stay put. */
const WAIST = 104;
/** Breathing: upper-body offset in art pixels, one step per beat. */
const BREATH = [0, 0, 1, 1, 2, 2, 2, 1, 1, 0];
const BEAT_MS = 150;

/** Her figure's texture key: her own full-body art, else her Order-and-class stand-in (ui/standIn.ts). */
export const fullKey = (id: string) => (hasFullBody(id) ? `full-${id}` : (standInKey('full', id) ?? `full-${id}`));
/** Same key as fieldView's animKey: an animation sheet loaded by BootScene from src/assets/anim. */
const sheetKey = (id: string, a: string) => `anim-${id}-${a}`;

/** Extra options for a figure. */
export interface SisterSpriteOpts {
  /**
   * A small figure (the Vigil): her still shrunk once into its own crisp
   * texture at this scale and drawn pixel for pixel, instead of the 128 x 192
   * art scaled down (which drops whole rows and columns).
   */
  mini?: boolean;
}

/** A stepped ease: flashes and hops move in a few hard steps, like sprite frames. */
const STEPS = (n: number) => ({ ease: 'Stepped', easeParams: [n] });

export class SisterSprite {
  readonly root: Phaser.GameObjects.Container;
  private stance: Phaser.GameObjects.Container;
  private pose: Phaser.GameObjects.Container;
  private halo: Phaser.GameObjects.Image;
  private legs: Phaser.GameObjects.Image;
  readonly upper: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Ellipse;
  private ringColor: number;
  private breath?: Phaser.Time.TimerEvent;
  private beat = 0;
  private active = false;
  dead = false;

  /** Her animation sheet frames, shown in place of the still while one plays. */
  private sheet?: Phaser.GameObjects.Sprite;
  /** Her pose sheet (STRIKE, CAST, LITANY, HURT), shown in place of the still for a beat. */
  private poseImg?: Phaser.GameObjects.Sprite;
  private poseBack?: Phaser.Time.TimerEvent;
  /** Art scale of the texture drawn (1, or MINI_SCALE for a mini). */
  private k: number;
  /** Screen pixels per texture pixel: always a whole number. */
  private u: number;

  constructor(
    private scene: Phaser.Scene,
    private id: string,
    x: number,
    y: number,
    /** Size against the 128 x 192 art; 1 = 128 x 192. Whole numbers, or MINI_SCALE with { mini: true }. */
    private s = 1,
    ringColor = 0x8a7a66,
    /** A 1-px outline baked round her (the battle screen's gold team rim). */
    private rim?: number,
    opts: SisterSpriteOpts = {},
  ) {
    const mini = !!opts.mini && scene.textures.exists(fullKey(id));
    this.k = mini ? MINI_SCALE : 1;
    this.u = mini ? Math.max(1, Math.round(s / MINI_SCALE)) : s;
    const key = this.still();
    this.ringColor = ringColor;
    const shadow = rim !== undefined ? pixelShadow(scene, 80 * s) : scene.add.ellipse(0, 0, 80 * s, 14 * s, 0x000000, 0.55);
    this.ring = scene.add.ellipse(0, 0, 100 * s, 22 * s).setStrokeStyle(2 * s, ringColor, 0.55);
    const img = () => scene.add.image(0, this.px(FOOT_PAD), key).setOrigin(0.5, 1).setScale(this.u);
    const tex = scene.textures.get(key).getSourceImage() as { width: number; height: number };
    const waist = Math.round(WAIST * this.k);
    this.halo = scene.add.image(0, this.px(FOOT_PAD), glowKey(scene, key, this.glowR)).setOrigin(0.5, 1).setScale(this.u).setTintFill(0xffffff).setAlpha(0);
    this.legs = img().setCrop(0, waist, tex.width, tex.height - waist);
    this.upper = img().setCrop(0, 0, tex.width, waist);
    this.pose = scene.add.container(0, 0, [this.halo, this.legs, this.upper]);
    if (!mini && scene.textures.exists(posesKey(id))) {
      this.poseImg = scene.add.sprite(0, this.px(FOOT_PAD), this.tex(posesKey(id)), 0).setOrigin(0.5, 1).setScale(this.u).setVisible(false);
      this.pose.add(this.poseImg);
    }
    this.stance = scene.add.container(0, 0, [this.ring, shadow, this.pose]);
    this.root = scene.add.container(x, y, [this.stance]);
    // Each figure breathes on her own beat.
    this.beat = Phaser.Math.Between(0, BREATH.length - 1);
    this.breath = scene.time.addEvent({ delay: BEAT_MS + Phaser.Math.Between(-15, 25), loop: true, callback: () => this.breathe() });
    this.root.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.breath?.remove();
      this.poseBack?.remove();
    });
  }

  /** `n` pixels of the 128 x 192 art, in whole screen pixels at this figure's size. */
  private px(n: number) {
    return Math.round(n * this.k) * this.u;
  }

  private get glowR() {
    return this.k < 1 ? 1 : 2;
  }

  /** The rimmed copy of a texture when she has a rim. */
  private tex(k: string) {
    return this.rim !== undefined ? rimKey(this.scene, k, this.rim) : k;
  }

  /** Her still's texture (rimmed when she has a rim, shrunk for a mini). */
  private still() {
    return this.k < 1 ? miniKey(this.scene, fullKey(this.id), this.k) : this.tex(fullKey(this.id));
  }

  /** Height of the figure on screen, feet to crown. */
  get height() {
    return (FIGURE_H - FOOT_PAD - 16) * this.s;
  }

  /** Everything that shows her art (tints go on all of it). */
  private get parts() {
    return [this.upper, this.legs, this.poseImg, this.sheet].filter((p): p is Phaser.GameObjects.Image | Phaser.GameObjects.Sprite => !!p);
  }

  private breathe() {
    if (this.dead) return;
    this.beat = (this.beat + 1) % BREATH.length;
    this.upper.y = this.px(FOOT_PAD) + this.px(BREATH[this.beat]);
  }

  /** Whether she has a pose sheet to show. */
  get hasPoses() {
    return !!this.poseImg;
  }

  /**
   * Shows one of her drawn poses in place of the still, for `ms` (or until
   * showStill). Returns false when she has no pose sheet.
   */
  private showPose(name: PoseName, ms?: number) {
    const p = this.poseImg;
    if (!p || this.sheet?.visible) return false;
    this.poseBack?.remove();
    this.poseBack = undefined;
    p.setFrame(POSE[name]).setVisible(true);
    this.upper.setVisible(false);
    this.legs.setVisible(false);
    this.halo.setTexture(glowKey(this.scene, p.texture.key, this.glowR), POSE[name]);
    if (ms) this.poseBack = this.scene.time.delayedCall(ms, () => this.showStill());
    return true;
  }

  /** Back to her still (breathing). */
  private showStill() {
    this.poseBack?.remove();
    this.poseBack = undefined;
    if (!this.poseImg?.visible) return;
    this.poseImg.setVisible(false);
    this.upper.setVisible(true);
    this.legs.setVisible(true);
    this.halo.setTexture(glowKey(this.scene, this.still(), this.glowR));
  }

  /**
   * Plays one of her animation sheets (attack, skill, litany...) over her still, when
   * src/assets/anim/<id>_<anim>.png exists. Returns false when she has no such sheet.
   */
  private playSheet(a: string) {
    const raw = sheetKey(this.id, a);
    if (this.k < 1 || !this.scene.textures.exists(raw)) return false;
    const key = this.tex(raw);
    if (!this.scene.anims.exists(key)) {
      this.scene.anims.create({ key, frames: this.scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }), frameRate: 9, repeat: 0 });
    }
    if (!this.sheet) {
      this.sheet = this.scene.add.sprite(0, this.px(FOOT_PAD), key, 0).setOrigin(0.5, 1).setScale(this.u).setVisible(false);
      this.pose.addAt(this.sheet, this.pose.getIndex(this.upper));
      this.sheet.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.stopSheet());
      // The coloured halo follows her pose frame by frame
      this.sheet.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_a: unknown, frame: Phaser.Animations.AnimationFrame) =>
        this.halo.setTexture(glowKey(this.scene, frame.textureKey, this.glowR), frame.textureFrame),
      );
    }
    this.showStill();
    this.upper.setVisible(false);
    this.legs.setVisible(false);
    this.sheet.setVisible(true).play(key);
    this.halo.setTexture(glowKey(this.scene, key, this.glowR), 0);
    return true;
  }

  private stopSheet() {
    this.sheet?.stop().setVisible(false);
    this.halo.setTexture(glowKey(this.scene, this.still(), this.glowR));
    this.upper.setVisible(true);
    this.legs.setVisible(true);
  }

  /** Her drawn pose for an action: an animation sheet first, then her pose sheet. */
  private act(sheet: string, pose: PoseName, ms: number) {
    if (!this.playSheet(sheet)) this.showPose(pose, ms);
  }

  private kill(...targets: object[]) {
    for (const t of targets) this.scene.tweens.killTweensOf(t);
  }

  /** Her turn: she steps forward and her floor ring brightens. */
  setActive(on: boolean) {
    if (on === this.active || this.dead) return;
    this.active = on;
    this.kill(this.stance, this.ring);
    this.scene.tweens.add({ targets: this.stance, y: on ? -this.px(8) : 0, duration: 180, ...STEPS(4) });
    this.ring.setStrokeStyle(2 * this.s, on ? 0xf2e6c9 : this.ringColor, on ? 1 : 0.55).setScale(1).setAlpha(1);
    if (on) this.scene.tweens.add({ targets: this.ring, scaleX: 1.12, scaleY: 1.12, alpha: 0.6, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  /** Squares the pose up: no stretch or tilt ever stays on her (pixel art only moves in whole pixels). */
  private reset() {
    this.pose.setPosition(0, 0).setScale(this.facing, 1).setAngle(0);
  }

  /**
   * Wind-up, lunge toward the foe (up the screen when dir is -1), settle back.
   * With a pose sheet she steps back on her still, lands in her STRIKE pose and
   * holds it a beat; without one, the still makes the same moves.
   */
  attack(dir = -1) {
    this.lunge(0, dir);
  }

  /** A strike toward a point on the field (nx, ny: a unit direction). */
  strike(nx: number, ny: number) {
    this.lunge(nx, ny);
  }

  private lunge(nx: number, ny: number) {
    if (this.dead) return;
    this.kill(this.pose);
    this.reset();
    const at = (n: number) => ({ x: Math.round(nx * this.px(n)), y: Math.round(ny * this.px(n)) });
    this.scene.tweens.chain({
      targets: this.pose,
      tweens: [
        // wind-up: a short step back on her still
        { ...at(-5), duration: 90, ...STEPS(2) },
        // the blow lands: her STRIKE pose, thrown forward
        { ...at(26), duration: 70, ...STEPS(2), onStart: () => this.act('attack', 'strike', 330) },
        // hold, a pixel of follow-through
        { ...at(22), duration: 150, ...STEPS(1) },
        // back to her place
        { x: 0, y: 0, duration: 180, ...STEPS(4) },
      ],
    });
  }

  /**
   * A ranged blow: her STRIKE pose (aimed, loosed) with a whole-pixel recoil
   * away from the target. Without a pose sheet, the old cast lift.
   */
  shoot(nx: number, ny: number, color: number) {
    if (this.dead) return;
    if (!this.hasPoses) return this.cast(color);
    this.kill(this.pose);
    this.reset();
    this.act('attack', 'strike', 460);
    const at = (n: number) => ({ x: Math.round(nx * this.px(n)), y: Math.round(ny * this.px(n)) });
    this.scene.tweens.chain({
      targets: this.pose,
      tweens: [
        { ...at(2), duration: 80, ...STEPS(1) },
        { ...at(-4), duration: 60, delay: 120, ...STEPS(2) },
        { x: 0, y: 0, duration: 200, ...STEPS(2) },
      ],
    });
  }

  /** A skill without a strike: her CAST pose (LITANY when big), a lift and a hard glow of the skill's colour. */
  cast(color: number, big = false) {
    if (this.dead) return;
    this.kill(this.pose, this.halo);
    this.reset();
    this.act(big ? 'litany' : 'skill', big ? 'litany' : 'cast', big ? 820 : 560);
    this.halo.setTintFill(color).setAlpha(0);
    this.scene.tweens.add({ targets: this.pose, y: -this.px(big ? 16 : 8), duration: 160, yoyo: true, hold: big ? 420 : 220, ...STEPS(big ? 4 : 2) });
    this.scene.tweens.add({ targets: this.halo, alpha: big ? 0.9 : 0.65, duration: 200, yoyo: true, hold: big ? 380 : 180, ...STEPS(3) });
  }

  /** A glow in a colour (healed, shielded). */
  pulse(color: number) {
    if (this.dead) return;
    this.kill(this.halo);
    this.halo.setTintFill(color).setAlpha(0);
    this.scene.tweens.add({ targets: this.halo, alpha: 0.55, duration: 180, yoyo: true, ...STEPS(3) });
  }

  /** Struck: her HURT pose, white flash then red, and a jolt away from the blow (down the screen when dir is 1). */
  hit(hurt: boolean, dir = 1) {
    if (this.dead) return;
    const shake = this.px(4) || 1;
    this.kill(this.pose);
    this.reset();
    this.scene.tweens.add({ targets: this.pose, x: { from: -shake, to: shake }, duration: 40, yoyo: true, repeat: 2, ...STEPS(1), onComplete: () => this.pose.setX(0) });
    if (!hurt) return;
    if (!this.sheet?.visible) this.showPose('hurt', 300);
    this.parts.forEach((p) => p.setTintFill(0xffffff));
    this.scene.tweens.add({ targets: this.pose, y: this.px(6) * dir, duration: 70, yoyo: true, ...STEPS(2) });
    this.scene.time.delayedCall(60, () => !this.dead && this.parts.forEach((p) => p.setTint(0xff6666)));
    this.scene.time.delayedCall(200, () => !this.dead && this.parts.forEach((p) => p.clearTint()));
  }

  /** Falls: her HURT pose goes grey, sinks in whole-pixel steps and crumbles into ash. Calls done when gone. */
  die(done?: () => void) {
    if (this.dead) return;
    this.dead = true;
    this.stopSheet();
    this.showPose('hurt');
    this.setActiveOff();
    const s = this.s;
    this.kill(this.pose, this.halo);
    this.reset();
    this.halo.setAlpha(0);
    this.parts.forEach((p) => p.setTintFill(0xffffff));
    this.scene.time.delayedCall(80, () => this.parts.forEach((p) => p.setTint(0x6a6070)));
    this.scene.tweens.chain({
      targets: this.pose,
      tweens: [
        { y: this.px(6), duration: 160, delay: 120, ...STEPS(2) },
        { y: this.px(14), alpha: 0, duration: 420, ...STEPS(4) },
      ],
      onComplete: () => done?.(),
    });
    // Ash rising off her
    const m = this.root.getWorldTransformMatrix();
    const ox = m.tx;
    const oy = m.ty;
    const top = this.height;
    for (let i = 0; i < 18; i++) {
      const px = Math.round(ox + Phaser.Math.Between(-34, 34) * s);
      const py = Math.round(oy - Phaser.Math.Between(10, top / s - 10) * s);
      const size = Math.max(2, Math.round((Math.random() < 0.3 ? 4 : 3) * s));
      const ash = this.scene.add.rectangle(px, py, size, size, Math.random() < 0.4 ? 0xd8c9a8 : 0x5c5262).setDepth(25).setAlpha(0);
      this.scene.tweens.add({
        targets: ash,
        alpha: { from: 0.95, to: 0 },
        y: py - Phaser.Math.Between(30, 80) * s,
        x: px + Phaser.Math.Between(-14, 14) * s,
        delay: 200 + Math.random() * 300,
        duration: 600 + Math.random() * 400,
        ...STEPS(6),
        onComplete: () => ash.destroy(),
      });
    }
  }

  private setActiveOff() {
    this.kill(this.stance, this.ring);
    this.active = false;
    this.stance.setY(0);
    this.ring.setAlpha(0);
  }

  /** Back on her feet (a revive, or a fight resumed). */
  revive() {
    this.dead = false;
    this.kill(this.pose);
    this.reset();
    this.pose.setAlpha(1);
    this.showStill();
    this.parts.forEach((p) => p.clearTint());
    this.ring.setAlpha(1).setStrokeStyle(2 * this.s, this.ringColor, 0.55);
  }

  /** A dark shape only (a Sister not yet sworn). */
  silhouette() {
    this.parts.forEach((p) => p.setTint(0x1a141e));
    this.ring.setAlpha(0.3);
  }

  private walking?: Phaser.Tweens.Tween;

  /** Turn to face right (1) or left (-1): the art is mirrored, the floor ring is not. */
  face(dir: 1 | -1) {
    this.pose.scaleX = dir;
    this.facing = dir;
  }
  private facing: 1 | -1 = 1;

  /** A marching bob while she moves across the field: whole-pixel hops, no tilt. */
  walk(on: boolean) {
    if (this.dead || on === !!this.walking) return;
    if (!on) {
      this.walking?.remove();
      this.walking = undefined;
      this.stance.setY(0).setAngle(0);
      return;
    }
    this.stance.setY(0).setAngle(0);
    this.walking = this.scene.tweens.add({ targets: this.stance, y: -(this.px(3) || 1), duration: 150, yoyo: true, repeat: -1, ...STEPS(2) });
  }

  /** Victory: her LITANY pose (or CAST) and a couple of small hops. */
  cheer(delay = 0) {
    if (this.dead) return;
    this.setActive(false);
    this.kill(this.pose);
    this.reset();
    this.scene.time.delayedCall(delay, () => !this.dead && this.showPose('litany', 900));
    this.scene.tweens.add({ targets: this.pose, y: -this.px(12), duration: 140, delay, yoyo: true, repeat: 1, ...STEPS(3) });
  }
}
