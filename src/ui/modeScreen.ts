import { sfx } from '../audio/sfx';
import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { makeButton } from './button';
import { CURRENCY_BAR_H, addCurrencyBar } from './currencyBar';
import { addTabBar, backOf } from './tabBar';
import { addGroupStrip, groupOf, isRootScreen, isTabRoot } from './nav';
import { PAD, addBackdrop, addHeading, addScreenGlow, noOrphan, text } from './theme';

/**
 * The shared frame for a Rite screen: glow, currency bar, heading with a line
 * of flavour (or its group's sub-tabs), a Back button to the screen it was reached from (its wing, the hub or the lobby), and the tab bar. Returns the y where
 * content may start and the currency bar's refresh.
 */
export function modeScreen(scene: Phaser.Scene, title: string, sub: string, back = backOf(scene.scene.key), bg?: string) {
  // A double tap on the button that opened this screen (Done, Back, a tab) must not land on
  // whatever sits under the finger here, so taps are held off for a moment after it opens.
  settleTaps(scene);
  // An optional faint backdrop, shown only once its art is in src/assets/ui.
  if (bg && scene.textures.exists(bg)) addBackdrop(scene, bg, GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, { alpha: 0.28, fade: 0.6, fadeColor: 0x0e0d11 });
  addScreenGlow(scene);
  const refresh = addCurrencyBar(scene);
  // A screen in a group (Duties, Sisters, the Altar) shows its sub-tabs where the title sits;
  // a screen reached straight from a tab needs no Back button.
  const key = scene.scene.key;
  let top: number;
  if (groupOf(key) && back !== key) {
    top = addGroupStrip(scene, CURRENCY_BAR_H + 4, title);
    if (sub) top = scene.add.text(PAD, top, noOrphan(sub), text.body(18, PAL.muted)).setWordWrapWidth(GAME_W - PAD * 2).getBottomRight().y + 4;
  } else top = addHeading(scene, title, CURRENCY_BAR_H + 10, sub);
  if (!isRootScreen(key) || (back === key && !isTabRoot(key))) makeButton(scene, GAME_W - PAD - 44, CURRENCY_BAR_H + 34, 88, 40, 'Back', () => scene.scene.start(back, {}), { fontSize: 16 });
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
  // "200 Gilt needed.", "Not now.": a refusal sounds like one.
  if (/\bneeded\b|^Not now|^Not enough/i.test(msg)) sfx('deny');
  const t = scene.add.text(GAME_W / 2, y, msg.split('\n').map(noOrphan).join('\n'), { ...text.body(19, PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 80 } }).setOrigin(0.5).setDepth(31);
  const bg = scene.add.rectangle(GAME_W / 2, y, t.width + 40, t.height + 26, 0x1b121c, 0.97).setStrokeStyle(1, PAL.amber).setDepth(30);
  scene.tweens.add({ targets: [t, bg], alpha: 0, delay: 3200, duration: 700, onComplete: () => (t.destroy(), bg.destroy()) });
}

/** Ignore taps for the first `ms` after a screen opens, so a double tap cannot fall through to it. */
export function settleTaps(scene: Phaser.Scene, ms = 200) {
  scene.input.enabled = false;
  scene.time.delayedCall(ms, () => { if (scene.input) scene.input.enabled = true; });
}
