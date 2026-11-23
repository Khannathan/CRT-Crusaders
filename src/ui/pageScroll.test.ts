import { describe, expect, it, vi } from 'vitest';

// Phaser needs a browser; these stand-ins carry just what the page scroll touches.
vi.mock('phaser', () => {
  class Obj {
    depth = 0;
    scrollFactorY = 1;
    visible = true;
    input?: { enabled: boolean };
    mask?: unknown;
    setScrollFactor(_x: number, y: number) {
      this.scrollFactorY = y;
      return this;
    }
    setDepth(d: number) {
      this.depth = d;
      return this;
    }
    setOrigin() {
      return this;
    }
    setInteractive() {
      this.input = { enabled: true };
      return this;
    }
    emit() {}
  }
  class Container extends Obj {
    list: Obj[] = [];
  }
  class GeometryMask {
    constructor(public geometryMask: Obj) {}
  }
  const Phaser = {
    GameObjects: { Container },
    Display: { Masks: { GeometryMask } },
    Scenes: { Events: { POST_UPDATE: 'postupdate', SHUTDOWN: 'shutdown' } },
    Math: { Clamp: (v: number, a: number, b: number) => Math.min(b, Math.max(a, v)) },
    __Obj: Obj,
  };
  return { default: Phaser, ...Phaser };
});

import Phaser from 'phaser';
import { addPageScroll } from './pageScroll';

type FakeObj = { depth: number; scrollFactorY: number; mask?: unknown; setDepth(d: number): FakeObj };
const P = Phaser as unknown as {
  __Obj: new () => FakeObj;
  GameObjects: { Container: new () => FakeObj & { list: FakeObj[] } };
  Display: { Masks: { GeometryMask: new (g: FakeObj) => unknown } };
};

function fakeScene() {
  const handlers: Record<string, Array<() => void>> = {};
  const list: FakeObj[] = [];
  const make = () => {
    const o = new P.__Obj();
    list.push(o);
    return o;
  };
  const scene = {
    cameras: { main: { scrollY: 0, setScroll(_x: number, y: number) { this.scrollY = y; } } },
    scale: { width: 540, height: 960 },
    add: { zone: make, rectangle: make },
    children: { list },
    events: {
      on: (e: string, f: () => void) => (handlers[e] ??= []).push(f),
      once: () => {},
      off: () => {},
    },
    input: { on: () => {}, off: () => {} },
    tweens: { add: () => ({ stop() {} }) },
    time: { delayedCall: () => {} },
  };
  return { scene, list, frame: () => handlers.postupdate?.forEach((f) => f()) };
}

describe('page scroll popups', () => {
  it('keeps a popup that rebuilds itself pinned to the screen, mask and all', () => {
    const { scene, list, frame } = fakeScene();
    // The Sanctum, scrolled down to the Keeper card.
    addPageScroll(scene as unknown as Phaser.Scene, { top: 60, bottom: 860, contentBottom: 1600, fixed: [], start: 700 });
    expect(scene.cameras.main.scrollY).toBe(700);

    // The Keeper picker opens: an overlay layer at depth 40.
    const layer = new P.GameObjects.Container();
    layer.setDepth(40);
    list.push(layer);
    const first = new P.__Obj();
    layer.list.push(first);
    frame();
    expect(layer.scrollFactorY).toBe(0);
    expect(first.scrollFactorY).toBe(0);

    // A tap redraws the picker: new buttons and a clipped (masked) card list.
    const button = new P.__Obj();
    const cards = new P.GameObjects.Container();
    const shape = new P.__Obj();
    cards.mask = new P.Display.Masks.GeometryMask(shape);
    const card = new P.__Obj();
    cards.list.push(card);
    layer.list.splice(0, layer.list.length, button, cards);
    frame();
    // Every new part follows the screen, so taps land where they are drawn
    // and the list shows through its window, not a slice 700px off.
    expect(button.scrollFactorY).toBe(0);
    expect(cards.scrollFactorY).toBe(0);
    expect(card.scrollFactorY).toBe(0);
    expect(shape.scrollFactorY).toBe(0);
  });

  it('leaves the page itself scrolling', () => {
    const { scene, list, frame } = fakeScene();
    addPageScroll(scene as unknown as Phaser.Scene, { top: 60, bottom: 860, contentBottom: 1600, fixed: [] });
    const pageCard = new P.__Obj();
    pageCard.setDepth(2);
    list.push(pageCard);
    frame();
    expect(pageCard.scrollFactorY).toBe(1);
  });
});
