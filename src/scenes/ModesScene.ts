import Phaser from 'phaser';
import { current } from '../state/run';
import { drawBoard } from '../ui/modeBoard';

/** The Crusade tab: every mode you fight in. */
export class ModesScene extends Phaser.Scene {
  constructor() {
    super('Modes');
  }
  create() {
    const mid = current.run ? 'Return to the dark' : current.paused?.challenge && current.paused.challenge === current.challenge ? 'Return to the fight' : '';
    drawBoard(this, 'board', 'Crusade', 'Every war the Church wages. Choose your battlefield.', mid ? { label: mid, go: () => this.scene.start(current.run ? 'Crypt' : 'Crusade') } : undefined);
  }
}

/** The Cloister tab: growth and spending. */
export class CloisterScene extends Phaser.Scene {
  constructor() {
    super('Cloister');
  }
  create() {
    drawBoard(this, 'cloister', 'The Cloister', 'Where the faithful grow stronger, and spend what they earned.');
  }
}

/** The Altar tab: what you can pull for (Sisters, gear, hounds), each with its own currency. */
export class AltarScene extends Phaser.Scene {
  constructor() {
    super('Altar');
  }
  create() {
    drawBoard(this, 'altar', 'The Sealed Altar', 'Call Sisters, saints\' arms and hounds to the faith.');
  }
}
