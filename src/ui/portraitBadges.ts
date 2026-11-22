import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { CLASSES, RARITY_COLOR } from '../data/classes';
import { ORDERS } from '../data/orders';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';
import { presetIconsFor } from '../systems/presets';
import { makeButton } from './button';
import { addOrderSigil } from './sisterCard';
import { addFrame, text } from './theme';

type Obj = Phaser.GameObjects.GameObject;

/** A preset or class icon on a dark disc, whatever the art's own size. */
export function iconDisc(scene: Phaser.Scene, x: number, y: number, key: string, size: number, edge: number = PAL.goldEdge): Obj[] {
  const out: Obj[] = [scene.add.circle(x, y, size / 2 + 3, 0x0d090f, 0.9).setStrokeStyle(1, edge)];
  if (scene.textures.exists(key)) out.push(scene.add.image(x, y, key).setDisplaySize(size, size));
  return out;
}

/**
 * The four corners of a Sister's portrait: rarity (top left), Order sigil (top
 * right), class (bottom left) and level (bottom right). Icons of the party
 * presets she belongs to run down the right edge under the sigil.
 */
export function drawPortraitBadges(scene: Phaser.Scene, cx: number, cy: number, size: number, c: CrusaderDef, save: SaveData, opts: { dim?: boolean; level?: boolean } = {}): Obj[] {
  const out: Obj[] = [];
  const h = size / 2;
  const s = size >= 120 ? 1 : size / 120;
  const small = Math.round(13 * Math.max(0.85, s));
  const tint = RARITY_COLOR[c.rarity];
  // Rarity.
  const r = scene.add.text(cx - h + 8, cy - h + 6, c.rarity, text.hud(small, tint));
  out.push(scene.add.rectangle(cx - h + 3, cy - h + 3, r.width + 10, r.height + 6, 0x0d090f, 0.9).setOrigin(0, 0).setStrokeStyle(1, tint), r);
  // Order.
  const sig = Math.round(size * 0.27);
  out.push(scene.add.circle(cx + h - sig / 2 - 4, cy - h + sig / 2 + 4, sig / 2 + 3, 0x0d090f, 0.9).setStrokeStyle(1, ORDERS[c.order]?.color ?? PAL.goldEdge));
  const o = addOrderSigil(scene, cx + h - sig / 2 - 4, cy - h + sig / 2 + 4, c.order, sig);
  if (o) out.push(o);
  // Class.
  const cl = Math.round(size * 0.24);
  out.push(...iconDisc(scene, cx - h + cl / 2 + 5, cy + h - cl / 2 - 5, `class-${c.classId}`, cl));
  // Level.
  const own = save.owned[c.id];
  if (own && opts.level !== false) {
    const lv = scene.add.text(cx + h - 7, cy + h - 6, `LV ${own.level}`, text.hud(small, PAL.ivory)).setOrigin(1, 1);
    out.push(scene.add.rectangle(cx + h - 3, cy + h - 3, lv.width + 10, lv.height + 6, 0x0d090f, 0.9).setOrigin(1, 1).setStrokeStyle(1, PAL.armorShadow), lv);
  }
  // Party presets.
  const ps = Math.round(size * 0.19);
  presetIconsFor(save, c.id).slice(0, 3).forEach((key, i) => {
    out.push(...iconDisc(scene, cx + h - sig / 2 - 4, cy - h + sig + 14 + ps / 2 + i * (ps + 8), key, ps, PAL.amber));
  });
  if (opts.dim) out.forEach((g) => (g as unknown as Phaser.GameObjects.Components.Alpha).setAlpha?.(0.45));
  return out;
}

/** What each corner of a portrait means. */
export function showBadgeKey(scene: Phaser.Scene, sample: CrusaderDef, save: SaveData, depth = 60) {
  const layer = scene.add.container(0, 0).setDepth(depth);
  layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.9).setInteractive());
  layer.add(addFrame(scene, GAME_W / 2, GAME_H / 2, GAME_W - 40, 640, { fill: 0x241925 }));
  const top = GAME_H / 2 - 300;
  layer.add(scene.add.text(GAME_W / 2, top + 20, 'PORTRAIT BADGES', text.display(22, PAL.ivory)).setOrigin(0.5, 0));
  const size = 180;
  const cy = top + 80 + size / 2;
  layer.add(scene.add.rectangle(GAME_W / 2, cy, size, size, 0x170f1b).setStrokeStyle(2, RARITY_COLOR[sample.rarity]));
  const key = `portrait-${sample.id}`;
  if (scene.textures.exists(key)) layer.add(scene.add.image(GAME_W / 2, cy, key).setDisplaySize(size - 4, size - 4));
  layer.add(drawPortraitBadges(scene, GAME_W / 2, cy, size, sample, save));
  const rows = [
    ['Top left', `Rarity: R, SR, SSR or UR.`],
    ['Top right', `Her Order (${sample.order}). Two or more of one Order in a party earn its blessing.`],
    ['Bottom left', `Her class (${CLASSES[sample.classId].name}).`],
    ['Bottom right', 'Her level.'],
    ['Right edge', 'Icons of the party presets she is in. Save presets from any party picker.'],
  ];
  rows.forEach(([k, v], i) => {
    const y = cy + size / 2 + 24 + i * 52;
    layer.add(scene.add.text(48, y, k.toUpperCase(), text.hud(12, PAL.amber)));
    layer.add(scene.add.text(48, y + 18, v, { ...text.body(16, PAL.ivory), wordWrap: { width: GAME_W - 96 } }));
  });
  const ok = makeButton(scene, GAME_W / 2, GAME_H / 2 + 280, 180, 52, 'Got it', () => layer.destroy(), { fontSize: 18 });
  layer.add(ok.all);
  return layer;
}
