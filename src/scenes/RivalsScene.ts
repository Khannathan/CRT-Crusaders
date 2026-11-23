import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { commit, game } from '../state/game';
import { CRYPTS } from '../systems/crusade';
import { ladder, renownOf } from '../systems/rivals';
import { towerOf } from '../systems/tower';
import { modeScreen } from '../ui/modeScreen';
import { TAB_BAR_H } from '../ui/tabBar';
import { PAD, addPanel, text } from '../ui/theme';

/** Your records, and the rival Sisterhoods just above and below you. */
export class RivalsScene extends Phaser.Scene {
  constructor() {
    super('Rivals');
  }

  create() {
    const save = game.save;
    const { top } = modeScreen(this, 'Rival Orders', 'Lesser Sisterhoods (AI). Outshine them all!');
    const { rows, place } = ladder(save);
    const seen = save.ladderSeen;
    save.ladderSeen = place;
    commit();

    // Personal bests
    const pw = GAME_W - PAD * 2;
    let y = top + 4;
    addPanel(this, PAD, y, pw, 150);
    this.add.text(PAD + 14, y + 12, 'YOUR RECORDS', text.hud(13, PAL.amber));
    const r = save.records ?? {};
    const clears = Object.entries(r.clears ?? {})
      .map(([k, rounds]) => {
        const [id, h] = k.split(':');
        const c = CRYPTS.find((x) => x.id === id);
        return c ? `${c.name}${+h ? ` H${h}` : ''}: ${rounds} rounds` : '';
      })
      .filter(Boolean)
      .slice(0, 3);
    const lines = [
      `Bell Tower: floor ${towerOf(save).best}`,
      `Inquisition: ${r.brands ?? 0} Brands in one Edict`,
      clears.length ? `Fastest clears: ${clears.join(' · ')}` : 'Fastest clears: none yet',
    ];
    this.add.text(PAD + 14, y + 34, lines.join('\n'), { ...text.body(16, PAL.ivory), lineSpacing: 6, wordWrap: { width: pw - 28 } });
    y += 164;

    // Where you stand
    const climbed = seen !== undefined ? seen - place : 0;
    this.add.text(PAD, y, `Renown ${renownOf(save)}  ·  place ${place} of ${rows.length}`, text.display(22, 0xfff1d6));
    const above = rows[place - 2];
    const note = [
      climbed > 0 ? `You climbed ${climbed} place${climbed > 1 ? 's' : ''} since you last looked!` : climbed < 0 ? `Rivals slipped past you: down ${-climbed}.` : '',
      above ? `${above.renown - renownOf(save) + 1} Renown to pass ${above.name}.` : 'No Sisterhood stands above you. Glory!',
    ].filter(Boolean);
    this.add.text(PAD, y + 34, note.join('\n'), text.body(16, PAL.amber));
    y += 34 + note.length * 22 + 10;

    // The ladder: the top three, then the ones around you.
    const show = new Set<number>([0, 1, 2]);
    for (let i = place - 4; i <= place + 2; i++) if (i >= 0 && i < rows.length) show.add(i);
    const idx = [...show].sort((a, b) => a - b);
    const rowH = 40;
    const bottom = GAME_H - TAB_BAR_H - 70;
    let last = -1;
    for (const i of idx) {
      if (y + rowH > bottom) break;
      if (last >= 0 && i > last + 1) {
        this.add.text(GAME_W / 2, y + 8, '⋯', text.body(18, PAL.steel)).setOrigin(0.5, 0);
        y += 28;
      }
      const row = rows[i];
      const you = !!row.you;
      this.add.rectangle(GAME_W / 2, y + rowH / 2, pw, rowH - 4, you ? 0x3a2228 : 0x1b121c).setStrokeStyle(1, you ? PAL.amber : PAL.armorShadow);
      this.add.text(PAD + 12, y + rowH / 2, `${i + 1}`, text.hud(14, you ? PAL.amber : PAL.steel)).setOrigin(0, 0.5);
      this.add.text(PAD + 52, y + rowH / 2, row.name, text.body(17, you ? 0xfff1d6 : PAL.ivory)).setOrigin(0, 0.5);
      this.add.text(GAME_W - PAD - 12, y + rowH / 2, `${row.renown}`, text.hud(15, you ? PAL.amber : PAL.muted)).setOrigin(1, 0.5);
      y += rowH;
      last = i;
    }
    this.add
      .text(GAME_W / 2, GAME_H - TAB_BAR_H - 36, 'Renown counts Tower floors, Inquisition Brands, the Road, crypts and Heresy cleared, and your Rank of Faith.', { ...text.body(13, PAL.steel), align: 'center', wordWrap: { width: GAME_W - 50 } })
      .setOrigin(0.5);
  }
}
