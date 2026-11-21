import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { addTabBar } from '../ui/tabBar';

/** Stand-in for tabs that later steps build (Recruit in step 2, Crusade in step 3). */
export class ComingSoonScene extends Phaser.Scene {
  constructor(
    private readonly key: string,
    private readonly note: string,
  ) {
    super(key);
  }

  create() {
    this.cameras.main.setBackgroundColor(PAL.bg);
    this.add.text(GAME_W / 2, 48, this.key, { fontFamily: FONT, fontSize: '32px', color: hex(PAL.amber) }).setOrigin(0.5);
    this.add
      .text(GAME_W / 2, GAME_H / 2 - 60, this.note, {
        fontFamily: FONT,
        fontSize: '20px',
        color: hex(PAL.steel),
        align: 'center',
        wordWrap: { width: GAME_W - 80 },
      })
      .setOrigin(0.5);
    addTabBar(this, this.key);
  }
}
