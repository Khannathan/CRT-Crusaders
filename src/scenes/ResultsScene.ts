import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { CRUSADERS } from '../data/crusaders';
import { HERESY_FIRST_CLEAR_SEALS, MAX_HERESY, ROMAN, type RunResult } from '../systems/crusade';
import { makeButton } from '../ui/button';
import { portraitKey } from '../ui/placeholderPortrait';

const TITLES = { victory: 'The crypt is cleansed', defeat: 'The crusade has failed', retreat: 'You withdraw to the Sanctum' };

export class ResultsScene extends Phaser.Scene {
  private result!: RunResult;

  constructor() {
    super('Results');
  }

  init(data: { result: RunResult }) {
    this.result = data.result;
  }

  create() {
    const r = this.result;
    this.cameras.main.setBackgroundColor(PAL.bg);
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    this.add
      .text(GAME_W / 2, 140, TITLES[r.outcome], { ...style, fontSize: '30px', color: hex(r.outcome === 'defeat' ? PAL.oxblood : PAL.amber) })
      .setOrigin(0.5);

    this.add.text(GAME_W / 2, 250, `+${r.tithes} Tithes`, { ...style, fontSize: '28px' }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 300, `+${r.seals} Wax Seals`, { ...style, fontSize: '28px' }).setOrigin(0.5);
    const notes: string[] = [];
    if (r.firstClear) notes.push('First clear bonus included! Heresy I is now open for this crypt.');
    if (r.heresyCleared) notes.push(`Heresy ${ROMAN[r.heresyCleared - 1]} cleared for the first time: +${HERESY_FIRST_CLEAR_SEALS} Seals.${r.heresyCleared < MAX_HERESY ? ` Heresy ${ROMAN[r.heresyCleared]} is open.` : ''}`);
    if (r.outcome === 'defeat') notes.push('Half your Tithes were lost in the dark, and no Seals were kept.');
    if (r.outcome === 'retreat') notes.push('You kept your Tithes. Seals come from clearing the crypt.');
    this.add.text(GAME_W / 2, 360, notes.join('\n'), { ...style, fontSize: '17px', color: hex(PAL.steel), wordWrap: { width: GAME_W - 60 } }).setOrigin(0.5, 0);

    if (r.fallen.length) {
      this.add
        .text(GAME_W / 2, 470, 'Fallen: they sit out the next crusade,\nor can be revived with Tithes.', { ...style, fontSize: '17px', color: hex(PAL.steel) })
        .setOrigin(0.5);
      r.fallen.forEach((id, i) => {
        const x = GAME_W / 2 + (i - (r.fallen.length - 1) / 2) * 132;
        this.add.image(x, 590, portraitKey(id)).setDisplaySize(128, 128).setTint(0x555555);
        this.add.text(x, 670, CRUSADERS.find((c) => c.id === id)!.name.split(' ')[0], { ...style, fontSize: '15px' }).setOrigin(0.5);
      });
    }

    makeButton(this, GAME_W / 2 - 128, GAME_H - 80, 236, 84, 'Sanctum', () => this.scene.start('Sanctum'));
    makeButton(this, GAME_W / 2 + 128, GAME_H - 80, 236, 84, 'Crusade again', () => this.scene.start('Crusade'), { active: true });
  }
}
