import Phaser from 'phaser';
import { GAME_W, PAL } from '../config';
import type { SaveData } from '../state/save';
import { anyClaimable } from '../systems/tasks';
import { makeButton } from './button';
import { PAD } from './theme';

/**
 * The Rites: the Sanctum's grid of side modes (tasks, calendar, trials, tower...).
 * Each entry opens its scene; a gold dot marks one with something to claim.
 */
export interface RiteEntry {
  label: string;
  scene: string;
  icon: string;
  /** Something is waiting to be claimed. */
  ready?: (save: SaveData) => boolean;
}

export const RITES: RiteEntry[] = [{ label: 'Penance', scene: 'Penance', icon: 'book', ready: (s) => anyClaimable(s) }];

/** Draws the grid from `top`; returns its bottom edge. */
export function drawRites(scene: Phaser.Scene, save: SaveData, top: number): number {
  const cols = 3;
  const gap = 10;
  const w = (GAME_W - PAD * 2 - gap * (cols - 1)) / cols;
  const h = 58;
  RITES.forEach((r, i) => {
    const x = PAD + w / 2 + (i % cols) * (w + gap);
    const y = top + h / 2 + Math.floor(i / cols) * (h + gap);
    makeButton(scene, x, y, w, h, r.label, () => scene.scene.start(r.scene), { fontSize: 18, icon: r.icon });
    if (r.ready?.(save)) {
      scene.add.circle(x + w / 2 - 10, y - h / 2 + 10, 6, PAL.amber).setStrokeStyle(2, 0x1b121c);
    }
  });
  return top + Math.ceil(RITES.length / cols) * (h + gap) - gap;
}
