import type { CrusaderDef } from '../data/types';

/**
 * Pure helpers for the dev art review viewer (scenes/ArtReviewScene.ts), kept
 * apart from Phaser so they are tested without a browser.
 */

/** The screens the viewer can show a Sister in. */
export const REVIEW_SCREENS = ['motion', 'battle', 'roster', 'sanctum', 'altar', 'bust'] as const;
export type ReviewScreen = (typeof REVIEW_SCREENS)[number];

/** The URL switch that opens the viewer: ?artreview (or ?artreview=IV-LUR to open on her). */
export const REVIEW_PARAM = 'artreview';

/**
 * What the page URL asks for: undefined when the viewer is not asked for,
 * '' when it is asked for with no Sister, else the id or name typed after =.
 */
export function reviewRequest(search: string): string | undefined {
  const p = new URLSearchParams(search);
  if (!p.has(REVIEW_PARAM)) return undefined;
  return (p.get(REVIEW_PARAM) ?? '').trim();
}

/**
 * Finds a Sister from what was typed: her roster id (any case, spaces or
 * underscores for dashes), else her full or first name, else the first id or
 * name that starts with it.
 */
export function findSister(list: CrusaderDef[], typed: string): CrusaderDef | undefined {
  const q = typed.trim().toUpperCase().replace(/[\s_]+/g, '-');
  if (!q) return undefined;
  const name = typed.trim().toLowerCase();
  return (
    list.find((c) => c.id.toUpperCase() === q) ??
    list.find((c) => c.name.toLowerCase() === name) ??
    list.find((c) => c.name.split(' ')[0].toLowerCase() === name) ??
    list.find((c) => c.id.toUpperCase().startsWith(q)) ??
    list.find((c) => c.name.toLowerCase().startsWith(name))
  );
}

/** One step through a list of ids, wrapping at both ends. */
export function stepId(ids: string[], id: string, d: number): string {
  if (!ids.length) return id;
  const i = ids.indexOf(id);
  if (i < 0) return ids[0];
  return ids[(i + d + ids.length * 4) % ids.length];
}

/**
 * Which edges of an RGBA frame (w x h) have an opaque pixel on them: art
 * touching the frame's edge has most likely been cut off there.
 */
export function edgeTouches(px: Uint8ClampedArray, w: number, h: number): ('left' | 'right' | 'top')[] {
  const on = (x: number, y: number) => px[(y * w + x) * 4 + 3] >= 128;
  const out: ('left' | 'right' | 'top')[] = [];
  let l = false;
  let r = false;
  for (let y = 0; y < h && !(l && r); y++) {
    l ||= on(0, y);
    r ||= on(w - 1, y);
  }
  let t = false;
  for (let x = 0; x < w && !t; x++) t = on(x, 0);
  if (l) out.push('left');
  if (r) out.push('right');
  if (t) out.push('top');
  return out;
}

/** What a capture shows, for its label strip and file name. */
export interface CaptureInfo {
  id: string;
  name: string;
  screen: ReviewScreen;
  /** The motion on show (idle, strike, ...). */
  motion: string;
  /** 1-based frame number, when one frame is pinned (the Motion screen). */
  frame?: number;
  frames?: number;
  flipped: boolean;
  crt: boolean;
  speed: number;
  allies: boolean;
}

/** The line printed across the top of a capture, so the artist knows exactly what they are looking at. */
export function captureLabel(c: CaptureInfo, kind: 'still' | 'sheet' | 'loop' = 'still'): string {
  const parts = [c.id, c.name, c.screen.toUpperCase(), c.motion + (c.frame && kind === 'still' ? ` frame ${c.frame}/${c.frames}` : '')];
  parts.push(c.flipped ? 'facing left (flipped)' : 'facing right');
  if (c.allies && c.screen !== 'motion' && c.screen !== 'bust') parts.push('with 3 allies');
  parts.push(`CRT ${c.crt ? 'on' : 'off'}`);
  if (c.speed !== 1) parts.push(`speed ${c.speed}x`);
  if (kind === 'sheet') parts.push('frame sheet');
  if (kind === 'loop') parts.push('loop');
  return parts.join(' · ');
}

/** A file name safe on every phone: IV-LUR_battle_strike_f3.png */
export function captureFileName(c: CaptureInfo, ext: 'png' | 'webm', kind: 'still' | 'sheet' | 'loop' = 'still'): string {
  const bits = [c.id, c.screen, c.motion];
  if (kind === 'still' && c.frame) bits.push(`f${c.frame}`);
  if (kind !== 'still') bits.push(kind);
  if (c.flipped) bits.push('flipped');
  return `${bits.join('_').replace(/[^A-Za-z0-9_-]+/g, '-')}.${ext}`;
}
