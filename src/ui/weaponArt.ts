import Phaser from 'phaser';
import type { CrusaderDef } from '../data/types';
import { weaponOf } from '../systems/symbols';

/**
 * Signature weapon art. Her own art is src/assets/ui/weapon-<id>.png, made from
 * her ChatGPT weapon prop sheet by tools/intake_weapon.py (loaded with the rest
 * of src/assets/ui). Until it lands she shows a stand-in: a 16 x 16 pixel glyph
 * of her class's weapon, lit in her weapon tier's colour. One texture per glyph
 * and tier, so 500 Sisters cost at most 40 tiny canvases.
 */
export const weaponArtKey = (id: string) => `weapon-${id}`;

// '#' metal, 'o' holy light in the tier colour, '.' clear. Weapon in the right hand, drawn upright.
const GLYPHS: Record<string, string[]> = {
  sword: [
    '.......o........', '......o#o.......', '......o#o.......', '......o#o.......', '......o#o.......', '......o#o.......', '......o#o.......', '......o#o.......',
    '......o#o.......', '......o#o.......', '...#########....', '....#ooooo#.....', '.......#........', '.......#........', '......###.......', '.......o........',
  ],
  shield: [
    '..############..', '.#oooooooooooo#.', '.#o##########o#.', '.#o#oo####oo#o#.', '.#o#o######o#o#.', '.#o####oo####o#.', '.#o###oooo###o#.', '.#o####oo####o#.',
    '.#o####oo####o#.', '.#o##########o#.', '..#o########o#..', '..#oo######oo#..', '...#oo####oo#...', '....#oo##oo#....', '.....#oooo#.....', '.......##.......',
  ],
  axe: [
    '.......##.......', '....######......', '..##oooo##......', '.#oooooo##......', '.#ooooo###......', '.#oooooo##......', '..##oooo##......', '....######......',
    '.......##.......', '.......##.......', '.......##.......', '.......##.......', '.......##.......', '.......##.......', '......####......', '.......oo.......',
  ],
  daggers: [
    '..o..........o..', '..#o........o#..', '..##o......o##..', '..###o....o###..', '...###o..o###...', '....###oo###....', '.....######.....', '......####......',
    '.....##..##.....', '....#oo..oo#....', '...##......##...', '..##........##..', '.##..........##.', '.o............o.', '................', '................',
  ],
  staff: [
    '.....oooooo.....', '....o######o....', '....o#oooo#o....', '....o#o##o#o....', '....o#oooo#o....', '.....o####o.....', '.......##.......', '.......##.......',
    '.......##.......', '.......##.......', '.......##.......', '.......##.......', '.......##.......', '.......##.......', '.......##.......', '.......oo.......',
  ],
  bell: [
    '.......##.......', '......#oo#......', '.....######.....', '....#oooooo#....', '....#o####o#....', '...#oo####oo#...', '...#o######o#...', '...#o######o#...',
    '..#oo######oo#..', '..#o########o#..', '.#oooooooooooo#.', '.##############.', '.......##.......', '......#oo#......', '.......##.......', '................',
  ],
  scales: [
    '.......oo.......', '.......##.......', '.##############.', '.#.....##.....#.', '.#.....##.....#.', '#.#....##....#.#', '#..#...##...#..#', 'oooo...##...oooo',
    '####...##...####', '.......##.......', '.......##.......', '.......##.......', '.......##.......', '.....######.....', '....#oooooo#....', '....########....',
  ],
  censer: [
    '.......##.......', '.......#........', '........#.......', '.......#........', '........#.......', '.......#........', '.....######.....', '....#oooooo#....',
    '...#o#o##o#o#...', '...#oooooooo#...', '...#o#o##o#o#...', '....#oooooo#....', '.....######.....', '....o..oo..o....', '...o..o..o..o...', '..o....o.....o..',
  ],
  crossbow: [
    '.......o........', '.......#........', '..#....#....#...', '.#.#...#...#.#..', '#...#..#..#...#.', '#....##o##....#.', '#....#ooo#....#.', '#.....###.....#.',
    '.#.....#.....#..', '..#....#....#...', '...#...#...#....', '....#.###.#.....', '.....#.#.#......', '.......#........', '......###.......', '......#o#.......',
  ],
  lantern: [
    '.......##.......', '......#..#......', '.......##.......', '.....######.....', '....##oooo##....', '....#oo##oo#....', '....#o####o#....', '....#oo##oo#....',
    '....#oooooo#....', '....##oooo##....', '.....######.....', '.......##.......', '.......##.......', '.......##.......', '.......##.......', '.......oo.......',
  ],
};

const CLASS_GLYPH: Record<string, string> = {
  hierophant: 'shield', sentinel: 'shield', martyr: 'sword', warsister: 'sword', inquisitor: 'axe', veilblade: 'daggers',
  confessor: 'staff', hospitaller: 'staff', abbess: 'staff', oracle: 'staff', cantor: 'bell',
  adjudicator: 'scales', censer: 'censer', arbalist: 'crossbow', exorcist: 'lantern',
};

const rgb = (c: number, f = 1) => {
  const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((c >> s) & 0xff) * f)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

/** Texture key for her weapon art: her own if it has arrived, else her class's stand-in glyph in her tier's colour. */
export function weaponKey(scene: Phaser.Scene, c: CrusaderDef): string {
  const own = weaponArtKey(c.id);
  if (scene.textures.exists(own)) return own;
  const w = weaponOf(c);
  const glyph = CLASS_GLYPH[c.classId] ?? 'sword';
  const key = `weapon-standin-${glyph}-${w.tier}`;
  if (scene.textures.exists(key)) return key;
  const rows = GLYPHS[glyph];
  // 18 x 18: the glyph with a one-pixel black outline all round
  const tex = scene.textures.createCanvas(key, 18, 18);
  if (!tex) return key;
  const ctx = tex.context;
  const at = (x: number, y: number) => rows[y]?.[x] ?? '.';
  for (let y = -1; y <= 16; y++)
    for (let x = -1; x <= 16; x++) {
      const ch = at(x, y);
      if (ch !== '.') {
        ctx.fillStyle = ch === 'o' ? rgb(w.color) : rgb(0x9aa0aa, 0.9);
        ctx.fillRect(x + 1, y + 1, 1, 1);
      } else if ([at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].some((n) => n !== '.')) {
        ctx.fillStyle = '#0b070c';
        ctx.fillRect(x + 1, y + 1, 1, 1);
      }
    }
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}

/** Whether her own weapon art (from her prop sheet) has arrived. */
export const hasWeaponArt = (scene: Phaser.Scene, c: CrusaderDef) => scene.textures.exists(weaponArtKey(c.id));
