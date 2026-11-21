import Phaser from 'phaser';
import { PAL } from '../config';
import type { Rarity } from '../data/types';

/** Wax colour per rarity: the seal hints at what's inside. */
export const WAX_COLOR: Record<Rarity, number> = {
  R: PAL.oxblood,
  SR: PAL.bronze,
  SSR: PAL.amber,
  UR: PAL.violet,
};

export const NOISE_FRAMES = 4;
export const noiseKey = (i: number) => `noise-${i}`;
export const sealKey = (r: Rarity) => `seal-${r}`;

/** Builds the CRT static frames and the wax seals used by the reveal. */
export function makeEffectTextures(scene: Phaser.Scene) {
  const size = 128;
  for (let i = 0; i < NOISE_FRAMES; i++) {
    if (scene.textures.exists(noiseKey(i))) continue;
    const g = scene.make.graphics({}, false);
    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        const v = Math.floor(Math.random() * 200) + 20;
        g.fillStyle(Phaser.Display.Color.GetColor(v, v, v + 8)).fillRect(x, y, 2, 2);
      }
    }
    // scanlines
    g.fillStyle(0x000000, 0.35);
    for (let y = 0; y < size; y += 4) g.fillRect(0, y, size, 1);
    g.generateTexture(noiseKey(i), size, size);
    g.destroy();
  }

  for (const r of ['R', 'SR', 'SSR', 'UR'] as Rarity[]) {
    if (scene.textures.exists(sealKey(r))) continue;
    const c = WAX_COLOR[r];
    const g = scene.make.graphics({}, false);
    const s = 96;
    // irregular wax blob
    g.fillStyle(Phaser.Display.Color.ValueToColor(c).darken(30).color);
    g.fillCircle(48, 50, 44).fillCircle(20, 30, 14).fillCircle(78, 72, 14).fillCircle(74, 22, 10);
    g.fillStyle(c).fillCircle(48, 48, 40);
    g.lineStyle(4, Phaser.Display.Color.ValueToColor(c).darken(25).color).strokeCircle(48, 48, 30);
    // stamped cross
    g.fillStyle(Phaser.Display.Color.ValueToColor(c).darken(35).color);
    g.fillRect(44, 28, 8, 40).fillRect(32, 40, 32, 8);
    g.generateTexture(sealKey(r), s, s);
    g.destroy();
  }
}
