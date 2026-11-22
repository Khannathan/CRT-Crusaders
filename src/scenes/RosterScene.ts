import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { CLASSES, RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { formatPower, gearPower, gearSwapDelta, sisterPower } from '../systems/power';
import { ORDERS, ORDER_LIST } from '../data/orders';
import type { SaveData } from '../state/save';
import { CLASS_SKILLS } from '../data/skills';
import { VOW_UPGRADES } from '../systems/combat';
import type { CrusaderDef } from '../data/types';
import { commit, game } from '../state/game';
import { MAX_VOW, RARITY_ORDER, takeVow } from '../systems/gacha';
import {
  GEAR_SLOTS,
  MAX_GEAR_LEVEL,
  MAX_REFINE,
  REROLL_COST,
  SUB_UPGRADE_LEVELS,
  SLOT_HINT,
  SLOT_NAME,
  enhance,
  enhanceBlock,
  enhanceCost,
  gearSet,
  ironText,
  refineIron,
  rerollBlock,
  rerollSubs,
  setText,
  setsWorn,
  equip,
  equipped,
  formatStat,
  gearBonus,
  gearOf,
  mainValue,
  salvage,
  salvageValue,
  unequip,
  type GearItem,
  type GearSlot,
} from '../systems/gear';
import { levelCap, levelUpCost, sisterStats, vowCost } from '../systems/stats';
import { ascend, ascendBlock, costLine, nextAscension } from '../systems/ascension';
import { ROMAN_RANK } from '../systems/rank';
import { countOf, itemDef } from '../systems/items';
import { MAX_SKILL_LEVEL, nextSkillStep, raiseSkill, skillBlock, skillLevels, stepText } from '../systems/skillLevels';
import { track } from '../systems/tasks';
import { makeButton } from '../ui/button';
import { CURRENCY_BAR_H, addCurrencyBar } from '../ui/currencyBar';
import { portraitKey } from '../ui/placeholderPortrait';
import { nine } from '../ui/skin';
import { TAB_BAR_H, addTabBar } from '../ui/tabBar';
import { PAD, addArt, addBackdrop, addBadge, addFrame, addHeading, addIcon, addScreenGlow, text } from '../ui/theme';

type Tab = 'oath' | 'skills' | 'gear';

export type SortKey = 'power' | 'level' | 'rarity' | 'class' | 'order' | 'name';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'power', label: 'Power' },
  { key: 'level', label: 'Level' },
  { key: 'rarity', label: 'Rarity' },
  { key: 'class', label: 'Class' },
  { key: 'order', label: 'Order' },
  { key: 'name', label: 'Name' },
];
const CLASS_ORDER = Object.keys(CLASSES);

/** Which Sisters the grid shows. Empty sets mean "any". */
interface RosterFilter {
  rarity: Set<string>;
  classId: Set<string>;
  order: Set<string>;
  unsworn: boolean;
}

/** Sworn first, then by the chosen key (strongest, highest or A to Z first). */
export function sortRoster(save: SaveData, list: CrusaderDef[], key: SortKey): CrusaderDef[] {
  const owned = save.owned;
  const pw = new Map(list.map((c) => [c.id, sisterPower(save, c)]));
  const rar = (c: CrusaderDef) => RARITY_ORDER.indexOf(c.rarity);
  const by: Record<SortKey, (a: CrusaderDef, b: CrusaderDef) => number> = {
    power: (a, b) => pw.get(b.id)! - pw.get(a.id)!,
    level: (a, b) => (owned[b.id]?.level ?? 0) - (owned[a.id]?.level ?? 0),
    rarity: (a, b) => rar(b) - rar(a),
    class: (a, b) => CLASS_ORDER.indexOf(a.classId) - CLASS_ORDER.indexOf(b.classId),
    order: (a, b) => ORDER_LIST.findIndex((o) => o.name === a.order) - ORDER_LIST.findIndex((o) => o.name === b.order),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return [...list].sort(
    (a, b) => Number(!!owned[b.id]) - Number(!!owned[a.id]) || by[key](a, b) || rar(b) - rar(a) || pw.get(b.id)! - pw.get(a.id)! || a.name.localeCompare(b.name),
  );
}

/** Every Sister: sworn ones first (highest rarity first), the rest as silhouettes. */
export class RosterScene extends Phaser.Scene {
  private openId?: string;
  private tab: Tab = 'oath';
  /** Kept across restarts so levelling up a Sister doesn't jump the list back to the top. */
  private static scrollY = 0;
  /** Sort and filter, kept while the game runs. */
  private static sortKey: SortKey = 'power';
  private static filter: RosterFilter = { rarity: new Set(), classId: new Set(), order: new Set(), unsworn: true };
  private dragged = false;
  private detailOpen = false;

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

    const f = RosterScene.filter;
    const shown = CRUSADERS.filter(
      (c) =>
        (f.unsworn || owned[c.id]) &&
        (!f.rarity.size || f.rarity.has(c.rarity)) &&
        (!f.classId.size || f.classId.has(c.classId)) &&
        (!f.order.size || f.order.has(c.order)),
    );
    const sorted = sortRoster(game.save, shown, RosterScene.sortKey);

    // Sort (tap to cycle) and Filter
    const nf = f.rarity.size + f.classId.size + f.order.size + (f.unsworn ? 0 : 1);
    const cy = top + 22;
    const sortLabel = SORTS.find((x) => x.key === RosterScene.sortKey)!.label;
    makeButton(this, PAD + 100, cy, 200, 40, `Sort: ${sortLabel}`, () => {
      const i = SORTS.findIndex((x) => x.key === RosterScene.sortKey);
      RosterScene.sortKey = SORTS[(i + 1) % SORTS.length].key;
      RosterScene.scrollY = 0;
      this.scene.restart({});
    }, { fontSize: 16 });
    makeButton(this, PAD + 310, cy, 200, 40, nf ? `Filter (${nf})` : 'Filter', () => this.filterPanel(), { fontSize: 16, active: nf > 0 });
    if (!sorted.length) this.add.text(GAME_W / 2, top + 140, 'No Sister matches these filters.', text.body(18, PAL.muted)).setOrigin(0.5);

    // Cards as in the preview: portrait, rarity badge, name and level underneath.
    const cols = 3;
    const gap = 9;
    const cw = (GAME_W - PAD * 2 - gap * (cols - 1)) / cols;
    const ph = 128;
    const ch = ph + 46;
    const y0 = top + 56;
    const party = new Set(game.save.lastParty);
    const firstCard = this.children.list.length;
    sorted.forEach((c, i) => {
      const left = PAD + (i % cols) * (cw + gap);
      const topY = y0 + Math.floor(i / cols) * (ch + gap);
      const x = left + cw / 2;
      const have = owned[c.id];
      const tint = RARITY_COLOR[c.rarity];
      // ui-card.png skins the card behind each Sister (the portrait covers its top)
      if (!nine(this, 'ui-card', x, topY + ch / 2, cw, ch)) {
        this.add.rectangle(x, topY + ch / 2, cw, ch, have ? 0x1e1620 : 0x151017).setStrokeStyle(1, PAL.armorShadow);
      }
      if (have) {
        addBackdrop(this, portraitKey(c.id), x, topY + ph / 2, cw, ph, { fade: 0, focusY: 0.3 });
        this.add.rectangle(x, topY + ph, cw, 1, tint);
        addBadge(this, left + 4, topY + 4, c.rarity, tint, 12);
        if (party.has(c.id)) {
          this.add.rectangle(left + cw - 4, topY + 4, 22, 22, 0x170e15).setOrigin(1, 0).setStrokeStyle(1, 0x695045);
          addIcon(this, left + cw - 15, topY + 15, 'shield', 14, PAL.amber);
        }
        this.add.text(left + 8, topY + ph + 5, c.name.split(' ')[0], { ...text.body(19, PAL.ivory), fontStyle: '600' });
        this.add.text(left + 8, topY + ph + 28, `LV ${have.level}${have.vow ? ` V${have.vow}` : ''}`, text.hud(12, PAL.muted));
        this.add.text(left + cw - 36, topY + ph + 28, formatPower(sisterPower(game.save, c)), text.hud(12, PAL.amber)).setOrigin(1, 0);
        // class-<id>.png beside the name when present
        addArt(this, `class-${c.classId}`, left + cw - 18, topY + ph + 23, 24);
        if (have.tokens) {
          addBadge(this, left + cw - 40, topY + ph - 26, `+${have.tokens}`, PAL.amber, 12);
          // ui-vow.png beside the waiting-token count when present
          addArt(this, 'ui-vow', left + cw - 52, topY + ph - 15, 20);
        }
      } else {
        const g = this.add.graphics();
        for (let r = 8; r > 0; r--) g.fillStyle(0x291c2b, 0.16).fillCircle(x, topY + ph / 2, (r / 8) * 80);
        addIcon(this, x, topY + ph / 2, 'lock', 30, 0x967b8e);
        this.add.rectangle(x, topY + ph, cw, 1, PAL.armorShadow);
        this.add.text(left + 8, topY + ph + 5, 'Unknown', { ...text.body(19, PAL.muted), fontStyle: '600' });
        this.add.text(left + 8, topY + ph + 28, 'UNSWORN', text.hud(12, PAL.steel));
      }
      // tap target on top of the whole card
      const hit = this.add.rectangle(x, topY + ch / 2, cw, ch, 0x000000, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerup', (p: Phaser.Input.Pointer) => {
        // A drag scrolls the list; only a tap inside the visible window opens her page.
        if (this.dragged || p.y < viewTop || p.y > viewBottom || this.detailOpen) return;
        this.showDetail(c);
      });
    });

    // Scrolling: everything the grid drew moves in one container, masked to the window
    // between the heading and the tab bar. Drag (touch or mouse) or the mouse wheel.
    const viewTop = y0 - 6;
    const viewBottom = GAME_H - TAB_BAR_H;
    const grid = this.add.container(0, 0);
    grid.add(this.children.list.slice(firstCard, this.children.list.length - 1));
    const rows = Math.ceil(sorted.length / cols);
    const contentBottom = y0 + rows * (ch + gap) + 12;
    const minY = Math.min(0, viewBottom - contentBottom);
    const maskShape = this.make.graphics({}, false).fillRect(0, viewTop, GAME_W, viewBottom - viewTop);
    grid.setMask(maskShape.createGeometryMask());
    const setScroll = (y: number) => {
      RosterScene.scrollY = Phaser.Math.Clamp(y, minY, 0);
      grid.y = RosterScene.scrollY;
    };
    setScroll(RosterScene.scrollY);
    let startY = 0;
    let startScroll = 0;
    let down = false;
    let velocity = 0;
    let lastY = 0;
    this.dragged = false;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.detailOpen || p.y < viewTop || p.y > viewBottom) return;
      down = true;
      this.dragged = false;
      startY = lastY = p.y;
      startScroll = grid.y;
      velocity = 0;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!down || !p.isDown) return;
      if (Math.abs(p.y - startY) > 8) this.dragged = true;
      if (this.dragged) setScroll(startScroll + (p.y - startY));
      velocity = p.y - lastY;
      lastY = p.y;
    });
    const release = () => {
      if (!down) return;
      down = false;
      // a little momentum after a flick
      if (this.dragged && Math.abs(velocity) > 2) {
        const target = { v: velocity };
        this.tweens.add({ targets: target, v: 0, duration: 500, ease: 'Cubic.easeOut', onUpdate: () => setScroll(grid.y + target.v) });
      }
      // let this tap's pointerup handlers see `dragged` before it resets
      this.time.delayedCall(0, () => (this.dragged = false));
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (!this.detailOpen) setScroll(grid.y - dy);
    });

    addTabBar(this, 'Roster');

    const reopen = CRUSADERS.find((c) => c.id === this.openId);
    if (reopen) this.showDetail(reopen, this.tab);
  }


  /** Filter chips: rarity, class, Order, and whether to show unsworn Sisters. */
  private filterPanel() {
    const f = RosterScene.filter;
    const layer = this.add.container(0, 0).setDepth(20);
    this.detailOpen = true;
    layer.once('destroy', () => (this.detailOpen = false));
    const redraw = () => {
      layer.removeAll(true);
      layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.94).setInteractive());
      layer.add(addFrame(this, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 }));
      layer.add(this.add.text(GAME_W / 2, 58, 'FILTER THE ROSTER', text.display(22, PAL.ivory)).setOrigin(0.5));
      let y = 100;
      const chip = (x: number, w: number, label: string, on: boolean, toggle: () => void) => {
        const b = makeButton(this, x, y, w, 40, label, () => {
          toggle();
          redraw();
        }, { active: on, fontSize: 15 });
        layer.add(b.all);
      };
      const section = (title: string) => {
        layer.add(this.add.text(PAD + 12, y, title, text.hud(12, PAL.amber)));
        y += 42;
      };
      const flip = (set: Set<string>, v: string) => () => (set.has(v) ? set.delete(v) : set.add(v));
      const row = (items: [string, string][], set: Set<string>, cols: number) => {
        const w = (GAME_W - 56 - (cols - 1) * 8) / cols;
        items.forEach(([v, label], i) => {
          if (i && i % cols === 0) y += 48;
          chip(28 + w / 2 + (i % cols) * (w + 8), w, label, set.has(v), flip(set, v));
        });
        y += 52;
      };
      section('RARITY');
      row(RARITY_ORDER.slice().reverse().map((r) => [r, r]), f.rarity, 4);
      section('CLASS');
      row(CLASS_ORDER.map((id) => [id, CLASSES[id].name.split(' ').pop()!]), f.classId, 3);
      section('ORDER');
      row(ORDER_LIST.map((o) => [o.name, o.name]), f.order, 2);
      chip(GAME_W / 2, GAME_W - 56, f.unsworn ? 'Showing unsworn Sisters' : 'Hiding unsworn Sisters', f.unsworn, () => (f.unsworn = !f.unsworn));
      const clear = makeButton(this, GAME_W / 2 - 120, GAME_H - 62, 220, 60, 'Clear all', () => {
        f.rarity.clear();
        f.classId.clear();
        f.order.clear();
        f.unsworn = true;
        redraw();
      }, { fontSize: 19 });
      const done = makeButton(this, GAME_W / 2 + 120, GAME_H - 62, 220, 60, 'Done', () => {
        RosterScene.scrollY = 0;
        this.scene.restart({});
      }, { fontSize: 19, active: true });
      layer.add([...clear.all, ...done.all]);
    };
    redraw();
  }

  private reopen(c: CrusaderDef, tab: Tab) {
    this.scene.restart({ openId: c.id, tab });
  }

  private showDetail(c: CrusaderDef, tab: Tab = 'oath') {
    const layer = this.add.container(0, 0).setDepth(10);
    this.detailOpen = true;
    layer.once('destroy', () => (this.detailOpen = false));
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
    // class-<id>.png (48 x 48) on the portrait's lower-right corner when present
    const ex = GAME_W / 2 + size / 2 - 26;
    const ey = py + size / 2 - 26;
    const emblem = have ? addArt(this, `class-${c.classId}`, ex, ey, 48) : null;
    if (emblem) layer.add([this.add.circle(ex, ey, 28, 0x150e17).setStrokeStyle(1, RARITY_COLOR[c.rarity]), emblem]);

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

    // Power, top left of the panel
    layer.add([
      this.add.text(44, 38, 'POWER', text.hud(12, PAL.steel)),
      this.add.text(44, 54, formatPower(sisterPower(game.save, c)), text.display(24, PAL.amber)),
    ]);
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
      const b = makeButton(this, 30 + tw / 2 + i * tw, 346, tw - 8, 46, label, () => id !== tab && this.reopen(c, id), { active: id === tab, fontSize: 18, skin: 'ui-subtab' });
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
      this.add.text(GAME_W / 2, 404, `Level ${have.level} / ${levelCap(have)}${have.asc ? `  ·  Ascension ${ROMAN_RANK(have.asc)}` : ''}`, { ...style, fontSize: '22px', color: hex(PAL.amber) }).setOrigin(0.5),
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
      const px = GAME_W / 2 - 50 + v * 40;
      // ui-pip.png (empty) and ui-pip-full.png (taken), shown at 24 x 24, when present
      const pipKey = taken ? 'ui-pip-full' : 'ui-pip';
      if (this.textures.exists(pipKey)) {
        const pip = this.add.image(px, 484, pipKey).setDisplaySize(24, 24);
        if (ready) pip.setTint(PAL.amber);
        layer.add(pip);
      } else {
        layer.add(this.add.circle(px, 484, 12, taken ? PAL.oxblood : PAL.deepShadow).setStrokeStyle(2, taken || ready ? PAL.amber : PAL.armorShadow));
      }
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
      ...(() => {
        const line = this.add.text(GAME_W / 2, 516, tokenLine, { ...style, fontSize: '16px', color: hex(tokens ? PAL.amber : PAL.muted) }).setOrigin(0.5);
        // ui-vow.png before the line when tokens are waiting
        const icon = tokens ? addArt(this, 'ui-vow', 0, 516, 20) : null;
        if (icon) {
          line.setX(GAME_W / 2 + 13);
          icon.setX(line.x - line.width / 2 - 13);
        }
        return icon ? [icon, line] : [line];
      })(),
      this.add.text(GAME_W / 2, 548, perks, { ...style, fontSize: '15px', color: hex(PAL.amber), wordWrap: { width: GAME_W - 70 } }).setOrigin(0.5),
      ...(order ? [this.add.text(GAME_W / 2, 590, `With another ${c.order}: ${order.desc}`, { ...style, fontSize: '15px', color: hex(PAL.muted) }).setOrigin(0.5)] : []),
      this.add.text(GAME_W / 2, 636, cls.summary, { ...style, fontSize: '18px' }).setOrigin(0.5),
      this.add.text(GAME_W / 2, 696, `"${c.hook}"`, { ...style, fontSize: '16px', fontStyle: 'italic', color: hex(PAL.steel) }).setOrigin(0.5),
    ]);

    const cost = levelUpCost(have.level);
    const atCap = have.level >= levelCap(have);
    const step = nextAscension(save, c.id);
    // At her cap, the level button becomes Ascend (Martyr's Ash and Tithes).
    if (atCap && step) {
      const block = ascendBlock(save, c.id);
      layer.add(
        this.add
          .text(GAME_W / 2, GAME_H - 206, `Ascension ${ROMAN_RANK((have.asc ?? 0) + 1)}: ${costLine(save, step)}`, { ...style, fontSize: '14px', color: hex(block ? PAL.steel : PAL.amber), wordWrap: { width: GAME_W - 60 } })
          .setOrigin(0.5),
      );
    }
    const canLevel = !atCap && save.tithes >= cost;
    const canAscend = atCap && !!step && !ascendBlock(save, c.id);
    const lvl = makeButton(
      this,
      GAME_W / 2 - 124,
      GAME_H - 150,
      236,
      76,
      !atCap ? `Level up\n${cost} Tithes` : step ? `Ascend\ncap ${levelCap(have)} → ${levelCap(have) + 10}` : 'Max level',
      () => {
        if (atCap) {
          if (ascend(save, c.id)) {
            commit();
            this.reopen(c, 'oath');
          }
          return;
        }
        save.tithes -= cost;
        have.level += 1;
        track(save, 'levelUp');
        commit();
        this.reopen(c, 'oath');
      },
      { disabled: atCap ? !canAscend : !canLevel, active: atCap ? canAscend : canLevel, fontSize: 20 },
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
    const save = game.save;
    const have = save.owned[c.id];
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
      // skill-<id>.png (32 x 32) to the left of the name when present
      const icon = addArt(this, `skill-${s.id}`, left + 16, y + 18, 32);
      const tx = icon ? left + 44 : left;
      const name = this.add.text(tx, y, `${s.name}${isUp ? '+' : ''}`, { ...text.body(21, s.rite ? PAL.amber : PAL.ivory), fontStyle: '600' });
      const t = this.add.text(tx, y + 28, tag, text.hud(12, isUp ? PAL.amber : PAL.steel));
      const d = this.add.text(left, y + 46, s.desc, { ...text.body(16, PAL.muted), wordWrap: { width } });
      layer.add([...(icon ? [icon] : []), name, t, d]);
      // Skill level: Psalter Pages and Tithes raise it, up to MAX_SKILL_LEVEL.
      const lv = skillLevels(save, c.id)[i];
      const step = nextSkillStep(save, c.id, i);
      const block = skillBlock(save, c.id, i);
      const btn = makeButton(
        this,
        GAME_W - left - 66,
        y + 12,
        132,
        30,
        step ? `Lv ${lv} → ${lv + 1}` : `Lv ${MAX_SKILL_LEVEL} · max`,
        () => {
          if (raiseSkill(save, c.id, i)) {
            commit();
            this.reopen(c, 'skills');
          }
        },
        { disabled: !!block, active: !block, fontSize: 14 },
      );
      const cost = step
        ? this.add.text(left, y + 52 + d.height, `Lv ${lv + 1} (+6% effect): ${have.level < step.level ? `needs level ${step.level} · ` : ''}${stepText(save, step)}`, text.body(14, block ? PAL.steel : PAL.amber))
        : undefined;
      layer.add([...btn.all, ...(cost ? [cost] : [])]);
      y += 52 + d.height + (cost ? 24 : 0) + 14;
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
      // ui-gear-slot.png (9-slice row, tinted by the worn piece's rarity) when present
      const row = nine(this, 'ui-gear-slot', GAME_W / 2, y, bw, 112);
      layer.add(row ? row.setTint(item ? edge : 0xffffff) : this.add.rectangle(GAME_W / 2, y, bw, 112, 0x1b131d).setStrokeStyle(1, edge));
      const set = gearSet(item?.set);
      layer.add(this.add.text(left, y - 46, `${SLOT_NAME[slot].toUpperCase()} · ${SLOT_HINT[slot].toUpperCase()}`, text.hud(12, PAL.steel)));
      if (set) layer.add(this.add.text(GAME_W - 176, y - 46, `${set.name.toUpperCase()} SET`, text.hud(12, set.color)).setOrigin(1, 0));
      if (item) {
        layer.add([
          this.add.text(left, y - 28, `${item.name}${item.level ? ` +${item.level}` : ''}`, { ...text.body(20, RARITY_COLOR[item.rarity]), fontStyle: '600' }),
          this.add.text(left, y + 0, `${item.rarity} · ${formatStat(item.main, mainValue(item))} · +${formatPower(gearPower(save, c, item))} power`, text.body(16, PAL.ivory)),
          this.add.text(left, y + 22, item.subs.map((s) => formatStat(s.stat, s.value)).join('  ') || 'No substats', text.body(15, PAL.muted)),
        ]);
        const can = !enhanceBlock(save, item) || !rerollBlock(save, item);
        const forge = makeButton(this, GAME_W - 104, y - 24, 128, 46, 'Forge', () => this.forge(c, item), { active: can, fontSize: 17 });
        layer.add(forge.all);
      } else {
        layer.add(this.add.text(left, y - 18, 'Empty', text.body(20, PAL.steel)));
      }
      const change = makeButton(this, GAME_W - 104, y + 28, 128, 42, item ? 'Change' : 'Equip', () => this.gearPicker(c, slot), { fontSize: 16 });
      layer.add(change.all);
    });
    const b = gearBonus(worn);
    const parts = (Object.keys(b) as (keyof typeof b)[]).filter((k) => b[k] > 0).map((k) => formatStat(k, b[k]));
    const sets = setsWorn(worn)
      .filter((x) => x.count >= 2)
      .map((x) => `${x.set.name} ×${x.count}`);
    layer.add(
      this.add
        .text(GAME_W / 2, 812, parts.length ? `Gear: ${parts.join('  ')}${sets.length ? `\nSets: ${sets.join(', ')}` : ''}` : 'Crusades yield gear. Elites and bosses always do.', {
          ...text.body(16, parts.length ? PAL.amber : PAL.muted),
          align: 'center',
          wordWrap: { width: GAME_W - 70 },
        })
        .setOrigin(0.5),
    );
  }

  /** The Forge: enhance a piece (Blessed Iron past +10), reroll its substats, read its set. */
  private forge(c: CrusaderDef, item: GearItem) {
    const save = game.save;
    const layer = this.add.container(0, 0).setDepth(30);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.96).setInteractive());
    layer.add(addFrame(this, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 }));
    const left = 48;
    const width = GAME_W - 96;
    const color = RARITY_COLOR[item.rarity];
    layer.add([
      this.add.text(GAME_W / 2, 64, 'THE FORGE', text.display(22, PAL.ivory)).setOrigin(0.5),
      this.add.text(GAME_W / 2, 118, `${item.name}${item.level ? ` +${item.level}` : ''}`, { ...text.body(26, color), fontStyle: '600' }).setOrigin(0.5),
      this.add.text(GAME_W / 2, 152, `${item.rarity} ${SLOT_NAME[item.slot]} · ${formatStat(item.main, mainValue(item))} · +${formatPower(gearPower(save, c, item))} power`, text.body(17, PAL.ivory)).setOrigin(0.5),
    ]);
    let y = 200;
    const section = (title: string, body: string, tint: number = PAL.muted) => {
      layer.add(this.add.rectangle(GAME_W / 2, y, width, 1, PAL.armorShadow));
      layer.add(this.add.text(left, y + 12, title, text.hud(13, PAL.steel)));
      const t = this.add.text(left, y + 34, body, { ...text.body(17, tint), wordWrap: { width } });
      layer.add(t);
      y += 46 + t.height + 12;
    };
    const set = gearSet(item.set);
    section(
      'SET',
      set ? `${set.name}. Wear two or three ${set.name} pieces.\n${setText(set)}` : 'None. Pieces found from now on belong to a set.',
      set ? set.color : PAL.muted,
    );

    // Enhance and refine
    const maxed = item.level >= MAX_REFINE;
    const iron = refineIron(item);
    const next = { ...item, level: item.level + 1 };
    section(
      item.level >= MAX_GEAR_LEVEL ? `REFINE · +${item.level} OF +${MAX_REFINE}` : `ENHANCE · +${item.level} OF +${MAX_GEAR_LEVEL}, THEN REFINE TO +${MAX_REFINE}`,
      maxed
        ? 'Fully refined.'
        : `+${next.level}: ${formatStat(item.main, mainValue(next))}${SUB_UPGRADE_LEVELS.includes(next.level) && item.subs.length ? ' and a random substat grows' : ''}.\nCost: ${enhanceCost(item)} Tithes${iron ? ` and ${ironText(iron)}` : ''}.`,
      PAL.ivory,
    );
    const eb = enhanceBlock(save, item);
    const enh = makeButton(this, GAME_W / 2, y + 10, 300, 52, maxed ? 'Fully refined' : eb ?? (item.level >= MAX_GEAR_LEVEL ? `Refine to +${next.level}` : `Enhance to +${next.level}`), () => {
      if (enhance(save, item)) {
        commit();
        layer.destroy();
        this.forge(c, item);
      }
    }, { disabled: !!eb, active: !eb, fontSize: 18 });
    layer.add(enh.all);
    y += 52;

    // Reroll
    section(
      'SUBSTATS',
      item.subs.length
        ? `${item.subs.map((s) => formatStat(s.stat, s.value)).join('   ')}\nReroll gives each a new stat and keeps its strength. Cost: ${ironText(REROLL_COST.items)} and ${REROLL_COST.tithes} Tithes.`
        : 'R pieces have no substats.',
      PAL.ivory,
    );
    const rb = rerollBlock(save, item);
    const reroll = makeButton(this, GAME_W / 2, y + 10, 300, 52, rb ?? 'Reroll substats', () => {
      if (rerollSubs(save, item)) {
        commit();
        layer.destroy();
        this.forge(c, item);
      }
    }, { disabled: !!rb, active: !rb, fontSize: 18 });
    layer.add(reroll.all);

    const own = (id: 'iron1' | 'iron2' | 'iron3') => `${countOf(save, id)} ${itemDef(id).name}`;
    layer.add(this.add.text(GAME_W / 2, GAME_H - 118, `You hold ${own('iron1')}, ${own('iron2')}, ${own('iron3')} · ${save.tithes.toLocaleString('en-US')} Tithes`, { ...text.body(15, PAL.muted), align: 'center', wordWrap: { width } }).setOrigin(0.5));
    const back = makeButton(this, GAME_W / 2, GAME_H - 62, 240, 60, 'Back', () => this.reopen(c, 'gear'), { fontSize: 19 });
    layer.add(back.all);
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
        this.add.text(42, y + 14, `${gearSet(g.set) ? `${gearSet(g.set)!.name.toUpperCase()} · ` : ''}${g.on === c.id ? 'Worn by her' : wearer ? `Worn by ${wearer}: tap to take it` : 'Tap to equip'}`, text.hud(12, g.on === c.id ? PAL.amber : PAL.steel)),
      ]);
      // What putting it on would do to her power
      if (g.on !== c.id) {
        const d = gearSwapDelta(save, c, g);
        layer.add(this.add.text(GAME_W - 40, y - 32, `${d >= 0 ? '▲ +' : '▼ '}${formatPower(d)}`, text.hud(13, d > 0 ? 0x8fc07a : d < 0 ? 0xe58a8a : PAL.steel)).setOrigin(1, 0));
      }
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
