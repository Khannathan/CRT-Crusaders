import Phaser from 'phaser';
import { bgFight } from './ui/bgFight';
import { ErrandsScene } from './scenes/ErrandsScene';
import { KennelScene } from './scenes/KennelScene';
import { HuntScene } from './scenes/HuntScene';
import { GAME_H, GAME_W, PAL } from './config';
import { installCrt } from './fx/crt';
import { installReadableText } from './ui/readable';
import { fitBeforeBoot, watchScreenFit } from './ui/screenFit';
import { wireSceneMusic } from './audio/battleMusic';
import { music } from './audio/music';
import { unlockSfx } from './audio/sfx';
import { BattleScene } from './scenes/BattleScene';
import { FieldScene } from './scenes/FieldScene';
import { BootScene } from './scenes/BootScene';
import { CrusadeScene } from './scenes/CrusadeScene';
import { CryptScene } from './scenes/CryptScene';
import { MusterScene } from './scenes/MusterScene';
import { RecruitScene } from './scenes/RecruitScene';
import { ResultsScene } from './scenes/ResultsScene';
import { RevealScene } from './scenes/RevealScene';
import { PullHistoryScene } from './scenes/PullHistoryScene';
import { OrderBookScene } from './scenes/OrderBookScene';
import { RivalsScene } from './scenes/RivalsScene';
import { RosterScene } from './scenes/RosterScene';
import { SanctumScene } from './scenes/SanctumScene';
import { PenanceScene } from './scenes/PenanceScene';
import { NovitiateScene } from './scenes/NovitiateScene';
import { DeedsScene } from './scenes/DeedsScene';
import { OrdealsScene } from './scenes/OrdealsScene';
import { PassScene } from './scenes/PassScene';
import { StoryScene } from './scenes/StoryScene';
import { ChronicleScene } from './scenes/ChronicleScene';
import { MatinsScene } from './scenes/MatinsScene';
import { RankScene } from './scenes/RankScene';
import { TrialsScene } from './scenes/TrialsScene';
import { HoldScene } from './scenes/HoldScene';
import { RaidScene } from './scenes/RaidScene';
import { WarScene } from './scenes/WarScene';
import { CampScene } from './scenes/CampScene';
import { FeastScene } from './scenes/FeastScene';
import { ArmoryScene } from './scenes/ArmoryScene';
import { ChapterScene } from './scenes/ChapterScene';
import { TowerScene } from './scenes/TowerScene';
import { ProcessionScene } from './scenes/ProcessionScene';
import { InquisitionScene } from './scenes/InquisitionScene';
import { ConfessionScene } from './scenes/ConfessionScene';
import { InventoryScene } from './scenes/InventoryScene';
import { ShopScene } from './scenes/ShopScene';
import { ReliquaryScene } from './scenes/ReliquaryScene';
import './fonts.css';
import { AltarScene, CloisterScene, ModesScene } from './scenes/ModesScene';
import { CampaignScene } from './scenes/CampaignScene';

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
  installReadableText();
  const parent = document.getElementById('game');
  // tall phones get a taller game instead of black bars (see ui/screenFit.ts)
  fitBeforeBoot(parent);
  // Browsers keep audio asleep until a tap; wake the sound effects on each one (cheap once awake).
  window.addEventListener('pointerdown', unlockSfx, { passive: true });
  const game = new Phaser.Game({
    type: Phaser.AUTO, // WebGL, falling back to canvas
    parent: 'game',
    backgroundColor: PAL.bg,
    pixelArt: true,
    // a long press opens a Sister's card; keep the browser's menu out of the way
    disableContextMenu: true,
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
      NovitiateScene,
      DeedsScene,
      PassScene,
      OrdealsScene,
      StoryScene,
      ChronicleScene,
      MatinsScene,
      RankScene,
      TrialsScene,
      HoldScene,
      RaidScene,
      WarScene,
      CampScene,
      FeastScene,
      ArmoryScene,
      ChapterScene,
      TowerScene,
      ProcessionScene,
      InquisitionScene,
      ConfessionScene,
      InventoryScene,
      ShopScene,
      ReliquaryScene,
      RecruitScene,
      RevealScene,
      PullHistoryScene,
      OrderBookScene,
      RivalsScene,
      RosterScene,
      ModesScene,
      CampaignScene,
      ErrandsScene,
      KennelScene,
      HuntScene,
      CloisterScene,
      AltarScene,
      CrusadeScene,
      MusterScene,
      CryptScene,
      BattleScene,
      FieldScene,
      ResultsScene,
    ],
  });

  bgFight.game = game;
  game.events.once(Phaser.Core.Events.READY, () => {
    installCrt(game);
    watchScreenFit(game, parent);
    // Each screen asks for its loop as it opens.
    for (const scene of game.scene.scenes)
      scene.events.on(Phaser.Scenes.Events.CREATE, () => {
        music.sceneOpened();
        music.forScene(scene.scene.key);
      });
  });
  wireSceneMusic();
  music.init();
  (window as unknown as { __music: typeof music }).__music = music;

  // Lets automated play-tests see which screen is showing.
  (window as unknown as { __crt: Phaser.Game }).__crt = game;
}

void loadFonts().then(start);
