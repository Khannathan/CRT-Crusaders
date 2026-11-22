import Phaser from 'phaser';

export interface ScrollArea {
  /** Add the scrolling objects here, placed as if the list were not scrolled. */
  content: Phaser.GameObjects.Container;
  /** Set where the content ends (screen y at scroll 0); call after adding it. */
  fit(contentBottom: number): void;
  /** Make `obj` tappable inside the list: a drag, or a tap outside the window, does not count. */
  tap<T extends Phaser.GameObjects.GameObject>(obj: T, fn: (p: Phaser.Input.Pointer) => void): T;
  /** True for a pointerup that ended a drag (so a tap handler can ignore it). */
  readonly dragging: boolean;
  scrollTo(y: number): void;
  readonly scroll: number;
}

export interface ScrollOpts {
  /** Container the list lives in (an overlay layer); defaults to the scene. */
  parent?: Phaser.GameObjects.Container;
  depth?: number;
  /** Starting scroll offset (0 or negative), e.g. to keep the place after a redraw. */
  start?: number;
  /** While this returns false the list ignores input (an overlay is open). */
  enabled?: () => boolean;
  /** Called with the new offset whenever it moves. */
  onScroll?: (y: number) => void;
}

/**
 * A vertical list clipped to the window `top`..`bottom` that scrolls by touch
 * drag, mouse drag and the mouse wheel, with a little momentum after a flick.
 * Every scrollable screen uses it, so all of them behave the same on phone and PC.
 */
export function addScrollArea(scene: Phaser.Scene, top: number, bottom: number, opts: ScrollOpts = {}): ScrollArea {
  const content = scene.add.container(0, 0);
  if (opts.depth !== undefined) content.setDepth(opts.depth);
  opts.parent?.add(content);
  const mask = scene.make.graphics({}, false).fillRect(0, top, scene.scale.width, bottom - top);
  content.setMask(mask.createGeometryMask());

  let minY = 0;
  let down = false;
  let dragged = false;
  let startY = 0;
  let startScroll = 0;
  let lastY = 0;
  let velocity = 0;
  let fling: Phaser.Tweens.Tween | undefined;
  const live = () => content.active && (opts.enabled?.() ?? true);
  const inView = (y: number) => y >= top && y <= bottom;
  const set = (y: number) => {
    content.y = Phaser.Math.Clamp(y, minY, 0);
    opts.onScroll?.(content.y);
  };

  const onDown = (p: Phaser.Input.Pointer) => {
    if (!live() || !inView(p.y)) return;
    fling?.stop();
    down = true;
    dragged = false;
    startY = lastY = p.y;
    startScroll = content.y;
    velocity = 0;
  };
  const onMove = (p: Phaser.Input.Pointer) => {
    if (!down || !p.isDown) return;
    if (Math.abs(p.y - startY) > 8) dragged = true;
    if (dragged) set(startScroll + (p.y - startY));
    velocity = p.y - lastY;
    lastY = p.y;
  };
  const onUp = () => {
    if (!down) return;
    down = false;
    if (dragged && Math.abs(velocity) > 2 && minY < 0) {
      const v = { v: velocity };
      fling = scene.tweens.add({ targets: v, v: 0, duration: 500, ease: 'Cubic.easeOut', onUpdate: () => set(content.y + v.v) });
    }
    // let this release's pointerup handlers see `dragged` before it resets
    scene.time.delayedCall(0, () => (dragged = false));
  };
  const onWheel = (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
    if (live() && inView(p.y)) set(content.y - dy);
  };
  scene.input.on('pointerdown', onDown);
  scene.input.on('pointermove', onMove);
  scene.input.on('pointerup', onUp);
  scene.input.on('pointerupoutside', onUp);
  scene.input.on('wheel', onWheel);
  content.once('destroy', () => {
    scene.input.off('pointerdown', onDown);
    scene.input.off('pointermove', onMove);
    scene.input.off('pointerup', onUp);
    scene.input.off('pointerupoutside', onUp);
    scene.input.off('wheel', onWheel);
    fling?.stop();
    mask.destroy();
  });

  return {
    content,
    fit(contentBottom: number) {
      minY = Math.min(0, bottom - contentBottom);
      set(opts.start ?? content.y);
    },
    tap(obj, fn) {
      (obj as unknown as Phaser.GameObjects.Image).setInteractive({ useHandCursor: true });
      obj.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (dragged || !inView(p.y) || !live()) return;
        fn(p);
      });
      return obj;
    },
    get dragging() {
      return dragged;
    },
    scrollTo: set,
    get scroll() {
      return content.y;
    },
  };
}
