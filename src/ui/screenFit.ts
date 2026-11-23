import Phaser from 'phaser';
import { BASE_H, GAME_H, GAME_W, MAX_H, setGameHeight } from '../config';

/**
 * Fits the game to the phone it runs on.
 *
 * The game is always 540 wide. Its height follows the screen's shape, from
 * 960 (9:16, e.g. 360x640) up to 1280 (about 21:9), so tall phones fill the
 * screen instead of showing black bars. Screens wider than 9:16 (tablets)
 * keep 960 and get bars at the sides. Phaser's FIT mode then scales the game
 * to the space left inside the safe area (index.html keeps it clear of
 * notches and gesture bars).
 *
 * When the shape changes later (full screen, rotation, Android's URL bar,
 * split screen), menus re-lay themselves out at once. Screens that hold a
 * fight or a reveal in progress keep their layout until the next screen opens,
 * with thin bars in the meantime.
 */

/** Scenes that must not be restarted under the player (state lives in the scene). */
const KEEP_RUNNING = new Set(['Boot', 'Battle', 'Field', 'Reveal', 'Results', 'Crypt']);

/** Game height that fills a space of w x h CSS pixels at 540 wide. */
export function heightFor(w: number, h: number) {
  if (w <= 0 || h <= 0) return BASE_H;
  // even numbers keep GAME_H / 2 a whole pixel, so centred art stays crisp
  const ideal = Math.round((GAME_W * h) / w / 2) * 2;
  return Phaser.Math.Clamp(ideal, BASE_H, MAX_H);
}

/** The space the game may use: the #game box, which index.html keeps inside the safe area. */
function available(parent: HTMLElement | null) {
  const r = parent?.getBoundingClientRect();
  if (r && r.width > 0 && r.height > 0) return { w: r.width, h: r.height };
  const vv = window.visualViewport;
  return { w: vv?.width ?? window.innerWidth, h: vv?.height ?? window.innerHeight };
}

/** Sets GAME_H for the space in `parent`. Call before creating the game. */
export function fitBeforeBoot(parent: HTMLElement | null) {
  const { w, h } = available(parent);
  setGameHeight(heightFor(w, h));
}

/**
 * Keeps GAME_H matched to the screen after boot. A new height takes effect as
 * the next screen opens; menus showing right now are re-opened in place.
 */
export function watchScreenFit(game: Phaser.Game, parent: HTMLElement | null) {
  let pending = 0;
  let timer = 0;

  const apply = () => {
    if (!pending || pending === GAME_H) {
      pending = 0;
      return;
    }
    setGameHeight(pending);
    pending = 0;
    game.scale.setGameSize(GAME_W, GAME_H);
  };

  // A screen that opens while a new height waits lays out at the new height.
  for (const scene of game.scene.scenes) {
    scene.sys.events.on(Phaser.Scenes.Events.START, apply);
  }

  const check = () => {
    const { w, h } = available(parent);
    const want = heightFor(w, h);
    if (want === GAME_H) {
      pending = 0;
      return;
    }
    pending = want;
    const running = game.scene.getScenes(true);
    if (running.some((s) => KEEP_RUNNING.has(s.scene.key))) return; // wait for the next screen
    apply();
    // re-open the menus on screen so they lay out for the new height
    for (const s of running) s.scene.restart(s.sys.settings.data);
  };

  // The URL bar and rotation fire many resizes in a row; act once they settle.
  const onResize = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(check, 250);
  };
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  game.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, onResize);
  game.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, onResize);
  game.scale.on(Phaser.Scale.Events.ORIENTATION_CHANGE, onResize);
}
