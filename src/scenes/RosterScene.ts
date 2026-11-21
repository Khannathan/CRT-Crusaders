import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { CLASSES, RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { ORDERS } from '../data/orders';
import { CLASS_SKILLS } from '../data/skills';
import { VOW_UPGRADES } from '../systems/combat';
import type { CrusaderDef } from '../data/types';
import { commit, game } from '../state/game';
import { MAX_VOW, RARITY_ORDER, takeVow } from '../systems/gacha';
import {
  GEAR_SLOTS,
  MAX_GEAR_LEVEL,
  SLOT_HINT,
  SLOT_NAME,
  enhance,
  enhanceCost,
  equip,
  equipped,
  formatStat,
  gearBonus,
  gearOf,
  mainValue,
  salvage,
  salvageValue,
  unequip,
  type GearSlot,
} from '../systems/gear';
import { MAX_LEVEL, levelUpCost, sisterStats, vowCost } from '../systems/stats';
import { makeButton } from '../ui/button';
import { CURRENCY_BAR_H, addCurrencyBar } from '../ui/currencyBar';
import { portraitKey } from '../ui/placeholderPortrait';
import { addTabBar } from '../ui/tabBar';
import { PAD, addBackdrop, addBadge, addFrame, addHeading, addIcon, addScreenGlow, text } from '../ui/theme';

type Tab = 'oath' | 'skills' | 'gear';

/** Every Sister: sworn ones first (highest rarity first), the rest as silhouettes. */
export class RosterScene extends Phaser.Scene {
  private openId?: string;
  private tab: Tab = 'oath';

  constructor() {
    super('Roster');
  }

  init(data: { openId?: string; tab?: Tab }) {
    this.openId = data?.openId;
    this.tab = data?.tab ?? 'oath';
  }

  create() {
    addScreenGlow(this);
    addCurrencyBar(this);
    const owned = game.save.owned;
    const count = Object.keys(owned).length;
    const top = addHeading(this, 'Roster', CURRENCY_BAR_H + 10);
    this.add.text(GAME_W - PAD, top - 8, `${count} / ${CRUSADERS.length}`, text.hud(16, PAL.muted)).setOrigin(1, 1);

    const sorted = [...CRUSADERS].sort(
      (a, b) =>
        Number(!!owned[b.id]) - Number(!!owned[a.id]) ||
        RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity),
    );

    // Cards as in the preview: portrait, rarity badge, name and level underneath.
    const cols = 3;
    const gap = 9;
    const cw = (GAME_W - PAD * 2 - gap * (cols - 1)) / cols;
    const ph = 128;
    const ch = ph + 46;
    const y0 = top + 12;
    const party = new Set(game.save.lastParty);
    sorted.forEach((c, i) => {
      const left = PAD + (i % cols) * (cw + gap);
      const topY = y0 + Math.floor(i / cols) * (ch + gap);
      const x = left + cw / 2;
      const have = owned[c.id];
      const tint = RARITY_COLOR[c.rarity];
      const card = this.add.rectangle(x, topY + ch / 2, cw, ch, have ? 0x1e1620 : 0x151017).setStrokeStyle(1, PAL.armorShadow);
      if (have) {
        addBackdrop(this, portraitKey(c.id), x, topY + ph / 2, cw, ph, { fade: 0, focusY: 0.3 });
        this.add.rectangle(x, topY + ph, cw, 1, tint);
        addBadge(this, left + 4, topY + 4, c.rarity, tint, 12);
        if (party.has(c.id)) {
          this.add.rectangle(left + cw - 4, topY + 4, 22, 22, 0x170e15).setOrigin(1, 0).setStrokeStyle(1, 0x695045);
          addIcon(this, left + cw - 15, topY + 15, 'shield', 14, PAL.amber);
        }
        this.add.text(left + 8, topY + ph + 5, c.name.split(' ')[0], { ...text.body(19, PAL.ivory), fontStyle: '600' });
        this.add.text(left + 8, topY + ph + 28, `LV ${have.level}${have.vow ? `  VOW ${have.vow}` : ''}`, text.hud(12, PAL.muted));
        if (have.tokens) addBadge(this, left + cw - 40, topY + ph - 26, `+${have.tokens}`, PAL.amber, 12);
      } else {
        const g = this.add.graphics();
        for (let r = 8; r > 0; r--) g.fillStyle(0x291c2b, 0.16).fillCircle(x, topY + ph / 2, (r / 8) * 80);
        addIcon(this, x, topY + ph / 2, 'lock', 30, 0x967b8e);
        this.add.rectangle(x, topY + ph, cw, 1, PAL.armorShadow);
        this.add.text(left + 8, topY + ph + 5, 'Unknown', { ...text.body(19, PAL.muted), fontStyle: '600' });
        this.add.text(left + 8, topY + ph + 28, 'UNSWORN', text.hud(12, PAL.steel));
      }
      card.setInteractive({ useHandCursor: true });
      this.children.bringToTop(card);
      card.setFillStyle(0x000000, 0.001);
      card.on('pointerup', () => this.showDetail(c));
    });

    addTabBar(this, 'Roster');

    const reopen = CRUSADERS.find((c) => c.id === this.openId);
    if (reopen) this.showDetail(reopen, this.tab);
  }


  private reopen(c: CrusaderDef, tab: Tab) {
    this.scene.restart({ openId: c.id, tab });
  }

  private showDetail(c: CrusaderDef, tab: Tab = 'oath') {
    const layer = this.add.container(0, 0).setDepth(10);
    const have = game.save.owned[c.id];
    const cls = CLASSES[c.classId];
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 80 } };
    const shade = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.9).setInteractive();
    const panel = addFrame(this, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 });
    const size = have ? 180 : 256;
    const py = have ? 134 : 200;
    const frame = this.add.rectangle(GAME_W / 2, py, size + 10, size + 10, 0x150e17).setStrokeStyle(1, have ? RARITY_COLOR[c.rarity] : PAL.armorShadow);
    const img = this.add.image(GAME_W / 2, py, portraitKey(c.id)).setDisplaySize(size, size);
    layer.add([shade, ...panel, frame, img]);

    const close = makeButton(this, GAME_W / 2, GAME_H - 62, 220, 60, 'Close', () => layer.destroy(), { fontSize: 19 });

    if (!have) {
      img.setTint(0x111111);
      layer.add([
        this.add.text(GAME_W / 2, 370, 'Not yet sworn', { ...style, fontSize: '26px' }).setOrigin(0.5),
        this.add.text(GAME_W / 2, 410, `${c.rarity} · ${c.title ?? cls.name} · ${c.order}`, { ...style, fontSize: '18px', color: hex(PAL.steel) }).setOrigin(0.5),
        this.add.text(GAME_W / 2, 470, 'Her seal waits unbroken at the Altar.', { ...style, fontSize: '18px', color: hex(PAL.steel) }).setOrigin(0.5),
        ...close.all,
      ]);
      return;
    }

    layer.add([
      this.add.text(GAME_W / 2, 248, c.name.toUpperCase(), { ...style, ...text.display(24, 0xfff1d6) }).setOrigin(0.5),
      this.add.text(GAME_W / 2, 280, `${c.rarity} · ${c.title ?? cls.name} · ${cls.role}`, { ...style, fontSize: '17px', color: hex(RARITY_COLOR[c.rarity]) }).setOrigin(0.5),
      this.add.text(GAME_W / 2, 304, `${c.order}${c.title && c.title !== cls.name ? ` · fights as ${cls.name}` : ''} · age ${c.age}`, { ...style, fontSize: '15px', color: hex(PAL.steel) }).setOrigin(0.5),
    ]);
    const tabs: [Tab, string][] = [
      ['oath', 'Oath'],
      ['skills', 'Skills'],
      ['gear', 'Gear'],
    ];
    const tw = (GAME_W - 60) / 3;
    tabs.forEach(([id, label], i) => {
      const b = makeButton(this, 30 + tw / 2 + i * tw, 346, tw - 8, 46, label, () => id !== tab && this.reopen(c, id), { active: id === tab, fontSize: 18 });
      layer.add(b.all);
    });

    if (tab === 'oath') this.oathTab(layer, c, style);
    else if (tab === 'skills') this.skillsTab(layer, c);
    else this.gearTab(layer, c);
    layer.add(close.all);
  }

  private oathTab(layer: Phaser.GameObjects.Container, c: CrusaderDef, style: Phaser.Types.GameObjects.Text.TextStyle) {
    const save = game.save;
    const have = save.owned[c.id];
    const cls = CLASSES[c.classId];
    const st = sisterStats(save, c);
    layer.add([
      this.add.text(GAME_W / 2, 404, `Level ${have.level} / ${MAX_LEVEL}`, { ...style, fontSize: '22px', color: hex(PAL.amber) }).setOrigin(0.5),
      this.add
        .text(GAME_W / 2, 438, `HP ${st.hp}  ATK ${st.atk}  ARM ${st.armor}  SPD ${st.spd}  CRIT ${Math.round(st.crit * 100)}%`, { ...style, fontSize: '17px' })
        .setOrigin(0.5),
    ]);
    // Vow pips: filled = taken, outlined amber = a token waiting to be taken.
    const tokens = have.tokens ?? 0;
    layer.add(this.add.text(GAME_W / 2 - 150, 484, 'Vows', { ...style, fontSize: '18px', color: hex(PAL.steel) }).setOrigin(0, 0.5));
    for (let v = 0; v < MAX_VOW; v++) {
      const taken = v < have.vow;
      const ready = !taken && v < have.vow + tokens;
      layer.add(this.add.circle(GAME_W / 2 - 50 + v * 40, 484, 12, taken ? PAL.oxblood : PAL.deepShadow).setStrokeStyle(2, taken || ready ? PAL.amber : PAL.armorShadow));
      if (ready) this.tweens.add({ targets: layer.list[layer.list.length - 1], alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    }
    const tokenLine = tokens
      ? `${tokens} Vow token${tokens > 1 ? 's' : ''} waiting. Each Vow: +5% stats.`
      : have.vow >= MAX_VOW
        ? 'Every Vow is taken. She is wholly given.'
        : 'Draw her again at the Altar to earn a Vow token.';
    const skills = CLASS_SKILLS[c.classId];
    const perks = VOW_UPGRADES.map(([v, i]) => `${have.vow >= v ? '✓ ' : ''}Vow ${v}: ${skills[i].name}+`).join('  ·  ');
    const order = ORDERS[c.order]?.tiers[0];
    layer.add([
      this.add.text(GAME_W / 2, 516, tokenLine, { ...style, fontSize: '16px', color: hex(tokens ? PAL.amber : PAL.muted) }).setOrigin(0.5),
      this.add.text(GAME_W / 2, 548, perks, { ...style, fontSize: '15px', color: hex(PAL.amber), wordWrap: { width: GAME_W - 70 } }).setOrigin(0.5),
      ...(order ? [this.add.text(GAME_W / 2, 590, `With another ${c.order}: ${order.desc}`, { ...style, fontSize: '15px', color: hex(PAL.muted) }).setOrigin(0.5)] : []),
      this.add.text(GAME_W / 2, 636, cls.summary, { ...style, fontSize: '18px' }).setOrigin(0.5),
      this.add.text(GAME_W / 2, 696, `"${c.hook}"`, { ...style, fontSize: '16px', fontStyle: 'italic', color: hex(PAL.steel) }).setOrigin(0.5),
    ]);

    const cost = levelUpCost(have.level);
    const maxed = have.level >= MAX_LEVEL;
    const canLevel = !maxed && save.tithes >= cost;
    const lvl = makeButton(
      this,
      GAME_W / 2 - 124,
      GAME_H - 150,
      236,
      76,
      maxed ? 'Max level' : `Level up\n${cost} Tithes`,
      () => {
        save.tithes -= cost;
        have.level += 1;
        commit();
        this.reopen(c, 'oath');
      },
      { disabled: !canLevel, active: canLevel, fontSize: 20 },
    );
    const vCost = vowCost(have.vow);
    const canVow = tokens > 0 && have.vow < MAX_VOW && save.tithes >= vCost;
    const vow = makeButton(
      this,
      GAME_W / 2 + 124,
      GAME_H - 150,
      236,
      76,
      have.vow >= MAX_VOW ? 'Vows complete' : `Take Vow\n1 token · ${vCost} Tithes`,
      () => {
        if (takeVow(save, c.id, vCost)) {
          commit();
          this.reopen(c, 'oath');
        }
      },
      { disabled: !canVow, active: canVow, fontSize: 20 },
    );
    layer.add([...lvl.all, ...vow.all]);
  }

  private skillsTab(layer: Phaser.GameObjects.Container, c: CrusaderDef) {
    const have = game.save.owned[c.id];
    const skills = CLASS_SKILLS[c.classId];
    const ranks = (from: number[]) => (from.length ? `RANK${from.length > 1 ? 'S' : ''} ${from[0]}${from.length > 1 ? `-${from[from.length - 1]}` : ''}` : 'ANY RANK');
    const left = 40;
    const width = GAME_W - 80;
    let y = 386;
    skills.forEach((s, i) => {
      const up = VOW_UPGRADES.find(([, idx]) => idx === i);
      const isUp = !!up && have.vow >= up[0];
      const tag = [
        s.rite ? 'RITE · FULL ZEAL' : `SKILL ${['I', 'II', 'III'][i]} · ${ranks(s.from)}`,
        ...(s.cooldown ? [`COOLDOWN ${isUp ? s.cooldown - 1 : s.cooldown}`] : []),
        ...(up ? [isUp ? 'VOW UPGRADED +25%' : `VOW ${up[0]}: +25%`] : []),
      ].join(' · ');
      const name = this.add.text(left, y, `${s.name}${isUp ? '+' : ''}`, { ...text.body(21, s.rite ? PAL.amber : PAL.ivory), fontStyle: '600' });
      const t = this.add.text(left, y + 28, tag, text.hud(12, isUp ? PAL.amber : PAL.steel));
      const d = this.add.text(left, y + 46, s.desc, { ...text.body(16, PAL.muted), wordWrap: { width } });
      layer.add([name, t, d]);
      y += 52 + d.height + 14;
    });
    if (c.passive) {
      layer.add(this.add.rectangle(GAME_W / 2, y, width, 1, PAL.armorShadow));
      const name = this.add.text(left, y + 10, c.passive.name, { ...text.body(21, PAL.violet), fontStyle: '600' });
      const t = this.add.text(left, y + 38, `PASSIVE · ${c.rarity} ONLY`, text.hud(12, PAL.steel));
      const d = this.add.text(left, y + 56, c.passive.desc, { ...text.body(16, PAL.muted), wordWrap: { width } });
      layer.add([name, t, d]);
    }
  }

  private gearTab(layer: Phaser.GameObjects.Container, c: CrusaderDef) {
    const save = game.save;
    const worn = equipped(save, c.id);
    const bw = GAME_W - 56;
    const left = 28 + 14;
    GEAR_SLOTS.forEach((slot, i) => {
      const y = 438 + i * 122;
      const item = worn.find((g) => g.slot === slot);
      const edge = item ? RARITY_COLOR[item.rarity] : PAL.armorShadow;
      layer.add(this.add.rectangle(GAME_W / 2, y, bw, 112, 0x1b131d).setStrokeStyle(1, edge));
      layer.add(this.add.text(left, y - 46, `${SLOT_NAME[slot].toUpperCase()} · ${SLOT_HINT[slot].toUpperCase()}`, text.hud(12, PAL.steel)));
      if (item) {
        layer.add([
          this.add.text(left, y - 28, `${item.name}${item.level ? ` +${item.level}` : ''}`, { ...text.body(20, RARITY_COLOR[item.rarity]), fontStyle: '600' }),
          this.add.text(left, y + 0, `${item.rarity} · ${formatStat(item.main, mainValue(item))}`, text.body(16, PAL.ivory)),
          this.add.text(left, y + 22, item.subs.map((s) => formatStat(s.stat, s.value)).join('  ') || 'No substats', text.body(15, PAL.muted)),
        ]);
        const maxed = item.level >= MAX_GEAR_LEVEL;
        const cost = enhanceCost(item);
        const can = !maxed && save.tithes >= cost;
        const enh = makeButton(this, GAME_W - 104, y - 24, 128, 46, maxed ? 'Max' : `Enhance\n${cost} T`, () => {
          if (enhance(save, item)) {
            commit();
            this.reopen(c, 'gear');
          }
        }, { disabled: !can, active: can, fontSize: 16 });
        layer.add(enh.all);
      } else {
        layer.add(this.add.text(left, y - 18, 'Empty', text.body(20, PAL.steel)));
      }
      const change = makeButton(this, GAME_W - 104, y + 28, 128, 42, item ? 'Change' : 'Equip', () => this.gearPicker(c, slot), { fontSize: 16 });
      layer.add(change.all);
    });
    const b = gearBonus(worn);
    const parts = (Object.keys(b) as (keyof typeof b)[]).filter((k) => b[k] > 0).map((k) => formatStat(k, b[k]));
    layer.add(
      this.add
        .text(GAME_W / 2, 812, parts.length ? `Gear: ${parts.join('  ')}` : 'Crusades yield gear. Elites and bosses always do.', {
          ...text.body(16, parts.length ? PAL.amber : PAL.muted),
          align: 'center',
          wordWrap: { width: GAME_W - 70 },
        })
        .setOrigin(0.5),
    );
  }

  /** Every piece for one slot: tap to put it on her, or melt spare pieces for Tithes. */
  private gearPicker(c: CrusaderDef, slot: GearSlot) {
    const save = game.save;
    const layer = this.add.container(0, 0).setDepth(30);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.96).setInteractive());
    layer.add(addFrame(this, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 }));
    layer.add(this.add.text(GAME_W / 2, 64, `CHOOSE A ${SLOT_NAME[slot].toUpperCase()}`, text.display(22, PAL.ivory)).setOrigin(0.5));
    const rank = (r: string) => RARITY_ORDER.indexOf(r as never);
    const items = gearOf(save)
      .filter((g) => g.slot === slot)
      .sort((a, b) => Number(a.on === c.id) - Number(b.on === c.id) || Number(!!a.on) - Number(!!b.on) || rank(b.rarity) - rank(a.rarity) || b.level - a.level);
    const shown = items.slice(0, 7);
    if (!shown.length) layer.add(this.add.text(GAME_W / 2, 200, 'No pieces for this slot yet.\nCrusade, and the dead will provide.', { ...text.body(18, PAL.muted), align: 'center' }).setOrigin(0.5));
    shown.forEach((g, i) => {
      const y = 140 + i * 92;
      const row = this.add.rectangle(GAME_W / 2, y, GAME_W - 56, 84, 0x1b131d).setStrokeStyle(1, RARITY_COLOR[g.rarity]);
      row.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        equip(save, c.id, g.uid);
        commit();
        this.reopen(c, 'gear');
      });
      const wearer = g.on ? CRUSADERS.find((x) => x.id === g.on)?.name.split(' ')[0] : undefined;
      layer.add([
        row,
        this.add.text(42, y - 32, `${g.name}${g.level ? ` +${g.level}` : ''}`, { ...text.body(19, RARITY_COLOR[g.rarity]), fontStyle: '600' }),
        this.add.text(42, y - 8, `${g.rarity} · ${formatStat(g.main, mainValue(g))}${g.subs.length ? '  ·  ' + g.subs.map((s) => formatStat(s.stat, s.value)).join('  ') : ''}`, text.body(15, PAL.ivory)),
        this.add.text(42, y + 14, g.on === c.id ? 'Worn by her' : wearer ? `Worn by ${wearer}: tap to take it` : 'Tap to equip', text.hud(12, g.on === c.id ? PAL.amber : PAL.steel)),
      ]);
      if (!g.on) {
        const melt = makeButton(this, GAME_W - 92, y + 12, 104, 40, `Melt +${salvageValue(g)}`, () => {
          salvage(save, g.uid);
          commit();
          layer.destroy();
          this.gearPicker(c, slot);
        }, { fontSize: 14 });
        layer.add(melt.all);
      }
    });
    if (items.length > shown.length) layer.add(this.add.text(GAME_W / 2, 140 + 7 * 92 - 30, `+${items.length - shown.length} more`, text.body(16, PAL.muted)).setOrigin(0.5));
    const current = equipped(save, c.id).find((g) => g.slot === slot);
    const back = makeButton(this, GAME_W / 2 + (current ? 120 : 0), GAME_H - 62, 220, 60, 'Back', () => layer.destroy(), { fontSize: 19 });
    layer.add(back.all);
    if (current) {
      const off = makeButton(this, GAME_W / 2 - 120, GAME_H - 62, 220, 60, 'Take off', () => {
        unequip(save, current.uid);
        commit();
        this.reopen(c, 'gear');
      }, { fontSize: 19 });
      layer.add(off.all);
    }
  }
}
