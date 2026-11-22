import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { commit, game } from '../state/game';
import { countOf, itemDef, itemIds, type ItemId } from '../systems/items';
import { ORDER_LIST } from '../data/orders';
import { CODEX_STEP, MAX_CODEX, codexBlock, codexBonus, codexLevel, nextCodexCost, raiseCodex, sworn } from '../systems/codex';
import { sigilKey } from '../ui/icons';
import { BRANCHES, RELICS, consecrate, isLit, litOf, relic, relicBlock, relicBonusText, reliquaryBonus, type RelicNode } from '../systems/reliquary';
import { makeButton } from '../ui/button';
import { drawItemIcon } from '../ui/itemIcon';
import { modeScreen, toast } from '../ui/modeScreen';
import { TAB_BAR_H } from '../ui/tabBar';
import { PAD, addArt, addFrame, text } from '../ui/theme';

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

/** The Reliquary: three branches of relics lit with Incense, then the Crown. Every relic lifts every Sister. */
export class ReliquaryScene extends Phaser.Scene {
  private pick?: string;
  private notice?: string;
  private tab: 'relics' | 'codex' = 'relics';

  constructor() {
    super('Reliquary');
  }

  init(data: { pick?: string; notice?: string; tab?: 'relics' | 'codex' }) {
    this.pick = data?.pick;
    this.notice = data?.notice;
    this.tab = data?.tab ?? 'relics';
  }

  create() {
    const save = game.save;
    const codex = this.tab === 'codex';
    const { top: head } = modeScreen(this, codex ? 'Order Codex' : 'The Reliquary', codex ? 'Writs raise an Order. Each level lifts its Sisters.' : 'Incense lights the relics. Each one lifts every Sister.');
    const bw = GAME_W - PAD * 2;
    (['relics', 'codex'] as const).forEach((t, i) => {
      makeButton(this, GAME_W / 2 + (i - 0.5) * 200, head + 14, 190, 40, t === 'relics' ? 'Relics' : 'Order Codex', () => t !== this.tab && this.scene.restart({ tab: t }), { active: t === this.tab, fontSize: 16, skin: 'ui-subtab' });
    });
    const top = head + 52;
    if (codex) {
      this.codexTab(top);
      if (this.notice) toast(this, this.notice);
      return;
    }

    // What the lit relics give, and the Incense on hand
    const total = relicBonusText(reliquaryBonus(save));
    this.add.text(GAME_W / 2, top, total ? `All Sisters: ${total}` : 'No relic lit yet.', { ...text.body(16, total ? PAL.amber : PAL.muted), align: 'center', wordWrap: { width: bw } }).setOrigin(0.5, 0);
    itemIds('incense').forEach((id, i) => {
      const x = GAME_W / 2 + (i - 1) * 150;
      drawItemIcon(this, x - 36, top + 38, id, 26);
      this.add.text(x - 16, top + 38, `${countOf(save, id)} ${itemDef(id).name}`, text.body(14, PAL.ivory)).setOrigin(0, 0.5);
    });

    // The tree: three columns of five, the Crown beneath
    const colW = bw / 3;
    const y0 = top + 132;
    const gap = 66;
    const r = 25;
    const nodeAt = (n: RelicNode) =>
      n.branch === 'crown' ? { x: GAME_W / 2, y: y0 + 5 * gap + 6 } : { x: PAD + colW * BRANCHES.findIndex((b) => b.id === n.branch) + colW / 2, y: y0 + n.step * gap };
    BRANCHES.forEach((b, i) => {
      const x = PAD + colW * i + colW / 2;
      this.add.text(x, y0 - 50, b.name.toUpperCase(), text.hud(14, b.color)).setOrigin(0.5);
      this.add.text(x, y0 - 32, b.hint, text.body(12, PAL.muted)).setOrigin(0.5);
      this.add.rectangle(x, y0 + 2 * gap, 3, 4 * gap, isLit(save, `${b.id}1`) ? b.color : PAL.armorShadow, 0.5);
      // each column leads down to the Crown
      const g = this.add.graphics().lineStyle(2, isLit(save, `${b.id}5`) ? b.color : PAL.armorShadow, 0.5);
      g.lineBetween(x, y0 + 4 * gap, GAME_W / 2, y0 + 5 * gap + 6);
    });
    for (const n of RELICS) {
      const { x, y } = nodeAt(n);
      const lit = isLit(save, n.id);
      const color = n.branch === 'crown' ? PAL.amber : BRANCHES.find((b) => b.id === n.branch)!.color;
      const ready = !relicBlock(save, n.id);
      const on = this.pick === n.id;
      const size = n.branch === 'crown' ? r + 6 : r;
      const disc = this.add.circle(x, y, size, lit ? color : 0x18111a).setStrokeStyle(on ? 4 : 2, on ? 0xfff1d6 : ready ? PAL.amber : lit ? color : PAL.armorShadow);
      disc.setInteractive({ useHandCursor: true }).on('pointerup', () => this.scene.restart({ pick: n.id }));
      // relic-<id>.png (64 x 64) over the disc when present
      const art = addArt(this, `relic-${n.id}`, x, y, size * 2 - 8);
      if (art) art.setAlpha(lit ? 1 : 0.45);
      else this.add.text(x, y, n.branch === 'crown' ? '♛' : ROMAN[n.step], text.hud(n.branch === 'crown' ? 22 : 15, lit ? 0x140d14 : ready ? PAL.amber : PAL.steel)).setOrigin(0.5);
      if (ready) this.tweens.add({ targets: disc, scale: 1.08, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    // The chosen relic
    const panelTop = y0 + 5 * gap + 50;
    const panelH = GAME_H - TAB_BAR_H - panelTop - 12;
    addFrame(this, GAME_W / 2, panelTop + panelH / 2, bw, panelH, { fill: 0x1e1520 });
    const lit = litOf(save).length;
    if (!this.pick) {
      this.add
        .text(GAME_W / 2, panelTop + panelH / 2, `${lit} of ${RELICS.length} relics lit. Tap a relic to read it. Each branch is lit in order, and the Crown needs all fifteen.`, {
          ...text.body(16, PAL.muted),
          align: 'center',
          wordWrap: { width: bw - 40 },
        })
        .setOrigin(0.5);
    } else {
      const n = relic(this.pick);
      const block = relicBlock(save, n.id);
      const done = isLit(save, n.id);
      this.add.text(PAD + 16, panelTop + 12, n.name, text.display(18, 0xfff1d6));
      this.add.text(PAD + 16, panelTop + 42, `Every Sister: ${relicBonusText(n.bonus)}`, text.body(16, PAL.amber));
      if (!done) {
        const cost = (Object.entries(n.items) as [ItemId, number][]).map(([id, k]) => `${k} ${itemDef(id).name} (${countOf(save, id)})`);
        this.add.text(PAD + 16, panelTop + 68, `Cost: ${[...cost, `${n.tithes.toLocaleString('en-US')} Tithes`].join(' · ')}`, { ...text.body(14, PAL.muted), wordWrap: { width: bw - 32 } });
      }
      makeButton(this, GAME_W / 2, panelTop + panelH - 32, 280, 46, done ? 'Lit' : block ?? 'Consecrate', () => {
        if (consecrate(save, n.id)) {
          commit();
          this.scene.restart({ pick: n.id, notice: `${n.name} is lit. ${relicBonusText(n.bonus)} for every Sister.` });
        }
      }, { fontSize: 16, disabled: !!block, active: !block });
    }
    if (this.notice) toast(this, this.notice);
  }

  /** Ten Orders, one row each: level, what it gives, and raising it with Writs. */
  private codexTab(top: number) {
    const save = game.save;
    const bw = GAME_W - PAD * 2;
    const own = itemIds('writ')
      .map((id) => `${countOf(save, id)} ${itemDef(id).name}`)
      .join(' · ');
    this.add.text(GAME_W / 2, top, `You hold ${own}`, text.body(14, PAL.muted)).setOrigin(0.5, 0);
    const rowH = 64;
    const y0 = top + 28;
    ORDER_LIST.forEach((o, i) => {
      const y = y0 + i * rowH + rowH / 2;
      const lv = codexLevel(save, o.id);
      const n = sworn(save, o.id);
      const cost = nextCodexCost(save, o.id);
      const block = codexBlock(save, o.id);
      this.add.rectangle(GAME_W / 2, y, bw, rowH - 6, 0x1b131d).setStrokeStyle(1, lv ? o.color : PAL.armorShadow);
      if (this.textures.exists(sigilKey(o.id))) this.add.image(PAD + 28, y, sigilKey(o.id)).setDisplaySize(40, 40).setAlpha(n ? 1 : 0.4);
      this.add.text(PAD + 56, y - 24, o.name, { ...text.body(17, n ? PAL.ivory : PAL.steel), fontStyle: '600' });
      this.add.text(PAD + 56, y - 3, `LV ${lv}/${MAX_CODEX}${lv ? ` · +${pct(codexBonus(save, o.id))} ATK, HP, ARM` : ''} · ${n} SWORN`, text.hud(11, lv ? PAL.amber : PAL.steel));
      if (cost) {
        const items = (Object.entries(cost.items) as [ItemId, number][]).map(([id, k]) => `${k} ${itemDef(id).name}`);
        this.add.text(PAD + 56, y + 12, [...items, `${cost.tithes.toLocaleString('en-US')} T`].join(' · '), text.body(12, PAL.muted));
      }
      makeButton(this, GAME_W - PAD - 58, y, 104, 40, cost ? `Lv ${lv + 1}` : 'Complete', () => {
        if (raiseCodex(save, o.id)) {
          commit();
          this.scene.restart({ tab: 'codex', notice: `${o.name} rises to level ${lv + 1}. Its Sisters gain ${pct(CODEX_STEP)} ATK, HP and armor.` });
        }
      }, { fontSize: 15, disabled: !!block, active: !block });
    });
  }
}
