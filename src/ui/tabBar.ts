import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { makeButton } from './button';

export const TAB_BAR_H = 88;

const TABS = [
  { label: 'Sanctum', scene: 'Sanctum' },
  { label: 'Recruit', scene: 'Recruit' },
  { label: 'Roster', scene: 'Roster' },
  { label: 'Crusade', scene: 'Crusade' },
] as const;

/** Bottom navigation, in thumb reach. */
export function addTabBar(scene: Phaser.Scene, current: string) {
  scene.add.rectangle(GAME_W / 2, GAME_H - TAB_BAR_H / 2, GAME_W, TAB_BAR_H, PAL.bg).setStrokeStyle(2, PAL.armorShadow);
  const w = GAME_W / TABS.length;
  TABS.forEach((t, i) => {
    makeButton(
      scene,
      w * i + w / 2,
      GAME_H - TAB_BAR_H / 2,
      w - 8,
      TAB_BAR_H - 16,
      t.label,
      () => {
        if (t.scene !== current) scene.scene.start(t.scene);
      },
      { active: t.scene === current, fontSize: 20 },
    );
  });
}
