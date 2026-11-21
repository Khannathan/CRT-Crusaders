import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from './config';
import { BootScene } from './scenes/BootScene';
import { RecruitScene } from './scenes/RecruitScene';
import { RevealScene } from './scenes/RevealScene';
import { ComingSoonScene } from './scenes/ComingSoonScene';
import { RosterScene } from './scenes/RosterScene';
import { SanctumScene } from './scenes/SanctumScene';

new Phaser.Game({
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
    RosterScene,
    RecruitScene,
    RevealScene,
    new ComingSoonScene('Crusade', 'The crypts open in step 3: party muster, turn-based fights and rewards.'),
  ],
});
