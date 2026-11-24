import Phaser from 'phaser';

/**
 * Extra Sister sprite textures, all kept on whole pixels (DOS Dungeon rule):
 *
 * - Pose sheets (src/assets/poses/<id>.png, 256 x 384): four 128 x 192 poses,
 *   STRIKE, CAST, LITANY, HURT, drawn by ChatGPT beside her still and cut by
 *   tools/intake_poses.py. Loaded as a spritesheet, frames 0-3.
 * - Minis: her still shrunk once, here, by averaging blocks and snapping each
 *   pixel back to her own colours, so the small Vigil figures show a clean
 *   small sprite instead of nearest-neighbour dropping most of her rows.
 * - Glows: her silhouette grown a few pixels, white, so a coloured aura can be
 *   flashed round her with a tint instead of by scaling the art.
 */

const POSE_URLS = import.meta.glob<string>('../assets/poses/*.png', { eager: true, query: '?url', import: 'default' });

/** Frames in a pose sheet. */
export const POSE = { strike: 0, cast: 1, litany: 2, hurt: 3 } as const;
export type PoseName = keyof typeof POSE;

export const posesKey = (id: string) => `poses-${id}`;

export function poseSheetUrl(id: string): string | undefined {
  return POSE_URLS[`../assets/poses/${id}.png`];
}

/** Queues her pose sheet when she has one (BootScene, beside her still). */
export function queuePoses(load: Phaser.Loader.LoaderPlugin, id: string) {
  const url = poseSheetUrl(id);
  if (url) load.spritesheet(posesKey(id), url, { frameWidth: 128, frameHeight: 192 });
}

/** Vigil figures stand at this fraction of the 128 x 192 art. */
export const MINI_SCALE = 0.4;

function sourceOf(scene: Phaser.Scene, key: string) {
  if (!scene.textures.exists(key)) return undefined;
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  return src.width && src.height ? src : undefined;
}

function pixelsOf(src: HTMLImageElement | HTMLCanvasElement) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined;
  ctx.drawImage(src, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

/**
 * Shrinks RGBA pixels (w x h) by `k`: each output pixel averages its block (by
 * coverage), stays only when at least ~40% of the block is her, and takes the
 * nearest of her own colours. Pure, so it is tested without a browser.
 */
export function shrinkPixels(px: Uint8ClampedArray, w: number, h: number, k: number) {
  const ow = Math.max(1, Math.round(w * k));
  const oh = Math.max(1, Math.round(h * k));
  const palette: number[][] = [];
  const seen = new Set<number>();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const c = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
    if (!seen.has(c)) {
      seen.add(c);
      palette.push([px[i], px[i + 1], px[i + 2]]);
    }
  }
  const out = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    const y0 = (y * h) / oh;
    const y1 = ((y + 1) * h) / oh;
    for (let x = 0; x < ow; x++) {
      const x0 = (x * w) / ow;
      const x1 = ((x + 1) * w) / ow;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let area = 0;
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
          const wgt = wy * (Math.min(x1, sx + 1) - Math.max(x0, sx));
          const i = (sy * w + sx) * 4;
          const on = px[i + 3] >= 128 ? wgt : 0;
          r += px[i] * on;
          g += px[i + 1] * on;
          b += px[i + 2] * on;
          a += on;
          area += wgt;
        }
      }
      if (a < area * 0.42 || !palette.length) continue;
      r /= a;
      g /= a;
      b /= a;
      let best = palette[0];
      let bd = Infinity;
      for (const p of palette) {
        // weighted by how the eye reads brightness
        const d = 0.3 * (p[0] - r) ** 2 + 0.59 * (p[1] - g) ** 2 + 0.11 * (p[2] - b) ** 2;
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      const o = (y * ow + x) * 4;
      out[o] = best[0];
      out[o + 1] = best[1];
      out[o + 2] = best[2];
      out[o + 3] = 255;
    }
  }
  return { w: ow, h: oh, px: out };
}

/** Her still at MINI_SCALE as its own crisp texture (made once). Falls back to `key`. */
export function miniKey(scene: Phaser.Scene, key: string, k = MINI_SCALE): string {
  const out = `mini-${k}-${key}`;
  if (scene.textures.exists(out)) return out;
  const src = sourceOf(scene, key);
  const data = src && pixelsOf(src);
  if (!data) return key;
  const m = shrinkPixels(data.data, data.width, data.height, k);
  const tex = scene.textures.createCanvas(out, m.w, m.h);
  if (!tex) return key;
  const img = new ImageData(m.px, m.w, m.h);
  tex.getContext().putImageData(img, 0, 0);
  tex.refresh();
  return out;
}

/**
 * A white copy of the art's silhouette grown by `r` pixels in stepped rings
 * (frames kept). Tinted and flashed behind her for a glow that never scales.
 */
export function glowKey(scene: Phaser.Scene, key: string, r = 2): string {
  const out = `glow-${r}-${key}`;
  if (scene.textures.exists(out)) return out;
  const src = sourceOf(scene, key);
  const data = src && pixelsOf(src);
  if (!src || !data) return key;
  const { width: w, height: h } = data;
  let on = new Uint8Array(w * h);
  for (let i = 0; i < on.length; i++) on[i] = data.data[i * 4 + 3] >= 128 ? 1 : 0;
  for (let step = 0; step < r; step++) {
    const next = on.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (on[y * w + x]) continue;
        if ((x > 0 && on[y * w + x - 1]) || (x < w - 1 && on[y * w + x + 1]) || (y > 0 && on[(y - 1) * w + x]) || (y < h - 1 && on[(y + 1) * w + x])) next[y * w + x] = 1;
      }
    on = next;
  }
  const tex = scene.textures.createCanvas(out, w, h);
  if (!tex) return key;
  const img = new ImageData(w, h);
  for (let i = 0; i < on.length; i++) {
    if (!on[i]) continue;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = img.data[i * 4 + 3] = 255;
  }
  tex.getContext().putImageData(img, 0, 0);
  const base = scene.textures.get(key);
  for (const name of base.getFrameNames()) {
    const f = base.get(name);
    tex.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight);
  }
  tex.refresh();
  return out;
}
