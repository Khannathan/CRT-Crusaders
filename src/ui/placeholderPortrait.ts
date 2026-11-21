import Phaser from 'phaser';
import { PAL } from '../config';
import { RARITY_COLOR } from '../data/classes';
import type { CrusaderDef } from '../data/types';

/** Native portrait size the art guide proposes. Real PNGs can be 128 or 256 square. */
export const PORTRAIT_SIZE = 128;

export const portraitKey = (id: string) => `portrait-${id}`;

/**
 * Draws a 128x128 stand-in portrait (hooded silhouette on charcoal) for any crusader
 * whose PNG is not in public/portraits yet, so art can arrive in any order.
 */
export function makePlaceholderPortrait(scene: Phaser.Scene, c: CrusaderDef) {
  const key = portraitKey(c.id);
  if (scene.textures.exists(key)) return;
  const s = PORTRAIT_SIZE;
  const g = scene.make.graphics({}, false);
  g.fillStyle(PAL.bg).fillRect(0, 0, s, s);
  g.fillStyle(PAL.deepShadow).fillRect(4, 4, s - 8, s - 8);
  // shoulders + hood, flat stepped shapes in the class's rarity tint
  const tint = RARITY_COLOR[c.rarity];
  g.fillStyle(PAL.armorShadow).fillRect(20, 92, 88, 36);
  g.fillStyle(tint, 0.55).fillRect(28, 84, 72, 12);
  g.fillStyle(PAL.oxblood).fillTriangle(64, 18, 30, 92, 98, 92);
  g.fillStyle(PAL.ivory, 0.85).fillRect(52, 46, 24, 30);
  g.fillStyle(PAL.bg).fillRect(56, 56, 4, 4).fillRect(68, 56, 4, 4);
  g.generateTexture(key, s, s);
  g.destroy();
}
