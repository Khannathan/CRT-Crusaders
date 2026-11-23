import Phaser from 'phaser';
import { GAME_W, PAL } from '../config';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import {
  SWIFT_ROUNDS,
  TIERS,
  TRIAL_ENTRIES,
  bestStars,
  entriesLeft,
  finishTrial,
  openTrials,
  spoilsPreview,
  spoilsText,
  sweep,
  tierOpen,
  trialBattle,
  type TrialDef,
  type TrialKind,
} from '../systems/trials';
import { makeButton } from '../ui/button';
import { modeScreen, toast } from '../ui/modeScreen';
import { pickParty } from '../ui/partyPicker';
import { PAD, text } from '../ui/theme';

const TIER_NAME = ['I', 'II', 'III', 'IV', 'V'];

/** Draws 0-3 stars from x. */
export function drawStars(scene: Phaser.Scene, x: number, y: number, stars: number, size = 9) {
  for (let i = 0; i < 3; i++) scene.add.star(x + i * (size * 2 + 4), y, 5, size * 0.45, size, i < stars ? PAL.amber : 0x3a2e35);
}

const TRIAL_LABEL: Record<TrialKind, string> = { blade: 'Blade', habit: 'Habit', veil: 'Veil', sabatons: 'Sabatons', rosary: 'Rosary', tithes: 'Tithes', seals: 'Seals', ash: 'Ash', page: 'Psalter' };

/** Relic Trials: today's spoil, five tiers, Fight or Sweep. */
export class TrialsScene extends Phaser.Scene {
  private kind?: TrialKind;
  private notice?: string;

  constructor() {
    super('Trials');
  }

  init(data: { kind?: TrialKind; notice?: string }) {
    this.kind = data?.kind;
    this.notice = data?.notice;
  }

  create() {
    const save = game.save;
    const { top, refresh } = modeScreen(this, 'Relic Trials', 'A loss costs nothing.');
    const open = openTrials();
    const trial = open.find((t) => t.kind === this.kind) ?? open[0];
    const left = entriesLeft(save);
    const bw = GAME_W - PAD * 2;

    this.add.text(PAD, top, `VICTORIES LEFT TODAY ${left}/${TRIAL_ENTRIES}`, text.hud(14, left ? PAL.amber : PAL.steel));
    this.add.text(GAME_W - PAD, top, `3 STARS: NO ONE FALLS, BY ROUND ${SWIFT_ROUNDS}`, text.hud(11, PAL.muted)).setOrigin(1, 0);

    // Which trial (weekends open all seven)
    let y = top + 30;
    if (open.length > 1) {
      const w = (bw - (open.length - 1) * 6) / open.length;
      open.forEach((t, i) => {
        makeButton(this, PAD + w / 2 + i * (w + 6), y + 22, w, 44, TRIAL_LABEL[t.kind], () => this.scene.restart({ kind: t.kind }), {
          active: t === trial,
          fontSize: 14,
        });
      });
      y += 56;
    }
    this.add.text(PAD, y + 6, trial.name, text.display(20, 0xfff1d6));
    this.add.text(PAD, y + 36, trial.flavor, { ...text.body(16, PAL.muted), fontStyle: 'italic', wordWrap: { width: bw } });
    y += 76;

    TIERS.forEach((_, tier) => {
      const h = 92;
      const unlocked = tierOpen(save, trial.kind, tier);
      const stars = bestStars(save, trial.kind, tier);
      this.add.rectangle(GAME_W / 2, y + h / 2, bw, h, unlocked ? 0x1e1520 : 0x151017).setStrokeStyle(1, stars === 3 ? PAL.bronze : PAL.armorShadow);
      this.add.text(PAD + 14, y + 12, `TIER ${TIER_NAME[tier]}`, text.hud(14, unlocked ? PAL.amber : PAL.steel));
      drawStars(this, PAD + 112, y + 20, stars, 8);
      this.add.text(PAD + 14, y + 40, unlocked ? spoilsPreview(trial.kind, tier) : 'Locked', { ...text.body(15, unlocked ? PAL.ivory : PAL.steel), wordWrap: { width: bw - 230 } });
      if (unlocked) {
        const canSweep = stars >= 3 && left > 0;
        makeButton(this, GAME_W - PAD - 160, y + h / 2, 96, 50, 'Fight', () => this.fight(trial, tier), { active: left > 0, disabled: left <= 0, fontSize: 17 });
        makeButton(this, GAME_W - PAD - 56, y + h / 2, 96, 50, 'Sweep', () => {
          const got = sweep(save, trial.kind, tier);
          if (!got) return;
          commit();
          refresh();
          this.scene.restart({ kind: trial.kind, notice: `Swept: ${spoilsText(got)}` });
        }, { disabled: !canSweep, fontSize: 17 });
      }
      y += h + 8;
    });

    if (this.notice) toast(this, this.notice);
  }

  private fight(trial: TrialDef, tier: number) {
    const save = game.save;
    pickParty(
      this,
      save,
      { title: trial.name, sub: `Tier ${TIER_NAME[tier]}. Tap in rank order. The first stands in front.`, initial: save.lastParty, confirm: 'Enter the trial!' },
      (party) => {
        current.challenge = {
          label: `${trial.name}, Tier ${TIER_NAME[tier]}. The dead rise to guard their spoils!`,
          make: (rng) => trialBattle(save, party, tier, rng),
          finish: (_outcome, battle) => {
            const r = finishTrial(save, trial.kind, tier, battle);
            const notice = r.spoils ? `${'★'.repeat(r.stars)} Victory: ${spoilsText(r.spoils)}` : 'The trial repels you. Nothing was spent.';
            return { scene: 'Trials', data: { kind: trial.kind, notice } };
          },
        };
        this.scene.start('Battle');
      },
    );
  }
}
