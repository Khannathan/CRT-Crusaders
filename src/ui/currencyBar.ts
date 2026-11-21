import Phaser from 'phaser';
import { FONT, GAME_W, PAL, hex } from '../config';
import { game } from '../state/game';

export const CURRENCY_BAR_H = 44;

/** Seals and Tithes along the top edge. Returns a refresh function. */
export function addCurrencyBar(scene: Phaser.Scene) {
  scene.add.rectangle(GAME_W / 2, CURRENCY_BAR_H / 2, GAME_W, CURRENCY_BAR_H, PAL.deepShadow).setDepth(5);
  const style = { fontFamily: FONT, fontSize: '19px', color: hex(PAL.ivory) };
  scene.add.circle(28, CURRENCY_BAR_H / 2, 9, PAL.oxblood).setStrokeStyle(2, PAL.amber).setDepth(5);
  const seals = scene.add.text(44, CURRENCY_BAR_H / 2, '', style).setOrigin(0, 0.5).setDepth(5);
  scene.add.rectangle(GAME_W / 2 + 28, CURRENCY_BAR_H / 2, 14, 14, PAL.bronze).setAngle(45).setDepth(5);
  const tithes = scene.add.text(GAME_W / 2 + 44, CURRENCY_BAR_H / 2, '', style).setOrigin(0, 0.5).setDepth(5);
  const refresh = () => {
    seals.setText(`${game.save.seals} Wax Seals`);
    tithes.setText(`${game.save.tithes} Tithes`);
  };
  refresh();
  return refresh;
}
