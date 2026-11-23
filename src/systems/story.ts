import type { SaveData } from '../state/save';
import { STORY, sceneAfter, sceneBefore, type StoryScene } from '../data/story';

/** Which story scenes have played (systems/story.ts, data/story.ts). */
export interface StoryState {
  seen: string[];
}

export const storyOf = (save: SaveData): StoryState => (save.story ??= { seen: [] });
export const seenScene = (save: SaveData, id: string) => storyOf(save).seen.includes(id);

export function markSeen(save: SaveData, id: string) {
  const st = storyOf(save);
  if (!st.seen.includes(id)) st.seen.push(id);
}

/** The unseen scene to play before fighting stage n, if any. */
export function pendingBefore(save: SaveData, n: number): StoryScene | undefined {
  const s = sceneBefore(n);
  return s && !seenScene(save, s.id) ? s : undefined;
}

/** The unseen scene to play after first winning stage n, if any. */
export function pendingAfter(save: SaveData, n: number): StoryScene | undefined {
  const s = sceneAfter(n);
  return s && !seenScene(save, s.id) ? s : undefined;
}

/** Scenes the Chronicle can replay: seen ones, plus any whose stage is already behind the player. */
export function chronicle(save: SaveData, best: number): StoryScene[] {
  return STORY.filter((s) => seenScene(save, s.id) || s.stage <= best);
}
