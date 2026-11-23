import Phaser from 'phaser';
import { FONT, GAME_W, HUD_FONT, PAL, hex } from '../config';
import { commit, game } from '../state/game';
import { accountPower, formatPower } from '../systems/power';
import { ROMAN_RANK, giftsWaiting, rankInfo } from '../systems/rank';
import { keeperOf } from '../systems/keeper';
import { hasFullBody, hasSplash, portraitKey } from './placeholderPortrait';
import { notePower } from '../systems/powerGrowth';
import { giltOf } from '../systems/currency';
import { addFullscreenButton } from './fullscreen';
import { nine, stretch } from './skin';
import { addIcon } from './theme';
import { showSources } from './sources';
import type { ResourceId } from '../systems/sources';

export const CURRENCY_BAR_H = 56;

/** Chip numbers stay short: 64150, 123K, 1.23M. */
export function chipNumber(n: number) {
  if (n < 100_000) return String(n);
  if (n < 1_000_000) return `${Math.floor(n / 1000)}K`;
  return `${(Math.floor(n / 10_000) / 100).toFixed(2)}M`;
}

/**
 * The preview's status bar: sigil and title on the left, Gilt, Seals and Tithes as
 * framed chips on the right. Returns a refresh function.
 */
export function addCurrencyBar(scene: Phaser.Scene) {
  const h = CURRENCY_BAR_H;
  const mid = h / 2;
  // ui-topbar.png (540 x 56) replaces the drawn bar
  if (!stretch(scene, 'ui-topbar', GAME_W / 2, mid, GAME_W, h)?.setDepth(5)) {
    scene.add.rectangle(GAME_W / 2, mid, GAME_W, h, 0x18121a).setDepth(5);
    scene.add.rectangle(GAME_W / 2, h - 0.5, GAME_W, 1, PAL.armorShadow).setDepth(5);
  }

  // The crest (top left): your Keeper's face, Rank of Faith and Power. Tap it for your crest
  // sheet (Rank, Settings, Chronicle, save tools). The logo lives on the title screen now.
  const save = game.save;
  const keeper = keeperOf(save, (id) => hasSplash(id) || hasFullBody(id));
  const cx = 10 + 22;
  scene.add.rectangle(cx, mid - 4, 44, 44, 0x000000).setStrokeStyle(2, PAL.goldEdge).setDepth(5);
  if (keeper && scene.textures.exists(portraitKey(keeper.id))) scene.add.image(cx, mid - 4, portraitKey(keeper.id)).setDisplaySize(40, 40).setDepth(5);
  else addIcon(scene, cx, mid - 4, 'sigil', 28, PAL.amber).setDepth(5);
  const rank = scene.add.text(cx, mid + 18, ROMAN_RANK(rankInfo(save).rank), { fontFamily: HUD_FONT, fontSize: '11px', color: hex(0xfff1d6), backgroundColor: '#6b1a24', padding: { x: 3, y: 1 } }).setOrigin(0.5, 0.5).setDepth(6);
  if (giftsWaiting(save).length) scene.add.circle(cx + 22, mid - 24, 5, PAL.amber).setStrokeStyle(2, 0x1b121c).setDepth(6);
  scene.add.text(62, mid - 10, 'POWER', { fontFamily: HUD_FONT, fontSize: '11px', color: hex(PAL.steel) }).setOrigin(0, 0.5).setDepth(5);
  const power = scene.add.text(62, mid + 8, formatPower(accountPower(save)), { fontFamily: HUD_FONT, fontSize: '16px', color: hex(PAL.amber) }).setOrigin(0, 0.5).setDepth(5);
  const crestW = Math.max(108, 62 + power.width + 6, rank.x + rank.width / 2 + 4);
  if (scene.scene.key !== 'Profile') {
    const hit = scene.add.zone(crestW / 2, mid, crestW, CURRENCY_BAR_H).setDepth(6).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => scene.scene.start('Profile'));
  }

  /** A framed chip; layout(value, right) sizes it and pins its right edge. Returns its left edge. */
  const chip = (icon: string, tint: number, label: string, id: ResourceId) => {
    // tap a chip to see where that currency comes from
    const hit = scene.add.zone(0, mid, 40, 38).setDepth(6).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => showSources(scene, id));
    // ui-chip.png skins the framed chip behind each currency
    const skin = nine(scene, 'ui-chip', 0, mid, 40, 38)?.setOrigin(1, 0.5).setDepth(5);
    const bg = skin ?? scene.add.rectangle(0, mid, 10, 38, 0x221820).setOrigin(1, 0.5).setStrokeStyle(1, 0x4b3538).setDepth(5);
    const ic = addIcon(scene, 0, mid, icon, 18, tint).setDepth(5);
    const num = scene.add.text(0, mid + 1, '', { fontFamily: HUD_FONT, fontSize: '16px', color: hex(PAL.ivory) }).setOrigin(0, 0.5).setDepth(5);
    const name = scene.add.text(0, mid, label, { fontFamily: FONT, fontSize: '18px', color: '#cab4a8' }).setOrigin(0, 0.5).setDepth(5);
    return (value: number, right: number, named = true) => {
      num.setText(chipNumber(value));
      name.setVisible(named);
      const w = 10 + 18 + 7 + num.width + (named ? 7 + name.width : 0) + 10;
      bg.setPosition(right, mid).setSize(w, 38);
      hit.setPosition(right - w / 2, mid).setSize(w, 38);
      const left = right - w;
      ic.setX(left + 10 + 9);
      num.setX(left + 10 + 18 + 7);
      name.setX(num.x + num.width + 7);
      return left;
    };
  };
  const tithes = chip('tithe', PAL.amber, 'Tithes', 'tithes');
  const seals = chip('seal', 0xd87988, 'Seals', 'seals');
  const gilt = chip('gilt', 0xf2d27a, 'Gilt', 'gilt');
  // full-screen toggle in the top-right corner, chips to its left
  addFullscreenButton(scene, GAME_W - 22, mid, 20);
  // the crest ends about here; if the chips would run under it, drop their word labels (the icons stay)
  const logoRight = crestW + 4;
  const refresh = () => {
    const lay = (named: boolean) => gilt(giltOf(game.save), seals(game.save.seals, tithes(game.save.tithes, GAME_W - 42, named) - 6, named) - 6, named);
    if (lay(true) < logoRight) lay(false);
  };
  refresh();
  // Power you can feel: a rise since the last screen pops under the bar, and a
  // milestone crossed pays its Gilt and gets a banner of its own.
  const note = notePower(game.save);
  if (note.gain > 0 || note.reached.length) {
    commit();
    refresh();
    showPowerPop(scene, note.gain, note.reached);
  }
  return refresh;
}

function showPowerPop(scene: Phaser.Scene, gain: number, reached: { at: number; name: string; gilt: number }[]) {
  const y = CURRENCY_BAR_H + 150;
  const m = reached.at(-1);
  const parts: Phaser.GameObjects.GameObject[] = [];
  const head = scene.add.text(0, 0, gain > 0 ? `+${formatPower(gain)} POWER` : 'POWER', { fontFamily: HUD_FONT, fontSize: '30px', color: hex(PAL.amber) }).setOrigin(0.5, 0);
  parts.push(head);
  let h = head.height;
  if (m) {
    const sub = scene.add
      .text(0, h + 8, `${formatPower(m.at)} REACHED  ·  ${m.name.toUpperCase()}\n+${reached.reduce((n, r) => n + r.gilt, 0)} GILT`, { fontFamily: HUD_FONT, fontSize: '16px', color: hex(0xf2d27a), align: 'center', lineSpacing: 4 })
      .setOrigin(0.5, 0);
    parts.push(sub);
    h += 8 + sub.height;
  }
  const w = Math.max(...parts.map((p) => (p as Phaser.GameObjects.Text).width)) + 48;
  const box = scene.add.rectangle(0, -14, w, h + 28, 0x140d14, 0.96).setOrigin(0.5, 0).setStrokeStyle(2, m ? 0xf2d27a : PAL.amber);
  const pop = scene.add.container(GAME_W / 2, y, [box, ...parts]).setDepth(60).setAlpha(0).setScale(0.6);
  scene.tweens.add({ targets: pop, alpha: 1, scale: 1, duration: 280, delay: 250, ease: 'Back.Out' });
  scene.tweens.add({ targets: pop, alpha: 0, y: y - 24, duration: 450, delay: m ? 2800 : 1600, onComplete: () => pop.destroy() });
}
