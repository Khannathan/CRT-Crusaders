import Phaser from 'phaser';
import { GAME_W, PAL } from '../config';
import { commit, game } from '../state/game';
import { MARKS, TASKS, claimMark, claimable, devotion, maxDevotion, rewardText, tasksOf, type Period } from '../systems/tasks';
import { Bar } from '../ui/skin';
import { makeButton } from '../ui/button';
import { modeScreen, progressBar, untilText } from '../ui/modeScreen';
import { PAD, addFrame, text } from '../ui/theme';

/** Daily Penance and the weekly Litany: tasks, the Devotion bar and its three marks. */
export class PenanceScene extends Phaser.Scene {
  private period: Period = 'daily';

  constructor() {
    super('Penance');
  }

  init(data: { period?: Period }) {
    this.period = data?.period ?? 'daily';
  }

  create() {
    const save = game.save;
    const now = Date.now();
    const { top, refresh } = modeScreen(this, 'Penance', '');
    const st = tasksOf(save, now)[this.period];

    // Daily / weekly switch
    const tw = (GAME_W - PAD * 2 - 10) / 2;
    (['daily', 'weekly'] as Period[]).forEach((p, i) => {
      const dot = claimable(save, p, now).length > 0;
      const b = makeButton(this, PAD + tw / 2 + i * (tw + 10), top + 24, tw, 48, p === 'daily' ? 'Daily Penance' : 'Weekly Litany', () => p !== this.period && this.scene.restart({ period: p }), {
        active: p === this.period,
        fontSize: 18,
      });
      if (dot) this.add.circle(b.box.x + tw / 2 - 10, b.box.y - 14, 6, PAL.amber);
    });

    // Devotion bar with its three marks
    const dev = devotion(save, this.period, now);
    const max = maxDevotion(this.period);
    const by = top + 92;
    // ui-devotion.png before the Devotion count when present
    const devIcon = this.textures.exists('ui-devotion') ? this.add.image(PAD + 9, by - 18, 'ui-devotion').setDisplaySize(18, 18) : null;
    this.add.text(PAD + (devIcon ? 24 : 0), by - 26, `DEVOTION ${dev} / ${max}`, text.hud(14, PAL.amber));
    const next = new Date(now);
    if (this.period === 'daily') next.setHours(24, 0, 0, 0);
    else {
      next.setHours(0, 0, 0, 0);
      next.setDate(next.getDate() + (((8 - next.getDay()) % 7) || 7));
    }
    this.add.text(GAME_W - PAD, by - 26, `RENEWS IN ${untilText(next.getTime() - now).toUpperCase()}`, text.hud(12, PAL.steel)).setOrigin(1, 0);
    const bw = GAME_W - PAD * 2;
    // ui-bar-devotion.png fills the meter when present (with the ui-bar-frame skin)
    if (this.textures.exists('ui-bar-devotion')) new Bar(this, PAD, by, bw, 10, 'ui-bar-devotion', PAL.amber).set(dev / max);
    else progressBar(this, PAD, by, bw, dev / max, PAL.amber, 10);
    const marks = MARKS[this.period];
    const mw = (bw - 20) / 3;
    marks.forEach((m, i) => {
      const x = PAD + bw * (m.at / max);
      this.add.rectangle(x, by, 4, 18, dev >= m.at ? PAL.amber : PAL.armorShadow);
      const cx = PAD + mw / 2 + i * (mw + 10);
      const cy = by + 90;
      const got = st.claimed.includes(m.at);
      const ready = dev >= m.at && !got;
      addFrame(this, cx, cy, mw, 128, { fill: ready ? 0x2c1a24 : 0x1b131d, edge: ready ? PAL.amber : PAL.armorShadow, ticks: ready });
      // ui-mark / ui-mark-ready / ui-mark-claimed .png: a reliquary box on the left of the mark when present
      const markKey = got ? 'ui-mark-claimed' : ready ? 'ui-mark-ready' : 'ui-mark';
      const box = this.textures.exists(markKey) ? this.add.image(cx - 24, cy - 42, markKey).setDisplaySize(36, 36) : null;
      // box and threshold on top, the reward gets the full width of the card below them
      this.add.text(box ? cx + 2 : cx, cy - 42, `AT ${m.at}`, text.hud(14, ready ? PAL.amber : PAL.steel)).setOrigin(box ? 0 : 0.5, 0.5);
      this.add.text(cx, cy, rewardText(m.reward), { ...text.body(15, PAL.ivory), align: 'center', wordWrap: { width: mw - 10 }, lineSpacing: -3 }).setOrigin(0.5);
      if (got) this.add.text(cx, cy + 44, 'CLAIMED', text.hud(14, PAL.muted)).setOrigin(0.5);
      else
        makeButton(this, cx, cy + 44, mw - 20, 32, 'Claim', () => {
          if (claimMark(save, this.period, m.at)) {
            commit();
            refresh();
            this.scene.restart({ period: this.period });
          }
        }, { active: ready, disabled: !ready, fontSize: 15 });
    });

    // Task list
    let y = by + 168;
    for (const t of TASKS[this.period]) {
      const have = st.progress[t.id] ?? 0;
      const done = have >= t.need;
      const h = 66;
      this.add.rectangle(GAME_W / 2, y + h / 2, bw, h, done ? 0x241a1c : 0x1b131d).setStrokeStyle(1, done ? PAL.bronze : PAL.armorShadow);
      this.add.text(PAD + 14, y + 12, t.text, text.body(18, done ? PAL.muted : PAL.ivory));
      progressBar(this, PAD + 14, y + 48, bw - 140, have / t.need, done ? PAL.bronze : PAL.amber, 6);
      this.add.text(PAD + bw - 120, y + 42, `${have}/${t.need}`, text.hud(12, PAL.steel));
      this.add.text(PAD + bw - 14, y + h / 2, done ? 'DONE' : `+${t.devotion}`, text.hud(14, done ? PAL.bronze : PAL.amber)).setOrigin(1, 0.5);
      y += h + 8;
    }
  }
}
