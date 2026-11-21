import Phaser from 'phaser';
import { DISPLAY_FONT, FONT, GAME_W, HUD_FONT, PAL, hex } from '../config';
import { game } from '../state/game';
import { nine, stretch } from './skin';
import { addIcon } from './theme';

export const CURRENCY_BAR_H = 56;

/**
 * The preview's status bar: sigil and title on the left, Seals and Tithes as
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

  // logo.png (the title art, about 97 x 50) replaces the crest and the drawn title
  if (scene.textures.exists('logo')) {
    const logo = scene.add.image(12, mid, 'logo').setOrigin(0, 0.5).setDepth(5);
    if (logo.height > h - 6) logo.setScale((h - 6) / logo.height);
  } else {
    addIcon(scene, 28, mid, 'sigil', 30, PAL.amber).setDepth(5);
    scene.add.text(50, mid - 9, 'CRT', { fontFamily: HUD_FONT, fontSize: '12px', color: '#d79e6f' }).setOrigin(0, 0.5).setDepth(5);
    scene.add.text(50, mid + 7, 'CRUSADERS', { fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: '13px', color: hex(PAL.amber) }).setOrigin(0, 0.5).setDepth(5);
  }

  /** A framed chip; layout(value, right) sizes it and pins its right edge. Returns its left edge. */
  const chip = (icon: string, tint: number, label: string) => {
    // ui-chip.png skins the framed chip behind each currency
    const skin = nine(scene, 'ui-chip', 0, mid, 40, 38)?.setOrigin(1, 0.5).setDepth(5);
    const bg = skin ?? scene.add.rectangle(0, mid, 10, 38, 0x221820).setOrigin(1, 0.5).setStrokeStyle(1, 0x4b3538).setDepth(5);
    const ic = addIcon(scene, 0, mid, icon, 18, tint).setDepth(5);
    const num = scene.add.text(0, mid + 1, '', { fontFamily: HUD_FONT, fontSize: '16px', color: hex(PAL.ivory) }).setOrigin(0, 0.5).setDepth(5);
    const name = scene.add.text(0, mid, label, { fontFamily: FONT, fontSize: '18px', color: '#cab4a8' }).setOrigin(0, 0.5).setDepth(5);
    return (value: number, right: number) => {
      num.setText(String(value));
      const w = 10 + 18 + 7 + num.width + 7 + name.width + 10;
      bg.setPosition(right, mid).setSize(w, 38);
      const left = right - w;
      ic.setX(left + 10 + 9);
      num.setX(left + 10 + 18 + 7);
      name.setX(num.x + num.width + 7);
      return left;
    };
  };
  const tithes = chip('tithe', PAL.amber, 'Tithes');
  const seals = chip('seal', 0xd87988, 'Wax Seals');
  const refresh = () => {
    const left = tithes(game.save.tithes, GAME_W - 10);
    seals(game.save.seals, left - 8);
  };
  refresh();
  return refresh;
}
