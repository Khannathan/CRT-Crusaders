import Phaser from 'phaser';

/**
 * Minimum text sizes, in game pixels. The game is 540 wide and a phone shows it
 * about 400 dp wide, so 1 game px is ~0.75 dp: anything under these reads as a
 * smudge on a phone. Every Text in the game passes through here, so a screen
 * that asks for 11 px simply gets the floor.
 */
export const MIN_TEXT = {
  /** Vigil Pixel (numbers, labels, small caps). */
  hud: 14,
  /** Cinzel Decorative (titles). */
  display: 20,
  /** Crimson Pro and everything else (body text). */
  body: 17,
} as const;

/** The size a font should really be drawn at, given the size asked for. */
export function readableSize(px: number, family: string) {
  const f = family.toLowerCase();
  const min = f.includes('vigil pixel') ? MIN_TEXT.hud : f.includes('cinzel') ? MIN_TEXT.display : MIN_TEXT.body;
  return Math.max(min, px);
}

const toPx = (size: unknown) => (typeof size === 'number' ? size : parseFloat(String(size)));

let installed = false;

/** Patches Phaser's TextStyle once so every text object respects MIN_TEXT. */
export function installReadableText() {
  if (installed) return;
  installed = true;
  const proto = Phaser.GameObjects.TextStyle.prototype as unknown as {
    setStyle: (style: Record<string, unknown> | undefined, updateText?: boolean, setDefaults?: boolean) => unknown;
    setFontSize: (size: number | string) => unknown;
    fontFamily: string;
  };
  const setStyle = proto.setStyle;
  proto.setStyle = function (this: typeof proto, style, updateText, setDefaults) {
    if (style && style.fontSize !== undefined) {
      const px = toPx(style.fontSize);
      const family = String(style.fontFamily ?? this.fontFamily ?? '');
      if (Number.isFinite(px)) {
        const fixed = readableSize(px, family);
        if (fixed !== px) style = { ...style, fontSize: `${fixed}px` };
      }
    }
    return setStyle.call(this, style, updateText, setDefaults);
  };
  const setFontSize = proto.setFontSize;
  proto.setFontSize = function (this: typeof proto, size) {
    const px = toPx(size);
    return setFontSize.call(this, Number.isFinite(px) ? `${readableSize(px, this.fontFamily ?? '')}px` : size);
  };
}
