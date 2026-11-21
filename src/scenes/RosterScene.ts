import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { CLASSES, RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import type { CrusaderDef } from '../data/types';
import { makeButton } from '../ui/button';
import { portraitKey } from '../ui/placeholderPortrait';
import { addTabBar } from '../ui/tabBar';

/** Grid of every crusader; tap one for details. */
export class RosterScene extends Phaser.Scene {
  constructor() {
    super('Roster');
  }

  create() {
    this.cameras.main.setBackgroundColor(PAL.bg);
    this.add.text(GAME_W / 2, 48, 'Roster', { fontFamily: FONT, fontSize: '32px', color: hex(PAL.amber) }).setOrigin(0.5);

    const cols = 3;
    const cell = 160; // 128 portrait at 1x inside a 160 cell keeps pixels crisp
    const x0 = (GAME_W - cols * cell) / 2 + cell / 2;
    const y0 = 100 + cell / 2;
    CRUSADERS.forEach((c, i) => {
      const x = x0 + (i % cols) * cell;
      const y = y0 + Math.floor(i / cols) * (cell + 24);
      this.add.rectangle(x, y, 136, 136).setStrokeStyle(4, RARITY_COLOR[c.rarity]);
      const img = this.add.image(x, y, portraitKey(c.id)).setDisplaySize(128, 128).setInteractive({ useHandCursor: true });
      img.on('pointerup', () => this.showDetail(c));
      this.add
        .text(x, y + 80, c.name.split(' ')[0], { fontFamily: FONT, fontSize: '16px', color: hex(PAL.ivory) })
        .setOrigin(0.5);
    });

    addTabBar(this, 'Roster');
  }

  private showDetail(c: CrusaderDef) {
    const layer = this.add.container(0, 0).setDepth(10);
    const shade = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.94).setInteractive();
    const cls = CLASSES[c.classId];
    const size = 256;
    const frame = this.add.rectangle(GAME_W / 2, 240, size + 12, size + 12).setStrokeStyle(6, RARITY_COLOR[c.rarity]);
    const img = this.add.image(GAME_W / 2, 240, portraitKey(c.id)).setDisplaySize(size, size);
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 80 } };
    const name = this.add.text(GAME_W / 2, 400, c.name, { ...style, fontSize: '28px' }).setOrigin(0.5);
    const meta = this.add
      .text(GAME_W / 2, 440, `${c.rarity} · ${cls.name} · ${cls.role}`, { ...style, fontSize: '18px', color: hex(RARITY_COLOR[c.rarity]) })
      .setOrigin(0.5);
    const order = this.add.text(GAME_W / 2, 472, `${c.order} · age ${c.age}`, { ...style, fontSize: '16px', color: hex(PAL.steel) }).setOrigin(0.5);
    const role = this.add.text(GAME_W / 2, 530, cls.summary, { ...style, fontSize: '18px' }).setOrigin(0.5);
    const hook = this.add
      .text(GAME_W / 2, 610, `"${c.hook}"`, { ...style, fontSize: '17px', fontStyle: 'italic', color: hex(PAL.steel) })
      .setOrigin(0.5);
    const close = makeButton(this, GAME_W / 2, GAME_H - 160, 240, 72, 'Close', () => layer.destroy());
    layer.add([shade, frame, img, name, meta, order, role, hook, close.box, close.text]);
  }
}
