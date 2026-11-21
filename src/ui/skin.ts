import Phaser from 'phaser';

/**
 * Optional UI skins. Drop a PNG named after a key below into src/assets/ui/ and
 * the matching piece of UI is drawn from it (as a 9-slice, so corners stay crisp
 * at any size) instead of the flat shapes drawn in code. Missing files, or the
 * canvas fallback renderer, keep the drawn look.
 *
 * Each entry is the corner size in source pixels: the part of each corner that
 * never stretches. Make art with corners at least that big.
 */
export const SKINS = {
  'ui-button': 16,
  'ui-button-pressed': 16,
  'ui-button-primary': 16,
  'ui-button-primary-pressed': 16,
  'ui-frame': 24,
  'ui-panel': 24,
  'ui-card': 12,
  'ui-chip': 10,
  'ui-badge': 6,
  'ui-tab-active': 16,
} as const;

export type SkinKey = keyof typeof SKINS;

export function hasSkin(scene: Phaser.Scene, key: string) {
  return scene.textures.exists(key) && scene.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer;
}

/** A stretched 9-slice of `key` centred on (x, y), or null when the skin is not there. */
export function nine(scene: Phaser.Scene, key: SkinKey, x: number, y: number, w: number, h: number) {
  if (!hasSkin(scene, key)) return null;
  const src = scene.textures.get(key).getSourceImage();
  // corners can't be bigger than half the box or half the source image
  const c = Math.max(1, Math.floor(Math.min(SKINS[key], w / 2, h / 2, src.width / 2, src.height / 2)));
  return scene.add.nineslice(x, y, key, undefined, w, h, c, c, c, c);
}

/** A plain stretched image (bars and backgrounds that need no corners), or null. */
export function stretch(scene: Phaser.Scene, key: string, x: number, y: number, w: number, h: number) {
  if (!scene.textures.exists(key)) return null;
  return scene.add.image(x, y, key).setDisplaySize(w, h);
}
