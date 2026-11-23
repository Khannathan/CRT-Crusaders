import Phaser from 'phaser';
import { FONT, GAME_W, PAL, hex } from '../config';
import { settings } from '../state/settings';

/** Battle feel: hit-stop, shake, damage pops, CRT static deaths, Rite title cards and combo bursts. */

export type ShakeLevel = 'crit' | 'kill' | 'boss';
const SHAKE: Record<ShakeLevel, [number, number]> = {
  crit: [120, 0.005],
  kill: [200, 0.009],
  boss: [450, 0.02],
};

export function shake(scene: Phaser.Scene, level: ShakeLevel) {
  if (!settings.screenShake) return;
  const [ms, power] = SHAKE[level];
  scene.cameras.main.shake(ms, power, true);
}

/** Freezes the scene's clock and tweens for a beat, so a big hit lands. */
export function hitStop(scene: Phaser.Scene, ms = 70) {
  if (scene.time.paused) return;
  scene.time.paused = true;
  scene.tweens.pauseAll();
  window.setTimeout(() => {
    if (!scene.sys.isActive()) return;
    scene.time.paused = false;
    scene.tweens.resumeAll();
  }, ms);
}

/** Damage text size grows with how much of the target's health the hit took. */
export function damageSize(amount: number, maxHp: number, crit = false) {
  const share = Math.min(1, amount / Math.max(1, maxHp));
  return Math.round(24 + 28 * Math.sqrt(share) + (crit ? 8 : 0));
}

/** A number that pops in large and settles, then drifts up and fades. */
export function popNumber(scene: Phaser.Scene, x: number, y: number, label: string, color: number, size: number) {
  const t = scene.add
    .text(0, y, label, { fontFamily: FONT, fontSize: `${size}px`, color: hex(color), stroke: '#000000', strokeThickness: Math.max(4, size / 7) })
    .setOrigin(0.5)
    .setDepth(31)
    .setScale(1.7);
  // Keep the whole number on screen, even over the end cards.
  const half = t.width / 2 + 6;
  t.setX(Phaser.Math.Clamp(x + Phaser.Math.Between(-10, 10), half, GAME_W - half));
  scene.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.out' });
  scene.tweens.add({ targets: t, y: y - 52, alpha: 0, delay: 420, duration: 700, ease: 'Quad.in', onComplete: () => t.destroy() });
}

/** Flashes an image solid white for a moment. */
export function whiteFlash(scene: Phaser.Scene, img: Phaser.GameObjects.Image, ms = 70) {
  img.setTintFill(0xffffff);
  scene.time.delayedCall(ms, () => img.clearTint());
}

const STATIC_FRAMES = 4;

/** A few frames of grey TV noise, drawn once per game. */
function staticKeys(scene: Phaser.Scene): string[] {
  const keys: string[] = [];
  for (let f = 0; f < STATIC_FRAMES; f++) {
    const key = `crt-static-${f}`;
    keys.push(key);
    if (scene.textures.exists(key)) continue;
    const size = 48;
    const tex = scene.textures.createCanvas(key, size, size);
    if (!tex) continue;
    const ctx = tex.getContext();
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = Math.random() < 0.08 ? 255 : Math.floor(Math.random() * 200);
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  return keys;
}

/** The card dissolves into static, then collapses like a switched-off CRT. */
export function staticDeath(scene: Phaser.Scene, box: Phaser.GameObjects.Container, size: number, boss = false) {
  const keys = staticKeys(scene);
  const noise = scene.add.image(0, 0, keys[0]).setDisplaySize(size, size).setAlpha(0);
  box.add(noise);
  let frame = 0;
  const flicker = scene.time.addEvent({
    delay: 40,
    loop: true,
    callback: () => {
      frame = (frame + 1) % keys.length;
      noise.setTexture(keys[frame]).setDisplaySize(size, size);
    },
  });
  scene.tweens.add({ targets: noise, alpha: 0.95, duration: 180 });
  const sx = box.scaleX;
  scene.tweens.add({ targets: box, delay: 220, scaleY: 0.04, scaleX: sx * 1.15, duration: 160, ease: 'Quad.in' });
  scene.tweens.add({
    targets: box,
    delay: 380,
    scaleX: 0,
    duration: boss ? 260 : 140,
    ease: 'Quad.in',
    onComplete: () => {
      flicker.remove();
      noise.destroy();
      box.setAlpha(0).setScale(1);
    },
  });
  // A white line where the picture was, as the tube shuts off.
  const line = scene.add.rectangle(box.x, box.y, size * 1.2, 3, 0xffffff).setDepth(29).setAlpha(0);
  scene.tweens.add({ targets: line, alpha: 1, delay: 360, duration: 60, yoyo: true, hold: boss ? 160 : 60, onComplete: () => line.destroy() });
}

/** A Rite's name stamped across the screen while the camera leans in. */
export function riteCard(scene: Phaser.Scene, name: string, who: string, onDone: () => void, verb = 'INVOKES', bossIcon?: string) {
  const y = 430;
  const cam = scene.cameras.main;
  cam.zoomTo(1.08, 220, 'Quad.easeOut');
  const boss = verb !== 'INVOKES';
  const band = scene.add.rectangle(GAME_W / 2, y, GAME_W, 120, 0x0c0709, 0.9).setDepth(40).setScale(1, 0);
  // Art behind the words: a Litany's pillar of light, or the Blasphemy's torn warning banner
  const art: Phaser.GameObjects.Image[] = [];
  const add = (key: string, x: number, ay: number, w: number, h: number, depth = 41) => {
    if (!scene.textures.exists(key)) return undefined;
    const img = scene.add.image(x, ay, key).setDisplaySize(w, h).setDepth(depth).setAlpha(0);
    art.push(img);
    return img;
  };
  if (boss) {
    add('ui-blasphemy-warning', GAME_W / 2, y + 6, GAME_W + 20, 150);
    add('fx-blasphemy-sigil', GAME_W / 2, y, 200, 200, 40);
    if (bossIcon) add(bossIcon, 64, y + 10, 72, 72, 43);
  } else {
    add('fx-litany-pillar', GAME_W / 2, y - 40, 220, 300, 40);
    add('fx-litany-halo', GAME_W / 2, y - 6, 200, 200, 40);
    add('icon-litany', 56, y + 10, 64, 64, 43);
  }
  art.forEach((o, i) => scene.tweens.add({ targets: o, alpha: o.depth === 40 ? 0.55 : 1, delay: 60 + i * 40, duration: 180 }));
  const edgeA = scene.add.rectangle(GAME_W / 2, y - 60, GAME_W, 3, PAL.amber).setDepth(41).setScale(0, 1);
  const edgeB = scene.add.rectangle(GAME_W / 2, y + 60, GAME_W, 3, PAL.amber).setDepth(41).setScale(0, 1);
  const sub = scene.add.text(GAME_W / 2, y - 30, `${who.toUpperCase()} ${verb}`, { fontFamily: FONT, fontSize: '18px', color: hex(PAL.bronze) }).setOrigin(0.5).setDepth(42).setAlpha(0);
  const title = scene.add
    .text(GAME_W / 2, y + 12, name.toUpperCase(), { fontFamily: FONT, fontSize: '46px', color: hex(PAL.amber), stroke: '#000000', strokeThickness: 6 })
    .setOrigin(0.5)
    .setDepth(42)
    .setScale(2.2)
    .setAlpha(0);
  const parts: Phaser.GameObjects.GameObject[] = [band, edgeA, edgeB, sub, title, ...art];
  scene.tweens.add({ targets: band, scaleY: 1, duration: 140, ease: 'Quad.out' });
  scene.tweens.add({ targets: [edgeA, edgeB], scaleX: 1, duration: 220, ease: 'Quad.out' });
  scene.tweens.add({ targets: sub, alpha: 1, delay: 80, duration: 160 });
  scene.tweens.add({
    targets: title,
    scale: 1,
    alpha: 1,
    delay: 100,
    duration: 200,
    ease: 'Back.out',
    onComplete: () => shake(scene, 'crit'),
  });
  scene.time.delayedCall(900, () => {
    cam.zoomTo(1, 200, 'Quad.easeIn');
    scene.tweens.add({ targets: parts, alpha: 0, duration: 180, onComplete: () => parts.forEach((p) => p.destroy()) });
    onDone();
  });
}

/** Rings and sparks bursting off a target when a combo pays off. */
export function comboBurst(scene: Phaser.Scene, x: number, y: number, label: string, color: number) {
  for (let i = 0; i < 2; i++) {
    const ring = scene.add.circle(x, y, 20).setStrokeStyle(6 - i * 2, color).setDepth(32);
    scene.tweens.add({ targets: ring, radius: 110 + i * 30, alpha: 0, delay: i * 90, duration: 420, ease: 'Quad.out', onComplete: () => ring.destroy() });
  }
  for (let i = 0; i < 14; i++) {
    const a = (Math.PI * 2 * i) / 14 + Math.random() * 0.3;
    const d = 70 + Math.random() * 60;
    const spark = scene.add.rectangle(x, y, 6, 6, i % 3 ? color : 0xffffff).setDepth(32);
    scene.tweens.add({ targets: spark, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, angle: 180, duration: 480, ease: 'Quad.out', onComplete: () => spark.destroy() });
  }
  const t = scene.add
    .text(Phaser.Math.Clamp(x, 120, GAME_W - 120), y - 84, label, { fontFamily: FONT, fontSize: '32px', color: hex(color), stroke: '#000000', strokeThickness: 6 })
    .setOrigin(0.5)
    .setDepth(33)
    .setScale(0.4);
  scene.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.out' });
  scene.tweens.add({ targets: t, alpha: 0, y: t.y - 30, delay: 700, duration: 400, onComplete: () => t.destroy() });
}

/** A gold "NEW RECORD" banner that stamps in, holds, then lifts away. */
export function recordBanner(scene: Phaser.Scene, line: string, y = 200, hold = 2600) {
  const band = scene.add.rectangle(GAME_W / 2, y, GAME_W, 86, 0x2a1c10, 0.95).setStrokeStyle(2, PAL.amber).setDepth(45).setScale(1, 0);
  const title = scene.add
    .text(GAME_W / 2, y - 16, 'NEW RECORD', { fontFamily: FONT, fontSize: '34px', color: hex(PAL.amber), stroke: '#000000', strokeThickness: 6 })
    .setOrigin(0.5)
    .setDepth(46)
    .setScale(2)
    .setAlpha(0);
  const sub = scene.add.text(GAME_W / 2, y + 24, line, { fontFamily: FONT, fontSize: '17px', color: hex(PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 40 } }).setOrigin(0.5).setDepth(46).setAlpha(0);
  const parts = [band, title, sub];
  scene.tweens.add({ targets: band, scaleY: 1, duration: 160, ease: 'Quad.out' });
  scene.tweens.add({ targets: title, scale: 1, alpha: 1, delay: 80, duration: 220, ease: 'Back.out' });
  scene.tweens.add({ targets: sub, alpha: 1, delay: 220, duration: 200 });
  scene.tweens.add({ targets: parts, alpha: 0, delay: hold, duration: 500, onComplete: () => parts.forEach((p) => p.destroy()) });
}
