import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { CLASSES, RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import type { CrusaderDef } from '../data/types';
import { commit, game } from '../state/game';
import { MAX_VOW, RARITY_ORDER } from '../systems/gacha';
import { MAX_LEVEL, levelUpCost, statsFor } from '../systems/stats';
import { makeButton } from '../ui/button';
import { CURRENCY_BAR_H, addCurrencyBar } from '../ui/currencyBar';
import { portraitKey } from '../ui/placeholderPortrait';
import { addTabBar } from '../ui/tabBar';
import { PAD, addBackdrop, addBadge, addFrame, addHeading, addIcon, addScreenGlow, text } from '../ui/theme';

/** Every crusader: recruited ones first (highest rarity first), the rest as silhouettes. */
export class RosterScene extends Phaser.Scene {
  private openId?: string;

  constructor() {
    super('Roster');
  }

  init(data: { openId?: string }) {
    this.openId = data?.openId;
  }

  create() {
    addScreenGlow(this);
    addCurrencyBar(this);
    const owned = game.save.owned;
    const count = Object.keys(owned).length;
    const top = addHeading(this, 'Roster', CURRENCY_BAR_H + 10);
    this.add.text(GAME_W - PAD, top - 8, `${count} / ${CRUSADERS.length}`, text.hud(16, PAL.muted)).setOrigin(1, 1);

    const sorted = [...CRUSADERS].sort(
      (a, b) =>
        Number(!!owned[b.id]) - Number(!!owned[a.id]) ||
        RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity),
    );

    // Cards as in the preview: portrait, rarity badge, name and level underneath.
    const cols = 3;
    const gap = 9;
    const cw = (GAME_W - PAD * 2 - gap * (cols - 1)) / cols;
    const ph = 128;
    const ch = ph + 46;
    const y0 = top + 12;
    const party = new Set(game.save.lastParty);
    sorted.forEach((c, i) => {
      const left = PAD + (i % cols) * (cw + gap);
      const topY = y0 + Math.floor(i / cols) * (ch + gap);
      const x = left + cw / 2;
      const have = owned[c.id];
      const tint = RARITY_COLOR[c.rarity];
      const card = this.add.rectangle(x, topY + ch / 2, cw, ch, have ? 0x1e1620 : 0x151017).setStrokeStyle(1, PAL.armorShadow);
      if (have) {
        addBackdrop(this, portraitKey(c.id), x, topY + ph / 2, cw, ph, { fade: 0, focusY: 0.3 });
        this.add.rectangle(x, topY + ph, cw, 1, tint);
        addBadge(this, left + 4, topY + 4, c.rarity, tint, 12);
        if (party.has(c.id)) {
          this.add.rectangle(left + cw - 4, topY + 4, 22, 22, 0x170e15).setOrigin(1, 0).setStrokeStyle(1, 0x695045);
          addIcon(this, left + cw - 15, topY + 15, 'shield', 14, PAL.amber);
        }
        this.add.text(left + 8, topY + ph + 5, c.name.split(' ')[0], { ...text.body(19, PAL.ivory), fontStyle: '600' });
        this.add.text(left + 8, topY + ph + 28, `LV ${have.level}${have.vow ? `  VOW ${have.vow}` : ''}`, text.hud(12, PAL.muted));
      } else {
        const g = this.add.graphics();
        for (let r = 8; r > 0; r--) g.fillStyle(0x291c2b, 0.16).fillCircle(x, topY + ph / 2, (r / 8) * 80);
        addIcon(this, x, topY + ph / 2, 'lock', 30, 0x967b8e);
        this.add.rectangle(x, topY + ph, cw, 1, PAL.armorShadow);
        this.add.text(left + 8, topY + ph + 5, 'Unknown', { ...text.body(19, PAL.muted), fontStyle: '600' });
        this.add.text(left + 8, topY + ph + 28, 'UNDISCOVERED', text.hud(12, PAL.steel));
      }
      card.setInteractive({ useHandCursor: true });
      this.children.bringToTop(card);
      card.setFillStyle(0x000000, 0.001);
      card.on('pointerup', () => this.showDetail(c));
    });

    addTabBar(this, 'Roster');

    const reopen = CRUSADERS.find((c) => c.id === this.openId);
    if (reopen) this.showDetail(reopen);
  }

  private showDetail(c: CrusaderDef) {
    const layer = this.add.container(0, 0).setDepth(10);
    const have = game.save.owned[c.id];
    const cls = CLASSES[c.classId];
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 80 } };
    const shade = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.9).setInteractive();
    const panel = addFrame(this, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 });
    const size = 256;
    const py = 200;
    const frame = this.add.rectangle(GAME_W / 2, py, size + 10, size + 10, 0x150e17).setStrokeStyle(1, have ? RARITY_COLOR[c.rarity] : PAL.armorShadow);
    const img = this.add.image(GAME_W / 2, py, portraitKey(c.id)).setDisplaySize(size, size);
    layer.add([shade, ...panel, frame, img]);

    const close = makeButton(this, GAME_W / 2, GAME_H - 70, 240, 72, 'Close', () => layer.destroy());

    if (!have) {
      img.setTint(0x111111);
      layer.add([
        this.add.text(GAME_W / 2, 370, 'Not yet recruited', { ...style, fontSize: '26px' }).setOrigin(0.5),
        this.add.text(GAME_W / 2, 410, `${c.rarity} · ${cls.name}`, { ...style, fontSize: '18px', color: hex(PAL.steel) }).setOrigin(0.5),
        this.add.text(GAME_W / 2, 470, 'Find her at the Sealed Altar.', { ...style, fontSize: '18px', color: hex(PAL.steel) }).setOrigin(0.5),
        ...close.all,
      ]);
      return;
    }

    const st = statsFor(c, have);
    const cost = levelUpCost(have.level);
    const maxed = have.level >= MAX_LEVEL;
    layer.add([
      this.add.text(GAME_W / 2, 362, c.name.toUpperCase(), { ...style, ...text.display(26, 0xfff1d6) }).setOrigin(0.5),
      this.add.text(GAME_W / 2, 398, `${c.rarity} · ${cls.name} · ${cls.role}`, { ...style, fontSize: '18px', color: hex(RARITY_COLOR[c.rarity]) }).setOrigin(0.5),
      this.add.text(GAME_W / 2, 428, `${c.order} · age ${c.age}`, { ...style, fontSize: '16px', color: hex(PAL.steel) }).setOrigin(0.5),
      this.add.text(GAME_W / 2, 476, `Level ${have.level} / ${MAX_LEVEL}`, { ...style, fontSize: '22px', color: hex(PAL.amber) }).setOrigin(0.5),
      this.add
        .text(GAME_W / 2, 516, `HP ${st.hp}  ATK ${st.atk}  ARM ${st.armor}  SPD ${st.spd}  CRIT ${Math.round(st.crit * 100)}%`, { ...style, fontSize: '17px' })
        .setOrigin(0.5),
    ]);
    // Vow pips
    const pips: Phaser.GameObjects.GameObject[] = [
      this.add.text(GAME_W / 2 - 150, 560, 'Vows', { ...style, fontSize: '18px', color: hex(PAL.steel) }).setOrigin(0, 0.5),
    ];
    for (let v = 0; v < MAX_VOW; v++) {
      pips.push(
        this.add.circle(GAME_W / 2 - 50 + v * 40, 560, 12, v < have.vow ? PAL.oxblood : PAL.deepShadow).setStrokeStyle(2, v < have.vow ? PAL.amber : PAL.armorShadow),
      );
    }
    layer.add(pips);
    layer.add([
      this.add.text(GAME_W / 2, 606, cls.summary, { ...style, fontSize: '18px' }).setOrigin(0.5),
      ...(c.passive
        ? [this.add.text(GAME_W / 2, 650, `${c.passive.name}: ${c.passive.desc}`, { ...style, fontSize: '16px', color: hex(PAL.violet) }).setOrigin(0.5)]
        : []),
      this.add.text(GAME_W / 2, 704, `"${c.hook}"`, { ...style, fontSize: '16px', fontStyle: 'italic', color: hex(PAL.steel) }).setOrigin(0.5),
    ]);
    const canLevel = !maxed && game.save.tithes >= cost;
    const lvl = makeButton(
      this,
      GAME_W / 2,
      GAME_H - 160,
      300,
      76,
      maxed ? 'Max level' : `Level up · ${cost} Tithes`,
      () => {
        game.save.tithes -= cost;
        have.level += 1;
        commit();
        // rebuild the grid (new level label) and reopen this card
        this.scene.restart({ openId: c.id });
      },
      { disabled: !canLevel, active: canLevel, fontSize: 20 },
    );
    layer.add([...lvl.all, ...close.all]);
  }
}
