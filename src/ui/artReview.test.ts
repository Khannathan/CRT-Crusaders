import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { captureFileName, captureLabel, edgeTouches, findSister, reviewRequest, stepId, type CaptureInfo } from './artReview';

describe('art review helpers', () => {
  it('reads the ?artreview switch', () => {
    expect(reviewRequest('')).toBeUndefined();
    expect(reviewRequest('?foo=1')).toBeUndefined();
    expect(reviewRequest('?artreview')).toBe('');
    expect(reviewRequest('?artreview=IV-LUR')).toBe('IV-LUR');
  });

  it('finds a Sister by id in any case, or by name', () => {
    const c = CRUSADERS[0];
    expect(findSister(CRUSADERS, c.id.toLowerCase())?.id).toBe(c.id);
    expect(findSister(CRUSADERS, c.id.replace(/-/g, ' '))?.id).toBe(c.id);
    expect(findSister(CRUSADERS, c.name)?.id).toBe(c.id);
    expect(findSister(CRUSADERS, c.name.split(' ')[0])?.id).toBe(c.id);
    expect(findSister(CRUSADERS, 'zzz-nobody')).toBeUndefined();
    expect(findSister(CRUSADERS, '  ')).toBeUndefined();
  });

  it('steps through ids and wraps', () => {
    expect(stepId(['a', 'b', 'c'], 'c', 1)).toBe('a');
    expect(stepId(['a', 'b', 'c'], 'a', -1)).toBe('c');
    expect(stepId(['a', 'b'], 'x', 1)).toBe('a');
  });

  it('spots art on a frame edge', () => {
    const w = 4;
    const h = 3;
    const px = new Uint8ClampedArray(w * h * 4);
    expect(edgeTouches(px, w, h)).toEqual([]);
    px[(1 * w + 1) * 4 + 3] = 255; // inside: fine
    expect(edgeTouches(px, w, h)).toEqual([]);
    px[(2 * w + 3) * 4 + 3] = 255; // right edge
    px[(0 * w + 2) * 4 + 3] = 255; // top edge
    expect(edgeTouches(px, w, h)).toEqual(['right', 'top']);
  });

  it('labels and names a capture so the artist knows the frame', () => {
    const info: CaptureInfo = { id: 'IV-LUR', name: 'Test Sister', screen: 'motion', motion: 'strike', frame: 3, frames: 6, flipped: true, crt: false, speed: 0.5, allies: true };
    expect(captureLabel(info)).toBe('IV-LUR · Test Sister · MOTION · strike frame 3/6 · facing left (flipped) · CRT off · speed 0.5x');
    expect(captureFileName(info, 'png')).toBe('IV-LUR_motion_strike_f3_flipped.png');
    expect(captureFileName({ ...info, screen: 'battle', frame: undefined, flipped: false }, 'webm', 'loop')).toBe('IV-LUR_battle_strike_loop.webm');
    expect(captureLabel({ ...info, screen: 'battle', frame: undefined, flipped: false, crt: true, speed: 1 })).toContain('with 3 allies · CRT on');
  });
});
