import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { CRUSADERS } from '../data/crusaders';
import { makePlaceholderPortrait, portraitKey } from '../ui/placeholderPortrait';

/**
 * Every PNG in src/assets/portraits, found at build time. Name files by roster id
 * (CC-W001.png); crusaders without a file get a placeholder.
 */
const PORTRAIT_URLS = import.meta.glob<string>('../assets/portraits/*.png', { eager: true, query: '?url', import: 'default' });
const portraitUrl = (id: string) => PORTRAIT_URLS[`../assets/portraits/${id}.png`];

/** Loads every portrait it can find; anything missing gets a placeholder. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const label = this.add
      .text(GAME_W / 2, GAME_H / 2, 'Lighting the candles...', { fontFamily: FONT, fontSize: '22px', color: hex(PAL.ivory) })
      .setOrigin(0.5);
    this.load.on('progress', (p: number) => label.setText(`Lighting the candles... ${Math.round(p * 100)}%`));
    for (const c of CRUSADERS) {
      const url = portraitUrl(c.id);
      if (url) this.load.image(portraitKey(c.id), url);
    }
  }

  create() {
    for (const c of CRUSADERS) {
      const key = portraitKey(c.id);
      if (this.textures.exists(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      else makePlaceholderPortrait(this, c);
    }
    this.scene.start('Sanctum');
  }
}
