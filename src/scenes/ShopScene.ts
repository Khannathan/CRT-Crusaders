import Phaser from 'phaser';
import { drawOfferingIcon } from '../ui/offeringIcon';
import { tapForSources } from '../ui/sources';
import { GAME_W, PAL } from '../config';
import { commit, game } from '../state/game';
import { almsOf, giltOf } from '../systems/currency';
import type { ItemId } from '../systems/items';
import { vowCandidates } from '../systems/matins';
import { REFRESH_GILT, buy, buyBlock, goodsText, leftOf, offersAt, refreshAlmonry, refreshCost, type Counter, type Offer } from '../systems/shop';
import { makeButton } from '../ui/button';
import { drawItemIcon } from '../ui/itemIcon';
import { modeScreen, toast, untilText } from '../ui/modeScreen';
import { pickParty } from '../ui/partyPicker';
import { PAD, addFrame, addIcon, text } from '../ui/theme';

const COUNTERS: [Counter, string, string][] = [
  ['gilt', 'Gilt', 'Limits reset daily.'],
  ['almonry', 'Almonry', 'New each dawn. One free refresh a day.'],
  ['tithes', 'Tithes', 'Limits reset each Monday.'],
];

const PRICE_ICON = { gilt: 'gilt', alms: 'alms', tithes: 'tithe' } as const;

/** The Shop: Gilt, the Almonry (Alms) and the Tithe Exchange. */
export class ShopScene extends Phaser.Scene {
  private counter: Counter = 'gilt';
  private notice?: string;

  constructor() {
    super('Shop');
  }

  init(data: { counter?: Counter; notice?: string }) {
    this.counter = data?.counter ?? this.counter;
    this.notice = data?.notice;
  }

  create() {
    const save = game.save;
    const { top, refresh } = modeScreen(this, 'The Market', '');
    const bw = GAME_W - PAD * 2;
    const tw = bw / 3;
    COUNTERS.forEach(([id, label], i) => {
      makeButton(this, PAD + tw / 2 + i * tw, top + 20, tw - 8, 44, label, () => id !== this.counter && this.scene.restart({ counter: id }), {
        active: id === this.counter,
        fontSize: 17,
        skin: 'ui-subtab',
      });
    });
    let y = top + 56;
    const desc = COUNTERS.find(([id]) => id === this.counter)![2];
    this.add.text(PAD, y, desc, { ...text.body(15, PAL.muted), wordWrap: { width: bw } });
    y += 26;
    // tap any of the three to see where it comes from
    let px = PAD;
    for (const [label, v, id] of [['GILT', giltOf(save), 'gilt'], ['ALMS', almsOf(save), 'alms'], ['TITHES', save.tithes, 'tithes']] as const) {
      const t = tapForSources(this, this.add.text(px, y, `${label} ${v.toLocaleString('en-US')}`, text.hud(13, PAL.amber)), id);
      px += t.width + 22;
    }

    if (this.counter === 'almonry') {
      const cost = refreshCost(save);
      const tomorrow = new Date();
      tomorrow.setHours(24, 0, 0, 0);
      this.add.text(GAME_W - PAD, y - 24, `NEW STOCK IN ${untilText(tomorrow.getTime() - Date.now())}`, text.hud(11, PAL.muted)).setOrigin(1, 0);
      makeButton(this, GAME_W - PAD - 80, y + 6, 160, 34, cost ? `Refresh · ${REFRESH_GILT} Gilt` : 'Refresh · free', () => {
        if (refreshAlmonry(save)) {
          commit();
          this.scene.restart({ counter: 'almonry', notice: 'The almoner lays out new wares!' });
        }
      }, { fontSize: 13, disabled: giltOf(save) < cost });
    }
    y += 30;

    // Offer cards, two columns
    const cw = (bw - 10) / 2;
    const ch = 118;
    offersAt(save, this.counter).forEach((o, i) => {
      const x = PAD + (i % 2) * (cw + 10);
      const cy = y + Math.floor(i / 2) * (ch + 10);
      this.card(o, x, cy, cw, ch, refresh);
    });
    if (this.notice) toast(this, this.notice);
  }

  private card(o: Offer, x: number, y: number, w: number, h: number, refresh: () => void) {
    const save = game.save;
    const left = leftOf(save, o);
    const block = buyBlock(save, o);
    addFrame(this, x + w / 2, y + h / 2, w, h, { fill: left ? 0x1e1520 : 0x150f17, edge: left ? PAL.goldEdge : PAL.armorShadow });
    // the goods' icon
    const ix = x + 34;
    const iy = y + 40;
    const ids = Object.keys(o.goods.items ?? {}) as ItemId[];
    if (o.goods.offering) drawOfferingIcon(this, ix, iy, o.goods.offering, 48);
    else if (ids.length === 1) drawItemIcon(this, ix, iy, ids[0], 48);
    else {
      this.add.rectangle(ix, iy, 48, 48, 0x150e17).setStrokeStyle(1, PAL.armorShadow);
      addIcon(this, ix, iy, o.goods.seals ? 'seal' : o.goods.vowToken ? 'vow' : o.goods.gear ? 'shield' : 'flame', 30, o.goods.seals ? 0xd87988 : PAL.amber);
    }
    this.add.text(x + 66, y + 14, o.name, { ...text.body(15, PAL.ivory), wordWrap: { width: w - 76 } });
    const period = o.currency === 'tithes' ? 'this week' : 'today';
    this.add.text(x + 66, y + 54, left ? `${left} left ${period}` : `Sold out ${period}`, text.hud(11, left ? PAL.muted : 0xe58a8a));
    const label = `${o.price.toLocaleString('en-US')}`;
    makeButton(this, x + w / 2, y + h - 24, w - 20, 36, label, () => this.purchase(o, refresh), {
      fontSize: 16,
      icon: PRICE_ICON[o.currency],
      disabled: !!block,
      active: !block,
    });
    // short of the price: tapping it says where to earn more
    if (block?.startsWith('Not enough')) tapForSources(this, this.add.zone(x + w / 2, y + h - 24, w - 20, 36), o.currency);
  }

  private purchase(o: Offer, _refresh: () => void) {
    const save = game.save;
    const done = (sister?: string) => {
      const got = buy(save, o, { sister });
      if (!got) return;
      commit();
      this.scene.restart({ counter: this.counter, notice: `Bought: ${got.gear ? `${got.gear.name} (${got.gear.rarity})` : goodsText(o.goods)}` });
    };
    if (!o.goods.vowToken) return done();
    const can = new Set(vowCandidates(save).map((c) => c.id));
    if (!can.size) {
      toast(this, 'Every Sister has taken all her Vows!');
      return;
    }
    pickParty(this, save, { title: 'A Vow token for…', sub: 'Choose the Sister who receives it.', initial: [], max: 1, allow: (c) => can.has(c.id), why: 'Her Vows are full', confirm: 'Bestow' }, (ids) => ids[0] && done(ids[0]));
  }
}
