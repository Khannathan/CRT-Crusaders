import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { makeButton } from './button';
import { CURRENCY_BAR_H, addCurrencyBar } from './currencyBar';
import { addTabBar, tabOf } from './tabBar';
import { PAD, addHeading, addScreenGlow, text } from './theme';

/**
 * The shared frame for a Rite screen: glow, currency bar, heading with a line
 * of flavour, a Back button to the screen it was reached from (Sanctum, Crusade board or Cloister), and the tab bar. Returns the y where
 * content may start and the currency bar's refresh.
 */
export function modeScreen(scene: Phaser.Scene, title: string, sub: string, back = tabOf(scene.scene.key)) {
  addScreenGlow(scene);
  const refresh = addCurrencyBar(scene);
  const top = addHeading(scene, title, CURRENCY_BAR_H + 10, sub);
  makeButton(scene, GAME_W - PAD - 44, CURRENCY_BAR_H + 34, 88, 40, 'Back', () => scene.scene.start(back, {}), { fontSize: 16 });
  addTabBar(scene, scene.scene.key);
  return { top: top + 12, refresh };
}

/** "5h 12m" until a time. */
export function untilText(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m >= 60 * 24) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** A thin progress bar from `left` at `y`. */
export function progressBar(scene: Phaser.Scene, left: number, y: number, w: number, share: number, color: number = PAL.amber, h = 8) {
  const back = scene.add.rectangle(left, y, w, h, PAL.deepShadow).setOrigin(0, 0.5);
  const fill = scene.add.rectangle(left, y, Math.max(1, w * Math.min(1, share)), h, color).setOrigin(0, 0.5);
  return [back, fill] as const;
}


/** A framed notice over the lower screen that fades after a few seconds. */
export function toast(scene: Phaser.Scene, msg: string, y = GAME_H - 190) {
  const t = scene.add.text(GAME_W / 2, y, msg, { ...text.body(19, PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 80 } }).setOrigin(0.5).setDepth(31);
  const bg = scene.add.rectangle(GAME_W / 2, y, t.width + 40, t.height + 26, 0x1b121c, 0.97).setStrokeStyle(1, PAL.amber).setDepth(30);
  scene.tweens.add({ targets: [t, bg], alpha: 0, delay: 3200, duration: 700, onComplete: () => (t.destroy(), bg.destroy()) });
}
