import Phaser from 'phaser';
import { GAME_W, PAL } from '../config';
import { commit, game } from '../state/game';
import { RARITY_COLOR } from '../data/classes';
import {
  NOVICE_COST,
  NOVICE_MARKS,
  NOVICE_TASKS,
  NOVITIATE_DAYS,
  claimNoviceMark,
  claimNoviceTask,
  dayOpen,
  markClaimable,
  noviceChoices,
  noviceDay,
  noviceEnds,
  noviceMarks,
  noviceTensLeft,
  novitiateOf,
  taskClaimable,
  taskProgress,
} from '../systems/novitiate';
import { noviceTen } from '../systems/gacha';
import { rewardText } from '../systems/tasks';
import { makeButton } from '../ui/button';
import { modeScreen, progressBar, toast, untilText } from '../ui/modeScreen';
import { portraitKey } from '../ui/placeholderPortrait';
import { holdForCard } from '../ui/sisterCard';
import { PAD, addFrame, fitLine, text } from '../ui/theme';

/**
 * The Novitiate: seven days of tasks for a new player, the Novice Marks they
 * fill, the beginner banner, and the free SSR chosen at the last mark.
 */
export class NovitiateScene extends Phaser.Scene {
  private day = 1;
  private picking = false;
  private chosen?: string;

  constructor() {
    super('Novitiate');
  }

  init(data: { day?: number; pick?: boolean }) {
    const save = game.save;
    const today = Math.min(NOVITIATE_DAYS, noviceDay(save));
    // Open on the first day with something to claim, else today.
    const ready = NOVICE_TASKS.find((t) => taskClaimable(save, t));
    this.day = data?.day ?? ready?.day ?? today;
    this.picking = !!data?.pick;
    this.chosen = undefined;
  }

  create() {
    if (this.picking) return this.drawPick();
    const save = game.save;
    const now = Date.now();
    const st = novitiateOf(save, now);
    const { top, refresh } = modeScreen(this, 'The Novitiate', '');
    const bw = GAME_W - PAD * 2;
    const today = noviceDay(save, now);
    this.add.text(PAD, top, `DAY ${Math.min(today, NOVITIATE_DAYS)} OF ${NOVITIATE_DAYS}`, text.hud(14, PAL.amber));
    this.add.text(GAME_W - PAD, top, `CLOSES IN ${untilText(noviceEnds(save, now) - now).toUpperCase()}`, text.hud(12, PAL.steel)).setOrigin(1, 0);

    // Novice Marks: one per task claimed, paying at three thresholds.
    const marks = noviceMarks(save, now);
    const max = NOVICE_TASKS.length;
    const by = top + 54;
    this.add.text(PAD, by - 24, `NOVICE MARKS ${marks} / ${max}`, text.hud(13, PAL.ivory));
    progressBar(this, PAD, by, bw, marks / max, PAL.amber, 10);
    const mw = (bw - 20) / 3;
    NOVICE_MARKS.forEach((m, i) => {
      this.add.rectangle(PAD + bw * (m.at / max), by, 4, 18, marks >= m.at ? PAL.amber : PAL.armorShadow);
      const cx = PAD + mw / 2 + i * (mw + 10);
      const cy = by + 84;
      const got = st.marks.includes(m.at);
      const ready = markClaimable(save, m, now);
      addFrame(this, cx, cy, mw, 112, { fill: ready ? 0x2c1a24 : 0x1b131d, edge: ready ? PAL.amber : PAL.armorShadow, ticks: ready });
      this.add.text(cx, cy - 38, `AT ${m.at}`, text.hud(13, ready ? PAL.amber : PAL.steel)).setOrigin(0.5);
      const label = m.pick ? `An SSR of your choice!\n+ ${rewardText(m.reward)}` : rewardText(m.reward);
      this.add.text(cx, cy - 4, label, { ...text.body(14, m.pick ? 0xfff1d6 : PAL.ivory), align: 'center', wordWrap: { width: mw - 10 }, lineSpacing: -3 }).setOrigin(0.5);
      if (got) this.add.text(cx, cy + 38, m.pick && st.picked ? 'SWORN' : 'CLAIMED', text.hud(13, PAL.muted)).setOrigin(0.5);
      else
        makeButton(this, cx, cy + 38, mw - 20, 30, m.pick ? 'Choose' : 'Claim', () => {
          if (m.pick) return this.scene.restart({ pick: true });
          if (claimNoviceMark(save, m.at)) {
            commit();
            refresh();
            this.scene.restart({ day: this.day });
          }
        }, { active: ready, disabled: !ready, fontSize: 14 });
    });

    // The beginner banner.
    const left = noviceTensLeft(save, now);
    const ay = by + 204;
    addFrame(this, GAME_W / 2, ay, bw, 96, { fill: 0x231621, edge: left ? PAL.amber : PAL.armorShadow, ticks: left > 0 });
    this.add.text(PAD + 16, ay - 34, "THE NOVICE'S ALTAR", text.hud(13, PAL.amber));
    this.add.text(PAD + 16, ay - 16, `Ten Sisters for ${NOVICE_COST} Seals.\nAn SSR or better in every ten!`, { ...text.body(16, PAL.ivory), lineSpacing: -2 });
    this.add.text(PAD + 16, ay + 24, `${left} OF 2 LEFT`, text.hud(11, PAL.steel));
    makeButton(this, GAME_W - PAD - 92, ay, 156, 56, left ? `Recruit ×10\n${NOVICE_COST} Seals` : 'Spent', () => {
      const results = noviceTen(save);
      if (!results.length) return toast(this, `${NOVICE_COST} Seals needed.`);
      commit();
      this.scene.start('Reveal', { results, novice: true });
    }, { active: left > 0 && save.seals >= NOVICE_COST, disabled: !left, fontSize: 16, icon: 'seal' });

    // Day tabs.
    const ty = ay + 82;
    const tw = (bw - 6 * 6) / 7;
    for (let d = 1; d <= NOVITIATE_DAYS; d++) {
      const open = dayOpen(save, d, now);
      const x = PAD + tw / 2 + (d - 1) * (tw + 6);
      const b = makeButton(this, x, ty, tw, 46, open ? `${d}` : '', () => d !== this.day && this.scene.restart({ day: d }), {
        active: d === this.day,
        fontSize: 18,
        icon: open ? undefined : 'lock',
      });
      if (NOVICE_TASKS.some((t) => t.day === d && taskClaimable(save, t, now))) this.add.circle(b.box.x + tw / 2 - 8, b.box.y - 16, 5, PAL.amber);
    }
    this.add.text(GAME_W / 2, ty + 34, dayOpen(save, this.day, now) ? `DAY ${this.day}` : `OPENS IN ${untilText(this.dayOpensAt(this.day) - now).toUpperCase()}`, text.hud(12, PAL.steel)).setOrigin(0.5, 0);

    // The day's tasks.
    let y = ty + 58;
    for (const t of NOVICE_TASKS.filter((x) => x.day === this.day)) {
      const have = taskProgress(save, t, now);
      const got = st.claimed.includes(t.id);
      const ready = taskClaimable(save, t, now);
      const h = 78;
      this.add.rectangle(GAME_W / 2, y + h / 2, bw, h, ready ? 0x2c1a24 : got ? 0x241a1c : 0x1b131d).setStrokeStyle(1, ready ? PAL.amber : got ? PAL.bronze : PAL.armorShadow);
      fitLine(this.add.text(PAD + 14, y + 10, t.text, text.body(18, got ? PAL.muted : PAL.ivory)), bw - 150);
      fitLine(this.add.text(PAD + 14, y + 34, rewardText(t.reward), text.body(14, got ? PAL.muted : PAL.amber)), bw - 150);
      progressBar(this, PAD + 14, y + 62, bw - 170, have / t.need, got ? PAL.bronze : PAL.amber, 6);
      this.add.text(PAD + bw - 148, y + 56, `${have}/${t.need}`, text.hud(12, PAL.steel));
      if (got) this.add.text(PAD + bw - 14, y + h / 2, 'CLAIMED', text.hud(13, PAL.bronze)).setOrigin(1, 0.5);
      else
        makeButton(this, PAD + bw - 56, y + h / 2, 92, 40, 'Claim', () => {
          if (claimNoviceTask(save, t.id)) {
            commit();
            refresh();
            this.scene.restart({ day: this.day });
          }
        }, { active: ready, disabled: !ready, fontSize: 15 });
      y += h + 8;
    }
  }

  private dayOpensAt(day: number) {
    const [yy, mm, dd] = novitiateOf(game.save).start.split('-').map(Number);
    return new Date(yy, mm - 1, dd + day - 1).getTime();
  }

  /** The last mark: choose any standard SSR. */
  private drawPick() {
    const save = game.save;
    const { top } = modeScreen(this, 'Choose a Sister', 'She swears to you at once.', 'Novitiate');
    const list = noviceChoices();
    const cols = 6;
    const cell = (GAME_W - PAD * 2) / cols;
    const size = cell - 12;
    list.forEach((c, i) => {
      const x = PAD + cell / 2 + (i % cols) * cell;
      const y = top + 20 + size / 2 + Math.floor(i / cols) * (size + 48);
      const sel = this.chosen === c.id;
      this.add.rectangle(x, y, size + 6, size + 6, sel ? 0x3a2228 : 0x000000, sel ? 1 : 0).setStrokeStyle(sel ? 4 : 2, sel ? PAL.amber : RARITY_COLOR[c.rarity]);
      const img = this.add.image(x, y, portraitKey(c.id)).setDisplaySize(size, size).setInteractive({ useHandCursor: true });
      holdForCard(this, img, c.id);
      img.on('pointerup', () => {
        this.chosen = c.id;
        this.children.removeAll(true);
        this.drawPick();
      });
      const owned = save.owned[c.id] ? ' · VOW' : '';
      fitLine(this.add.text(x, y + size / 2 + 6, c.name.split(' ')[0], text.body(14, PAL.ivory)).setOrigin(0.5, 0), cell - 4);
      fitLine(this.add.text(x, y + size / 2 + 22, `${c.order.split(' ').pop()!.toUpperCase()}${owned}`, text.hud(9, PAL.steel)).setOrigin(0.5, 0), cell - 4);
    });
    const last = NOVICE_MARKS[NOVICE_MARKS.length - 1];
    const pick = list.find((c) => c.id === this.chosen);
    makeButton(this, GAME_W / 2, top + 20 + Math.ceil(list.length / cols) * (size + 48) + 40, 300, 60, pick ? `Swear ${pick.name.split(' ')[0]}!` : 'Choose a Sister', () => {
      if (!pick) return;
      const isNew = !save.owned[pick.id];
      if (!claimNoviceMark(save, last.at, pick.id)) return;
      commit();
      this.scene.start('Reveal', { results: [{ crusader: pick, isNew, vow: save.owned[pick.id].vow, tithes: 0, tokens: save.owned[pick.id].tokens ?? 0 }], novice: true });
    }, { active: !!pick, disabled: !pick, fontSize: 19 });
  }
}
