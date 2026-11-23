import Phaser from 'phaser';

/**
 * Optional UI skins. Drop a PNG named after a key below into src/assets/ui/ and
 * the matching piece of UI is drawn from it (as a 9-slice, so corners stay crisp
 * at any size) instead of the flat shapes drawn in code. Missing files, or the
 * canvas fallback renderer, keep the drawn look.
 *
 * Each entry is the corner size in source pixels: the part of each corner that
 * never stretches. Make art with corners at least that big. 0 means the art is
 * not sliced at all, just stretched to the box (the arched roster card).
 *
 * The pixel-art skins are stored at 2x their native grid, so one art pixel is
 * two screen pixels, like the backdrops. Ornaments in the middle of an edge
 * were cleaned off at import (tools/art-intake) so edges stretch.
 */
export const SKINS = {
  'ui-panel': 44,
  'ui-frame': 30,
  'ui-card': 0,
  'ui-unit-frame': 16,
  'ui-turn-frame': 20,
  'ui-gear-slot': 26,
  'ui-rite-tile': 22,
  'ui-button': 16,
  'ui-button-primary': 16,
  'ui-button-disabled': 16,
  'ui-button-pressed': 16,
  'ui-button-primary-pressed': 16,
  'ui-subtab': 12,
  'ui-subtab-active': 12,
  'ui-tab-active': 12,
  'ui-skill': 22,
  'ui-skill-selected': 22,
  'ui-skill-rite': 30,
  'ui-bar-frame': 4,
  'ui-bar-litany-frame': 6,
  'ui-bar-litany-frame-full': 6,
  'ui-bar-wrath-frame': 6,
  'ui-bar-wrath-frame-full': 6,
  'ui-skill-litany': 14,
  'ui-skill-litany-selected': 14,
  'ui-chip': 10,
  'ui-badge': 12,
} as Record<string, number>;

export type SkinKey = string;

export function hasSkin(scene: Phaser.Scene, key: string) {
  return scene.textures.exists(key) && scene.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer;
}

/** A stretched 9-slice of `key` centred on (x, y), or null when the skin is not there. */
export function nine(scene: Phaser.Scene, key: SkinKey, x: number, y: number, w: number, h: number) {
  if (!hasSkin(scene, key)) return null;
  const src = scene.textures.get(key).getSourceImage();
  if (SKINS[key] === 0) return scene.add.nineslice(x, y, key, undefined, w, h, 0, 0, 0, 0);
  // Thick-bordered skins are drawn at half scale, so their borders take 15-20 px instead of 30-40
  // and leave the text inside the box clear of the ornament.
  const k = EDGE_SCALE[key] ?? 1;
  // ui-panel's art has transparent margins round a thick border; drawing it a little outside the box
  // puts the border's inner edge about 10 px in, where the layouts expect it
  const out = OUTSET[key] ?? 0;
  const bw = (w + out * 2) / k;
  const bh = (h + out * 2) / k;
  // corners can't be bigger than half the box or half the source image
  const c = Math.max(1, Math.floor(Math.min(SKINS[key] ?? 12, bw / 2, bh / 2, src.width / 2, src.height / 2)));
  const ns = scene.add.nineslice(x, y, key, undefined, bw, bh, c, c, c, c);
  return k === 1 ? ns : ns.setScale(k);
}

/** Skins whose borders are drawn smaller than their source art (screen px per source px). */
const EDGE_SCALE: Record<string, number> = { 'ui-panel': 0.5, 'ui-frame': 0.5 };
/** Screen px a skin is drawn beyond each side of its box. */
const OUTSET: Record<string, number> = { 'ui-panel': 10 };

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
  private frame?: Phaser.GameObjects.NineSlice;

  constructor(
    scene: Phaser.Scene,
    left: number,
    y: number,
    private w: number,
    private h: number,
    fillKey: string,
    color: number,
    track = 0x1b151e,
    /** Its own frame art (e.g. ui-bar-litany-frame.png); falls back to ui-bar-frame. */
    frameKey = 'ui-bar-frame',
  ) {
    this.parts.push(scene.add.rectangle(left, y, w, h, track).setOrigin(0, 0.5));
    this.skinned = scene.textures.exists(fillKey);
    this.fill = this.skinned
      ? scene.add.image(left, y, fillKey).setOrigin(0, 0.5).setDisplaySize(w, h)
      : scene.add.rectangle(left, y, w, h, color).setOrigin(0, 0.5);
    this.parts.push(this.fill);
    const frame = nine(scene, scene.textures.exists(frameKey) ? frameKey : 'ui-bar-frame', left + w / 2, y, w + 4, h + 4);
    if (frame) {
      this.frame = frame as Phaser.GameObjects.NineSlice;
      this.parts.push(frame);
    }
  }

  /** Swaps the fill art (e.g. ui-bar-litany-full.png once a meter is full), when that file exists. */
  setFillKey(key: string) {
    if (this.fill instanceof Phaser.GameObjects.Image && this.fill.texture.key !== key && this.fill.scene.textures.exists(key)) {
      const { displayWidth, displayHeight } = this.fill;
      this.fill.setTexture(key).setDisplaySize(displayWidth, displayHeight);
    }
  }

  /** Swaps the frame art (e.g. to ui-bar-litany-frame-full.png), when that file exists. */
  setFrameKey(key: string) {
    if (this.frame && this.frame.texture.key !== key && this.frame.scene.textures.exists(key)) this.frame.setTexture(key);
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
 * ui-vigil-candle.png is a horizontal strip of 6 equal frames (full candle on
 * the left, snuffed on the right). Adds numbered frames once; returns the count
 * (0 when the file is missing).
 */
export const CANDLE_FRAMES = 6;

export function candleFrames(scene: Phaser.Scene) {
  const key = 'ui-vigil-candle';
  if (!scene.textures.exists(key)) return 0;
  const tex = scene.textures.get(key);
  const img = tex.getSourceImage();
  const n = CANDLE_FRAMES;
  const fw = Math.floor(img.width / n);
  if (!tex.has('0')) for (let i = 0; i < n; i++) tex.add(i, 0, i * fw, 0, fw, img.height);
  return n;
}
