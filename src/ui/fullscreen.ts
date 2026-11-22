import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { makeButton } from './button';
import { addFrame, text } from './theme';

/** True when the browser can go full screen (Android Chrome, desktop; not iPhone Safari). */
export const canFullscreen = (scene: Phaser.Scene) => scene.scale.fullscreen.available;

/** iPhone/iPad browsers, where the page itself cannot go full screen. */
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Toggle full screen. Call it from a tap (pointerup) so the browser allows it.
 * On phones it also holds the screen upright while full screen.
 * Where full screen is not offered (iPhone Safari), it explains Add to Home Screen.
 */
export function toggleFullscreen(scene: Phaser.Scene) {
  const scale = scene.scale;
  if (scale.isFullscreen) {
    scale.stopFullscreen();
    return;
  }
  if (!canFullscreen(scene)) {
    showHomeScreenHint(scene);
    return;
  }
  scale.startFullscreen({ navigationUI: 'hide' });
  const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  o?.lock?.('portrait').catch(() => {
    // desktops and some browsers refuse; the game fits either way
  });
}

/** Four corner brackets: pointing out to enter full screen, in to leave it. */
function drawIcon(g: Phaser.GameObjects.Graphics, size: number, inward: boolean) {
  const h = size / 2;
  const a = size * 0.32;
  g.clear().lineStyle(2.5, PAL.amber, 1);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx = sx * h;
    const cy = sy * h;
    if (!inward) {
      // corner at the outside
      g.lineBetween(cx, cy, cx - sx * a, cy);
      g.lineBetween(cx, cy, cx, cy - sy * a);
    } else {
      // corner pulled in toward the middle
      const ix = cx - sx * a;
      const iy = cy - sy * a;
      g.lineBetween(ix, iy, cx, iy);
      g.lineBetween(ix, iy, ix, cy);
    }
  }
}

/** A small full-screen toggle (corner-bracket icon) for the top bar. */
export function addFullscreenButton(scene: Phaser.Scene, x: number, y: number, size = 22) {
  const g = scene.add.graphics({ x, y }).setDepth(6);
  const redraw = () => drawIcon(g, size, scene.scale.isFullscreen);
  redraw();
  const hit = scene.add.zone(x, y, size + 18, size + 18).setDepth(6).setInteractive({ useHandCursor: true });
  hit.on('pointerup', () => toggleFullscreen(scene));
  scene.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, redraw);
  scene.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, redraw);
  g.once('destroy', () => {
    scene.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, redraw);
    scene.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, redraw);
  });
  return { g, hit };
}

/** Where the browser cannot go full screen: how to get it from the home screen instead. */
function showHomeScreenHint(scene: Phaser.Scene) {
  const layer = scene.add.container(0, 0).setDepth(90);
  const close = () => layer.destroy();
  layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.85).setInteractive().on('pointerup', close));
  layer.add(addFrame(scene, GAME_W / 2, GAME_H / 2, GAME_W - 60, 330, { fill: 0x241925 }));
  const how = isIOS()
    ? 'This browser cannot go full screen.\n\nTap Share, then "Add to Home Screen". Opened from there, the game fills the screen.'
    : 'This browser cannot go full screen.\n\nUse its menu to "Add to Home screen" or "Install app". Opened from there, the game fills the screen.';
  layer.add([
    scene.add.text(GAME_W / 2, GAME_H / 2 - 120, 'FULL SCREEN', text.display(22, PAL.amber)).setOrigin(0.5),
    scene.add.text(GAME_W / 2, GAME_H / 2 - 20, how, { ...text.body(18, PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 120 } }).setOrigin(0.5),
  ]);
  layer.add(makeButton(scene, GAME_W / 2, GAME_H / 2 + 120, 180, 50, 'Close', close, { fontSize: 17 }).all);
}
