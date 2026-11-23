import Phaser from 'phaser';
import { GAME_W, PAL } from '../config';

type Obj = Phaser.GameObjects.GameObject & Partial<Phaser.GameObjects.Components.Depth & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Visible>;

/** Anything this deep or deeper is a popup, toast or overlay: it stays put on screen while the page scrolls. */
const OVERLAY_DEPTH = 10;
/** A popup that blocks the page (a full-screen catcher at this depth) stops the page from scrolling. */
const MODAL_DEPTH = 20;
/** Fixed chrome (top bar, tab bar) is lifted this much so the scrolled page passes under it. */
const CHROME_LIFT = 5;

export interface PageScrollOpts {
  /** Screen y where the scrollable window starts (under the top bar). */
  top: number;
  /** Screen y where it ends (above the tab bar). */
  bottom: number;
  /** World y where the page's content ends. */
  contentBottom: number;
  /** Objects that stay fixed on screen (the top bar, the tab bar). */
  fixed: Phaser.GameObjects.GameObject[];
  /** Starting scroll, e.g. kept from the last visit. */
  start?: number;
  onScroll?: (y: number) => void;
}

function pin(o: Obj) {
  o.setScrollFactor?.(0, 0);
  if (o instanceof Phaser.GameObjects.Container) o.list.forEach((c) => pin(c as Obj));
}

function anyInteractive(o: Phaser.GameObjects.GameObject): boolean {
  if (o.input?.enabled) return true;
  return o instanceof Phaser.GameObjects.Container && o.list.some(anyInteractive);
}

function eachInteractive(list: Phaser.GameObjects.GameObject[], fn: (o: Phaser.GameObjects.GameObject) => void) {
  for (const o of list) {
    if (o.input?.enabled) fn(o);
    if (o instanceof Phaser.GameObjects.Container) eachInteractive(o.list, fn);
  }
}

/**
 * Scroll a whole screen built with plain scene.add calls, by moving its camera:
 * touch drag, mouse drag and the wheel, with a little momentum after a flick.
 * The `fixed` objects and every popup (depth 10+) stay put on screen. Used by
 * screens too full of live parts (the Vigil fight) to live in a scroll list.
 * Returns the camera's scroll limit (0 when the page fits).
 */
export function addPageScroll(scene: Phaser.Scene, opts: PageScrollOpts): number {
  const cam = scene.cameras.main;
  const max = Math.max(0, Math.ceil(opts.contentBottom + 18 - opts.bottom));
  const pinned = new Set<Phaser.GameObjects.GameObject>();
  for (const o of opts.fixed as Obj[]) {
    pin(o);
    o.setDepth?.(o.depth! + CHROME_LIFT);
    pinned.add(o);
  }
  if (!max) {
    cam.setScroll(0, 0);
    return 0;
  }
  // Taps on the fixed bars never reach the page scrolled under them.
  const W = scene.scale.width;
  for (const [y0, y1] of [[0, opts.top], [opts.bottom, scene.scale.height]]) {
    const z = scene.add.zone(W / 2, (y0 + y1) / 2, W, y1 - y0).setScrollFactor(0).setDepth(OVERLAY_DEPTH - 0.5).setInteractive();
    pinned.add(z);
  }

  // A thin gold thumb at the right edge: where you are on the page.
  const track = opts.bottom - opts.top - 12;
  const thumbH = Math.max(36, (track * (opts.bottom - opts.top)) / (opts.bottom - opts.top + max));
  const thumb = scene.add.rectangle(GAME_W - 3, opts.top + 6, 3, thumbH, PAL.amber, 0.55).setOrigin(0.5, 0).setScrollFactor(0).setDepth(OVERLAY_DEPTH - 1);
  pinned.add(thumb);

  const set = (y: number) => {
    cam.scrollY = Phaser.Math.Clamp(y, 0, max);
    thumb.y = opts.top + 6 + ((track - thumbH) * cam.scrollY) / max;
    opts.onScroll?.(cam.scrollY);
  };
  set(opts.start ?? 0);

  // Popups made while scrolled stay where they are drawn on screen.
  const modalOpen = () => scene.children.list.some((o) => (o as Obj).depth! >= MODAL_DEPTH && (o as Obj).visible !== false && anyInteractive(o));
  const pinPopups = () => {
    for (const o of scene.children.list as Obj[]) {
      if (!pinned.has(o) && o.depth! >= OVERLAY_DEPTH) {
        pin(o);
        pinned.add(o);
      }
    }
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, pinPopups);

  let down = false;
  let dragged = false;
  let startY = 0;
  let startScroll = 0;
  let lastY = 0;
  let velocity = 0;
  let fling: Phaser.Tweens.Tween | undefined;
  let muted: Phaser.GameObjects.GameObject[] = [];
  const inView = (y: number) => y >= opts.top && y <= opts.bottom;
  // A drag is a scroll, never a tap: switch off the buttons until it ends.
  const mute = () => {
    eachInteractive(scene.children.list, (o) => {
      o.emit('pointerout');
      o.input!.enabled = false;
      muted.push(o);
    });
  };
  const unmute = () => {
    muted.forEach((o) => o.input && (o.input.enabled = true));
    muted = [];
  };

  const onDown = (p: Phaser.Input.Pointer) => {
    if (!inView(p.y) || modalOpen()) return;
    fling?.stop();
    down = true;
    dragged = false;
    startY = lastY = p.y;
    startScroll = cam.scrollY;
    velocity = 0;
  };
  const onMove = (p: Phaser.Input.Pointer) => {
    if (!down || !p.isDown) return;
    if (!dragged && Math.abs(p.y - startY) > 10) {
      dragged = true;
      mute();
    }
    if (dragged) set(startScroll - (p.y - startY));
    velocity = p.y - lastY;
    lastY = p.y;
  };
  const onUp = () => {
    if (!down) return;
    down = false;
    if (dragged && Math.abs(velocity) > 2) {
      const v = { v: velocity };
      fling = scene.tweens.add({ targets: v, v: 0, duration: 500, ease: 'Cubic.easeOut', onUpdate: () => set(cam.scrollY - v.v) });
    }
    // let this release's pointerup pass the switched-off buttons first
    if (dragged) scene.time.delayedCall(0, unmute);
    dragged = false;
  };
  const onWheel = (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
    if (inView(p.y) && !modalOpen()) set(cam.scrollY + dy);
  };
  scene.input.on('pointerdown', onDown);
  scene.input.on('pointermove', onMove);
  scene.input.on('pointerup', onUp);
  scene.input.on('pointerupoutside', onUp);
  scene.input.on('wheel', onWheel);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, pinPopups);
    scene.input.off('pointerdown', onDown);
    scene.input.off('pointermove', onMove);
    scene.input.off('pointerup', onUp);
    scene.input.off('pointerupoutside', onUp);
    scene.input.off('wheel', onWheel);
    fling?.stop();
    unmute();
    cam.setScroll(0, 0);
  });
  return max;
}
