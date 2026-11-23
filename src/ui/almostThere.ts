import Phaser from 'phaser';
import { GAME_W, PAL } from '../config';
import type { SaveData } from '../state/save';
import { nearGoals } from '../systems/goals';
import { PAD, fitLine, text } from './theme';

/**
 * "Almost there": the three closest real goals as tappable chips, each with a
 * bar of how close it is. Returns the bottom edge.
 */
export function drawAlmostThere(scene: Phaser.Scene, save: SaveData, top: number): number {
  // One of each kind, so three Codex goals never crowd out the rest.
  const seen = new Set<string>();
  const goals = nearGoals(save)
    .filter((g) => {
      const kind = g.id.split(':')[0];
      if (seen.has(kind)) return false;
      seen.add(kind);
      return true;
    })
    .slice(0, 3);
  if (!goals.length) return top - 20;
  const gap = 10;
  const w = (GAME_W - PAD * 2 - gap * 2) / 3;
  const h = 62;
  goals.forEach((g, i) => {
    const x = PAD + i * (w + gap);
    const ready = g.frac >= 1;
    const box = scene.add
      .rectangle(x, top, w, h, ready ? 0x3a2228 : 0x1b121c)
      .setOrigin(0, 0)
      .setStrokeStyle(ready ? 2 : 1, ready ? PAL.amber : PAL.armorShadow)
      .setInteractive({ useHandCursor: true });
    box.on('pointerup', () => scene.scene.start(g.scene, g.data ?? {}));
    fitLine(scene.add.text(x + 10, top + 8, g.title.toUpperCase(), text.hud(11, PAL.amber)), w - 18);
    fitLine(scene.add.text(x + 10, top + 24, g.need, text.body(16, ready ? 0xfff1d6 : PAL.ivory)), w - 18);
    scene.add.rectangle(x + 10, top + h - 11, w - 20, 5, PAL.deepShadow).setOrigin(0, 0.5);
    scene.add.rectangle(x + 10, top + h - 11, Math.max(2, (w - 20) * g.frac), 5, ready ? PAL.amber : 0xc9a24a).setOrigin(0, 0.5);
  });
  return top + h;
}
