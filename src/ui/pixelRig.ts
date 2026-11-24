import type Phaser from 'phaser';

/**
 * The pixel rig: a Sister's whole move set built in code from her one still
 * (src/assets/full-body/<id>.png, 128 x 192), so ChatGPT only has to paint one
 * figure per Sister and no pose sheets.
 *
 * Every frame is her still bent by a smooth displacement field laid on the
 * sprite box every Sister shares (sister-bible: crown ~row 17, shoulders ~56,
 * belt 100-104, soles on row 184, weapon in the hand on the viewer's left,
 * facing right):
 *
 * - lean: the upper body tips on the hips (crown moves most, hips not at all)
 * - rise: the body lifts or sinks; the soles never move
 * - bend: the knees push forward (the shins bow, the feet stay)
 * - arm / off: the weapon side (viewer's left) and the off-hand side (viewer's
 *   right) swing like an arm about its shoulder: the further down, the more it moves
 * - sway: hair, veil, cloak and loose cloth trail behind the motion
 * - stride: the legs scissor (running)
 *
 * Each output pixel is copied from one pixel of the still (nearest sample), so
 * a frame never gains a colour, never blurs and stays on the whole-pixel grid.
 * The frames go into one spritesheet texture per Sister (made once, on first
 * use) and SisterSprite plays them like drawn frames.
 */

/** The still's size. */
export const RIG_SRC_W = 128;
export const RIG_SRC_H = 192;
/** Extra columns each side of a rig frame, so a lean or a swing never clips. */
export const RIG_PAD_X = 16;
export const RIG_W = RIG_SRC_W + RIG_PAD_X * 2;
export const RIG_H = RIG_SRC_H;

// The shared sprite box (sister-bible sprite rules).
const CROWN = 17;
const SHOULDER = 56;
const HIP = 102;
const KNEE = 146;
const FEET = 184;
const MID = 64;
/** Half-width of her core (head, spine, belly): it never counts as arm or loose cloth. */
const CORE = 14;

export interface RigPose {
  lean?: number;
  rise?: number;
  bend?: number;
  arm?: [number, number];
  off?: [number, number];
  sway?: number;
  stride?: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

/**
 * Bends RGBA pixels of her still (w x h, normally 128 x 192) into one rig frame
 * (w + 2 * RIG_PAD_X wide). Pure, so it is tested without a browser.
 */
export function rigFrame(src: Uint8ClampedArray, w: number, h: number, p: RigPose): Uint8ClampedArray {
  const ow = w + RIG_PAD_X * 2;
  const out = new Uint8ClampedArray(ow * h * 4);
  const lean = p.lean ?? 0;
  const rise = p.rise ?? 0;
  const bend = p.bend ?? 0;
  const [ax, ay] = p.arm ?? [0, 0];
  const [fx, fy] = p.off ?? [0, 0];
  const sway = p.sway ?? 0;
  const stride = p.stride ?? 0;
  for (let y = 0; y < h; y++) {
    // How much of the upper-body motion this row takes: all of it above the hips, none at the soles.
    const up = y < HIP ? 1 : clamp01((FEET - y) / (FEET - HIP));
    const tip = y < HIP ? Math.pow((HIP - y) / (HIP - CROWN), 1.2) : 0;
    const knee = y > HIP && y <= FEET ? Math.sin((Math.PI * (y - HIP)) / (FEET - HIP)) : 0;
    const hang = clamp01((y - SHOULDER) / (FEET - SHOULDER));
    const shin = clamp01((y - KNEE) / (FEET - KNEE));
    const shinW = shin * (1 - shin) * 4;
    for (let ox = 0; ox < ow; ox++) {
      const x = ox - RIG_PAD_X;
      let dx = lean * tip + bend * knee;
      let dy = -rise * up;
      const side = x - MID;
      // Weapon side (viewer's left) and off-hand side, past her core, from the shoulders down.
      if (y > SHOULDER - 6) {
        const reach = smooth((-side - CORE) / 10) * smooth((y - (SHOULDER - 6)) / 10);
        if (reach > 0) {
          dx += ax * reach * (0.35 + 0.65 * hang);
          dy += ay * reach * (0.35 + 0.65 * hang);
        }
        const reachOff = smooth((side - CORE) / 10) * smooth((y - (SHOULDER - 6)) / 10);
        if (reachOff > 0) {
          dx += fx * reachOff * (0.35 + 0.65 * hang);
          dy += fy * reachOff * (0.35 + 0.65 * hang);
        }
      }
      // Loose hair and cloth outside her core trail behind: more the further it hangs.
      if (sway) {
        const loose = smooth((Math.abs(side) - CORE) / 12);
        dx += sway * loose * (y < SHOULDER ? 0.4 : Math.pow(hang, 1.5));
      }
      // Running: the legs scissor below the knee.
      if (stride && y > KNEE) dx += (side < 0 ? stride : -stride) * shinW;
      const sx = Math.round(x - dx);
      const sy = Math.round(y - dy);
      if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
      const i = (sy * w + sx) * 4;
      if (src[i + 3] < 128) continue;
      const o = (y * ow + ox) * 4;
      out[o] = src[i];
      out[o + 1] = src[i + 1];
      out[o + 2] = src[i + 2];
      out[o + 3] = 255;
    }
  }
  return out;
}

/**
 * Her move set, frame by frame (art pixels, facing right = toward the foe).
 * Timings are in RIG_CLIPS.
 */
export const RIG_POSES: Record<RigClip, RigPose[]> = {
  // Breathing: the chest lifts a pixel or two, loose hair and cloth drift.
  idle: [
    { rise: 0, sway: 0 },
    { rise: 0, sway: 0.6 },
    { rise: 1, sway: 1.2, arm: [0, -1] },
    { rise: 1, sway: 1.5, arm: [0, -1] },
    { rise: 2, sway: 1.2, arm: [0, -1] },
    { rise: 1, sway: 0.4 },
    { rise: 1, sway: -0.4 },
    { rise: 0, sway: -0.6 },
  ],
  // Wind-up (weapon drawn back and up), the blow, follow-through, settle.
  strike: [
    { lean: -3, rise: 1, arm: [-5, -8], sway: 1 },
    { lean: -5, rise: 2, arm: [-8, -14], sway: 2, bend: -1 },
    { lean: 6, rise: -1, arm: [12, -2], sway: -2, bend: 3 },
    { lean: 9, rise: -2, arm: [18, 6], sway: -4, bend: 4 },
    { lean: 7, rise: -2, arm: [14, 8], sway: -3, bend: 3 },
    { lean: 3, rise: -1, arm: [6, 3], sway: -1, bend: 1 },
  ],
  // The off hand thrust up and out at the foe, a lift.
  cast: [
    { lean: -1, rise: 1, off: [2, -4], sway: 1 },
    { lean: -2, rise: 3, off: [6, -10], sway: 2 },
    { lean: 1, rise: 4, off: [10, -14], arm: [0, -2], sway: -1 },
    { lean: 1, rise: 3, off: [9, -12], sway: -1 },
    { lean: 0, rise: 1, off: [4, -5] },
  ],
  // Her biggest pose: both arms raised high, chest up, cloth flaring.
  litany: [
    { lean: -2, rise: 2, arm: [-2, -4], off: [2, -4], sway: 1 },
    { lean: -4, rise: 5, arm: [-3, -9], off: [3, -9], sway: 2 },
    { lean: -5, rise: 8, arm: [-4, -13], off: [4, -13], sway: 3 },
    { lean: -5, rise: 8, arm: [-4, -13], off: [4, -13], sway: -3 },
    { lean: -3, rise: 5, arm: [-3, -8], off: [3, -8], sway: -2 },
    { lean: -1, rise: 2, arm: [-1, -3], off: [1, -3] },
  ],
  // Struck: she recoils back from the blow, knees give.
  hurt: [
    { lean: -7, rise: -2, bend: -2, arm: [-3, 2], off: [-3, 2], sway: 3 },
    { lean: -5, rise: -3, bend: -2, arm: [-2, 3], off: [-2, 3], sway: 2 },
    { lean: -2, rise: -1, bend: -1, sway: 1 },
  ],
  // Running: leaning in, bobbing, legs scissoring.
  run: [
    { lean: 3, rise: 0, stride: 3, sway: -2, arm: [3, 0], off: [-3, 0] },
    { lean: 3, rise: 2, stride: 0, sway: -3 },
    { lean: 3, rise: 0, stride: -3, sway: -2, arm: [-3, 0], off: [3, 0] },
    { lean: 3, rise: 2, stride: 0, sway: -3 },
  ],
};

export type RigClip = 'idle' | 'strike' | 'cast' | 'litany' | 'hurt' | 'run';

/** Frame order in the sheet, and how long each frame of a clip shows. */
export const RIG_CLIPS: Record<RigClip, { start: number; count: number; ms: number[] }> = (() => {
  const ms: Record<RigClip, number[]> = {
    idle: [180, 160, 160, 180, 220, 160, 160, 180],
    strike: [80, 110, 50, 60, 140, 140],
    cast: [80, 90, 260, 140, 120],
    litany: [90, 110, 420, 160, 130, 120],
    hurt: [90, 120, 140],
    run: [110, 110, 110, 110],
  };
  let start = 0;
  const out = {} as Record<RigClip, { start: number; count: number; ms: number[] }>;
  for (const k of Object.keys(RIG_POSES) as RigClip[]) {
    out[k] = { start, count: RIG_POSES[k].length, ms: ms[k] };
    start += RIG_POSES[k].length;
  }
  return out;
})();

export const RIG_FRAMES = Object.values(RIG_POSES).reduce((n, c) => n + c.length, 0);
const COLS = 8;

/** Every rig frame of a still, in RIG_CLIPS order. Pure. */
export function rigSheet(src: Uint8ClampedArray, w: number, h: number) {
  return (Object.keys(RIG_POSES) as RigClip[]).flatMap((k) => RIG_POSES[k].map((p) => rigFrame(src, w, h, p)));
}

/**
 * Her rig spritesheet texture, made once from `key` (her still, rimmed or not):
 * frames named 0..RIG_FRAMES-1, each RIG_W x RIG_H. Returns undefined when the
 * still isn't loaded or isn't 128 x 192 (a stand-in of another size, a mini).
 */
export function rigKey(scene: Phaser.Scene, key: string): string | undefined {
  const out = `rig-${key}`;
  if (scene.textures.exists(out)) return out;
  if (!scene.textures.exists(key)) return undefined;
  const img = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  if (img.width !== RIG_SRC_W || img.height !== RIG_SRC_H) return undefined;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const frames = rigSheet(data.data, c.width, c.height);
  const rows = Math.ceil(frames.length / COLS);
  const tex = scene.textures.createCanvas(out, RIG_W * COLS, RIG_H * rows);
  if (!tex) return undefined;
  const tctx = tex.getContext();
  frames.forEach((f, i) => {
    const x = (i % COLS) * RIG_W;
    const y = Math.floor(i / COLS) * RIG_H;
    tctx.putImageData(new ImageData(new Uint8ClampedArray(f), RIG_W, RIG_H), x, y);
    tex.add(i, 0, x, y, RIG_W, RIG_H);
  });
  tex.refresh();
  return out;
}
