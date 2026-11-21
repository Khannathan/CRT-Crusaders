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
    this.cameras.main.setBackgroundColor(PAL.bg);
    addCurrencyBar(this);
    const owned = game.save.owned;
    const count = Object.keys(owned).length;
    this.add.text(GAME_W / 2, CURRENCY_BAR_H + 34, `Roster  ${count} / ${CRUSADERS.length}`, { fontFamily: FONT, fontSize: '28px', color: hex(PAL.amber) }).setOrigin(0.5);

    const sorted = [...CRUSADERS].sort(
      (a, b) =>
        Number(!!owned[b.id]) - Number(!!owned[a.id]) ||
        RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity),
    );

    const cols = 3;
    const cell = 160;
    const x0 = (GAME_W - cols * cell) / 2 + cell / 2;
    const y0 = CURRENCY_BAR_H + 70 + 72;
    sorted.forEach((c, i) => {
      const x = x0 + (i % cols) * cell;
      const y = y0 + Math.floor(i / cols) * 178;
      const have = owned[c.id];
      this.add.rectangle(x, y, 136, 136).setStrokeStyle(4, have ? RARITY_COLOR[c.rarity] : PAL.armorShadow);
      // whole-number (1x) scale keeps pixels crisp
      const img = this.add.image(x, y, portraitKey(c.id)).setDisplaySize(128, 128).setInteractive({ useHandCursor: true });
      if (!have) img.setTint(0x111111);
      img.on('pointerup', () => this.showDetail(c));
      const label = have ? `${c.name.split(' ')[0]}  Lv ${have.level}` : '?';
      this.add.text(x, y + 82, label, { fontFamily: FONT, fontSize: '16px', color: hex(have ? PAL.ivory : PAL.steel) }).setOrigin(0.5);
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
    const shade = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.95).setInteractive();
    const size = 256;
    const py = 200;
    const frame = this.add.rectangle(GAME_W / 2, py, size + 12, size + 12).setStrokeStyle(6, have ? RARITY_COLOR[c.rarity] : PAL.armorShadow);
    const img = this.add.image(GAME_W / 2, py, portraitKey(c.id)).setDisplaySize(size, size);
    layer.add([shade, frame, img]);

    const close = makeButton(this, GAME_W / 2, GAME_H - 70, 240, 72, 'Close', () => layer.destroy());

    if (!have) {
      img.setTint(0x111111);
      layer.add([
        this.add.text(GAME_W / 2, 370, 'Not yet recruited', { ...style, fontSize: '26px' }).setOrigin(0.5),
        this.add.text(GAME_W / 2, 410, `${c.rarity} · ${cls.name}`, { ...style, fontSize: '18px', color: hex(PAL.steel) }).setOrigin(0.5),
        this.add.text(GAME_W / 2, 470, 'Find her at the Sealed Altar.', { ...style, fontSize: '18px', color: hex(PAL.steel) }).setOrigin(0.5),
        close.box,
        close.text,
      ]);
      return;
    }

    const st = statsFor(c, have);
    const cost = levelUpCost(have.level);
    const maxed = have.level >= MAX_LEVEL;
    layer.add([
      this.add.text(GAME_W / 2, 362, c.name, { ...style, fontSize: '28px' }).setOrigin(0.5),
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
    layer.add([lvl.box, lvl.text, close.box, close.text]);
  }
}
