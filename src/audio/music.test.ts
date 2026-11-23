import { describe, expect, it } from 'vitest';
import { resolveTrack } from './music';

describe('round 9 tracks', () => {
  it('borrow an older loop until their own file arrives', () => {
    expect(resolveTrack('sanctum')).toBe('sanctum');
    expect(resolveTrack('armory')).toBe('altar');
    expect(resolveTrack('tower')).toBe('sanctum');
    expect(resolveTrack('deep-battle')).toBe('battle');
    expect(resolveTrack('heretic')).toBe('boss');
  });
});
