import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { CLASSES, RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import { MAX_PARTY, canMuster, startRun, suggestParty } from '../systems/crusade';
import { makeButton } from '../ui/button';
import { portraitKey } from '../ui/placeholderPortrait';

const ROMAN = ['I', 'II', 'III', 'IV'];

/** Pick up to four crusaders and their ranks. Tap to add, tap a slot to remove. */
export class MusterScene extends Phaser.Scene {
  private party: string[] = [];

  constructor() {
    super('Muster');
  }

  init() {
    const s = game.save;
    const last = s.lastParty.filter((id) => canMuster(s, id));
    this.party = last.length ? last : suggestParty(s);
  }

  create() {
    this.children.removeAll(true);
    this.cameras.main.setBackgroundColor(PAL.bg);
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    this.add.text(GAME_W / 2, 36, 'Muster', { ...style, fontSize: '30px', color: hex(PAL.amber) }).setOrigin(0.5);
    makeButton(this, 60, 36, 96, 48, 'Back', () => this.scene.start('Crusade'), { fontSize: 18 });
    this.add
      .text(GAME_W / 2, 78, 'Rank I is the front line. Tap to add or remove.', { ...style, fontSize: '15px', color: hex(PAL.steel) })
      .setOrigin(0.5);

    // Party slots
    const slotY = 190;
    for (let i = 0; i < MAX_PARTY; i++) {
      const x = 8 + 64 + i * 132;
      this.add.text(x, slotY - 84, ROMAN[i], { ...style, fontSize: '18px', color: hex(PAL.steel) }).setOrigin(0.5);
      const id = this.party[i];
      if (!id) {
        this.add.rectangle(x, slotY, 128, 128, PAL.deepShadow).setStrokeStyle(2, PAL.armorShadow);
        continue;
      }
      const c = CRUSADERS.find((x) => x.id === id)!;
      this.add.rectangle(x, slotY, 134, 134).setStrokeStyle(3, RARITY_COLOR[c.rarity]);
      const img = this.add.image(x, slotY, portraitKey(id)).setDisplaySize(128, 128).setInteractive({ useHandCursor: true });
      img.on('pointerup', () => {
        this.party = this.party.filter((p) => p !== id);
        this.create();
      });
      this.add.text(x, slotY + 80, c.name.split(' ')[0], { ...style, fontSize: '15px' }).setOrigin(0.5);
      this.add.text(x, slotY + 98, CLASSES[c.classId].role, { ...style, fontSize: '13px', color: hex(PAL.steel) }).setOrigin(0.5);
    }

    // Pool of owned crusaders
    this.add.rectangle(GAME_W / 2, 326, GAME_W - 32, 2, PAL.armorShadow);
    const owned = CRUSADERS.filter((c) => game.save.owned[c.id]);
    owned.forEach((c, i) => {
      const x = 8 + 64 + (i % 4) * 132;
      const y = 410 + Math.floor(i / 4) * 172;
      const inParty = this.party.includes(c.id);
      const ready = canMuster(game.save, c.id);
      this.add.rectangle(x, y, 134, 134).setStrokeStyle(3, ready ? RARITY_COLOR[c.rarity] : PAL.armorShadow);
      const img = this.add.image(x, y, portraitKey(c.id)).setDisplaySize(128, 128);
      if (inParty || !ready) img.setAlpha(0.3);
      if (ready && !inParty) {
        img.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          if (this.party.length < MAX_PARTY) {
            this.party.push(c.id);
            this.create();
          }
        });
      }
      const sub = !ready ? 'Recovering' : `${CLASSES[c.classId].role} · Lv ${game.save.owned[c.id].level}`;
      this.add.text(x, y + 74, c.name.split(' ')[0], { ...style, fontSize: '14px' }).setOrigin(0.5);
      this.add.text(x, y + 90, sub, { ...style, fontSize: '12px', color: hex(PAL.steel) }).setOrigin(0.5);
    });

    makeButton(this, GAME_W / 2 - 128, GAME_H - 60, 236, 80, 'Suggest', () => {
      this.party = suggestParty(game.save);
      this.create();
    });
    makeButton(
      this,
      GAME_W / 2 + 128,
      GAME_H - 60,
      236,
      80,
      'Begin crusade',
      () => {
        current.run = startRun(game.save, this.party);
        commit();
        this.scene.start('Crypt');
      },
      { active: true, disabled: !this.party.length },
    );
  }
}
