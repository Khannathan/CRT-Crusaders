import Phaser from 'phaser';
import { GAME_W, PAL } from '../config';
import { commit, game } from '../state/game';
import { MAX_RANK, ROMAN_RANK, UNLOCKS, claimGifts, giftsWaiting, rankGift, rankInfo } from '../systems/rank';
import { makeButton } from '../ui/button';
import { modeScreen, progressBar } from '../ui/modeScreen';
import { PAD, addFrame, text } from '../ui/theme';

const EARNS = [
  'Winning fights, elites and bosses',
  'Purifying crypts',
  'Finishing Daily Penance',
  'Claiming the Vigil',
  'Raising, tempering and vowing Sisters',
  'Breaking seals at the Altar',
];

/** Rank of Faith: the account level, its gifts, and what each rank opens. */
export class RankScene extends Phaser.Scene {
  constructor() {
    super('Rank');
  }

  create() {
    const save = game.save;
    const { top, refresh } = modeScreen(this, 'Rank of Faith', 'Every deed of the faithful is counted. Rise, and more of the war opens to you.');
    const info = rankInfo(save);
    const bw = GAME_W - PAD * 2;

    addFrame(this, GAME_W / 2, top + 70, bw, 130, { fill: 0x1b131d });
    this.add.text(PAD + 20, top + 20, 'RANK', text.hud(13, PAL.amber));
    this.add.text(PAD + 20, top + 36, ROMAN_RANK(info.rank), text.display(40, 0xfff1d6));
    this.add
      .text(GAME_W - PAD - 20, top + 34, info.rank >= MAX_RANK ? 'HIGHEST RANK' : `${info.into} / ${info.need} FAITH`, text.hud(13, PAL.muted))
      .setOrigin(1, 0);
    progressBar(this, PAD + 20, top + 104, bw - 40, info.need ? info.into / info.need : 1, PAL.amber, 10);

    const waiting = giftsWaiting(save);
    const gy = top + 170;
    if (waiting.length) {
      const sum = waiting.reduce((a, r) => ({ seals: a.seals + rankGift(r).seals, tithes: a.tithes + rankGift(r).tithes }), { seals: 0, tithes: 0 });
      this.add.text(PAD, gy - 14, `${waiting.length} rank gift${waiting.length > 1 ? 's' : ''} waiting: ${sum.seals} Seals + ${sum.tithes} Tithes`, text.body(18, PAL.amber));
      makeButton(this, GAME_W / 2, gy + 34, 260, 56, 'Claim gifts', () => {
        claimGifts(save);
        commit();
        refresh();
        this.scene.restart();
      }, { active: true, fontSize: 19, icon: 'seal' });
    } else {
      const next = rankGift(info.rank + 1);
      this.add.text(PAD, gy - 14, info.rank >= MAX_RANK ? 'Every gift is claimed.' : `Next rank gift: ${next.seals} Seals + ${next.tithes} Tithes`, text.body(18, PAL.muted));
    }

    let y = gy + 84;
    this.add.text(PAD, y, 'WHAT RANKS OPEN', text.hud(13, PAL.amber));
    y += 24;
    for (const u of UNLOCKS) {
      const open = info.rank >= u.rank;
      this.add.rectangle(GAME_W / 2, y + 30, bw, 60, open ? 0x221820 : 0x18111a).setStrokeStyle(1, open ? PAL.bronze : PAL.armorShadow);
      this.add.text(PAD + 14, y + 10, `${ROMAN_RANK(u.rank)}`, text.hud(14, open ? PAL.amber : PAL.steel));
      this.add.text(PAD + 60, y + 8, u.name, { ...text.body(18, open ? PAL.ivory : PAL.muted), fontStyle: '600' });
      this.add.text(PAD + 60, y + 32, u.desc, text.body(14, PAL.muted));
      this.add.text(GAME_W - PAD - 14, y + 30, open ? 'OPEN' : 'SEALED', text.hud(12, open ? PAL.bronze : PAL.steel)).setOrigin(1, 0.5);
      y += 66;
    }

    y += 10;
    this.add.text(PAD, y, 'WHAT EARNS FAITH', text.hud(13, PAL.amber));
    this.add.text(PAD, y + 22, EARNS.map((e) => `· ${e}`).join('\n'), { ...text.body(16, PAL.muted), lineSpacing: 2 });
  }
}
