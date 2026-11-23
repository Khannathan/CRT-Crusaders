import { current } from '../state/run';
import { storedRun } from '../state/game';
import { restoreRun } from '../systems/crusade';
import { playOutStoredFight } from '../systems/settle';
import { announceSettled } from '../ui/bgFight';
import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { CRUSADERS } from '../data/crusaders';
import { makeEffectTextures } from '../ui/effects';
import { ENEMIES } from '../data/enemies';
import { enemyKey, makeEnemyTextures } from '../ui/enemyArt';
import { ORDER_LIST } from '../data/orders';
import { makeIconTextures, makeNodeTextures, makeSigilTextures } from '../ui/icons';
import { animKey, type AnimName } from '../ui/fieldView';
import { fullBodyUrl, makePlaceholderPortrait, portraitKey } from '../ui/placeholderPortrait';

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
 * Full-body enemy figures: src/assets/enemy-full/<enemy id>.png (128 x 192, feet
 * 8 rows above the bottom edge, like the Sisters' figures), plus
 * <enemy id>-blasphemy.png for a boss's Blasphemy pose. Keys: full-enemy-<id>
 * and full-enemy-<id>-blasphemy.
 */
const ENEMY_FULL_URLS = import.meta.glob<string>('../assets/enemy-full/*.png', { eager: true, query: '?url', import: 'default' });

/**
 * UI art: src/assets/ui/<texture key>.png, for example icon-attack.png. Any file
 * whose name matches a built-in texture key replaces that drawing.
 */
const UI_URLS = import.meta.glob<string>('../assets/ui/*.{png,webp}', { eager: true, query: '?url', import: 'default' });
/**
 * Sister animation sheets: src/assets/anim/<id>_<anim>.png, 256 x 384 (four 128 x 192
 * frames, made by tools/intake_anims.py). Any Sister with sheets plays them in
 * real-time fights; the rest keep the motion built from their still figure.
 */
const ANIM_URLS = import.meta.glob<string>('../assets/anim/*.png', { eager: true, query: '?url', import: 'default' });
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
      // Full-body pixel figures are small (about 7 KB each), so battles can use them at once.
      const full = fullBodyUrl(c.id);
      if (full) this.load.image(`full-${c.id}`, full);
    }
    for (const e of Object.values(ENEMIES)) {
      const url = pick(ENEMY_URLS, `../assets/enemies/${e.id}`) ?? (e.art ? pick(ENEMY_URLS, `../assets/enemies/${e.art}`) : undefined);
      if (url) this.load.image(enemyKey(e.id), url);
      // A boss's bust in its Blasphemy pose (enemies/<id>-blasphemy.png), cropped like its plain bust.
      const pose = pick(ENEMY_URLS, `../assets/enemies/${e.id}-blasphemy`);
      if (pose) this.load.image(`${enemyKey(e.id)}-blasphemy`, pose);
      const art = e.art ?? e.id;
      for (const pose of ['', '-blasphemy']) {
        const full = ENEMY_FULL_URLS[`../assets/enemy-full/${e.id}${pose}.png`] ?? ENEMY_FULL_URLS[`../assets/enemy-full/${art}${pose}.png`];
        if (full) this.load.image(`full-enemy-${e.id}${pose}`, full);
      }
    }
    const ui = new Map<string, string>();
    for (const [path, url] of Object.entries(UI_URLS)) {
      if (path.endsWith('.png') || !ui.has(fileKey(path))) ui.set(fileKey(path), url); // .png wins
    }
    for (const [key, url] of ui) this.load.image(key, url);
    for (const [path, url] of Object.entries(ANIM_URLS)) {
      const m = /([^/]+)_([a-z]+)\.png$/.exec(path);
      if (m) this.load.spritesheet(animKey(m[1], m[2] as AnimName), url, { frameWidth: 128, frameHeight: 192 });
    }
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
    for (const key of this.textures.getTextureKeys()) if (key.startsWith('bg-')) this.setFilter(key); // any backdrop, e.g. bg-sunken-belfry
    makeEffectTextures(this);
    makeEnemyTextures(this);
    makeIconTextures(this);
    makeNodeTextures(this);
    makeSigilTextures(this, ORDER_LIST);
    // A crypt run cut short by a reload picks up where it was.
    if (!current.run) current.run = restoreRun(storedRun());
    // A fight that was under way plays out to its end, as if skipped.
    const settled = playOutStoredFight();
    this.scene.start('Sanctum');
    if (settled) window.setTimeout(() => announceSettled(settled), 900);
  }

  /**
   * All in-game art is now true pixel art at its native size (busts 128, scenes
   * 192 x 128, backdrops 256 x 384), so it stays crisp with nearest-neighbour.
   * Only an old painted file larger than 400px gets smoothing. (Splash art is
   * loaded on its own, with smoothing.)
   */
  private setFilter(key: string) {
    const tex = this.textures.get(key);
    const painted = tex.getSourceImage().width > 400;
    tex.setFilter(painted ? Phaser.Textures.FilterMode.LINEAR : Phaser.Textures.FilterMode.NEAREST);
  }
}
