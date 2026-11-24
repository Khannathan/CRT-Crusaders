import { describe, expect, it, vi } from 'vitest';
import spriteSrc from './sisterSprite.ts?raw';

vi.mock('phaser', () => ({ default: {} }));
const { MINI_SCALE, shrinkPixels } = await import('./spriteAssets');

/** w x h RGBA pixels from a grid of colours (undefined = clear). */
function pixels(grid: (number[] | undefined)[][]) {
  const h = grid.length;
  const w = grid[0].length;
  const px = new Uint8ClampedArray(w * h * 4);
  grid.flat().forEach((c, i) => {
    if (c) px.set([...c, 255], i * 4);
  });
  return { w, h, px };
}

const RED = [200, 40, 40];
const GOLD = [240, 170, 50];
const INK = [20, 16, 24];

describe('shrinkPixels (Vigil minis)', () => {
  it('only ever uses her own colours, fully opaque or fully clear', () => {
    const { w, h, px } = pixels([
      [RED, GOLD, INK, INK, undefined, undefined],
      [GOLD, RED, INK, RED, undefined, undefined],
      [RED, RED, GOLD, GOLD, INK, undefined],
      [RED, RED, GOLD, GOLD, INK, INK],
    ]);
    const m = shrinkPixels(px, w, h, 0.5);
    expect([m.w, m.h]).toEqual([3, 2]);
    const own = new Set([RED, GOLD, INK].map((c) => c.join()));
    for (let i = 0; i < m.px.length; i += 4) {
      expect([0, 255]).toContain(m.px[i + 3]);
      if (m.px[i + 3]) expect(own.has([m.px[i], m.px[i + 1], m.px[i + 2]].join())).toBe(true);
    }
    // a solid block keeps its colour; an empty one stays clear
    expect([...m.px.slice(4 * 4, 4 * 4 + 4)]).toEqual([...GOLD, 255]);
    expect(m.px[2 * 4 + 3]).toBe(0);
  });

  it('makes a 128 x 192 still into a whole-pixel Vigil figure', () => {
    const { w, h, px } = pixels(Array.from({ length: 192 }, () => Array.from({ length: 128 }, () => RED)));
    const m = shrinkPixels(px, w, h, MINI_SCALE);
    expect([m.w, m.h]).toEqual([51, 77]);
  });
});

describe('SisterSprite motion', () => {
  it('never squashes, stretches or tilts the pixel art', () => {
    // the floor ring is a drawn ellipse, not her art, so it may pulse
    const src = spriteSrc
      .split('\n')
      .filter((l) => !l.includes('targets: this.ring'))
      .join('\n');
    expect(src).not.toMatch(/scaleY:\s*[\d.]+|angle:\s*[-\d{]/);
    expect(src).not.toMatch(/setScale\(s \* 1\.\d/);
  });
});
