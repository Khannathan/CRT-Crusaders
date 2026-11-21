import Phaser from 'phaser';
import { FONT, GAME_W, PAL, hex } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import { PILGRIMAGE_BONUS, PILGRIMAGE_CLEARS, pilgrimageLeft, CRYPTS, HERESY_ENEMY, HERESY_REWARD, REWARDS, ROMAN, canMuster, cryptUnlocked, heresyAvailable, reviveCost, revive } from '../systems/crusade';
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
    const left = pilgrimageLeft(s);
    this.add
      .text(GAME_W - PAD, top - 30, `PILGRIMAGE ${left}/${PILGRIMAGE_CLEARS}`, text.hud(14, left ? PAL.amber : PAL.steel))
      .setOrigin(1, 1);
    this.add
      .text(GAME_W - PAD, top - 8, left ? `NEXT ${left} CLEARS +${PILGRIMAGE_BONUS.seals} SEALS EACH` : 'RENEWS MONDAY', text.hud(11, PAL.muted))
      .setOrigin(1, 1);

    // Resume a run left mid-way (e.g. after switching tabs)
    if (current.run) {
      makeButton(this, GAME_W / 2, top + 90, 360, 80, 'Return to the dark', () => this.scene.start('Crypt'), { active: true, icon: 'blade' });
      addTabBar(this, 'Crusade');
      return;
    }

    // One painted card per crypt. Art key bg-<crypt id> if present, else the hall.
    const hw = GAME_W - PAD * 2;
    const hh = 236;
    const tx = PAD + 18;
    const ready = CRUSADERS.filter((c) => canMuster(s, c.id));
    let bottom = top;
    CRYPTS.forEach((crypt) => {
      const open = cryptUnlocked(s, crypt);
      const cleared = s.cleared.includes(crypt.id);
      const hy = bottom + 14 + hh / 2;
      const cardBottom = hy + hh / 2;
      const art = this.textures.exists(`bg-${crypt.id}`) ? `bg-${crypt.id}` : 'bg-hall';
      const backdrop = addBackdrop(this, art, GAME_W / 2, hy, hw, hh, { fade: 0.85, fadeColor: 0x180d17, focusY: crypt === CRYPTS[0] ? 0.3 : 0.7 });
      if (!open) backdrop.forEach((o) => (o as unknown as Phaser.GameObjects.Components.AlphaSingle).setAlpha?.(0.35));
      addFrame(this, GAME_W / 2, hy, hw, hh);
      this.add
        .text(tx, cardBottom - 212, crypt.name.toUpperCase(), { ...text.display(24, open ? 0xfff1d6 : PAL.muted), wordWrap: { width: hw - 36 } })
        .setShadow(0, 2, '#000000', 9, false, true);
      this.add.text(tx, cardBottom - 176, `${crypt.blurb}\n${crypt.floors} floors, then ${crypt.bossName}.`, {
        ...text.body(17, open ? 0xe1cabf : PAL.muted),
        lineSpacing: 2,
        wordWrap: { width: hw - 36 },
      });
      const prior = CRYPTS.find((c) => c.id === crypt.unlockAfter);
      const maxTier = heresyAvailable(s, crypt);
      const tier = Math.min(maxTier, (current.heresy ??= {})[crypt.id] ?? 0);
      const best = s.heresy?.[crypt.id] ?? 0;
      const note = !open
        ? `Clear ${prior?.name} to open`
        : tier
          ? `Heresy ${ROMAN[tier - 1]}: foes +${Math.round(HERESY_ENEMY * tier * 100)}%, rewards +${Math.round(HERESY_REWARD * tier * 100)}%`
          : cleared
            ? `Cleared${best ? `  ·  best Heresy ${ROMAN[best - 1]}` : ''}`
            : `First clear +${REWARDS.firstClearSeals} Wax Seals`;
      const chip = this.add.text(tx + 8, cardBottom - 96, note, text.hud(13, open ? PAL.amber : PAL.muted));
      this.add.rectangle(tx, cardBottom - 102, chip.width + 16, chip.height + 12, 0x211420).setOrigin(0, 0).setStrokeStyle(1, 0x674347);
      this.children.bringToTop(chip);
      makeButton(
        this,
        tx + 110,
        cardBottom - 38,
        220,
        54,
        !open ? 'Locked' : ready.length ? 'Muster' : 'None can march',
        () => {
          current.cryptId = crypt.id;
          this.scene.start('Muster');
        },
        { active: open && ready.length > 0, disabled: !open || !ready.length, icon: open ? 'shield' : 'lock', fontSize: 20 },
      );
      // Heresy picker: harder tiers open one at a time after a clear.
      if (maxTier > 0) {
        const set = (t: number) => {
          current.heresy![crypt.id] = Math.max(0, Math.min(maxTier, t));
          this.scene.restart();
        };
        const cx = GAME_W - PAD - 112;
        makeButton(this, cx - 76, cardBottom - 38, 44, 54, '‹', () => set(tier - 1), { disabled: tier === 0, fontSize: 24 });
        makeButton(this, cx + 76, cardBottom - 38, 44, 54, '›', () => set(tier + 1), { disabled: tier >= maxTier, fontSize: 24 });
        this.add.text(cx, cardBottom - 48, tier ? `HERESY ${ROMAN[tier - 1]}` : 'NORMAL', text.hud(14, tier ? 0xe58a8a : PAL.ivory)).setOrigin(0.5);
        this.add.text(cx, cardBottom - 26, `up to ${ROMAN[maxTier - 1]}`, text.hud(12, PAL.muted)).setOrigin(0.5);
      }
      bottom = cardBottom;
    });
    if (!Object.keys(s.owned).length) {
      this.add.text(GAME_W / 2, bottom + 30, 'Swear in Sisters at the Sealed Altar first.', { ...style, fontSize: '18px', color: hex(PAL.muted) }).setOrigin(0.5);
    }

    const resting = CRUSADERS.filter((c) => s.owned[c.id]?.recovering);
    if (resting.length) {
      this.add.text(PAD, bottom + 18, 'Infirmary', text.display(20, PAL.ivory));
      this.add.text(GAME_W - PAD, bottom + 26, 'MENDING FOR ONE CRUSADE', text.hud(12, PAL.muted)).setOrigin(1, 0);
      resting.slice(0, 2).forEach((c, i) => {
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
          `Absolve · ${cost}`,
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
