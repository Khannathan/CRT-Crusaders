import { describe, expect, it } from 'vitest';
import { RIG_CLIPS, RIG_FRAMES, RIG_PAD_X, RIG_POSES, RIG_W, rigFrame, rigSheet } from './pixelRig';

const W = 128;
const H = 192;

/** A test figure: a column of body from row 17 to the soles on row 184, a weapon bar on the left, a few colours. */
function figure() {
  const px = new Uint8ClampedArray(W * H * 4);
  const put = (x: number, y: number, c: [number, number, number]) => {
    const i = (y * W + x) * 4;
    px.set([...c, 255], i);
  };
  for (let y = 17; y <= 184; y++) for (let x = 50; x < 78; x++) put(x, y, y < 42 ? [200, 160, 140] : x % 3 ? [60, 40, 70] : [140, 30, 40]);
  for (let y = 60; y < 170; y++) for (let x = 20; x < 30; x++) put(x, y, [180, 180, 190]);
  return px;
}

const colours = (px: Uint8ClampedArray) => {
  const s = new Set<number>();
  for (let i = 0; i < px.length; i += 4) if (px[i + 3]) s.add((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
  return s;
};

const lowestRow = (px: Uint8ClampedArray, w: number) => {
  for (let y = H - 1; y >= 0; y--) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3]) return y;
  return -1;
};

describe('pixel rig', () => {
  const src = figure();

  it('the rest pose is her still, padded each side', () => {
    const f = rigFrame(src, W, H, {});
    let diff = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        for (let c = 0; c < 4; c++) if (f[(y * RIG_W + x + RIG_PAD_X) * 4 + c] !== src[(y * W + x) * 4 + c]) diff++;
    expect(diff).toBe(0);
  });

  it('never adds a colour or a soft pixel, and her soles stay on row 184', () => {
    const base = colours(src);
    for (const f of rigSheet(src, W, H)) {
      expect([...colours(f)].every((c) => base.has(c))).toBe(true);
      let soft = 0;
      for (let i = 3; i < f.length; i += 4) if (f[i] !== 0 && f[i] !== 255) soft++;
      expect(soft).toBe(0);
      expect(lowestRow(f, RIG_W)).toBe(184);
    }
  });

  it('clips are laid out back to back', () => {
    let n = 0;
    for (const [k, c] of Object.entries(RIG_CLIPS)) {
      expect(c.start).toBe(n);
      expect(c.count).toBe(RIG_POSES[k as keyof typeof RIG_POSES].length);
      expect(c.ms.length).toBe(c.count);
      n += c.count;
    }
    expect(n).toBe(RIG_FRAMES);
  });

  it('the strike throws her weapon side toward the foe', () => {
    const peak = rigFrame(src, W, H, RIG_POSES.strike[3]);
    // The weapon bar (x 20-29 in the still) has moved right near the bottom of its reach.
    const row = 160;
    let first = -1;
    for (let x = 0; x < RIG_W; x++)
      if (peak[(row * RIG_W + x) * 4] === 180) {
        first = x - RIG_PAD_X;
        break;
      }
    expect(first).toBeGreaterThan(30);
  });
});
