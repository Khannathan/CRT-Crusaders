import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { commit, game } from '../state/game';
import { claimAllLetters, claimLetter, claimable, daysLeft, letterText, letters, markRead, sumLetters } from '../systems/missives';
import { makeButton } from '../ui/button';
import { modeScreen, toast } from '../ui/modeScreen';
import { addScrollArea } from '../ui/scroll';
import { TAB_BAR_H } from '../ui/tabBar';
import { PAD, fitLine, text } from '../ui/theme';

const ago = (ms: number) => {
  const h = Math.floor((Date.now() - ms) / 36e5);
  return h < 1 ? 'JUST NOW' : h < 24 ? `${h}H AGO` : `${Math.floor(h / 24)}D AGO`;
};

/** Missives: letters with rewards you missed, gifts and news. */
export class MissivesScene extends Phaser.Scene {
  private scroll = 0;
  private msg?: string;

  constructor() {
    super('Missives');
  }

  init(data: { scroll?: number; msg?: string }) {
    this.scroll = data?.scroll ?? 0;
    this.msg = data?.msg;
  }

  create() {
    const save = game.save;
    const { top } = modeScreen(this, 'Missives', 'Gifts, news, and every reward you left behind.');
    const bw = GAME_W - PAD * 2;
    const all = letters(save);
    const any = all.some(claimable);
    this.add.text(PAD, top + 14, `${all.filter(claimable).length} TO CLAIM  ·  ${all.length} LETTERS`, text.hud(12, any ? PAL.amber : PAL.steel)).setOrigin(0, 0.5);
    makeButton(this, GAME_W - PAD - 64, top + 14, 128, 36, 'Claim all', () => {
      const got = claimAllLetters(save);
      commit();
      this.scene.restart({ scroll: 0, msg: got.length ? `Received! ${letterText(sumLetters(got))}.` : undefined });
    }, { fontSize: 15, active: any, disabled: !any });

    const listTop = top + 40;
    const list = addScrollArea(this, listTop, GAME_H - TAB_BAR_H - 6, { start: this.scroll, onScroll: (y) => (this.scroll = y) });
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (list.content.add(o), o);
    let y = listTop + 4;
    if (!all.length) add(this.add.text(GAME_W / 2, y + 60, 'No letters. The road is quiet. March on!', { ...text.body(18, PAL.muted), align: 'center' }).setOrigin(0.5));
    for (const l of all) {
      const ready = claimable(l);
      const body = this.add.text(PAD + 14, y + 52, l.body, { ...text.body(16, PAL.ivory), wordWrap: { width: bw - 28 } });
      const bodyH = body.height;
      const h = 60 + bodyH + (l.reward ? 50 : 10);
      add(this.add.rectangle(GAME_W / 2, y + h / 2, bw, h, ready ? 0x2c1a24 : 0x1b131d).setStrokeStyle(1, ready ? PAL.amber : PAL.armorShadow));
      add(body).setAlpha(ready || !l.read ? 1 : 0.7);
      add(fitLine(this.add.text(PAD + 14, y + 10, l.from.toUpperCase(), text.hud(11, PAL.steel)), bw - 130));
      add(this.add.text(PAD + bw - 14, y + 10, ago(l.sent), text.hud(11, PAL.steel)).setOrigin(1, 0));
      add(fitLine(this.add.text(PAD + 14, y + 26, l.title, text.body(19, ready ? PAL.amber : 0xfff1d6)).setFontStyle('600'), bw - 28));
      if (l.reward) {
        const ry = y + 60 + bodyH + 4;
        add(fitLine(this.add.text(PAD + 14, ry, letterText(l.reward), text.body(15, ready ? PAL.amber : PAL.muted)), bw - 140));
        const left = daysLeft(l);
        add(this.add.text(PAD + 14, ry + 22, ready ? (left !== undefined ? `CRUMBLES IN ${left}D` : '') : 'CLAIMED', text.hud(10, ready && (left ?? 99) <= 3 ? PAL.damage : PAL.steel)));
        if (ready) {
          const b = makeButton(this, PAD + bw - 58, ry + 16, 96, 38, 'Claim', () => {
            if (list.dragging) return;
            const r = claimLetter(save, l.id);
            commit();
            this.scene.restart({ scroll: this.scroll, msg: r ? `Received! ${letterText(r)}.` : undefined });
          }, { active: true, fontSize: 15 });
          list.content.add(b.all);
        }
      }
      // Opening the letterbox reads every letter; a gift stays until claimed.
      if (!l.read) markRead(save, l.id);
      y += h + 8;
    }
    list.fit(y + 10);
    commit();
    if (this.msg) toast(this, this.msg);
  }
}
