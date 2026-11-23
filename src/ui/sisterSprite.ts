import Phaser from 'phaser';

/**
 * A Sister's full-body pixel figure, brought to life with sprite-style motion
 * built from her one still image (src/assets/full-body/<id>.png, 128 x 192):
 *
 * - idle: her upper body sinks a pixel or two over her planted legs (breathing),
 *   in whole-pixel steps so the pixel art stays crisp
 * - attack: wind-up squash, a lunge toward the foe, a settle back
 * - cast: she rises with a coloured halo of her own silhouette
 * - hit: white flash, red tint, a jolt back
 * - death: grey, she buckles and crumbles into rising ash
 * - active: she steps forward on a brightened floor ring
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

export const fullKey = (id: string) => `full-${id}`;

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

  constructor(
    private scene: Phaser.Scene,
    id: string,
    x: number,
    y: number,
    /** Whole-number scales keep the pixels square; 1 = 128 x 192. */
    private s = 1,
    ringColor = 0x8a7a66,
  ) {
    const key = fullKey(id);
    this.ringColor = ringColor;
    const shadow = scene.add.ellipse(0, 0, 80 * s, 14 * s, 0x000000, 0.55);
    this.ring = scene.add.ellipse(0, 0, 100 * s, 22 * s).setStrokeStyle(2 * s, ringColor, 0.55);
    const img = () => scene.add.image(0, FOOT_PAD * s, key).setOrigin(0.5, 1).setScale(s);
    this.halo = img().setTintFill(0xffffff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(s * 1.06);
    this.legs = img().setCrop(0, WAIST, FIGURE_W, FIGURE_H - WAIST);
    this.upper = img().setCrop(0, 0, FIGURE_W, WAIST);
    this.pose = scene.add.container(0, 0, [this.halo, this.legs, this.upper]);
    this.stance = scene.add.container(0, 0, [this.ring, shadow, this.pose]);
    this.root = scene.add.container(x, y, [this.stance]);
    // Each figure breathes on her own beat.
    this.beat = Phaser.Math.Between(0, BREATH.length - 1);
    this.breath = scene.time.addEvent({ delay: BEAT_MS + Phaser.Math.Between(-15, 25), loop: true, callback: () => this.breathe() });
    this.root.once(Phaser.GameObjects.Events.DESTROY, () => this.breath?.remove());
  }

  /** Height of the figure on screen, feet to crown. */
  get height() {
    return (FIGURE_H - FOOT_PAD - 16) * this.s;
  }

  private breathe() {
    if (this.dead) return;
    this.beat = (this.beat + 1) % BREATH.length;
    this.upper.y = (FOOT_PAD + BREATH[this.beat]) * this.s;
  }

  private kill(...targets: object[]) {
    for (const t of targets) this.scene.tweens.killTweensOf(t);
  }

  /** Her turn: she steps forward and her floor ring brightens. */
  setActive(on: boolean) {
    if (on === this.active || this.dead) return;
    this.active = on;
    this.kill(this.stance, this.ring);
    this.scene.tweens.add({ targets: this.stance, y: on ? -8 * this.s : 0, duration: 180, ease: 'Quad.out' });
    this.ring.setStrokeStyle(2 * this.s, on ? 0xf2e6c9 : this.ringColor, on ? 1 : 0.55).setScale(1).setAlpha(1);
    if (on) this.scene.tweens.add({ targets: this.ring, scaleX: 1.12, scaleY: 1.12, alpha: 0.6, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  /** Wind-up, lunge toward the foe (up the screen when dir is -1), settle back. */
  attack(dir = -1) {
    if (this.dead) return;
    this.kill(this.pose);
    const s = this.s;
    this.pose.setPosition(0, 0).setScale(this.facing, 1).setAngle(0);
    this.scene.tweens.chain({
      targets: this.pose,
      tweens: [
        { scaleX: 1.08 * this.facing, scaleY: 0.9, y: 4 * s * -dir, duration: 90, ease: 'Quad.out' },
        { scaleX: 0.94 * this.facing, scaleY: 1.08, y: 30 * s * dir, angle: 4, duration: 80, ease: 'Quad.in' },
        { scaleX: this.facing, scaleY: 1, y: 22 * s * dir, angle: 0, duration: 70 },
        { y: 0, duration: 180, ease: 'Quad.out' },
      ],
    });
  }

  /** A skill without a strike: she rises, wreathed in a halo of the skill's colour. */
  cast(color: number, big = false) {
    if (this.dead) return;
    this.kill(this.pose, this.halo);
    const s = this.s;
    this.pose.setPosition(0, 0).setScale(this.facing, 1).setAngle(0);
    this.halo.setTintFill(color).setAlpha(0).setScale(s * 1.04);
    this.scene.tweens.add({ targets: this.pose, y: (big ? -16 : -9) * s, duration: 160, yoyo: true, hold: big ? 420 : 220, ease: 'Quad.out' });
    this.scene.tweens.add({ targets: this.halo, alpha: big ? 0.9 : 0.65, scale: s * (big ? 1.16 : 1.1), duration: 200, yoyo: true, hold: big ? 380 : 180 });
  }

  /** A soft glow in a colour (healed, shielded). */
  pulse(color: number) {
    if (this.dead) return;
    this.kill(this.halo);
    this.halo.setTintFill(color).setAlpha(0).setScale(this.s * 1.04);
    this.scene.tweens.add({ targets: this.halo, alpha: 0.5, scale: this.s * 1.1, duration: 180, yoyo: true });
  }

  /** Struck: white flash then red, and a jolt away from the blow (down the screen when dir is 1). */
  hit(hurt: boolean, dir = 1) {
    if (this.dead) return;
    const s = this.s;
    const parts = [this.upper, this.legs];
    this.kill(this.pose);
    this.pose.setScale(this.facing, 1).setAngle(0).setY(0);
    this.scene.tweens.add({ targets: this.pose, x: { from: -5 * s, to: 5 * s }, duration: 40, yoyo: true, repeat: 2, onComplete: () => this.pose.setX(0) });
    if (!hurt) return;
    parts.forEach((p) => p.setTintFill(0xffffff));
    this.scene.tweens.add({ targets: this.pose, y: 6 * s * dir, angle: -3 * dir, duration: 70, yoyo: true, ease: 'Quad.out' });
    this.scene.time.delayedCall(60, () => !this.dead && parts.forEach((p) => p.setTint(0xff6666)));
    this.scene.time.delayedCall(200, () => !this.dead && parts.forEach((p) => p.clearTint()));
  }

  /** Falls: grey, buckles at the knees, crumbles into ash. Calls done when gone. */
  die(done?: () => void) {
    if (this.dead) return;
    this.dead = true;
    this.setActiveOff();
    const s = this.s;
    const parts = [this.upper, this.legs];
    this.kill(this.pose, this.halo);
    this.halo.setAlpha(0);
    parts.forEach((p) => p.setTintFill(0xffffff));
    this.scene.time.delayedCall(80, () => parts.forEach((p) => p.setTint(0x6a6070)));
    this.scene.tweens.chain({
      targets: this.pose,
      tweens: [
        { scaleY: 0.92, y: 6 * s, duration: 160, delay: 120, ease: 'Quad.out' },
        { scaleY: 0.35, scaleX: 1.12 * this.facing, alpha: 0, duration: 420, ease: 'Quad.in' },
      ],
      onComplete: () => done?.(),
    });
    // Ash rising off her
    const m = this.root.getWorldTransformMatrix();
    const ox = m.tx;
    const oy = m.ty;
    const top = this.height;
    for (let i = 0; i < 18; i++) {
      const px = ox + Phaser.Math.Between(-34, 34) * s;
      const py = oy - Phaser.Math.Between(10, top / s - 10) * s;
      const size = (Math.random() < 0.3 ? 4 : 3) * s;
      const ash = this.scene.add.rectangle(px, py, size, size, Math.random() < 0.4 ? 0xd8c9a8 : 0x5c5262).setDepth(25).setAlpha(0);
      this.scene.tweens.add({
        targets: ash,
        alpha: { from: 0.95, to: 0 },
        y: py - Phaser.Math.Between(30, 80) * s,
        x: px + Phaser.Math.Between(-14, 14) * s,
        delay: 200 + Math.random() * 300,
        duration: 600 + Math.random() * 400,
        ease: 'Quad.out',
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
    this.pose.setPosition(0, 0).setScale(this.facing, 1).setAngle(0).setAlpha(1);
    this.upper.clearTint();
    this.legs.clearTint();
    this.ring.setAlpha(1).setStrokeStyle(2 * this.s, this.ringColor, 0.55);
  }

  /** A dark shape only (a Sister not yet sworn). */
  silhouette() {
    this.upper.setTint(0x1a141e);
    this.legs.setTint(0x1a141e);
    this.ring.setAlpha(0.3);
  }

  private walking?: Phaser.Tweens.Tween;

  /** Turn to face right (1) or left (-1): the art is mirrored, the floor ring is not. */
  face(dir: 1 | -1) {
    this.pose.scaleX = Math.abs(this.pose.scaleX || 1) * dir;
    this.facing = dir;
  }
  private facing: 1 | -1 = 1;

  /** A marching bob while she moves across the field. */
  walk(on: boolean) {
    if (this.dead || on === !!this.walking) return;
    if (!on) {
      this.walking?.remove();
      this.walking = undefined;
      this.stance.setY(0).setAngle(0);
      return;
    }
    this.stance.setY(0);
    this.walking = this.scene.tweens.add({ targets: this.stance, y: -3 * this.s, angle: { from: -2, to: 2 }, duration: 150, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  /** A strike toward a point on the field (nx, ny: a unit direction). */
  strike(nx: number, ny: number) {
    if (this.dead) return;
    this.kill(this.pose);
    const s = this.s;
    const f = this.facing;
    this.pose.setPosition(0, 0).setScale(f, 1).setAngle(0);
    this.scene.tweens.chain({
      targets: this.pose,
      tweens: [
        { x: -nx * 5 * s, y: -ny * 5 * s, scaleX: 1.08 * f, scaleY: 0.9, duration: 90, ease: 'Quad.out' },
        { x: nx * 26 * s, y: ny * 26 * s, scaleX: 0.94 * f, scaleY: 1.08, angle: 6 * f, duration: 80, ease: 'Quad.in' },
        { x: nx * 18 * s, y: ny * 18 * s, scaleX: f, scaleY: 1, angle: 0, duration: 70 },
        { x: 0, y: 0, duration: 180, ease: 'Quad.out' },
      ],
    });
  }

  /** Victory: a couple of small hops. */
  cheer(delay = 0) {
    if (this.dead) return;
    this.setActive(false);
    this.kill(this.pose);
    this.scene.tweens.add({ targets: this.pose, y: -12 * this.s, duration: 140, delay, yoyo: true, repeat: 1, ease: 'Quad.out' });
  }
}
