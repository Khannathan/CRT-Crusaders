import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { commit, game } from '../state/game';
import { CRUSADERS } from '../data/crusaders';
import { ENEMIES } from '../data/enemies';
import { ORDERS } from '../data/orders';
import { STORY, type StoryScene as SceneDef } from '../data/story';
import { CHAPTERS, STAGES_PER_CHAPTER } from '../systems/campaign';
import { markSeen } from '../systems/story';
import { makeButton } from '../ui/button';
import { enemyKey } from '../ui/enemyArt';
import { portraitKey } from '../ui/placeholderPortrait';
import { SisterSprite, fullKey } from '../ui/sisterSprite';
import { PAD, addBackdrop, addFrame, text } from '../ui/theme';

interface Next {
  scene: string;
  data?: object;
}

/**
 * A story scene, told on the field: the company stands on the road, the foe
 * looms on the right, and each line plays in a box below with the speaker's
 * bust. Tap to go on; Skip ends it. It is marked seen either way.
 */
export class StoryScene extends Phaser.Scene {
  private def!: SceneDef;
  private next: Next = { scene: 'Campaign' };
  private index = 0;
  private figures = new Map<string, SisterSprite | Phaser.GameObjects.Image>();
  private foe?: Phaser.GameObjects.Image;
  private nameText!: Phaser.GameObjects.Text;
  private lineText!: Phaser.GameObjects.Text;
  private bust!: Phaser.GameObjects.Image;
  private bustFrame!: Phaser.GameObjects.Rectangle;
  private typing?: Phaser.Time.TimerEvent;
  private full = '';

  constructor() {
    super('Story');
  }

  init(data: { id: string; next?: Next }) {
    this.def = STORY.find((s) => s.id === data.id) ?? STORY[0];
    this.next = data.next ?? { scene: 'Campaign' };
    this.index = 0;
    this.figures = new Map();
    this.foe = undefined;
  }

  create() {
    const def = this.def;
    const chapter = CHAPTERS[Math.min(CHAPTERS.length - 1, Math.floor((def.stage - 1) / STAGES_PER_CHAPTER))];
    const bg = this.textures.exists(`bg-${chapter.crypt.id}`) ? `bg-${chapter.crypt.id}` : 'bg-hall';
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0e0d11);
    addBackdrop(this, bg, GAME_W / 2, GAME_H * 0.4, GAME_W, GAME_H * 0.8, { alpha: 0.7, fade: 0.5, fadeColor: 0x0e0d11 });

    // Title card
    this.add.text(GAME_W / 2, 70, chapter.name.toUpperCase(), text.hud(13, PAL.steel)).setOrigin(0.5);
    this.add.text(GAME_W / 2, 100, def.title, text.display(30, 0xfff1d6)).setOrigin(0.5).setShadow(0, 2, '#000000', 8, false, true);

    // The company on the road: every Sister who speaks, left to right.
    const ground = GAME_H * 0.64;
    const sisters = [...new Set(def.lines.map((l) => l.who).filter((w) => CRUSADERS.some((c) => c.id === w)))];
    const foeId = def.lines.find((l) => l.who.startsWith('foe:'))?.who.slice(4);
    const span = GAME_W - 80;
    // Two figures or fewer on the road stand at double size.
    const big = sisters.length + (foeId ? 1 : 0) <= 2 ? 2 : 1;
    sisters.forEach((id, i) => {
      const edge = big === 2 ? 130 : 60;
      const x = edge + (span - edge * 2 + 80) * (sisters.length === 1 ? (foeId ? 0.15 : 0.5) : i / (sisters.length - 1));
      const y = ground + (i % 2 ? 18 : 0);
      const c = CRUSADERS.find((x) => x.id === id)!;
      if (this.textures.exists(fullKey(id))) {
        const fig = new SisterSprite(this, id, x, y, big, ORDERS[c.order]?.color ?? PAL.bronze);
        if (foeId) fig.face(1);
        this.figures.set(id, fig);
      } else {
        this.figures.set(id, this.add.image(x, y - 70 * big, portraitKey(id)).setDisplaySize(120 * big, 120 * big));
      }
    });
    if (foeId && this.textures.exists(enemyKey(foeId))) {
      // The foe looms over the road, framed like a relic.
      const fx = GAME_W - 120;
      const fy = ground - 300;
      this.add.rectangle(fx, fy, 196, 196, 0x000000, 0.4).setStrokeStyle(3, 0x9a2a33);
      this.foe = this.add.image(fx, fy, enemyKey(foeId)).setDisplaySize(188, 188).setAlpha(0.9);
      this.tweens.add({ targets: this.foe, y: this.foe.y - 6, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.inOut' });
    }

    // The line box
    const boxH = 220;
    const boxY = GAME_H - boxH / 2 - 40;
    addFrame(this, GAME_W / 2, boxY, GAME_W - PAD * 2, boxH, { fill: 0x1b121c, edge: PAL.bronze });
    this.bustFrame = this.add.rectangle(PAD + 70, boxY - 28, 108, 108).setStrokeStyle(2, PAL.bronze);
    this.bust = this.add.image(PAD + 70, boxY - 28, portraitKey(sisters[0] ?? CRUSADERS[0].id)).setDisplaySize(104, 104);
    this.nameText = this.add.text(PAD + 140, boxY - boxH / 2 + 18, '', text.hud(14, PAL.amber));
    this.lineText = this.add.text(PAD + 140, boxY - boxH / 2 + 44, '', { ...text.body(19, PAL.ivory), wordWrap: { width: GAME_W - PAD * 2 - 160 }, lineSpacing: 2 });
    this.add.text(GAME_W - PAD - 14, boxY + boxH / 2 - 14, 'TAP ›', text.hud(11, PAL.steel)).setOrigin(1, 1);

    makeButton(this, GAME_W - PAD - 50, 36, 92, 40, 'Skip', () => this.end(), { fontSize: 15 });
    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length) return; // the Skip button
      this.advance();
    });
    this.show();
  }

  private show() {
    const line = this.def.lines[this.index];
    const who = line.who;
    const sister = CRUSADERS.find((c) => c.id === who);
    const foeId = who.startsWith('foe:') ? who.slice(4) : undefined;
    this.nameText.setText(sister ? sister.name.toUpperCase() : foeId ? (ENEMIES[foeId]?.name ?? 'The Foe').toUpperCase() : '');
    this.nameText.setColor(foeId ? '#d36a5c' : '#d6a15f');
    const bustKey = sister ? portraitKey(sister.id) : foeId ? enemyKey(foeId) : undefined;
    this.bust.setVisible(!!bustKey);
    this.bustFrame.setVisible(!!bustKey);
    if (bustKey) this.bust.setTexture(bustKey).setDisplaySize(104, 104);
    const left = bustKey ? PAD + 140 : PAD + 24;
    this.nameText.setX(left);
    this.lineText.setX(left).setWordWrapWidth(GAME_W - PAD - left - 20);
    this.lineText.setFontStyle(who === 'narrator' ? 'italic' : 'normal');
    // The speaker steps forward; the rest stand back.
    for (const [id, f] of this.figures) {
      if (f instanceof SisterSprite) f.setActive(id === who);
      else f.setAlpha(id === who ? 1 : 0.6);
    }
    if (this.foe) this.foe.setAlpha(foeId ? 1 : 0.75);
    if (sister) {
      const f = this.figures.get(sister.id);
      if (f instanceof SisterSprite) f.pulse(ORDERS[sister.order]?.color ?? PAL.amber);
    }
    // Type the line out.
    this.full = line.text;
    let n = 0;
    this.typing?.remove();
    this.lineText.setText('');
    this.typing = this.time.addEvent({
      delay: 18,
      repeat: this.full.length - 1,
      callback: () => {
        n += 1;
        this.lineText.setText(this.full.slice(0, n));
      },
    });
  }

  private advance() {
    // A tap mid-line finishes the line first.
    if (this.typing && this.typing.getRepeatCount() > 0) {
      this.typing.remove();
      this.typing = undefined;
      this.lineText.setText(this.full);
      return;
    }
    this.index += 1;
    if (this.index >= this.def.lines.length) return this.end();
    this.show();
  }

  private end() {
    markSeen(game.save, this.def.id);
    commit();
    this.scene.start(this.next.scene, this.next.data ?? {});
  }
}
