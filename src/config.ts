/** Design resolution: 9:16 portrait. Phaser scales this to fit any phone. */
export const GAME_W = 540;
export const GAME_H = 960;

/** Palette anchors from ART_GUIDE.md. */
export const PAL = {
  bg: 0x121116,
  deepShadow: 0x211b26,
  armorShadow: 0x383845,
  steel: 0x72717b,
  ivory: 0xc6baa4,
  oxblood: 0x652b3b,
  bronze: 0x8b6848,
  amber: 0xd6a15f,
  violet: 0x9b78a3,
} as const;

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

export const FONT = 'Georgia, "Times New Roman", serif';
