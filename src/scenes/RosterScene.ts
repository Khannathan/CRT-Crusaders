import { sfx } from '../audio/sfx';
import Phaser from 'phaser';
import { saveSettings, settings } from '../state/settings';
import { GAME_H, GAME_W, PAL } from '../config';
import { CLASSES, RARITY_COLOR, classIconFor } from '../data/classes';
import { CRUSADERS, rankTitle } from '../data/crusaders';
import { autoEquipPlan, formatPower, gearPower, gearSwapDelta, sisterPower } from '../systems/power';
import { ORDERS } from '../data/orders';
import type { OwnedCrusader } from '../state/save';
import type { Stats } from '../systems/stats';
import { bondInfo, bondStatText } from '../systems/bonds';
import { addOrderSigil } from '../ui/sisterCard';
import { showBadgeKey } from '../ui/portraitBadges';
import { passes, sortControls, sortRoster, sortState } from '../ui/sisterSort';
import type { ScrollArea } from '../ui/scroll';
import { DMG_NAME, descNoCooldown, type SkillDef } from '../data/skills';
import { KITS, kitSkills } from '../data/kits';
import { showDetail as showSkillDetail } from '../ui/glossary';
import { dmgTagOf } from '../data/classes';
import { VOW_UPGRADES, cooldownSec } from '../systems/combat';
import type { CrusaderDef } from '../data/types';
import { commit, game } from '../state/game';
import { MAX_TIER, MAX_VOW, TIER_BONUS, TIER_COLOR, TIER_NAME, TIER_STIGMATA, VOW_BONUS, copiesFor, oathComplete, oathMult, skillVow, standIn, STAND_IN_TIER, STIGMATA_PER_COPY, stigmataOf, takeVow, tierBlock, tierOf, tierTithes, tierUp, vowBlock, vowCost } from '../systems/tiers';
import {
  GEAR_SLOTS,
  GRADE_COLOR,
  SLOT_HINT,
  SLOT_NAME,
  confessBlock,
  enhanceBlock,
  equip,
  equipped,
  formatStat,
  gearBonus,
  gearName,
  gearOf,
  mainValue,
  powerAwake,
  salvage,
  salvageValue,
  teaches,
  unequip,
  type GearItem,
  type GearSlot,
} from '../systems/gear';
import { GRADES } from '../data/loot';
import { gearKind, powerLine, showGearCard, showIndex, showLootFilter, subLine } from '../ui/gearCard';
import { levelCap, sisterStats } from '../systems/stats';
import { UNCTIONS, UNCTION_EXP, expOf, expToNext, feedPlan, usePlan, useUnction } from '../systems/exp';
import { drawItemIcon } from '../ui/itemIcon';
import { ascend, ascendBlock, costLine, nextAscension } from '../systems/ascension';
import { SYMBOL_ASC, WAKE_COST, WAKE_TITHES, raiseSymbol, symbolBlock, symbolPerks, symbolStatMult, upgradeCost, weaponOf } from '../systems/symbols';
import { weaponKey } from '../ui/weaponArt';
import { ROMAN_RANK } from '../systems/rank';
import { VOW_LITANY, VOW_STAT, VOW_ZEAL, secondTitle, takeSecondVows, tookVows, vowBlock as secondVowBlock, vowTrials } from '../systems/secondVows';
import { CANON_STAT, MAX_CANON, PATHS, TRAITS, canCanonize, canonBlock, canonCost, canonOf, canonize, pointsLeft, resetTraits, takeTrait, traitBlock, traitPoints, traitsOf } from '../systems/canon';
import { MAX_LEVEL } from '../systems/stats';
import { countOf, itemDef, type ItemId } from '../systems/items';
import { MAX_SKILL_LEVEL, nextSkillStep, raiseSkill, skillBlock, skillLevels, stepText } from '../systems/skillLevels';
import { makeButton } from '../ui/button';
import { confirmSheet } from '../ui/confirmSheet';
import { meltSpares, quickVowPlan, spareGear, spareValue, takeQuickVows } from '../systems/quick';
import { toast } from '../ui/modeScreen';
import { pickParty } from '../ui/partyPicker';
import { current } from '../state/run';
import { RITE_LEVELS, SANCT_LITANY, SANCT_MAX, SANCT_STEPS, finishRite, hasRite, motesOf, riteBattle, riteBest, riteBlock, riteEntriesLeft, riteReward, riteTarget, sanctBlock, sanctify, sanctOf, sweepRite } from '../systems/relicRites';
import { CURRENCY_BAR_H, addCurrencyBar } from '../ui/currencyBar';
import { addGroupStrip } from '../ui/nav';
import { addSplash, hasSplash, loadSplash, portraitKey, queueSplash } from '../ui/placeholderPortrait';
import { SisterSprite, fullKey } from '../ui/sisterSprite';
import { nine } from '../ui/skin';
import { CARD_COLS, CARD_GAP, CARD_H, cardSlot, drawRosterCard } from '../ui/rosterCard';
import { addScrollArea } from '../ui/scroll';
import { showSources, tapCost, tapForSources } from '../ui/sources';
import { TAB_BAR_H, addTabBar } from '../ui/tabBar';
import { PAD, fitLine, addArt, addBackdrop, addBadge, addFrame, addScreenGlow, fade, noOrphan, text } from '../ui/theme';
import { fightMarks, joinMarks, needMarks } from '../systems/pickMarks';

type Tab = 'grow' | 'vows' | 'skills' | 'gear' | 'symbol' | 'canon';
const TABS: [Tab, string][] = [
  ['grow', 'Grow'],
  ['vows', 'Vows'],
  ['skills', 'Skills'],
  ['gear', 'Gear'],
  ['symbol', 'Weapon'],
  ['canon', 'Canon'],
];
const STAT_LABEL = { atk: 'ATK', hp: 'HP', armor: 'ARM', spd: 'SPD' } as const;

/** Her page's layout: portrait, name block, stat strip, then the sheet. */
const BUST = 320;
const HERO_Y = 210;
const HERO_H = 470;
/** Full-body figures draw at twice their 128 x 192 pixel size, so the pixels stay square. */
const FIGURE_H = 384;
const FIGURE_Y = 250;
const NAME_Y = 400;
/** Where her pixel figure stands in front of her splash: lower right, feet just above her name. */
const STEP_X = GAME_W - 104;
const STEP_FEET = NAME_Y - 26;
const STATS_Y = 506;
const SHEET_Y = 544;

/** Every Sister: sworn ones first (highest rarity first), the rest as silhouettes. */
export class RosterScene extends Phaser.Scene {
  private openId?: string;
  private tab: Tab = 'grow';
  /** The Unction chosen on the Grow tab. */
  private unction?: ItemId;
  /** The grid's Sisters in order, for swiping on her page. */
  private order: string[] = [];
  /** Kept across restarts so levelling up a Sister doesn't jump the list back to the top. */
  private static scrollY = 0;
  /** Sister page hero: her splash art (true) or her animated pixel figure (false). */
  private dragged = false;
  private detailOpen = false;

  constructor() {
    super('Roster');
  }

  /** A line to show once the page opens (a Relic Rite's result). */
  private notice?: string;

  init(data: { openId?: string; tab?: Tab | 'oath'; notice?: string }) {
    this.openId = data?.openId;
    this.notice = data?.notice;
    // 'oath' was the old name of the Grow and Vows page.
    this.tab = !data?.tab ? 'grow' : data.tab === 'oath' ? 'vows' : data.tab;
  }

  create() {
    addScreenGlow(this);
    addCurrencyBar(this);
    const owned = game.save.owned;
    const count = Object.keys(owned).length;
    // The Sisters tab's sub-tabs sit where the title was; the count and Quick Vow share a row under them.
    const top = addGroupStrip(this, CURRENCY_BAR_H + 4) + 42;
    this.add.text(PAD, top - 26, `${count} / ${CRUSADERS.length} SWORN`, text.hud(14, PAL.muted)).setOrigin(0, 0.5);

    // Quick Vow: every Vow her copies already pay for, across the whole roster, in one oath.
    if (count) {
      const qv = quickVowPlan(game.save);
      makeButton(this, GAME_W - PAD - 172, top - 26, 168, 40, qv.vows ? `Quick Vow · ${qv.vows}` : 'Quick Vow', () => !this.detailOpen && this.quickVow(), { fontSize: 15, active: qv.vows > 0, disabled: !qv.vows, icon: 'seal' });
    }

    const f = sortState.filter;
    const shown = CRUSADERS.filter((c) => (f.unsworn || owned[c.id]) && passes(c));
    const sorted = sortRoster(game.save, shown);
    this.order = sorted.map((c) => c.id);

    // Sort (tap to cycle) and Filter: the same settings every Sister picker uses.
    sortControls(this, PAD + 205, top + 22, 410, () => {
      RosterScene.scrollY = 0;
      this.scene.restart({});
    }, { roster: true, depth: 20 });
    // What the portrait corners mean.
    const key = makeButton(this, GAME_W - PAD - 26, top + 22, 48, 40, '?', () => {
      const sample = sorted.find((c) => owned[c.id]) ?? sorted[0];
      if (sample) showBadgeKey(this, sample, game.save);
    }, { fontSize: 20 });
    key.all.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth?.(20));
    if (!sorted.length) this.add.text(GAME_W / 2, top + 140, 'No Sister answers these filters.', text.body(18, PAL.muted)).setOrigin(0.5);

    // Cards as in the preview: portrait, rarity badge, name and level underneath.
    // The same card shows in every Sister picker (ui/rosterCard.ts).
    const ch = CARD_H;
    const gap = CARD_GAP;
    const cols = CARD_COLS;
    const y0 = top + 56;
    const firstCard = this.children.list.length;
    sorted.forEach((c, i) => {
      const { left, top: topY } = cardSlot(i, y0);
      const { hit } = drawRosterCard(this, left, topY, c, game.save);
      hit.setInteractive({ useHandCursor: true });
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
    if (this.notice) toast(this, this.notice, GAME_H / 2);
  }


  /** Shows what Quick Vow would swear, then swears it. */
  private quickVow() {
    const save = game.save;
    const plan = quickVowPlan(save);
    if (!plan.vows) return toast(this, 'No Vow is ready. Pull again, and bring her sisters home!', GAME_H / 2);
    const lines = plan.steps.map((s) => `${s.name.split(' ')[0]}: Vow ${s.from} → ${s.to}`);
    confirmSheet(this, `Swear ${plan.vows} Vow${plan.vows > 1 ? 's' : ''}?`, lines, 'Swear them all!', () => {
      const done = takeQuickVows(save);
      commit();
      this.scene.restart({ notice: `${done.vows} Vow${done.vows > 1 ? 's' : ''} sworn! Their faith hardens!` });
    }, `Cost: ${plan.tithes.toLocaleString('en-US')} Tithes. Copies only: your Stigmata stay sealed.`);
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
    const vows = !(have.vow >= MAX_VOW ? tierBlock(save, have) : vowBlock(save, have, c.rarity));
    const skills = kitSkills(c.id, c.classId).some((_, i) => !skillBlock(save, c.id, i));
    const worn = new Set(equipped(save, c.id).map((g) => g.slot));
    const gear = GEAR_SLOTS.some((s) => !worn.has(s) && gearOf(save).some((g) => g.slot === s && !g.on));
    const symbol = (have.asc ?? 0) >= SYMBOL_ASC && !symbolBlock(save, c.id);
    const canon = canCanonize(have) && (!canonBlock(save, c.id) || pointsLeft(have) > 0);
    return { grow, vows, skills, gear, symbol, canon };
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

    // What fills the hero: her splash with her pixel figure in front (the default), the
    // splash alone, or her figure alone (settings.sisterView, cycled by the View button).
    const splashArt = !!have && hasSplash(c.id);
    const view = splashArt ? settings.sisterView : 'sprite';
    const showSplash = view !== 'sprite';
    const fullArt = this.textures.exists(fullKey(c.id));
    // Her figure, breathing; tap her and she shows off a strike or a blessing.
    let figure: SisterSprite | undefined;
    let splash: string | undefined;
    let poses = 0;
    // The bust only stands in when there is no splash and no figure to show.
    const bust = this.add.image(GAME_W / 2, HERO_Y, portraitKey(c.id)).setDisplaySize(BUST, BUST);
    if (!have) bust.setTint(0x111111);
    bust.setVisible(!showSplash && !fullArt);
    layer.add(bust);
    const splashSlot = layer.length; // the splash goes in under the figure
    if (view === 'both' && fullArt) {
      figure = new SisterSprite(this, c.id, STEP_X, STEP_FEET, 1, order?.color ?? tint);
      layer.add(figure.root);
    } else if (!showSplash && fullArt) {
      figure = new SisterSprite(this, c.id, GAME_W / 2, FIGURE_Y + FIGURE_H / 2 - 16, 2, order?.color ?? tint);
      if (!have) figure.silhouette();
      layer.add(figure.root);
    }
    if (showSplash) {
      loadSplash(this, c.id).then((key) => {
        if (!key || !layer.active) return;
        splash = key;
        const art = addSplash(this, c.id, GAME_W / 2, HERO_H / 2, GAME_W, HERO_H, 'hero');
        const parts = [art, fade(this, GAME_W / 2, HERO_H / 2, GAME_W, HERO_H, 0.45, 0x0d090f)];
        // A dark wash along the top so Power and the buttons read over the art.
        const top = this.add.graphics();
        for (let i = 0; i < 14; i++) top.fillStyle(0x0d090f, 0.06 * (14 - i)).fillRect(0, i * 10, GAME_W, 10);
        layer.addAt([...parts, top], splashSlot);
        this.tweens.add({ targets: art, alpha: { from: 0, to: 1 }, duration: 160 });
      });
    }
    // Load the Sisters either side now, so the arrows flip straight to their art.
    const at = this.order.indexOf(c.id);
    for (const d of [1, -1]) {
      const id = this.order[(at + d + this.order.length) % this.order.length];
      if (id && save.owned[id]) queueSplash(this, id);
    }
    if (!this.load.isLoading()) this.load.start();
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
      else if (splash && !(figure && p.x > STEP_X - 64 && p.y > STEP_FEET - 180 && p.y < STEP_FEET + 10)) this.viewSplash(splash);
      else if (figure && have) [() => figure?.attack(-1), () => figure?.cast(order?.color ?? tint), () => figure?.cast(order?.color ?? tint, true)][poses++ % (figure.hasPoses ? 3 : 2)]();
    });
    layer.add(swipe);
    if (splashArt) {
      // Cycles Both (splash and figure) → Splash only → Sprite only, remembered on this device.
      const label = { both: 'Both', splash: 'Splash', sprite: 'Sprite' }[view];
      const flip = makeButton(this, PAD + 52, 128, 104, 40, label, () => {
        settings.sisterView = view === 'both' ? 'splash' : view === 'splash' ? 'sprite' : 'both';
        saveSettings();
        layer.destroy();
        this.showDetail(c, tab);
      }, { fontSize: 15 });
      layer.add(flip.all);
    }

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
      // Her epithet, then her rank, class and role.
      fitLine(this.add.text(PAD + 4, NAME_Y + 4, c.title ?? cls.name, { ...text.body(16, tint), fontStyle: 'italic' }), GAME_W - 2 * PAD - 8),
      this.add.text(PAD + 4, NAME_Y + 26, tookVows(have) ? `✠ ${secondTitle(c.classId)} · ${cls.role}` : `${rankTitle(c)} · ${cls.name} · ${cls.role}`, text.body(14, tookVows(have) ? 0xf2d27a : PAL.ivory)),
    ]);
    const sigil = addOrderSigil(this, PAD + 16, NAME_Y + 56, c.order, 24);
    if (sigil) layer.add(sigil);
    layer.add(this.add.text(PAD + (sigil ? 36 : 4), NAME_Y + 56, `${c.order}${have ? '' : '  ·  her seal waits at the Altar!'}`, text.body(15, PAL.muted)).setOrigin(0, 0.5));
    const emblem = addArt(this, classIconFor(this, c.classId), GAME_W - PAD - 26, NAME_Y - 12, 44);
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
      const go = makeButton(this, GAME_W / 2, GAME_H - 70, 260, 56, 'To the Altar!', () => this.scene.start('Recruit'), { fontSize: 18, active: true });
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
    const end = tab === 'grow' ? this.growTab(list, c, y0) : tab === 'vows' ? this.vowsTab(list, c, y0) : tab === 'skills' ? this.skillsTab(list.content, c, y0) : tab === 'symbol' ? this.symbolTab(list, c, y0) : tab === 'canon' ? this.canonTab(list, c, y0) : this.gearTab(list.content, c, y0);
    list.fit(end);
  }

  /** The next (or previous) Sister in the roster's order, on the same tab. */
  /** Her splash art, whole, over everything; tap to close. */
  private viewSplash(key: string) {
    const layer = this.add.container(0, 0).setDepth(40);
    const bg = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.94).setInteractive();
    const src = this.textures.get(key).getSourceImage();
    const scale = Math.min(GAME_W / src.width, (GAME_H - 60) / src.height);
    const img = this.add.image(GAME_W / 2, GAME_H / 2 - 10, key).setScale(scale * 0.96).setAlpha(0);
    const hint = this.add.text(GAME_W / 2, GAME_H - 22, 'Tap to close', text.hud(13, PAL.steel)).setOrigin(0.5);
    layer.add([bg, img, hint]);
    this.tweens.add({ targets: img, alpha: 1, scale, duration: 220, ease: 'Quad.out' });
    bg.once('pointerup', () => layer.destroy());
  }

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
      ['Bond', bondStatText(bondInfo(save, c.id).level) || 'None yet'],
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
    layer.add(this.add.text(left, y + 16, atCap ? (into >= need ? 'EXP full. Ascend her to grow!' : `EXP ${into.toLocaleString('en-US')} / ${need.toLocaleString('en-US')} banked at her cap`) : `EXP ${into.toLocaleString('en-US')} / ${need.toLocaleString('en-US')}`, text.body(13, PAL.muted)));
    y += 40;
    if (!atCap) {
      // Unction held: tap one to choose it, hold for where to get more.
      const pick = this.unction && countOf(save, this.unction) ? this.unction : (UNCTIONS.find((u) => countOf(save, u) > 0) ?? UNCTIONS[0]);
      this.unction = pick;
      const uw = (bw - 16) / 3;
      UNCTIONS.forEach((u, i) => {
        const x = left + i * (uw + 8);
        const on = u === pick;
        const held = countOf(save, u);
        const box = this.add.rectangle(x, y, uw, 50, on ? 0x2e2030 : 0x1a121c).setOrigin(0, 0).setStrokeStyle(on ? 2 : 1, on ? PAL.amber : PAL.armorShadow);
        layer.add(box);
        layer.add(drawItemIcon(this, x + 24, y + 25, u, 36));
        layer.add(this.add.text(x + 48, y + 7, `×${held}\n${UNCTION_EXP[u].toLocaleString('en-US')} EXP`, text.body(13, held ? PAL.ivory : PAL.steel)));
        box.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          if (list.dragging) return;
          if (!held) return void showSources(this, u);
          this.unction = u;
          this.reopen(c, 'grow');
        });
      });
      y += 60;
      const one = this.preview(c, (o) => (o.level += 1));
      layer.add(this.add.text(left, y, `Next level: ${this.diffText(now, one)}`, { ...text.body(15, PAL.ivory), wordWrap: { width: bw } }));
      y += 30;
      const w = (bw - 24) / 4;
      ([['Use 1', 1, false], ['Use 10', 10, false], ['+1 Level', 1, true], ['Use All', Infinity, false]] as const).forEach(([label, n, lv], i) => {
        const plan = usePlan(save, c.id, pick, n, lv);
        const can = plan.count > 0;
        const sub = can ? (lv ? `${plan.count} used` : `${plan.tithes.toLocaleString('en-US')} T`) : plan.block === 'unction' ? 'Too few' : plan.block === 'tithes' ? 'Tithes' : 'Full';
        const b = makeButton(this, left + w / 2 + i * (w + 8), y + 30, w, 58, `${label}${can && n === Infinity ? ` (${plan.count})` : ''}\n${sub}`, () => {
          if (list.dragging || !can) return;
          if (useUnction(save, c.id, pick, n, lv) >= 0) {
            sfx('unction');
            commit();
            this.reopen(c, 'grow');
          }
        }, { disabled: !can, active: can && i === 2, fontSize: 13 });
        layer.add(b.all);
      });
      y += 72;
      const block = usePlan(save, c.id, pick, 1).block;
      if (block) {
        layer.add(tapForSources(this, this.add.text(left, y, block === 'unction' ? 'Short of Unction. Battles, the Vigil and the Road give EXP too ›' : 'Short of Tithes. Where to earn more ›', { ...text.body(14, PAL.amber), wordWrap: { width: bw } }), block === 'unction' ? 'unction1' : 'tithes'));
        y += 44;
      } else {
        layer.add(this.add.text(left, y, '1 Tithe per 10 EXP. Nothing spills past her cap.', { ...text.body(13, PAL.muted), wordWrap: { width: bw } }));
        y += 28;
      }
    } else {
      const step = nextAscension(save, c.id);
      if (step) {
        const block = ascendBlock(save, c.id);
        layer.add(this.add.text(left, y, `Level ${cap} is her cap. Ascend her to ${cap + 10}!`, { ...text.body(15, PAL.ivory), wordWrap: { width: bw } }));
        y += 26;
        layer.add(tapCost(this, this.add.text(left, y, `Ascension ${ROMAN_RANK((have.asc ?? 0) + 1)}: ${costLine(save, step)}  ›`, { ...text.body(14, block ? PAL.steel : PAL.amber), wordWrap: { width: bw } }), step.items, step.tithes));
        y += 30;
        const b = makeButton(this, GAME_W / 2, y + 28, bw, 56, `Ascend  ·  cap ${cap} → ${cap + 10}`, () => {
          if (list.dragging) return;
          if (ascend(save, c.id)) {
            sfx('ascend');
            commit();
            this.reopen(c, 'grow');
          }
        }, { disabled: !!block, active: !block, fontSize: 18 });
        layer.add(b.all);
        y += 70;
      } else {
        layer.add(this.add.text(left, y, 'She stands at the summit of the faith.', text.body(15, PAL.ivory)));
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
      const t = this.add.text(left, y, `${c.order} favour, by her Order's Sisters in the party:\n${ORDERS[c.order].tiers.map((x) => `${x.need}: ${x.desc}`).join('\n')}`, { ...text.body(15, PAL.muted), wordWrap: { width: bw } });
      layer.add(t);
      y += t.height + 10;
    }
    const hook = this.add.text(left, y, `Age ${c.age}  ·  "${noOrphan(c.hook)}"`, { ...text.body(15, PAL.steel), fontStyle: 'italic', wordWrap: { width: bw } });
    layer.add(hook);
    return y + hook.height + 16;
  }

  /** Her signature weapon (once her Holy Symbol): woken after her first Ascension, raised on Grace to +15, +20 or +25 by tier. */
  private symbolTab(list: ScrollArea, c: CrusaderDef, y: number): number {
    const save = game.save;
    const have = save.owned[c.id];
    const layer = list.content;
    const bw = GAME_W - PAD * 2 - 16;
    const left = PAD + 8;
    const lv = have.symbol;
    const woke = lv !== undefined;
    const w = weaponOf(c);
    const max = w.max;
    // Her weapon art (from her prop sheet) or her class's stand-in, in a frame of her tier's colour; dark while it sleeps.
    const artX = GAME_W - PAD - 62;
    layer.add(this.add.rectangle(artX, y + 52, 104, 104, 0x0d090f).setStrokeStyle(2, woke ? w.color : PAL.armorShadow));
    const art = this.add.image(artX, y + 52, weaponKey(this, c)).setDisplaySize(96, 96);
    layer.add(woke ? art : art.setTint(0x4a3c48));
    const tw = bw - 120;
    layer.add(this.add.text(left, y, woke ? `SIGNATURE WEAPON  +${lv} / ${max}` : 'SIGNATURE WEAPON  ·  SLEEPING', text.hud(14, woke ? PAL.amber : PAL.steel)));
    y += 24;
    const tier = this.add.text(left + 8, y + 4, w.label.toUpperCase(), text.hud(12, w.color));
    layer.add([this.add.rectangle(left, y, tier.width + 16, tier.height + 8, 0x0d090f).setOrigin(0, 0).setStrokeStyle(1, w.color), tier]);
    y += 30;
    const name = this.add.text(left, y, w.name, { ...text.display(19, woke ? 0xfff1d6 : PAL.muted), wordWrap: { width: tw } });
    layer.add(name);
    y = Math.max(y + name.height + 8, y + 58);
    if (w.look) {
      const t = this.add.text(left, y, `${w.look[0].toUpperCase()}${w.look.slice(1)}.`, { ...text.body(14, PAL.muted), fontStyle: 'italic', wordWrap: { width: bw } });
      layer.add(t);
      y += t.height + 8;
    }
    // Her Relic: the charm she carries on the weapon, woken at +5.
    const relic = KITS[c.id]?.relic;
    if (relic || c.relic) {
      const icon = addArt(this, `symbol-${c.id}`, left + 14, y + 14, 28);
      if (icon) layer.add(lv !== undefined && lv >= 5 ? icon : icon.setTint(0x4a3c48));
      const t = this.add.text(left + (icon ? 36 : 0), y, `Her Relic: ${relic?.name ?? c.relic}. It wakes on her weapon at +5.`, { ...text.body(14, PAL.steel), wordWrap: { width: bw - (icon ? 36 : 0) } });
      layer.add(t);
      y += Math.max(t.height, 28) + 10;
    }
    // Stats now, and after the next step.
    const pct = (l: number | undefined) => Math.round((symbolStatMult(l) - 1) * 1000) / 10;
    const next = !woke ? 0 : lv! < max ? lv! + 1 : undefined;
    layer.add(this.add.text(left, y, woke ? `All her stats +${pct(lv)}%${next !== undefined ? `  →  +${pct(next)}% at +${next}` : ''}` : `All her stats +${pct(0)}% once woken`, text.body(16, PAL.ivory)));
    y += 30;
    // The blessings (three for Epic and Legendary, four for Mythic, five for Divine Arsenal).
    for (const p of symbolPerks(c)) {
      const on = woke && lv! >= p.at;
      const d = this.add.text(left + 10, y + 24, p.desc, { ...text.body(15, on ? PAL.ivory : PAL.muted), wordWrap: { width: bw - 20 } });
      const h = Math.max(52, d.height + 30);
      layer.add(this.add.rectangle(GAME_W / 2, y + h / 2, bw, h, on ? 0x2a1e24 : 0x150e17).setStrokeStyle(1, on ? PAL.amber : PAL.armorShadow));
      layer.add(this.add.text(left + 10, y + 6, `+${p.at}  ${p.name.toUpperCase()}`, text.hud(12, on ? PAL.amber : PAL.steel)));
      layer.add(d);
      y += h + 8;
    }
    y += 4;
    // Grace held (tap for sources).
    const uw = bw / 3;
    (['grace1', 'grace2', 'grace3'] as const).forEach((g, i) => {
      const x = left + i * uw;
      layer.add(drawItemIcon(this, x + 20, y + 18, g, 36));
      layer.add(tapForSources(this, this.add.text(x + 44, y + 4, `×${countOf(save, g)}\n+${i * 5 + 1} to +${i === 2 ? max : i * 5 + 5}`, text.body(13, countOf(save, g) ? PAL.ivory : PAL.steel)), g));
    });
    y += 50;
    const block = symbolBlock(save, c.id);
    if (woke && lv! >= max) {
      layer.add(this.add.text(left, y, `${w.name.split(' of ')[0]} is wholly sanctified!`, { ...text.body(16, PAL.amber), wordWrap: { width: bw } }));
      return y + 50;
    }
    if (!woke && (have.asc ?? 0) < SYMBOL_ASC) {
      layer.add(this.add.text(left, y, 'Her weapon wakes once she ascends (Grow tab, at her cap).', { ...text.body(15, PAL.steel), wordWrap: { width: bw } }));
      return y + 50;
    }
    const cost = woke ? upgradeCost(lv! + 1) : { items: WAKE_COST, tithes: WAKE_TITHES };
    layer.add(tapCost(this, this.add.text(left, y, `${woke ? `To +${lv! + 1}` : 'To wake'}: ${costLine(save, cost)}  ›`, { ...text.body(14, block ? PAL.steel : PAL.amber), wordWrap: { width: bw } }), cost.items, cost.tithes));
    y += 30;
    const b = makeButton(this, GAME_W / 2, y + 28, bw, 56, woke ? `Temper to +${lv! + 1}` : 'Wake the Weapon', () => {
      if (list.dragging) return;
      if (raiseSymbol(save, c.id)) {
        commit();
        this.reopen(c, 'symbol');
      }
    }, { disabled: !!block, active: !block, fontSize: 18 });
    layer.add(b.all);
    return y + 80;
  }

  /** Canonization: ranks past level 50, then her trait tree (three paths of five). */
  private canonTab(list: ScrollArea, c: CrusaderDef, y: number): number {
    const save = game.save;
    const have = save.owned[c.id];
    const layer = list.content;
    const bw = GAME_W - PAD * 2 - 16;
    const left = PAD + 8;
    const rank = canonOf(have);
    layer.add(this.add.text(left, y, `CANON ${rank ? ROMAN_RANK(rank) : '0'} / ${ROMAN_RANK(MAX_CANON)}`, text.hud(15, rank ? PAL.amber : PAL.steel)));
    layer.add(this.add.text(GAME_W - PAD - 8, y, `ALL STATS +${Math.round(CANON_STAT * rank * 1000) / 10}%`, text.hud(13, PAL.ivory)).setOrigin(1, 0));
    y += 28;
    // The rank track: twenty pips, a gold ring on each trait-point rank.
    for (let r = 1; r <= MAX_CANON; r++) {
      const x = left + 8 + ((r - 1) * (bw - 16)) / (MAX_CANON - 1);
      layer.add(this.add.circle(x, y + 8, 6, r <= rank ? 0xe8e0c8 : PAL.deepShadow).setStrokeStyle(r % 2 === 0 ? 2 : 1, r % 2 === 0 ? PAL.amber : PAL.armorShadow));
    }
    y += 30;
    if (!canCanonize(have)) {
      const t = this.add.text(left, y, `She may be raised to the Canon once she reaches level ${MAX_LEVEL}, fully ascended. Each rank lifts all her stats; every second rank gives a trait point.`, { ...text.body(15, PAL.steel), wordWrap: { width: bw } });
      layer.add(t);
      return y + t.height + 20;
    }
    // Materials held (tap for sources).
    const uw = bw / 3;
    (['canon1', 'canon2', 'canon3'] as const).forEach((g, i) => {
      const x = left + i * uw;
      layer.add(drawItemIcon(this, x + 20, y + 18, g, 36));
      layer.add(tapForSources(this, this.add.text(x + 44, y + 4, `×${countOf(save, g)}\n${itemDef(g).name}`, text.body(13, countOf(save, g) ? PAL.ivory : PAL.steel)), g));
    });
    y += 50;
    if (rank < MAX_CANON) {
      const cost = canonCost(rank);
      const block = canonBlock(save, c.id);
      layer.add(tapCost(this, this.add.text(left, y, `To Canon ${ROMAN_RANK(rank + 1)}: ${costLine(save, cost)}  ›`, { ...text.body(14, block ? PAL.steel : PAL.amber), wordWrap: { width: bw } }), cost.items, cost.tithes));
      y += 30;
      const b = makeButton(this, GAME_W / 2, y + 28, bw, 56, `Canonize: rank ${ROMAN_RANK(rank + 1)}${(rank + 1) % 2 === 0 ? ' (+1 trait point)' : ''}`, () => {
        if (list.dragging) return;
        if (canonize(save, c.id)) {
          sfx('ascend');
          commit();
          this.reopen(c, 'canon');
        }
      }, { disabled: !!block, active: !block, fontSize: 17 });
      layer.add(b.all);
      y += 76;
    } else {
      layer.add(this.add.text(left, y, 'She is wholly canonized. Saints will pray to her.', text.body(16, PAL.amber)));
      y += 36;
    }
    if (hasRite(c)) y = this.riteBlock(list, c, y);
    y = this.secondVowsBlock(list, c, y);
    // Traits.
    const left_ = pointsLeft(have);
    layer.add(this.add.text(left, y, `TRAITS · ${left_} OF ${traitPoints(have)} POINTS LEFT`, text.hud(14, left_ > 0 ? PAL.amber : PAL.steel)));
    if (traitsOf(have).length) {
      const r = makeButton(this, GAME_W - PAD - 58, y + 8, 100, 32, 'Reset', () => {
        if (list.dragging) return;
        resetTraits(save, c.id);
        commit();
        this.reopen(c, 'canon');
      }, { fontSize: 14 });
      layer.add(r.all);
    }
    y += 34;
    for (const p of PATHS) {
      layer.add(this.add.text(left, y, p.name.toUpperCase(), text.hud(13, PAL.ivory)));
      layer.add(this.add.text(left, y + 18, p.desc, text.body(13, PAL.muted)));
      y += 42;
      for (const t of TRAITS.filter((x) => x.path === p.id)) {
        const on = traitsOf(have).includes(t.id);
        const can = !traitBlock(have, t.id);
        const row = this.add.rectangle(GAME_W / 2, y + 22, bw, 44, on ? 0x2a1e24 : 0x150e17).setStrokeStyle(can ? 2 : 1, on || can ? PAL.amber : PAL.armorShadow);
        layer.add(row);
        layer.add(this.add.text(left + 10, y + 4, `${on ? '✓ ' : ''}${t.name.toUpperCase()}`, text.hud(12, on ? PAL.amber : can ? 0xfff1d6 : PAL.steel)));
        layer.add(this.add.text(left + 10, y + 22, t.desc, text.body(14, on ? PAL.ivory : PAL.muted)));
        if (can) {
          row.setInteractive({ useHandCursor: true }).on('pointerup', () => {
            if (list.dragging) return;
            if (takeTrait(save, c.id, t.id)) {
              commit();
              this.reopen(c, 'canon');
            }
          });
        }
        y += 50;
      }
      y += 8;
    }
    return y + 20;
  }

  /** Second Vows: four trials, then her advanced class. */
  private secondVowsBlock(list: ScrollArea, c: CrusaderDef, y: number): number {
    const save = game.save;
    const have = save.owned[c.id];
    const layer = list.content;
    const bw = GAME_W - PAD * 2 - 16;
    const left = PAD + 8;
    const title = secondTitle(c.classId);
    layer.add(this.add.text(left, y, `SECOND VOWS · ${title.toUpperCase()}`, text.hud(14, tookVows(have) ? 0xf2d27a : PAL.amber)));
    y += 24;
    if (tookVows(have)) {
      const t = this.add.text(left, y, `She is ${title}. All stats +${Math.round(VOW_STAT * 100)}%, her Litany +${Math.round(VOW_LITANY * 100)}%, and she opens every fight with ${VOW_ZEAL} Zeal.`, { ...text.body(15, PAL.ivory), wordWrap: { width: bw } });
      layer.add(t);
      return y + t.height + 24;
    }
    const t = this.add.text(left, y, `Her advanced class: all stats +${Math.round(VOW_STAT * 100)}%, Litany +${Math.round(VOW_LITANY * 100)}%, ${VOW_ZEAL} Zeal at every fight's start, and a new title. Pass four trials:`, { ...text.body(14, PAL.muted), wordWrap: { width: bw } });
    layer.add(t);
    y += t.height + 8;
    for (const tr of vowTrials(save, c.id)) {
      const line = this.add.text(left + 4, y, `${tr.done ? '✓' : '○'} ${tr.label}`, { ...text.body(15, tr.done ? PAL.amber : PAL.ivory), wordWrap: { width: bw - 8 } });
      layer.add(line);
      y += line.height + 6;
    }
    const block = secondVowBlock(save, c.id);
    const b = makeButton(this, GAME_W / 2, y + 30, bw, 56, block ? `Second Vows: ${block}` : `Take Second Vows: become ${title}`, () => {
      if (list.dragging) return;
      if (takeSecondVows(save, c.id)) {
        commit();
        this.reopen(c, 'canon');
      }
    }, { disabled: !!block, active: !block, fontSize: 16 });
    layer.add(b.all);
    return y + 76;
  }

  /** Her Relic Rite (SSR and UR): fight or sweep a level for Motes, and sanctify her Litany. */
  private riteBlock(list: ScrollArea, c: CrusaderDef, y: number): number {
    const save = game.save;
    const layer = list.content;
    const bw = GAME_W - PAD * 2 - 16;
    const left = PAD + 8;
    const best = riteBest(save, c.id);
    const next = Math.min(RITE_LEVELS, best + 1);
    const s = sanctOf(save, c.id);
    layer.add(this.add.text(left, y, `HER RELIC RITE · LEVEL ${best} / ${RITE_LEVELS}`, text.hud(14, PAL.amber)));
    layer.add(this.add.text(GAME_W - PAD - 8, y, `${riteEntriesLeft(save)} WINS LEFT TODAY`, text.hud(12, PAL.steel)).setOrigin(1, 0));
    y += 24;
    const t = this.add.text(left, y, `She must fight in it. Level ${next} asks ${riteTarget(next).toLocaleString('en-US')} Power and pays ${riteReward(next).motes} Relic Motes. Motes held: ${motesOf(save, c.id)}.`, { ...text.body(14, PAL.ivory), wordWrap: { width: bw } });
    layer.add(t);
    y += t.height + 10;
    const half = (bw - 10) / 2;
    const fightBlock = riteBlock(save, c.id, next);
    const canFight = best < RITE_LEVELS && !fightBlock;
    const fight = makeButton(this, left + half / 2, y + 26, half, 50, best >= RITE_LEVELS ? 'All levels won' : `Fight level ${next}`, () => {
      if (list.dragging || !canFight) return;
      this.fightRite(c, next);
    }, { active: canFight, disabled: !canFight, fontSize: 16 });
    const swept = best > 0 && !riteBlock(save, c.id, best);
    const sweep = makeButton(this, left + half * 1.5 + 10, y + 26, half, 50, best ? `Sweep level ${best}` : 'Sweep', () => {
      if (list.dragging) return;
      const got = sweepRite(save, c.id, best);
      if (!got) return;
      commit();
      this.scene.restart({ openId: c.id, tab: 'canon', notice: `Swept: ${got.motes} Relic Motes, ${got.tithes} Tithes.` });
    }, { disabled: !swept, fontSize: 16 });
    layer.add([...fight.all, ...sweep.all]);
    y += 62;
    if (fightBlock && best < RITE_LEVELS) {
      layer.add(this.add.text(left, y, fightBlock, text.body(13, PAL.steel)));
      y += 22;
    }
    // Sanctified Litany.
    const rite = kitSkills(c.id, c.classId).find((k) => k.rite);
    layer.add(this.add.text(left, y, `SANCTIFIED LITANY ${s ? ROMAN_RANK(s) : '0'} / ${ROMAN_RANK(SANCT_MAX)}${rite ? ` · ${rite.name.toUpperCase()}` : ''}`, text.hud(13, s ? PAL.amber : PAL.steel)));
    y += 22;
    if (s < SANCT_MAX) {
      const step = SANCT_STEPS[s];
      const block = sanctBlock(save, c.id);
      const line = `Next: her Litany +${Math.round(SANCT_LITANY[s + 1] * 100)}%${s + 1 === SANCT_MAX ? ', and she opens each fight with 25 Zeal' : ''}. Needs Canon ${ROMAN_RANK(step.canon)} and ${step.motes} Motes.`;
      const lt = this.add.text(left, y, line, { ...text.body(14, block ? PAL.steel : PAL.ivory), wordWrap: { width: bw } });
      layer.add(lt);
      y += lt.height + 8;
      const b = makeButton(this, GAME_W / 2, y + 26, bw, 50, `Sanctify: step ${ROMAN_RANK(s + 1)}`, () => {
        if (list.dragging) return;
        if (sanctify(save, c.id)) {
          commit();
          this.reopen(c, 'canon');
        }
      }, { disabled: !!block, active: !block, fontSize: 16 });
      layer.add(b.all);
      y += 64;
    } else {
      layer.add(this.add.text(left, y, `Her Litany burns +${Math.round(SANCT_LITANY[SANCT_MAX] * 100)}% and she wakes with 25 Zeal.`, text.body(14, PAL.amber)));
      y += 30;
    }
    return y + 10;
  }

  private fightRite(c: CrusaderDef, level: number) {
    const save = game.save;
    const initial = [c.id, ...save.lastParty.filter((id) => id !== c.id)].slice(0, 4);
    pickParty(
      this,
      save,
      { title: `Rite of ${c.name.split(' ')[0]}`, sub: `Level ${level}. She must fight in it.`, initial, confirm: 'Begin the Rite!', rec: riteTarget(level), marks: joinMarks(needMarks(c.id, 'HER RITE', 'she must fight'), fightMarks(riteBattle(save, [], level))) },
      (party) => {
        if (!party.includes(c.id)) {
          toast(this, `${c.name.split(' ')[0]} must fight in her own Rite.`, GAME_H / 2);
          return;
        }
        current.challenge = {
          label: `The Rite of ${c.name}, level ${level}. Her relic will not be taken lightly!`,
          make: (rng) => riteBattle(save, party, level, rng),
          finish: (outcome) => {
            const got = finishRite(save, c.id, level, outcome === 'victory');
            commit();
            const notice = got ? `Rite won! ${got.motes} Relic Motes, ${got.tithes} Tithes.` : 'The Rite repels you. Nothing was spent.';
            return { scene: 'Roster', data: { openId: c.id, tab: 'canon', notice } };
          },
        };
        this.scene.start('Battle');
      },
    );
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
    const si = standIn(have, c.rarity);
    const atFive = have.vow >= MAX_VOW;
    const done = oathComplete(have) || (atFive && tier >= MAX_TIER);
    const line = done
      ? 'Every tier and Vow is taken. She is wholly given!'
      : atFive
        ? `Five Vows kept. Tier up for ${TIER_STIGMATA[tier]} Stigmata (you hold ${stig}) and ${tierTithes(tier).toLocaleString('en-US')} Tithes.  ›`
        : `Next Vow: ${need} cop${need > 1 ? 'ies' : 'y'} of her (you hold ${tokens}) and ${vowCost(have)} Tithes.${si.stigmata ? ` Stigmata stand in for the ${si.short} missing: ${si.stigmata} (you hold ${stig}).` : ''}  ›`;
    const lineText = tapForSources(this, this.add.text(left, y, line, { ...text.body(15, tokens >= need || atFive || (si.stigmata !== undefined && stig >= si.stigmata) ? PAL.amber : PAL.muted), wordWrap: { width: bw } }), atFive ? 'stigmata' : 'vows');
    layer.add(lineText);
    y += lineText.height + 10;
    if (!done) {
      const block = atFive ? tierBlock(save, have) : vowBlock(save, have, c.rarity);
      const after = this.preview(c, (o) => (atFive ? Object.assign(o, { tier: tierOf(o) + 1, vow: 0 }) : (o.vow += 1)));
      layer.add(this.add.text(left, y, `${atFive ? 'Tier up' : 'Take the Vow'}: ${this.diffText(sisterStats(save, c), after) || 'stats rise'}`, { ...text.body(15, PAL.ivory), wordWrap: { width: bw } }));
      y += 30;
      const b = makeButton(this, GAME_W / 2, y + 28, bw, 56, atFive ? `Tier Up  ·  ${TIER_STIGMATA[tier]} Stigmata` : si.stigmata ? `Take Vow  ·  ${need - si.short} cop${need - si.short === 1 ? 'y' : 'ies'} + ${si.stigmata} Stigmata` : `Take Vow  ·  ${need} cop${need > 1 ? 'ies' : 'y'}`, () => {
        if (list.dragging) return;
        if (atFive ? tierUp(save, c.id) : takeVow(save, c.id, c.rarity)) {
          sfx('ascend');
          commit();
          this.reopen(c, 'vows');
        }
      }, { disabled: !!block, active: !block, fontSize: 18 });
      layer.add(b.all);
      y += 72;
    }
    const skills = kitSkills(c.id, c.classId);
    layer.add(this.add.text(left, y, 'VOW GIFTS', text.hud(12, PAL.steel)));
    y += 22;
    VOW_UPGRADES.forEach(([v, i]) => {
      const got = tier > 0 || have.vow >= v;
      layer.add(this.add.text(left, y, `${got ? '✓' : '·'}  Vow ${v}: ${skills[i].name}+ (+25%, shorter cooldown)`, text.body(15, got ? PAL.amber : PAL.muted)));
      y += 24;
    });
    const t = this.add.text(left, y + 6, `Each Vow: +${Math.round(VOW_BONUS * 100)}% stats. Each tier: +${Math.round(TIER_BONUS * 100)}% more, and new star colours. Each tier's Vows ask one more copy (at most two more). From tier ${ROMAN_RANK(STAND_IN_TIER)}, Stigmata stand in for copies she lacks (${STIGMATA_PER_COPY[c.rarity]} each for ${c.rarity === 'UR' ? 'a' : 'an'} ${c.rarity}).`, { ...text.body(14, PAL.steel), wordWrap: { width: bw } });
    layer.add(t);
    return y + t.height + 20;
  }

  /** Draws the skills into `layer` from `y`; returns where they end. */
  private skillsTab(layer: Phaser.GameObjects.Container, c: CrusaderDef, y: number): number {
    const save = game.save;
    const have = save.owned[c.id];
    const skills = kitSkills(c.id, c.classId);
    const ranks = (from: number[]) => (from.length ? `RANK${from.length > 1 ? 'S' : ''} ${from[0]}${from.length > 1 ? `-${from[from.length - 1]}` : ''}` : 'ANY RANK');
    const left = PAD + 8;
    const width = GAME_W - PAD * 2 - 16;
    skills.forEach((s, i) => {
      const up = VOW_UPGRADES.find(([, idx]) => idx === i);
      const isUp = !!up && skillVow(have) >= up[0];
      const tag = [
        s.rite ? 'LITANY · HER ZEAL FULL' : `SKILL ${['I', 'II', 'III'][i]} · ${ranks(s.from)}`,
        ...(s.cooldown ? [`COOLDOWN ${isUp ? s.cooldown - 1 : s.cooldown}`] : []),
        ...(up ? [isUp ? 'VOW UPGRADED +25%' : `VOW ${up[0]}: +25%`] : []),
      ].join(' · ');
      // skill-<id>.png (32 x 32) to the left of the name when present
      const icon = addArt(this, `skill-${s.icon ?? s.id}`, left + 16, y + 18, 32);
      const tx = icon ? left + 44 : left;
      const name = this.add.text(tx, y, `${s.name}${isUp ? '+' : ''}`, { ...text.body(20, s.rite ? PAL.amber : PAL.ivory), fontStyle: '600' });
      const t = this.add.text(tx, y + 28, tag, text.hud(11, isUp ? PAL.amber : PAL.steel));
      const d = this.add.text(left, y + 46, noOrphan(descNoCooldown(s.desc)), { ...text.body(15, PAL.muted), wordWrap: { width } });
      layer.add([...(icon ? [icon] : []), name, t, d]);
      // Tap the skill for its full description, with every effect explained.
      const open = () => showSkillDetail(this, { title: `${s.name}${isUp ? '+' : ''}`, color: s.rite ? PAL.amber : PAL.ivory, tags: tag, desc: descNoCooldown(s.desc), facts: skillFacts(c, s, skillLevels(save, c.id)[i], isUp) }, 60);
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
      const t = this.add.text(left, y + 38, `PASSIVE · ${c.rarity}`, text.hud(11, PAL.steel));
      const d = this.add.text(left, y + 56, noOrphan(c.passive.desc), { ...text.body(15, PAL.muted), wordWrap: { width } });
      layer.add([name, t, d]);
      const p = c.passive;
      for (const o of [name, d])
        o.setInteractive({ useHandCursor: true }).on('pointerup', (ptr: Phaser.Input.Pointer) => ptr.getDistance() < 12 && showSkillDetail(this, { title: p.name, color: PAL.violet, tags: `PASSIVE · ${c.rarity} · ALWAYS ON`, desc: p.desc }, 60));
      y += 56 + d.height;
    }
    const seal = KITS[c.id]?.seal;
    if (seal) {
      y += 14;
      layer.add(this.add.rectangle(GAME_W / 2, y, width, 1, PAL.armorShadow));
      const name = this.add.text(left, y + 10, seal.name, { ...text.body(20, PAL.amber), fontStyle: '600' });
      const t = this.add.text(left, y + 38, "SAINT'S SEAL · ONCE A FIGHT", text.hud(11, PAL.steel));
      const d = this.add.text(left, y + 56, noOrphan(seal.desc), { ...text.body(15, PAL.muted), wordWrap: { width } });
      layer.add([name, t, d]);
      y += 56 + d.height;
    }
    // Her Relic (woken at signature weapon +5), the future lines, and her battle cry.
    const kit = KITS[c.id];
    const extra: { title: string; tag: string; desc: string; color: number }[] = [];
    if (kit?.relic) extra.push({ title: kit.relic.name, tag: `RELIC · WEAPON +5 · ${kit.skills[kit.relic.skill].name.toUpperCase()}`, desc: kit.relic.desc, color: PAL.amber });
    if (kit?.ascended) extra.push({ title: 'Ascension', tag: 'SSR TO UR · COMING', desc: kit.ascended, color: PAL.steel });
    if (kit?.command) extra.push({ title: 'Command', tag: 'ARMY BATTLES · COMING', desc: kit.command, color: PAL.steel });
    if (kit?.cry) extra.push({ title: 'Battle cry', tag: 'SERMON', desc: `"${kit.cry}"`, color: PAL.ivory });
    for (const e of extra) {
      y += 14;
      layer.add(this.add.rectangle(GAME_W / 2, y, width, 1, PAL.armorShadow));
      const name = this.add.text(left, y + 10, e.title, { ...text.body(20, e.color), fontStyle: '600' });
      const tg = this.add.text(left, y + 38, e.tag, text.hud(11, PAL.steel));
      const d = this.add.text(left, y + 56, noOrphan(e.desc), { ...text.body(15, PAL.muted), wordWrap: { width } });
      layer.add([name, tg, d]);
      y += 56 + d.height;
    }
    // Where she shines: hunt entries are checked against the niche sim.
    const shines = KITS[c.id]?.shines;
    if (shines?.length) {
      y += 14;
      layer.add(this.add.rectangle(GAME_W / 2, y, width, 1, PAL.armorShadow));
      layer.add(this.add.text(left, y + 12, 'SHINES IN', text.hud(11, PAL.steel)));
      const d = this.add.text(left, y + 30, shines.map((s) => `• ${s}`).join('\n'), { ...text.body(15, PAL.ivory), wordWrap: { width }, lineSpacing: 4 });
      layer.add(d);
      y += 30 + d.height;
    }
    return y + 16;
  }

  /** Her five slots, the Forge, Auto-equip best, the Index, the loot filter and the Saints' Armory; returns where they end. */
  private gearTab(layer: Phaser.GameObjects.Container, c: CrusaderDef, y0: number): number {
    const save = game.save;
    const worn = equipped(save, c.id);
    const bw = GAME_W - PAD * 2 - 8;
    const left = PAD + 26;
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
      const edge = item ? GRADE_COLOR[item.grade] : PAL.armorShadow;
      // ui-gear-slot.png (9-slice row, tinted by the worn piece's grade) when present
      const row = nine(this, 'ui-gear-slot', GAME_W / 2, y, bw, 112);
      layer.add(row ? row.setTint(item ? edge : 0xffffff) : this.add.rectangle(GAME_W / 2, y, bw, 112, 0x1b131d).setStrokeStyle(1, edge));
      layer.add(this.add.text(left, y - 42, `${SLOT_NAME[slot].toUpperCase()} · ${SLOT_HINT[slot].toUpperCase()}`, text.hud(12, PAL.steel)));
      if (item) {
        // gear-<id>.png for uniques, else gear-<slot>-<grade>.png, else the old gear-<slot>-<rarity>.png
        const keys = [item.unique && `gear-${item.unique}`, `gear-${slot}-${item.grade}`, `gear-${slot}-${item.rarity}`];
        const key = keys.find((k): k is string => !!k && this.textures.exists(k));
        const art = key ? addArt(this, key, left + 26, y + 2, 52) : null;
        const tx = art ? left + 62 : left;
        if (art) layer.add(art);
        const asleep = (item.edict || item.unique) && !powerAwake(worn, item, c.order);
        const power = powerLine(item, c.order) + (asleep ? ' (asleep: only her 3 strongest powers wake)' : '');
        layer.add([
          fitLine(this.add.text(tx, y - 28, `${gearName(item)}${item.level ? ` +${item.level}` : ''}`, { ...text.body(19, GRADE_COLOR[item.grade]), fontStyle: '600' }), GAME_W - PAD - 150 - tx),
          fitLine(this.add.text(tx, y + 0, `IP ${item.ip} · ${formatStat(item.main, mainValue(item))} · +${formatPower(gearPower(save, c, item))} power`, text.body(15, PAL.ivory)), GAME_W - PAD - 150 - tx),
          fitLine(this.add.text(tx, y + 22, power || item.subs.map((s) => formatStat(s.stat, s.value)).join('  ') || 'No lines', text.body(14, power ? GRADE_COLOR[item.grade] : PAL.muted)), GAME_W - PAD - 150 - tx),
        ]);
        const can = !enhanceBlock(save, item) || (item.subs.length > 0 && !confessBlock(save, item, item.rerollLine ?? 0)) || !!item.offer;
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
    const y = y0 + 110 + GEAR_SLOTS.length * 122 - 50;
    const t = this.add
      .text(GAME_W / 2, y, parts.length ? `Gear: ${parts.join('  ')}` : "The dead drop loot, and elites and bosses always do. Saint's Arms come from the Saints' Armory.", {
        ...text.body(15, parts.length ? PAL.amber : PAL.muted),
        align: 'center',
        wordWrap: { width: GAME_W - 70 },
      })
      .setOrigin(0.5, 0);
    layer.add(t);
    const half = (bw - 10) / 2;
    const by = y + t.height + 40;
    layer.add(makeButton(this, PAD + 4 + half / 2, by, half, 48, 'The Index', () => showIndex(this, undefined), { fontSize: 16, icon: 'book' }).all);
    layer.add(makeButton(this, GAME_W - PAD - 4 - half / 2, by, half, 48, 'Loot filter', () => showLootFilter(this), { fontSize: 16, icon: 'flame' }).all);
    const ar = makeButton(this, GAME_W / 2, by + 58, bw, 48, "The Saints' Armory", () => this.scene.start('Armory', { back: 'Roster' }), { fontSize: 16, icon: 'shield' });
    layer.add(ar.all);
    return by + 98;
  }

  /** The item card: the Anvil, the Confessional and the Index. */
  private forge(c: CrusaderDef, item: GearItem) {
    showGearCard(this, c, item, () => this.reopen(c, 'gear'));
  }

  /** Every piece for one slot: tap to put it on her, or melt spare pieces for Tithes. */
  private gearPicker(c: CrusaderDef, slot: GearSlot) {
    const save = game.save;
    const layer = this.add.container(0, 0).setDepth(30);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.96).setInteractive());
    layer.add(addFrame(this, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 }));
    layer.add(this.add.text(GAME_W / 2, 64, `CHOOSE A ${SLOT_NAME[slot].toUpperCase()}`, text.display(22, PAL.ivory)).setOrigin(0.5));
    // Melt spares: every unworn, unenhanced Worn and Consecrated piece of every slot, in one pyre.
    const spares = spareGear(save);
    const meltAll = makeButton(this, GAME_W / 2, 112, GAME_W - 56, 40, spares.length ? `Melt spare Worn and Consecrated · ${spares.length} · +${spareValue(save)} Tithes` : 'No spare Worn or Consecrated gear', () => {
      confirmSheet(this, `Melt ${spares.length} piece${spares.length > 1 ? 's' : ''}?`, [
        `Every Worn and Consecrated piece no Sister wears and none has enhanced, from every slot.`,
        `They pay ${spareValue(save)} Tithes and Alms besides.`,
      ], 'Into the fire!', () => {
        const m = meltSpares(save);
        commit();
        layer.destroy();
        this.gearPicker(c, slot);
        toast(this, `${m.count} pieces melted for ${m.tithes} Tithes. The Order wastes nothing.`, GAME_H / 2);
      });
    }, { fontSize: 14, disabled: !spares.length, icon: 'flame' });
    layer.add(meltAll.all);
    const items = gearOf(save)
      .filter((g) => g.slot === slot)
      .sort((a, b) => Number(a.on === c.id) - Number(b.on === c.id) || Number(!!a.on) - Number(!!b.on) || GRADES.indexOf(b.grade) - GRADES.indexOf(a.grade) || b.ip - a.ip || b.level - a.level);
    const shown = items;
    // Every piece for the slot scrolls (drag or wheel) between the title and the buttons.
    const listTop = 136;
    const listBottom = GAME_H - 100;
    const list = addScrollArea(this, listTop, listBottom, { parent: layer });
    const inList = () => !list.dragging && this.input.activePointer.y >= listTop && this.input.activePointer.y <= listBottom;
    if (!shown.length) layer.add(this.add.text(GAME_W / 2, 240, 'Nothing for this slot.\nCrusade, and the dead will arm you!', { ...text.body(18, PAL.muted), align: 'center' }).setOrigin(0.5));
    const ROW = 112;
    shown.forEach((g, i) => {
      const y = 194 + i * ROW;
      const row = this.add.rectangle(GAME_W / 2, y, GAME_W - 56, ROW - 8, 0x1b131d).setStrokeStyle(1, GRADE_COLOR[g.grade]);
      list.tap(row, () => {
        equip(save, c.id, g.uid);
        commit();
        this.reopen(c, 'gear');
      });
      const wearer = g.on ? CRUSADERS.find((x) => x.id === g.on)?.name.split(' ')[0] : undefined;
      const power = powerLine(g, c.order);
      list.content.add([
        row,
        fitLine(this.add.text(42, y - 44, `${gearName(g)}${g.level ? ` +${g.level}` : ''}`, { ...text.body(18, GRADE_COLOR[g.grade]), fontStyle: '600' }), GAME_W - 200),
        fitLine(this.add.text(42, y - 20, `${gearKind(g)} · ${formatStat(g.main, mainValue(g))}`, text.body(14, PAL.ivory)), GAME_W - 180),
        fitLine(this.add.text(42, y + 0, power || g.subs.map(subLine).join('   ') || 'No lines', text.body(14, power ? GRADE_COLOR[g.grade] : PAL.muted)), GAME_W - 180),
        this.add.text(42, y + 24, `${teaches(save, g) && !g.on ? 'NEW EDICT FOR THE INDEX · ' : ''}${g.on === c.id ? 'Worn by her' : wearer ? `Worn by ${wearer}: tap to take it` : 'Tap to equip'}`, text.hud(12, g.on === c.id ? PAL.amber : PAL.steel)),
      ]);
      // What putting it on would do to her power
      if (g.on !== c.id) {
        const d = gearSwapDelta(save, c, g);
        list.content.add(this.add.text(GAME_W - 40, y - 44, `${d >= 0 ? '▲ +' : '▼ '}${formatPower(d)}`, text.hud(13, d > 0 ? 0x8fc07a : d < 0 ? 0xe58a8a : PAL.steel)).setOrigin(1, 0));
      }
      if (!g.on) {
        const melt = makeButton(this, GAME_W - 92, y + 18, 104, 40, `Melt +${salvageValue(g)}`, () => {
          if (!inList()) return;
          salvage(save, g.uid);
          commit();
          layer.destroy();
          this.gearPicker(c, slot);
        }, { fontSize: 14 });
        list.content.add(melt.all);
      }
    });
    list.fit(194 + shown.length * ROW - 40);
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

/** Where in the line-up a skill is used from (her slot: 1-2 Vanguard, 3-4 Rearguard). Empty = anywhere. */
function lineName(from: number[]): string {
  const f = [...new Set(from)].sort();
  if (!f.length || f.length >= 4) return '';
  const k = f.join('');
  if (k === '12') return 'the Vanguard';
  if (k === '34') return 'the Rearguard';
  if (k === '1') return 'the head of the Vanguard';
  if (k === '123') return 'the Vanguard or the head of the Rearguard';
  if (k === '234') return 'anywhere but the head of the Vanguard';
  return `line-up slot ${f.join(' or ')}`;
}

/** Which foes a strike can reach, by where they stand (1 = nearest your Sisters). */
function reachName(reach?: number[]): string {
  const r = [...new Set(reach ?? [])].sort();
  if (!r.length || r.length >= 4) return '';
  const k = r.join('');
  if (k === '1') return 'only the foremost foe';
  if (k === '12') return 'the front line (the 2 foes nearest your Sisters)';
  if (k === '123') return 'the 3 foes nearest your Sisters';
  if (k === '34') return 'the back line (all but the 2 nearest foes)';
  if (k === '234') return 'any foe but the foremost';
  return `foes ${r.join(', ')} by nearness`;
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
  if (s.poison) out.push(`Each tick (every 2s): ${Math.round(s.poison.mult * f * 100)}% of her attack, for ${s.poison.turns * 2}s.`);
  if (s.bleed) out.push(`Bleed: ${Math.round(s.bleed.mult * f * 100)}% of her attack every 2s, for ${s.bleed.turns * 2}s.`);
  if (s.cooldown) out.push(`Cooldown: ${cooldownSec(s.cooldown)}s from when she uses it.`);
  const from = lineName(s.from);
  if (from) out.push(`Used from ${from}.`);
  const reach = reachName(s.reach);
  if (reach) out.push(`Reaches ${reach}.`);
  out.push(`Level ${lv}: +${Math.round((f / (vowUp ? 1.25 : 1) - 1) * 100)}% effect${vowUp ? ', and +25% from her Vow' : ''}.`);
  return out;
}
