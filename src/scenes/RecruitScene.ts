import Phaser from 'phaser';
import { music } from '../audio/music';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { CLASSES } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { ORDERS, ORDER_LIST } from '../data/orders';
import { sigilKey } from '../ui/icons';
import { commit, game } from '../state/game';
import { COST_ONE, COST_TEN, PITY_LIMIT, RARITY_ORDER, RATES, bannerPool, SPARK, UR_HARD, UR_SOFT, canPull, claimSpark, pull, shardsOf, urPityLeft, type PullKind } from '../systems/gacha';
import { makeButton } from '../ui/button';
import { CURRENCY_BAR_H, addCurrencyBar } from '../ui/currencyBar';
import { portraitKey } from '../ui/placeholderPortrait';
import { TAB_BAR_H, addTabBar } from '../ui/tabBar';
import { PAD, addBackdrop, addBadge, addFrame, addHeading, addPanel, addScreenGlow, text } from '../ui/theme';
import { holdForCard, justHeld } from '../ui/sisterCard';
import { addScrollArea } from '../ui/scroll';
import { makePlaceholderPortrait } from '../ui/placeholderPortrait';

/** The Sealed Altar: rates, pity counter, and the pull buttons. */
export class RecruitScene extends Phaser.Scene {
  constructor() {
    super('Recruit');
  }

  create() {
    addScreenGlow(this);
    music.preload('ur');
    addCurrencyBar(this);
    const s = game.save;
    const top = addHeading(this, 'The Sealed Altar', CURRENCY_BAR_H + 16);
    makeButton(this, GAME_W - PAD - 62, CURRENCY_BAR_H + 38, 124, 44, 'Record', () => this.scene.start('PullHistory'), { fontSize: 16, icon: 'book' });

    // Order banner: pick an Order with ‹ ›; its UR is the target, its two SSRs are boosted.
    const banner = this.currentBanner();
    const ord = ORDERS[banner.order];
    const urs = CRUSADERS.filter((c) => c.order === ord.name && c.rarity === 'UR');
    const bw = GAME_W - PAD * 2;
    const bh = 430;
    const by = top + 12 + bh / 2;
    const bTop = by - bh / 2;
    const art = this.textures.exists(`banner-${ord.id}`) ? `banner-${ord.id}` : 'bg-altar';
    addBackdrop(this, art, GAME_W / 2, by, bw, bh, { fade: 0.55, fadeColor: 0x140b12, focusY: 0.35 });
    this.add.rectangle(GAME_W / 2, by, bw, bh, ord.color, 0.12);
    addFrame(this, GAME_W / 2, by, bw, bh, { edge: ord.color });
    const i = ORDER_LIST.indexOf(ord);
    const step = (d: number) => {
      const next = ORDER_LIST[(i + d + ORDER_LIST.length) % ORDER_LIST.length];
      s.banner = { order: next.name, target: CRUSADERS.find((c) => c.order === next.name && c.rarity === 'UR')!.id };
      commit();
      this.scene.restart();
    };
    // ui-arrow.png (pointing right; flipped for left) replaces the ‹ › labels when present
    const arrow = this.textures.exists('ui-arrow');
    makeButton(this, PAD + 34, bTop + 46, 48, 56, arrow ? '' : '‹', () => step(-1), { fontSize: 26 });
    makeButton(this, GAME_W - PAD - 34, bTop + 46, 48, 56, arrow ? '' : '›', () => step(1), { fontSize: 26 });
    if (arrow) {
      this.add.image(PAD + 34, bTop + 46, 'ui-arrow').setDisplaySize(24, 24).setFlipX(true);
      this.add.image(GAME_W - PAD - 34, bTop + 46, 'ui-arrow').setDisplaySize(24, 24);
    }
    this.add.image(GAME_W / 2, bTop + 34, sigilKey(ord.id)).setDisplaySize(44, 44);
    this.add.text(GAME_W / 2, bTop + 72, ord.name.toUpperCase(), text.display(22, 0xfff1d6)).setOrigin(0.5).setShadow(0, 2, '#000000', 8, false, true);
    this.add
      .text(GAME_W / 2, bTop + 100, `"${ord.creed}"`, { ...text.body(17, 0xe1cabf), fontStyle: 'italic', align: 'center', wordWrap: { width: bw - 120 } })
      .setOrigin(0.5, 0);
    this.add.text(GAME_W / 2, bTop + 140, `BANNER ${i + 1} / ${ORDER_LIST.length}`, text.hud(12, PAL.muted)).setOrigin(0.5);

    // The Order's UR in the middle (the target), its two SSRs either side (boosted on this banner).
    const ssrs = CRUSADERS.filter((c) => c.order === ord.name && c.rarity === 'SSR');
    const cards: { c: (typeof CRUSADERS)[number]; x: number; size: number; label: string }[] = [
      ...urs.slice(0, 1).map((c) => ({ c, x: GAME_W / 2, size: 168, label: 'TARGET' })),
      ...ssrs.slice(0, 2).map((c, k) => ({ c, x: GAME_W / 2 + (k === 0 ? -1 : 1) * 168, size: 108, label: 'SSR UP' })),
    ];
    for (const { c, x, size, label } of cards) {
      const y = bTop + 168 + 84 + (size < 168 ? 20 : 0);
      const ur = c.rarity === 'UR';
      if (ur) {
        const glow = this.add.rectangle(x, y, size + 16, size + 16).setStrokeStyle(4, PAL.amber);
        this.tweens.add({ targets: glow, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
      }
      this.add.rectangle(x, y, size + 8, size + 8, 0x170f1b).setStrokeStyle(1, RARITY_COLOR[c.rarity]);
      const img = this.add.image(x, y, portraitKey(c.id)).setDisplaySize(size, size);
      holdForCard(this, img, c.id);
      addBadge(this, x - size / 2 + 4, y - size / 2 + 4, label, ur ? PAL.amber : RARITY_COLOR.SSR, ur ? 12 : 10);
      this.add.text(x, y + size / 2 + 14, ur ? c.name : c.name.split(' ')[0], { ...text.body(ur ? 18 : 15, ur ? 0xfff1d6 : PAL.ivory), fontStyle: '600' }).setOrigin(0.5);
      this.add.text(x, y + size / 2 + 34, (c.title ?? CLASSES[c.classId].name).toUpperCase(), text.hud(ur ? 11 : 9, PAL.muted)).setOrigin(0.5);
    }

    // Banner rules and pity
    const px = PAD;
    const pw = GAME_W - PAD * 2;
    let y = by + bh / 2 + 10;
    const poolH = 150;
    addPanel(this, GAME_W / 2 - pw / 2, y, pw, poolH);
    const target = CRUSADERS.find((c) => c.id === banner.target)!;
    this.add
      .text(px + 16, y + 12, s.urGuaranteed ? `Next UR is ${target.name.split(' ')[0]}, sworn.` : `A UR here is ${target.name.split(' ')[0]} half the time,`, text.body(19, PAL.ivory))
      .setFontStyle('600');
    this.add.text(px + 16, y + 38, s.urGuaranteed ? 'The last UR strayed. The next one will not.' : 'and always after one that strays.', text.body(18, PAL.muted));
    // Pity counters: UR (shared by every banner) and SSR
    const toPity = PITY_LIMIT - s.pity;
    const urLeft = urPityLeft(s);
    this.add.text(px + 16, y + 66, `UR within ${urLeft} · SSR+ within ${toPity}`, text.body(18, PAL.amber)).setFontStyle('600');
    // Relic Shards for this Order: SPARK buys one of its URs
    const shards = shardsOf(s, ord.name);
    this.add.text(px + 16, y + 98, `RELIC SHARDS · ${ord.name.toUpperCase()}`, text.hud(11, PAL.steel));
    const barW = pw - 32 - 156;
    this.add.rectangle(px + 16, y + 126, barW, 8, PAL.deepShadow).setOrigin(0, 0.5);
    this.add.rectangle(px + 16, y + 126, Math.max(1, barW * Math.min(1, shards / SPARK)), 8, RARITY_COLOR.UR).setOrigin(0, 0.5);
    this.add.text(px + 16 + barW, y + 112, `${shards} / ${SPARK}`, text.hud(11, shards >= SPARK ? PAL.amber : PAL.muted)).setOrigin(1, 1);
    makeButton(this, GAME_W - PAD - 16 - 70, y + 116, 140, 44, 'Claim a UR', () => this.claimUR(ord.name), { fontSize: 16, active: shards >= SPARK, disabled: shards < SPARK });

    // Offer panel
    y += poolH + 8;
    const offerH = GAME_H - TAB_BAR_H - 10 - y;
    addPanel(this, GAME_W / 2 - pw / 2, y, pw, offerH);
    this.add.text(px + 16, y + 8, '×10: an SR or better.', text.body(17, PAL.muted));
    makeButton(this, GAME_W - PAD - 16 - 186, y + 20, 128, 36, 'All Sisters', () => this.showPool(), { fontSize: 15, icon: 'roster' });
    makeButton(this, GAME_W - PAD - 16 - 60, y + 20, 120, 36, 'View rates', () => this.showRates(), { fontSize: 15, icon: 'book' });
    const btnY = y + offerH - 50;
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

  /** The saved banner, or the first Order's first UR. */
  private currentBanner() {
    const s = game.save;
    if (!s.banner || !ORDERS[s.banner.order]) {
      const first = ORDER_LIST[0];
      s.banner = { order: first.name, target: CRUSADERS.find((c) => c.order === first.name && c.rarity === 'UR')!.id };
    }
    // Each Order has one UR now: she is always the target (older saves may name a Sister who is SSR now).
    if (!CRUSADERS.some((c) => c.id === s.banner!.target && c.order === s.banner!.order && c.rarity === 'UR')) {
      s.banner.target = CRUSADERS.find((c) => c.order === s.banner!.order && c.rarity === 'UR')!.id;
    }
    return s.banner;
  }

  private doPull(kind: PullKind) {
    const results = pull(game.save, kind);
    if (!results.length) return;
    commit();
    this.scene.start('Reveal', { results });
  }

  /** Spend Relic Shards: claim the Order's UR. */
  private claimUR(order: string) {
    const urs = CRUSADERS.filter((c) => c.order === order && c.rarity === 'UR');
    const layer = this.add.container(0, 0).setDepth(20);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.92).setInteractive());
    layer.add(addFrame(this, GAME_W / 2, GAME_H / 2 - 40, GAME_W - 40, 560, { fill: 0x241925 }));
    layer.add(this.add.text(GAME_W / 2, 230, 'CLAIM A UR', text.display(26, PAL.amber)).setOrigin(0.5));
    layer.add(this.add.text(GAME_W / 2, 268, `${SPARK} Relic Shards of the ${order}. Tap her to swear her in.`, { ...text.body(17, PAL.muted), align: 'center', wordWrap: { width: GAME_W - 90 } }).setOrigin(0.5));
    urs.forEach((c, k) => {
      const x = urs.length === 1 ? GAME_W / 2 : GAME_W / 2 + (k === 0 ? -1 : 1) * 110;
      const y = 420;
      layer.add(this.add.rectangle(x, y, 184, 184, 0x170f1b).setStrokeStyle(2, RARITY_COLOR.UR));
      const img = this.add.image(x, y, portraitKey(c.id)).setDisplaySize(176, 176).setInteractive({ useHandCursor: true });
      holdForCard(this, img, c.id);
      img.on('pointerup', () => {
        if (justHeld()) return;
        const r = claimSpark(game.save, c.id);
        if (!r) return;
        commit();
        this.scene.start('Reveal', { results: [r] });
      });
      const owned = game.save.owned[c.id];
      layer.add([
        img,
        this.add.text(x, y + 108, c.name, { ...text.body(18, PAL.ivory), fontStyle: '600' }).setOrigin(0.5),
        this.add.text(x, y + 130, owned ? 'Owned: adds a copy for Vows' : 'Not yet sworn', text.hud(11, owned ? PAL.steel : PAL.amber)).setOrigin(0.5),
      ]);
    });
    const back = makeButton(this, GAME_W / 2, 640, 200, 56, 'Not now', () => layer.destroy(), { fontSize: 18 });
    layer.add(back.all);
  }

  /** Every Sister this banner can give, by rarity, with her chance per pull. */
  private showPool() {
    const s = game.save;
    const banner = this.currentBanner();
    const layer = this.add.container(0, 0).setDepth(20);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.94).setInteractive());
    layer.add(addFrame(this, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 }));
    layer.add(this.add.text(GAME_W / 2, 60, 'EVERY SISTER ON THIS BANNER', text.display(22, PAL.amber)).setOrigin(0.5));
    layer.add(
      this.add
        .text(GAME_W / 2, 84, `${banner.order} banner. Gold frames are boosted here. Chances are per pull, before pity. Hold a portrait for her stats.`, { ...text.body(14, PAL.muted), align: 'center', wordWrap: { width: GAME_W - 70 } })
        .setOrigin(0.5, 0),
    );
    const list = addScrollArea(this, 130, GAME_H - 110, { parent: layer, depth: 20 });
    const pool = bannerPool(s);
    const cols = 5;
    const cell = (GAME_W - 60) / cols;
    let y = 140;
    for (const r of [...RARITY_ORDER].reverse()) {
      const rows = pool.filter((p) => p.c.rarity === r);
      list.content.add(this.add.text(36, y, `${r}  ·  ${(RATES[r] * 100).toFixed(1)}% in all  ·  ${rows.length} Sisters`, text.hud(13, RARITY_COLOR[r])));
      y += 24;
      rows.forEach((p, i) => {
        const x = 30 + cell / 2 + (i % cols) * cell;
        const cy = y + Math.floor(i / cols) * 118 + 40;
        makePlaceholderPortrait(this, p.c);
        const frame = this.add.rectangle(x, cy, 78, 78, 0x170f1b).setStrokeStyle(p.featured ? 3 : 1, p.featured ? PAL.amber : RARITY_COLOR[r]);
        const img = this.add.image(x, cy, portraitKey(p.c.id)).setDisplaySize(72, 72).setAlpha(s.owned[p.c.id] ? 1 : 0.8);
        holdForCard(this, img, p.c.id);
        const name = this.add.text(x, cy + 42, p.c.name.split(' ')[0], text.body(13, PAL.ivory)).setOrigin(0.5, 0);
        const pct = p.chance * 100;
        const odds = this.add.text(x, cy + 59, `${pct < 0.1 ? pct.toFixed(3) : pct.toFixed(2)}%`, text.hud(11, p.featured ? PAL.amber : PAL.steel)).setOrigin(0.5, 0);
        list.content.add([frame, img, name, odds]);
        if (s.owned[p.c.id]) list.content.add([...addBadge(this, x - 36, cy - 36, "OWNED", PAL.steel, 10)]);
      });
      y += Math.ceil(rows.length / cols) * 118 + 14;
    }
    list.fit(y);
    const close = makeButton(this, GAME_W / 2, GAME_H - 66, 240, 60, 'Close', () => layer.destroy());
    layer.add(close.all);
  }

  private showRates() {
    const layer = this.add.container(0, 0).setDepth(20);
    const shade = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.85).setInteractive();
    const style = { fontFamily: FONT, fontSize: '22px', color: hex(PAL.ivory) };
    const panel = addFrame(this, GAME_W / 2, 480, GAME_W - 40, 700, { fill: 0x241925 });
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
        590,
        `A UR is the targeted Sister half the time,\nand always after a UR that strays.\nHalf of SSRs come from the banner's Order.\n×10 always includes an SR or better.\nThe ${PITY_LIMIT}th pull without an SSR or UR gives one.\nUR chance climbs after pull ${UR_SOFT}; pull ${UR_HARD} is a UR.\nUR and SSR pity carry across all banners.\nEach pull gives a Relic Shard of its Order;\n${SPARK} buy either of that Order's URs.\nDuplicates add a Vow rank (max 5), then pay Tithes.`,
        { ...style, fontSize: '16px', color: hex(PAL.steel), align: 'center', lineSpacing: 4 },
      )
      .setOrigin(0.5);
    const close = makeButton(this, GAME_W / 2, GAME_H - 185, 240, 64, 'Close', () => layer.destroy());
    layer.add([notes, ...close.all]);
  }
}
