import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { CLASSES, RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { orderBonuses } from '../data/orders';
import { drawOrderChips } from '../ui/orderBonus';
import { drawHoundSlot } from '../ui/hound';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import { CRYPTS, MAX_PARTY, canMuster, cryptRecommended, startRun, suggestParty } from '../systems/crusade';
import { makeButton } from '../ui/button';
import { formatPower, partyPower, powerVerdict, sisterPower } from '../systems/power';
import { VERDICT_COLOR } from '../ui/recommended';
import { portraitKey } from '../ui/placeholderPortrait';
import { addIcon, addScreenGlow, text } from '../ui/theme';
import { addScrollArea } from '../ui/scroll';
import { holdForCard, justHeld } from '../ui/sisterCard';
import { drawPortraitBadges } from '../ui/portraitBadges';
import { openPresets } from '../ui/presets';
import { sortAndFilter, sortControls, emptyListLine } from '../ui/sisterSort';

const ROMAN = ['I', 'II', 'III', 'IV'];

/** Pick up to four crusaders and their ranks. Tap to add, tap a slot to remove. */
export class MusterScene extends Phaser.Scene {
  private party: string[] = [];
  /** Where the Sister list was scrolled, kept across redraws. */
  private listY = 0;

  constructor() {
    super('Muster');
  }

  init() {
    const s = game.save;
    const last = s.lastParty.filter((id) => canMuster(s, id));
    this.party = last.length ? last : suggestParty(s);
    this.listY = 0;
  }

  create() {
    this.children.removeAll(true);
    addScreenGlow(this);
    this.add.text(GAME_W / 2, 36, 'MUSTER', text.display(30, PAL.ivory)).setOrigin(0.5);
    makeButton(this, 60, 36, 96, 48, 'Back', () => this.scene.start('Crusade'), { fontSize: 18 });
    // The hound that marches with them (tap to change).
    drawHoundSlot(this, game.save, GAME_W / 2, 84, GAME_W - 32, 5, () => {
      commit();
      this.create();
    }, true);

    // Party power, top right
    {
      const crypt = CRYPTS.find((c) => c.id === current.cryptId) ?? CRYPTS[0];
      const rec = cryptRecommended(game.save, crypt, current.heresy?.[crypt.id] ?? 0);
      const mine = partyPower(game.save, this.party);
      this.add.text(GAME_W - 16, 8, 'PARTY POWER', text.hud(11, PAL.steel)).setOrigin(1, 0);
      this.add.text(GAME_W - 16, 22, formatPower(mine), text.hud(16, VERDICT_COLOR[powerVerdict(mine, rec)])).setOrigin(1, 0);
      this.add.text(GAME_W - 16, 42, `REC ${formatPower(rec)}`, text.hud(11, PAL.muted)).setOrigin(1, 0);
    }

    // Party slots
    const slotY = 190;
    for (let i = 0; i < MAX_PARTY; i++) {
      const x = 8 + 64 + i * 132;
      this.add.text(x, slotY - 80, `RANK ${ROMAN[i]}`, text.hud(13, 0xdebd9f)).setOrigin(0.5);
      const id = this.party[i];
      if (!id) {
        this.add.rectangle(x, slotY, 128, 128, 0x180f19).setStrokeStyle(1, 0x624658);
        addIcon(this, x, slotY, 'shield', 28, 0xa38494);
        continue;
      }
      const c = CRUSADERS.find((x) => x.id === id)!;
      this.add.rectangle(x, slotY, 134, 134, 0x170f1b).setStrokeStyle(1, RARITY_COLOR[c.rarity]);
      const img = this.add.image(x, slotY, portraitKey(id)).setDisplaySize(128, 128).setInteractive({ useHandCursor: true });
      img.on('pointerup', () => {
        if (justHeld()) return;
        this.party = this.party.filter((p) => p !== id);
        this.create();
      });
      holdForCard(this, img, id);
      drawPortraitBadges(this, x, slotY, 128, c, game.save);
      this.add.text(x, slotY + 82, c.name.split(' ')[0], { ...text.body(18), fontStyle: '600' }).setOrigin(0.5);
      this.add.text(x, slotY + 102, CLASSES[c.classId].role.toUpperCase(), text.hud(12, PAL.muted)).setOrigin(0.5);
    }

    // Pool of owned crusaders
    // Order bonuses this party turns on
    const orders = this.party.map((id) => CRUSADERS.find((c) => c.id === id)!.order);
    if (orderBonuses(orders).length || orders.length) drawOrderChips(this, GAME_W / 2, 314, orders, 5);
    if (!orderBonuses(orders).length) this.add.text(GAME_W / 2, 332, 'Two Sisters of one Order kneel together for its blessing. Tap for details.', text.body(13, PAL.muted)).setOrigin(0.5, 0);
    this.add.rectangle(GAME_W / 2, 344, GAME_W - 32, 1, PAL.armorShadow);
    makeButton(this, GAME_W - 70, 314, 104, 34, 'Presets', () => {
      openPresets(this, game.save, [...this.party], 40, (ids) => {
        this.party = ids.filter((id) => canMuster(game.save, id)).slice(0, MAX_PARTY);
        this.create();
      });
    }, { fontSize: 14 });
    // The Roster's sort and filter; Sisters already called always show.
    const owned = sortAndFilter(game.save, CRUSADERS.filter((c) => game.save.owned[c.id]), this.party);
    sortControls(this, GAME_W / 2, 368, GAME_W - 32, () => {
      this.listY = 0;
      this.create();
    }, { depth: 10, h: 36 });
    if (!owned.length) this.add.text(GAME_W / 2, 470, emptyListLine(game.save), text.body(17, PAL.muted)).setOrigin(0.5);
    // The Sisters scroll (drag or mouse wheel) between the controls and the buttons.
    const list = addScrollArea(this, 390, GAME_H - 108, { start: this.listY, onScroll: (y) => (this.listY = y) });
    const before = this.children.list.length;
    owned.forEach((c, i) => {
      const x = 8 + 64 + (i % 4) * 132;
      const y = 456 + Math.floor(i / 4) * 172;
      const inParty = this.party.includes(c.id);
      const ready = canMuster(game.save, c.id);
      this.add.rectangle(x, y, 134, 134, 0x170f1b).setStrokeStyle(1, ready ? RARITY_COLOR[c.rarity] : PAL.armorShadow);
      const img = this.add.image(x, y, portraitKey(c.id)).setDisplaySize(128, 128);
      if (inParty || !ready) img.setAlpha(0.3);
      drawPortraitBadges(this, x, y, 128, c, game.save, { dim: inParty || !ready });
      if (ready && !inParty) {
        list.tap(img, () => {
          if (this.party.length < MAX_PARTY) {
            this.party.push(c.id);
            this.time.delayedCall(0, () => this.create());
          }
        });
      }
      holdForCard(this, img, c.id);
      const sub = !ready ? 'Recovering' : formatPower(sisterPower(game.save, c));
      this.add.text(x, y + 76, c.name.split(' ')[0], { ...text.body(17), fontStyle: '600' }).setOrigin(0.5);
      this.add.text(x, y + 95, sub, text.body(14, PAL.muted)).setOrigin(0.5);
    });
    list.content.add(this.children.list.slice(before));
    list.fit(456 + Math.ceil(owned.length / 4) * 172 - 50);

    makeButton(this, GAME_W / 2 - 128, GAME_H - 60, 236, 80, 'Suggest', () => {
      this.party = suggestParty(game.save);
      this.create();
    });
    makeButton(
      this,
      GAME_W / 2 + 128,
      GAME_H - 60,
      236,
      80,
      'March into the dark',
      () => {
        const crypt = CRYPTS.find((c) => c.id === current.cryptId) ?? CRYPTS[0];
        current.run = startRun(game.save, this.party, crypt, Math.random, current.heresy?.[crypt.id] ?? 0);
        commit();
        this.scene.start('Crypt');
      },
      { active: true, disabled: !this.party.length },
    );
  }
}
