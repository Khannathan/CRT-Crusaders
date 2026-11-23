import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { makeButton } from './button';
import { text } from './theme';

/**
 * A small sheet that says what a one-tap action will do and asks once:
 * a title, a few lines (cut short past `max`), an optional footer that is
 * always shown (the cost), Cancel and the action.
 */
export function confirmSheet(scene: Phaser.Scene, title: string, lines: string[], ok: string, onOk: () => void, footer?: string, max = 8) {
  const shown = lines.length > max ? [...lines.slice(0, max - 1), `…and ${lines.length - max + 1} more`] : [...lines];
  if (footer) shown.push('', footer);
  const layer = scene.add.container(0, 0).setDepth(60);
  const body = scene.add.text(GAME_W / 2, 0, shown.join('\n'), { ...text.body(16, PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 110 }, lineSpacing: 4 }).setOrigin(0.5, 0);
  const h = Math.max(220, body.height + 170);
  const top = GAME_H / 2 - h / 2;
  layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.82).setInteractive());
  layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W - 60, h, 0x241925).setStrokeStyle(2, PAL.goldEdge));
  layer.add(scene.add.text(GAME_W / 2, top + 34, title, text.display(22, 0xfff1d6)).setOrigin(0.5));
  body.setY(top + 66);
  layer.add(body);
  const cancel = makeButton(scene, GAME_W / 2 - 110, top + h - 46, 190, 52, 'Not yet', () => layer.destroy(), { fontSize: 17 });
  const go = makeButton(scene, GAME_W / 2 + 110, top + h - 46, 190, 52, ok, () => {
    layer.destroy();
    onOk();
  }, { active: true, fontSize: 17 });
  layer.add([...cancel.all, ...go.all]);
  return layer;
}
