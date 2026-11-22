import Phaser from 'phaser';
import { CRUSADERS } from '../data/crusaders';
import { GAME_W, PAL } from '../config';
import { game } from '../state/game';
import { current } from '../state/run';
import { BRAND_MARKS, actRecommended, FEATURED_BONUS, finishAct, foesOf, inquisitionBattle, inquisitionOf, markText, rotation, spentElsewhere, totalBrands } from '../systems/inquisition';
import { makeButton } from '../ui/button';
import { modeScreen, progressBar, toast, untilText } from '../ui/modeScreen';
import { pickParty } from '../ui/partyPicker';
import { accountPower } from '../systems/power';
import { drawRecommended } from '../ui/recommended';
import { PAD, addFrame, text } from '../ui/theme';
import { drawStars } from './TrialsScene';

const ACT_NUM = ['I', 'II', 'III'];
const first = (id: string) => CRUSADERS.find((c) => c.id === id)?.name.split(' ')[0] ?? id;

/** The Inquisition: this fortnight's Edict, its three trials, and the Brands earned. */
export class InquisitionScene extends Phaser.Scene {
  private notice?: string;

  constructor() {
    super('Inquisition');
  }

  init(data: { notice?: string }) {
    this.notice = data?.notice;
  }

  create() {
    const save = game.save;
    const now = Date.now();
    const rot = rotation(now);
    const st = inquisitionOf(save, now);
    const { top } = modeScreen(this, 'The Inquisition', 'Every fortnight a new Edict. Three trials, nine Brands, and no mercy.');
    const bw = GAME_W - PAD * 2;

    // The Edict
    let y = top;
    addFrame(this, GAME_W / 2, y + 52, bw, 104, { fill: 0x2a1520, edge: 0xe58a8a });
    this.add.text(PAD + 16, y + 12, rot.edict.name.toUpperCase(), text.display(20, 0xfff1d6));
    this.add.text(GAME_W - PAD - 16, y + 16, `ENDS IN ${untilText(rot.ends - now)}`, text.hud(11, PAL.muted)).setOrigin(1, 0);
    this.add.text(PAD + 16, y + 44, rot.edict.rule, { ...text.body(16, 0xe5a86a), fontStyle: '600' });
    this.add.text(PAD + 16, y + 70, `Blessed: ${rot.featured.join(' and ')} (+${Math.round(FEATURED_BONUS * 100)}% ATK, HP)`, { ...text.body(14, PAL.steel), wordWrap: { width: bw - 32 } });
    y += 120;

    // Brands
    const total = totalBrands(save, now);
    this.add.text(PAD, y, `BRANDS ${total} / 9`, text.hud(14, PAL.amber));
    this.add.text(GAME_W - PAD, y, 'A LOSS COSTS NOTHING', text.hud(11, PAL.muted)).setOrigin(1, 0);
    progressBar(this, PAD, y + 28, bw, total / 9, 0xc0503c, 8);
    BRAND_MARKS.forEach((m, i) => {
      const x = PAD + (bw * m.at) / 9;
      const paid = st.paid.includes(m.at);
      this.add.rectangle(x - (i === 2 ? 2 : 0), y + 28, 4, 16, paid ? PAL.amber : PAL.steel);
      const w = bw / 3 - 8;
      this.add.text(PAD + (bw / 3) * i, y + 42, `${m.at}: ${markText(m)}${paid ? ' ✓' : ''}`, { ...text.body(13, paid ? PAL.amber : PAL.muted), wordWrap: { width: w } });
    });
    y += 84;

    // The three acts
    rot.acts.forEach((act, i) => {
      const h = 140;
      const used = st.used[i];
      addFrame(this, GAME_W / 2, y + h / 2, bw, h, { fill: 0x1e1520, edge: st.brands[i] === 3 ? PAL.amber : PAL.goldEdge });
      this.add.text(PAD + 16, y + 12, `${ACT_NUM[i]}. ${act.name}`, text.display(19, 0xfff1d6));
      drawStars(this, GAME_W - PAD - 70, y + 24, st.brands[i], 9);
      this.add.text(PAD + 16, y + 44, foesOf(act), { ...text.body(15, PAL.ivory), wordWrap: { width: bw - 32 } }).setCrop(0, 0, bw - 32, 22);
      const at = this.add.text(PAD + 16, y + 68, `Foes at ${Math.round(act.scale * 100)}%`, text.body(14, PAL.muted));
      const spent = spentElsewhere(save, i, now);
      drawRecommended(this, at.x + at.width + 14, y + 71, actRecommended(save, i, now), accountPower(save, (c) => !spent.has(c.id)));
      this.add.text(PAD + 16, y + 92, used.length ? `Spent: ${used.map(first).join(', ')}` : 'No Sister spent yet', { ...text.body(14, used.length ? 0xe5a86a : PAL.steel), wordWrap: { width: bw - 190 } });
      makeButton(this, GAME_W - PAD - 82, y + h - 36, 140, 48, st.brands[i] ? 'Retry' : 'Judge', () => this.fight(i), { active: !st.brands[i], fontSize: 18, icon: 'blade' });
      y += h + 10;
    });

    if (this.notice) toast(this, this.notice);
  }

  private fight(act: number) {
    const save = game.save;
    const rot = rotation();
    const a = rot.acts[act];
    const spent = spentElsewhere(save, act);
    pickParty(
      this,
      save,
      {
        title: `${ACT_NUM[act]}. ${a.name}`,
        sub: `${rot.edict.rule} Sisters who won another trial this fortnight must rest.`,
        initial: save.lastParty,
        allow: (c) => !spent.has(c.id),
        why: 'Spent on another trial',
        confirm: 'Judge',
        rec: actRecommended(save, act),
      },
      (party) => {
        current.challenge = {
          label: `${a.name}. ${rot.edict.name} is upon you.`,
          make: (rng) => inquisitionBattle(save, party, act, rng),
          finish: (_o, battle) => {
            const r = finishAct(save, act, battle);
            let notice = 'Judgment failed. The heretics laugh. Try again.';
            if (r.brands) notice = r.gained ? `${r.brands} Brand${r.brands > 1 ? 's' : ''} earned` : `${r.brands} Brand${r.brands > 1 ? 's' : ''}, no better than before`;
            for (const m of r.paid) notice += `\nMark ${m.at}: ${markText(m)}`;
            for (const g of r.gear) notice += `\n${g.name} (${g.rarity})`;
            return { scene: 'Inquisition', data: { notice } };
          },
        };
        this.scene.start('Battle');
      },
    );
  }
}
