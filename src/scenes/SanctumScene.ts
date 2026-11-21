import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { CLASSES, RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { game, resetGame } from '../state/game';
import { RARITY_ORDER } from '../systems/gacha';
import { makeButton } from '../ui/button';
import { CURRENCY_BAR_H, addCurrencyBar } from '../ui/currencyBar';
import { portraitKey } from '../ui/placeholderPortrait';
import { addTabBar } from '../ui/tabBar';

/** Home screen: currencies, your best crusader, and the tab bar. */
export class SanctumScene extends Phaser.Scene {
  constructor() {
    super('Sanctum');
  }

  create() {
    this.cameras.main.setBackgroundColor(PAL.bg);
    addCurrencyBar(this);
    this.add.text(GAME_W / 2, CURRENCY_BAR_H + 48, 'CRT CRUSADERS', { fontFamily: FONT, fontSize: '40px', color: hex(PAL.amber) }).setOrigin(0.5);
    this.add.text(GAME_W / 2, CURRENCY_BAR_H + 90, 'The Sanctum', { fontFamily: FONT, fontSize: '20px', color: hex(PAL.steel) }).setOrigin(0.5);

    const owned = CRUSADERS.filter((c) => game.save.owned[c.id]);
    const cy = 400;
    const size = 384; // 128 x 3: whole-number scaling keeps pixels crisp

    if (!owned.length) {
      this.add.rectangle(GAME_W / 2, cy, size + 12, size + 12).setStrokeStyle(6, PAL.armorShadow);
      this.add
        .text(GAME_W / 2, cy, 'The Sanctum stands empty.\n\nYour first ten recruits\nawait at the Sealed Altar.', {
          fontFamily: FONT,
          fontSize: '22px',
          color: hex(PAL.steel),
          align: 'center',
        })
        .setOrigin(0.5);
      makeButton(this, GAME_W / 2, cy + size / 2 + 80, 300, 80, 'Go to the altar', () => this.scene.start('Recruit'), { active: true });
    } else {
      const featured = [...owned].sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity))[0];
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
        .text(GAME_W / 2, cy + size / 2 + 126, `"${featured.hook}"`, {
          fontFamily: FONT,
          fontSize: '17px',
          fontStyle: 'italic',
          color: hex(PAL.steel),
          align: 'center',
          wordWrap: { width: GAME_W - 80 },
        })
        .setOrigin(0.5);
    }

    // Prototype-only: wipe the save to replay the first-time flow.
    const reset = this.add
      .text(GAME_W - 16, GAME_H - 110, 'reset save', { fontFamily: FONT, fontSize: '14px', color: hex(PAL.armorShadow) })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    reset.on('pointerup', () => {
      resetGame();
      this.scene.restart();
    });

    addTabBar(this, 'Sanctum');
  }
}
