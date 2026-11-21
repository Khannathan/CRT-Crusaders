import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { CRUSADERS } from '../data/crusaders';
import { makeEffectTextures } from '../ui/effects';
import { ENEMIES } from '../data/enemies';
import { enemyKey, makeEnemyTextures } from '../ui/enemyArt';
import { makeIconTextures, makeNodeTextures } from '../ui/icons';
import { makePlaceholderPortrait, portraitKey } from '../ui/placeholderPortrait';

/**
 * Every PNG in src/assets/portraits, found at build time. Name files by roster id
 * (CC-W001.png); crusaders without a file get a placeholder.
 */
const PORTRAIT_URLS = import.meta.glob<string>('../assets/portraits/*.{png,webp}', { eager: true, query: '?url', import: 'default' });
/** A .png beats a .webp of the same name, so a new PNG drop always wins. */
const pick = (urls: Record<string, string>, base: string) => urls[`${base}.png`] ?? urls[`${base}.webp`];
const portraitUrl = (id: string) => pick(PORTRAIT_URLS, `../assets/portraits/${id}`);

/** Enemy art: src/assets/enemies/<enemy id>.png (or .webp), for example husk.png. */
const ENEMY_URLS = import.meta.glob<string>('../assets/enemies/*.{png,webp}', { eager: true, query: '?url', import: 'default' });

/**
 * UI art: src/assets/ui/<texture key>.png, for example icon-attack.png. Any file
 * whose name matches a built-in texture key replaces that drawing.
 */
const UI_URLS = import.meta.glob<string>('../assets/ui/*.{png,webp}', { eager: true, query: '?url', import: 'default' });
const fileKey = (path: string) => path.split('/').pop()!.replace(/\.(png|webp)$/, '');

/** Loads every portrait it can find; anything missing gets a placeholder. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const label = this.add
      .text(GAME_W / 2, GAME_H / 2, 'Lighting the candles...', { fontFamily: FONT, fontSize: '24px', color: hex(PAL.ivory) })
      .setOrigin(0.5);
    this.load.on('progress', (p: number) => label.setText(`Lighting the candles... ${Math.round(p * 100)}%`));
    for (const c of CRUSADERS) {
      const url = portraitUrl(c.id);
      if (url) this.load.image(portraitKey(c.id), url);
    }
    for (const e of Object.values(ENEMIES)) {
      const url = pick(ENEMY_URLS, `../assets/enemies/${e.id}`);
      if (url) this.load.image(enemyKey(e.id), url);
    }
    const ui = new Map<string, string>();
    for (const [path, url] of Object.entries(UI_URLS)) {
      if (path.endsWith('.png') || !ui.has(fileKey(path))) ui.set(fileKey(path), url); // .png wins
    }
    for (const [key, url] of ui) this.load.image(key, url);
  }

  create() {
    for (const c of CRUSADERS) {
      const key = portraitKey(c.id);
      if (this.textures.exists(key)) this.setFilter(key);
      else makePlaceholderPortrait(this, c);
    }
    for (const e of Object.values(ENEMIES)) {
      const key = enemyKey(e.id);
      if (this.textures.exists(key)) this.setFilter(key);
    }
    for (const key of ['bg-hall', 'bg-altar']) if (this.textures.exists(key)) this.setFilter(key);
    makeEffectTextures(this);
    makeEnemyTextures(this);
    makeIconTextures(this);
    makeNodeTextures(this);
    this.scene.start('Sanctum');
  }

  /**
   * True pixel art (128px or smaller) stays crisp with nearest-neighbour. Larger
   * painted art is shown smaller than its file, where smoothing avoids shimmer.
   */
  private setFilter(key: string) {
    const tex = this.textures.get(key);
    const big = tex.getSourceImage().width > 160;
    tex.setFilter(big ? Phaser.Textures.FilterMode.LINEAR : Phaser.Textures.FilterMode.NEAREST);
  }
}
