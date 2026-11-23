import Phaser from 'phaser';
import type { Status } from '../systems/combat';

/**
 * Hard-pixel helpers for the battle screen, all within the DOS Dungeon rule:
 * stepped edges, no gradients, no blur.
 *
 * - rimKey: a copy of a figure's texture with a 1-pixel coloured outline baked
 *   in (gold for Sisters, crimson for foes), frames kept, so sides read at a glance.
 * - pixelShadow: a stepped ellipse under the feet instead of a smooth one.
 * - ditherVignette: a Bayer-dithered darkening round the edges of the field.
 * - statusIcons: tiny pixel glyphs for what a unit is suffering or enjoying.
 */

export const RIM_PARTY = 0xd9b45a;
export const RIM_FOE = 0xa8242c;

const hex6 = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** The texture key of `key` with a 1-px `color` outline (made once, then reused). */
export function rimKey(scene: Phaser.Scene, key: string, color: number): string {
  const out = `rim-${color.toString(16)}-${key}`;
  if (scene.textures.exists(out)) return out;
  if (!scene.textures.exists(key)) return key;
  const tex = scene.textures.get(key);
  const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const w = src.width;
  const h = src.height;
  if (!w || !h) return key;
  // The outline: the art's silhouette stamped one pixel each way, filled with the colour.
  const mask = document.createElement('canvas');
  mask.width = w;
  mask.height = h;
  const m = mask.getContext('2d');
  if (!m) return key;
  m.imageSmoothingEnabled = false;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ])
    m.drawImage(src, dx, dy);
  m.globalCompositeOperation = 'source-in';
  m.fillStyle = hex6(color);
  m.fillRect(0, 0, w, h);
  // Hard edges only: any partly see-through outline pixel goes solid.
  const data = m.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 3; i < px.length; i += 4) px[i] = px[i] > 24 ? 255 : 0;
  m.putImageData(data, 0, 0);

  const canvasTex = scene.textures.createCanvas(out, w, h);
  if (!canvasTex) return key;
  const ctx = canvasTex.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mask, 0, 0);
  ctx.drawImage(src, 0, 0);
  // Keep the sheet's frames, so animations still play from the rimmed copy.
  for (const name of tex.getFrameNames()) {
    const f = tex.get(name);
    canvasTex.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight);
  }
  canvasTex.refresh();
  return out;
}

/** A stepped, solid ellipse texture for shadows under feet (made at half size, drawn at 2x). */
export function pixelShadowKey(scene: Phaser.Scene, w = 40, h = 8): string {
  const key = `px-shadow-${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return key;
  const ctx = tex.getContext();
  ctx.fillStyle = '#050306';
  for (let y = 0; y < h; y++) {
    const dy = (y + 0.5 - h / 2) / (h / 2);
    const half = Math.round((w / 2) * Math.sqrt(Math.max(0, 1 - dy * dy)));
    if (half > 0) ctx.fillRect(w / 2 - half, y, half * 2, 1);
  }
  tex.refresh();
  return key;
}

/** A hard pixel shadow image (scale it to taste; it stays stepped). */
export function pixelShadow(scene: Phaser.Scene, width: number, alpha = 0.6) {
  const img = scene.add.image(0, 0, pixelShadowKey(scene)).setAlpha(alpha);
  // Whole-number zoom so the steps stay square.
  const z = Math.max(1, Math.round(width / 40));
  return img.setScale(z);
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/**
 * A dithered vignette over a w x h box: solid near the rim, a 4x4 Bayer pattern
 * in between, clear in the middle. Made at half size and drawn at 2x, so each
 * dot is a chunky 2 x 2 pixel. `cy` (0..1) is where its middle sits.
 */
export function ditherVignette(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color = 0x09060b, cy = 0.55) {
  const tw = Math.ceil(w / 2);
  const th = Math.ceil(h / 2);
  const key = `px-vignette-${tw}x${th}-${color.toString(16)}-${cy}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, tw, th);
    if (tex) {
      const ctx = tex.getContext();
      const img = ctx.createImageData(tw, th);
      const r = (color >> 16) & 255;
      const g = (color >> 8) & 255;
      const b = color & 255;
      for (let py = 0; py < th; py++) {
        for (let px = 0; px < tw; px++) {
          const dx = (px - tw / 2) / (tw / 2);
          const dy = (py - th * cy) / (th * 0.62);
          const d = Math.sqrt(dx * dx * 0.9 + dy * dy);
          const t = Math.max(0, Math.min(1, (d - 0.5) / 0.55));
          let a = t * 16 > BAYER[py % 4][px % 4] ? 190 : 0;
          if (t > 0.96) a = 230;
          const i = (py * tw + px) * 4;
          img.data[i] = r;
          img.data[i + 1] = g;
          img.data[i + 2] = b;
          img.data[i + 3] = a;
        }
      }
      ctx.putImageData(img, 0, 0);
      tex.refresh();
    }
  }
  return scene.add.image(x, y, key).setScale(2);
}

// ---------- status glyphs ----------

/** 7 x 7 glyphs ('#' = colour, '.' = dark outline fill, ' ' = clear). */
const GLYPH: Record<string, string[]> = {
  flame: ['   #   ', '  ##   ', '  ###  ', ' ##### ', ' ## ## ', ' #   # ', '  ###  '],
  drop: ['   #   ', '   #   ', '  ###  ', ' ##### ', ' ##### ', ' ##### ', '  ###  '],
  star: ['   #   ', ' # # # ', '  ###  ', '#######', '  ###  ', ' # # # ', '   #   '],
  down: ['  ###  ', '  ###  ', '  ###  ', '#######', ' ##### ', '  ###  ', '   #   '],
  up: ['   #   ', '  ###  ', ' ##### ', '#######', '  ###  ', '  ###  ', '  ###  '],
  shield: ['#######', '#######', '#######', '#######', ' ##### ', '  ###  ', '   #   '],
  plus: ['  ###  ', '  ###  ', '#######', '#######', '#######', '  ###  ', '  ###  '],
  bang: ['  ###  ', '  ###  ', '  ###  ', '  ###  ', '       ', '  ###  ', '  ###  '],
  eye: ['       ', '  ###  ', ' #   # ', '#  #  #', ' #   # ', '  ###  ', '       '],
  spike: ['#  #  #', ' # # # ', '  ###  ', '#######', '  ###  ', ' # # # ', '#  #  #'],
};

interface StatusIcon {
  glyph: keyof typeof GLYPH;
  color: number;
}

/** Which statuses show, in what order, and how. */
export function statusIconsOf(s: Status): StatusIcon[] {
  const out: StatusIcon[] = [];
  if (s.stun) out.push({ glyph: 'star', color: 0xf2d27a });
  if (s.poison) out.push(s.poison.kind === 'burn' ? { glyph: 'flame', color: 0xff8a3a } : { glyph: 'drop', color: 0x8ad05a });
  if (s.bleed) out.push({ glyph: 'drop', color: 0xd0302a });
  if (s.hex) out.push({ glyph: 'down', color: 0xb08ae0 });
  if (s.sunder) out.push({ glyph: 'down', color: 0xb0b8c0 });
  if (s.weaken) out.push({ glyph: 'down', color: 0xff6a5a });
  if (s.accused || s.confessed || s.foretold) out.push({ glyph: 'eye', color: 0xe0c070 });
  if (s.taunt) out.push({ glyph: 'bang', color: 0xff5a3a });
  if (s.empower || s.critUp) out.push({ glyph: 'up', color: 0xffd75a });
  if (s.haste) out.push({ glyph: 'up', color: 0x8fd6e0 });
  if (s.ward) out.push({ glyph: 'shield', color: 0x8fb6d8 });
  if (s.regen) out.push({ glyph: 'plus', color: 0x9ad08a });
  if (s.thorns || s.counter) out.push({ glyph: 'spike', color: 0xc0a070 });
  return out;
}

/** Status words that the icon row now shows, so they need not float up as text too. */
export const ICONED_LABELS = new Set([
  'Weakened',
  'Stunned',
  'Warded',
  'Taunting',
  'Hasted',
  'Empowered',
  'Burning',
  'Poisoned',
  'Infected',
  'Hexed',
  'Sundered',
  'Bleeding',
  'Accused',
  'Regenerating',
  'Keen',
  'Thorned',
  'Confessed',
  'Foretold',
  'Charging',
]);

/** The texture of one status glyph: 9 x 9 with a dark border, drawn at 2x (18 px). */
export function statusIconKey(scene: Phaser.Scene, icon: StatusIcon): string {
  const key = `px-status-${icon.glyph}-${icon.color.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, 9, 9);
  if (!tex) return key;
  const ctx = tex.getContext();
  ctx.fillStyle = '#140c12';
  ctx.fillRect(0, 0, 9, 9);
  ctx.fillStyle = hex6(icon.color);
  GLYPH[icon.glyph].forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') ctx.fillRect(x + 1, y + 1, 1, 1);
  });
  tex.refresh();
  return key;
}
