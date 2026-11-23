import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { CRUSADERS } from '../data/crusaders';
import { ENEMIES } from '../data/enemies';
import { STORY } from '../data/story';
import { TOTAL_STAGES } from './campaign';
import { chronicle, markSeen, pendingAfter, pendingBefore } from './story';

describe('the Pilgrim\'s Road story', () => {
  it('every scene sits on a real stage and every speaker exists', () => {
    expect(new Set(STORY.map((s) => s.id)).size).toBe(STORY.length);
    for (const s of STORY) {
      expect(s.stage).toBeGreaterThanOrEqual(1);
      expect(s.stage).toBeLessThanOrEqual(TOTAL_STAGES);
      for (const l of s.lines) {
        if (l.who === 'narrator') continue;
        if (l.who.startsWith('foe:')) expect(ENEMIES[l.who.slice(4)], l.who).toBeDefined();
        else expect(CRUSADERS.some((c) => c.id === l.who && !c.limited), l.who).toBe(true);
      }
    }
  });

  it('a scene plays once, then the Chronicle keeps it', () => {
    const save = newSave();
    expect(pendingBefore(save, 1)?.id).toBe('c1-open');
    expect(pendingBefore(save, 2)).toBeUndefined();
    markSeen(save, 'c1-open');
    expect(pendingBefore(save, 1)).toBeUndefined();
    expect(pendingAfter(save, 10)?.id).toBe('c1-close');
    expect(chronicle(save, 0).map((s) => s.id)).toEqual(['c1-open']);
    expect(chronicle(save, 10).length).toBe(4);
  });
});
