import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { BALANCE_VERSION } from '../systems/combat';
import { addBackdrop, text } from '../ui/theme';

/** Commandments under the logo: a little creed, a little advice. One per visit. */
export const TITLE_LINES = [
  'Obey the Order before mercy, before kin, before God.',
  'Doubt is heresy. Burn it out of yourself first.',
  'The Vigil gathers while you sleep. Claim it at dawn.',
  'Duties are decrees. Tap Go and march.',
  'Sweep all ends the day\'s Labors in one tap. Idle hands are heresy.',
  'Speak with your Sisters. Their bond is your blade.',
  'Pray less. Strike more. The Order prefers it.',
  'Trust no rival Order. They would burn you too.',
  'What the Order names heretic, you burn. Ask nothing.',
  'Lose a Sister, and keep marching. Grief is for after the war.',
];

/** The art behind the title: title-keyart.png once it lands, else the great hall. */
const titleArt = (scene: Phaser.Scene) => (scene.textures.exists('title-keyart') ? 'title-keyart' : scene.textures.exists('bg-hall') ? 'bg-hall' : '');

/**
 * The opening screen, drawn twice: by Boot while the game loads (with the
 * candle-wick bar burning down) and by Title once it has (with "Tap to begin").
 * Returns the bar's setter (loading) and the y of the bottom band.
 */
export function drawTitle(scene: Phaser.Scene, line: string) {
  const parts: Phaser.GameObjects.GameObject[] = [];
  scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0e0a10);
  // the art goes into a layer under the bands and words, whenever it arrives
  const layer = scene.add.container(0, 0);
  const art = () => {
    const key = titleArt(scene);
    if (!key) return;
    const made = addBackdrop(scene, key, GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, { alpha: key === 'title-keyart' ? 1 : 0.7, fade: key === 'title-keyart' ? 0.15 : 0.45, fadeColor: 0x0e0a10, focusY: 0.5 }) as unknown as Phaser.GameObjects.GameObject[];
    layer.removeAll(true);
    layer.add(made);
  };
  const logo = () => {
    if (!scene.textures.exists('logo')) {
      parts.push(scene.add.text(GAME_W / 2, GAME_H * 0.2, 'CRT\nCRUSADERS', { ...text.display(52, 0xfff1d6), align: 'center' }).setOrigin(0.5).setShadow(0, 4, '#000000', 12, false, true));
      return;
    }
    const img = scene.add.image(GAME_W / 2, GAME_H * 0.2, 'logo');
    // pixel art: the biggest whole-number scale that fits
    img.setScale(Math.max(1, Math.floor(Math.min((GAME_W - 80) / img.width, (GAME_H * 0.24) / img.height))));
    parts.push(img);
  };
  // dark bands top and bottom keep the logo and the prompt readable over any art
  const g = scene.add.graphics().setDepth(0);
  for (let i = 0; i < 12; i++) {
    g.fillStyle(0x0e0a10, 0.75 - i * 0.06).fillRect(0, i * 16, GAME_W, 16);
    g.fillStyle(0x0e0a10, 0.85 - i * 0.065).fillRect(0, GAME_H - (i + 1) * 20, GAME_W, 20);
  }
  const lineText = scene.add.text(GAME_W / 2, GAME_H * 0.34, line, { ...text.body(20, 0xe1cabf), fontStyle: 'italic', align: 'center', wordWrap: { width: GAME_W - 80 } }).setOrigin(0.5).setShadow(0, 2, '#000000', 6, false, true);
  scene.add.text(GAME_W - 14, GAME_H - 12, `PROTOTYPE · BALANCE ${BALANCE_VERSION}`, text.hud(11, PAL.steel)).setOrigin(1, 1).setAlpha(0.7);
  return { art, logo, lineText, bandY: GAME_H - 120 };
}

/** The candle-wick loading bar: a wax bar that burns down to the right as files arrive. */
export function wickBar(scene: Phaser.Scene, y: number) {
  const w = 300;
  const x0 = GAME_W / 2 - w / 2;
  scene.add.rectangle(GAME_W / 2, y, w + 8, 18, 0x000000).setStrokeStyle(2, PAL.goldEdge);
  const wax = scene.add.rectangle(x0, y, 0, 10, 0xeadfc6).setOrigin(0, 0.5);
  const flame = scene.add.rectangle(x0, y - 12, 6, 10, PAL.amber);
  const core = scene.add.rectangle(x0, y - 10, 2, 4, 0xfff1d6);
  const label = scene.add.text(GAME_W / 2, y + 22, 'LIGHTING THE CANDLES', text.hud(13, PAL.steel)).setOrigin(0.5, 0);
  return {
    set(p: number) {
      wax.width = Math.round(w * p);
      flame.x = core.x = x0 + wax.width;
      label.setText(`LIGHTING THE CANDLES  ${Math.round(p * 100)}%`);
    },
    destroy() {
      [wax, flame, core, label].forEach((o) => o.destroy());
    },
  };
}

/** The title once everything has loaded: tap anywhere to begin. */
export class TitleScene extends Phaser.Scene {
  private line = TITLE_LINES[0];
  private next = 'Sanctum';

  constructor() {
    super('Title');
  }

  init(data: { line?: string; next?: string }) {
    if (data?.line) this.line = data.line;
    if (data?.next) this.next = data.next;
  }

  create() {
    const t = drawTitle(this, this.line);
    t.art();
    t.logo();
    const prompt = this.add.text(GAME_W / 2, t.bandY, 'Tap to begin the vigil', text.display(26, 0xfff1d6)).setOrigin(0.5).setShadow(0, 2, '#000000', 8, false, true);
    // the prompt breathes in hard steps, like candlelight
    this.tweens.add({ targets: prompt, alpha: { from: 1, to: 0.35 }, duration: 900, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [4] });
    let gone = false;
    const begin = () => {
      if (gone) return;
      gone = true;
      this.cameras.main.fadeOut(260, 14, 10, 16);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(this.next));
    };
    // a short pause, so a tap meant for the loading screen does not skip the title
    this.time.delayedCall(250, () => this.input.once('pointerup', begin));
    this.input.keyboard?.once('keydown', begin);
  }
}
