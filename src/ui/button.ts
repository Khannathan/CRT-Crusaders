import Phaser from 'phaser';
import { FONT, PAL, hex } from '../config';

/** A thumb-sized text button (min 64px tall at design resolution). */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onTap: () => void,
  opts: { active?: boolean; fontSize?: number } = {},
) {
  const box = scene.add
    .rectangle(x, y, w, h, opts.active ? PAL.oxblood : PAL.deepShadow)
    .setStrokeStyle(2, opts.active ? PAL.amber : PAL.armorShadow)
    .setInteractive({ useHandCursor: true });
  const text = scene.add
    .text(x, y, label, { fontFamily: FONT, fontSize: `${opts.fontSize ?? 22}px`, color: hex(PAL.ivory) })
    .setOrigin(0.5);
  box.on('pointerdown', () => box.setFillStyle(PAL.oxblood));
  box.on('pointerout', () => box.setFillStyle(opts.active ? PAL.oxblood : PAL.deepShadow));
  box.on('pointerup', () => {
    box.setFillStyle(opts.active ? PAL.oxblood : PAL.deepShadow);
    onTap();
  });
  return { box, text };
}
