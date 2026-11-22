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

/**
 * Full-body art: src/assets/full-body/<id>.png (or .webp), a tall 2:3 transparent
 * figure, head to toe. These are big, so they load on demand, not at boot.
 */
const FULL_BODY_URLS = import.meta.glob<string>('../assets/full-body/*.{png,webp}', { eager: true, query: '?url', import: 'default' });
const fullBodyUrl = (id: string) => FULL_BODY_URLS[`../assets/full-body/${id}.png`] ?? FULL_BODY_URLS[`../assets/full-body/${id}.webp`];

/** True when a full-body file exists for this Sister (loaded or not). */
export const hasFullBody = (id: string) => !!fullBodyUrl(id);

/** Texture key of her full body once loaded, else her bust (see loadFullBody). */
export function fullBodyKey(scene: Phaser.Scene, id: string) {
  const key = `full-${id}`;
  return scene.textures.exists(key) ? key : portraitKey(id);
}

/**
 * Loads her full body if there is one and resolves with the key to draw:
 * `full-<id>`, or her bust key when she has no full body (or it fails to load).
 */
export function loadFullBody(scene: Phaser.Scene, id: string): Promise<string> {
  const key = `full-${id}`;
  const url = fullBodyUrl(id);
  if (scene.textures.exists(key) || !url) return Promise.resolve(fullBodyKey(scene, id));
  return new Promise((resolve) => {
    const done = () => {
      scene.load.off(`filecomplete-image-${key}`, done);
      scene.load.off(Phaser.Loader.Events.COMPLETE, done);
      if (scene.textures.exists(key)) scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      resolve(fullBodyKey(scene, id));
    };
    scene.load.once(`filecomplete-image-${key}`, done);
    scene.load.once(Phaser.Loader.Events.COMPLETE, done);
    scene.load.image(key, url);
    if (!scene.load.isLoading()) scene.load.start();
  });
}
