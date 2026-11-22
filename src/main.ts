import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from './config';
import { installCrt } from './fx/crt';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { CrusadeScene } from './scenes/CrusadeScene';
import { CryptScene } from './scenes/CryptScene';
import { MusterScene } from './scenes/MusterScene';
import { RecruitScene } from './scenes/RecruitScene';
import { ResultsScene } from './scenes/ResultsScene';
import { RevealScene } from './scenes/RevealScene';
import { RosterScene } from './scenes/RosterScene';
import { SanctumScene } from './scenes/SanctumScene';
import { PenanceScene } from './scenes/PenanceScene';
import { MatinsScene } from './scenes/MatinsScene';
import { RankScene } from './scenes/RankScene';
import { TrialsScene } from './scenes/TrialsScene';
import { TowerScene } from './scenes/TowerScene';
import { InquisitionScene } from './scenes/InquisitionScene';
import { ConfessionScene } from './scenes/ConfessionScene';
import { InventoryScene } from './scenes/InventoryScene';
import './fonts.css';

/**
 * Phaser draws text onto canvases, so web fonts must be loaded before any scene
 * writes text. Gives up after 3 seconds and falls back to Georgia/monospace.
 */
async function loadFonts() {
  const faces = ['700 20px "Cinzel Decorative"', '400 20px "Crimson Pro"', 'italic 400 20px "Crimson Pro"', '400 20px "Vigil Pixel"'];
  const timeout = new Promise((r) => setTimeout(r, 3000));
  try {
    await Promise.race([Promise.all(faces.map((f) => document.fonts.load(f))), timeout]);
  } catch {
    // font loading unsupported: fallbacks are fine
  }
}

function start() {
  const game = new Phaser.Game({
    type: Phaser.AUTO, // WebGL, falling back to canvas
    parent: 'game',
    backgroundColor: PAL.bg,
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_W,
      height: GAME_H,
    },
    scene: [
      BootScene,
      SanctumScene,
      PenanceScene,
      MatinsScene,
      RankScene,
      TrialsScene,
      TowerScene,
      InquisitionScene,
      ConfessionScene,
      InventoryScene,
      RecruitScene,
      RevealScene,
      RosterScene,
      CrusadeScene,
      MusterScene,
      CryptScene,
      BattleScene,
      ResultsScene,
    ],
  });

  game.events.once(Phaser.Core.Events.READY, () => installCrt(game));

  // Lets automated play-tests see which screen is showing.
  (window as unknown as { __crt: Phaser.Game }).__crt = game;
}

void loadFonts().then(start);
