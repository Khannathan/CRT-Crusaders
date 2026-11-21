import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { CLASSES, RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { applyCrt } from '../fx/crt';
import { game, resetGame } from '../state/game';
import { saveSettings, settings } from '../state/settings';
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
    makeButton(this, 96, GAME_H - 128, 168, 52, 'Settings', () => this.showSettings(), { fontSize: 18 });
    makeButton(this, GAME_W - 96, GAME_H - 128, 168, 52, 'Reset save', () => this.confirmReset(), { fontSize: 18 });

    addTabBar(this, 'Sanctum');
  }

  private confirmReset() {
    const layer = this.add.container(0, 0).setDepth(20);
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.94).setInteractive());
    layer.add(
      this.add
        .text(GAME_W / 2, 360, 'Erase all progress?\n\nRecruits, Seals, Tithes and\ncrusade progress will be lost.', { ...style, fontSize: '22px' })
        .setOrigin(0.5),
    );
    const yes = makeButton(this, GAME_W / 2, 520, 300, 76, 'Erase and start over', () => {
      resetGame();
      this.scene.restart();
    }, { active: true });
    const no = makeButton(this, GAME_W / 2, 620, 300, 76, 'Keep my progress', () => layer.destroy());
    layer.add([yes.box, yes.text, no.box, no.text]);
  }

  private showSettings() {
    const layer = this.add.container(0, 0).setDepth(20);
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    const draw = () => {
      layer.removeAll(true);
      layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.9).setInteractive());
      layer.add(this.add.text(GAME_W / 2, 200, 'Settings', { ...style, fontSize: '30px', color: hex(PAL.amber) }).setOrigin(0.5));
      layer.add(this.add.text(GAME_W / 2, 280, 'CRT screen effect', { ...style, fontSize: '22px' }).setOrigin(0.5));
      const toggle = (on: boolean) => () => {
        settings.crt = on;
        saveSettings();
        applyCrt(this);
        draw();
      };
      for (const [i, on] of [true, false].entries()) {
        const b = makeButton(this, GAME_W / 2 + (i ? 90 : -90), 340, 160, 64, on ? 'On' : 'Off', toggle(on), { active: settings.crt === on });
        layer.add([b.box, b.text]);
      }
      layer.add(this.add.text(GAME_W / 2, 430, 'Strength', { ...style, fontSize: '22px', color: hex(settings.crt ? PAL.ivory : PAL.steel) }).setOrigin(0.5));
      const levels: [string, number][] = [['Subtle', 0.35], ['Standard', 0.6], ['Heavy', 1]];
      levels.forEach(([label, v], i) => {
        const b = makeButton(
          this,
          GAME_W / 2 + (i - 1) * 168,
          490,
          156,
          64,
          label,
          () => {
            settings.crtStrength = v;
            saveSettings();
            applyCrt(this);
            draw();
          },
          { active: settings.crt && settings.crtStrength === v, disabled: !settings.crt, fontSize: 19 },
        );
        layer.add([b.box, b.text]);
      });
      layer.add(
        this.add
          .text(GAME_W / 2, 590, 'Scanlines, colour bleed and screen curve.\nPortrait art is never changed underneath.', { ...style, fontSize: '16px', color: hex(PAL.steel) })
          .setOrigin(0.5),
      );
      const close = makeButton(this, GAME_W / 2, 720, 240, 72, 'Done', () => layer.destroy());
      layer.add([close.box, close.text]);
    };
    draw();
  }
}
