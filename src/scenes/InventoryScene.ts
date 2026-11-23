import { sfx } from '../audio/sfx';
import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { commit, game } from '../state/game';
import { FAMILIES, NO_REFINE, REFINE, countOf, itemDef, itemIds, refine, type ItemId } from '../systems/items';
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
    const { top } = modeScreen(this, 'Inventory', '');
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
    // two rows of four: LABEL value, so every label has room at phone size
    const cw = bw / 4;
    cur.forEach(([label, v, id], i) => {
      const x = PAD + cw * (i % 4) + cw / 2;
      const ry = top + Math.floor(i / 4) * 24;
      // tap a currency to see where it comes from
      if (id) tapForSources(this, this.add.zone(x, ry + 10, cw - 4, 24), id);
      const l = this.add.text(0, ry, label, text.hud(14, PAL.steel));
      const n = this.add.text(0, ry, v, text.hud(14, PAL.amber));
      const left = x - (l.width + 6 + n.width) / 2;
      l.setX(left);
      n.setX(left + l.width + 6);
    });

    // Materials, one row per family
    let y = top + 54;
    const cell = bw / 3;
    // rows shrink a little so every family fits above the tab bar
    const rowH = Math.min(84, Math.floor((GAME_H - TAB_BAR_H - 40 - y) / FAMILIES.length));
    const cellH = rowH - 24;
    for (const f of FAMILIES) {
      this.add.text(PAD, y, f.name.toUpperCase(), text.hud(12, f.color));
      this.add.text(GAME_W - PAD, y, f.use, text.body(13, PAL.muted)).setOrigin(1, 0);
      itemIds(f.id).forEach((id, i) => {
        const cx = PAD + cell * i;
        const cy = y + 18 + cellH / 2;
        const on = this.pick === id;
        const hit = this.add.rectangle(cx + cell / 2, cy, cell - 6, cellH, on ? 0x2a1d2b : 0x18111a).setStrokeStyle(1, on ? PAL.amber : PAL.armorShadow);
        hit.setInteractive({ useHandCursor: true }).on('pointerup', () => this.scene.restart({ pick: id }));
        drawItemIcon(this, cx + 30, cy, id, Math.min(50, cellH - 6));
        const n = countOf(save, id);
        // name may take two lines; the count sits on the icon like a stack badge
        this.add.text(cx + 60, cy, itemDef(id).name, { ...text.body(16, n ? PAL.ivory : PAL.steel), wordWrap: { width: cell - 66 }, lineSpacing: -4 }).setOrigin(0, 0.5);
        this.add.text(cx + 54, cy + cellH / 2 - 2, `×${n}`, { ...text.hud(14, n ? PAL.amber : PAL.steel), stroke: '#0b070c', strokeThickness: 4 }).setOrigin(1, 1);
      });
      y += rowH;
    }

    // The chosen material: what it is, and refining it
    if (!this.pick) {
      const room = GAME_H - TAB_BAR_H - y;
      this.add.text(GAME_W / 2, y + room / 2 - 4, `Tap a material to read it. ${REFINE} of a kind refine into one of the next.`, { ...text.body(16, PAL.muted), align: 'center', wordWrap: { width: bw - 20 } }).setOrigin(0.5);
    } else {
      // a sheet over the lower rows, with room for the flavour text and both buttons; tap outside to close
      const panelH = 210;
      const panelTop = GAME_H - TAB_BAR_H - panelH - 10;
      this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.55).setInteractive().on('pointerup', () => this.scene.restart({}));
      addFrame(this, GAME_W / 2, panelTop + panelH / 2, bw, panelH, { fill: 0x1e1520, edge: PAL.amber });
      this.add.zone(GAME_W / 2, panelTop + panelH / 2, bw, panelH).setInteractive();
      const d = itemDef(this.pick);
      const n = countOf(save, this.pick);
      this.add.text(PAD + 16, panelTop + 12, `${d.name}  ×${n}`, { ...text.display(20, 0xfff1d6), wordWrap: { width: bw - 180 } });
      const pick = this.pick;
      makeButton(this, GAME_W - PAD - 78, panelTop + 28, 136, 40, 'Where to get', () => showSources(this, pick), { fontSize: 15 });
      this.add.text(PAD + 16, panelTop + 56, d.flavor, { ...text.body(16, PAL.muted), fontStyle: 'italic', wordWrap: { width: bw - 32 } });
      if (NO_REFINE.includes(d.family)) {
        makeButton(this, GAME_W / 2, panelTop + panelH - 34, 280, 46, "Open the Saints' Armory", () => this.scene.start('Armory', { back: 'Inventory' }), { fontSize: 15, active: true });
      } else if (d.tier < 3) {
        const next = itemDef(`${d.family}${d.tier + 1}` as ItemId);
        const most = Math.floor(n / REFINE);
        const by = panelTop + panelH - 34;
        const go = (times: number) => () => {
          if (refine(save, this.pick!, times)) {
            sfx('forge');
            commit();
            this.scene.restart({ pick: this.pick, notice: `Refined into ${times} ${next.name}` });
          }
        };
        makeButton(this, PAD + 120, by, 220, 46, `Refine ${REFINE} → 1 ${next.name}`, go(1), { fontSize: 14, disabled: most < 1, active: most >= 1 });
        makeButton(this, GAME_W - PAD - 110, by, 200, 46, most > 1 ? `Refine all (${most})` : 'Refine all', go(most), { fontSize: 14, disabled: most < 2 });
      } else {
        this.add.text(PAD + 16, panelTop + panelH - 40, 'The holiest of its kind.', text.body(15, PAL.amber));
      }
    }
    if (this.notice) toast(this, this.notice);
  }
}
