import Phaser from 'phaser';
import { game } from '../state/game';
import { current } from '../state/run';
import { BALANCE_VERSION } from '../systems/combat';
import { currentNode, makeBattle } from '../systems/crusade';
import { newSeed, seeded } from '../systems/rng';
import { takeBackground } from '../ui/bgFight';

/**
 * Where every fight starts ('Battle'). All combat is real time on the open
 * field (FieldScene); this scene only decides which fight that is:
 * - one left running on Auto in the background comes back on screen,
 * - one left paused picks up where it stopped (if it is this same fight),
 * - otherwise a new fight for the current challenge or crypt node.
 */
export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  create() {
    const away = takeBackground();
    if (away) {
      this.scene.start('Field', { field: away.field, vigilMax: away.vigilMax });
      return;
    }
    const run = current.run;
    const challenge = current.challenge;
    const node = run && currentNode(run);
    if (!challenge && (!run || !node?.encounter)) {
      this.scene.start('Crypt');
      return;
    }
    const p = current.paused;
    const resume = p && (challenge ? p.challenge === challenge : !p.challenge && p.run === run && p.floor === run!.floor && p.at === run!.at) ? p : undefined;
    if (resume) {
      current.paused = undefined;
      this.scene.start('Field', { field: resume.field, vigilMax: resume.vigilMax });
      return;
    }
    const encounter = challenge ? challenge.label : node?.encounter ?? '';
    // Seeded so a reported fight can be replayed exactly (see window.__crtLastBattle).
    const seed = newSeed();
    const battle = challenge ? challenge.make(seeded(seed)) : makeBattle(game.save, run!, encounter, seeded(seed));
    (window as unknown as Record<string, unknown>).__crtLastBattle = { balance: BALANCE_VERSION, encounter, seed, log: battle.log };
    this.scene.start('Field', { battle });
  }
}
