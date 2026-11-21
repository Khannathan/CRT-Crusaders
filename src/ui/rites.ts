import Phaser from 'phaser';
import { GAME_W, PAL } from '../config';
import type { SaveData } from '../state/save';
import { matinsReady } from '../systems/matins';
import { ROMAN_RANK, unlocked } from '../systems/rank';
import { anyClaimable } from '../systems/tasks';
import { entriesLeft } from '../systems/trials';
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
  /** Rank of Faith needed (see UNLOCKS in rank.ts). */
  rank: number;
  /** Something is waiting to be claimed. */
  ready?: (save: SaveData) => boolean;
}

export const RITES: RiteEntry[] = [
  { label: 'Matins', scene: 'Matins', icon: 'flame', rank: 1, ready: (s) => matinsReady(s) },
  { label: 'Penance', scene: 'Penance', icon: 'book', rank: 2, ready: (s) => anyClaimable(s) },
  { label: 'Trials', scene: 'Trials', icon: 'shield', rank: 3, ready: (s) => entriesLeft(s) > 0 },
  { label: 'Bell Tower', scene: 'Tower', icon: 'sanctum', rank: 6 },
  { label: 'Inquisition', scene: 'Inquisition', icon: 'blade', rank: 8 },
];

/** Draws the grid from `top`; returns its bottom edge. */
export function drawRites(scene: Phaser.Scene, save: SaveData, top: number): number {
  const cols = 3;
  const gap = 10;
  const w = (GAME_W - PAD * 2 - gap * (cols - 1)) / cols;
  const h = 58;
  RITES.forEach((r, i) => {
    const x = PAD + w / 2 + (i % cols) * (w + gap);
    const y = top + h / 2 + Math.floor(i / cols) * (h + gap);
    if (!unlocked(save, r.rank)) {
      makeButton(scene, x, y, w, h, `${r.label}\nRANK ${ROMAN_RANK(r.rank)}`, () => scene.scene.start('Rank'), { fontSize: 17, icon: 'lock', disabled: true, skin: 'ui-rite-tile' });
      return;
    }
    // ui-rite-tile.png skins each tile; ui-ready-dot.png marks one with something to claim
    makeButton(scene, x, y, w, h, r.label, () => scene.scene.start(r.scene, {}), { fontSize: 18, icon: r.icon, skin: 'ui-rite-tile' });
    if (r.ready?.(save)) {
      if (scene.textures.exists('ui-ready-dot')) scene.add.image(x + w / 2 - 10, y - h / 2 + 10, 'ui-ready-dot').setDisplaySize(16, 16);
      else scene.add.circle(x + w / 2 - 10, y - h / 2 + 10, 6, PAL.amber).setStrokeStyle(2, 0x1b121c);
    }
  });
  return top + Math.ceil(RITES.length / cols) * (h + gap) - gap;
}
