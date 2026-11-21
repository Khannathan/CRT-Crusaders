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
import { PAD, addBackdrop, addBadge, addFrame, addHeading, addIcon, addScreenGlow, fade, text } from '../ui/theme';

/** Home screen: currencies, your best crusader, and the tab bar. */
export class SanctumScene extends Phaser.Scene {
  constructor() {
    super('Sanctum');
  }

  create() {
    addScreenGlow(this);
    addCurrencyBar(this);
    const top = addHeading(this, 'The Sanctum', CURRENCY_BAR_H + 16);

    const owned = CRUSADERS.filter((c) => game.save.owned[c.id]);
    const fw = GAME_W - PAD * 2;
    const fh = 420;
    const fx = GAME_W / 2;
    const fy = top + 14 + fh / 2;
    const bottom = fy + fh / 2;

    if (!owned.length) {
      addBackdrop(this, 'bg-altar', fx, fy, fw, fh, { alpha: 0.75, fade: 0.7 });
      addFrame(this, fx, fy, fw, fh);
      this.add
        .text(PAD + 24, bottom - 190, 'The Sanctum stands empty. No Sister keeps the vigil.', text.display(26, 0xfff1d6))
        .setShadow(0, 2, '#000000', 9, false, true);
      this.add.text(PAD + 24, bottom - 146, 'Your first ten Sisters await\nat the Sealed Altar.', { ...text.body(20, 0xd8c2bc), fontStyle: 'italic' });
      makeButton(this, PAD + 24 + 130, bottom - 56, 260, 64, 'Go to the altar', () => this.scene.start('Recruit'), { active: true, icon: 'seal' });
    } else {
      const featured = [...owned].sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity))[0];
      const tint = RARITY_COLOR[featured.rarity];
      addBackdrop(this, 'bg-hall', fx, fy, fw, fh, { alpha: 0.5, fade: 0 });
      // portrait fills the right of the card, faded into the hall on its left and bottom
      const ps = fh;
      this.add.image(GAME_W - PAD - ps / 2, fy, portraitKey(featured.id)).setDisplaySize(ps, ps);
      const g = this.add.graphics();
      const fadeW = 170;
      const left = GAME_W - PAD - ps;
      g.fillStyle(0x1d121c).fillRect(PAD, fy - fh / 2, left - PAD, fh);
      for (let i = 0; i < fadeW; i += 2) g.fillStyle(0x1d121c, 1 - i / fadeW).fillRect(left + i, fy - fh / 2, 2, fh);
      fade(this, fx, fy, fw, fh, 0.62, 0x150c15);
      addFrame(this, fx, fy, fw, fh);

      const tagY = fy - fh / 2 + 20;
      const tag = this.add.text(PAD + 44, tagY + 5, 'Sister of Note', text.hud(14, PAL.ivory));
      this.add.rectangle(PAD + 18, tagY, tag.width + 40, tag.height + 10, 0x1e121c, 0.93).setOrigin(0, 0).setStrokeStyle(1, 0x715044);
      this.children.bringToTop(tag);
      addIcon(this, PAD + 32, tagY + 5 + tag.height / 2, 'sigil', 14, PAL.amber);

      const cls = CLASSES[featured.classId].name;
      const nameY = bottom - 170;
      addBadge(this, PAD + 22, nameY - 40, featured.rarity, tint, 14);
      this.add.text(PAD + 22 + 50, nameY - 38, cls, text.body(20, PAL.amber));
      this.add
        .text(PAD + 22, nameY, featured.name.toUpperCase(), { ...text.display(30, 0xfff1d6), wordWrap: { width: fw - 40 } })
        .setShadow(0, 2, '#000000', 9, false, true);
      this.add.text(PAD + 22, nameY + 44, `\u201c${featured.hook}\u201d`, {
        ...text.body(19, 0xd8c2bc),
        fontStyle: 'italic',
        wordWrap: { width: fw - 60 },
      });
      makeButton(this, PAD + 22 + 95, bottom - 40, 190, 50, 'View Sister', () => this.scene.start('Roster'), {
        active: true,
        fontSize: 19,
        icon: 'book',
      });
    }

    // Two destination cards, as in the preview
    const dh = 150;
    const dw = (fw - 12) / 2;
    const dy = bottom + 14 + dh / 2;
    const dest = (x: number, art: string, eyebrow: string, title: string, label: string, to: string) => {
      addBackdrop(this, art, x, dy, dw, dh, { alpha: 0.85, fade: 0.85, fadeColor: 0x140e16 });
      addFrame(this, x, dy, dw, dh, { edge: PAL.armorShadow, ticks: false });
      this.add.text(x - dw / 2 + 12, dy - dh / 2 + 12, eyebrow, text.hud(12, PAL.amber));
      this.add.text(x - dw / 2 + 12, dy - dh / 2 + 30, title, { ...text.display(17, PAL.ivory), wordWrap: { width: dw - 20 } });
      makeButton(this, x - dw / 2 + 12 + 70, dy + dh / 2 - 30, 140, 42, label, () => this.scene.start(to), { fontSize: 18 });
    };
    const firstClear = !game.save.cleared.length;
    dest(PAD + dw / 2, 'bg-hall', 'CRUSADE', 'The Drowned\nOssuary', firstClear ? 'Begin' : 'View crusade', 'Crusade');
    dest(GAME_W - PAD - dw / 2, 'bg-altar', 'RECRUITMENT', 'The Sealed\nAltar', 'Visit altar', 'Recruit');

    // Prototype-only: settings, and wiping the save to replay the first-time flow.
    const linkY = dy + dh / 2 + 34;
    this.textLink(PAD + 4, linkY, 'Settings', () => this.showSettings());
    this.textLink(GAME_W - PAD - 4, linkY, 'Reset save', () => this.confirmReset(), 1);

    addTabBar(this, 'Sanctum');
  }

  /** The preview's underlined gold text button. */
  private textLink(x: number, y: number, label: string, onTap: () => void, originX = 0) {
    const t = this.add.text(x, y, label, text.body(20, PAL.amber)).setOrigin(originX, 0.5);
    const line = this.add.rectangle(t.x - t.width * originX, y + 13, t.width, 1, 0x926642).setOrigin(0, 0.5);
    t.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-10, -14, t.width + 20, t.height + 28), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    t.on('pointerup', onTap);
    return [t, line];
  }

  private confirmReset() {
    const layer = this.add.container(0, 0).setDepth(20);
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.9).setInteractive());
    layer.add(addFrame(this, GAME_W / 2, 480, GAME_W - 40, 440, { fill: 0x241925 }));
    layer.add(
      this.add
        .text(GAME_W / 2, 360, 'Burn the records?\n\nSisters, Seals, Tithes and every\ncrusade will be forgotten.', { ...style, fontSize: '22px' })
        .setOrigin(0.5),
    );
    const yes = makeButton(this, GAME_W / 2, 520, 300, 76, 'Burn it all', () => {
      resetGame();
      this.scene.restart();
    }, { active: true });
    const no = makeButton(this, GAME_W / 2, 620, 300, 76, 'Keep my progress', () => layer.destroy());
    layer.add([...yes.all, ...no.all]);
  }

  private showSettings() {
    const layer = this.add.container(0, 0).setDepth(20);
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    const draw = () => {
      layer.removeAll(true);
      layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.88).setInteractive());
      layer.add(addFrame(this, GAME_W / 2, 460, GAME_W - 40, 640, { fill: 0x241925 }));
      layer.add(this.add.text(GAME_W / 2, 200, 'Settings', text.display(30, PAL.amber)).setOrigin(0.5));
      layer.add(this.add.text(GAME_W / 2, 280, 'CRT screen effect', { ...style, fontSize: '22px' }).setOrigin(0.5));
      const toggle = (on: boolean) => () => {
        settings.crt = on;
        saveSettings();
        applyCrt(this);
        draw();
      };
      for (const [i, on] of [true, false].entries()) {
        const b = makeButton(this, GAME_W / 2 + (i ? 90 : -90), 340, 160, 64, on ? 'On' : 'Off', toggle(on), { active: settings.crt === on });
        layer.add(b.all);
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
        layer.add(b.all);
      });
      layer.add(
        this.add
          .text(GAME_W / 2, 590, 'Scanlines, colour bleed and screen curve.\nPortrait art is never changed underneath.', { ...style, fontSize: '16px', color: hex(PAL.steel) })
          .setOrigin(0.5),
      );
      const close = makeButton(this, GAME_W / 2, 720, 240, 72, 'Done', () => layer.destroy());
      layer.add(close.all);
    };
    draw();
  }
}
