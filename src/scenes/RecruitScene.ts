import Phaser from 'phaser';
import { music } from '../audio/music';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { ORDERS } from '../data/orders';
import { sigilKey } from '../ui/icons';
import { commit, game } from '../state/game';
import { BOOSTED_SSRS, COST_ONE, COST_TEN, PITY_LIMIT, RARITY_ORDER, RATES, bannerPool, boostedSSRs, chooseLimited, chooseStandard, customizeBanner, defaultSSRs, standardSSRs, standardURs, SPARK, UR_HARD, UR_SOFT, canPull, claimSpark, pull, shardsOf, sparkKey, syncBanner, urPityLeft, type PullKind } from '../systems/gacha';
import { GRADUATE_AFTER, graduationDate, isStandard, limitedUnseen, limitedWindow, markLimitedSeen, timeLeft, upcoming, type LimitedWindow } from '../systems/limited';
import { makeButton } from '../ui/button';
import { CURRENCY_BAR_H, addCurrencyBar } from '../ui/currencyBar';
import { addSplash, loadSplash, portraitKey, queueSplash, splashKey } from '../ui/placeholderPortrait';
import { SisterSprite, fullKey } from '../ui/sisterSprite';
import type { CrusaderDef } from '../data/types';
import { TAB_BAR_H, addTabBar } from '../ui/tabBar';
import { PAD, addBackdrop, addBadge, addFrame, addPanel, addScreenGlow, fade, text } from '../ui/theme';
import { holdForCard, justHeld } from '../ui/sisterCard';
import { addScrollArea } from '../ui/scroll';
import { makePlaceholderPortrait } from '../ui/placeholderPortrait';

/** The Sealed Altar: rates, pity counter, and the pull buttons. */
export class RecruitScene extends Phaser.Scene {
  constructor() {
    super('Recruit');
  }

  preload() {
    // The banner's target Sister's splash art fills the banner.
    queueSplash(this, this.currentBanner().target);
  }

  create() {
    addScreenGlow(this);
    music.preload('ur');
    addCurrencyBar(this);
    const s = game.save;
    // A compact header leaves the banner room for the Sisters to stand at full height.
    this.add.text(PAD + 4, CURRENCY_BAR_H + 28, 'SISTERS', text.display(24, PAL.amber)).setOrigin(0, 0.5);
    makeButton(this, GAME_W - PAD - 44, CURRENCY_BAR_H + 28, 88, 40, 'Back', () => this.scene.start('Altar'), { fontSize: 16 });
    makeButton(this, GAME_W - PAD - 96 - 58, CURRENCY_BAR_H + 28, 108, 40, 'Record', () => this.scene.start('PullHistory'), { fontSize: 15, icon: 'book' });
    const top = CURRENCY_BAR_H + 50;

    // Banner pages: the Limited Saint first, then one per Order. ‹ › step through them.
    const banner = this.currentBanner();
    const limited = banner.limited !== undefined;
    const win = limitedWindow();
    if (limited) {
      markLimitedSeen(s);
      commit();
    }
    const ord = ORDERS[banner.order];
    const bw = GAME_W - PAD * 2;
    const bh = 490;
    const by = top + 4 + bh / 2;
    const bTop = by - bh / 2;
    const edge = limited ? RARITY_COLOR.UR : ord.color;
    const target = CRUSADERS.find((c) => c.id === banner.target)!;
    const ssrs = boostedSSRs(s);

    // Background: the chosen Sister's splash (the target's at first), behind everything on the banner.
    const back = this.add.container(0, 0);
    const clip = this.make.graphics({}, false).fillRect(GAME_W / 2 - bw / 2, bTop, bw, bh);
    back.setMask(clip.createGeometryMask());
    const showBack = (id: string) => {
      back.removeAll(true);
      const c = CRUSADERS.find((x) => x.id === id)!;
      const o = ORDERS[c.order];
      if (this.textures.exists(splashKey(id))) {
        back.add(addSplash(this, id, GAME_W / 2, by, bw, bh, 'hero'));
        // her splash is busy; dim it so the figures and words stand out in front
        back.add(this.add.rectangle(GAME_W / 2, by, bw, bh, 0x140b12, 0.35));
      } else {
        const art = this.textures.exists(`banner-${o.id}`) ? `banner-${o.id}` : limited && this.textures.exists('banner-limited') ? 'banner-limited' : 'bg-altar';
        back.add(addBackdrop(this, art, GAME_W / 2, by, bw, bh, { focusY: 0.35 }) as Phaser.GameObjects.GameObject[]);
        back.add(this.add.rectangle(GAME_W / 2, by, bw, bh, 0x140b12, 0.3));
      }
      // a floor of shadow for the figures to stand on, and a little colour of the banner
      back.add(fade(this, GAME_W / 2, by, bw, bh, 0.5, 0x140b12));
      back.add(this.add.rectangle(GAME_W / 2, by, bw, bh, edge, 0.1));
      back.list.forEach((o) => (o as Phaser.GameObjects.Image).setAlpha?.(0));
      this.tweens.add({ targets: back.list, alpha: { from: 0, to: 1 }, duration: 260 });
      // the dimming layers keep their own alpha
      back.list.forEach((o) => {
        if (o instanceof Phaser.GameObjects.Rectangle) this.tweens.add({ targets: o, alpha: 1, duration: 260 });
      });
    };
    addFrame(this, GAME_W / 2, by, bw, bh, { edge });

    // Two banners: the Limited Saint's (fixed) and the standard one the player sets up.
    const page = limited ? 0 : 1;
    const pages = 2;
    const step = (d: number) => {
      const next = (page + d + pages) % pages;
      if (next === 0) chooseLimited(s);
      else chooseStandard(s);
      commit();
      this.scene.restart();
    };

    // Foreground: the three featured Sisters stand on the banner, the UR in front.
    const feet = bTop + bh - 76;
    const sideX = 96;
    const figures: { c: CrusaderDef; x: number; feet: number; scale: number; sprite?: SisterSprite; parts: Phaser.GameObjects.GameObject[] }[] = [
      ...ssrs.slice(0, 2).map((c, k) => ({ c, x: k === 0 ? PAD + sideX : GAME_W - PAD - sideX, feet: feet - 34, scale: 1, parts: [] })),
      { c: target, x: GAME_W / 2, feet, scale: 2, parts: [] },
    ];
    let chosen = target.id;
    const select = (id: string) => {
      if (id === chosen) return;
      chosen = id;
      for (const f of figures) {
        f.sprite?.setActive(f.c.id === id);
        // the others step back into her light
        this.tweens.add({ targets: f.parts, alpha: f.c.id === id ? 1 : 0.55, duration: 220 });
      }
      if (this.textures.exists(splashKey(id))) showBack(id);
      else void loadSplash(this, id).then(() => chosen === id && this.scene.isActive() && showBack(id));
    };
    for (const f of figures) {
      const ur = f.c.rarity === 'UR';
      const fullArt = this.textures.exists(fullKey(f.c.id));
      let hitH: number;
      if (fullArt) {
        f.sprite = new SisterSprite(this, f.c.id, f.x, f.feet, f.scale, ur ? PAL.amber : RARITY_COLOR.SSR);
        f.parts.push(f.sprite.root);
        hitH = f.sprite.height;
      } else {
        // no full-body art yet: her portrait, framed, stands in her place
        makePlaceholderPortrait(this, f.c);
        const size = ur ? 200 : 112;
        f.parts.push(
          this.add.ellipse(f.x, f.feet, size * 0.8, 16, 0x000000, 0.5),
          this.add.rectangle(f.x, f.feet - size / 2 - 6, size + 8, size + 8, 0x170f1b).setStrokeStyle(2, RARITY_COLOR[f.c.rarity]),
          this.add.image(f.x, f.feet - size / 2 - 6, portraitKey(f.c.id)).setDisplaySize(size, size),
        );
        hitH = size + 12;
      }
      const w = ur ? 220 : 120;
      const hit = this.add.rectangle(f.x, f.feet - hitH / 2, w, hitH, 0, 0.001).setInteractive({ useHandCursor: true });
      holdForCard(this, hit, f.c.id);
      hit.on('pointerup', () => {
        if (justHeld()) return;
        select(f.c.id);
      });
      // her name plate under her feet
      const ny = f.feet + 10;
      this.add.text(f.x, ny, ur ? f.c.name : f.c.name.split(' ')[0], { ...text.body(ur ? 19 : 16, ur ? 0xfff1d6 : PAL.ivory), fontStyle: '600', stroke: '#0b070c', strokeThickness: 4 }).setOrigin(0.5, 0);
      const tag = ur ? (limited ? 'LIMITED SAINT' : 'TARGET UR') : limited ? 'LIMITED SSR' : 'SSR UP';
      this.add.text(f.x, ny + 24, tag, { ...text.hud(11, ur ? PAL.amber : RARITY_COLOR.SSR), stroke: '#0b070c', strokeThickness: 4 }).setOrigin(0.5, 0);
      this.add.image(f.x + (ur ? 70 : 44), f.feet - hitH + 18, sigilKey(ORDERS[f.c.order].id)).setDisplaySize(ur ? 30 : 24, ur ? 30 : 24);
    }
    figures.find((f) => f.c.id === chosen)?.sprite?.setActive(true);
    showBack(target.id);
    back.setDepth(-1);

    // Top strip: which banner this is, over the figures' heads.
    const arrow = this.textures.exists('ui-arrow');
    makeButton(this, PAD + 30, bTop + 34, 44, 50, arrow ? '' : '‹', () => step(-1), { fontSize: 26 });
    makeButton(this, GAME_W - PAD - 30, bTop + 34, 44, 50, arrow ? '' : '›', () => step(1), { fontSize: 26 });
    if (arrow) {
      this.add.image(PAD + 30, bTop + 34, 'ui-arrow').setDisplaySize(22, 22).setFlipX(true);
      this.add.image(GAME_W - PAD - 30, bTop + 34, 'ui-arrow').setDisplaySize(22, 22);
    }
    const head = limited ? `${win.saint.name.split(' ')[0].toUpperCase()}'S VIGIL` : 'YOUR CALLING';
    const sub = limited ? `Limited · leaves in ${timeLeft(win.ends)}` : `Standard · banner ${page + 1} of ${pages}`;
    this.add.text(GAME_W / 2, bTop + 26, head, text.display(22, 0xfff1d6)).setOrigin(0.5).setShadow(0, 2, '#000000', 8, false, true);
    this.add.text(GAME_W / 2, bTop + 52, sub, { ...text.hud(12, limited ? PAL.amber : PAL.steel), stroke: '#0b070c', strokeThickness: 4 }).setOrigin(0.5);
    this.add.text(GAME_W / 2, bTop + bh - 6, 'Tap a Sister for her splash · hold for her card', { ...text.body(14, PAL.muted), stroke: '#0b070c', strokeThickness: 3 }).setOrigin(0.5, 1);

    // Under the banner: what you can do with it
    const px = PAD;
    const pw = GAME_W - PAD * 2;
    let y = by + bh / 2 + 8;
    const rowY = y + 20;
    if (limited) {
      const next = upcoming()[0];
      makeButton(this, px + 120, rowY, 240, 38, next ? `Next: ${next.saint.name.split(' ')[0]} in ${timeLeft(next.starts)}` : 'Limited banners', () => this.showComing(), { fontSize: 15 });
    } else makeButton(this, px + 120, rowY, 240, 38, 'Choose your rate-up', () => this.customize(), { fontSize: 15, active: true });
    makeButton(this, px + 250 + 62, rowY, 120, 38, 'All Sisters', () => this.showPool(), { fontSize: 15 });
    makeButton(this, GAME_W - PAD - 54, rowY, 108, 38, 'Rates', () => this.showRates(), { fontSize: 15, icon: 'book' });
    y += 46;

    // Banner rules and pity
    const poolH = 116;
    addPanel(this, GAME_W / 2 - pw / 2, y, pw, poolH);
    const first = target.name.split(' ')[0];
    this.add.text(px + 16, y + 10, s.urGuaranteed ? `The next UR is ${first}, sworn.` : `A UR here is ${first} half the time, and always after one that strays.`, { ...text.body(17, PAL.ivory), fontStyle: '600', wordWrap: { width: pw - 32 } });
    // Pity counters: UR (shared by every banner) and SSR
    const toPity = PITY_LIMIT - s.pity;
    const urLeft = urPityLeft(s);
    this.add.text(px + 16, y + 56, `UR within ${urLeft} · SSR+ within ${toPity}`, text.body(17, PAL.amber)).setFontStyle('600');
    // Relic Shards for this Order (or Saint's Favor): SPARK buys the UR
    const key = sparkKey(target);
    const shards = shardsOf(s, key);
    const barW = pw - 32 - 150;
    this.add.text(px + 16, y + 84, limited ? `SAINT'S FAVOR` : `RELIC SHARDS · ${ord.name.toUpperCase()}`, text.hud(11, PAL.steel));
    this.add.rectangle(px + 16, y + 104, barW, 8, PAL.deepShadow).setOrigin(0, 0.5);
    this.add.rectangle(px + 16, y + 104, Math.max(1, barW * Math.min(1, shards / SPARK)), 8, RARITY_COLOR.UR).setOrigin(0, 0.5);
    this.add.text(px + 16 + barW, y + 96, `${shards} / ${SPARK}`, text.hud(11, shards >= SPARK ? PAL.amber : PAL.muted)).setOrigin(1, 1);
    makeButton(this, GAME_W - PAD - 16 - 64, y + 88, 128, 40, limited ? 'Claim her' : 'Claim UR', () => this.claimUR(target.id), { fontSize: 15, active: shards >= SPARK, disabled: shards < SPARK });

    // Pull buttons
    y += poolH + 8;
    const offerH = GAME_H - TAB_BAR_H - 8 - y;
    const half = (pw - 10) / 2;
    const btnY = y + offerH / 2;
    const freeTen = !s.freeTenUsed;
    makeButton(this, px + half / 2, btnY, half, offerH, `Recruit ×1\n${COST_ONE} Seal`, () => this.doPull('one'), {
      disabled: !canPull(s, 'one'),
    });
    makeButton(this, px + half + 10 + half / 2, btnY, half, offerH, freeTen ? 'Recruit ×10\nFree first time' : `Recruit ×10\n${COST_TEN} Seals`, () => this.doPull('ten'), {
      disabled: !canPull(s, 'ten'),
      active: true,
    });

    addTabBar(this, 'Recruit');
  }

  /** The saved banner, brought up to date (a past Saint's window gives way to the current one). */
  private currentBanner() {
    // A newly arrived Saint greets you at the Altar once.
    if (limitedUnseen(game.save)) chooseLimited(game.save);
    return syncBanner(game.save);
  }

  private doPull(kind: PullKind) {
    const results = pull(game.save, kind);
    if (!results.length) return;
    commit();
    this.scene.start('Reveal', { results });
  }

  /** Spend Relic Shards (or Saint's Favor): claim the banner's UR. */
  private claimUR(id: string) {
    const c = CRUSADERS.find((x) => x.id === id)!;
    const layer = this.add.container(0, 0).setDepth(20);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.92).setInteractive());
    layer.add(addFrame(this, GAME_W / 2, GAME_H / 2 - 40, GAME_W - 40, 560, { fill: 0x241925 }));
    layer.add(this.add.text(GAME_W / 2, 230, c.limited ? 'CLAIM THE SAINT' : 'CLAIM A UR', text.display(26, PAL.amber)).setOrigin(0.5));
    const cost = c.limited ? `${SPARK} Saint's Favor` : `${SPARK} Relic Shards of the ${c.order}`;
    layer.add(this.add.text(GAME_W / 2, 268, `${cost}. Tap her to swear her in.`, { ...text.body(17, PAL.muted), align: 'center', wordWrap: { width: GAME_W - 90 } }).setOrigin(0.5));
    {
      const x = GAME_W / 2;
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
    }
    const back = makeButton(this, GAME_W / 2, 640, 200, 56, 'Not now', () => layer.destroy(), { fontSize: 18 });
    layer.add(back.all);
  }

  /** The standard banner's rate-up picker: one UR, then two SSRs. */
  private customize() {
    const s = game.save;
    const b = this.currentBanner();
    let ur = b.target;
    let ssrs = [...(b.ssrs ?? defaultSSRs(ur))];
    const layer = this.add.container(0, 0).setDepth(20);
    const draw = () => {
      layer.removeAll(true);
      layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.94).setInteractive());
      layer.add(addFrame(this, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 }));
      layer.add(this.add.text(GAME_W / 2, 60, 'CHOOSE YOUR RATE-UP', text.display(24, PAL.amber)).setOrigin(0.5));
      layer.add(
        this.add
          .text(GAME_W / 2, 84, 'Tap one UR and two SSRs. A UR here is your pick half the time and always after one that strays. Pity and Relic Shards carry over. Hold a portrait for her stats.', { ...text.body(15, PAL.muted), align: 'center', wordWrap: { width: GAME_W - 70 } })
          .setOrigin(0.5, 0),
      );
      const list = addScrollArea(this, 160, GAME_H - 130, { parent: layer, depth: 20 });
      const cols = 5;
      const cell = (GAME_W - 60) / cols;
      let y = 170;
      const grid = (title: string, pool: (typeof CRUSADERS)[number][], picked: (id: string) => boolean, onTap: (id: string) => void) => {
        list.content.add(this.add.text(36, y, title, text.hud(13, PAL.amber)));
        y += 26;
        pool.forEach((c, i) => {
          const x = 30 + cell / 2 + (i % cols) * cell;
          const cy = y + Math.floor(i / cols) * 122 + 40;
          const on = picked(c.id);
          makePlaceholderPortrait(this, c);
          const frame = this.add.rectangle(x, cy, 80, 80, 0x170f1b).setStrokeStyle(on ? 4 : 1, on ? PAL.amber : RARITY_COLOR[c.rarity]);
          const img = this.add.image(x, cy, portraitKey(c.id)).setDisplaySize(72, 72).setAlpha(on ? 1 : 0.7);
          holdForCard(this, img, c.id);
          list.tap(img, () => {
            if (justHeld()) return;
            onTap(c.id);
          });
          const sig = this.add.image(x + 30, cy - 30, sigilKey(ORDERS[c.order].id)).setDisplaySize(22, 22);
          const name = this.add.text(x, cy + 44, c.name.split(' ')[0], text.body(13, on ? PAL.amber : PAL.ivory)).setOrigin(0.5, 0);
          list.content.add([frame, img, sig, name]);
          if (on) list.content.add([...addBadge(this, x - 38, cy - 38, 'UP', PAL.amber, 10)]);
          if (s.owned[c.id]) list.content.add(this.add.text(x, cy + 62, 'OWNED', text.hud(10, PAL.steel)).setOrigin(0.5, 0));
        });
        y += Math.ceil(pool.length / cols) * 122 + 16;
      };
      grid('TARGET UR · PICK 1', standardURs(), (id) => id === ur, (id) => {
        ur = id;
        draw();
      });
      grid(`BOOSTED SSRS · PICK ${BOOSTED_SSRS}`, standardSSRs(), (id) => ssrs.includes(id), (id) => {
        if (ssrs.includes(id)) ssrs = ssrs.filter((x) => x !== id);
        else ssrs = [...ssrs, id].slice(-BOOSTED_SSRS);
        draw();
      });
      list.fit(y);
      const ready = ssrs.length === BOOSTED_SSRS;
      const w3 = (GAME_W - 60) / 3;
      layer.add(makeButton(this, 30 + w3 / 2, GAME_H - 84, w3 - 8, 56, 'Cancel', () => layer.destroy(), { fontSize: 16 }).all);
      layer.add(
        makeButton(this, 30 + w3 * 1.5, GAME_H - 84, w3 - 8, 56, "Her Order's\nSSRs", () => {
          ssrs = defaultSSRs(ur);
          draw();
        }, { fontSize: 15 }).all,
      );
      layer.add(
        makeButton(this, 30 + w3 * 2.5, GAME_H - 84, w3 - 8, 56, ready ? 'Raise it' : `Pick ${BOOSTED_SSRS - ssrs.length} more`, () => {
          if (!customizeBanner(s, ur, ssrs)) return;
          commit();
          this.scene.restart();
        }, { fontSize: 16, active: ready, disabled: !ready }).all,
      );
    };
    draw();
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
        .text(GAME_W / 2, 84, `${banner.limited !== undefined ? 'Limited' : 'Standard'} banner. Gold frames are boosted here. Chances are per pull, before pity. Hold a portrait for her stats.`, { ...text.body(14, PAL.muted), align: 'center', wordWrap: { width: GAME_W - 70 } })
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

  /** This Limited banner and the ones to come: who is on each, when it opens, and when they go standard. */
  private showComing() {
    const layer = this.add.container(0, 0).setDepth(20);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.94).setInteractive());
    layer.add(addFrame(this, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 }));
    layer.add(this.add.text(GAME_W / 2, 60, 'LIMITED BANNERS', text.display(24, PAL.amber)).setOrigin(0.5));
    layer.add(
      this.add
        .text(GAME_W / 2, 84, `Each runs a Saint and two SSRs for two weeks. Nobody on them is on the standard banner until ${GRADUATE_AFTER} more Limited banners have passed; then they join their Order's standard pool for good.`, { ...text.body(15, PAL.muted), align: 'center', wordWrap: { width: GAME_W - 70 } })
        .setOrigin(0.5, 0),
    );
    const list = addScrollArea(this, 170, GAME_H - 120, { parent: layer, depth: 20 });
    const day = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const rows: LimitedWindow[] = [limitedWindow(), ...upcoming()];
    let y = 180;
    rows.forEach((w, k) => {
      const cy = y + 80;
      list.content.add(this.add.rectangle(GAME_W / 2, cy, GAME_W - 60, 168, 0x170f1b, 0.8).setStrokeStyle(1, k === 0 ? PAL.amber : PAL.deepShadow));
      const portrait = (c: (typeof CRUSADERS)[number], x: number, py: number, size: number) => {
        makePlaceholderPortrait(this, c);
        const frame = this.add.rectangle(x, py, size + 6, size + 6, 0x170f1b).setStrokeStyle(2, RARITY_COLOR[c.rarity]);
        const img = this.add.image(x, py, portraitKey(c.id)).setDisplaySize(size, size);
        holdForCard(this, img, c.id);
        list.content.add([frame, img]);
      };
      portrait(w.saint, 92, cy - 14, 96);
      w.ssrs.forEach((c, i) => portrait(c, 176 + i * 66, cy + 36, 56));
      const grad = graduationDate(w.saint.id);
      list.content.add([
        this.add.text(160, cy - 72, w.saint.name, { ...text.body(19, PAL.ivory), fontStyle: '600' }),
        this.add.text(160, cy - 48, `${w.saint.title} · ${w.saint.order}`, text.body(15, PAL.muted)),
        this.add.text(160, cy - 26, k === 0 ? `Up now · leaves in ${timeLeft(w.ends)}` : `Opens ${day(w.starts)} · in ${timeLeft(w.starts)}`, text.body(15, PAL.amber)),
        this.add.text(GAME_W - 46, cy + 22, `SSR: ${w.ssrs.map((c) => c.name.split(' ')[0]).join(', ')}`, { ...text.body(14, PAL.ivory), align: 'right', wordWrap: { width: 190 } }).setOrigin(1, 0),
        this.add.text(GAME_W - 46, cy + 56, grad ? `Standard from ${day(grad)}` : `Standard ${GRADUATE_AFTER} banners later`, text.hud(11, PAL.steel)).setOrigin(1, 0),
      ]);
      y += 180;
    });
    if (!upcoming().length) {
      list.content.add(this.add.text(GAME_W / 2, y + 10, 'More Saints are being canonized. This banner stays up until they arrive.', { ...text.body(15, PAL.muted), align: 'center', wordWrap: { width: GAME_W - 90 } }).setOrigin(0.5, 0));
      y += 60;
    }
    list.fit(y);
    const close = makeButton(this, GAME_W / 2, GAME_H - 76, 240, 60, 'Close', () => layer.destroy());
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
      const y = 260 + i * 46;
      const count = CRUSADERS.filter((c) => c.rarity === r && isStandard(c)).length;
      layer.add(this.add.text(110, y, r, { ...style, color: hex(RARITY_COLOR[r]) }).setOrigin(0, 0.5));
      layer.add(this.add.text(220, y, `${(RATES[r] * 100).toFixed(1)}%`, style).setOrigin(0, 0.5));
      layer.add(this.add.text(340, y, `${count} recruit${count === 1 ? '' : 's'}`, { ...style, fontSize: '18px', color: hex(PAL.steel) }).setOrigin(0, 0.5));
    });
    const notes = this.add
      .text(
        GAME_W / 2,
        450,
        [
          'A UR is the banner\'s target half the time, and always after one that strays. Half of SSRs are its boosted pair.',
          'On the standard banner you choose the UR and the two SSRs.',
          `×10 always has an SR or better. Pull ${PITY_LIMIT} without an SSR or UR gives one. UR chance climbs after pull ${UR_SOFT}; pull ${UR_HARD} is a UR. Pity carries across every banner.`,
          `Each pull gives a Relic Shard of the target's Order (Saint's Favor on the Limited banner). ${SPARK} buy that UR.`,
          `Limited Sisters join the standard pool after ${GRADUATE_AFTER} more Limited banners.`,
          'Duplicates add a Vow rank, then pay Tithes.',
        ].join('\n'),
        { ...style, fontSize: '16px', color: hex(PAL.steel), align: 'center', lineSpacing: 2, wordWrap: { width: GAME_W - 100 } },
      )
      .setOrigin(0.5, 0);
    const close = makeButton(this, GAME_W / 2, GAME_H - 185, 240, 64, 'Close', () => layer.destroy());
    layer.add([notes, ...close.all]);
  }
}
