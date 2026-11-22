import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { commit, game } from '../state/game';
import { FAMILIES, REFINE, countOf, itemDef, itemIds, refine, type ItemId } from '../systems/items';
import { MAX_GEAR } from '../systems/gear';
import { almsOf, giltOf } from '../systems/currency';
import { makeButton } from '../ui/button';
import { drawItemIcon } from '../ui/itemIcon';
import { modeScreen, toast } from '../ui/modeScreen';
import { TAB_BAR_H } from '../ui/tabBar';
import { showSources, tapForSources } from '../ui/sources';
import type { ResourceId } from '../systems/sources';
import { PAD, addFrame, text } from '../ui/theme';

/** The Inventory: currencies, every material by family, and refining five into one. */
export class InventoryScene extends Phaser.Scene {
  private pick?: ItemId;
  private notice?: string;

  constructor() {
    super('Inventory');
  }

  init(data: { pick?: ItemId; notice?: string }) {
    this.pick = data?.pick;
    this.notice = data?.notice;
  }

  create() {
    const save = game.save;
    const { top } = modeScreen(this, 'Inventory', 'Every relic, ash and page your Sisters have carried home.');
    const bw = GAME_W - PAD * 2;

    // Currencies
    const tokens = Object.values(save.owned).reduce((n, o) => n + (o.tokens ?? 0), 0);
    const shards = Object.values(save.shards ?? {}).reduce((n, v) => n + v, 0);
    const cur: [string, string, ResourceId?][] = [
      ['GILT', `${giltOf(save)}`, 'gilt'],
      ['SEALS', `${save.seals}`, 'seals'],
      ['TITHES', save.tithes.toLocaleString('en-US'), 'tithes'],
      ['ALMS', `${almsOf(save)}`, 'alms'],
      ['VOWS', `${tokens}`, 'vows'],
      ['STIGMATA', `${save.stigmata ?? 0}`, 'stigmata'],
      ['SHARDS', `${shards}`, 'shards'],
      ['GEAR', `${save.gear?.length ?? 0}/${MAX_GEAR}`],
    ];
    const cw = bw / cur.length;
    cur.forEach(([label, v, id], i) => {
      const x = PAD + cw * i + cw / 2;
      // tap a currency to see where it comes from
      if (id) tapForSources(this, this.add.zone(x, top + 18, cw - 4, 40), id);
      this.add.text(x, top, label, text.hud(10, PAL.steel)).setOrigin(0.5, 0);
      this.add.text(x, top + 16, v, text.hud(16, PAL.amber)).setOrigin(0.5, 0);
    });

    // Materials, one row per family
    let y = top + 50;
    const cell = bw / 3;
    const rowH = 92;
    for (const f of FAMILIES) {
      this.add.text(PAD, y, f.name.toUpperCase(), text.hud(12, f.color));
      this.add.text(GAME_W - PAD, y, f.use, text.body(13, PAL.muted)).setOrigin(1, 0);
      itemIds(f.id).forEach((id, i) => {
        const cx = PAD + cell * i;
        const cy = y + 52;
        const on = this.pick === id;
        const hit = this.add.rectangle(cx + cell / 2, cy, cell - 6, 64, on ? 0x2a1d2b : 0x18111a).setStrokeStyle(1, on ? PAL.amber : PAL.armorShadow);
        hit.setInteractive({ useHandCursor: true }).on('pointerup', () => this.scene.restart({ pick: id }));
        drawItemIcon(this, cx + 34, cy, id, 52);
        const n = countOf(save, id);
        this.add.text(cx + 66, cy - 20, itemDef(id).name, { ...text.body(13, n ? PAL.ivory : PAL.steel), wordWrap: { width: cell - 74 } }).setCrop(0, 0, cell - 74, 18);
        this.add.text(cx + 66, cy + 2, `×${n}`, text.hud(16, n ? PAL.amber : PAL.steel));
      });
      y += rowH;
    }

    // The chosen material: what it is, and refining it
    const panelTop = y + 4;
    const panelH = GAME_H - TAB_BAR_H - panelTop - 12;
    addFrame(this, GAME_W / 2, panelTop + panelH / 2, bw, panelH, { fill: 0x1e1520 });
    if (!this.pick) {
      this.add.text(GAME_W / 2, panelTop + panelH / 2, `Tap a material to read it. ${REFINE} of a kind refine into one of the next.`, { ...text.body(16, PAL.muted), align: 'center', wordWrap: { width: bw - 40 } }).setOrigin(0.5);
    } else {
      const d = itemDef(this.pick);
      const n = countOf(save, this.pick);
      this.add.text(PAD + 16, panelTop + 12, `${d.name}  ×${n}`, text.display(18, 0xfff1d6));
      const pick = this.pick;
      makeButton(this, GAME_W - PAD - 74, panelTop + 26, 128, 34, 'Where to get', () => showSources(this, pick), { fontSize: 13 });
      this.add.text(PAD + 16, panelTop + 40, d.flavor, { ...text.body(15, PAL.muted), fontStyle: 'italic', wordWrap: { width: bw - 32 } });
      if (d.tier < 3) {
        const next = itemDef(`${d.family}${d.tier + 1}` as ItemId);
        const most = Math.floor(n / REFINE);
        const by = panelTop + panelH - 32;
        const go = (times: number) => () => {
          if (refine(save, this.pick!, times)) {
            commit();
            this.scene.restart({ pick: this.pick, notice: `Refined into ${times} ${next.name}` });
          }
        };
        makeButton(this, PAD + 120, by, 220, 46, `Refine ${REFINE} → 1 ${next.name}`, go(1), { fontSize: 14, disabled: most < 1, active: most >= 1 });
        makeButton(this, GAME_W - PAD - 110, by, 200, 46, most > 1 ? `Refine all (${most})` : 'Refine all', go(most), { fontSize: 14, disabled: most < 2 });
      } else {
        this.add.text(PAD + 16, panelTop + panelH - 40, 'The highest of its kind.', text.body(15, PAL.amber));
      }
    }
    if (this.notice) toast(this, this.notice);
  }
}
