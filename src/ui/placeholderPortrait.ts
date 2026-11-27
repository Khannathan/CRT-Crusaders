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
 * Splash art: src/assets/splash/<id>.webp, a 2:3 painted scene of her at
 * 512 x 768, full colour, about 170 KB (docs/SPLASH_ART.md). Made from her
 * 1024 x 1536 master by tools/build_splash.py; never hand-edited. A few older
 * splashes are .png or 640 x 960. They load on demand (queueSplash in a scene's
 * preload, or loadSplash) and old ones are freed (trimSplashes).
 */
const SPLASH_URLS = import.meta.glob<string>('../assets/splash/*.{webp,png,jpg}', { eager: true, query: '?url', import: 'default' });
const splashUrl = (id: string) => SPLASH_URLS[`../assets/splash/${id}.png`] ?? SPLASH_URLS[`../assets/splash/${id}.webp`] ?? SPLASH_URLS[`../assets/splash/${id}.jpg`];
export const splashKey = (id: string) => `splash-${id}`;
export const hasSplash = (id: string) => !!splashUrl(id);

/**
 * How a splash is filtered depends on how big it is drawn (docs/SPLASH_ART.md):
 * at its own size or bigger, hard pixels keep the painted pixel clusters crisp;
 * shrunk, hard pixels would drop whole rows and break her eyes, so it is smoothed.
 * One texture is drawn at one size at a time, so each draw sets its texture's filter.
 */
export const SPLASH_HARD_FROM = 0.98;
export function splashFilter(scene: Phaser.Scene, key: string, scale: number) {
  if (!scene.textures.exists(key)) return;
  const { NEAREST, LINEAR } = Phaser.Textures.FilterMode;
  scene.textures.get(key).setFilter(scale >= SPLASH_HARD_FROM ? NEAREST : LINEAR);
  touchSplash(key);
}

/**
 * Splashes are 1.5 MB each once decoded, so only the most recently used ones stay
 * loaded: enough for a 10-pull reveal or a Sister page and its neighbours. Older
 * ones are freed unless something on screen still shows them, and load again
 * (from the browser's cache) when needed.
 */
export const SPLASH_CACHE = 12;
const lastUsed = new Map<string, number>();
let useTick = 0;
function touchSplash(key: string) {
  lastUsed.set(key, ++useTick);
}

/** True when any live scene still draws this texture (containers and layers included). */
function onScreen(game: Phaser.Game, key: string) {
  const shows = (list: Phaser.GameObjects.GameObject[]): boolean =>
    list.some((o) => {
      const t = (o as Phaser.GameObjects.Image).texture;
      if (t && t.key === key) return true;
      const kids = (o as Phaser.GameObjects.Container).list;
      return Array.isArray(kids) && shows(kids as Phaser.GameObjects.GameObject[]);
    });
  return game.scene.scenes.some((sc) => shows(sc.sys.displayList?.list ?? []));
}

/** Frees the least recently used splashes beyond SPLASH_CACHE that nothing shows. */
export function trimSplashes(game: Phaser.Game, keep = SPLASH_CACHE) {
  const loaded = [...lastUsed.entries()].filter(([k]) => game.textures.exists(k));
  for (const [k] of [...lastUsed.entries()]) if (!game.textures.exists(k)) lastUsed.delete(k);
  let over = loaded.length - keep;
  for (const [k] of loaded.sort((a, b) => a[1] - b[1])) {
    if (over <= 0) break;
    if (onScreen(game, k)) continue;
    game.textures.remove(k);
    lastUsed.delete(k);
    over--;
  }
}

/** How many splash textures are loaded right now (for tests and the art review). */
export const loadedSplashes = (game: Phaser.Game) => [...lastUsed.keys()].filter((k) => game.textures.exists(k));

const loaded = (scene: Phaser.Scene, key: string) => {
  touchSplash(key);
  trimSplashes(scene.game);
};

/** In a scene's preload(): queue her splash so it is ready in create(). */
export function queueSplash(scene: Phaser.Scene, id: string) {
  const key = splashKey(id);
  const url = splashUrl(id);
  if (!url) return;
  if (scene.textures.exists(key)) return touchSplash(key);
  scene.load.once(`filecomplete-image-${key}`, () => loaded(scene, key));
  scene.load.image(key, url);
}

/** Loads her splash if she has one; resolves with its key, or undefined. */
export function loadSplash(scene: Phaser.Scene, id: string): Promise<string | undefined> {
  const key = splashKey(id);
  const url = splashUrl(id);
  if (!url) return Promise.resolve(undefined);
  if (scene.textures.exists(key)) {
    touchSplash(key);
    return Promise.resolve(key);
  }
  return new Promise((resolve) => {
    const done = () => {
      scene.load.off(`filecomplete-image-${key}`, done);
      scene.load.off(Phaser.Loader.Events.COMPLETE, done);
      if (scene.textures.exists(key)) loaded(scene, key);
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
  const [cx, head, feet, zoom = 1] = SPLASH_FRAMES[id] ?? DEFAULT_FRAME;
  const aspect = w / h;
  const fig = (feet - head) * SH;
  const maxH = Math.min(SH, SW / aspect);
  let ch: number;
  let cy: number;
  if (mode === 'hero') {
    ch = Phaser.Math.Clamp((fig * 0.8 + SH * 0.1) / zoom, SH * 0.25, maxH);
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
  splashFilter(scene, key, scale);
  const img = scene.add.image(x, y, key).setScale(scale).setCrop(left, top, cw, ch);
  // Put the crop's centre on (x, y).
  img.setPosition(x - (left + cw / 2 - SW / 2) * scale, y - (top + ch / 2 - SH / 2) * scale);
  return img;
}
