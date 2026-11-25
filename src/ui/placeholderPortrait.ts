import Phaser from 'phaser';
import { PAL } from '../config';
import { RARITY_COLOR } from '../data/classes';
import type { CrusaderDef } from '../data/types';
import { DEFAULT_FRAME, SPLASH_FRAMES } from '../data/splashFrames';
import { standInKey, textureReady } from './standIn';

/** Native portrait size the art guide proposes. Real PNGs can be 128 or 256 square. */
export const PORTRAIT_SIZE = 128;

/** Bust art: src/assets/portraits/<id>.png (or .webp), 128 x 128. */
const PORTRAIT_URLS = import.meta.glob<string>('../assets/portraits/*.{png,webp}', { eager: true, query: '?url', import: 'default' });
/** Her bust file's URL, when it is in. */
export const portraitUrl = (id: string): string | undefined => PORTRAIT_URLS[`../assets/portraits/${id}.png`] ?? PORTRAIT_URLS[`../assets/portraits/${id}.webp`];
/** True when this Sister's own bust is in. */
export const hasPortrait = (id: string) => !!portraitUrl(id);

/**
 * Texture key of her bust: her own art once it has loaded (ui/sisterArt.ts
 * loads it on demand), else her Order-and-class stand-in (ui/standIn.ts).
 */
export const portraitKey = (id: string) => (hasPortrait(id) && textureReady(`portrait-${id}`) ? `portrait-${id}` : (standInKey('bust', id) ?? `portrait-${id}`));

/**
 * Draws a 128x128 stand-in portrait (hooded silhouette on charcoal) for any crusader
 * whose PNG is not in public/portraits yet, so art can arrive in any order.
 */
export function makePlaceholderPortrait(scene: Phaser.Scene, c: CrusaderDef) {
  const key = `portrait-${c.id}`;
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
 * Full-body art: src/assets/full-body/<id>.png (or .webp), a 128 x 192 transparent
 * pixel-art figure, head to toe. Loaded with the rest of her art (ui/sisterArt.ts);
 * loadFullBody fetches one at once when a screen needs it.
 */
const FULL_BODY_URLS = import.meta.glob<string>('../assets/full-body/*.{png,webp}', { eager: true, query: '?url', import: 'default' });
export const fullBodyUrl = (id: string) => FULL_BODY_URLS[`../assets/full-body/${id}.png`] ?? FULL_BODY_URLS[`../assets/full-body/${id}.webp`];

/** True when a full-body file exists for this Sister (loaded or not). */
export const hasFullBody = (id: string) => !!fullBodyUrl(id);

/** Texture key of her full body once loaded, else her bust (see loadFullBody). */
export function fullBodyKey(scene: Phaser.Scene, id: string) {
  const key = `full-${id}`;
  return scene.textures.exists(key) ? key : (standInKey('full', id) ?? portraitKey(id));
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
      // pixel art: keep the game's nearest-neighbour filter so the pixels stay square
      resolve(fullBodyKey(scene, id));
    };
    scene.load.once(`filecomplete-image-${key}`, done);
    scene.load.once(Phaser.Loader.Events.COMPLETE, done);
    scene.load.image(key, url);
    if (!scene.load.isLoading()) scene.load.start();
  });
}

/**
 * Splash art: src/assets/splash/<id>.webp (or .png/.jpg), a 2:3 painted scene of
 * her, 640 x 960. About 170 KB each, so they load on demand (queueSplash in a
 * scene's preload, or loadSplash). To swap in a Sister's new look, replace her
 * file with one of the same name; nothing else changes.
 */
const SPLASH_URLS = import.meta.glob<string>('../assets/splash/*.{webp,png,jpg}', { eager: true, query: '?url', import: 'default' });
const splashUrl = (id: string) => SPLASH_URLS[`../assets/splash/${id}.png`] ?? SPLASH_URLS[`../assets/splash/${id}.webp`] ?? SPLASH_URLS[`../assets/splash/${id}.jpg`];
export const splashKey = (id: string) => `splash-${id}`;
export const hasSplash = (id: string) => !!splashUrl(id);

/**
 * Smooth filtering for painted splash art (.webp/.jpg), which is drawn smaller than
 * its pixels. Pixel-art splashes (.png, stored at 2x their 256 x 384 grid) stay crisp.
 */
const smooth = (scene: Phaser.Scene, key: string, url: string) => {
  if (scene.textures.exists(key) && !url.endsWith('.png')) scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
};

/** In a scene's preload(): queue her splash so it is ready in create(). */
export function queueSplash(scene: Phaser.Scene, id: string) {
  const key = splashKey(id);
  const url = splashUrl(id);
  if (!url || scene.textures.exists(key)) return;
  scene.load.once(`filecomplete-image-${key}`, () => smooth(scene, key, url));
  scene.load.image(key, url);
}

/** Loads her splash if she has one; resolves with its key, or undefined. */
export function loadSplash(scene: Phaser.Scene, id: string): Promise<string | undefined> {
  const key = splashKey(id);
  const url = splashUrl(id);
  if (!url) return Promise.resolve(undefined);
  if (scene.textures.exists(key)) return Promise.resolve(key);
  return new Promise((resolve) => {
    const done = () => {
      scene.load.off(`filecomplete-image-${key}`, done);
      scene.load.off(Phaser.Loader.Events.COMPLETE, done);
      smooth(scene, key, url);
      resolve(scene.textures.exists(key) ? key : undefined);
    };
    scene.load.once(`filecomplete-image-${key}`, done);
    scene.load.once(Phaser.Loader.Events.COMPLETE, done);
    scene.load.image(key, url);
    if (!scene.load.isLoading()) scene.load.start();
  });
}

/**
 * Her splash cropped into a w x h box at (x, y), zoomed so she sits central and
 * at a similar size whoever she is (see SPLASH_FRAMES). Never stretched: the
 * crop always has the box's shape.
 * - 'hero': head to about the knees (Sister page, banners)
 * - 'full': head to toe with a little room (pull reveal)
 */
export function addSplash(scene: Phaser.Scene, id: string, x: number, y: number, w: number, h: number, mode: 'hero' | 'full') {
  const key = splashKey(id);
  const src = scene.textures.get(key).getSourceImage();
  const SW = src.width;
  const SH = src.height;
  const [cx, head, feet] = SPLASH_FRAMES[id] ?? DEFAULT_FRAME;
  const aspect = w / h;
  const fig = (feet - head) * SH;
  const maxH = Math.min(SH, SW / aspect);
  let ch: number;
  let cy: number;
  if (mode === 'hero') {
    ch = Phaser.Math.Clamp(fig * 0.8 + SH * 0.1, SH * 0.36, maxH);
    // room above her head for hats, halos and raised weapons
    cy = head * SH - SH * 0.1;
  } else {
    ch = Phaser.Math.Clamp(fig * 1.25 + SH * 0.04, SH * 0.55, maxH);
    cy = ((head + feet) / 2) * SH - ch / 2 - SH * 0.04;
  }
  const cw = ch * aspect;
  const left = Phaser.Math.Clamp(cx * SW - cw / 2, 0, SW - cw);
  const top = Phaser.Math.Clamp(cy, 0, SH - ch);
  const scale = w / cw;
  const img = scene.add.image(x, y, key).setScale(scale).setCrop(left, top, cw, ch);
  // Put the crop's centre on (x, y).
  img.setPosition(x - (left + cw / 2 - SW / 2) * scale, y - (top + ch / 2 - SH / 2) * scale);
  return img;
}
