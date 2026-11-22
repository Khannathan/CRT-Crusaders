import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { game, commit } from '../state/game';
import { BOND_STAT, MAX_BOND, bondInfo, candleCost, confessions, hear, offerCandle } from '../systems/bonds';
import { ROMAN_RANK } from '../systems/rank';
import { makeButton } from '../ui/button';
import { modeScreen, progressBar, toast } from '../ui/modeScreen';
import { makePlaceholderPortrait, portraitKey } from '../ui/placeholderPortrait';
import { PAD, addFrame, text } from '../ui/theme';
import { addScrollArea } from '../ui/scroll';
import { TAB_BAR_H } from '../ui/tabBar';
import { holdForCard } from '../ui/sisterCard';


/** Confession: Sisters by bond, and one Sister's bond, candle and confessions. */
export class ConfessionScene extends Phaser.Scene {
  private id?: string;
  private notice?: string;
  /** Where the list was scrolled, kept while she is opened and closed. */
  private static listY = 0;

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

  private pips(x: number, y: number, level: number, size = 5) {
    for (let i = 0; i < MAX_BOND; i++) this.add.circle(x + i * (size * 2 + 4), y, size, i < level ? PAL.amber : PAL.deepShadow).setStrokeStyle(1, i < level ? PAL.amber : PAL.armorShadow);
  }

  private list() {
    const save = game.save;
    const { top } = modeScreen(this, 'Confession', 'Fight beside them, keep Vigil with them, light candles. In time they will speak.');
    const owned = CRUSADERS.filter((c) => save.owned[c.id]).sort((a, b) => bondInfo(save, b.id).xp - bondInfo(save, a.id).xp);
    this.add.text(PAD, top, `+${Math.round(BOND_STAT * 100)}% ATK AND HP PER BOND LEVEL`, text.hud(12, PAL.muted));
    const cell = 118;
    const x0 = GAME_W / 2 - cell * 1.5;
    // Every Sister in one list: drag or wheel to scroll.
    const list = addScrollArea(this, top + 18, GAME_H - TAB_BAR_H, { start: ConfessionScene.listY, onScroll: (y) => (ConfessionScene.listY = y) });
    const before = this.children.list.length;
    owned.forEach((c, i) => {
      const x = x0 + (i % 4) * cell;
      const y = top + 74 + Math.floor(i / 4) * 140;
      const b = bondInfo(save, c.id);
      makePlaceholderPortrait(this, c);
      this.add.rectangle(x, y, 98, 98, 0x000000, 0).setStrokeStyle(2, RARITY_COLOR[c.rarity]);
      const img = this.add.image(x, y, portraitKey(c.id)).setDisplaySize(94, 94);
      list.tap(img, () => this.scene.restart({ id: c.id }));
      holdForCard(this, img, c.id);
      this.add.text(x, y + 56, c.name.split(' ')[0], text.body(15, PAL.ivory)).setOrigin(0.5, 0);
      this.pips(x - 28, y + 82, b.level, 4);
      if (b.unheard) this.add.circle(x + 42, y - 42, 7, PAL.amber).setStrokeStyle(2, 0x1b121c);
    });
    list.content.add(this.children.list.slice(before));
    list.fit(top + 74 + Math.ceil(owned.length / 4) * 140 - 30);
  }

  private detail(id: string) {
    const save = game.save;
    const c = CRUSADERS.find((x) => x.id === id)!;
    const b = bondInfo(save, id);
    const { top } = modeScreen(this, c.name, `${c.title ?? ''} of the ${c.order}`, 'Confession');
    const bw = GAME_W - PAD * 2;
    makePlaceholderPortrait(this, c);
    this.add.rectangle(PAD + 62, top + 62, 124, 124, 0x000000, 0).setStrokeStyle(2, RARITY_COLOR[c.rarity]);
    this.add.image(PAD + 62, top + 62, portraitKey(id)).setDisplaySize(120, 120);
    const tx = PAD + 140;
    this.add.text(tx, top + 2, `BOND ${b.level ? ROMAN_RANK(b.level) : '0'} / ${ROMAN_RANK(MAX_BOND)}`, text.hud(15, PAL.amber));
    this.pips(tx + 6, top + 36, b.level, 7);
    this.add.text(tx, top + 52, b.level ? `+${Math.round(b.level * BOND_STAT * 100)}% ATK and HP` : 'No bond yet', text.body(15, PAL.ivory));
    progressBar(this, tx, top + 84, bw - 140, b.max ? 1 : b.into / b.need, PAL.amber, 8);
    this.add.text(tx, top + 94, b.max ? 'Bond complete' : `${b.into} / ${b.need} to the next level`, text.body(13, PAL.muted));
    if (!b.max) {
      const cost = candleCost(save, id);
      makeButton(this, GAME_W / 2, top + 160, bw, 50, `Light a candle for her · ${cost} Tithes`, () => {
        const ok = offerCandle(save, id);
        if (ok) commit();
        const now = bondInfo(save, id);
        this.scene.restart({ id, notice: !ok ? 'Not enough Tithes.' : now.level > b.level ? `Bond ${ROMAN_RANK(now.level)}. She has something to tell you.` : 'The candle burns. She notices.' });
      }, { fontSize: 16, icon: 'flame', disabled: save.tithes < cost });
    }

    let y = top + 204;
    this.add.text(PAD, y, 'CONFESSIONS', text.hud(13, PAL.amber));
    y += 24;
    const heardBefore = save.bonds?.[id]?.heard ?? 0;
    confessions(c).forEach((conf, i) => {
      const lv = i + 1;
      const open = b.level >= lv;
      const h = 52;
      addFrame(this, GAME_W / 2, y + h / 2, bw, h, { fill: open ? 0x221824 : 0x150f17, edge: open ? PAL.goldEdge : PAL.armorShadow });
      this.add.text(PAD + 14, y + h / 2, `${ROMAN_RANK(lv)}`, text.hud(14, open ? PAL.amber : PAL.steel)).setOrigin(0, 0.5);
      this.add.text(PAD + 52, y + h / 2, open ? conf.title : `Opens at bond ${ROMAN_RANK(lv)}`, text.body(17, open ? PAL.ivory : PAL.steel)).setOrigin(0, 0.5);
      if (open && lv > heardBefore) this.add.text(GAME_W - PAD - 14, y + h / 2, 'NEW', text.hud(12, PAL.amber)).setOrigin(1, 0.5);
      if (open) {
        const hit = this.add.rectangle(GAME_W / 2, y + h / 2, bw, h, 0, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => this.read(c.name.split(' ')[0], conf.title, conf.body));
      }
      y += h + 8;
    });
    if (b.level > heardBefore) {
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
