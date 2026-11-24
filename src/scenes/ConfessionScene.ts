import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { game, commit } from '../state/game';
import { BOND_CORE, BOND_REWARDS, BOND_XP, CONFESSION_AT, MAX_BOND, bondInfo, bondRewardText, bondStatText, claimBondRewards, confessions, devotionAt, hear } from '../systems/bonds';
import { FAVOURED, OFFERINGS, POTENCY_COLOR, candleReady, favours, heldOf, lightCandle, offer, offeringDef, offeringXp, offeringsHeld } from '../systems/offerings';
import { drawOfferingIcon } from '../ui/offeringIcon';
import { tapForSources } from '../ui/sources';
import { ROMAN_RANK } from '../systems/rank';
import { makeButton } from '../ui/button';
import { modeScreen, progressBar, toast } from '../ui/modeScreen';
import { makePlaceholderPortrait, portraitKey } from '../ui/placeholderPortrait';
import { PAD, addFrame, text } from '../ui/theme';
import { addScrollArea } from '../ui/scroll';
import { TAB_BAR_H } from '../ui/tabBar';
import { holdForCard } from '../ui/sisterCard';
import { CARD_PH, CARD_W, cardGridBottom, cardSlot, drawRosterCard } from '../ui/rosterCard';
import { sortAndFilter, sortControls, emptyListLine } from '../ui/sisterSort';


/** Confession: Sisters by bond, and one Sister's bond, offerings, candle and confessions. */
export class ConfessionScene extends Phaser.Scene {
  private id?: string;
  private notice?: string;
  /** Where the list was scrolled, kept while she is opened and closed. */
  private static listY = 0;
  /** Where her page was scrolled, kept while giving offerings. */
  private static detailY = 0;

  constructor() {
    super('Confession');
  }

  init(data: { id?: string; notice?: string }) {
    this.id = data?.id;
    this.notice = data?.notice;
  }

  create() {
    if (this.id && game.save.owned[this.id]) this.detail(this.id);
    else this.list();
    if (this.notice) toast(this, this.notice);
  }

  private list() {
    const save = game.save;
    const { top } = modeScreen(this, 'Confession', 'Fight beside them, keep Vigil with them, bring offerings.');
    const owned = sortAndFilter(save, CRUSADERS.filter((c) => save.owned[c.id]));
    this.add.text(PAD, top, `BOND: ATK & HP, THEN DEVOTION`, text.hud(12, PAL.muted));
    tapForSources(this, this.add.text(GAME_W - PAD, top, `OFFERINGS ${offeringsHeld(save)}${candleReady(save) ? ' · CANDLE READY' : ''}`, text.hud(12, PAL.amber)).setOrigin(1, 0), 'offerings');
    // Every Sister in one list: drag or wheel to scroll.
    sortControls(this, GAME_W / 2, top + 42, GAME_W - PAD * 2, () => {
      ConfessionScene.listY = 0;
      this.scene.restart({});
    }, { depth: 10, h: 36 });
    if (!owned.length) this.add.text(GAME_W / 2, top + 140, emptyListLine(save), text.body(17, PAL.muted)).setOrigin(0.5);
    const list = addScrollArea(this, top + 64, GAME_H - TAB_BAR_H, { start: ConfessionScene.listY, onScroll: (y) => (ConfessionScene.listY = y) });
    const before = this.children.list.length;
    // The Roster's cards, with her bond under the name.
    const y0 = top + 74;
    owned.forEach((c, i) => {
      const { left, top: cy } = cardSlot(i, y0);
      const b = bondInfo(save, c.id);
      makePlaceholderPortrait(this, c);
      const card = drawRosterCard(this, left, cy, c, save);
      list.tap(card.hit, () => {
        ConfessionScene.detailY = 0;
        this.scene.restart({ id: c.id });
      });
      holdForCard(this, card.hit, c.id);
      // Her bond: a small bar with its rank, under her Power.
      {
        const bw = 48;
        const bx = left + CARD_W - 8 - bw;
        const by = cy + CARD_PH + 35;
        this.add.rectangle(bx, by, bw, 18, PAL.deepShadow).setOrigin(0, 0.5).setStrokeStyle(1, PAL.armorShadow);
        this.add.rectangle(bx + 1, by, Math.max(0, (bw - 2) * (b.level / MAX_BOND)), 16, b.level >= BOND_CORE ? PAL.amber : 0xb07a3a, 0.55).setOrigin(0, 0.5);
        this.add.text(bx + bw / 2, by, b.level ? ROMAN_RANK(b.level) : '0', { ...text.hud(14, b.level ? 0xfff1d6 : PAL.steel), stroke: '#0b070c', strokeThickness: 3 }).setOrigin(0.5);
      }
      if (b.unheard || b.rewards.length) this.add.circle(left + CARD_W / 2, cy + 12, 8, PAL.amber).setStrokeStyle(2, 0x1b121c);
    });
    list.content.add(this.children.list.slice(before));
    list.fit(cardGridBottom(owned.length, y0) + 4);
  }

  private detail(id: string) {
    const save = game.save;
    const c = CRUSADERS.find((x) => x.id === id)!;
    const b = bondInfo(save, id);
    const { top } = modeScreen(this, c.name, `${c.title} · ${c.order}`, 'Confession');
    const bw = GAME_W - PAD * 2;
    const list = addScrollArea(this, top - 4, GAME_H - TAB_BAR_H, { start: ConfessionScene.detailY, onScroll: (y) => (ConfessionScene.detailY = y) });
    const before = this.children.list.length;
    makePlaceholderPortrait(this, c);
    this.add.rectangle(PAD + 62, top + 62, 124, 124, 0x000000, 0).setStrokeStyle(2, RARITY_COLOR[c.rarity]);
    holdForCard(this, this.add.image(PAD + 62, top + 62, portraitKey(id)).setDisplaySize(120, 120), id);
    const tx = PAD + 140;
    this.add.text(tx, top + 2, `BOND ${b.level ? ROMAN_RANK(b.level) : '0'} / ${ROMAN_RANK(MAX_BOND)}`, text.hud(15, PAL.amber));
    this.add.text(tx, top + 24, b.level ? bondStatText(b.level) : 'No bond yet', { ...text.body(14, PAL.ivory), wordWrap: { width: bw - 140 } });
    const nextGift = b.max ? '' : b.level >= BOND_CORE ? `Next: Devotion ${devotionAt(b.level + 1).label}` : `Next: +1% ATK and HP`;
    this.add.text(tx, top + 64, nextGift, text.body(13, PAL.muted));
    progressBar(this, tx, top + 84, bw - 140, b.max ? 1 : b.into / b.need, PAL.amber, 8);
    this.add.text(tx, top + 94, b.max ? 'Bond complete' : `${b.into} / ${b.need} to the next level`, text.body(13, PAL.muted));

    const after = (gave: boolean, what: string) => {
      if (gave) commit();
      const now = bondInfo(save, id);
      this.scene.restart({ id, notice: !gave ? what : now.level > b.level ? `Bond ${ROMAN_RANK(now.level)}. She has something to confess.` : what });
    };

    let y = top + 140;
    // Bond rewards: every level to X, then every fifth.
    const waiting = b.rewards;
    const nextReward = Object.keys(BOND_REWARDS).map(Number).find((l) => l > Math.max(b.level, (save.bonds?.[id]?.claimed ?? 0)));
    const first = c.name.split(' ')[0];
    if (waiting.length) {
      const what = waiting.map((l) => bondRewardText(BOND_REWARDS[l], first)).join(' + ');
      makeButton(this, GAME_W / 2, y + 26, bw, 52, `Claim bond reward${waiting.length > 1 ? 's' : ''} (${waiting.map((l) => ROMAN_RANK(l)).join(', ')})`, () => {
        if (list.dragging) return;
        claimBondRewards(save, id);
        commit();
        this.scene.restart({ id, notice: `Bond rewards: ${what}` });
      }, { fontSize: 16, active: true });
      y += 62;
    } else if (nextReward) {
      this.add.text(PAD, y, `BOND ${ROMAN_RANK(nextReward)} REWARD: ${bondRewardText(BOND_REWARDS[nextReward], first).toUpperCase()}`, { ...text.hud(11, PAL.steel), wordWrap: { width: bw } });
      y += 30;
    }

    // The free candle: one a day, for any Sister.
    const ready = candleReady(save);
    makeButton(this, GAME_W / 2, y + 23, bw, 46, b.max ? 'Her bond is complete!' : ready ? `Light the free candle · +${BOND_XP.candle} bond` : 'Candle lit today · another at dawn', () => {
      if (list.dragging) return;
      after(lightCandle(save, id), 'The candle burns. She notices.');
    }, { fontSize: 16, icon: 'flame', active: ready && !b.max, disabled: !ready || b.max });
    y += 62;

    // Offerings: tap one to give it.
    const fav = FAVOURED[c.order] ?? [];
    this.add.text(PAD, y, 'OFFERINGS', text.hud(13, PAL.amber));
    tapForSources(this, this.add.text(GAME_W - PAD, y, `HELD ${offeringsHeld(save)}  ·  WHERE TO GET MORE`, text.hud(11, PAL.steel)).setOrigin(1, 0), 'offerings');
    y += 20;
    this.add.text(PAD, y, `The ${c.order} favours ${fav.map((f) => offeringDef(f).name).join(' and ')}: double bond!`, { ...text.body(14, PAL.muted), wordWrap: { width: bw } });
    y += 30;
    const cols = 4;
    const cw = bw / cols;
    const ch = 110;
    OFFERINGS.forEach((o, i) => {
      const x = PAD + cw * (i % cols) + cw / 2;
      const cy = y + Math.floor(i / cols) * ch;
      const held = heldOf(save, o.id);
      const isFav = favours(c.order, o.id);
      const parts = drawOfferingIcon(this, x, cy + 30, o.id, 56);
      if (!held) parts.forEach((p) => (p as unknown as Phaser.GameObjects.Image).setAlpha(0.35));
      if (isFav) this.add.star(x + 26, cy + 4, 5, 5, 11, PAL.amber).setStrokeStyle(1, 0x1b121c);
      this.add.text(x + 28, cy + 56, `${held}`, text.hud(12, held ? PAL.ivory : PAL.steel)).setOrigin(1, 1);
      this.add.text(x, cy + 64, o.name, { ...text.body(13, held ? PAL.ivory : PAL.steel), align: 'center', wordWrap: { width: cw - 8 } }).setOrigin(0.5, 0);
      this.add.text(x, cy + 82, `+${offeringXp(id, o.id)}`, text.hud(11, isFav ? PAL.amber : POTENCY_COLOR[o.potency])).setOrigin(0.5, 0);
      const hit = this.add.rectangle(x, cy + 50, cw - 6, ch - 6, 0, 0);
      list.tap(hit, () => {
        if (b.max) return after(false, 'Her bond is already complete.');
        if (!held) return after(false, `No ${o.name} held. Win them in the Procession.`);
        after(offer(save, id, o.id), `${o.name} given${isFav ? ', and she treasures it' : ''}. +${offeringXp(id, o.id)} bond.`);
      });
    });
    y += Math.ceil(OFFERINGS.length / cols) * ch + 10;

    this.add.text(PAD, y, 'CONFESSIONS', text.hud(13, PAL.amber));
    y += 24;
    const heardBefore = save.bonds?.[id]?.heard ?? 0;
    confessions(c).forEach((conf, i) => {
      const lv = i + 1;
      const at = CONFESSION_AT[i];
      // Confessions heard under the old five-level bond stay open.
      const open = b.level >= at || heardBefore >= lv;
      const h = 52;
      addFrame(this, GAME_W / 2, y + h / 2, bw, h, { fill: open ? 0x221824 : 0x150f17, edge: open ? PAL.goldEdge : PAL.armorShadow });
      this.add.text(PAD + 14, y + h / 2, `${ROMAN_RANK(lv)}`, text.hud(14, open ? PAL.amber : PAL.steel)).setOrigin(0, 0.5);
      this.add.text(PAD + 52, y + h / 2, open ? conf.title : `Opens at bond ${ROMAN_RANK(at)}`, text.body(17, open ? PAL.ivory : PAL.steel)).setOrigin(0, 0.5);
      if (open && lv > heardBefore) this.add.text(GAME_W - PAD - 14, y + h / 2, 'NEW', text.hud(12, PAL.amber)).setOrigin(1, 0.5);
      if (open) list.tap(this.add.rectangle(GAME_W / 2, y + h / 2, bw, h, 0, 0), () => this.read(c.name.split(' ')[0], conf.title, conf.body));
      y += h + 8;
    });
    list.content.add(this.children.list.slice(before));
    list.fit(y + 10);
    if (b.unheard) {
      hear(save, id);
      commit();
    }
  }

  /** The confession, full screen over everything. */
  private read(first: string, title: string, body: string) {
    const layer = this.add.container(0, 0).setDepth(50);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.94).setInteractive());
    layer.add(addFrame(this, GAME_W / 2, GAME_H / 2 - 40, GAME_W - 48, 520, { fill: 0x1e1520 }));
    // Optional art: src/assets/ui/bg-confessional.png (or .webp), shown dimmed behind the words.
    if (this.textures.exists('bg-confessional')) layer.add(this.add.image(GAME_W / 2, GAME_H / 2 - 40, 'bg-confessional').setDisplaySize(GAME_W - 60, 508).setAlpha(0.3));
    layer.add(this.add.text(GAME_W / 2, GAME_H / 2 - 270, title.toUpperCase(), text.display(24, 0xfff1d6)).setOrigin(0.5));
    layer.add(this.add.text(GAME_W / 2, GAME_H / 2 - 236, `The confession of ${first}`, text.body(15, PAL.muted)).setOrigin(0.5));
    layer.add(this.add.text(GAME_W / 2, GAME_H / 2 - 50, body, { ...text.body(19, PAL.ivory), align: 'center', lineSpacing: 6, wordWrap: { width: GAME_W - 110 } }).setOrigin(0.5));
    const btn = makeButton(this, GAME_W / 2, GAME_H / 2 + 170, 200, 50, 'Amen', () => layer.destroy(), { active: true, fontSize: 18 });
    layer.add(btn.all);
  }
}
