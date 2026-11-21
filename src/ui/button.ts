import Phaser from 'phaser';
import { FONT, HUD_FONT, PAL, hex } from '../config';

export interface ButtonOpts {
  /** Primary style: wine fill with a gold edge. */
  active?: boolean;
  disabled?: boolean;
  fontSize?: number;
  /** Optional pixel icon (ui-<name>) drawn left of the label. */
  icon?: string;
}

/**
 * A thumb-sized button in the preview's style. A label with a second line
 * ("Recruit ×10\n10 Seals") shows that line small, in the gold pixel font.
 */
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
  const fill = opts.active ? PAL.oxblood : PAL.button;
  const press = opts.active ? 0x763245 : 0x392430;
  const alpha = opts.disabled ? 0.45 : 1;
  const box = scene.add
    .rectangle(x, y, w, h, fill)
    .setStrokeStyle(opts.active ? 2 : 1, opts.active ? PAL.goldEdge : PAL.buttonEdge)
    .setAlpha(alpha);
  // inner wine line on primary buttons, like the preview's inset shadow
  const inner = scene.add.rectangle(x, y, w - 6, h - 6).setStrokeStyle(2, opts.active ? 0x491e2b : fill).setAlpha(alpha);

  // Exactly two lines: big label + small gold sub-line. Anything else stays one block.
  const lines = label.split('\n');
  const [main, sub] = lines.length === 2 ? lines : [label, undefined];
  const size = opts.fontSize ?? 22;
  const text = scene.add
    .text(0, 0, main, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '600', color: hex(opts.active ? 0xffe9c9 : PAL.ivory), align: 'center' })
    .setOrigin(0.5)
    .setAlpha(alpha);
  const parts: Phaser.GameObjects.GameObject[] = [];
  let subText: Phaser.GameObjects.Text | undefined;
  if (sub) {
    subText = scene.add
      .text(x, 0, sub, { fontFamily: HUD_FONT, fontSize: `${Math.max(14, Math.round(size * 0.68))}px`, color: hex(PAL.amber) })
      .setOrigin(0.5)
      .setAlpha(alpha);
    const total = text.height + subText.height;
    text.setPosition(x, y - total / 2 + text.height / 2);
    subText.setY(y + total / 2 - subText.height / 2);
    parts.push(subText);
  } else {
    text.setPosition(x, y);
  }
  let icon: Phaser.GameObjects.Image | undefined;
  if (opts.icon && scene.textures.exists(`ui-${opts.icon}`)) {
    const s = Math.round(size * 0.85);
    const gap = 9;
    const total = s + gap + text.width;
    icon = scene.add.image(x - total / 2 + s / 2, text.y, `ui-${opts.icon}`).setDisplaySize(s, s).setTint(PAL.amber).setAlpha(alpha);
    text.setX(x - total / 2 + s + gap + text.width / 2);
    parts.push(icon);
  }

  if (!opts.disabled) {
    box.setInteractive({ useHandCursor: true });
    box.on('pointerdown', () => box.setFillStyle(press));
    box.on('pointerout', () => box.setFillStyle(fill));
    box.on('pointerup', () => {
      box.setFillStyle(fill);
      onTap();
    });
  }
  return { box, text, inner, extra: parts, all: [box, inner, text, ...parts] as Phaser.GameObjects.GameObject[] };
}
