import { describe, expect, it } from 'vitest';
import { resolveTrack, type LoopId } from './music';

describe('soundtrack', () => {
  it('every loop, including the round 9 tracks, plays its own file', () => {
    const loops: LoopId[] = ['sanctum', 'altar', 'crypt', 'battle', 'boss', 'armory', 'chapter', 'tower', 'deep-crypt', 'deep-battle', 'deep-boss', 'hunt', 'heretic'];
    for (const id of loops) expect(resolveTrack(id)).toBe(id);
  });
});
