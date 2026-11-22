import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { ORDERS } from '../data/orders';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import {
  FEAST_MARKS,
  FEAST_REPEATS,
  FEAST_STAGES,
  FEAST_STALL,
  FEATURED_BONUS,
  buy,
  claimMarks,
  feastBattle,
  feastName,
  feastOf,
  featuredBonus,
  finishStage,
  marksReady,
  repeatsLeft,
  rewardText,
  stageOpen,
  stockLeft,
  sweepStage,
} from '../systems/feast';
import { limitedWindow, timeLeft } from '../systems/limited';
import { makeButton } from '../ui/button';
import { sigilKey } from '../ui/icons';
import { modeScreen, toast } from '../ui/modeScreen';
import { pickParty } from '../ui/partyPicker';
import { makePlaceholderPortrait, portraitKey } from '../ui/placeholderPortrait';
import { holdForCard } from '../ui/sisterCard';
import { PAD, addFrame, addPanel, text } from '../ui/theme';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/** The Feast: a two-week event beside the limited Saint. Stages, a milestone track and the Feast stall. */
export class FeastScene extends Phaser.Scene {
  private notice?: string;

  constructor() {
    super('Feast');
  }

  init(data: { notice?: string }) {
    this.notice = data?.notice;
  }

  create() {
    const save = game.save;
    const w = limitedWindow();
    const f = feastOf(save);
    const saint = w.saint;
    const { top } = modeScreen(this, feastName(w), `${saint.name} holds the Altar. Win Candles at the Feast, spend them at the stall. Ends in ${timeLeft(w.ends)}.`);
    const bw = GAME_W - PAD * 2;
    let y = top;

    this.add.text(PAD, y, `CANDLES ${f.candles}`, text.hud(16, PAL.amber));
    this.add.text(GAME_W - PAD, y + 2, `REPEAT PAYOUTS ${repeatsLeft(save)}/${FEAST_REPEATS} TODAY`, text.hud(12, PAL.muted)).setOrigin(1, 0);
    y += 28;

    // Milestone track: Candles earned this Feast.
    addPanel(this, PAD, y, bw, 88);
    const next = FEAST_MARKS.find((m) => !f.paid.includes(m.at));
    const ready = marksReady(save);
    const goal = next?.at ?? FEAST_MARKS[FEAST_MARKS.length - 1].at;
    this.add.text(PAD + 14, y + 10, next ? `EARNED ${f.earned} · NEXT MILESTONE AT ${goal}` : `EARNED ${f.earned}`, text.hud(12, PAL.steel));
    const barW = bw - 28 - 130;
    this.add.rectangle(PAD + 14, y + 38, barW, 10, PAL.deepShadow).setOrigin(0, 0.5);
    this.add.rectangle(PAD + 14, y + 38, Math.max(1, barW * Math.min(1, f.earned / FEAST_MARKS[FEAST_MARKS.length - 1].at)), 10, PAL.amber).setOrigin(0, 0.5);
    FEAST_MARKS.forEach((m) => {
      const x = PAD + 14 + barW * Math.min(1, m.at / FEAST_MARKS[FEAST_MARKS.length - 1].at);
      this.add.rectangle(x, y + 38, 2, 16, f.paid.includes(m.at) ? PAL.steel : PAL.ivory);
    });
    this.add.text(PAD + 14, y + 54, next ? `Next: ${rewardText(next.reward, saint)}` : 'Every milestone paid.', { ...text.body(15, PAL.ivory), wordWrap: { width: barW } });
    makeButton(this, GAME_W - PAD - 70, y + 44, 116, 48, ready.length ? `Claim ${ready.length}` : 'Claim', () => {
      const got = claimMarks(save);
      if (!got.length) return;
      commit();
      this.scene.restart({ notice: `Feast milestones: ${got.map((m) => rewardText(m.reward, saint)).join(', ')}` });
    }, { active: ready.length > 0, disabled: !ready.length, fontSize: 16 });
    y += 98;

    // Featured Sisters: each in the party adds Candles.
    this.add.text(PAD, y, `BONUS SISTERS · +${Math.round(FEATURED_BONUS * 100)}% CANDLES EACH`, text.hud(12, PAL.steel));
    const feat = [saint, ...w.ssrs];
    feat.forEach((c, k) => {
      const x = PAD + 30 + k * 70;
      makePlaceholderPortrait(this, c);
      this.add.rectangle(x, y + 52, 60, 60, 0x170f1b).setStrokeStyle(2, RARITY_COLOR[c.rarity]);
      const img = this.add.image(x, y + 52, portraitKey(c.id)).setDisplaySize(56, 56).setAlpha(save.owned[c.id] ? 1 : 0.5);
      holdForCard(this, img, c.id);
    });
    this.add.image(PAD + 30 + 3 * 70, y + 52, sigilKey(ORDERS[saint.order].id)).setDisplaySize(40, 40);
    this.add.text(PAD + 30 + 3 * 70 + 30, y + 34, `and every Sister of the\n${saint.order}`, text.body(15, PAL.muted));
    y += 96;

    // Stages
    FEAST_STAGES.forEach((st, i) => {
      const h = 64;
      const open = stageOpen(save, i);
      const won = f.won.includes(i);
      this.add.rectangle(GAME_W / 2, y + h / 2, bw, h, open ? 0x1e1520 : 0x151017).setStrokeStyle(1, won ? PAL.bronze : PAL.armorShadow);
      this.add.text(PAD + 12, y + 8, `${ROMAN[i]} · ${st.name}`, text.body(17, open ? 0xfff1d6 : PAL.steel)).setFontStyle('600');
      this.add.text(PAD + 12, y + 34, open ? (won ? `Won · repeat pays ${st.repeat} Candles` : `First win pays ${st.first} Candles`) : 'Win the stage before it.', text.body(14, won ? PAL.muted : PAL.amber));
      if (open) {
        makeButton(this, GAME_W - PAD - 150, y + h / 2, 84, 44, 'Fight', () => this.fight(i), { active: !won, fontSize: 16 });
        makeButton(this, GAME_W - PAD - 52, y + h / 2, 84, 44, 'Sweep', () => {
          const n = sweepStage(save, i);
          if (!n) return;
          commit();
          this.scene.restart({ notice: `Swept: +${n} Candles` });
        }, { disabled: !won || repeatsLeft(save) <= 0, fontSize: 16 });
      }
      y += h + 6;
    });

    makeButton(this, GAME_W / 2, Math.min(y + 34, GAME_H - 88 - 36), 260, 52, 'The Feast Stall', () => this.showStall(), { active: true, fontSize: 18 });

    if (f.melted) {
      toast(this, `Last Feast's Candles melted into ${f.melted} Alms.`);
      f.melted = undefined;
      commit();
    } else if (this.notice) toast(this, this.notice);
  }

  private fight(i: number) {
    const save = game.save;
    const st = FEAST_STAGES[i];
    pickParty(
      this,
      save,
      { title: st.name, sub: 'Bonus Sisters earn more Candles. Tap Sisters in rank order; the first stands in front.', initial: save.lastParty, confirm: 'To the Feast' },
      (party) => {
        current.challenge = {
          label: `${feastName()}: ${st.name}.`,
          make: (rng) => feastBattle(save, party, i, rng),
          finish: (outcome) => {
            const n = finishStage(save, i, party, outcome === 'victory');
            const bonus = featuredBonus(party);
            const notice = outcome !== 'victory' ? 'The Feast turns you away. Nothing was spent.' : n ? `Victory: +${n} Candles${bonus ? ` (bonus +${Math.round(bonus * 100)}%)` : ''}` : 'Victory. No repeat payouts left today.';
            return { scene: 'Feast', data: { notice } };
          },
        };
        this.scene.start('Battle');
      },
    );
  }

  private showStall() {
    const save = game.save;
    const f = feastOf(save);
    const saint = limitedWindow().saint;
    const layer = this.add.container(0, 0).setDepth(20);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.93).setInteractive());
    layer.add(addFrame(this, GAME_W / 2, GAME_H / 2 - 20, GAME_W - 30, GAME_H - 150, { fill: 0x241925 }));
    layer.add(this.add.text(GAME_W / 2, 110, 'THE FEAST STALL', text.display(26, PAL.amber)).setOrigin(0.5));
    layer.add(this.add.text(GAME_W / 2, 140, `${f.candles} Candles. Stock lasts the whole Feast; unspent Candles melt into Alms when it ends.`, { ...text.body(15, PAL.muted), align: 'center', wordWrap: { width: GAME_W - 90 } }).setOrigin(0.5, 0));
    let y = 196;
    for (const item of FEAST_STALL) {
      const left = stockLeft(save, item);
      const name = item.id === 'favor' ? `${saint.name.split(' ')[0]}'s Favor ×10` : item.name;
      layer.add(this.add.rectangle(GAME_W / 2, y + 34, GAME_W - 70, 68, 0x1e1520).setStrokeStyle(1, PAL.armorShadow));
      layer.add(this.add.text(50, y + 12, name, text.body(18, PAL.ivory)).setFontStyle('600'));
      layer.add(this.add.text(50, y + 40, `${left} of ${item.stock} left`, text.hud(12, left ? PAL.steel : PAL.oxblood)));
      const b = makeButton(this, GAME_W - 110, y + 34, 130, 48, `${item.cost} Candles`, () => {
        if (!buy(save, item.id)) return;
        commit();
        this.scene.restart({ notice: `Bought: ${name}` });
      }, { disabled: left <= 0 || f.candles < item.cost, active: left > 0 && f.candles >= item.cost, fontSize: 15 });
      layer.add(b.all);
      y += 76;
    }
    const close = makeButton(this, GAME_W / 2, GAME_H - 110, 220, 56, 'Close', () => layer.destroy());
    layer.add(close.all);
  }
}
