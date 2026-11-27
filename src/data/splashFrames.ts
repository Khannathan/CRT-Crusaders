/**
 * Where each Sister stands in her splash art, as fractions of the image:
 * [focus x (her face's centre), top of head, soles of feet, zoom?]. Screens use
 * it to crop every splash so she sits central and at a similar size: the Sister
 * page and banners show head to knees, the pull reveal head to toe. `zoom`
 * (default 1) brings the head-to-knees crop closer (above 1) or wider (below 1)
 * for one Sister. Tapping her on her page always shows the whole uncropped
 * painting. Every new splash gets a row, measured on her master (heads drawn at
 * the very top of the image need it most: the default would crop them).
 * See docs/SPLASH_ART.md.
 */
export type SplashFrame = [cx: number, head: number, feet: number, zoom?: number];

export const DEFAULT_FRAME: SplashFrame = [0.47, 0.2, 0.88];

export const SPLASH_FRAMES: Record<string, SplashFrame> = {
  'TC-UR1': [0.48, 0.1, 0.92],
  'VT-SSR-VEI': [0.45, 0.3, 0.85],
  'DL-SSR-EXE': [0.45, 0.28, 0.85],
  // Living Saints (pixel-art splashes from the new roster)
  'IV-LUR': [0.5, 0.15, 0.95],
  'IV-LSSR1': [0.52, 0.2, 1.0],
};
