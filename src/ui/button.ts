import Phaser from 'phaser';
import { FONT, PAL, hex } from '../config';

export interface ButtonOpts {
  active?: boolean;
  disabled?: boolean;
  fontSize?: number;
}

/** A thumb-sized text button (at least 64px tall at design resolution). */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onTap: () => void,
  opts: ButtonOpts = {},
) {
  const fill = opts.active ? PAL.oxblood : PAL.deepShadow;
  const box = scene.add
    .rectangle(x, y, w, h, fill)
    .setStrokeStyle(2, opts.active ? PAL.amber : PAL.armorShadow)
    .setAlpha(opts.disabled ? 0.45 : 1);
  const text = scene.add
    .text(x, y, label, {
      fontFamily: FONT,
      fontSize: `${opts.fontSize ?? 22}px`,
      color: hex(PAL.ivory),
      align: 'center',
    })
    .setOrigin(0.5)
    .setAlpha(opts.disabled ? 0.45 : 1);
  if (!opts.disabled) {
    box.setInteractive({ useHandCursor: true });
    box.on('pointerdown', () => box.setFillStyle(PAL.oxblood));
    box.on('pointerout', () => box.setFillStyle(fill));
    box.on('pointerup', () => {
      box.setFillStyle(fill);
      onTap();
    });
  }
  return { box, text };
}
