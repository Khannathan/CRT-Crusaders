import Phaser from 'phaser';
import { PAL } from '../config';
import { familyDef, itemDef, itemKey, type ItemId } from '../systems/items';

/**
 * A material's icon: src/assets/ui/item-<id>.png (96 x 96) when present, else
 * a drawn stand-in in the family colour with one pip per tier.
 */
export function drawItemIcon(scene: Phaser.Scene, x: number, y: number, id: ItemId, size = 56): Phaser.GameObjects.GameObject[] {
  const d = itemDef(id);
  const color = familyDef(d.family).color;
  const out: Phaser.GameObjects.GameObject[] = [];
  out.push(scene.add.rectangle(x, y, size, size, 0x150e17).setStrokeStyle(d.tier === 3 ? 2 : 1, d.tier === 3 ? PAL.amber : color));
  if (scene.textures.exists(itemKey(id))) {
    out.push(scene.add.image(x, y, itemKey(id)).setDisplaySize(size - 4, size - 4));
    return out;
  }
  const g = scene.add.graphics();
  const r = size * 0.26;
  const shade = Phaser.Display.Color.IntegerToColor(color).darken(10 * (3 - d.tier)).color;
  g.fillStyle(shade, 1);
  g.lineStyle(2, 0x0d080e, 1);
  const cy = y - size * 0.06;
  if (d.family === 'ash') {
    // an urn
    g.fillEllipse(x, cy + r * 0.3, r * 1.8, r * 1.6);
    g.fillRect(x - r * 0.45, cy - r * 0.9, r * 0.9, r * 0.7);
  } else if (d.family === 'page') {
    g.fillRect(x - r * 0.8, cy - r, r * 1.6, r * 2);
    g.lineStyle(1, 0x0d080e, 0.8);
    for (let i = 0; i < 3; i++) g.lineBetween(x - r * 0.5, cy - r * 0.5 + i * r * 0.5, x + r * 0.5, cy - r * 0.5 + i * r * 0.5);
  } else if (d.family === 'iron') {
    g.fillPoints([new Phaser.Math.Vector2(x, cy - r), new Phaser.Math.Vector2(x + r, cy), new Phaser.Math.Vector2(x, cy + r), new Phaser.Math.Vector2(x - r, cy)], true);
  } else if (d.family === 'incense') {
    g.fillTriangle(x, cy - r * 1.1, x + r * 0.7, cy + r * 0.2, x - r * 0.7, cy + r * 0.2);
    g.fillRect(x - r * 0.6, cy + r * 0.2, r * 1.2, r * 0.8);
  } else if (d.family === 'unction') {
    // a vial of oil
    g.fillCircle(x, cy + r * 0.35, r * 0.85);
    g.fillRect(x - r * 0.3, cy - r * 0.9, r * 0.6, r * 0.8);
    g.fillStyle(0x2a1e28, 1);
    g.fillRect(x - r * 0.4, cy - r * 1.1, r * 0.8, r * 0.3);
  } else {
    g.fillRect(x - r, cy - r * 0.7, r * 2, r * 1.4);
    g.fillStyle(0xa8322b, 1);
    g.fillCircle(x + r * 0.5, cy + r * 0.5, r * 0.35);
  }
  out.push(g);
  for (let i = 0; i < d.tier; i++) out.push(scene.add.circle(x - (d.tier - 1) * 5 + i * 10, y + size * 0.36, 3, PAL.amber));
  return out;
}
