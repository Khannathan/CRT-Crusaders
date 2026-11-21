import Phaser from 'phaser';
import { FONT, GAME_W, PAL, hex } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import { OSSUARY, REWARDS, canMuster, reviveCost, revive } from '../systems/crusade';
import { makeButton } from '../ui/button';
import { CURRENCY_BAR_H, addCurrencyBar } from '../ui/currencyBar';
import { portraitKey } from '../ui/placeholderPortrait';
import { addTabBar } from '../ui/tabBar';
import { PAD, addBackdrop, addFrame, addHeading, addScreenGlow, text } from '../ui/theme';

/** Crusade tab: the crypt on offer, and crusaders recovering from a fall. */
export class CrusadeScene extends Phaser.Scene {
  constructor() {
    super('Crusade');
  }

  create() {
    addScreenGlow(this);
    addCurrencyBar(this);
    const s = game.save;
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    const top = addHeading(this, 'Crusade', CURRENCY_BAR_H + 16);

    // Resume a run left mid-way (e.g. after switching tabs)
    if (current.run) {
      makeButton(this, GAME_W / 2, top + 90, 360, 80, 'Return to the crypt', () => this.scene.start('Crypt'), { active: true, icon: 'blade' });
      addTabBar(this, 'Crusade');
      return;
    }

    // The crypt on offer, as a painted card
    const cleared = s.cleared.includes(OSSUARY.id);
    const hw = GAME_W - PAD * 2;
    const hh = 420;
    const hy = top + 14 + hh / 2;
    const bottom = hy + hh / 2;
    addBackdrop(this, 'bg-hall', GAME_W / 2, hy, hw, hh, { fade: 0.72, fadeColor: 0x180d17, focusY: 0.3 });
    addFrame(this, GAME_W / 2, hy, hw, hh);
    const tx = PAD + 18;
    this.add
      .text(tx, bottom - 220, OSSUARY.name.toUpperCase(), { ...text.display(28, 0xfff1d6), wordWrap: { width: hw - 36 } })
      .setShadow(0, 2, '#000000', 9, false, true);
    this.add.text(tx, bottom - 178, 'A flooded charnel house beneath a ruined\nabbey. Three rooms, then the Choir Below.', {
      ...text.body(19, 0xe1cabf),
      lineSpacing: 2,
    });
    const reward = cleared
      ? `Cleared  ${REWARDS.fightTithes * 2 + REWARDS.bossTithes} Tithes, ${REWARDS.completeSeals + REWARDS.bossSeals} Seals`
      : `First clear +${REWARDS.firstClearSeals} Wax Seals`;
    const chip = this.add.text(tx + 8, bottom - 112, reward, text.hud(13, PAL.amber));
    this.add.rectangle(tx, bottom - 118, chip.width + 16, chip.height + 12, 0x211420).setOrigin(0, 0).setStrokeStyle(1, 0x674347);
    this.children.bringToTop(chip);

    const ready = CRUSADERS.filter((c) => canMuster(s, c.id));
    makeButton(this, tx + 120, bottom - 50, 240, 62, ready.length ? 'Muster your party' : 'No one is ready', () => this.scene.start('Muster'), {
      active: ready.length > 0,
      disabled: !ready.length,
      icon: 'shield',
      fontSize: 21,
    });
    if (!Object.keys(s.owned).length) {
      this.add.text(GAME_W / 2, bottom + 30, 'Recruit crusaders at the Sealed Altar first.', { ...style, fontSize: '18px', color: hex(PAL.muted) }).setOrigin(0.5);
    }

    const resting = CRUSADERS.filter((c) => s.owned[c.id]?.recovering);
    if (resting.length) {
      this.add.text(PAD, bottom + 18, 'Recovering', text.display(20, PAL.ivory));
      this.add.text(GAME_W - PAD, bottom + 26, 'SITS OUT ONE CRUSADE', text.hud(12, PAL.muted)).setOrigin(1, 0);
      resting.slice(0, 4).forEach((c, i) => {
        const y = bottom + 84 + i * 64;
        this.add.image(PAD + 28, y, portraitKey(c.id)).setDisplaySize(56, 56);
        this.add.rectangle(PAD + 28, y, 56, 56).setStrokeStyle(1, RARITY_COLOR[c.rarity]);
        this.add.text(PAD + 68, y, c.name, { ...style, fontSize: '18px' }).setOrigin(0, 0.5);
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
