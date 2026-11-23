import { sfx } from '../audio/sfx';
import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { commit, game } from '../state/game';
import { morningRounds, roundsTotal, type RoundsReport } from '../systems/rounds';
import { makeButton } from './button';
import { addFrame, text } from './theme';

/**
 * Morning Rounds (the lobby's Collect and the Labors wing's Sweep all): every
 * daily chore that needs no choice, done in one tap, then a sheet of what it
 * did and what still needs you. Done restarts the screen so counts refresh.
 */
export function runRounds(scene: Phaser.Scene) {
  const r = morningRounds(game.save);
  sfx('bell');
  commit();
  showRounds(scene, r);
}

/** What Morning Rounds did, what it gathered, and what still needs you. */
export function showRounds(scene: Phaser.Scene, r: RoundsReport) {
  const layer = scene.add.container(0, 0).setDepth(30);
  layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.9).setInteractive());
  const total = roundsTotal(r);
  const lines = [
    r.done.length ? r.done.map((d) => `✓ ${d}`).join('\n') : 'Every rite is already kept. Well done, faithful.',
    total ? `\nGathered: ${total}` : '',
    r.left.length ? `\nRites still unkept:\n${r.left.map((d) => `· ${d}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');
  const t = scene.add.text(GAME_W / 2, 200, lines, { ...text.body(17, PAL.ivory), align: 'left', lineSpacing: 4, wordWrap: { width: GAME_W - 100 } }).setOrigin(0.5, 0);
  const h = t.height + 120;
  layer.add(addFrame(scene, GAME_W / 2, 140 + h / 2, GAME_W - 40, h, { fill: 0x241925 }));
  layer.add(scene.add.text(GAME_W / 2, 166, 'MORNING ROUNDS', text.display(24, PAL.amber)).setOrigin(0.5));
  layer.add(t);
  const done = makeButton(scene, GAME_W / 2, 140 + h + 44, 220, 56, 'Done', () => scene.scene.restart());
  layer.add(done.all);
}
