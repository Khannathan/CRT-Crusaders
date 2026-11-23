import Phaser from 'phaser';
import { GAME_W, PAL } from '../config';
import { commit, game } from '../state/game';
import { ROMAN_RANK, giftsWaiting, rankInfo } from '../systems/rank';
import { accountPower, formatPower } from '../systems/power';
import { nextMilestone } from '../systems/powerGrowth';
import { chooseKeeper, keeperOf } from '../systems/keeper';
import { hasFullBody, hasSplash, portraitKey } from '../ui/placeholderPortrait';
import { drawAlmostThere } from '../ui/almostThere';
import { pickParty } from '../ui/partyPicker';
import { makeButton } from '../ui/button';
import { modeScreen, progressBar } from '../ui/modeScreen';
import { confirmReset, showSettings } from '../ui/settingsSheet';
import { showExport, showImport } from '../ui/saveTransfer';
import { current } from '../state/run';
import { PAD, addFrame, text } from '../ui/theme';

/**
 * Behind the crest (top left of every screen): Rank of Faith, Power, title,
 * the Keeper, the closest goals, and the tools (Settings, Chronicle, Record,
 * save backup). These used to crowd the Sanctum page.
 */
export class ProfileScene extends Phaser.Scene {
  constructor() {
    super('Profile');
  }

  create() {
    const save = game.save;
    const { top } = modeScreen(this, 'Your Crest', '');
    const w = GAME_W - PAD * 2;
    let y = top + 6;

    // The Keeper's face, Rank and Power.
    const c = keeperOf(save, (id) => hasSplash(id) || hasFullBody(id));
    const bh = 150;
    addFrame(this, GAME_W / 2, y + bh / 2, w, bh, { fill: 0x1b121c });
    if (c) this.add.image(PAD + 16 + 56, y + bh / 2, portraitKey(c.id)).setDisplaySize(112, 112);
    const tx = PAD + 144;
    const ri = rankInfo(save);
    this.add.text(tx, y + 16, `RANK OF FAITH ${ROMAN_RANK(ri.rank)}`, text.hud(14, PAL.amber));
    if (ri.need) progressBar(this, tx, y + 44, w - 160, ri.into / ri.need, PAL.amber, 8);
    this.add.text(tx, y + 54, ri.need ? `${ri.into} / ${ri.need} FAITH` : 'HIGHEST RANK', text.hud(11, PAL.steel));
    const ap = accountPower(save);
    const nm = nextMilestone(save);
    this.add.text(tx, y + 78, `POWER ${formatPower(ap)}`, text.hud(16, 0xfff1d6));
    if (nm) this.add.text(tx, y + 100, `NEXT GIFT AT ${formatPower(nm.at)}`, text.hud(11, PAL.steel));
    if (save.title) this.add.text(tx, y + 120, `TITLE: ${save.title.toUpperCase()}`, text.hud(11, PAL.amber));
    y += bh + 14;

    // Buttons, two per row.
    const gifts = giftsWaiting(save).length;
    const rows: [string, () => void, boolean?][] = [
      [gifts ? `Rank gifts · ${gifts}` : 'Rank of Faith', () => this.scene.start('Rank'), gifts > 0],
      ['Change Keeper', () => this.changeKeeper()],
      ['Chronicle', () => this.scene.start('Chronicle')],
      ['Oath Record', () => this.scene.start('PullHistory')],
      ['Settings', () => showSettings(this)],
      ['Back up save', () => (commit(), showExport(save))],
      [
        'Restore save',
        () =>
          showImport((s) => {
            game.save = s;
            current.run = undefined;
            current.paused = undefined;
            current.challenge = undefined;
            commit();
            this.scene.start('Sanctum');
          }),
      ],
      ['Reset save', () => confirmReset(this)],
    ];
    const bw = (w - 10) / 2;
    rows.forEach(([label, go, lit], i) => {
      const x = PAD + bw / 2 + (i % 2) * (bw + 10);
      const by = y + 26 + Math.floor(i / 2) * 62;
      makeButton(this, x, by, bw, 52, label, go, { fontSize: 18, active: !!lit });
    });
    y += Math.ceil(rows.length / 2) * 62 + 16;

    // The closest goals.
    if (Object.keys(save.owned).length) {
      this.add.text(PAD, y, 'ALMOST THERE', text.hud(13, PAL.amber));
      drawAlmostThere(this, save, y + 18);
    }
  }

  private changeKeeper() {
    const save = game.save;
    const c = keeperOf(save);
    pickParty(this, save, { title: 'Keeper of the Sanctum', sub: 'Who keeps your Sanctum?', initial: c ? [c.id] : [], max: 1, min: 1, confirm: 'Choose', hound: false }, (ids) => {
      if (ids[0] && chooseKeeper(save, ids[0])) commit();
      this.scene.restart();
    });
  }
}
