import Phaser from 'phaser';
import { FONT, GAME_W, PAL, hex } from '../config';
import { CLASSES, RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { portraitKey } from '../ui/placeholderPortrait';
import { addTabBar } from '../ui/tabBar';

/** Home screen: title, a featured crusader, and the tab bar. */
export class SanctumScene extends Phaser.Scene {
  constructor() {
    super('Sanctum');
  }

  create() {
    this.cameras.main.setBackgroundColor(PAL.bg);
    this.add.text(GAME_W / 2, 64, 'CRT CRUSADERS', { fontFamily: FONT, fontSize: '40px', color: hex(PAL.amber) }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 108, 'The Sanctum', { fontFamily: FONT, fontSize: '20px', color: hex(PAL.steel) }).setOrigin(0.5);

    const featured = CRUSADERS.find((c) => c.rarity === 'UR') ?? CRUSADERS[0];
    const cy = 400;
    const scale = 3; // 128 -> 384, whole-number scaling keeps pixels crisp
    const size = 128 * scale;
    this.add.rectangle(GAME_W / 2, cy, size + 12, size + 12).setStrokeStyle(6, RARITY_COLOR[featured.rarity]);
    this.add.image(GAME_W / 2, cy, portraitKey(featured.id)).setDisplaySize(size, size);

    this.add.text(GAME_W / 2, cy + size / 2 + 40, featured.name, { fontFamily: FONT, fontSize: '28px', color: hex(PAL.ivory) }).setOrigin(0.5);
    this.add
      .text(GAME_W / 2, cy + size / 2 + 76, `${featured.rarity} · ${CLASSES[featured.classId].name}`, {
        fontFamily: FONT,
        fontSize: '18px',
        color: hex(RARITY_COLOR[featured.rarity]),
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_W / 2, cy + size / 2 + 130, `"${featured.hook}"`, {
        fontFamily: FONT,
        fontSize: '17px',
        fontStyle: 'italic',
        color: hex(PAL.steel),
        align: 'center',
        wordWrap: { width: GAME_W - 80 },
      })
      .setOrigin(0.5);

    addTabBar(this, 'Sanctum');
  }
}
