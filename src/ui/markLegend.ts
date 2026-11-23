import Phaser from 'phaser';
import { GAME_W, PAL } from '../config';
import type { LegendLine } from '../systems/pickMarks';
import { MARK_COLOR } from './rosterCard';
import { text } from './theme';

type Obj = Phaser.GameObjects.GameObject;

/** The legend of marks, as wrapping "LABEL what it means" pairs. Returns its parts and bottom edge. */
export function drawLegend(scene: Phaser.Scene, y: number, width: number, lines: LegendLine[]): { parts: Obj[]; bottom: number } {
  const parts: Obj[] = [];
  const left = (GAME_W - width) / 2;
  const rowH = 24;
  let x = left;
  let row = 0;
  const items = lines.map((l) => {
    const tag = scene.add.text(0, 0, l.label, text.hud(12, MARK_COLOR[l.kind])).setOrigin(0, 0.5);
    const say = scene.add.text(0, 0, l.text, text.body(14, PAL.muted)).setOrigin(0, 0.5);
    return { l, tag, say, w: tag.width + 12 + 6 + say.width };
  });
  // Rows first, so each can be centred.
  const rows: (typeof items)[] = [[]];
  for (const it of items) {
    if (x > left && x + it.w > left + width) {
      rows.push([]);
      x = left;
      row++;
    }
    rows[row].push(it);
    x += it.w + 16;
  }
  rows.forEach((r, i) => {
    const rw = r.reduce((n, it) => n + it.w, 0) + 16 * (r.length - 1);
    let cx = GAME_W / 2 - rw / 2;
    const cy = y + i * rowH + rowH / 2;
    for (const it of r) {
      parts.push(scene.add.rectangle(cx, cy, it.tag.width + 12, 20, 0x0d090f, 0.9).setOrigin(0, 0.5).setStrokeStyle(1, MARK_COLOR[it.l.kind]));
      it.tag.setPosition(cx + 6, cy);
      it.say.setPosition(cx + it.tag.width + 18, cy);
      // Over the chip, also where there is no container to keep the order.
      scene.children.bringToTop(it.tag);
      scene.children.bringToTop(it.say);
      parts.push(it.tag, it.say);
      cx += it.w + 16;
    }
  });
  return { parts, bottom: y + rows.length * rowH };
}
