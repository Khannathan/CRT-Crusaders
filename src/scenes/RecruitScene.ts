import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { commit, game } from '../state/game';
import { COST_ONE, COST_TEN, PITY_LIMIT, RARITY_ORDER, RATES, canPull, pull, type PullKind } from '../systems/gacha';
import { makeButton } from '../ui/button';
import { CURRENCY_BAR_H, addCurrencyBar } from '../ui/currencyBar';
import { portraitKey } from '../ui/placeholderPortrait';
import { TAB_BAR_H, addTabBar } from '../ui/tabBar';

/** The Sealed Altar: rates, pity counter, and the pull buttons. */
export class RecruitScene extends Phaser.Scene {
  constructor() {
    super('Recruit');
  }

  create() {
    this.cameras.main.setBackgroundColor(PAL.bg);
    addCurrencyBar(this);
    const s = game.save;

    this.add.text(GAME_W / 2, CURRENCY_BAR_H + 40, 'The Sealed Altar', { fontFamily: FONT, fontSize: '32px', color: hex(PAL.amber) }).setOrigin(0.5);

    // Banner: the three highest-rarity crusaders, UR in the middle
    const featured = [...CRUSADERS].sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity)).slice(0, 3);
    const order = [featured[1], featured[0], featured[2]];
    const bannerY = 300;
    order.forEach((c, i) => {
      const big = i === 1;
      const size = big ? 256 : 128;
      const x = GAME_W / 2 + (i - 1) * 190;
      const y = big ? bannerY : bannerY + 40;
      this.add.rectangle(x, y, size + 8, size + 8).setStrokeStyle(4, RARITY_COLOR[c.rarity]).setDepth(big ? 2 : 1);
      this.add.image(x, y, portraitKey(c.id)).setDisplaySize(size, size).setDepth(big ? 2 : 1).setAlpha(big ? 1 : 0.7);
    });
    this.add
      .text(GAME_W / 2, bannerY + 150, 'Every recruit can appear. Rates below.', { fontFamily: FONT, fontSize: '16px', color: hex(PAL.steel) })
      .setOrigin(0.5);

    const toPity = PITY_LIMIT - s.pity;
    this.add
      .text(GAME_W / 2, bannerY + 196, `SSR or better guaranteed within ${toPity} pull${toPity === 1 ? '' : 's'}`, {
        fontFamily: FONT,
        fontSize: '19px',
        color: hex(PAL.ivory),
      })
      .setOrigin(0.5);

    makeButton(this, GAME_W / 2, bannerY + 250, 200, 52, 'View rates', () => this.showRates(), { fontSize: 18 });

    const btnY = GAME_H - TAB_BAR_H - 70;
    const freeTen = !s.freeTenUsed;
    makeButton(this, GAME_W / 2 - 128, btnY, 236, 96, `Recruit ×1\n${COST_ONE} Seal`, () => this.doPull('one'), {
      disabled: !canPull(s, 'one'),
    });
    makeButton(
      this,
      GAME_W / 2 + 128,
      btnY,
      236,
      96,
      freeTen ? 'Recruit ×10\nFREE first time' : `Recruit ×10\n${COST_TEN} Seals`,
      () => this.doPull('ten'),
      { disabled: !canPull(s, 'ten'), active: true },
    );
    this.add
      .text(GAME_W / 2, btnY - 70, '×10 always includes an SR or better', { fontFamily: FONT, fontSize: '15px', color: hex(PAL.steel) })
      .setOrigin(0.5);

    addTabBar(this, 'Recruit');
  }

  private doPull(kind: PullKind) {
    const results = pull(game.save, kind);
    if (!results.length) return;
    commit();
    this.scene.start('Reveal', { results });
  }

  private showRates() {
    const layer = this.add.container(0, 0).setDepth(20);
    const shade = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.94).setInteractive();
    const style = { fontFamily: FONT, fontSize: '22px', color: hex(PAL.ivory) };
    const title = this.add.text(GAME_W / 2, 180, 'Recruitment rates', { ...style, fontSize: '30px', color: hex(PAL.amber) }).setOrigin(0.5);
    layer.add([shade, title]);
    RARITY_ORDER.forEach((r, i) => {
      const y = 270 + i * 56;
      const count = CRUSADERS.filter((c) => c.rarity === r).length;
      layer.add(this.add.text(110, y, r, { ...style, color: hex(RARITY_COLOR[r]) }).setOrigin(0, 0.5));
      layer.add(this.add.text(220, y, `${(RATES[r] * 100).toFixed(1)}%`, style).setOrigin(0, 0.5));
      layer.add(this.add.text(340, y, `${count} recruit${count === 1 ? '' : 's'}`, { ...style, fontSize: '18px', color: hex(PAL.steel) }).setOrigin(0, 0.5));
    });
    const notes = this.add
      .text(
        GAME_W / 2,
        560,
        `Within a rarity, each recruit is equally likely.\n×10 always includes an SR or better.\nThe ${PITY_LIMIT}th pull without an SSR or UR gives one.\nDuplicates add a Vow rank (max 5), then pay Tithes.`,
        { ...style, fontSize: '17px', color: hex(PAL.steel), align: 'center', lineSpacing: 8 },
      )
      .setOrigin(0.5);
    const close = makeButton(this, GAME_W / 2, GAME_H - 200, 240, 72, 'Close', () => layer.destroy());
    layer.add([notes, close.box, close.text]);
  }
}
