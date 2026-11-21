import Phaser from 'phaser';
import { FONT, GAME_W, PAL, hex } from '../config';
import { CRUSADERS } from '../data/crusaders';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import { OSSUARY, REWARDS, canMuster, reviveCost, revive } from '../systems/crusade';
import { makeButton } from '../ui/button';
import { CURRENCY_BAR_H, addCurrencyBar } from '../ui/currencyBar';
import { portraitKey } from '../ui/placeholderPortrait';
import { addTabBar } from '../ui/tabBar';

/** Crusade tab: the crypt on offer, and crusaders recovering from a fall. */
export class CrusadeScene extends Phaser.Scene {
  constructor() {
    super('Crusade');
  }

  create() {
    this.cameras.main.setBackgroundColor(PAL.bg);
    addCurrencyBar(this);
    const s = game.save;
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    this.add.text(GAME_W / 2, CURRENCY_BAR_H + 40, 'Crusade', { ...style, fontSize: '32px', color: hex(PAL.amber) }).setOrigin(0.5);

    // Resume a run left mid-way (e.g. after switching tabs)
    if (current.run) {
      makeButton(this, GAME_W / 2, 200, 360, 80, 'Return to the crypt', () => this.scene.start('Crypt'), { active: true });
      addTabBar(this, 'Crusade');
      return;
    }

    const cleared = s.cleared.includes(OSSUARY.id);
    this.add.rectangle(GAME_W / 2, 250, GAME_W - 48, 230, PAL.deepShadow).setStrokeStyle(2, PAL.armorShadow);
    this.add.text(GAME_W / 2, 170, OSSUARY.name, { ...style, fontSize: '26px' }).setOrigin(0.5);
    this.add
      .text(
        GAME_W / 2,
        245,
        'A flooded charnel house beneath a ruined abbey.\nThree rooms, then the Choir Below.',
        { ...style, fontSize: '17px', color: hex(PAL.steel), lineSpacing: 6 },
      )
      .setOrigin(0.5);
    const reward = cleared
      ? `Clear: about ${REWARDS.fightTithes * 2 + REWARDS.bossTithes} Tithes, ${REWARDS.completeSeals + REWARDS.bossSeals} Seals`
      : `First clear: +${REWARDS.firstClearSeals} bonus Seals`;
    this.add.text(GAME_W / 2, 320, cleared ? `Cleared ✓  ·  ${reward}` : reward, { ...style, fontSize: '16px', color: hex(PAL.amber) }).setOrigin(0.5);

    const ready = CRUSADERS.filter((c) => canMuster(s, c.id));
    makeButton(this, GAME_W / 2, 430, 320, 84, ready.length ? 'Muster your party' : 'No one is ready', () => this.scene.start('Muster'), {
      active: ready.length > 0,
      disabled: !ready.length,
    });
    if (!Object.keys(s.owned).length) {
      this.add.text(GAME_W / 2, 500, 'Recruit crusaders at the Sealed Altar first.', { ...style, fontSize: '17px', color: hex(PAL.steel) }).setOrigin(0.5);
    }

    const resting = CRUSADERS.filter((c) => s.owned[c.id]?.recovering);
    if (resting.length) {
      this.add.text(GAME_W / 2, 530, 'Recovering: they sit out one crusade', { ...style, fontSize: '18px', color: hex(PAL.steel) }).setOrigin(0.5);
      resting.slice(0, 4).forEach((c, i) => {
        const y = 600 + i * 64;
        this.add.image(70, y, portraitKey(c.id)).setDisplaySize(56, 56);
        this.add.text(110, y, c.name, { ...style, fontSize: '18px' }).setOrigin(0, 0.5);
        const cost = reviveCost(s.owned[c.id].level);
        makeButton(
          this,
          GAME_W - 100,
          y,
          160,
          52,
          `Revive · ${cost}`,
          () => {
            if (revive(s, c.id)) {
              commit();
              this.scene.restart();
            }
          },
          { fontSize: 17, disabled: s.tithes < cost },
        );
      });
    }

    addTabBar(this, 'Crusade');
  }
}
