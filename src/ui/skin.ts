import Phaser from 'phaser';

/**
 * Optional UI skins. Drop a PNG named after a key below into src/assets/ui/ and
 * the matching piece of UI is drawn from it (as a 9-slice, so corners stay crisp
 * at any size) instead of the flat shapes drawn in code. Missing files, or the
 * canvas fallback renderer, keep the drawn look.
 *
 * Each entry is the corner size in source pixels: the part of each corner that
 * never stretches. Make art with corners at least that big.
 */
export const SKINS = {
  'ui-button': 16,
  'ui-button-pressed': 16,
  'ui-button-primary': 16,
  'ui-button-primary-pressed': 16,
  'ui-frame': 24,
  'ui-panel': 24,
  'ui-card': 12,
  'ui-chip': 10,
  'ui-badge': 6,
  'ui-tab-active': 16,
  'ui-subtab': 14,
  'ui-subtab-active': 14,
  'ui-skill': 16,
  'ui-skill-selected': 16,
  'ui-skill-rite': 16,
  'ui-unit-frame': 12,
  'ui-turn-frame': 8,
  'ui-bar-frame': 4,
  'ui-gear-slot': 14,
} as Record<string, number>;

export type SkinKey = string;

export function hasSkin(scene: Phaser.Scene, key: string) {
  return scene.textures.exists(key) && scene.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer;
}

/** A stretched 9-slice of `key` centred on (x, y), or null when the skin is not there. */
export function nine(scene: Phaser.Scene, key: SkinKey, x: number, y: number, w: number, h: number) {
  if (!hasSkin(scene, key)) return null;
  const src = scene.textures.get(key).getSourceImage();
  // corners can't be bigger than half the box or half the source image
  const c = Math.max(1, Math.floor(Math.min(SKINS[key] ?? 12, w / 2, h / 2, src.width / 2, src.height / 2)));
  return scene.add.nineslice(x, y, key, undefined, w, h, c, c, c, c);
}

/** A plain stretched image (bars and backgrounds that need no corners), or null. */
export function stretch(scene: Phaser.Scene, key: string, x: number, y: number, w: number, h: number) {
  if (!scene.textures.exists(key)) return null;
  return scene.add.image(x, y, key).setDisplaySize(w, h);
}

/**
 * A horizontal meter (HP, Zeal). Draws a dark track, a fill, and on top the
 * ui-bar-frame.png 9-slice when present. The fill uses `fillKey` (a small tile
 * stretched sideways, e.g. ui-bar-hp.png) when present, else a flat colour.
 * (left, y) is the left edge, vertically centred.
 */
export class Bar {
  readonly parts: Phaser.GameObjects.GameObject[] = [];
  private fill: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image;
  private skinned: boolean;

  constructor(
    scene: Phaser.Scene,
    left: number,
    y: number,
    private w: number,
    private h: number,
    fillKey: string,
    color: number,
    track = 0x1b151e,
  ) {
    this.parts.push(scene.add.rectangle(left, y, w, h, track).setOrigin(0, 0.5));
    this.skinned = scene.textures.exists(fillKey);
    this.fill = this.skinned
      ? scene.add.image(left, y, fillKey).setOrigin(0, 0.5).setDisplaySize(w, h)
      : scene.add.rectangle(left, y, w, h, color).setOrigin(0, 0.5);
    this.parts.push(this.fill);
    const frame = nine(scene, 'ui-bar-frame', left + w / 2, y, w + 4, h + 4);
    if (frame) this.parts.push(frame);
  }

  /** frac 0..1; colour only applies to the drawn (unskinned) fill. */
  set(frac: number, color?: number) {
    const width = Math.max(0, Math.min(1, frac)) * this.w;
    this.fill.setVisible(width > 0);
    if (this.fill instanceof Phaser.GameObjects.Rectangle) {
      this.fill.width = width;
      if (color !== undefined) this.fill.setFillStyle(color);
    } else if (width > 0) {
      this.fill.setDisplaySize(width, this.h);
    }
  }
}

/**
 * ui-vigil-candle.png is a horizontal strip of square-ish frames (full candle on
 * the left, snuffed on the right). Frame width = image height / 3, so a 96x48
 * strip of 16x48 frames gives 6. Adds numbered frames once; returns the count
 * (0 when the file is missing).
 */
export function candleFrames(scene: Phaser.Scene) {
  const key = 'ui-vigil-candle';
  if (!scene.textures.exists(key)) return 0;
  const tex = scene.textures.get(key);
  const img = tex.getSourceImage();
  const fw = Math.max(1, Math.round(img.height / 3));
  const n = Math.max(2, Math.floor(img.width / fw));
  if (!tex.has('0')) for (let i = 0; i < n; i++) tex.add(i, 0, i * fw, 0, fw, img.height);
  return n;
}
