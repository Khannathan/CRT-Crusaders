import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { commit, game } from '../state/game';
import {
  DEEDS,
  MAX_POINTS,
  TIER_REWARDS,
  anyDeedReady,
  claimDeeds,
  claimedTiers,
  deedPoints,
  deedReady,
  nextPointTitle,
  type DeedClaim,
} from '../systems/deeds';
import { wearTitle } from '../systems/collection';
import { rewardText } from '../systems/tasks';
import { makeButton } from '../ui/button';
import { modeScreen, progressBar, toast } from '../ui/modeScreen';
import { addScrollArea } from '../ui/scroll';
import { TAB_BAR_H } from '../ui/tabBar';
import { PAD, fitLine, text } from '../ui/theme';

/** Deeds: twenty ladders of five tiers, Deed points and the titles they earn. */
export class DeedsScene extends Phaser.Scene {
  private scroll = 0;
  private msg?: string;

  constructor() {
    super('Deeds');
  }

  init(data: { scroll?: number; msg?: string }) {
    this.scroll = data?.scroll ?? 0;
    this.msg = data?.msg;
  }

  create() {
    const save = game.save;
    const { top, refresh } = modeScreen(this, 'Deeds', '');
    const bw = GAME_W - PAD * 2;

    // Points, the next title, and the worn one.
    const pts = deedPoints(save);
    const next = nextPointTitle(save);
    this.add.text(PAD, top, `DEED POINTS ${pts} / ${MAX_POINTS}`, text.hud(13, PAL.amber));
    if (next) this.add.text(GAME_W - PAD, top, `"${next.title.toUpperCase()}" AT ${next.at}`, text.hud(11, PAL.steel)).setOrigin(1, 0);
    progressBar(this, PAD, top + 28, bw, next ? pts / next.at : 1, PAL.amber, 8);
    const titles = save.titles ?? [];
    fitLine(this.add.text(PAD, top + 50, titles.length ? `Title: ${save.title ?? 'none'}` : 'Earn a title with your deeds', text.body(16, titles.length ? PAL.amber : PAL.steel)), bw - 270);
    if (titles.length)
      makeButton(this, GAME_W - PAD - 196, top + 60, 110, 36, 'Title', () => {
        const all: (string | undefined)[] = [...titles, undefined];
        wearTitle(save, all[(all.indexOf(save.title) + 1) % all.length]);
        commit();
        this.scene.restart({ scroll: this.scroll });
      }, { fontSize: 15 });
    const any = anyDeedReady(save);
    makeButton(this, GAME_W - PAD - 64, top + 60, 128, 36, 'Claim all', () => this.claim(undefined, refresh), { fontSize: 15, active: any, disabled: !any });

    // The ledger.
    const listTop = top + 90;
    const list = addScrollArea(this, listTop, GAME_H - TAB_BAR_H - 6, { start: this.scroll, onScroll: (y) => (this.scroll = y) });
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (list.content.add(o), o);
    // Ready deeds first, then the ones furthest along.
    const rows = [...DEEDS].sort((a, b) => Number(deedReady(save, b)) - Number(deedReady(save, a)));
    let y = listTop + 4;
    for (const d of rows) {
      const done = claimedTiers(save, d.id);
      const ready = deedReady(save, d);
      const maxed = done >= d.tiers.length;
      const goal = d.tiers[Math.min(done, d.tiers.length - 1)];
      const have = d.value(save);
      const h = 92;
      add(this.add.rectangle(GAME_W / 2, y + h / 2, bw, h, ready ? 0x2c1a24 : 0x1b131d).setStrokeStyle(1, ready ? PAL.amber : maxed ? PAL.bronze : PAL.armorShadow));
      add(this.add.text(PAD + 14, y + 10, d.name.toUpperCase(), text.hud(12, ready ? PAL.amber : PAL.steel)));
      // Five pips, one per tier claimed.
      for (let t = 0; t < d.tiers.length; t++) add(this.add.rectangle(PAD + bw - 150 + t * 16, y + 17, 11, 11, t < done ? PAL.amber : PAL.deepShadow).setStrokeStyle(1, PAL.bronze));
      add(fitLine(this.add.text(PAD + 14, y + 30, maxed ? `${d.title}: all five done` : d.text(goal), text.body(18, maxed ? PAL.muted : PAL.ivory)), bw - 150));
      if (!maxed) {
        add(fitLine(this.add.text(PAD + 14, y + 54, rewardText(TIER_REWARDS[done]) + (done === d.tiers.length - 1 ? ` + "${d.title}"` : ''), text.body(14, PAL.amber)), bw - 150));
        progressBar(this, PAD + 14, y + 80, bw - 170, have / goal, ready ? PAL.amber : 0xc9a24a, 6).forEach(add);
        add(this.add.text(PAD + bw - 148, y + 74, `${Math.min(have, goal)}/${goal}`, text.hud(11, PAL.steel)));
      }
      if (ready) {
        const b = makeButton(this, PAD + bw - 56, y + 56, 92, 40, 'Claim', () => !list.dragging && this.claim(d.id, refresh), { active: true, fontSize: 15 });
        list.content.add(b.all);
      }
      y += h + 8;
    }
    list.fit(y + 10);
    if (this.msg) toast(this, this.msg);
  }

  private claim(id: string | undefined, refresh: () => void) {
    const r: DeedClaim | undefined = claimDeeds(game.save, id);
    if (!r) return;
    commit();
    refresh();
    const msg = `Glory! ${rewardText(r.reward)}.${r.titles.length ? ` New title: "${r.titles[r.titles.length - 1]}"` : ''}`;
    this.scene.restart({ scroll: this.scroll, msg });
  }
}
