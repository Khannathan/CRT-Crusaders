import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { commit, game } from '../state/game';
import { MATINS, MATINS_DAYS, lightCandle, matinsOf, matinsReady, matinsText, vowCandidates, type MatinsClaim } from '../systems/matins';
import { makeButton } from '../ui/button';
import { modeScreen } from '../ui/modeScreen';
import { portraitKey } from '../ui/placeholderPortrait';
import { PAD, addFrame, text } from '../ui/theme';

/** Matins: 28 candles, one lit per day. A missed day waits; nothing is lost. */
export class MatinsScene extends Phaser.Scene {
  private notice?: string;

  constructor() {
    super('Matins');
  }

  init(data: { notice?: string }) {
    this.notice = data?.notice;
  }

  create() {
    const save = game.save;
    const { top, refresh } = modeScreen(this, 'Matins', 'One candle each dawn. Miss a day and the next candle simply waits for you.');
    const m = matinsOf(save);
    const ready = matinsReady(save);
    const cols = 7;
    const gap = 6;
    const cw = (GAME_W - PAD * 2 - gap * (cols - 1)) / cols;
    const ch = 100;
    for (let i = 0; i < MATINS_DAYS; i++) {
      const x = PAD + cw / 2 + (i % cols) * (cw + gap);
      const y = top + 10 + ch / 2 + Math.floor(i / cols) * (ch + gap);
      const lit = i < m.lit;
      const today = ready && i === m.lit;
      const big = (i + 1) % 7 === 0 || i === 13;
      const r = MATINS[i];
      this.add.rectangle(x, y, cw, ch, today ? 0x2c1a24 : 0x1b131d).setStrokeStyle(today ? 2 : 1, today ? PAL.amber : big ? PAL.bronze : PAL.armorShadow);
      this.add.text(x, y - ch / 2 + 6, `${i + 1}`, text.hud(12, today ? PAL.amber : PAL.steel)).setOrigin(0.5, 0);
      // a candle: wax, wick, and a flame once lit
      const wax = lit ? 0xd8c6a8 : 0x5b4a4e;
      this.add.rectangle(x, y + 2, 12, 26, wax).setOrigin(0.5, 0);
      this.add.rectangle(x, y + 2, 2, 4, 0x2a1e1e).setOrigin(0.5, 1);
      if (lit || today) {
        const flame = this.add.ellipse(x, y - 6, 9, 15, lit ? PAL.amber : 0xffd27a).setAlpha(lit ? 1 : 0.5);
        if (today) this.tweens.add({ targets: flame, alpha: 1, scaleY: 1.2, duration: 500, yoyo: true, repeat: -1 });
      }
      this.add
        .text(x, y + ch / 2 - 6, matinsText(r), { ...text.body(12, r.vowToken ? PAL.amber : lit ? PAL.muted : PAL.ivory), align: 'center', wordWrap: { width: cw - 4 } })
        .setOrigin(0.5, 1);
    }

    const by = top + 10 + 4 * (ch + gap) + 30;
    const day = m.lit + 1;
    this.add
      .text(GAME_W / 2, by, ready ? `Dawn ${day} of ${MATINS_DAYS}: ${matinsText(MATINS[m.lit])}` : 'Your candle burns. Return at the next dawn.', {
        ...text.body(19, ready ? PAL.amber : PAL.muted),
        align: 'center',
      })
      .setOrigin(0.5);
    const light = () => {
      if (MATINS[m.lit].vowToken && vowCandidates(save).length) return this.pickSister((id) => this.done(lightCandle(save, Date.now(), id), refresh));
      this.done(lightCandle(save), refresh);
    };
    makeButton(this, GAME_W / 2, by + 60, 300, 70, ready ? 'Light the candle' : 'Lit for today', light, { active: ready, disabled: !ready, fontSize: 20, icon: 'flame' });
    if (this.notice) this.toast(this.notice);
  }

  private done(c: MatinsClaim | undefined, refresh: () => void) {
    if (!c) return;
    commit();
    refresh();
    const extra = c.gear ? `\n${c.gear.name} (${c.gear.rarity})` : '';
    this.scene.restart({ notice: `Candle ${c.day} lit: ${matinsText(c.reward)}${extra}` });
  }

  private toast(msg: string) {
    const t = this.add.text(GAME_W / 2, GAME_H - 190, msg, { ...text.body(20, PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 80 } }).setOrigin(0.5).setDepth(31);
    const bg = this.add.rectangle(GAME_W / 2, GAME_H - 190, t.width + 40, t.height + 26, 0x1b121c, 0.97).setStrokeStyle(1, PAL.amber).setDepth(30);
    this.tweens.add({ targets: [t, bg], alpha: 0, delay: 2600, duration: 600, onComplete: () => (t.destroy(), bg.destroy()) });
  }

  /** Candle 28: whose Vow does it feed? */
  private pickSister(then: (id: string) => void) {
    const save = game.save;
    const layer = this.add.container(0, 0).setDepth(20);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.95).setInteractive());
    layer.add(addFrame(this, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 }));
    layer.add(this.add.text(GAME_W / 2, 66, 'WHOSE VOW?', text.display(22, PAL.ivory)).setOrigin(0.5));
    layer.add(this.add.text(GAME_W / 2, 100, 'The last candle grants one Vow token.', text.body(17, PAL.muted)).setOrigin(0.5));
    vowCandidates(save)
      .slice(0, 20)
      .forEach((c, i) => {
        const x = GAME_W / 2 + ((i % 4) - 1.5) * 112;
        const y = 180 + Math.floor(i / 4) * 128;
        const frame = this.add.rectangle(x, y, 100, 100, 0x150e17).setStrokeStyle(2, RARITY_COLOR[c.rarity]);
        const img = this.add.image(x, y, portraitKey(c.id)).setDisplaySize(94, 94);
        const name = this.add.text(x, y + 60, c.name.split(' ')[0], text.body(15, PAL.ivory)).setOrigin(0.5);
        frame.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          layer.destroy();
          then(c.id);
        });
        layer.add([frame, img, name]);
      });
    const back = makeButton(this, GAME_W / 2, GAME_H - 62, 220, 60, 'Back', () => layer.destroy(), { fontSize: 19 });
    layer.add(back.all);
  }
}
