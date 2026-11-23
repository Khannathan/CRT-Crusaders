import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { game } from '../state/game';
import { CHAPTERS, STAGES_PER_CHAPTER, campaignOf, stageDef } from '../systems/campaign';
import { chronicle, seenScene } from '../systems/story';
import { modeScreen } from '../ui/modeScreen';
import { addScrollArea } from '../ui/scroll';
import { TAB_BAR_H } from '../ui/tabBar';
import { PAD, text } from '../ui/theme';

/** The Chronicle: the Pilgrim's Road story so far, scene by scene, to play again. */
export class ChronicleScene extends Phaser.Scene {
  constructor() {
    super('Chronicle');
  }

  create() {
    const save = game.save;
    const { top } = modeScreen(this, 'The Chronicle', 'The road so far. Tap a scene to hear it again.', 'Campaign');
    const scenes = chronicle(save, campaignOf(save).best);
    const list = addScrollArea(this, top + 4, GAME_H - TAB_BAR_H - 6);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (list.content.add(o), o);
    const bw = GAME_W - PAD * 2;
    let y = top + 10;
    let chapter = -1;
    for (const s of scenes) {
      const c = Math.floor((s.stage - 1) / STAGES_PER_CHAPTER);
      if (c !== chapter) {
        chapter = c;
        add(this.add.text(PAD, y + 6, `CHAPTER ${c + 1}  ·  ${CHAPTERS[c].name.toUpperCase()}`, text.hud(12, PAL.amber)));
        y += 34;
      }
      const h = 62;
      const box = add(this.add.rectangle(GAME_W / 2, y + h / 2, bw, h, 0x1b131d).setStrokeStyle(1, PAL.armorShadow));
      add(this.add.text(PAD + 14, y + 10, s.title, text.body(19, seenScene(save, s.id) ? PAL.ivory : PAL.muted)));
      add(this.add.text(PAD + 14, y + 36, `${s.when === 'before' ? 'Before' : 'After'} stage ${stageDef(s.stage).label}`, text.hud(11, PAL.steel)));
      add(this.add.text(PAD + bw - 14, y + h / 2, '▶', text.hud(16, PAL.amber)).setOrigin(1, 0.5));
      box.setInteractive({ useHandCursor: true });
      list.tap(box, () => this.scene.start('Story', { id: s.id, next: { scene: 'Chronicle' } }));
      y += h + 8;
    }
    list.fit(y + 10);
  }
}
