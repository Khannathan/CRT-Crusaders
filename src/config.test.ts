import { describe, expect, it } from 'vitest';
import { HP_EMPTY, HP_PARTY, PAL } from './config';

/** Relative luminance (WCAG) of a 0xRRGGBB colour. */
function lum(c: number) {
  const ch = [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
const contrast = (a: number, b: number) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

// The crypt backdrops are dimmed to about this dark brown behind the party.
const BACKDROP = 0x2a2420;

describe('party health bars stay readable', () => {
  it('fill stands out from the battle backdrop', () => {
    expect(contrast(HP_PARTY, BACKDROP)).toBeGreaterThanOrEqual(4);
  });
  it('fill stands out from the empty part', () => {
    expect(contrast(HP_PARTY, HP_EMPTY)).toBeGreaterThanOrEqual(3.5);
  });
  it('empty part is not the same as the panel colour', () => {
    expect(HP_EMPTY).not.toBe(PAL.deepShadow);
  });
});
