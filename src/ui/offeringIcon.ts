import Phaser from 'phaser';
import { offeringDef, POTENCY_COLOR } from '../systems/offerings';
import { addIcon } from './theme';

/** Stand-in glyph per offering until its art (src/assets/ui/offering-<id>.png, 96 x 96) exists. */
const GLYPH: Record<string, string> = {
  tallow: 'flame', bread: 'alms', rosary: 'sigil', letter: 'book', lily: 'devotion',
  psalter: 'book', veil: 'badge', myrrh: 'flame', icon: 'reliquary',
  thorn: 'blade', tear: 'vow', nail: 'blade',
};

export const offeringKey = (id: string) => `offering-${id}`;

/** An offering's icon in a frame edged by its potency. */
export function drawOfferingIcon(scene: Phaser.Scene, x: number, y: number, id: string, size = 56): Phaser.GameObjects.GameObject[] {
  const d = offeringDef(id);
  const color = POTENCY_COLOR[d.potency];
  const out: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(x, y, size, size, 0x150e17).setStrokeStyle(d.potency === 'holy' ? 2 : 1, color)];
  if (scene.textures.exists(offeringKey(id))) out.push(scene.add.image(x, y, offeringKey(id)).setDisplaySize(size - 4, size - 4));
  else out.push(addIcon(scene, x, y, GLYPH[id] ?? 'flame', size * 0.6, color));
  return out;
}
