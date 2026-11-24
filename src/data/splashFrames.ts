/**
 * Where each Sister stands in her splash art, as fractions of the image:
 * [centre x, top of head, soles of feet]. Screens use it to crop and zoom
 * every splash so she sits central and at a similar size. Measured by eye
 * from the 2026-11-22 splash set; a new or changed splash should get a new row
 * (or it falls back to DEFAULT_FRAME).
 */
export type SplashFrame = [cx: number, head: number, feet: number];

export const DEFAULT_FRAME: SplashFrame = [0.47, 0.2, 0.88];

export const SPLASH_FRAMES: Record<string, SplashFrame> = {
  'TC-UR1': [0.48, 0.1, 0.92],
  'VT-SSR-VEI': [0.45, 0.3, 0.85],
  'DL-SSR-EXE': [0.45, 0.28, 0.85],
  // Living Saints (pixel-art splashes from the new roster)
  'IV-LUR': [0.47, 0.14, 0.95],
};
