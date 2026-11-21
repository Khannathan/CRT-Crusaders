import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { addIcon } from './theme';

export const TAB_BAR_H = 88;

const TABS = [
  { label: 'Sanctum', scene: 'Sanctum', icon: 'sanctum' },
  { label: 'Recruit', scene: 'Recruit', icon: 'seal' },
  { label: 'Roster', scene: 'Roster', icon: 'roster' },
  { label: 'Crusade', scene: 'Crusade', icon: 'blade' },
] as const;

/** Bottom navigation, in thumb reach: pixel icon over label, gold edge on the current tab. */
export function addTabBar(scene: Phaser.Scene, current: string) {
  const top = GAME_H - TAB_BAR_H;
  const g = scene.add.graphics().setDepth(5);
  // rail gradient (#20161c -> #151016) and top hairline
  for (let i = 0; i < 8; i++) g.fillStyle(i < 3 ? 0x1d151b : 0x161117).fillRect(0, top + (i * TAB_BAR_H) / 8, GAME_W, TAB_BAR_H / 8 + 1);
  g.fillStyle(PAL.armorShadow).fillRect(0, top, GAME_W, 1);

  const w = GAME_W / TABS.length;
  TABS.forEach((t, i) => {
    const on = t.scene === current;
    const cx = w * i + w / 2;
    const cy = top + TAB_BAR_H / 2;
    const bw = w - 8;
    const bh = TAB_BAR_H - 14;
    const box = scene.add.rectangle(cx, cy, bw, bh, on ? 0x3a1d29 : 0x000000, on ? 1 : 0.001).setDepth(5);
    if (on) {
      box.setStrokeStyle(1, 0x694041);
      scene.add.rectangle(cx, cy - bh / 2 + 1, bw, 3, PAL.goldEdge).setDepth(5);
    }
    addIcon(scene, cx, cy - 13, t.icon, 24, on ? PAL.amber : 0xae8b73).setDepth(5);
    scene.add
      .text(cx, cy + 17, t.label, { fontFamily: FONT, fontSize: '20px', color: hex(on ? PAL.amber : PAL.muted) })
      .setOrigin(0.5)
      .setDepth(5);
    box.setInteractive({ useHandCursor: true });
    box.on('pointerup', () => {
      if (!on) scene.scene.start(t.scene);
    });
  });
}
