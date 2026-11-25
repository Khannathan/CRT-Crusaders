import { current } from '../state/run';
import { game, storedRun } from '../state/game';
import { restoreRun } from '../systems/crusade';
import { playOutStoredFight } from '../systems/settle';
import { setHomecoming } from '../systems/boosts';
import { announceSettled } from '../ui/bgFight';
import { catchUpMarch } from '../ui/marchUi';
import Phaser from 'phaser';
import { bootSisters, queueSisterArt, streamTheRest } from '../ui/sisterArt';
import { TITLE_LINES, drawTitle, wickBar } from './TitleScene';

import { CRUSADERS } from '../data/crusaders';
import { makeEffectTextures } from '../ui/effects';
import { ENEMIES } from '../data/enemies';
import { enemyKey, makeEnemyTextures } from '../ui/enemyArt';
import { ORDER_LIST } from '../data/orders';
import { makeIconTextures, makeNodeTextures, makeSigilTextures } from '../ui/icons';
import { animKey, type AnimName } from '../ui/fieldView';
import { initStandIns, queueStandInMasks } from '../ui/standIn';
import { reviewRequest } from '../ui/artReview';

/** A .png beats a .webp of the same name, so a new PNG drop always wins. */
const pick = (urls: Record<string, string>, base: string) => urls[`${base}.png`] ?? urls[`${base}.webp`];

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
/** Loaded before everything else: the opening screen's logo and art. */
const TITLE_FIRST = ['logo', 'title-keyart', 'bg-hall'];
const fileKey = (path: string) => path.split('/').pop()!.replace(/\.(png|webp)$/, '');

/** Loads the art the first screens need; every other Sister's art streams in behind the title (ui/sisterArt.ts). */
export class BootScene extends Phaser.Scene {
  private line = '';

  constructor() {
    super('Boot');
  }

  preload() {
    // The opening screen draws itself as its own art arrives, and the wick burns with the load.
    this.line = TITLE_LINES[Math.floor(Math.random() * TITLE_LINES.length)];
    const title = drawTitle(this, this.line);
    const bar = wickBar(this, title.bandY);
    this.load.on('progress', (p: number) => bar.set(p));
    this.load.once('filecomplete-image-logo', () => title.logo());
    this.load.on('filecomplete', (key: string) => {
      if (key === 'title-keyart' || (key === 'bg-hall' && !this.textures.exists('title-keyart'))) title.art();
    });
    // the title's own art first, so it shows while the rest loads
    for (const key of TITLE_FIRST) {
      const url = UI_URLS[`../assets/ui/${key}.png`] ?? UI_URLS[`../assets/ui/${key}.webp`];
      if (url) this.load.image(key, url);
    }
    queueStandInMasks(this);
    // Only the Sisters you will see first (yours, the banner's, your Vigil's); the rest stream in after the title.
    const review = reviewRequest(window.location.search);
    for (const id of [...bootSisters(game.save), ...(review ? [review] : [])]) queueSisterArt(this.load, id);
    for (const e of Object.values(ENEMIES)) {
      const url = pick(ENEMY_URLS, `../assets/enemies/${e.id}`) ?? (e.art ? pick(ENEMY_URLS, `../assets/enemies/${e.art}`) : undefined);
      if (url) this.load.image(enemyKey(e.id), url);
      // A boss's bust in its Blasphemy pose (enemies/<id>-blasphemy.png), cropped like its plain bust.
      const pose = pick(ENEMY_URLS, `../assets/enemies/${e.id}-blasphemy`);
      if (pose) this.load.image(`${enemyKey(e.id)}-blasphemy`, pose);
      const art = e.art ?? e.id;
      // A foe with its own figure never borrows its template's Blasphemy pose (a different creature).
      const own = !!ENEMY_FULL_URLS[`../assets/enemy-full/${e.id}.png`];
      for (const pose of ['', '-blasphemy']) {
        const full = ENEMY_FULL_URLS[`../assets/enemy-full/${e.id}${pose}.png`] ?? (own && pose ? undefined : ENEMY_FULL_URLS[`../assets/enemy-full/${art}${pose}.png`]);
        if (full) this.load.image(`full-enemy-${e.id}${pose}`, full);
      }
    }
    const ui = new Map<string, string>();
    for (const [path, url] of Object.entries(UI_URLS)) {
      if (path.endsWith('.png') || !ui.has(fileKey(path))) ui.set(fileKey(path), url); // .png wins
    }
    for (const [key, url] of ui) if (!TITLE_FIRST.includes(key)) this.load.image(key, url);
    for (const [path, url] of Object.entries(ANIM_URLS)) {
      const m = /([^/]+)_([a-z]+)\.png$/.exec(path);
      if (m) this.load.spritesheet(animKey(m[1], m[2] as AnimName), url, { frameWidth: 128, frameHeight: 192 });
    }
  }

  create() {
    // Sisters without their own art stand in as an Order-and-class silhouette, drawn on first use.
    initStandIns(this);
    for (const c of CRUSADERS) {
      const key = `portrait-${c.id}`;
      if (this.textures.exists(key)) this.setFilter(key);
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
    // The Vigil's march catches up the time the game was closed.
    catchUpMarch();
    // A returning player's Homecoming boosts apply from the first claim (the welcome itself is given in the Sanctum).
    setHomecoming(game.save.welcome?.homecoming);
    // ?artreview on the address opens the developer art viewer instead of the game.
    const review = reviewRequest(window.location.search);
    if (review !== undefined) return void this.scene.start('ArtReview', { id: review });
    // The title waits for a tap (which also wakes the music on phones).
    this.scene.start('Title', { line: this.line });
    void streamTheRest(this.textures, game.save);
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
