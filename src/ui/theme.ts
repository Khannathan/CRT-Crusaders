import Phaser from 'phaser';
import { DISPLAY_FONT, FONT, GAME_W, HUD_FONT, PAL, hex } from '../config';
import { nine } from './skin';

/**
 * Shared look from the UI preview: gold-edged frames with corner ticks, painted
 * backdrops faded into the ink background, Cinzel headings and pixel labels.
 * Every art key here is a texture that can be replaced by dropping a file with
 * the same name into src/assets/ui/.
 */

export const PAD = 18;

/** Smallest an icon is drawn, in game pixels (about 14 dp on a phone). */
export const MIN_ICON = 18;

/** Text style helpers. */
export const text = {
  body: (size = 20, color: number = PAL.ivory): Phaser.Types.GameObjects.Text.TextStyle => ({
    fontFamily: FONT,
    fontSize: `${size}px`,
    color: hex(color),
  }),
  display: (size = 30, color: number = PAL.ivory): Phaser.Types.GameObjects.Text.TextStyle => ({
    fontFamily: DISPLAY_FONT,
    fontSize: `${size}px`,
    fontStyle: 'bold',
    color: hex(color),
  }),
  /** The pixel font looks best at multiples of its grid, so sizes are rounded. */
  hud: (size = 14, color: number = PAL.muted): Phaser.Types.GameObjects.Text.TextStyle => ({
    fontFamily: HUD_FONT,
    fontSize: `${size}px`,
    color: hex(color),
  }),
};

type Obj = Phaser.GameObjects.GameObject;

/**
 * A panel with the preview's frame: hairline gold edge, dark inset line and gold
 * corner ticks. (x, y) is the centre. Returns the parts so callers can layer them.
 */
export function addFrame(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fill?: number; fillAlpha?: number; edge?: number; ticks?: boolean; tick?: number } = {},
): Obj[] {
  // Skins: ui-panel.png for filled boxes (dialogs), ui-frame.png (clear centre) for frames over art.
  const skinned = nine(scene, opts.fill !== undefined ? 'ui-panel' : 'ui-frame', x, y, w, h);
  if (skinned) return [skinned];
  const parts: Obj[] = [];
  if (opts.fill !== undefined) parts.push(scene.add.rectangle(x, y, w, h, opts.fill, opts.fillAlpha ?? 1));
  parts.push(scene.add.rectangle(x, y, w, h).setStrokeStyle(1, opts.edge ?? PAL.goldEdge));
  parts.push(scene.add.rectangle(x, y, w - 4, h - 4).setStrokeStyle(2, PAL.bg, 0.9));
  if (opts.ticks !== false) parts.push(cornerTicks(scene, x, y, w - 10, h - 10, opts.tick ?? 13));
  return parts;
}

/**
 * A plain content panel (the dark boxes holding text and buttons). Skinned by
 * ui-panel.png when present. (x, y) is the top-left corner.
 */
export function addPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Obj {
  return (
    nine(scene, 'ui-panel', x + w / 2, y + h / 2, w, h) ??
    scene.add.rectangle(x + w / 2, y + h / 2, w, h, PAL.deepShadow).setStrokeStyle(1, PAL.armorShadow)
  );
}

/** The little gold L-shapes in each corner of the preview's frames. */
export function cornerTicks(scene: Phaser.Scene, x: number, y: number, w: number, h: number, len = 13, color: number = PAL.amber) {
  const g = scene.add.graphics();
  g.fillStyle(color);
  const l = x - w / 2;
  const t = y - h / 2;
  const r = x + w / 2;
  const b = y + h / 2;
  g.fillRect(l, t, len, 2).fillRect(l, t, 2, len);
  g.fillRect(r - len, t, len, 2).fillRect(r - 2, t, 2, len);
  g.fillRect(l, b - 2, len, 2).fillRect(l, b - len, 2, len);
  g.fillRect(r - len, b - 2, len, 2).fillRect(r - 2, b - len, 2, len);
  return g;
}

/**
 * Painted art cropped to fill a box (like CSS background-size: cover), then
 * faded toward the ink colour at the bottom so text on top stays readable.
 * Missing art is skipped, so screens still work without the file.
 */
export function addBackdrop(
  scene: Phaser.Scene,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { alpha?: number; focusY?: number; fade?: number; fadeColor?: number } = {},
): Obj[] {
  const parts: Obj[] = [];
  if (scene.textures.exists(key)) {
    const src = scene.textures.get(key).getSourceImage();
    const scale = Math.max(w / src.width, h / src.height);
    const img = scene.add.image(x, y, key).setScale(scale).setAlpha(opts.alpha ?? 1);
    // Crop to the box. focusY (0..1) picks which band of a tall crop to keep.
    const cw = w / scale;
    const ch = h / scale;
    const cx = (src.width - cw) / 2;
    const cy = (src.height - ch) * (opts.focusY ?? 0.5);
    img.setCrop(cx, cy, cw, ch);
    img.setPosition(x - (cx + cw / 2 - src.width / 2) * scale, y - (cy + ch / 2 - src.height / 2) * scale);
    parts.push(img);
  }
  parts.push(fade(scene, x, y, w, h, opts.fade ?? 0.6, opts.fadeColor ?? PAL.bg));
  return parts;
}

/** Vertical fade from transparent to `color`, covering the lower `amount` of a box. */
export function fade(scene: Phaser.Scene, x: number, y: number, w: number, h: number, amount: number, color: number = PAL.bg) {
  const g = scene.add.graphics();
  const top = y - h / 2;
  const start = top + h * (1 - amount);
  const steps = 24;
  const band = (h * amount) / steps;
  for (let i = 0; i < steps; i++) {
    const a = Math.pow((i + 1) / steps, 1.4) * 0.97;
    g.fillStyle(color, a).fillRect(x - w / 2, start + i * band, w, band + 1);
  }
  return g;
}

/** Page title in Cinzel with the preview's short gold underline. Returns the bottom y. */
export function addHeading(scene: Phaser.Scene, title: string, y: number, sub?: string) {
  const t = scene.add.text(PAD, y, title, text.display(34, PAL.ivory)).setOrigin(0, 0).setShadow(0, 2, '#000000', 10, false, true);
  const lineY = y + t.height + 6;
  if (scene.textures.exists('ui-divider')) {
    // ui-divider.png: the flourish under each screen title, drawn at its own size
    scene.add.image(PAD, lineY, 'ui-divider').setOrigin(0, 0.5);
  } else {
    const g = scene.add.graphics();
    for (let i = 0; i < 53; i++) g.fillStyle(PAL.goldEdge, 1 - i / 53).fillRect(PAD + i, lineY, 1, 1);
  }
  let bottom = lineY + 4;
  if (sub) {
    const s = scene.add.text(PAD, lineY + 10, sub, text.body(18, PAL.muted)).setWordWrapWidth(GAME_W - PAD * 2);
    bottom = lineY + 10 + s.height;
  }
  return bottom;
}

/**
 * A menu icon (ui-<name>.png). The preview's 12x12 white icons are tinted;
 * bigger, full-colour replacements (e.g. a 32x32 ui-tithe.png) are drawn as made.
 */
export function addIcon(scene: Phaser.Scene, x: number, y: number, name: string, size = 24, tint: number = PAL.amber) {
  size = Math.max(MIN_ICON, size);
  const key = `ui-${name}`;
  if (!scene.textures.exists(key)) return scene.add.rectangle(x, y, size * 0.6, size * 0.6, tint).setAngle(45);
  const img = scene.add.image(x, y, key).setDisplaySize(size, size);
  return isTintIcon(scene, key) ? img.setTint(tint) : img;
}

/** True for the small white icons that take a tint; false for full-colour art. */
export function isTintIcon(scene: Phaser.Scene, key: string) {
  return scene.textures.get(key).getSourceImage().width <= 12;
}

/** Art from src/assets/ui (skill-<id>, relic-<id>, class-<id>, ...) at a square size, or null when missing. */
export function addArt(scene: Phaser.Scene, key: string, x: number, y: number, size: number) {
  return scene.textures.exists(key) ? scene.add.image(x, y, key).setDisplaySize(size, size) : null;
}

/** Small pixel-font tag with a dark fill and a coloured edge, like the preview's rarity badges. */
export function addBadge(scene: Phaser.Scene, x: number, y: number, label: string, color: number, size = 14) {
  const t = scene.add.text(x + 6, y + 4, label, text.hud(size, color)).setOrigin(0, 0);
  const bw = t.width + 12;
  const bh = t.height + 8;
  // ui-badge.png is tinted with the rarity colour, so draw it in white/greys
  const box =
    nine(scene, 'ui-badge', x + bw / 2, y + bh / 2, bw, bh)?.setTint(color) ??
    scene.add.rectangle(x, y, bw, bh, 0x110b13, 0.92).setOrigin(0, 0).setStrokeStyle(1, color);
  scene.children.bringToTop(t);
  return [box, t] as const;
}

/** Screen background: ink with the preview's faint wine glow at the top. */
export function addScreenGlow(scene: Phaser.Scene) {
  scene.cameras.main.setBackgroundColor(PAL.bg);
  const g = scene.add.graphics();
  const steps = 18;
  for (let i = steps; i > 0; i--) {
    const r = i / steps;
    g.fillStyle(0x2c1b25, 0.09).fillEllipse(GAME_W * 0.53, -60, GAME_W * 1.9 * r, 900 * r);
  }
  return g;
}
