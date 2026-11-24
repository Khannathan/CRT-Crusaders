import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { ORDER_LIST } from '../data/orders';
import { commit, game } from '../state/game';
import { GRAND_SEALS, GRAND_SET, GRAND_TITLE, SETS, claimSet, claimable, orderCount, setClaimed, setHave, setOf, sistersOf, wearTitle } from '../systems/collection';
import { makeButton } from '../ui/button';
import { sigilKey } from '../ui/icons';
import { modeScreen } from '../ui/modeScreen';
import { portraitKey } from '../ui/placeholderPortrait';
import { addScrollArea } from '../ui/scroll';
import { holdForCard } from '../ui/sisterCard';
import { TAB_BAR_H } from '../ui/tabBar';
import { PAD, noOrphan, shrinkToFit, text } from '../ui/theme';

const CARD = 84;

/** Every Sister by Order: the sworn in colour, the rest as silhouettes under the Order's sigil. */
export class OrderBookScene extends Phaser.Scene {
  private scroll = 0;

  constructor() {
    super('OrderBook');
  }

  init(data: { scroll?: number }) {
    this.scroll = data.scroll ?? 0;
  }

  create() {
    const save = game.save;
    const { top, refresh } = modeScreen(this, 'Order Book', 'Collect an Order\'s R and SR Sisters for Seals and a title.');
    const owned = Object.keys(save.owned).length;
    const total = ORDER_LIST.reduce((n, o) => n + orderCount(save, o.id).of, 0);

    // The worn title, and a way to change it.
    const titles = save.titles ?? [];
    this.add.text(PAD, top + 4, `${owned} of ${total} Sisters sworn`, text.body(17, PAL.muted));
    this.add.text(PAD, top + 30, titles.length ? `Title: ${save.title ?? 'none'}` : 'Finish a set to earn its title', text.body(16, titles.length ? PAL.amber : PAL.steel));
    if (titles.length) {
      makeButton(this, GAME_W - PAD - 60, top + 30, 120, 38, 'Change', () => {
        const all: (string | undefined)[] = [...titles, undefined];
        wearTitle(save, all[(all.indexOf(save.title) + 1) % all.length]);
        commit();
        this.scene.restart({ scroll: this.scroll });
      }, { fontSize: 15 });
    }

    const listTop = top + 60;
    const list = addScrollArea(this, listTop, GAME_H - TAB_BAR_H - 6, { start: this.scroll, onScroll: (y) => (this.scroll = y) });
    let y = listTop + 6;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (list.content.add(o), o);

    // The grand set: every Order's set claimed.
    const grandClaimed = setClaimed(save, GRAND_SET);
    const grandReady = claimable(save).includes(GRAND_SET);
    const doneSets = SETS.filter((s) => setClaimed(save, s.id)).length;
    add(this.add.rectangle(GAME_W / 2, y + 28, GAME_W - PAD * 2, 56, 0x241925).setStrokeStyle(1, grandReady ? PAL.amber : PAL.armorShadow));
    add(this.add.text(PAD + 12, y + 16, GRAND_TITLE, text.body(18, PAL.ivory)).setOrigin(0, 0.5));
    add(this.add.text(PAD + 12, y + 40, grandClaimed ? 'Claimed' : `${doneSets} of ${SETS.length} Order sets  ·  ${GRAND_SEALS} Seals and a title`, text.body(14, PAL.steel)).setOrigin(0, 0.5));
    if (grandReady) this.claimButton(list, GAME_W - PAD - 58, y + 28, GRAND_SET, refresh);
    y += 72;

    for (const o of ORDER_LIST) {
      const set = setOf(o.id);
      const { have, of } = orderCount(save, o.id);
      if (this.textures.exists(sigilKey(o.id))) add(this.add.image(PAD + 18, y + 18, sigilKey(o.id)).setDisplaySize(36, 36).setAlpha(have ? 1 : 0.45));
      add(this.add.text(PAD + 44, y + 18, o.name, text.display(21, have ? 0xfff1d6 : PAL.muted)).setOrigin(0, 0.5));
      add(this.add.text(GAME_W - PAD, y + 18, `${have} / ${of}`, text.hud(14, have === of ? PAL.amber : PAL.steel)).setOrigin(1, 0.5));
      y += 42;
      // Its creed, what its god demands, and the Order it feuds with.
      const creed = add(this.add.text(PAD + 4, y, `"${o.creed}"`, { ...text.body(17, PAL.amber), fontStyle: 'italic', wordWrap: { width: GAME_W - PAD * 2 - 8 } }));
      y += creed.height + 4;
      const lore = add(this.add.text(PAD + 4, y, noOrphan(o.lore), { ...text.body(14, PAL.muted), wordWrap: { width: GAME_W - PAD * 2 - 8 }, lineSpacing: 1 }));
      y += lore.height + 4;
      add(this.add.text(PAD + 4, y, `SWORN RIVAL · ${o.rival.toUpperCase()}`, text.hud(12, 0xd06060)));
      y += 28;

      const sisters = sistersOf(o.id);
      const gap = (GAME_W - PAD * 2 - CARD * 5) / 4;
      sisters.forEach((c, i) => {
        const x = PAD + CARD / 2 + i * (CARD + gap);
        const cy = y + CARD / 2;
        const sworn = !!save.owned[c.id];
        const col = RARITY_COLOR[c.rarity];
        add(this.add.rectangle(x, cy, CARD + 4, CARD + 4, 0x000000).setStrokeStyle(2, sworn ? col : 0x3a2e38));
        const img = add(this.add.image(x, cy, portraitKey(c.id)).setDisplaySize(CARD, CARD));
        if (!sworn) {
          // Silhouette: the art in shadow, the Order's sigil over it.
          img.setTintFill(0x120c12);
          if (this.textures.exists(sigilKey(o.id))) add(this.add.image(x, cy, sigilKey(o.id)).setDisplaySize(40, 40).setAlpha(0.5));
        }
        holdForCard(this, img, c.id);
        if (set.members.includes(c.id)) add(this.add.text(x + CARD / 2 - 3, cy - CARD / 2 + 3, 'SET', { ...text.hud(10, sworn ? PAL.amber : PAL.steel), backgroundColor: '#1b121c', padding: { x: 3, y: 1 } }).setOrigin(1, 0));
        add(shrinkToFit(this.add.text(x, cy + CARD / 2 + 12, c.name.split(' ')[0], text.body(14, sworn ? PAL.ivory : PAL.steel)).setOrigin(0.5), CARD + gap - 4));
        add(this.add.text(x, cy + CARD / 2 + 28, c.rarity, text.hud(11, sworn ? col : PAL.steel)).setOrigin(0.5));
      });
      y += CARD + 44;

      // The Order's set: its R and SR Sisters.
      const n = setHave(save, set);
      const claimed = setClaimed(save, set.id);
      const ready = claimable(save).includes(set.id);
      add(this.add.text(PAD + 4, y + 2, `${set.name}  ${n}/${set.members.length}`, text.body(15, ready ? PAL.amber : PAL.muted)).setOrigin(0, 0.5));
      add(this.add.text(PAD + 4, y + 22, claimed ? `Claimed · "${set.title}"` : `${set.seals} Seals and the title "${set.title}"`, text.body(13, PAL.steel)).setOrigin(0, 0.5));
      if (ready) this.claimButton(list, GAME_W - PAD - 58, y + 12, set.id, refresh);
      y += 44;
      add(this.add.rectangle(GAME_W / 2, y, GAME_W - PAD * 2, 1, PAL.armorShadow));
      y += 14;
    }
    list.fit(y + 10);
  }

  private claimButton(list: ReturnType<typeof addScrollArea>, x: number, y: number, id: string, refresh: () => void) {
    const b = makeButton(this, x, y, 110, 40, 'Claim', () => {
      if (list.dragging) return;
      const seals = claimSet(game.save, id);
      if (!seals) return;
      commit();
      refresh();
      this.scene.restart({ scroll: this.scroll });
    }, { active: true, fontSize: 16 });
    list.content.add(b.all);
  }
}
