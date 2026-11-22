import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { CLASSES, RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { autoEquipPlan, formatPower, gearPower, gearSwapDelta, sisterPower } from '../systems/power';
import { ORDERS } from '../data/orders';
import type { OwnedCrusader } from '../state/save';
import type { Stats } from '../systems/stats';
import { BOND_STAT, bondInfo } from '../systems/bonds';
import { addOrderSigil } from '../ui/sisterCard';
import { passes, sortControls, sortRoster, sortState } from '../ui/sisterSort';
import type { ScrollArea } from '../ui/scroll';
import { CLASS_SKILLS, DMG_NAME, type SkillDef } from '../data/skills';
import { showDetail as showSkillDetail } from '../ui/glossary';
import { dmgTagOf } from '../data/classes';
import { VOW_UPGRADES } from '../systems/combat';
import type { CrusaderDef } from '../data/types';
import { commit, game } from '../state/game';
import { RARITY_ORDER } from '../systems/gacha';
import { MAX_TIER, MAX_VOW, TIER_BONUS, TIER_COLOR, TIER_NAME, TIER_STIGMATA, VOW_BONUS, copiesFor, oathComplete, oathMult, skillVow, stigmataOf, takeVow, tierBlock, tierOf, tierTithes, tierUp, vowBlock, vowCost } from '../systems/tiers';
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
import { levelCap, sisterStats } from '../systems/stats';
import { UNCTIONS, UNCTION_EXP, expOf, expToNext, feed, feedPlan } from '../systems/exp';
import { drawItemIcon } from '../ui/itemIcon';
import { ascend, ascendBlock, costLine, nextAscension } from '../systems/ascension';
import { ROMAN_RANK } from '../systems/rank';
import { countOf, itemDef } from '../systems/items';
import { MAX_SKILL_LEVEL, nextSkillStep, raiseSkill, skillBlock, skillLevels, stepText } from '../systems/skillLevels';
import { makeButton } from '../ui/button';
import { CURRENCY_BAR_H, addCurrencyBar } from '../ui/currencyBar';
import { loadFullBody, portraitKey } from '../ui/placeholderPortrait';
import { nine } from '../ui/skin';
import { addScrollArea } from '../ui/scroll';
import { tapCost, tapForSources } from '../ui/sources';
import { TAB_BAR_H, addTabBar } from '../ui/tabBar';
import { PAD, addArt, addBackdrop, addBadge, addFrame, addHeading, addIcon, addScreenGlow, text } from '../ui/theme';

type Tab = 'grow' | 'vows' | 'skills' | 'gear';
const TABS: [Tab, string][] = [
  ['grow', 'Grow'],
  ['vows', 'Vows'],
  ['skills', 'Skills'],
  ['gear', 'Gear'],
];
const STAT_LABEL = { atk: 'ATK', hp: 'HP', armor: 'ARM', spd: 'SPD' } as const;

/** Her page's layout: portrait, name block, stat strip, then the sheet. */
const BUST = 320;
const HERO_Y = 210;
const HERO_H = 470;
const FIGURE_H = 450;
const FIGURE_Y = 250;
const NAME_Y = 400;
const STATS_Y = 506;
const SHEET_Y = 544;

/** Every Sister: sworn ones first (highest rarity first), the rest as silhouettes. */
export class RosterScene extends Phaser.Scene {
  private openId?: string;
  private tab: Tab = 'grow';
  /** The grid's Sisters in order, for swiping on her page. */
  private order: string[] = [];
  /** Kept across restarts so levelling up a Sister doesn't jump the list back to the top. */
  private static scrollY = 0;
  private dragged = false;
  private detailOpen = false;

  constructor() {
    super('Roster');
  }

  init(data: { openId?: string; tab?: Tab | 'oath' }) {
    this.openId = data?.openId;
    // 'oath' was the old name of the Grow and Vows page.
    this.tab = !data?.tab ? 'grow' : data.tab === 'oath' ? 'vows' : data.tab;
  }

  create() {
    addScreenGlow(this);
    addCurrencyBar(this);
    const owned = game.save.owned;
    const count = Object.keys(owned).length;
    const top = addHeading(this, 'Roster', CURRENCY_BAR_H + 10);
    this.add.text(GAME_W - PAD, top - 8, `${count} / ${CRUSADERS.length}`, text.hud(16, PAL.muted)).setOrigin(1, 1);

    const f = sortState.filter;
    const shown = CRUSADERS.filter((c) => (f.unsworn || owned[c.id]) && passes(c));
    const sorted = sortRoster(game.save, shown);
    this.order = sorted.map((c) => c.id);

    // Sort (tap to cycle) and Filter: the same settings every Sister picker uses.
    sortControls(this, PAD + 205, top + 22, 410, () => {
      RosterScene.scrollY = 0;
      this.scene.restart({});
    }, { roster: true, depth: 20 });
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
        this.add.text(left + 8, topY + ph + 28, `LV ${have.level}${tierOf(have) ? ` T${tierOf(have)}` : ''}${have.vow ? ` V${have.vow}` : ''}`, text.hud(12, tierOf(have) ? TIER_COLOR[tierOf(have)] : PAL.muted));
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


  private reopen(c: CrusaderDef, tab: Tab) {
    this.scene.restart({ openId: c.id, tab });
  }

  /** Her stats as they would be after `change` (her save entry is put back after). */
  private preview(c: CrusaderDef, change: (o: OwnedCrusader) => void) {
    const o = game.save.owned[c.id];
    const keep = { ...o };
    change(o);
    const st = sisterStats(game.save, c);
    Object.keys(o).forEach((k) => delete (o as unknown as Record<string, unknown>)[k]);
    Object.assign(o, keep);
    return st;
  }

  /** "ATK 120 → 131 · HP 900 → 990" between two stat blocks. */
  private diffText(a: Stats, b: Stats) {
    return (['atk', 'hp', 'armor', 'spd'] as const)
      .filter((k) => b[k] !== a[k])
      .map((k) => `${STAT_LABEL[k]} ${a[k]} → ${b[k]}`)
      .join('  ·  ');
  }

  /** Which sheet tabs have something to do (a gold dot). */
  private tabReady(c: CrusaderDef): Record<Tab, boolean> {
    const save = game.save;
    const have = save.owned[c.id];
    const atCap = have.level >= levelCap(have);
    const grow = atCap ? !!nextAscension(save, c.id) && !ascendBlock(save, c.id) : feedPlan(save, c.id, 1).levels > 0;
    const vows = !(have.vow >= MAX_VOW ? tierBlock(save, have) : vowBlock(save, have));
    const skills = CLASS_SKILLS[c.classId].some((_, i) => !skillBlock(save, c.id, i));
    const worn = new Set(equipped(save, c.id).map((g) => g.slot));
    const gear = GEAR_SLOTS.some((s) => !worn.has(s) && gearOf(save).some((g) => g.slot === s && !g.on));
    return { grow, vows, skills, gear };
  }

  /**
   * Her page: the portrait fills the top (swipe or ‹ › for the next Sister),
   * name, Order and stars under it, four key stats, then a sheet of tabs:
   * Grow (level, Ascension), Vows (stars, tiers), Skills and Gear.
   */
  private showDetail(c: CrusaderDef, tab: Tab = 'grow') {
    const save = game.save;
    const layer = this.add.container(0, 0).setDepth(10);
    this.detailOpen = true;
    layer.once('destroy', () => (this.detailOpen = false));
    const have = save.owned[c.id];
    const cls = CLASSES[c.classId];
    const order = ORDERS[c.order];
    const tint = RARITY_COLOR[c.rarity];

    // Backdrop: her Order's colour behind the portrait, darkening to the sheet.
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0d090f, 1).setInteractive());
    const glow = this.add.graphics();
    for (let r = 10; r > 0; r--) glow.fillStyle(order?.color ?? PAL.amber, 0.035).fillCircle(GAME_W / 2, HERO_Y, (r / 10) * 300);
    layer.add(glow);
    layer.add(addBackdrop(this, 'bg-hall', GAME_W / 2, HERO_H / 2, GAME_W, HERO_H, { alpha: 0.18, fade: 0.7, fadeColor: 0x0d090f }));

    // The portrait (the full figure once its art exists).
    const bust = this.add.image(GAME_W / 2, HERO_Y, portraitKey(c.id)).setDisplaySize(BUST, BUST);
    if (!have) bust.setTint(0x111111);
    layer.add(bust);
    if (have) {
      loadFullBody(this, c.id).then((key) => {
        if (!key || !bust.active || key === portraitKey(c.id) || !this.textures.exists(key)) return;
        const src = this.textures.get(key).getSourceImage();
        const h = FIGURE_H;
        bust.setTexture(key).setDisplaySize((src.width / src.height) * h, h).setY(FIGURE_Y);
      });
    }
    // Dark band under the name so it reads over the art.
    const band = this.add.graphics();
    for (let i = 0; i < 12; i++) band.fillStyle(0x0d090f, 0.08 * i).fillRect(0, NAME_Y - 60 + i * 6, GAME_W, 6);
    band.fillStyle(0x0d090f, 0.92).fillRect(0, NAME_Y + 12, GAME_W, STATS_Y - NAME_Y - 40);
    layer.add(band);

    // Swipe the portrait for the next or previous Sister.
    const swipe = this.add.zone(GAME_W / 2, HERO_H / 2, GAME_W, HERO_H).setInteractive();
    let downX = 0;
    swipe.on('pointerdown', (p: Phaser.Input.Pointer) => (downX = p.x));
    swipe.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (Math.abs(p.x - downX) > 60) this.step(c, p.x < downX ? 1 : -1, tab);
    });
    layer.add(swipe);

    // Corners: Power, Back, and the arrows.
    if (have) layer.add([this.add.text(PAD + 4, 22, 'POWER', text.hud(12, PAL.steel)), this.add.text(PAD + 4, 38, formatPower(sisterPower(save, c)), text.display(26, PAL.amber))]);
    if (have?.tokens) layer.add([...addBadge(this, PAD + 4, 78, `+${have.tokens} cop${have.tokens > 1 ? 'ies' : 'y'}`, PAL.amber, 12)]);
    const back = makeButton(this, GAME_W - PAD - 50, 40, 100, 44, 'Back', () => layer.destroy(), { fontSize: 16 });
    layer.add(back.all);
    if (this.order.length > 1) {
      const prev = makeButton(this, 28, HERO_Y, 44, 72, '‹', () => this.step(c, -1, tab), { fontSize: 28 });
      const next = makeButton(this, GAME_W - 28, HERO_Y, 44, 72, '›', () => this.step(c, 1, tab), { fontSize: 28 });
      layer.add([...prev.all, ...next.all]);
      const i = this.order.indexOf(c.id);
      layer.add(this.add.text(GAME_W - PAD - 4, 70, `${i + 1} / ${this.order.length}`, text.hud(11, PAL.steel)).setOrigin(1, 0));
    }

    // Name, rarity, class and role; Order and stars.
    layer.add([
      ...addBadge(this, PAD + 4, NAME_Y - 50, c.rarity, tint, 13),
      this.add.text(PAD + 4, NAME_Y - 28, have ? c.name.toUpperCase() : 'NOT YET SWORN', text.display(26, 0xfff1d6)),
      this.add.text(PAD + 4, NAME_Y + 6, `${c.title ?? cls.name} · ${cls.role}${c.title && c.title !== cls.name ? ` · fights as ${cls.name}` : ''}`, text.body(16, tint)),
    ]);
    const sigil = addOrderSigil(this, PAD + 16, NAME_Y + 44, c.order, 26);
    if (sigil) layer.add(sigil);
    layer.add(this.add.text(PAD + (sigil ? 36 : 4), NAME_Y + 44, `${c.order}${have ? '' : '  ·  her seal waits at the Altar'}`, text.body(15, PAL.muted)).setOrigin(0, 0.5));
    const emblem = addArt(this, `class-${c.classId}`, GAME_W - PAD - 26, NAME_Y - 12, 44);
    if (emblem) layer.add(emblem);
    if (have) {
      const tier = tierOf(have);
      for (let v = 0; v < MAX_VOW; v++) layer.add(this.add.star(GAME_W - PAD - 118 + v * 22, NAME_Y + 44, 5, 4, 9, v < have.vow ? TIER_COLOR[tier] : PAL.deepShadow).setStrokeStyle(1, v < have.vow ? TIER_COLOR[tier] : PAL.armorShadow));
      layer.add(this.add.text(GAME_W - PAD - 132, NAME_Y + 44, tier ? `T${tier}` : `LV ${have.level}`, text.hud(12, tier ? TIER_COLOR[tier] : PAL.amber)).setOrigin(1, 0.5));
    }

    if (!have) {
      const bw = GAME_W - PAD * 2;
      layer.add([
        this.add.text(GAME_W / 2, STATS_Y + 20, cls.summary, { ...text.body(18, PAL.ivory), align: 'center', wordWrap: { width: bw } }).setOrigin(0.5, 0),
        this.add.text(GAME_W / 2, STATS_Y + 110, `"${c.hook}"`, { ...text.body(16, PAL.steel), fontStyle: 'italic', align: 'center', wordWrap: { width: bw } }).setOrigin(0.5, 0),
      ]);
      const go = makeButton(this, GAME_W / 2, GAME_H - 70, 260, 56, 'Go to the Altar', () => this.scene.start('Recruit'), { fontSize: 18, active: true });
      layer.add(go.all);
      return;
    }

    this.statStrip(layer, c);

    // The sheet: four tabs, a gold dot on each with something to do.
    const bw = GAME_W - PAD * 2;
    layer.add(addFrame(this, GAME_W / 2, (SHEET_Y + GAME_H - 6) / 2, GAME_W - 12, GAME_H - 6 - SHEET_Y, { fill: 0x1b121c }));
    const ready = this.tabReady(c);
    const tw = (bw - 8) / TABS.length;
    TABS.forEach(([id, label], i) => {
      const x = PAD + 4 + tw / 2 + i * tw;
      const b = makeButton(this, x, SHEET_Y + 28, tw - 6, 42, label, () => id !== tab && this.reopen(c, id), { active: id === tab, fontSize: 16, skin: 'ui-subtab' });
      layer.add(b.all);
      if (ready[id] && id !== tab) layer.add(this.add.circle(x + tw / 2 - 12, SHEET_Y + 14, 6, PAL.amber).setStrokeStyle(2, 0x1b121c));
    });
    const list = addScrollArea(this, SHEET_Y + 54, GAME_H - 10, { parent: layer });
    const y0 = SHEET_Y + 62;
    const end = tab === 'grow' ? this.growTab(list, c, y0) : tab === 'vows' ? this.vowsTab(list, c, y0) : tab === 'skills' ? this.skillsTab(list.content, c, y0) : this.gearTab(list.content, c, y0);
    list.fit(end);
  }

  /** The next (or previous) Sister in the roster's order, on the same tab. */
  private step(c: CrusaderDef, dir: number, tab: Tab) {
    const i = this.order.indexOf(c.id);
    if (i < 0 || this.order.length < 2) return;
    const id = this.order[(i + dir + this.order.length) % this.order.length];
    this.scene.restart({ openId: id, tab });
  }

  /** HP, ATK, ARM, SPD and bond; tap the stats for every number. */
  private statStrip(layer: Phaser.GameObjects.Container, c: CrusaderDef) {
    const save = game.save;
    const st = sisterStats(save, c);
    const b = bondInfo(save, c.id);
    const cells: [string, string, () => void][] = [
      ['HP', `${st.hp}`, () => this.statDetails(c)],
      ['ATK', `${st.atk}`, () => this.statDetails(c)],
      ['ARM', `${st.armor}`, () => this.statDetails(c)],
      ['SPD', `${st.spd}`, () => this.statDetails(c)],
      ['BOND ›', b.level ? ROMAN_RANK(b.level) : '0', () => this.scene.start('Confession', { id: c.id })],
    ];
    const bw = GAME_W - PAD * 2;
    const w = (bw - 4 * 6) / cells.length;
    cells.forEach(([label, value, fn], i) => {
      const x = PAD + w / 2 + i * (w + 6);
      const box = this.add.rectangle(x, STATS_Y, w, 54, 0x1b131d).setStrokeStyle(1, i === 4 ? PAL.goldEdge : PAL.armorShadow).setInteractive({ useHandCursor: true });
      box.on('pointerup', fn);
      layer.add([box, this.add.text(x, STATS_Y - 14, label, text.hud(11, i === 4 ? PAL.amber : PAL.steel)).setOrigin(0.5), this.add.text(x, STATS_Y + 8, value, text.body(19, PAL.ivory)).setOrigin(0.5)]);
    });
  }

  /** Every stat and where it comes from. */
  private statDetails(c: CrusaderDef) {
    const save = game.save;
    const have = save.owned[c.id];
    const st = sisterStats(save, c);
    const layer = this.add.container(0, 0).setDepth(40);
    const close = () => layer.destroy();
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.85).setInteractive().on('pointerup', close));
    const h = 420;
    const top = GAME_H / 2 - h / 2;
    layer.add(addFrame(this, GAME_W / 2, GAME_H / 2, GAME_W - 48, h, { fill: 0x241925 }));
    layer.add(this.add.text(GAME_W / 2, top + 30, `${c.name.split(' ')[0].toUpperCase()}'S STATS`, text.display(20, 0xfff1d6)).setOrigin(0.5));
    const rows: [string, string][] = [
      ['Health', `${st.hp}`],
      ['Attack', `${st.atk}`],
      ['Armor', `${st.armor}  (takes ${Math.round(100 / (1 + st.armor / 100))}% damage)`],
      ['Speed', `${st.spd}`],
      ['Critical chance', `${Math.round(st.crit * 100)}%`],
      ['Vows and tiers', `+${Math.round((oathMult(have) - 1) * 100)}% stats`],
      ['Bond', `+${Math.round(bondInfo(save, c.id).level * BOND_STAT * 100)}% ATK and HP`],
    ];
    rows.forEach(([k, v], i) => {
      const y = top + 74 + i * 40;
      layer.add([this.add.text(52, y, k, text.body(17, PAL.muted)), this.add.text(GAME_W - 52, y, v, text.body(17, PAL.ivory)).setOrigin(1, 0)]);
    });
    const done = makeButton(this, GAME_W / 2, top + h - 40, 180, 46, 'Close', close, { fontSize: 16 });
    layer.add(done.all);
  }

  /** Level up (+1, +10, Max) or Ascend at her cap, each with a before and after. */
  private growTab(list: ScrollArea, c: CrusaderDef, y: number): number {
    const save = game.save;
    const have = save.owned[c.id];
    const layer = list.content;
    const cls = CLASSES[c.classId];
    const bw = GAME_W - PAD * 2 - 16;
    const left = PAD + 8;
    const cap = levelCap(have);
    const atCap = have.level >= cap;
    layer.add(this.add.text(left, y, `LEVEL ${have.level} / ${cap}${have.asc ? `  ·  ASCENSION ${ROMAN_RANK(have.asc)}` : ''}`, text.hud(15, PAL.amber)));
    layer.add(tapForSources(this, this.add.text(GAME_W - PAD - 8, y, `${save.tithes.toLocaleString('en-US')} TITHES`, text.hud(12, PAL.steel)).setOrigin(1, 0), 'tithes'));
    y += 28;
    const now = sisterStats(save, c);
    // EXP bar: into this level, or banked at her cap.
    const need = expToNext(have.level);
    const into = Math.min(expOf(have), need);
    layer.add(this.add.rectangle(left, y + 6, bw, 12, 0x150e17).setOrigin(0, 0.5).setStrokeStyle(1, PAL.armorShadow));
    if (into) layer.add(this.add.rectangle(left + 1, y + 6, (bw - 2) * (into / need), 10, 0x7fc4a0).setOrigin(0, 0.5));
    layer.add(this.add.text(left, y + 16, atCap ? (into >= need ? 'EXP full: Ascend to keep growing' : `EXP ${into.toLocaleString('en-US')} / ${need.toLocaleString('en-US')} banked at her cap`) : `EXP ${into.toLocaleString('en-US')} / ${need.toLocaleString('en-US')}`, text.body(13, PAL.muted)));
    y += 40;
    if (!atCap) {
      // Unction held: tap for sources.
      const uw = bw / 3;
      UNCTIONS.forEach((u, i) => {
        const x = left + i * uw;
        layer.add(drawItemIcon(this, x + 20, y + 18, u, 36));
        const t = tapForSources(this, this.add.text(x + 44, y + 4, `×${countOf(save, u)}\n${UNCTION_EXP[u].toLocaleString('en-US')} EXP`, text.body(13, countOf(save, u) ? PAL.ivory : PAL.steel)), u);
        layer.add(t);
      });
      y += 46;
      const one = this.preview(c, (o) => (o.level += 1));
      layer.add(this.add.text(left, y, `Next level: ${this.diffText(now, one)}`, { ...text.body(15, PAL.ivory), wordWrap: { width: bw } }));
      y += 30;
      const w = (bw - 16) / 3;
      ([['+1', 1], ['+10', 10], ['Max', 999]] as const).forEach(([label, n], i) => {
        const plan = feedPlan(save, c.id, n);
        const can = plan.levels > 0;
        const sub = can ? `${plan.tithes.toLocaleString('en-US')} Tithes` : plan.block === 'unction' ? 'Need Unction' : plan.block === 'tithes' ? 'Need Tithes' : 'At cap';
        const b = makeButton(this, left + w / 2 + i * (w + 8), y + 30, w, 58, `${label}${can && n > 1 ? ` (${plan.levels})` : ''}\n${sub}`, () => {
          if (list.dragging || !can) return;
          if (feed(save, c.id, n)) {
            commit();
            this.reopen(c, 'grow');
          }
        }, { disabled: !can, active: can && i === 0, fontSize: 14 });
        layer.add(b.all);
      });
      y += 72;
      const block = feedPlan(save, c.id, 1).block;
      if (block) {
        layer.add(tapForSources(this, this.add.text(left, y, block === 'unction' ? 'Short of Unction: battles, the Vigil and the road give EXP too. Tap for sources ›' : 'Short of Tithes: tap to see where to get more ›', { ...text.body(14, PAL.amber), wordWrap: { width: bw } }), block === 'unction' ? 'unction1' : 'tithes'));
        y += 44;
      }
    } else {
      const step = nextAscension(save, c.id);
      if (step) {
        const block = ascendBlock(save, c.id);
        layer.add(this.add.text(left, y, `Level ${cap} is her cap. Ascend to raise it to ${cap + 10}.`, { ...text.body(15, PAL.ivory), wordWrap: { width: bw } }));
        y += 26;
        layer.add(tapCost(this, this.add.text(left, y, `Ascension ${ROMAN_RANK((have.asc ?? 0) + 1)}: ${costLine(save, step)}  ›`, { ...text.body(14, block ? PAL.steel : PAL.amber), wordWrap: { width: bw } }), step.items, step.tithes));
        y += 30;
        const b = makeButton(this, GAME_W / 2, y + 28, bw, 56, `Ascend  ·  cap ${cap} → ${cap + 10}`, () => {
          if (list.dragging) return;
          if (ascend(save, c.id)) {
            commit();
            this.reopen(c, 'grow');
          }
        }, { disabled: !!block, active: !block, fontSize: 18 });
        layer.add(b.all);
        y += 70;
      } else {
        layer.add(this.add.text(left, y, 'She stands at the highest level there is.', text.body(15, PAL.ivory)));
        y += 30;
      }
    }

    // Who she is.
    y += 6;
    layer.add(this.add.rectangle(GAME_W / 2, y, bw, 1, PAL.armorShadow));
    y += 12;
    const orderTier = ORDERS[c.order]?.tiers[0];
    const parts: Phaser.GameObjects.Text[] = [
      this.add.text(left, y, cls.summary, { ...text.body(16, PAL.ivory), wordWrap: { width: bw } }),
    ];
    layer.add(parts[0]);
    y += parts[0].height + 10;
    if (orderTier) {
      const t = this.add.text(left, y, `${c.order} blessing, by Sisters of the Order in the party:\n${ORDERS[c.order].tiers.map((x) => `${x.need}: ${x.desc}`).join('\n')}`, { ...text.body(15, PAL.muted), wordWrap: { width: bw } });
      layer.add(t);
      y += t.height + 10;
    }
    const hook = this.add.text(left, y, `"${c.hook}"  ·  age ${c.age}`, { ...text.body(15, PAL.steel), fontStyle: 'italic', wordWrap: { width: bw } });
    layer.add(hook);
    return y + hook.height + 16;
  }

  /** The star track, copies and Stigmata, and Take Vow or Tier Up with a before and after. */
  private vowsTab(list: ScrollArea, c: CrusaderDef, y: number): number {
    const save = game.save;
    const have = save.owned[c.id];
    const layer = list.content;
    const bw = GAME_W - PAD * 2 - 16;
    const left = PAD + 8;
    const tokens = have.tokens ?? 0;
    const tier = tierOf(have);
    const tint = TIER_COLOR[tier];
    const need = have.vow < MAX_VOW ? copiesFor(tier, have.vow) : 0;
    layer.add(this.add.text(left, y, tier ? `TIER ${ROMAN_RANK(tier)} · ${TIER_NAME[tier].toUpperCase()}` : 'TIER 0', text.hud(14, tier ? tint : PAL.steel)));
    layer.add(this.add.text(GAME_W - PAD - 8, y, `VOWS ${have.vow} / ${MAX_VOW}`, text.hud(14, PAL.amber)).setOrigin(1, 0));
    y += 44;
    for (let v = 0; v < MAX_VOW; v++) {
      const taken = v < have.vow;
      const ready = v === have.vow && need > 0 && tokens >= need;
      const star = this.add.star(GAME_W / 2 - 120 + v * 60, y, 5, 10, 22, taken ? tint : PAL.deepShadow).setStrokeStyle(2, taken || ready ? tint : PAL.armorShadow);
      layer.add(star);
      if (ready) this.tweens.add({ targets: star, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    }
    // The tiers ahead, as coloured pips.
    y += 36;
    for (let t = 0; t <= MAX_TIER; t++) layer.add(this.add.circle(GAME_W / 2 - 75 + t * 30, y, 7, t <= tier ? TIER_COLOR[t] : PAL.deepShadow).setStrokeStyle(1, TIER_COLOR[t]));
    y += 22;

    const stig = stigmataOf(save);
    const atFive = have.vow >= MAX_VOW;
    const done = oathComplete(have) || (atFive && tier >= MAX_TIER);
    const line = done
      ? 'Every tier and Vow is taken. She is wholly given.'
      : atFive
        ? `Five Vows kept. Tier up for ${TIER_STIGMATA[tier]} Stigmata (you hold ${stig}) and ${tierTithes(tier).toLocaleString('en-US')} Tithes.  ›`
        : `Next Vow: ${need} cop${need > 1 ? 'ies' : 'y'} of her (you hold ${tokens}) and ${vowCost(have)} Tithes.  ›`;
    const lineText = tapForSources(this, this.add.text(left, y, line, { ...text.body(15, tokens >= need || atFive ? PAL.amber : PAL.muted), wordWrap: { width: bw } }), atFive ? 'stigmata' : 'vows');
    layer.add(lineText);
    y += lineText.height + 10;
    if (!done) {
      const block = atFive ? tierBlock(save, have) : vowBlock(save, have);
      const after = this.preview(c, (o) => (atFive ? Object.assign(o, { tier: tierOf(o) + 1, vow: 0 }) : (o.vow += 1)));
      layer.add(this.add.text(left, y, `${atFive ? 'Tier up' : 'Take the Vow'}: ${this.diffText(sisterStats(save, c), after) || 'stats rise'}`, { ...text.body(15, PAL.ivory), wordWrap: { width: bw } }));
      y += 30;
      const b = makeButton(this, GAME_W / 2, y + 28, bw, 56, atFive ? `Tier Up  ·  ${TIER_STIGMATA[tier]} Stigmata` : `Take Vow  ·  ${need} cop${need > 1 ? 'ies' : 'y'}`, () => {
        if (list.dragging) return;
        if (atFive ? tierUp(save, c.id) : takeVow(save, c.id)) {
          commit();
          this.reopen(c, 'vows');
        }
      }, { disabled: !!block, active: !block, fontSize: 18 });
      layer.add(b.all);
      y += 72;
    }
    const skills = CLASS_SKILLS[c.classId];
    layer.add(this.add.text(left, y, 'VOW GIFTS', text.hud(12, PAL.steel)));
    y += 22;
    VOW_UPGRADES.forEach(([v, i]) => {
      const got = tier > 0 || have.vow >= v;
      layer.add(this.add.text(left, y, `${got ? '✓' : '·'}  Vow ${v}: ${skills[i].name}+ (+25%, shorter cooldown)`, text.body(15, got ? PAL.amber : PAL.muted)));
      y += 24;
    });
    const t = this.add.text(left, y + 6, `Each Vow: +${Math.round(VOW_BONUS * 100)}% stats. Each tier: +${Math.round(TIER_BONUS * 100)}% more, and the stars change colour. Vows start again on each tier and ask one more copy each.`, { ...text.body(14, PAL.steel), wordWrap: { width: bw } });
    layer.add(t);
    return y + t.height + 20;
  }

  /** Draws the skills into `layer` from `y`; returns where they end. */
  private skillsTab(layer: Phaser.GameObjects.Container, c: CrusaderDef, y: number): number {
    const save = game.save;
    const have = save.owned[c.id];
    const skills = CLASS_SKILLS[c.classId];
    const ranks = (from: number[]) => (from.length ? `RANK${from.length > 1 ? 'S' : ''} ${from[0]}${from.length > 1 ? `-${from[from.length - 1]}` : ''}` : 'ANY RANK');
    const left = PAD + 8;
    const width = GAME_W - PAD * 2 - 16;
    skills.forEach((s, i) => {
      const up = VOW_UPGRADES.find(([, idx]) => idx === i);
      const isUp = !!up && skillVow(have) >= up[0];
      const tag = [
        s.rite ? 'RITE · FULL ZEAL' : `SKILL ${['I', 'II', 'III'][i]} · ${ranks(s.from)}`,
        ...(s.cooldown ? [`COOLDOWN ${isUp ? s.cooldown - 1 : s.cooldown}`] : []),
        ...(up ? [isUp ? 'VOW UPGRADED +25%' : `VOW ${up[0]}: +25%`] : []),
      ].join(' · ');
      // skill-<id>.png (32 x 32) to the left of the name when present
      const icon = addArt(this, `skill-${s.id}`, left + 16, y + 18, 32);
      const tx = icon ? left + 44 : left;
      const name = this.add.text(tx, y, `${s.name}${isUp ? '+' : ''}`, { ...text.body(20, s.rite ? PAL.amber : PAL.ivory), fontStyle: '600' });
      const t = this.add.text(tx, y + 28, tag, text.hud(11, isUp ? PAL.amber : PAL.steel));
      const d = this.add.text(left, y + 46, s.desc, { ...text.body(15, PAL.muted), wordWrap: { width } });
      layer.add([...(icon ? [icon] : []), name, t, d]);
      // Tap the skill for its full description, with every effect explained.
      const open = () => showSkillDetail(this, { title: `${s.name}${isUp ? '+' : ''}`, color: s.rite ? PAL.amber : PAL.ivory, tags: tag, desc: s.desc, facts: skillFacts(c, s, skillLevels(save, c.id)[i], isUp) }, 60);
      for (const o of [name, d]) o.setInteractive({ useHandCursor: true }).on('pointerup', (p: Phaser.Input.Pointer) => p.getDistance() < 12 && open());
      // Skill level: Psalter Pages and Tithes raise it, up to MAX_SKILL_LEVEL.
      const lv = skillLevels(save, c.id)[i];
      const step = nextSkillStep(save, c.id, i);
      const block = skillBlock(save, c.id, i);
      const btn = makeButton(
        this,
        GAME_W - left - 60,
        y + 12,
        120,
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
        ? tapCost(this, this.add.text(left, y + 52 + d.height, `Lv ${lv + 1} (+6% effect): ${have.level < step.level ? `needs level ${step.level} · ` : ''}${stepText(save, step)}  ›`, text.body(14, block ? PAL.steel : PAL.amber)), step.items, step.tithes)
        : undefined;
      layer.add([...btn.all, ...(cost ? [cost] : [])]);
      y += 52 + d.height + (cost ? 24 : 0) + 14;
    });
    if (c.passive) {
      layer.add(this.add.rectangle(GAME_W / 2, y, width, 1, PAL.armorShadow));
      const name = this.add.text(left, y + 10, c.passive.name, { ...text.body(20, PAL.violet), fontStyle: '600' });
      const t = this.add.text(left, y + 38, `PASSIVE · ${c.rarity} ONLY`, text.hud(11, PAL.steel));
      const d = this.add.text(left, y + 56, c.passive.desc, { ...text.body(15, PAL.muted), wordWrap: { width } });
      layer.add([name, t, d]);
      const p = c.passive;
      for (const o of [name, d])
        o.setInteractive({ useHandCursor: true }).on('pointerup', (ptr: Phaser.Input.Pointer) => ptr.getDistance() < 12 && showSkillDetail(this, { title: p.name, color: PAL.violet, tags: `PASSIVE · ${c.rarity} · ALWAYS ON`, desc: p.desc }, 60));
      y += 56 + d.height;
    }
    return y + 16;
  }

  /** Her three slots, the Forge, and Auto-equip best; returns where they end. */
  private gearTab(layer: Phaser.GameObjects.Container, c: CrusaderDef, y0: number): number {
    const save = game.save;
    const worn = equipped(save, c.id);
    const bw = GAME_W - PAD * 2 - 8;
    const left = PAD + 18;
    const auto = autoEquipPlan(save, c);
    const ab = makeButton(this, GAME_W / 2, y0 + 20, bw, 42, auto.length ? `Auto-equip best  ·  ${auto.length} piece${auto.length > 1 ? 's' : ''}` : 'Wearing her best', () => {
      for (const g of autoEquipPlan(save, c)) equip(save, c.id, g.uid);
      commit();
      this.reopen(c, 'gear');
    }, { fontSize: 16, active: auto.length > 0, disabled: !auto.length, icon: 'shield' });
    layer.add(ab.all);
    GEAR_SLOTS.forEach((slot, i) => {
      const y = y0 + 110 + i * 122;
      const item = worn.find((g) => g.slot === slot);
      const edge = item ? RARITY_COLOR[item.rarity] : PAL.armorShadow;
      // ui-gear-slot.png (9-slice row, tinted by the worn piece's rarity) when present
      const row = nine(this, 'ui-gear-slot', GAME_W / 2, y, bw, 112);
      layer.add(row ? row.setTint(item ? edge : 0xffffff) : this.add.rectangle(GAME_W / 2, y, bw, 112, 0x1b131d).setStrokeStyle(1, edge));
      const set = gearSet(item?.set);
      layer.add(this.add.text(left, y - 46, `${SLOT_NAME[slot].toUpperCase()} · ${SLOT_HINT[slot].toUpperCase()}`, text.hud(12, PAL.steel)));
      if (set) layer.add(this.add.text(GAME_W - 168, y - 46, `${set.name.toUpperCase()} SET`, text.hud(12, set.color)).setOrigin(1, 0));
      if (item) {
        layer.add([
          this.add.text(left, y - 28, `${item.name}${item.level ? ` +${item.level}` : ''}`, { ...text.body(19, RARITY_COLOR[item.rarity]), fontStyle: '600' }),
          this.add.text(left, y + 0, `${item.rarity} · ${formatStat(item.main, mainValue(item))} · +${formatPower(gearPower(save, c, item))} power`, text.body(15, PAL.ivory)),
          this.add.text(left, y + 22, item.subs.map((s) => formatStat(s.stat, s.value)).join('  ') || 'No substats', text.body(14, PAL.muted)),
        ]);
        const can = !enhanceBlock(save, item) || !rerollBlock(save, item);
        const forge = makeButton(this, GAME_W - PAD - 76, y - 24, 120, 44, 'Forge', () => this.forge(c, item), { active: can, fontSize: 16 });
        layer.add(forge.all);
      } else {
        layer.add(this.add.text(left, y - 18, 'Empty', text.body(19, PAL.steel)));
      }
      const change = makeButton(this, GAME_W - PAD - 76, y + 28, 120, 40, item ? 'Change' : 'Equip', () => this.gearPicker(c, slot), { fontSize: 15 });
      layer.add(change.all);
    });
    const b = gearBonus(worn);
    const parts = (Object.keys(b) as (keyof typeof b)[]).filter((k) => b[k] > 0).map((k) => formatStat(k, b[k]));
    const sets = setsWorn(worn)
      .filter((x) => x.count >= 2)
      .map((x) => `${x.set.name} ×${x.count}`);
    const y = y0 + 110 + GEAR_SLOTS.length * 122 - 50;
    const t = this.add
      .text(GAME_W / 2, y, parts.length ? `Gear: ${parts.join('  ')}${sets.length ? `\nSets: ${sets.join(', ')}` : ''}` : 'Crusades yield gear. Elites and bosses always do.', {
        ...text.body(15, parts.length ? PAL.amber : PAL.muted),
        align: 'center',
        wordWrap: { width: GAME_W - 70 },
      })
      .setOrigin(0.5, 0);
    layer.add(t);
    return y + t.height + 16;
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
      return t;
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
    const enhText = section(
      item.level >= MAX_GEAR_LEVEL ? `REFINE · +${item.level} OF +${MAX_REFINE}` : `ENHANCE · +${item.level} OF +${MAX_GEAR_LEVEL}, THEN REFINE TO +${MAX_REFINE}`,
      maxed
        ? 'Fully refined.'
        : `+${next.level}: ${formatStat(item.main, mainValue(next))}${SUB_UPGRADE_LEVELS.includes(next.level) && item.subs.length ? ' and a random substat grows' : ''}.\nCost: ${enhanceCost(item)} Tithes${iron ? ` and ${ironText(iron)}` : ''}.`,
      PAL.ivory,
    );
    if (!maxed) tapCost(this, enhText, iron, enhanceCost(item));
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
    const subText = section(
      'SUBSTATS',
      item.subs.length
        ? `${item.subs.map((s) => formatStat(s.stat, s.value)).join('   ')}\nReroll gives each a new stat and keeps its strength. Cost: ${ironText(REROLL_COST.items)} and ${REROLL_COST.tithes} Tithes.`
        : 'R pieces have no substats.',
      PAL.ivory,
    );
    if (item.subs.length) tapCost(this, subText, REROLL_COST.items, REROLL_COST.tithes);
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
    layer.add(tapCost(this, this.add.text(GAME_W / 2, GAME_H - 118, `You hold ${own('iron1')}, ${own('iron2')}, ${own('iron3')} · ${save.tithes.toLocaleString('en-US')} Tithes  ›`, { ...text.body(15, PAL.muted), align: 'center', wordWrap: { width } }).setOrigin(0.5), { iron1: 1, iron2: 1, iron3: 1 }));
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
    const shown = items;
    // Every piece for the slot scrolls (drag or wheel) between the title and the buttons.
    const listTop = 92;
    const listBottom = GAME_H - 100;
    const list = addScrollArea(this, listTop, listBottom, { parent: layer });
    const inList = () => !list.dragging && this.input.activePointer.y >= listTop && this.input.activePointer.y <= listBottom;
    if (!shown.length) layer.add(this.add.text(GAME_W / 2, 200, 'No pieces for this slot yet.\nCrusade, and the dead will provide.', { ...text.body(18, PAL.muted), align: 'center' }).setOrigin(0.5));
    shown.forEach((g, i) => {
      const y = 140 + i * 92;
      const row = this.add.rectangle(GAME_W / 2, y, GAME_W - 56, 84, 0x1b131d).setStrokeStyle(1, RARITY_COLOR[g.rarity]);
      list.tap(row, () => {
        equip(save, c.id, g.uid);
        commit();
        this.reopen(c, 'gear');
      });
      const wearer = g.on ? CRUSADERS.find((x) => x.id === g.on)?.name.split(' ')[0] : undefined;
      list.content.add([
        row,
        this.add.text(42, y - 32, `${g.name}${g.level ? ` +${g.level}` : ''}`, { ...text.body(19, RARITY_COLOR[g.rarity]), fontStyle: '600' }),
        this.add.text(42, y - 8, `${g.rarity} · ${formatStat(g.main, mainValue(g))}${g.subs.length ? '  ·  ' + g.subs.map((s) => formatStat(s.stat, s.value)).join('  ') : ''}`, text.body(15, PAL.ivory)),
        this.add.text(42, y + 14, `${gearSet(g.set) ? `${gearSet(g.set)!.name.toUpperCase()} · ` : ''}${g.on === c.id ? 'Worn by her' : wearer ? `Worn by ${wearer}: tap to take it` : 'Tap to equip'}`, text.hud(12, g.on === c.id ? PAL.amber : PAL.steel)),
      ]);
      // What putting it on would do to her power
      if (g.on !== c.id) {
        const d = gearSwapDelta(save, c, g);
        list.content.add(this.add.text(GAME_W - 40, y - 32, `${d >= 0 ? '▲ +' : '▼ '}${formatPower(d)}`, text.hud(13, d > 0 ? 0x8fc07a : d < 0 ? 0xe58a8a : PAL.steel)).setOrigin(1, 0));
      }
      if (!g.on) {
        const melt = makeButton(this, GAME_W - 92, y + 12, 104, 40, `Melt +${salvageValue(g)}`, () => {
          if (!inList()) return;
          salvage(save, g.uid);
          commit();
          layer.destroy();
          this.gearPicker(c, slot);
        }, { fontSize: 14 });
        list.content.add(melt.all);
      }
    });
    list.fit(140 + shown.length * 92 - 30);
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

/** Plain facts about a skill for its detail card: damage, type, reach, level. */
function skillFacts(c: CrusaderDef, s: SkillDef, lv: number, vowUp: boolean): string[] {
  const f = (1 + 0.06 * (lv - 1)) * (vowUp ? 1.25 : 1);
  const out: string[] = [];
  const type = DMG_NAME[s.dmg ?? dmgTagOf(c)];
  if (s.mult) out.push(`${type} damage: ${Math.round(s.mult * f * 100)}% of her attack${s.target === 'allEnemies' ? ' to every enemy' : ''}.`);
  if (s.heal) out.push(`Heals ${Math.round(s.heal * f * 100)}% of her attack.`);
  if (s.healPct) out.push(`Heals ${Math.round(s.healPct * f * 100)}% of max HP.`);
  if (s.shieldPct) out.push(`Shield: ${Math.round(s.shieldPct * f * 100)}% of max HP.`);
  if (s.poison) out.push(`Each tick: ${Math.round(s.poison.mult * f * 100)}% of her attack for ${s.poison.turns} turns.`);
  if (s.bleed) out.push(`Bleed: ${Math.round(s.bleed.mult * f * 100)}% of her attack a turn for ${s.bleed.turns} turns.`);
  if (s.from.length) out.push(`Used from rank ${s.from.join(', ')}.`);
  if (s.reach?.length) out.push(`Reaches enemy rank ${s.reach.join(', ')}.`);
  out.push(`Level ${lv}: +${Math.round((f / (vowUp ? 1.25 : 1) - 1) * 100)}% effect${vowUp ? ', and +25% from her Vow' : ''}.`);
  return out;
}
