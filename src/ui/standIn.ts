import Phaser from 'phaser';
import { crusaderById } from '../data/crusaders';
import { ORDERS } from '../data/orders';

/**
 * Stand-ins for Sisters whose new art has not arrived yet: her class's
 * silhouette (src/assets/stand-in/<classId>.png, a white 128 x 192 mask) cut
 * in her Order's colour, with a lit rim. No old Sister art is used, so the
 * roster reads as "a Vigil Arbalist" until Aaron's art for her lands; then her
 * own files (portraits/, full-body/, splash/ named by her id) replace it with
 * no code change.
 *
 * Textures are drawn on first use, one per class and Order (not one per
 * Sister), so 500 Sisters cost at most 150 small canvases.
 */
const MASK_URLS = import.meta.glob<string>('../assets/stand-in/*.png', { eager: true, query: '?url', import: 'default' });
const maskKey = (classId: string) => `standin-mask-${classId}`;

let textures: Phaser.Textures.TextureManager | undefined;

/** True once this texture is in (after BootScene.create; before it, every queued file counts as in). */
export const textureReady = (key: string) => !textures || textures.exists(key);

/** In BootScene.preload: load the class masks. */
export function queueStandInMasks(scene: Phaser.Scene) {
  for (const [path, url] of Object.entries(MASK_URLS)) {
    const cls = path.split('/').pop()!.replace('.png', '');
    scene.load.image(maskKey(cls), url);
  }
}

/** In BootScene.create: from here on, stand-in keys draw their texture when first asked for. */
export function initStandIns(scene: Phaser.Scene) {
  textures = scene.textures;
}

const shade = (c: number, f: number) => {
  const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((c >> s) & 0xff) * f)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

/** Texture key of the stand-in for this Sister ('full' 128 x 192 figure, 'bust' 128 x 128). */
export function standInKey(kind: 'full' | 'bust', id: string): string | undefined {
  const c = crusaderById(id);
  if (!c) return undefined;
  const order = ORDERS[c.order];
  const key = `standin-${kind}-${c.classId}-${order?.id ?? 'none'}`;
  if (textures && !textures.exists(key)) draw(textures, kind, key, c.classId, order?.color ?? 0x8a7a66, order?.accent ?? 0xc6baa4);
  return key;
}

function draw(tm: Phaser.Textures.TextureManager, kind: 'full' | 'bust', key: string, classId: string, color: number, accent: number) {
  const src = tm.exists(maskKey(classId)) ? maskKey(classId) : maskKey('hierophant');
  if (!tm.exists(src)) return;
  const mask = tm.get(src).getSourceImage() as HTMLImageElement;
  const W = 128;
  const H = 192;
  // the silhouette in two tones: a lit rim one pixel up and left, the body on top
  const fig = document.createElement('canvas');
  fig.width = W + 1;
  fig.height = H + 1;
  const fx = fig.getContext('2d')!;
  fx.imageSmoothingEnabled = false;
  const tinted = (fill: string) => {
    const t = document.createElement('canvas');
    t.width = W;
    t.height = H;
    const tx = t.getContext('2d')!;
    tx.drawImage(mask, 0, 0);
    tx.globalCompositeOperation = 'source-in';
    tx.fillStyle = fill;
    tx.fillRect(0, 0, W, H);
    return t;
  };
  fx.drawImage(tinted(shade(color, 0.85)), 0, 0);
  fx.drawImage(tinted(shade(color, 0.3)), 1, 1);

  if (kind === 'full') {
    const tex = tm.createCanvas(key, W, H);
    if (!tex) return;
    tex.context.imageSmoothingEnabled = false;
    tex.context.drawImage(fig, -1, -1);
    tex.refresh();
    return;
  }
  // bust: head and shoulders at 2x on a dark panel in her Order's colour
  const S = 128;
  const tex = tm.createCanvas(key, S, S);
  if (!tex) return;
  const ctx = tex.context;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = shade(color, 0.12);
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = shade(accent, 0.22);
  ctx.fillRect(4, 4, S - 8, S - 8);
  ctx.fillStyle = shade(color, 0.16);
  ctx.fillRect(8, 8, S - 16, S - 16);
  // find the top of her head to frame the crop
  const probe = mask.width ? fx.getImageData(32, 0, 64, H).data : undefined;
  let top = 12;
  if (probe) {
    outer: for (let y = 0; y < H; y++) for (let x = 0; x < 64; x++) if (probe[(y * 64 + x) * 4 + 3] > 0) {
      top = y;
      break outer;
    }
  }
  ctx.drawImage(fig, 32, Math.max(0, top - 4), 64, 64, 0, 8, S, S);
  tex.refresh();
}
