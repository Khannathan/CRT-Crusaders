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
