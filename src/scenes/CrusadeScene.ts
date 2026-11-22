import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import { PILGRIMAGE_BONUS, PILGRIMAGE_CLEARS, pilgrimageLeft, CRYPTS, HERESY_ENEMY, HERESY_REWARD, REWARDS, ROMAN, canMuster, cryptRecommended, cryptUnlocked, cryptFloors, actsOf, heresyAvailable, reviveCost, revive, suggestParty, type CryptDef } from '../systems/crusade';
import { canRepeat, repeatRuns } from '../systems/autorun';
import { ROMAN_RANK, unlocked } from '../systems/rank';
import { pickParty } from '../ui/partyPicker';
import { accountPower } from '../systems/power';
import { addBags, bagEmpty, bagText } from '../systems/items';
import { drawRecommended } from '../ui/recommended';
import { makeButton } from '../ui/button';
import { CURRENCY_BAR_H, addCurrencyBar } from '../ui/currencyBar';
import { portraitKey } from '../ui/placeholderPortrait';
import { addScrollArea } from '../ui/scroll';
import { TAB_BAR_H, addTabBar } from '../ui/tabBar';
import { PAD, addBackdrop, addFrame, addHeading, addScreenGlow, text } from '../ui/theme';
import { holdForCard } from '../ui/sisterCard';

/** Rank of Faith needed to repeat a cleared crypt on Auto. */
const REPEAT_RANK = 4;

/** Crusade tab: the crypt on offer, and crusaders recovering from a fall. */
export class CrusadeScene extends Phaser.Scene {
  /** Where the crypt list was scrolled to, kept across visits. */
  private static listY = 0;

  constructor() {
    super('Crusade');
  }

  create() {
    addScreenGlow(this);
    addCurrencyBar(this);
    const s = game.save;
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    const top = addHeading(this, 'The Crypts', CURRENCY_BAR_H + 16);
    makeButton(this, GAME_W - PAD - 44, CURRENCY_BAR_H + 34, 88, 40, 'Back', () => this.scene.start('Modes'), { fontSize: 16 });
    const left = pilgrimageLeft(s);
    const pil = this.add
      .text(GAME_W - PAD, top + 18, `PILGRIMAGE ${left}/${PILGRIMAGE_CLEARS}`, text.hud(13, left ? PAL.amber : PAL.steel))
      .setOrigin(1, 1);
    // ui-badge-blessed.png before the Pilgrimage count, faded once the week's blessed clears are spent
    if (this.textures.exists('ui-badge-blessed')) {
      this.add.image(pil.x - pil.width - 12, pil.y - pil.height / 2, 'ui-badge-blessed').setDisplaySize(20, 20).setAlpha(left ? 1 : 0.35);
    }
    this.add
      .text(GAME_W - PAD, top + 34, left ? `NEXT ${left} CLEARS +${PILGRIMAGE_BONUS.seals} SEALS EACH` : 'RENEWS MONDAY', text.hud(10, PAL.muted))
      .setOrigin(1, 1);

    // A Rite fight left from its Menu
    if (current.paused?.challenge && current.paused.challenge === current.challenge) {
      this.add.text(GAME_W / 2, top + 40, current.challenge.label, { ...text.body(18, PAL.muted), align: 'center', wordWrap: { width: GAME_W - 60 } }).setOrigin(0.5);
      makeButton(this, GAME_W / 2, top + 120, 360, 80, 'Return to the fight', () => this.scene.start('Battle'), { active: true, icon: 'blade' });
      makeButton(this, GAME_W / 2, top + 220, 360, 56, 'Abandon it (costs nothing)', () => {
        current.paused = undefined;
        current.challenge = undefined;
        this.scene.restart({});
      }, { fontSize: 17 });
      addTabBar(this, 'Crusade');
      return;
    }

    // Resume a run left mid-way (e.g. after switching tabs)
    if (current.run) {
      makeButton(this, GAME_W / 2, top + 90, 360, 80, 'Return to the dark', () => this.scene.start('Crypt'), { active: true, icon: 'blade' });
      addTabBar(this, 'Crusade');
      return;
    }

    // One painted card per crypt (the open ones and the next to open), in a scrolling list.
    // Art key bg-<crypt id> if present, else the hall.
    const listTop = top + 40;
    const listBottom = GAME_H - TAB_BAR_H;
    const list = addScrollArea(this, listTop, listBottom, { start: CrusadeScene.listY, onScroll: (y) => (CrusadeScene.listY = y) });
    const before = this.children.list.length;
    /** A button action that ignores the release of a scroll drag, or a tap outside the list. */
    const tap = (fn: () => void) => () => {
      const y = this.input.activePointer.y;
      if (!list.dragging && y >= listTop && y <= listBottom) fn();
    };
    const hw = GAME_W - PAD * 2;
    const hh = 236;
    const tx = PAD + 18;
    const ready = CRUSADERS.filter((c) => canMuster(s, c.id));
    this.add.text(PAD, listTop + 4, 'Every fight pays Tithes, Pilgrimage or not.', text.body(16, PAL.muted));
    let bottom = listTop + 22;
    const shown = CRYPTS.filter((c, i) => cryptUnlocked(s, c) || i === 0 || cryptUnlocked(s, CRYPTS[i - 1]));
    shown.forEach((crypt) => {
      const open = cryptUnlocked(s, crypt);
      const cleared = s.cleared.includes(crypt.id);
      const hy = bottom + 14 + hh / 2;
      const cardBottom = hy + hh / 2;
      const art = this.textures.exists(`bg-${crypt.id}`) ? `bg-${crypt.id}` : 'bg-hall';
      const backdrop = addBackdrop(this, art, GAME_W / 2, hy, hw, hh, { fade: 0.85, fadeColor: 0x180d17, focusY: crypt === CRYPTS[0] ? 0.3 : 0.7 });
      if (!open) backdrop.forEach((o) => (o as unknown as Phaser.GameObjects.Components.AlphaSingle).setAlpha?.(0.35));
      addFrame(this, GAME_W / 2, hy, hw, hh);
      // the blessed-clear badge on each open crypt while blessed clears are left this week
      if (open && left && this.textures.exists('ui-badge-blessed')) this.add.image(PAD + hw - 26, hy - hh / 2 + 26, 'ui-badge-blessed').setDisplaySize(32, 32);
      this.add
        .text(tx, cardBottom - 212, crypt.name.toUpperCase(), { ...text.display(24, open ? 0xfff1d6 : PAL.muted), wordWrap: { width: hw - 36 } })
        .setShadow(0, 2, '#000000', 9, false, true);
      const prior = CRYPTS.find((c) => c.id === crypt.unlockAfter);
      const maxTier = heresyAvailable(s, crypt);
      const tier = Math.min(maxTier, (current.heresy ??= {})[crypt.id] ?? 0);
      const floors = cryptFloors(crypt, tier);
      const acts = actsOf(floors).length;
      this.add.text(tx, cardBottom - 176, `${crypt.blurb}\n${floors} floors${acts > 1 ? ` in ${acts} acts` : ''}, then ${crypt.bossName}.`, {
        ...text.body(17, open ? 0xe1cabf : PAL.muted),
        lineSpacing: 2,
        wordWrap: { width: hw - 36 },
      });
      const best = s.heresy?.[crypt.id] ?? 0;
      const note = !open
        ? `Clear ${prior?.name} to open`
        : tier
          ? `Heresy ${ROMAN[tier - 1]}: foes +${Math.round(HERESY_ENEMY * tier * 100)}%, rewards +${Math.round(HERESY_REWARD * tier * 100)}%`
          : cleared
            ? `Cleared${best ? `  ·  best Heresy ${ROMAN[best - 1]}` : ''}`
            : `First clear +${REWARDS.firstClearSeals} Wax Seals`;
      if (open) drawRecommended(this, tx, cardBottom - 128, cryptRecommended(s, crypt, tier), accountPower(s, (c) => canMuster(s, c.id)));
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
        tap(() => {
          current.cryptId = crypt.id;
          this.scene.start('Muster');
        }),
        { active: open && ready.length > 0, disabled: !open || !ready.length, icon: open ? 'shield' : 'lock', fontSize: 20 },
      );
      // Heresy picker: harder tiers open one at a time after a clear.
      if (maxTier > 0) {
        const set = (t: number) => {
          current.heresy![crypt.id] = Math.max(0, Math.min(maxTier, t));
          this.scene.restart();
        };
        const cx = GAME_W - PAD - 112;
        makeButton(this, cx - 76, cardBottom - 38, 44, 54, '‹', tap(() => set(tier - 1)), { disabled: tier === 0, fontSize: 24 });
        makeButton(this, cx + 76, cardBottom - 38, 44, 54, '›', tap(() => set(tier + 1)), { disabled: tier >= maxTier, fontSize: 24 });
        this.add.text(cx, cardBottom - 48, tier ? `HERESY ${ROMAN[tier - 1]}` : 'NORMAL', text.hud(14, tier ? 0xe58a8a : PAL.ivory)).setOrigin(0.5);
        this.add.text(cx, cardBottom - 26, `up to ${ROMAN[maxTier - 1]}`, text.hud(12, PAL.muted)).setOrigin(0.5);
      }
      // Sweep: a cleared crypt (at this tier) can be replayed on Auto from Rank IV.
      if (open && canRepeat(s, crypt, tier)) {
        const ok = unlocked(s, REPEAT_RANK);
        makeButton(this, GAME_W - PAD - 70, cardBottom - 196, 116, 42, ok ? 'Sweep' : `Rank ${ROMAN_RANK(REPEAT_RANK)}`, tap(() => this.repeat(crypt, tier)), {
          fontSize: 16,
          icon: ok ? 'swap' : 'lock',
          disabled: !ok || !ready.length,
        });
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
      resting.forEach((c, i) => {
        const y = bottom + 84 + i * 64;
        holdForCard(this, this.add.image(PAD + 28, y, portraitKey(c.id)).setDisplaySize(56, 56), c.id);
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
          tap(() => {
            if (revive(s, c.id)) {
              commit();
              this.scene.restart();
            }
          }),
          { fontSize: 17, disabled: s.tithes < cost },
        );
      });
    }

    const listBottomY = resting.length ? bottom + 84 + resting.length * 64 : bottom + 60;
    list.content.add(this.children.list.slice(before));
    list.fit(listBottomY);

    addTabBar(this, 'Crusade');
  }

  /** Repeat a cleared crypt on Auto: pick how many runs, then show what came back. */
  private repeat(crypt: CryptDef, heresy: number) {
    const s = game.save;
    const layer = this.add.container(0, 0).setDepth(30);
    let party = (s.lastParty.length ? s.lastParty : suggestParty(s)).filter((id) => canMuster(s, id));
    const draw = () => {
      layer.removeAll(true);
      layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.94).setInteractive());
      layer.add(addFrame(this, GAME_W / 2, GAME_H / 2, GAME_W - 24, 640, { fill: 0x241925 }));
      const y0 = GAME_H / 2 - 300;
      layer.add(this.add.text(GAME_W / 2, y0 + 30, 'SWEEP THE CRYPT', text.display(22, PAL.ivory)).setOrigin(0.5));
      layer.add(
        this.add
          .text(GAME_W / 2, y0 + 64, `${crypt.name}${heresy ? `, Heresy ${ROMAN[heresy - 1]}` : ''}. Your Sisters march on Auto: real fights, real spoils, real wounds. They stop at the first defeat.`, {
            ...text.body(16, PAL.muted),
            align: 'center',
            wordWrap: { width: GAME_W - 80 },
          })
          .setOrigin(0.5, 0),
      );
      party.forEach((id, i) => {
        const x = GAME_W / 2 + (i - (party.length - 1) / 2) * 104;
        layer.add(holdForCard(this, this.add.image(x, y0 + 190, portraitKey(id)).setDisplaySize(92, 92), id));
        layer.add(this.add.rectangle(x, y0 + 190, 96, 96).setStrokeStyle(2, RARITY_COLOR[CRUSADERS.find((c) => c.id === id)!.rarity]));
      });
      layer.add(
        makeButton(this, GAME_W / 2, y0 + 270, 200, 44, 'Change Sisters', () =>
          pickParty(this, s, { title: 'Who marches?', sub: 'Tap in rank order; the first stands in front.', initial: party, allow: (c) => canMuster(s, c.id), why: 'Wounded Sisters cannot march.', confirm: 'These four', rec: cryptRecommended(s, crypt, heresy) }, (ids) => {
            party = ids;
            draw();
          }),
        { fontSize: 16 }).all,
      );
      [1, 3, 5].forEach((n, i) => {
        const b = makeButton(this, GAME_W / 2 + (i - 1) * 150, y0 + 370, 136, 64, `${n} run${n > 1 ? 's' : ''}`, () => this.runRepeat(layer, crypt, heresy, party, n), {
          active: true,
          disabled: !party.length,
          fontSize: 19,
        });
        layer.add(b.all);
      });
      layer.add(makeButton(this, GAME_W / 2, y0 + 560, 220, 56, 'Back', () => layer.destroy(), { fontSize: 18 }).all);
    };
    draw();
  }

  private runRepeat(layer: Phaser.GameObjects.Container, crypt: CryptDef, heresy: number, party: string[], times: number) {
    const s = game.save;
    const results = repeatRuns(s, party, crypt, heresy, times);
    commit();
    layer.removeAll(true);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.94).setInteractive());
    layer.add(addFrame(this, GAME_W / 2, GAME_H / 2, GAME_W - 24, 700, { fill: 0x241925 }));
    const y0 = GAME_H / 2 - 330;
    const wins = results.filter((r) => r.outcome === 'victory').length;
    layer.add(this.add.text(GAME_W / 2, y0 + 30, `${wins} OF ${results.length} PURIFIED`, text.display(22, wins === results.length ? PAL.amber : 0xe58a8a)).setOrigin(0.5));
    const lines = results.map((r, i) => {
      const gear = r.gear.length ? `, ${r.gear.length} gear` : '';
      const fallen = r.fallen.length ? `, ${r.fallen.length} fell` : '';
      return `${i + 1}. ${r.outcome === 'victory' ? 'Purified' : 'Driven back'}: +${r.tithes} Tithes, +${r.seals} Seals${gear}${fallen}`;
    });
    if (results.length < times && results.every((r) => r.outcome === 'victory')) lines.push('No Sister was left able to march.');
    layer.add(this.add.text(PAD + 20, y0 + 70, lines.join('\n'), { ...text.body(17, PAL.ivory), lineSpacing: 6, wordWrap: { width: GAME_W - 80 } }));
    const t = results.reduce((a, r) => ({ tithes: a.tithes + r.tithes, seals: a.seals + r.seals, gear: a.gear + r.gear.length }), { tithes: 0, seals: 0, gear: 0 });
    layer.add(
      this.add
        .text(GAME_W / 2, y0 + 520, `In all: +${t.tithes} Tithes, +${t.seals} Seals, ${t.gear} gear${(() => { const m = addBags(...results.map((r) => r.items)); return bagEmpty(m) ? '' : `\n${bagText(m)}`; })()}`, { ...text.body(19, PAL.amber), align: 'center', wordWrap: { width: GAME_W - 80 } })
        .setOrigin(0.5),
    );
    layer.add(makeButton(this, GAME_W / 2, y0 + 610, 220, 56, 'Done', () => this.scene.restart(), { active: true, fontSize: 18 }).all);
  }
}
