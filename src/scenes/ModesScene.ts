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
    drawBoard(this, 'board', 'Crusade', 'Every war the Church wages. Choose your battlefield.', mid ? { label: mid, go: () => this.scene.start('Crusade') } : undefined);
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
