import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { ENEMIES } from '../data/enemies';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import {
  CHAPTER_PERK,
  CHAPTER_SHOP,
  MAX_CHAPTER_LEVEL,
  SIEGE_MILESTONES,
  SIEGE_STRIKES,
  TITHES,
  boughtOf,
  buyChapter,
  chapterLevel,
  chapterOf,
  claimSiege,
  finishSiege,
  foundChapter,
  levelProgress,
  membersOf,
  siegeBattle,
  siegeBeast,
  siegeReady,
  siegeTable,
  strikesLeft,
  tithe,
  titheBlock,
} from '../systems/chapter';
import { rewardText } from '../systems/tasks';
import { makeButton } from '../ui/button';
import { modeScreen, progressBar, toast } from '../ui/modeScreen';
import { pickParty } from '../ui/partyPicker';
import { addScrollArea } from '../ui/scroll';
import { TAB_BAR_H } from '../ui/tabBar';
import { PAD, addFrame, addPanel, text } from '../ui/theme';

const SIMULATED = [
  'Played offline: fourteen AI Sisters, no other players.',
  'Each day, a member may turn up (her Devotion) to tithe and strike the week\'s Siege beast twice (her Might). Days away catch up when you return, up to a week.',
  'Your own tithes and Siege fights count exactly as shown.',
  'Each Chapter level: all your Sisters +1% ATK and HP.',
];

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** The Chapter: the offline guild with AI Sisters. */
export class ChapterScene extends Phaser.Scene {
  private notice?: string;

  constructor() {
    super('Chapter');
  }

  init(data: { notice?: string }) {
    this.notice = data?.notice;
  }

  create() {
    const save = game.save;
    const c = chapterOf(save);
    if (c) commit();
    const { top } = modeScreen(this, 'The Chapter', c ? `The ${c.name}.` : '', undefined, 'bg-chapter');
    const bw = GAME_W - PAD * 2;
    if (!c) {
      const blurb = this.add.text(PAD + 18, top + 22, SIMULATED.join('\n\n'), { ...text.body(16, PAL.ivory), wordWrap: { width: bw - 36 } }).setDepth(1);
      const ph = blurb.height + 44;
      addPanel(this, PAD, top, bw, ph);
      makeButton(this, GAME_W / 2, top + ph + 50, 280, 60, 'Take your vows!', () => {
        foundChapter(save);
        commit();
        this.scene.restart({ notice: 'The Chapter takes you in. Welcome, Sister!' });
      }, { active: true, fontSize: 19 });
      return;
    }
    const list = addScrollArea(this, top - 4, GAME_H - TAB_BAR_H);
    const before = this.children.list.length;
    let y = top;

    // Level and Marks
    const lvl = chapterLevel(c.xp);
    const p = levelProgress(c.xp);
    this.add.text(PAD, y, `LEVEL ${lvl}${lvl >= MAX_CHAPTER_LEVEL ? ' (MAX)' : ''} · +${Math.round(lvl * CHAPTER_PERK * 100)}% ATK AND HP TO EVERY SISTER`, text.hud(12, PAL.amber));
    y += 22;
    progressBar(this, PAD, y + 4, bw - 150, lvl >= MAX_CHAPTER_LEVEL ? 1 : p.into / p.need, PAL.amber, 8);
    this.add.text(PAD, y + 14, lvl >= MAX_CHAPTER_LEVEL ? 'The Chapter stands at its height!' : `${fmt(p.into)} / ${fmt(p.need)} XP`, text.hud(11, PAL.steel));
    this.add.text(GAME_W - PAD - 150 + 12, y - 4, `${fmt(c.marks)} MARKS`, text.hud(14, 0xe19cc4));
    list.tap(makeButton(this, GAME_W - PAD - 30, y + 10, 52, 36, '?', () => {}, { fontSize: 18 }).box, () => this.showSimulated());
    y += 44;

    // Tithe
    addPanel(this, PAD, y, bw, 118);
    this.add.text(PAD + 14, y + 10, c.tithed !== undefined ? `TITHED TODAY: ${TITHES[c.tithed].name.toUpperCase()}` : 'TITHE ONCE A DAY', text.hud(12, c.tithed !== undefined ? PAL.steel : PAL.amber));
    const tw = (bw - 28 - 12) / 3;
    TITHES.forEach((t, i) => {
      const block = titheBlock(save, i);
      const b = makeButton(this, PAD + 14 + tw / 2 + i * (tw + 6), y + 70, tw, 64, `${t.name}\n${t.tithes ? `${fmt(t.tithes)} Tithes` : `${t.gilt} Gilt`}`, () => {}, { active: !block && i === 0, disabled: !!block, fontSize: 14 });
      list.tap(b.box, () => {
        if (!tithe(save, i)) return;
        commit();
        this.scene.restart({ notice: `+${t.xp} Chapter XP, +${t.marks} Marks` });
      });
    });
    y += 130;

    // Siege
    const { hunt, pool } = siegeBeast(save);
    const left = strikesLeft(save);
    const ready = siegeReady(save);
    const table = siegeTable(save);
    const rank = table.findIndex((r) => r.id === 'you') + 1;
    addPanel(this, PAD, y, bw, 206);
    this.add.text(PAD + 14, y + 10, 'THE WEEK\'S SIEGE', text.hud(12, PAL.steel));
    this.add.text(PAD + 14, y + 28, ENEMIES[hunt.boss].name, text.display(20, 0xfff1d6));
    this.add.text(PAD + 14, y + 62, `The Chapter has dealt ${fmt(c.siege.dealt)} of ${fmt(pool)}.`, text.body(15, PAL.ivory));
    const barW = bw - 28;
    progressBar(this, PAD + 14, y + 92, barW, c.siege.dealt / pool, 0xe58a8a, 10);
    SIEGE_MILESTONES.forEach((m, i) => {
      const x = PAD + 14 + barW * m.at;
      const got = c.siege.paid.includes(i);
      this.add.rectangle(Math.min(x, PAD + 14 + barW - 1), y + 92, 3, 18, got ? PAL.steel : c.siege.dealt >= m.at * pool ? PAL.amber : PAL.ivory);
    });
    this.add.text(PAD + 14, y + 106, `You: ${fmt(c.siege.by.you ?? 0)} · rank ${rank} of ${table.length}`, text.body(15, PAL.muted));
    const bw3 = (bw - 28 - 12) / 3;
    const strike = makeButton(this, PAD + 14 + bw3 / 2, y + 164, bw3, 52, left ? `Strike (${left}/${SIEGE_STRIKES})` : 'No strikes', () => {}, { active: left > 0, disabled: !left, fontSize: 15, icon: 'blade' });
    list.tap(strike.box, () => left && this.strike());
    const claim = makeButton(this, PAD + 14 + bw3 * 1.5 + 6, y + 164, bw3, 52, ready.length ? `Claim ${ready.length}` : 'Milestones', () => {}, { active: ready.length > 0, fontSize: 15 });
    list.tap(claim.box, () => {
      if (!ready.length) return this.showMilestones();
      const got = claimSiege(save);
      commit();
      this.scene.restart({ notice: `Siege: ${got.map((r) => `${rewardText(r)} + ${r.marks} Marks`).join(', ')}` });
    });
    const tb = makeButton(this, PAD + 14 + bw3 * 2.5 + 12, y + 164, bw3, 52, 'Standings', () => {}, { fontSize: 15 });
    list.tap(tb.box, () => this.showTable());
    y += 218;

    // Members and shop
    const half = (bw - 8) / 2;
    list.tap(makeButton(this, PAD + half / 2, y + 26, half, 52, 'Members', () => {}, { fontSize: 16, icon: 'roster' }).box, () => this.showMembers());
    list.tap(makeButton(this, GAME_W - PAD - half / 2, y + 26, half, 52, 'Chapter Shop', () => {}, { fontSize: 16, icon: 'seal' }).box, () => this.showShop());
    y += 66;

    // Chronicle
    this.add.text(PAD, y, 'CHRONICLE', text.hud(12, PAL.amber));
    y += 20;
    for (const line of c.log.slice(0, 10)) {
      const t = this.add.text(PAD, y, line.text, { ...text.body(15, PAL.muted), wordWrap: { width: bw } });
      y += t.height + 6;
    }
    list.content.add(this.children.list.slice(before));
    list.fit(y + 12);
    if (this.notice) toast(this, this.notice);
  }

  private strike() {
    const save = game.save;
    const { hunt } = siegeBeast(save);
    pickParty(
      this,
      save,
      { title: 'The Siege', sub: `${ENEMIES[hunt.boss].name}: twelve rounds to wound it. Every blow counts for the Chapter!`, initial: save.lastParty, confirm: 'Strike', hound: true },
      (party) => {
        current.challenge = {
          label: `The Chapter's Siege: ${ENEMIES[hunt.boss].name}. Twelve rounds.`,
          make: (rng) => siegeBattle(save, party, rng),
          finish: (_o, battle) => {
            const dmg = finishSiege(save, battle);
            commit();
            return { scene: 'Chapter', data: { notice: `You dealt ${fmt(dmg)} to the beast!` }, line: `The Siege is over. ${fmt(dmg)} damage.` };
          },
        };
        this.scene.start('Battle');
      },
    );
  }

  private overlay(title: string) {
    const layer = this.add.container(0, 0).setDepth(40);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.95).setInteractive());
    layer.add(addFrame(this, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 }));
    layer.add(this.add.text(GAME_W / 2, 64, title, text.display(22, PAL.ivory)).setOrigin(0.5));
    layer.add(makeButton(this, GAME_W / 2, GAME_H - 72, 240, 60, 'Close', () => layer.destroy(), { fontSize: 19 }).all);
    return layer;
  }

  private showSimulated() {
    const layer = this.overlay('WHAT IS SIMULATED');
    layer.add(this.add.text(48, 100, SIMULATED.join('\n\n'), { ...text.body(17, PAL.ivory), wordWrap: { width: GAME_W - 96 } }));
  }

  private showMilestones() {
    const save = game.save;
    const c = save.chapter!;
    const { pool } = siegeBeast(save);
    const layer = this.overlay('SIEGE MILESTONES');
    let y = 110;
    SIEGE_MILESTONES.forEach((m, i) => {
      const got = c.siege.paid.includes(i);
      const reached = c.siege.dealt >= m.at * pool;
      layer.add(this.add.text(48, y, `${Math.round(m.at * 100)}% · ${fmt(m.at * pool)}${got ? ' · PAID' : reached ? ' · READY' : ''}`, text.hud(13, got ? PAL.steel : reached ? PAL.amber : PAL.ivory)));
      layer.add(this.add.text(48, y + 22, `${rewardText(m.reward)} + ${m.reward.marks} Marks`, { ...text.body(16, PAL.muted), wordWrap: { width: GAME_W - 96 } }));
      y += 70;
    });
    layer.add(this.add.text(48, y + 10, 'Milestones count the whole Chapter\'s damage. Unclaimed ones pay out when the week turns.', { ...text.body(15, PAL.muted), wordWrap: { width: GAME_W - 96 } }));
  }

  private showTable() {
    const save = game.save;
    const layer = this.overlay('SIEGE STANDINGS');
    siegeTable(save).forEach((r, i) => {
      const y = 104 + i * 40;
      const you = r.id === 'you';
      layer.add(this.add.rectangle(GAME_W / 2, y + 14, GAME_W - 70, 34, you ? 0x3a2030 : 0x1b131d).setStrokeStyle(1, you ? PAL.amber : PAL.armorShadow));
      layer.add(this.add.text(48, y + 4, `${i + 1}`, text.hud(13, PAL.steel)));
      layer.add(this.add.text(84, y + 2, r.name, text.body(16, you ? PAL.amber : PAL.ivory)));
      layer.add(this.add.text(GAME_W - 48, y + 4, fmt(r.dealt), text.hud(13, PAL.amber)).setOrigin(1, 0));
    });
  }

  private showMembers() {
    const save = game.save;
    const c = save.chapter!;
    const layer = this.overlay('THE CHAPTER');
    membersOf(c.seed).forEach((m, i) => {
      const y = 100 + i * 50;
      layer.add(this.add.rectangle(GAME_W / 2, y + 20, GAME_W - 70, 44, 0x1b131d).setStrokeStyle(1, PAL.armorShadow));
      layer.add(this.add.text(48, y + 2, m.name, text.body(16, PAL.ivory)));
      layer.add(this.add.text(48, y + 22, m.title.toUpperCase(), text.hud(11, PAL.steel)));
      layer.add(this.add.text(GAME_W - 48, y + 4, `DEVOTION ${Math.round(m.devotion * 100)}%`, text.hud(11, PAL.amber)).setOrigin(1, 0));
      layer.add(this.add.text(GAME_W - 48, y + 22, `MIGHT ${Math.round(m.might * 100)}`, text.hud(11, 0xe58a8a)).setOrigin(1, 0));
    });
    layer.add(this.add.text(GAME_W / 2, 100 + 14 * 50 + 6, 'AI Sisters, simulated offline. Tap ? on the Chapter for how.', text.body(14, PAL.muted)).setOrigin(0.5, 0));
  }

  private showShop() {
    const save = game.save;
    const c = save.chapter!;
    const layer = this.overlay('THE CHAPTER SHOP');
    layer.add(this.add.text(GAME_W / 2, 92, `${fmt(c.marks)} Marks. New stock every Monday.`, text.body(16, PAL.muted)).setOrigin(0.5, 0));
    CHAPTER_SHOP.forEach((o, i) => {
      const y = 130 + i * 82;
      const left = o.limit - boughtOf(save, o.id);
      layer.add(this.add.rectangle(GAME_W / 2, y + 34, GAME_W - 70, 72, 0x1e1520).setStrokeStyle(1, PAL.armorShadow));
      layer.add(this.add.text(50, y + 12, o.name, { ...text.body(18, PAL.ivory), fontStyle: '600' }));
      layer.add(this.add.text(50, y + 42, `${left} of ${o.limit} left this week`, text.hud(12, left ? PAL.steel : PAL.oxblood)));
      const can = left > 0 && c.marks >= o.price;
      layer.add(makeButton(this, GAME_W - 110, y + 34, 130, 48, `${o.price} Marks`, () => {
        if (!buyChapter(save, o.id)) return;
        commit();
        this.scene.restart({ notice: `Bought: ${o.name}` });
      }, { active: can, disabled: !can, fontSize: 15 }).all);
    });
  }
}
