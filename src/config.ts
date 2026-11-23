/**
 * Design resolution: 540 wide, portrait. The width never changes; the height
 * grows with the phone (see src/ui/screenFit.ts) so tall 20:9 screens fill
 * edge to edge instead of showing black bars. Every screen is laid out for the
 * shortest height, BASE_H (9:16), and anchors its bottom rows to GAME_H.
 */
export const GAME_W = 540;
/** Shortest game height (9:16). Screens must fit in this. */
export const BASE_H = 960;
/** Tallest game height (about 21.3:9). Taller screens get thin bars. */
export const MAX_H = 1280;
/**
 * Current game height, BASE_H..MAX_H. A live binding: it changes when the
 * screen shape changes, so read it when laying out, never copy it into a
 * module-level constant.
 */
export let GAME_H = BASE_H;
/** Only screenFit.ts calls this. */
export function setGameHeight(h: number) {
  GAME_H = h;
}

/**
 * Palette: ART_GUIDE.md anchors, warmed toward the UI preview (wine, gold, ivory
 * on near-black plum). Keys are shared by every scene, so change colours here.
 */
export const PAL = {
  bg: 0x100d12, // ink
  deepShadow: 0x1b151e, // panel
  armorShadow: 0x493436, // hairline
  steel: 0xa49198, // faint text
  ivory: 0xf0e2ca,
  oxblood: 0x63283a, // wine
  bronze: 0x8b6848,
  amber: 0xefbc79, // gold
  violet: 0xc5a4d5,
  // extras from the preview
  rail: 0x161117,
  muted: 0xb7a5a1,
  goldEdge: 0xaa7c4b,
  wineLight: 0x8e4154,
  button: 0x241a22,
  buttonEdge: 0x745157,
  health: 0xa0ad76,
  damage: 0xc27078,
} as const;

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** Body text (Crimson Pro). Fonts live in src/assets/fonts and load before the game starts. */
export const FONT = '"Crimson Pro", Georgia, serif';
/** Titles (Cinzel Decorative). */
export const DISPLAY_FONT = '"Cinzel Decorative", Georgia, serif';
/** Numbers, labels and small caps (Vigil Pixel). Covers plain ASCII only. */
export const HUD_FONT = '"Vigil Pixel", monospace';
