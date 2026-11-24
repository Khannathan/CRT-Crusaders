import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { ORDERS, orderLines } from '../data/orders';
import { makeButton } from './button';
import { addFrame, text } from './theme';

/**
 * A row of Order chips for a party: each Order in it, how many Sisters, and a
 * pip per blessing step earned (2, 3, 4). Tap the row for the full list.
 */
export function drawOrderChips(scene: Phaser.Scene, cx: number, y: number, orders: string[], depth = 0): Phaser.GameObjects.GameObject[] {
  const lines = orderLines(orders).filter((l) => l.n >= 1);
  const out: Phaser.GameObjects.GameObject[] = [];
  if (!lines.length) return out;
  const parts = lines.map((l) => {
    const steps = ORDERS[l.order]?.tiers.length ?? 3;
    const got = l.now.length;
    return { label: `${l.order} ×${l.n}`, got, steps, color: ORDERS[l.order]?.accent ?? PAL.amber };
  });
  // Measure, then centre the row.
  const texts = parts.map((p) => scene.add.text(0, y, p.label, text.body(14, p.got ? PAL.amber : PAL.steel)).setOrigin(0, 0.5).setDepth(depth));
  const widths = texts.map((t, i) => t.width + 8 + parts[i].steps * 10 + 16);
  const total = widths.reduce((a, b) => a + b, 0) + (parts.length - 1) * 8;
  let x = cx - total / 2;
  texts.forEach((t, i) => {
    const w = widths[i];
    out.push(scene.add.rectangle(x + w / 2, y, w, 26, 0x170f1b, 0.9).setStrokeStyle(1, parts[i].got ? PAL.goldEdge : PAL.armorShadow).setDepth(depth));
    t.setX(x + 8);
    scene.children.bringToTop(t);
    out.push(t);
    for (let k = 0; k < parts[i].steps; k++) {
      out.push(scene.add.circle(x + 8 + t.width + 8 + k * 10 + 3, y, 3.5, k < parts[i].got ? PAL.amber : 0x3a2e35).setDepth(depth));
    }
    x += w + 8;
  });
  const hit = scene.add.rectangle(cx, y, total + 10, 30, 0x000000, 0.001).setDepth(depth).setInteractive({ useHandCursor: true });
  hit.on('pointerup', () => showOrderBonuses(scene, orders, depth + 5));
  out.push(hit);
  return out;
}

/** Every Order in the party, each blessing step, lit when earned. */
export function showOrderBonuses(scene: Phaser.Scene, orders: string[], depth = 50) {
  const layer = scene.add.container(0, 0).setDepth(depth);
  layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.9).setInteractive());
  const lines = orderLines(orders);
  const h = 150 + lines.length * 130;
  layer.add(addFrame(scene, GAME_W / 2, GAME_H / 2, GAME_W - 40, h, { fill: 0x241925 }));
  let y = GAME_H / 2 - h / 2 + 30;
  layer.add(scene.add.text(GAME_W / 2, y, 'ORDER BLESSINGS', text.display(22, PAL.amber)).setOrigin(0.5));
  y += 26;
  layer.add(scene.add.text(GAME_W / 2, y, 'Each Sister of an Order adds to its favour. Two pairs earn two favours.', { ...text.body(14, PAL.muted), align: 'center', wordWrap: { width: GAME_W - 90 } }).setOrigin(0.5, 0));
  y += 40;
  for (const l of lines) {
    layer.add(scene.add.text(50, y, `${l.order}  ×${l.n}`, text.body(18, l.now.length ? PAL.amber : PAL.ivory)));
    y += 28;
    for (const t of ORDERS[l.order]?.tiers ?? []) {
      const on = l.n >= t.need;
      layer.add(scene.add.text(64, y, `${t.need}`, text.hud(13, on ? PAL.amber : PAL.steel)));
      layer.add(scene.add.text(86, y, t.desc, { ...text.body(14, on ? PAL.ivory : PAL.steel), wordWrap: { width: GAME_W - 140 } }));
      y += 30;
    }
    y += 8;
  }
  const close = makeButton(scene, GAME_W / 2, GAME_H / 2 + h / 2 - 40, 200, 50, 'Done', () => layer.destroy(), { fontSize: 17 });
  layer.add(close.all);
}
