import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { RELICS } from '../data/relics';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import { REWARDS, currentRoom, finishRun, maxHpOf, relicOffer, shrine, takeRelic, type Room } from '../systems/crusade';
import { makeButton } from '../ui/button';
import { portraitKey } from '../ui/placeholderPortrait';

const ROOM_LABEL = (r: Room) => (r.kind === 'boss' ? 'The Choir Below' : r.kind === 'choice' ? 'A fork in the dark' : 'Crypt chamber');

/** The crypt path, top to bottom, with the party's state and the next choice. */
export class CryptScene extends Phaser.Scene {
  constructor() {
    super('Crypt');
  }

  create() {
    const run = current.run;
    if (!run) {
      this.scene.start('Crusade');
      return;
    }
    if (!currentRoom(run)) {
      this.finish('victory');
      return;
    }
    this.cameras.main.setBackgroundColor(PAL.bg);
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    this.add.text(GAME_W / 2, 36, run.crypt.name, { ...style, fontSize: '26px', color: hex(PAL.amber) }).setOrigin(0.5);
    this.add
      .text(GAME_W / 2, 70, `Earned so far: ${run.tithes} Tithes · ${run.seals} Seals`, { ...style, fontSize: '15px', color: hex(PAL.steel) })
      .setOrigin(0.5);

    // Path
    const x = 90;
    run.crypt.rooms.forEach((room, i) => {
      const y = 130 + i * 72;
      const done = i < run.roomIndex;
      const here = i === run.roomIndex;
      if (i > 0) this.add.rectangle(x, y - 36, 4, 40, done || here ? PAL.bronze : PAL.armorShadow);
      const size = room.kind === 'boss' ? 30 : 22;
      this.add
        .rectangle(x, y, size, size, here ? PAL.oxblood : done ? PAL.armorShadow : PAL.deepShadow)
        .setAngle(45)
        .setStrokeStyle(3, here ? PAL.amber : done ? PAL.steel : PAL.armorShadow);
      this.add
        .text(x + 40, y, done ? `${ROOM_LABEL(room)} ✓` : ROOM_LABEL(room), {
          ...style,
          fontSize: here ? '21px' : '18px',
          color: hex(here ? PAL.ivory : PAL.steel),
        })
        .setOrigin(0, 0.5);
    });

    // Party
    const py = 470;
    run.party.forEach((id, i) => {
      const c = CRUSADERS.find((x) => x.id === id)!;
      const cx = 8 + 64 + i * 132;
      const hp = run.hp[id];
      const max = maxHpOf(game.save, run, id);
      this.add.rectangle(cx, py, 134, 134).setStrokeStyle(3, hp > 0 ? RARITY_COLOR[c.rarity] : PAL.armorShadow);
      const img = this.add.image(cx, py, portraitKey(id)).setDisplaySize(128, 128);
      if (hp <= 0) img.setTint(0x333333);
      this.add.rectangle(cx - 60, py + 76, 120, 8, PAL.deepShadow).setOrigin(0, 0.5);
      this.add.rectangle(cx - 60, py + 76, (120 * hp) / max, 8, hp / max > 0.4 ? 0x7a9a5a : PAL.oxblood).setOrigin(0, 0.5);
      this.add.text(cx, py + 94, hp > 0 ? `${hp} / ${max}` : 'Fallen', { ...style, fontSize: '14px', color: hex(PAL.steel) }).setOrigin(0.5);
    });
    if (run.relics.length) {
      const names = run.relics.map((id) => RELICS.find((r) => r.id === id)!.name).join(', ');
      this.add.text(GAME_W / 2, py + 124, `Relics: ${names}`, { ...style, fontSize: '15px', color: hex(PAL.violet), wordWrap: { width: GAME_W - 40 } }).setOrigin(0.5);
    }

    // Actions
    const room = currentRoom(run)!;
    const ay = 720;
    if (room.kind === 'choice') {
      this.add.text(GAME_W / 2, ay - 60, 'Choose your path', { ...style, fontSize: '20px' }).setOrigin(0.5);
      makeButton(this, 92, ay, 168, 96, `Side passage\nfight for +${REWARDS.sideFightTithes} T\nand +${REWARDS.sideFightSeals} Seal`, () => {
        run.sideFight = true;
        this.scene.start('Battle');
      }, { fontSize: 15 });
      makeButton(this, GAME_W / 2, ay, 168, 96, `Shrine\nheal everyone\n${REWARDS.shrineHealPct * 100}% HP`, () => {
        shrine(game.save, run);
        this.scene.restart();
      }, { fontSize: 15 });
      makeButton(this, GAME_W - 92, ay, 168, 96, 'Reliquary\ntake one\nrun relic', () => this.showRelics(), { fontSize: 15 });
    } else {
      makeButton(this, GAME_W / 2, ay, 320, 90, room.kind === 'boss' ? 'Face the Choir' : 'Enter the chamber', () => {
        run.sideFight = false;
        this.scene.start('Battle');
      }, { active: true });
    }
    makeButton(this, GAME_W / 2, GAME_H - 60, 260, 64, 'Retreat (keep Tithes)', () => this.finish('retreat'), { fontSize: 17 });
  }

  private showRelics() {
    const run = current.run!;
    const layer = this.add.container(0, 0).setDepth(20);
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.94).setInteractive());
    layer.add(this.add.text(GAME_W / 2, 200, 'The reliquary offers', { ...style, fontSize: '26px', color: hex(PAL.violet) }).setOrigin(0.5));
    relicOffer(run).forEach((r, i) => {
      const b = makeButton(this, GAME_W / 2, 320 + i * 130, GAME_W - 80, 110, `${r.name}\n${r.desc}`, () => {
        takeRelic(game.save, run, r.id);
        this.scene.restart();
      }, { fontSize: 19 });
      layer.add([b.box, b.text]);
    });
  }

  private finish(outcome: 'victory' | 'retreat') {
    const result = finishRun(game.save, current.run!, outcome);
    current.run = undefined;
    commit();
    this.scene.start('Results', { result });
  }
}
