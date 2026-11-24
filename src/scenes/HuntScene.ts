import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { ENEMIES } from '../data/enemies';
import { game } from '../state/game';
import { current } from '../state/run';
import {
  HUNT_ENTRIES,
  HUNT_ROUNDS,
  MILESTONES,
  baneOf,
  finishHunt,
  huntBattle,
  huntEntriesLeft,
  huntOn,
  huntsOf,
  recommendFor,
  scoreUnit,
  tierLabel,
  tierScale,
  weakTo,
  type HuntDef,
} from '../systems/hunts';
import { rewardText } from '../systems/tasks';
import { makeButton } from '../ui/button';
import { enemyKey } from '../ui/enemyArt';
import { modeScreen, progressBar, toast } from '../ui/modeScreen';
import { pickParty } from '../ui/partyPicker';
import { portraitKey } from '../ui/placeholderPortrait';
import { drawPortraitBadges } from '../ui/portraitBadges';
import { addScrollArea } from '../ui/scroll';
import { addOrderSigil, holdForCard } from '../ui/sisterCard';
import { TAB_BAR_H } from '../ui/tabBar';
import { PAD, addFrame, shrinkToFit, text } from '../ui/theme';
import { huntMarks } from '../systems/pickMarks';

/** Front-to-back order for a suggested hunting party. */
const FRONT = ['sentinel', 'hierophant', 'martyr', 'warsister', 'inquisitor', 'veilblade', 'abbess', 'confessor', 'hospitaller', 'cantor', 'adjudicator', 'oracle', 'exorcist', 'censer', 'arbalist'];

/** Purge Hunts: today's beast, its mechanics, who to bring, and the score track. */
export class HuntScene extends Phaser.Scene {
  static listY = 0;
  /** Difficulty picked on this screen. */
  static tier?: number;
  /** Recommended Sisters: from the player's roster, or the best in the game. */
  static best = false;
  private notice?: string;

  constructor() {
    super('Hunt');
  }

  init(data: { notice?: string }) {
    this.notice = data?.notice;
  }

  create() {
    const save = game.save;
    const hunt = huntOn();
    const s = huntsOf(save);
    const boss = ENEMIES[hunt.boss];
    const { top, refresh } = modeScreen(this, 'Purge Hunts', 'Twelve rounds to wound the beast. Your daily best pays Godblood.');
    const bw = GAME_W - PAD * 2;
    const tier = Math.min(HuntScene.tier ?? s.tier, s.tier);
    const list = addScrollArea(this, top - 4, GAME_H - TAB_BAR_H, { start: HuntScene.listY, onScroll: (y) => (HuntScene.listY = y) });
    const before = this.children.list.length;
    let y = top + 4;

    // The beast.
    const ch = 230;
    addFrame(this, GAME_W / 2, y + ch / 2, bw, ch, { fill: 0x2a1520, edge: 0xe58a8a });
    const art = 150;
    if (this.textures.exists(enemyKey(hunt.boss))) this.add.image(PAD + 14 + art / 2, y + 16 + art / 2, enemyKey(hunt.boss)).setDisplaySize(art, art);
    this.add.rectangle(PAD + 14 + art / 2, y + 16 + art / 2, art + 4, art + 4, 0x000000, 0).setStrokeStyle(2, 0xe58a8a);
    const tx = PAD + art + 30;
    this.add.text(tx, y + 14, "TODAY'S BEAST", text.hud(12, 0xe58a8a));
    this.add.text(tx, y + 32, boss.name, { ...text.display(20, 0xfff1d6), wordWrap: { width: bw - art - 40 } });
    const weak = weakTo(hunt);
    this.add.text(tx, y + 88, `Weak to ${weak.map((w) => (w === 'physical' ? 'Physical' : 'Magic')).join(' and ')}`, text.body(15, weak.length > 1 ? PAL.violet : weak[0] === 'magic' ? 0x9ab8f0 : 0xd8b48a));
    const bane = baneOf(hunt);
    if (bane) {
      addOrderSigil(this, tx + 10, y + 124, bane, 22);
      this.add.text(tx + 26, y + 114, `Bane: ${bane}`, text.body(15, PAL.ivory));
    }
    this.add.text(tx, y + 142, `${HUNT_ROUNDS} rounds · ${huntEntriesLeft(save)}/${HUNT_ENTRIES} hunts left today`, text.body(14, PAL.muted));
    this.add.text(PAD + 16, y + 176, hunt.lore, { ...text.body(14, PAL.muted), fontStyle: 'italic', wordWrap: { width: bw - 32 } });
    y += ch + 12;

    // Difficulty.
    this.add.text(PAD, y + 10, 'DIFFICULTY', text.hud(13, PAL.amber));
    const prev = makeButton(this, GAME_W / 2 - 20, y + 16, 48, 40, '‹', () => this.setTier(tier - 1), { fontSize: 22, disabled: tier <= 0 });
    this.add.text(GAME_W / 2 + 60, y + 16, `TIER ${tierLabel(tier)}`, text.hud(15, 0xfff1d6)).setOrigin(0.5);
    const next = makeButton(this, GAME_W / 2 + 140, y + 16, 48, 40, '›', () => this.setTier(tier + 1), { fontSize: 22, disabled: tier >= s.tier });
    [prev, next].forEach((b) => b.box.removeAllListeners('pointerup'));
    list.tap(prev.box, () => this.setTier(tier - 1));
    list.tap(next.box, () => this.setTier(tier + 1));
    this.add.text(GAME_W - PAD, y + 8, `x${tierScale(tier).toFixed(1)}`, text.hud(12, PAL.muted)).setOrigin(1, 0);
    y += 40;
    this.add.text(PAD, y, `Fell the beast to open the next tier. Harder tiers score more.`, { ...text.body(14, PAL.muted), wordWrap: { width: bw } });
    y += 40;

    // Mechanics.
    this.add.text(PAD, y, 'ITS WAYS', text.hud(13, PAL.amber));
    y += 22;
    for (const m of hunt.mechanics) {
      const box = this.add.rectangle(GAME_W / 2, y, bw, 10, 0x1a1219).setOrigin(0.5, 0).setStrokeStyle(1, PAL.armorShadow);
      const body = this.add.text(PAD + 14, y + 26, m.text, { ...text.body(15, PAL.ivory), wordWrap: { width: bw - 28 } });
      const ans = this.add.text(PAD + 14, y + 30 + body.height, `Answer: ${m.answer}`, { ...text.body(14, 0x9fd0a0), wordWrap: { width: bw - 28 } });
      const h = 40 + body.height + ans.height;
      box.setSize(bw, h);
      this.add.text(PAD + 14, y + 6, m.name.toUpperCase(), text.hud(12, 0xe58a8a));
      y += h + 8;
    }
    y += 6;

    // Recommended Sisters.
    const mine = recommendFor(save, hunt);
    const recs = HuntScene.best ? recommendFor(save, hunt, 4, 'all') : mine;
    this.add.text(PAD, y + 6, 'RECOMMENDED SISTERS', text.hud(13, PAL.amber));
    // Toggle: the best of your roster, or the best Sisters in the game (owned or not).
    const toggle = (label: string, on: boolean, x: number, best: boolean) => {
      const t = this.add.text(x, y + 6, label, text.hud(11, on ? 0x140d14 : PAL.muted)).setOrigin(1, 0);
      const bg = this.add.rectangle(x + 6, y, t.width + 12, 26, on ? PAL.amber : 0x1b121d).setOrigin(1, 0).setStrokeStyle(1, on ? PAL.amber : PAL.armorShadow).setInteractive({ useHandCursor: true });
      this.children.bringToTop(t);
      list.tap(bg, () => {
        if (HuntScene.best === best) return;
        HuntScene.best = best;
        this.scene.restart();
      });
      return t.width + 12;
    };
    const w1 = toggle('BEST OVERALL', HuntScene.best, GAME_W - PAD - 6, true);
    toggle('MY ROSTER', !HuntScene.best, GAME_W - PAD - 6 - w1 - 6, false);
    y += 34;
    const cell = bw / 4;
    recs.forEach((r, i) => {
      const x = PAD + cell * i + cell / 2;
      const have = !!save.owned[r.c.id];
      this.add.rectangle(x, y + 50, 104, 104, 0x170f1b).setStrokeStyle(1, RARITY_COLOR[r.c.rarity]);
      holdForCard(this, this.add.image(x, y + 50, portraitKey(r.c.id)).setDisplaySize(100, 100).setAlpha(have ? 1 : 0.45), r.c.id);
      drawPortraitBadges(this, x, y + 50, 100, r.c, save, { dim: !have });
      if (!have) this.add.text(x, y + 50, 'NOT OWNED', { ...text.hud(11, PAL.ivory), backgroundColor: '#140d14cc', padding: { x: 4, y: 2 } }).setOrigin(0.5);
      shrinkToFit(this.add.text(x, y + 106, r.c.name.split(' ')[0], text.body(15, have ? PAL.ivory : PAL.muted)).setOrigin(0.5, 0), 96);
      this.add.text(x, y + 126, r.why.slice(0, 2).join('\n') || 'Strongest', { ...text.body(12, 0x9fd0a0), align: 'center' }).setOrigin(0.5, 0);
    });
    y += 164;
    const go = makeButton(this, GAME_W / 2, y + 30, 260, 58, huntEntriesLeft(save) ? 'Hunt' : 'No hunts left today', () => {}, { active: huntEntriesLeft(save) > 0, disabled: !huntEntriesLeft(save), fontSize: 20, icon: 'blade' });
    go.box.removeAllListeners('pointerup');
    if (huntEntriesLeft(save)) list.tap(go.box, () => this.hunt(hunt, tier, mine.map((r) => r.c)));
    y += 76;

    // Today's score track.
    const unit = scoreUnit(hunt);
    const units = s.best / unit;
    this.add.text(PAD, y, `TODAY'S BEST  ${s.best.toLocaleString('en-US')}  (${Math.round(units * 100)}% of the beast)`, text.hud(13, PAL.amber));
    y += 22;
    const rec = s.records[hunt.id] ?? 0;
    this.add.text(PAD, y, `Your record against ${boss.name}: ${rec.toLocaleString('en-US')}`, text.body(14, PAL.muted));
    y += 26;
    MILESTONES.forEach((m, i) => {
      const got = i < s.paid;
      const nextUp = i === s.paid;
      this.add.rectangle(GAME_W / 2, y + 20, bw, 40, got ? 0x22301f : nextUp ? 0x2a1e24 : 0x150e17).setStrokeStyle(1, got ? 0x7fc47f : nextUp ? PAL.amber : PAL.armorShadow);
      this.add.text(PAD + 12, y + 11, `${Math.round(m.at * 100)}%`, text.hud(13, got ? 0x9fd0a0 : nextUp ? PAL.amber : PAL.steel));
      this.add.text(PAD + 80, y + 10, rewardText(m.reward), text.body(15, got ? PAL.muted : PAL.ivory));
      if (got) this.add.text(GAME_W - PAD - 12, y + 11, 'PAID', text.hud(11, 0x9fd0a0)).setOrigin(1, 0);
      else if (nextUp) {
        const [bg] = progressBar(this, GAME_W - PAD - 112, y + 20, 100, Math.min(1, units / m.at), PAL.amber, 6);
        void bg;
      }
      y += 46;
    });
    y += 8;
    const tomorrow = huntOn(Date.now() + 86_400_000);
    this.add.text(PAD, y, `Tomorrow: ${ENEMIES[tomorrow.boss].name}. Milestones renew at dawn.`, text.body(14, PAL.muted));
    y += 40;

    list.content.add(this.children.list.slice(before));
    list.fit(y);
    if (this.notice) toast(this, this.notice);
    refresh();
  }

  private setTier(t: number) {
    const max = huntsOf(game.save).tier;
    HuntScene.tier = Math.max(0, Math.min(max, t));
    this.scene.restart({});
  }

  private hunt(hunt: HuntDef, tier: number, recs: { id: string; classId: string }[]) {
    const save = game.save;
    const suggest = () => [...recs].sort((a, b) => FRONT.indexOf(a.classId) - FRONT.indexOf(b.classId)).map((c) => c.id);
    pickParty(
      this,
      save,
      { title: ENEMIES[hunt.boss].name, sub: `Tier ${tierLabel(tier)}. ${HUNT_ROUNDS} rounds. Tap in rank order.`, initial: save.lastParty, confirm: 'Hunt', suggest, hound: true, marks: huntMarks(save, hunt) },
      (party) => {
        save.lastParty = party;
        current.challenge = {
          label: `The hunt begins: ${ENEMIES[hunt.boss].name}, tier ${tierLabel(tier)}. ${HUNT_ROUNDS} rounds to wound it!`,
          make: (rng) => huntBattle(save, party, hunt, tier, rng),
          finish: (_o, battle) => {
            const r = finishHunt(save, hunt, tier, battle);
            const pct = Math.round((r.score / scoreUnit(hunt)) * 100);
            const lines = [`Score ${r.score.toLocaleString('en-US')} (${pct}% of the beast)${r.newRecord ? '. A new record!' : r.newBest ? ". Today's best!" : '.'}`];
            if (r.felled) lines.push('The beast is felled!');
            if (r.unlocked !== undefined) lines.push(`Tier ${tierLabel(r.unlocked)} is open.`);
            if (r.rewards.length) lines.push(`Paid: ${r.rewards.map(rewardText).join(' + ')}`);
            return { scene: 'Hunt', data: { notice: lines.join('\n') }, line: `The hunt is over. Score ${r.score.toLocaleString('en-US')}.` };
          },
        };
        this.scene.start('Battle');
      },
    );
  }
}
