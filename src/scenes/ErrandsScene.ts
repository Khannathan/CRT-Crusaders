import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { commit, game } from '../state/game';
import {
  ERRAND_SLOTS,
  boosted,
  bonusLabel,
  busySisters,
  claimErrand,
  errandsOf,
  fitsBonus,
  isDone,
  openErrands,
  rarityAtLeast,
  recallErrand,
  sendBlock,
  sendErrand,
  type ErrandDef,
} from '../systems/errands';
import { familyDef } from '../systems/items';
import { sisterPower } from '../systems/power';
import { rewardText } from '../systems/tasks';
import { makeButton } from '../ui/button';
import { modeScreen, progressBar, toast, untilText } from '../ui/modeScreen';
import { pickParty } from '../ui/partyPicker';
import { makePlaceholderPortrait, portraitKey } from '../ui/placeholderPortrait';
import { addScrollArea, type ScrollArea } from '../ui/scroll';
import { holdForCard } from '../ui/sisterCard';
import { TAB_BAR_H } from '../ui/tabBar';
import { PAD, text } from '../ui/theme';

/** Holy Errands: send Sisters away on timed duties and claim what they bring home. */
export class ErrandsScene extends Phaser.Scene {
  static listY = 0;
  private notice?: string;
  private timers: { label: Phaser.GameObjects.Text; end: number; start: number; bar: Phaser.GameObjects.Rectangle; w: number }[] = [];

  constructor() {
    super('Errands');
  }

  init(data: { notice?: string }) {
    this.notice = data?.notice;
  }

  create() {
    const save = game.save;
    const { top, refresh } = modeScreen(this, 'Holy Errands', 'Sisters on errands can still fight.');
    const bw = GAME_W - PAD * 2;
    const s = errandsOf(save);
    this.timers = [];
    const list = addScrollArea(this, top - 4, GAME_H - TAB_BAR_H, { start: ErrandsScene.listY, onScroll: (y) => (ErrandsScene.listY = y) });
    const before = this.children.list.length;
    let y = top + 4;

    this.add.text(PAD, y, `AWAY ${s.active.length}/${ERRAND_SLOTS}`, text.hud(14, s.active.length ? PAL.amber : PAL.steel));
    y += 26;
    if (!s.active.length) {
      this.add.text(PAD, y, 'No one is away. Pick an errand below.', text.body(16, PAL.muted));
      y += 34;
    }
    s.active.forEach((a, i) => {
      const h = 112;
      const done = isDone(a);
      this.add.rectangle(GAME_W / 2, y + h / 2, bw, h, 0x1e1520).setStrokeStyle(1, done ? PAL.amber : PAL.armorShadow);
      this.add.text(PAD + 12, y + 10, a.def.name, text.display(18, 0xfff1d6));
      if (a.boosted) this.add.text(GAME_W - PAD - 12, y + 12, '+50%', text.hud(12, PAL.amber)).setOrigin(1, 0);
      a.sisters.forEach((id, k) => this.face(PAD + 34 + k * 56, y + 62, id, 48));
      const label = this.add.text(PAD + 12 + 3 * 56 + 6, y + 44, '', text.body(16, done ? PAL.amber : PAL.ivory));
      const [, bar] = progressBar(this, PAD + 12 + 3 * 56 + 6, y + 76, 150, 0, PAL.amber, 6);
      this.timers.push({ label, end: a.end, start: a.start, bar, w: 150 });
      const btn = done
        ? makeButton(this, GAME_W - PAD - 70, y + 70, 116, 46, 'Claim', () => {}, { active: true, fontSize: 17 })
        : makeButton(this, GAME_W - PAD - 70, y + 70, 116, 46, 'Recall', () => {}, { fontSize: 15 });
      this.tapButton(list, btn.box, () => (done ? this.claim(i) : this.recall(i)));
      y += h + 10;
    });

    y += 8;
    const open = openErrands(save);
    this.add.text(PAD, y, `TODAY'S ERRANDS  ${open.length} LEFT`, text.hud(14, PAL.steel));
    this.add.text(GAME_W - PAD, y, 'NEW ERRANDS AT DAWN', text.hud(11, PAL.muted)).setOrigin(1, 0);
    y += 26;
    if (!open.length) {
      this.add.text(PAD, y, 'Every errand is taken. More at dawn.', text.body(16, PAL.muted));
      y += 34;
    }
    const full = s.active.length >= ERRAND_SLOTS;
    open.forEach((e) => {
      const h = 150;
      const fam = familyDef(e.family);
      this.add.rectangle(GAME_W / 2, y + h / 2, bw, h, 0x1a1219).setStrokeStyle(1, PAL.armorShadow);
      this.add.rectangle(PAD + 3, y + h / 2, 4, h - 12, fam.color);
      this.add.text(PAD + 16, y + 10, e.name, text.display(18, 0xfff1d6));
      this.add.text(GAME_W - PAD - 12, y + 12, `${e.hours}H`, text.hud(15, PAL.amber)).setOrigin(1, 0);
      this.add.text(PAD + 16, y + 38, e.flavor, { ...text.body(14, PAL.muted), fontStyle: 'italic', wordWrap: { width: bw - 40 } });
      const needs = [`${e.size} Sister${e.size > 1 ? 's' : ''}`, e.minRarity ? `one ${e.minRarity} or better` : '', `+50% with ${bonusLabel(e)}`].filter(Boolean).join('  ·  ');
      this.add.text(PAD + 16, y + 64, needs, text.body(15, PAL.ivory));
      this.add.text(PAD + 16, y + 88, rewardText(e.reward), { ...text.body(14, PAL.amber), wordWrap: { width: bw - 170 } });
      const btn = makeButton(this, GAME_W - PAD - 70, y + h - 32, 116, 44, full ? 'All away' : 'Send', () => {}, { active: !full, disabled: full, fontSize: 17 });
      if (!full) this.tapButton(list, btn.box, () => this.send(e));
      y += h + 10;
    });

    list.content.add(this.children.list.slice(before));
    list.fit(y + 10);
    this.tick();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tick() });
    if (this.notice) toast(this, this.notice);
    refresh();
  }

  /** A button inside the list: a drag or a tap outside the window doesn't press it. */
  private tapButton(list: ScrollArea, box: Phaser.GameObjects.Rectangle, fn: () => void) {
    box.removeAllListeners('pointerup');
    list.tap(box, fn);
  }

  private face(x: number, y: number, id: string, size: number) {
    const c = CRUSADERS.find((x) => x.id === id);
    if (!c) return;
    makePlaceholderPortrait(this, c);
    this.add.rectangle(x, y, size + 4, size + 4, 0x000000, 0).setStrokeStyle(2, RARITY_COLOR[c.rarity]);
    holdForCard(this, this.add.image(x, y, portraitKey(id)).setDisplaySize(size, size), id);
  }

  /** Time left on each errand; one coming home redraws the screen. */
  private tick() {
    const now = Date.now();
    for (const t of this.timers) {
      const left = t.end - now;
      if (left <= 0) {
        if (t.label.text && t.label.text !== 'Home. Claim it.') return this.scene.restart({});
        t.label.setText('Home. Claim it.');
        t.bar.width = t.w;
        continue;
      }
      t.label.setText(`Back in ${left < 60_000 ? `${Math.ceil(left / 1000)}s` : untilText(left)}`);
      t.bar.width = Math.max(1, t.w * Math.min(1, (now - t.start) / (t.end - t.start)));
    }
  }

  private send(e: ErrandDef) {
    const save = game.save;
    const busy = busySisters(save);
    const owned = CRUSADERS.filter((c) => save.owned[c.id] && !busy.has(c.id));
    // Suggest: the bonus Sister first, then the least needed elsewhere (lowest power), with one of the rarity asked.
    const suggest = () => {
      const ranked = [...owned].sort((a, b) => Number(fitsBonus(e, b.id)) - Number(fitsBonus(e, a.id)) || sisterPower(save, a) - sisterPower(save, b));
      const out = ranked.slice(0, e.size);
      if (e.minRarity && !out.some((c) => rarityAtLeast(c.rarity, e.minRarity))) {
        const rare = ranked.find((c) => rarityAtLeast(c.rarity, e.minRarity) && !out.includes(c));
        if (rare) out[out.length - 1] = rare;
      }
      return out.map((c) => c.id);
    };
    pickParty(
      this,
      save,
      {
        title: e.name,
        sub: `${e.hours}h. Pick ${e.size}${e.minRarity ? `, one ${e.minRarity} or better` : ''}. ${bonusLabel(e)} earns +50%: ${rewardText(boosted(e.reward))}.`,
        initial: suggest(),
        max: e.size,
        allow: (c) => !busy.has(c.id),
        why: busy.size ? 'Away on an errand' : undefined,
        confirm: 'Send',
        suggest,
      },
      (ids) => {
        const block = sendBlock(save, e, ids);
        if (block) return toast(this, block);
        sendErrand(save, e, ids);
        commit();
        this.scene.restart({ notice: `Sent. Back in ${e.hours}h.` });
      },
    );
  }

  private claim(i: number) {
    const r = claimErrand(game.save, i);
    if (!r) return;
    commit();
    this.scene.restart({ notice: `Home with ${rewardText(r)}.` });
  }

  private recall(i: number) {
    const a = errandsOf(game.save).active[i];
    if (!a) return;
    // Ask first: recalling forfeits the spoils.
    const layer = this.add.container(0, 0).setDepth(50);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.8).setInteractive());
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W - 60, 220, 0x241925).setStrokeStyle(2, PAL.goldEdge));
    layer.add(this.add.text(GAME_W / 2, GAME_H / 2 - 50, `Call the Sisters home from ${a.def.name}?\nThey bring nothing back, and the errand is gone for today.`, { ...text.body(18, PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 100 } }).setOrigin(0.5));
    const keep = makeButton(this, GAME_W / 2 - 110, GAME_H / 2 + 60, 190, 52, 'Keep going', () => layer.destroy(), { fontSize: 17 });
    const go = makeButton(this, GAME_W / 2 + 110, GAME_H / 2 + 60, 190, 52, 'Recall', () => {
      recallErrand(game.save, i);
      commit();
      this.scene.restart({ notice: 'The Sisters are home, empty-handed.' });
    }, { active: true, fontSize: 17 });
    layer.add([...keep.all, ...go.all]);
  }
}
