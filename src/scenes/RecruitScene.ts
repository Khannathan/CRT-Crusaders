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
import { PAD, addBackdrop, addBadge, addFrame, addHeading, addScreenGlow, text } from '../ui/theme';

/** The Sealed Altar: rates, pity counter, and the pull buttons. */
export class RecruitScene extends Phaser.Scene {
  constructor() {
    super('Recruit');
  }

  create() {
    addScreenGlow(this);
    addCurrencyBar(this);
    const s = game.save;
    const top = addHeading(this, 'The Sealed Altar', CURRENCY_BAR_H + 16);

    // Banner: the three highest-rarity crusaders before the altar, the best in the middle
    const bw = GAME_W - PAD * 2;
    const bh = 370;
    const by = top + 14 + bh / 2;
    addBackdrop(this, 'bg-altar', GAME_W / 2, by, bw, bh, { fade: 0.2, focusY: 0.35 });
    addFrame(this, GAME_W / 2, by, bw, bh);
    const featured = [...CRUSADERS].sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity)).slice(0, 3);
    const order = [featured[1], featured[0], featured[2]];
    [0, 2, 1].forEach((i) => {
      const c = order[i];
      const big = i === 1; // drawn last so it overlaps its neighbours
      const size = big ? 230 : 140;
      const x = GAME_W / 2 + (i - 1) * 168;
      const y = by + (big ? 0 : 20);
      const tint = RARITY_COLOR[c.rarity];
      this.add.rectangle(x, y, size + 12, size + 12, big ? 0x241720 : 0x170f1b);
      this.add.image(x, y, portraitKey(c.id)).setDisplaySize(size, size);
      this.add.rectangle(x, y, size, size).setStrokeStyle(1, tint);
      addBadge(this, x - size / 2 + 6, y + size / 2 - 30, c.rarity, tint, 13);
    });

    // Pool panel
    const px = PAD;
    const pw = GAME_W - PAD * 2;
    let y = by + bh / 2 + 12;
    const poolH = 132;
    this.add.rectangle(GAME_W / 2, y + poolH / 2, pw, poolH, PAL.deepShadow).setStrokeStyle(1, PAL.armorShadow);
    this.add.text(px + 16, y + 12, 'Those who may answer', text.body(25, PAL.ivory)).setFontStyle('600');
    const toPity = PITY_LIMIT - s.pity;
    this.add.text(px + 16, y + 46, 'Any Sister may answer the call.', text.body(19, PAL.muted));
    this.add.text(px + 16, y + 70, `SSR or better within ${toPity} pull${toPity === 1 ? '' : 's'}.`, text.body(19, PAL.amber)).setFontStyle('600');
    makeButton(this, GAME_W - PAD - 16 - 75, y + 84, 150, 46, 'View rates', () => this.showRates(), { fontSize: 18, icon: 'book' });

    // Offer panel
    y += poolH + 10;
    const offerH = GAME_H - TAB_BAR_H - 12 - y;
    this.add.rectangle(GAME_W / 2, y + offerH / 2, pw, offerH, PAL.deepShadow).setStrokeStyle(1, PAL.armorShadow);
    this.add.text(px + 16, y + 10, 'Offer Wax Seals', text.body(25, PAL.ivory)).setFontStyle('600');
    this.add.text(px + 16, y + 42, 'Ten oaths always bring an SR or better.', text.body(18, PAL.muted));
    const btnY = y + offerH - 58;
    const half = (pw - 32 - 10) / 2;
    const freeTen = !s.freeTenUsed;
    makeButton(this, px + 16 + half / 2, btnY, half, 84, `Recruit ×1\n${COST_ONE} Seal`, () => this.doPull('one'), {
      disabled: !canPull(s, 'one'),
    });
    makeButton(
      this,
      px + 16 + half + 10 + half / 2,
      btnY,
      half,
      84,
      freeTen ? 'Recruit ×10\nFree first time' : `Recruit ×10\n${COST_TEN} Seals`,
      () => this.doPull('ten'),
      { disabled: !canPull(s, 'ten'), active: true },
    );

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
    const shade = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.85).setInteractive();
    const style = { fontFamily: FONT, fontSize: '22px', color: hex(PAL.ivory) };
    const panel = addFrame(this, GAME_W / 2, 470, GAME_W - 40, 640, { fill: 0x241925 });
    const title = this.add.text(GAME_W / 2, 200, 'Recruitment rates', text.display(28, PAL.amber)).setOrigin(0.5);
    layer.add([shade, ...panel, title]);
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
        `Within a rarity, each Sister is equally likely.\n×10 always includes an SR or better.\nThe ${PITY_LIMIT}th pull without an SSR or UR gives one.\nDuplicates add a Vow rank (max 5), then pay Tithes.`,
        { ...style, fontSize: '17px', color: hex(PAL.steel), align: 'center', lineSpacing: 8 },
      )
      .setOrigin(0.5);
    const close = makeButton(this, GAME_W / 2, GAME_H - 250, 240, 72, 'Close', () => layer.destroy());
    layer.add([notes, ...close.all]);
  }
}
