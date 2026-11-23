import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { CRUSADERS } from '../data/crusaders';
import { applyCrt } from '../fx/crt';
import { commit, game, resetGame } from '../state/game';
import { current } from '../state/run';
import { showExport, showImport } from '../ui/saveTransfer';
import { drawAlmostThere } from '../ui/almostThere';
import { drawFlame } from '../ui/flame';
import { tendFlame } from '../systems/flame';
import { saveSettings, settings } from '../state/settings';
import { music } from '../audio/music';
import { toggleFullscreen } from '../ui/fullscreen';
import { FieldBattle } from '../systems/field';
import { FieldView } from '../ui/fieldView';
import { VIGIL_CAP_HOURS, VIGIL_SIZE, vigilHours, claimVigil, ensureVigil, fastReward, setVigil, vigilPending, vigilRates, vigilStage, type VigilClaim, type VigilState } from '../systems/vigil';
import { CHAPTERS, FAST_HOURS, campaignOf, fastCost, roadDone, stageBattle, stageRecommended } from '../systems/campaign';
import { vigilExpRate } from '../systems/exp';
import { giltOf } from '../systems/currency';
import { partyPower } from '../systems/power';
import { makeButton } from '../ui/button';
import { bagEmpty, bagText } from '../systems/items';
import { CURRENCY_BAR_H, addCurrencyBar } from '../ui/currencyBar';
import { ROMAN_RANK, giftsWaiting, rankInfo } from '../systems/rank';
import { nextMilestone } from '../systems/powerGrowth';
import { accountPower, formatPower } from '../systems/power';
import { drawRites } from '../ui/rites';
import { KEEPER_BOND, blessingReady, chooseKeeper, keeperLines, keeperOf, visitKeeper, type KeeperNudges } from '../systems/keeper';
import { anyDeedReady } from '../systems/deeds';
import { noviceReady } from '../systems/novitiate';
import { anyClaimable } from '../systems/tasks';
import { ORDERS } from '../data/orders';
import { hasFullBody, hasSplash, portraitKey } from '../ui/placeholderPortrait';
import { toast } from '../ui/modeScreen';
import { drawMarchToggle, marchLine, marchUi, showMarchSummary } from '../ui/marchUi';
import { marchOf } from '../systems/march';
import { NOVICE_TASKS, NOVITIATE_DAYS, noviceDay, noviceMarks, noviceOpen, taskClaimable } from '../systems/novitiate';
import { morningRounds, roundsReady, roundsTotal, type RoundsReport } from '../systems/rounds';
import { TAB_BAR_H, addTabBar } from '../ui/tabBar';
import { addPageScroll } from '../ui/pageScroll';
import { pickParty } from '../ui/partyPicker';
import { PAD, addBackdrop, addFrame, addHeading, addScreenGlow, fitLine, text } from '../ui/theme';

/** Home screen: the Vigil (idle auto-battle and offline gathering), destinations and the tab bar. */
export class SanctumScene extends Phaser.Scene {
  private refreshBar?: () => void;
  /** Where the page was scrolled to, kept across visits and redraws. */
  private static scrollY = 0;

  constructor() {
    super('Sanctum');
  }

  create() {
    addScreenGlow(this);
    const before = new Set(this.children.list);
    this.refreshBar = addCurrencyBar(this);
    const topBar = this.children.list.filter((o) => !before.has(o));
    const top = addHeading(this, 'The Sanctum', CURRENCY_BAR_H + 16);
    // A title earned in the Order Book, worn under the heading.
    if (game.save.title) this.add.text(PAD + 128, top - 6, game.save.title.toUpperCase(), text.hud(10, PAL.amber)).setOrigin(0, 0.5);
    // Rank of Faith badge, top right; a dot when a rank gift waits.
    const ri = rankInfo(game.save);
    const rb = makeButton(this, GAME_W - PAD - 62, CURRENCY_BAR_H + 38, 124, 46, `Rank ${ROMAN_RANK(ri.rank)}`, () => this.scene.start('Rank'), { fontSize: 17, icon: 'sigil' });
    if (giftsWaiting(game.save).length) this.add.circle(rb.box.x + 56, rb.box.y - 18, 6, PAL.amber).setStrokeStyle(2, 0x1b121c);
    // Account power: the strongest four Sisters
    const ap = accountPower(game.save);
    if (ap) {
      this.add.text(rb.box.x - 76, rb.box.y - 16, 'POWER', text.hud(11, PAL.steel)).setOrigin(1, 0);
      this.add.text(rb.box.x - 76, rb.box.y, formatPower(ap), text.hud(16, PAL.amber)).setOrigin(1, 0);
      // The next Power milestone (its Gilt pays the moment it is crossed).
      const nm = nextMilestone(game.save);
      if (nm) this.add.text(rb.box.x - 76, rb.box.y + 20, `NEXT ${formatPower(nm.at)}`, text.hud(10, PAL.steel)).setOrigin(1, 0);
    }

    const owned = CRUSADERS.filter((c) => game.save.owned[c.id]);
    const fw = GAME_W - PAD * 2;
    const fh = owned.length ? 486 : 420;
    const fx = GAME_W / 2;
    const fy = top + 14 + fh / 2;
    const bottom = fy + fh / 2;

    if (!owned.length) {
      addBackdrop(this, 'bg-altar', fx, fy, fw, fh, { alpha: 0.75, fade: 0.7 });
      addFrame(this, fx, fy, fw, fh);
      this.add
        .text(PAD + 24, bottom - 156, 'The Sanctum stands empty. No Sister keeps the vigil!', { ...text.display(26, 0xfff1d6), wordWrap: { width: fw - 48 } })
        .setOrigin(0, 1)
        .setShadow(0, 2, '#000000', 9, false, true);
      this.add.text(PAD + 24, bottom - 146, 'Ten Sisters await your call\nat the Sealed Altar.', { ...text.body(20, 0xd8c2bc), fontStyle: 'italic' });
      makeButton(this, PAD + 24 + 130, bottom - 56, 260, 64, 'To the Altar!', () => this.scene.start('Recruit'), { active: true, icon: 'seal' });
    } else {
      this.drawVigil(fx, fy, fw, fh);
    }

    // The closest real goals, then the Rites (daily duties).
    let below = bottom;
    if (owned.length) {
      this.add.text(PAD, bottom + 10, 'ALMOST THERE', text.hud(13, PAL.amber));
      below = drawAlmostThere(this, game.save, bottom + 28);
    }
    // The Novitiate: a new player's first fortnight, one tap away.
    if (noviceOpen(game.save)) {
      const ready = NOVICE_TASKS.filter((t) => taskClaimable(game.save, t)).length;
      const day = Math.min(NOVITIATE_DAYS, noviceDay(game.save));
      const sy = below + 34;
      const bar = this.add
        .rectangle(GAME_W / 2, sy, GAME_W - PAD * 2, 44, ready ? 0x3a2228 : 0x1b121c)
        .setStrokeStyle(ready ? 2 : 1, ready ? PAL.amber : PAL.armorShadow)
        .setInteractive({ useHandCursor: true });
      bar.on('pointerup', () => this.scene.start('Novitiate'));
      this.add.text(PAD + 14, sy, `THE NOVITIATE  ·  DAY ${day} OF ${NOVITIATE_DAYS}`, text.hud(13, PAL.amber)).setOrigin(0, 0.5);
      this.add.text(GAME_W - PAD - 14, sy, ready ? `${ready} TO CLAIM ›` : `${noviceMarks(game.save)} / ${NOVICE_TASKS.length} MARKS ›`, text.hud(12, ready ? 0xfff1d6 : PAL.steel)).setOrigin(1, 0.5);
      below = sy + 22;
    }
    this.add.text(PAD, below + 18, 'DAILY RITES', text.hud(13, PAL.amber));
    // Morning Rounds: every daily chore that needs no choice, in one tap.
    if (owned.length) {
      const ready = roundsReady(game.save);
      makeButton(this, GAME_W - PAD - 84, below + 24, 168, 30, ready ? 'Collect all' : 'All collected', () => {
        const r = morningRounds(game.save);
        commit();
        this.showRounds(r);
      }, { fontSize: 15, active: ready, icon: 'flame' });
    }
    let ritesBottom = drawRites(this, game.save, below + 44);
    if (owned.length) ritesBottom = this.drawKeeper(ritesBottom + 14);

    // Prototype-only: settings, and wiping the save to replay the first-time flow.
    const linkY = ritesBottom + 24;
    this.textLink(PAD + 4, linkY, 'Settings', () => this.showSettings());
    this.textLink(GAME_W - PAD - 4, linkY, 'Reset save', () => this.confirmReset(), 1);

    const tabBar = addTabBar(this, 'Sanctum');
    // The page runs taller than the screen: it scrolls between the bars.
    addPageScroll(this, {
      top: CURRENCY_BAR_H,
      bottom: GAME_H - TAB_BAR_H,
      contentBottom: linkY + 20,
      fixed: [...topBar, ...tabBar],
      start: SanctumScene.scrollY,
      onScroll: (y) => (SanctumScene.scrollY = y),
    });
    // What the march cleared while you were away, or why it halted.
    if (owned.length && (marchUi.away || marchOf(game.save)?.stopped)) showMarchSummary(this, !!marchUi.away);
    marchUi.away = false;
  }

  /**
   * The Keeper of the Sanctum: the chosen Sister's bust and what she says.
   * Tap her for the next line; the first word each day adds a little bond.
   * Returns the bottom edge.
   */
  private drawKeeper(top: number): number {
    const save = game.save;
    const c = keeperOf(save, (id) => hasSplash(id) || hasFullBody(id));
    if (!c) return top - 14;
    // The first Keeper shown stays until the player changes her.
    if (save.keeper?.id !== c.id) chooseKeeper(save, c.id);
    const h = 136;
    const fw = GAME_W - PAD * 2;
    const tint = ORDERS[c.order]?.color ?? PAL.bronze;
    addFrame(this, GAME_W / 2, top + h / 2, fw, h, { fill: 0x1b121c, edge: PAL.armorShadow });
    const bust = this.add.image(PAD + 12 + 56, top + h / 2, portraitKey(c.id)).setDisplaySize(112, 112).setInteractive({ useHandCursor: true });
    this.add.rectangle(bust.x, bust.y, 116, 116).setStrokeStyle(2, tint);
    const tx = PAD + 140;
    this.add.text(tx, top + 12, 'KEEPER OF THE SANCTUM', text.hud(11, PAL.steel));
    fitLine(this.add.text(tx, top + 28, c.name, text.display(19, 0xfff1d6)), fw - 260);
    makeButton(this, GAME_W - PAD - 52, top + 26, 88, 32, 'Change', () => {
      pickParty(this, save, { title: 'Keeper of the Sanctum', sub: 'Who keeps your Sanctum?', initial: [c.id], max: 1, min: 1, confirm: 'Choose', hound: false }, (ids) => {
        if (ids[0] && chooseKeeper(save, ids[0])) commit();
        this.scene.restart();
      });
    }, { fontSize: 14 });
    const nudges: KeeperNudges = {
      vigilFull: !!save.vigil && vigilHours(save.vigil, Date.now()) >= VIGIL_CAP_HOURS,
      novitiate: noviceReady(save),
      deeds: anyDeedReady(save),
      penance: anyClaimable(save),
    };
    const lines = keeperLines(save, c, nudges);
    const say = this.add.text(tx, top + 58, '', { ...text.body(16, PAL.ivory), fontStyle: 'italic', wordWrap: { width: fw - 150 }, lineSpacing: -2 });
    const hint = this.add.text(tx, top + h - 12, '', text.hud(10, PAL.amber)).setOrigin(0, 1);
    let i = 0;
    const show = () => {
      say.setText(`"${lines[i % lines.length]}"`);
      hint.setText(blessingReady(save) ? `TAP HER  ·  +${KEEPER_BOND} BOND TODAY` : '');
    };
    show();
    bust.on('pointerup', () => {
      const gained = visitKeeper(save);
      if (gained) commit();
      i += 1;
      show();
      this.tweens.add({ targets: bust, scaleX: bust.scaleX * 1.05, scaleY: bust.scaleY * 1.05, yoyo: true, duration: 90 });
      if (gained) toast(this, `${c.name.split(' ')[0]} draws closer. +${gained} bond.`);
    });
    return top + h;
  }

  /**
   * The Vigil card: the chosen Sisters fight the chosen crypt's horrors on a
   * loop (real combat, played by the Auto player), and below it what the Vigil
   * has gathered since it was last claimed.
   */
  private drawVigil(fx: number, fy: number, fw: number, fh: number) {
    const save = game.save;
    const v = ensureVigil(save, Date.now())!;
    commit();
    const stage = vigilStage(save);
    const crypt = CHAPTERS[stage.chapter].crypt;
    const top = fy - fh / 2;
    const left = fx - fw / 2;
    const zoneH = 300;
    const art = this.textures.exists(`bg-${crypt.id}`) ? `bg-${crypt.id}` : 'bg-hall';
    addBackdrop(this, art, fx, top + zoneH / 2, fw, zoneH, { alpha: 0.55, fade: 0.35, fadeColor: 0x140e16 });
    this.add.rectangle(fx, top + zoneH + (fh - zoneH) / 2, fw, fh - zoneH, 0x1b121c);
    this.add.rectangle(fx, top + zoneH, fw, 1, PAL.armorShadow);
    addFrame(this, fx, fy, fw, fh);

    // Header: where on the Pilgrim's Road the Vigil stands, and the way to push on.
    const stageText = this.add.text(left + 18, top + 16, `THE VIGIL  ·  STAGE ${stage.label}`, text.hud(13, PAL.amber));
    this.add.text(left + 18, top + 34, CHAPTERS[stage.chapter].name, { ...text.display(19, 0xfff1d6) }).setShadow(0, 2, '#000000', 6, false, true);
    const road = makeButton(this, left + fw - 74, top + 34, 124, 40, roadDone(save) ? 'The Road' : 'Challenge', () => this.scene.start('Campaign'), { fontSize: 16, active: !roadDone(save), icon: 'blade' });
    if (!roadDone(save) && stageRecommended(save, stage.n) <= partyPower(save, v.party.filter((id) => save.owned[id]))) this.add.circle(road.box.x + 56, road.box.y - 16, 6, PAL.amber).setStrokeStyle(2, 0x1b121c);
    // The Vigil Flame: a candle that grows a step for each day you keep the vigil.
    const tended = tendFlame(save);
    commit();
    drawFlame(this, left + 30, top + zoneH - 24, save).forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(4));
    if (tended && save.flame!.level > 1) {
      const lines = [`The Vigil Flame grows: ${save.flame!.level} days`];
      if (tended.graced) lines.push(`Grace kept it for ${tended.graced} missed day${tended.graced > 1 ? 's' : ''}`);
      if (tended.dimmed) lines.push(`It dimmed ${tended.dimmed} step${tended.dimmed > 1 ? 's' : ''} while you were away`);
      for (const t of tended.titles) lines.push(`New title: "${t}"`);
      const toast = this.add.text(left + 56, top + zoneH - 30, lines.join('\n'), { ...text.body(14, PAL.amber), backgroundColor: '#1b121ccc', padding: { x: 8, y: 5 } }).setOrigin(0, 1).setDepth(5);
      this.tweens.add({ targets: toast, alpha: 0, delay: 3500, duration: 600, onComplete: () => toast.destroy() });
    }
    this.purged = 0;
    this.purgedText = this.add.text(left + fw - 16, top + zoneH - 14, '', text.hud(12, PAL.muted)).setOrigin(1, 1);
    // Tap the field to watch the fight up close (the real-time battle demo).
    if (v.party.some((id) => save.owned[id])) {
      this.add.zone(fx, top + 64 + (zoneH - 64) / 2, fw, zoneH - 64).setInteractive({ useHandCursor: true }).on('pointerup', () => this.scene.start('Field', {}));
      this.add.text(fx, top + zoneH - 14, 'TAP TO WATCH UP CLOSE', text.hud(11, PAL.steel)).setOrigin(0.5, 1).setAlpha(0.8);
    }
    // The March: the Vigil pushes on along the road by itself, on every screen and while you are away.
    if (!roadDone(save) || marchOf(save)) drawMarchToggle(this, left + fw - 74, top + 84, 124, 36, 14);
    const marchText = this.add.text(left + 18, top + 64, '', { ...text.hud(12, PAL.amber), backgroundColor: '#140e16cc', padding: { x: 4, y: 2 } }).setDepth(5);
    marchText.setInteractive({ useHandCursor: true }).on('pointerup', () => showMarchSummary(this));

    // Gathering
    const rateText = this.add.text(left + 18, top + zoneH + 14, '', text.body(16, PAL.muted));
    const gotText = this.add.text(left + 18, top + zoneH + 40, '', { ...text.body(19, PAL.amber), fontStyle: '600' });
    const barW = fw - 36;
    this.add.rectangle(left + 18, top + zoneH + 82, barW, 8, PAL.deepShadow).setOrigin(0, 0.5);
    const bar = this.add.rectangle(left + 18, top + zoneH + 82, 1, 8, PAL.amber).setOrigin(0, 0.5);
    const timeText = this.add.text(left + 18, top + zoneH + 96, '', text.hud(12, PAL.steel));
    const bw = (fw - 36 - 16) / 3;
    const bx = (i: number) => left + 18 + bw / 2 + i * (bw + 8);
    const claim = makeButton(this, bx(0), top + fh - 42, bw, 54, 'Claim', () => {
      this.showClaim(claimVigil(save, Date.now()));
      commit();
      this.refreshBar?.();
      update();
    }, { active: true, fontSize: 18, icon: 'tithe' });
    const cost = fastCost(save);
    makeButton(
      this,
      bx(1),
      top + fh - 42,
      bw,
      54,
      cost === null ? 'Fast: done' : cost ? `Fast · ${cost} Gilt` : 'Fast · Free',
      () => {
        const c = fastReward(save, Date.now());
        if (!c) return;
        this.showClaim(c, `Hasten the Vigil: ${FAST_HOURS} hours at once`);
        commit();
        this.scene.restart();
      },
      { fontSize: cost ? 15 : 17, disabled: cost === null || giltOf(save) < (cost ?? 0), icon: 'flame' },
    );
    makeButton(this, bx(2), top + fh - 42, bw, 54, 'Sisters', () => this.choosePartyFor(), { fontSize: 18, icon: 'roster' });

    const update = () => {
      const now = Date.now();
      const ml = marchLine();
      marchText.setText(ml.text).setColor(hex(ml.good ? PAL.amber : 0xe58a8a)).setVisible(!!ml.text);
      stageText.setText(`THE VIGIL  ·  STAGE ${vigilStage(save).label}`);
      const r = vigilRates(save, v);
      const p = vigilPending(save, v, now);
      const every = (perHour: number) => (perHour <= 0 ? 'never' : perHour >= 1 ? `${perHour.toFixed(1)}/h` : `every ${Math.round(1 / perHour)}h`);
      rateText.setText(`${Math.round(r.tithes)} Tithes/h · ${Math.round(vigilExpRate(campaignOf(save).best))} EXP/h · gear ${every(r.gear)} · Seal ${every(r.seals)}`);
      const parts = [`${p.tithes} Tithes`, ...(p.gear ? [`${p.gear} gear`] : []), ...(p.seals ? [`${p.seals} Seal${p.seals > 1 ? 's' : ''}`] : [])];
      gotText.setText(`Gathered: ${parts.join(' · ')}`);
      bar.setSize(Math.max(1, barW * (p.hours / VIGIL_CAP_HOURS)), 8);
      const hm = (h: number) => `${Math.floor(h)}h ${String(Math.floor((h % 1) * 60)).padStart(2, '0')}m`;
      timeText.setText(p.full ? `FULL · CLAIM TO KEEP GATHERING` : `${hm(p.hours).toUpperCase()} / ${VIGIL_CAP_HOURS}H`);
      claim.box.setAlpha(p.tithes > 0 ? 1 : 0.5);
    };
    update();
    this.time.addEvent({ delay: 1000, loop: true, callback: update });

    this.startSkirmish(v, left, top, fw);
  }

  private purged = 0;
  private purgedText?: Phaser.GameObjects.Text;
  private skirmish: Phaser.GameObjects.GameObject[] = [];

  private field?: FieldView;

  /**
   * One looping fight in the Vigil card, on an open field: the Sisters and the
   * crypt's horrors walk, close in and fight in real time (the same rules as
   * every battle, played by the Auto player). Each wave won, the next walks in.
   */
  private startSkirmish(v: VigilState, left: number, top: number, fw: number, carry?: Map<string, { x: number; y: number }>) {
    const save = game.save;
    this.skirmish.forEach((o) => o.destroy());
    this.skirmish = [];
    this.field?.destroy();
    this.field = undefined;
    const party = v.party.filter((id) => save.owned[id]);
    if (!party.length) {
      this.skirmish.push(this.add.text(left + fw / 2, top + 160, 'No Sister keeps this vigil.\nPost the watch!', { ...text.body(19, PAL.muted), align: 'center' }).setOrigin(0.5));
      return;
    }
    const battle = stageBattle(save, party, vigilStage(save).n);
    // The field: feet stand between y = top + 110 and the bottom of the art.
    const fieldTop = top + 108;
    const fb = new FieldBattle(battle, { w: fw, h: 184, carry, enemiesEnter: !!carry });
    const view = new FieldView(this, fb, {
      x: left,
      y: fieldTop,
      scale: 0.5,
      compact: true,
      depth: 3,
      onDeath: (u) => {
        if (u.side !== 'enemy') return;
        this.purged += 1;
        this.purgedText?.setText(`FOES PURGED: ${this.purged}`);
      },
    });
    this.field = view;
    let over = false;
    const tick = (_t: number, delta: number) => {
      if (over || !this.field || this.field !== view) return;
      const events = fb.update(Math.min(0.1, delta / 1000));
      view.sync();
      view.handle(events);
      const end = events.find((e) => e.kind === 'end');
      if (!end || end.kind !== 'end') return;
      over = true;
      const won = end.outcome === 'victory';
      if (won) view.cheer();
      const msg = this.add
        .text(left + fw / 2, top + 165, won ? 'PURGED. THE VIGIL HOLDS.' : 'THE SISTERS FALL BACK AND PRAY.', { ...text.hud(15, won ? PAL.amber : PAL.oxblood), stroke: '#000000', strokeThickness: 4 })
        .setOrigin(0.5)
        .setDepth(6);
      this.skirmish.push(msg);
      // The next wave walks in on the Sisters where they stand (a defeat starts over).
      this.time.delayedCall(won ? 1500 : 1800, () => this.startSkirmish(v, left, top, fw, won ? fb.partyPositions() : undefined));
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, tick);
    const off = () => this.events.off(Phaser.Scenes.Events.UPDATE, tick);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.skirmish.push({ destroy: () => { off(); view.destroy(); } } as unknown as Phaser.GameObjects.GameObject);
  }

  /** A short notice of what a claim paid. */
  private showClaim(c?: VigilClaim, title = 'The Vigil yields its tithe:') {
    if (!c || (!c.tithes && !c.seals && !c.gear.length && bagEmpty(c.items))) return;
    const parts = [`+${c.tithes} Tithes`, ...(c.exp ? [`+${c.exp} EXP to each Sister`] : []), ...(c.seals ? [`+${c.seals} Seal${c.seals > 1 ? 's' : ''}`] : []), ...(bagEmpty(c.items) ? [] : [bagText(c.items)]), ...c.gear.map((g) => `${g.name} (${g.rarity})`)];
    if (c.melted) parts.push(`armory full: +${c.melted} Tithes`);
    const box = this.add.container(0, 0).setDepth(30);
    const t = this.add.text(GAME_W / 2, 150, `${title}\n${parts.join('\n')}`, { ...text.body(19, PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 80 } }).setOrigin(0.5, 0);
    const bg = this.add.rectangle(GAME_W / 2, 150 + t.height / 2, t.width + 40, t.height + 28, 0x1b121c, 0.97).setStrokeStyle(1, PAL.amber);
    box.add([bg, t]);
    this.tweens.add({ targets: box, alpha: 0, delay: 2600, duration: 600, onComplete: () => box.destroy() });
  }

  /** What Morning Rounds did, what it gathered, and what still needs you. */
  private showRounds(r: RoundsReport) {
    const layer = this.add.container(0, 0).setDepth(30);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.9).setInteractive());
    const total = roundsTotal(r);
    const lines = [
      r.done.length ? r.done.map((d) => `✓ ${d}`).join('\n') : 'Every rite is already kept. Well done, faithful.',
      total ? `\nGathered: ${total}` : '',
      r.left.length ? `\nRites still unkept:\n${r.left.map((d) => `· ${d}`).join('\n')}` : '',
    ].filter(Boolean).join('\n');
    const t = this.add.text(GAME_W / 2, 200, lines, { ...text.body(17, PAL.ivory), align: 'left', lineSpacing: 4, wordWrap: { width: GAME_W - 100 } }).setOrigin(0.5, 0);
    const h = t.height + 120;
    layer.add(addFrame(this, GAME_W / 2, 140 + h / 2, GAME_W - 40, h, { fill: 0x241925 }));
    layer.add(this.add.text(GAME_W / 2, 166, 'MORNING ROUNDS', text.display(24, PAL.amber)).setOrigin(0.5));
    layer.add(t);
    const done = makeButton(this, GAME_W / 2, 140 + h + 44, 220, 56, 'Done', () => this.scene.restart());
    layer.add(done.all);
  }

  /** Pick up to four Sisters for the Vigil. Changing the watch claims what was gathered. */
  private choosePartyFor() {
    const save = game.save;
    const v = save.vigil!;
    pickParty(
      this,
      save,
      { title: 'Post the Watch', sub: `Up to ${VIGIL_SIZE} Sisters. They may still crusade.`, initial: v.party, max: VIGIL_SIZE, confirm: 'Keep watch' },
      (party) => {
        this.showClaim(setVigil(save, Date.now(), { party }));
        commit();
        this.scene.restart();
      },
    );
  }

  /** The preview's underlined gold text button. */
  private textLink(x: number, y: number, label: string, onTap: () => void, originX = 0) {
    const t = this.add.text(x, y, label, text.body(20, PAL.amber)).setOrigin(originX, 0.5);
    const line = this.add.rectangle(t.x - t.width * originX, y + 13, t.width, 1, 0x926642).setOrigin(0, 0.5);
    t.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-10, -14, t.width + 20, t.height + 28), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    t.on('pointerup', onTap);
    return [t, line];
  }

  private confirmReset() {
    const layer = this.add.container(0, 0).setDepth(20);
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.9).setInteractive());
    layer.add(addFrame(this, GAME_W / 2, 480, GAME_W - 40, 440, { fill: 0x241925 }));
    layer.add(
      this.add
        .text(GAME_W / 2, 360, 'Burn the records?\n\nEvery Sister, Seal, Tithe and\ncrusade will be forgotten.', { ...style, fontSize: '22px' })
        .setOrigin(0.5),
    );
    const yes = makeButton(this, GAME_W / 2, 520, 300, 76, 'Burn it all', () => {
      resetGame();
      this.scene.restart();
    }, { active: true });
    const no = makeButton(this, GAME_W / 2, 620, 300, 76, 'Keep my progress', () => layer.destroy());
    layer.add([...yes.all, ...no.all]);
  }

  private showSettings() {
    const layer = this.add.container(0, 0).setDepth(20);
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    const draw = () => {
      layer.removeAll(true);
      layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.88).setInteractive());
      layer.add(addFrame(this, GAME_W / 2, 470, GAME_W - 40, 800, { fill: 0x241925 }));
      layer.add(this.add.text(GAME_W / 2, 130, 'Settings', text.display(30, PAL.amber)).setOrigin(0.5));
      layer.add(this.add.text(GAME_W / 2, 200, 'Music', { ...style, fontSize: '22px' }).setOrigin(0.5));
      this.musicSlider(layer, 260);
      const mute = makeButton(this, GAME_W - 104, 260, 128, 56, settings.musicMuted ? 'Muted' : 'Mute', () => {
        music.setMuted(!settings.musicMuted);
        draw();
      }, { active: settings.musicMuted, fontSize: 19 });
      layer.add(mute.all);
      layer.add(this.add.text(GAME_W / 2, 360, 'CRT screen effect', { ...style, fontSize: '22px' }).setOrigin(0.5));
      const toggle = (on: boolean) => () => {
        settings.crt = on;
        saveSettings();
        applyCrt(this);
        draw();
      };
      for (const [i, on] of [true, false].entries()) {
        const b = makeButton(this, GAME_W / 2 + (i ? 90 : -90), 420, 160, 64, on ? 'On' : 'Off', toggle(on), { active: settings.crt === on });
        layer.add(b.all);
      }
      layer.add(this.add.text(GAME_W / 2, 510, 'Strength', { ...style, fontSize: '22px', color: hex(settings.crt ? PAL.ivory : PAL.steel) }).setOrigin(0.5));
      const levels: [string, number][] = [['Subtle', 0.35], ['Standard', 0.6], ['Heavy', 1]];
      levels.forEach(([label, v], i) => {
        const b = makeButton(
          this,
          GAME_W / 2 + (i - 1) * 168,
          570,
          156,
          64,
          label,
          () => {
            settings.crtStrength = v;
            saveSettings();
            applyCrt(this);
            draw();
          },
          { active: settings.crt && settings.crtStrength === v, disabled: !settings.crt, fontSize: 19 },
        );
        layer.add(b.all);
      });
      layer.add(
        this.add
          .text(GAME_W / 2, 640, 'Scanlines, colour bleed and screen curve.', { ...style, fontSize: '16px', color: hex(PAL.steel) })
          .setOrigin(0.5),
      );
      const fs = makeButton(this, GAME_W / 2 - 112, 702, 208, 52, this.scale.isFullscreen ? 'Leave full screen' : 'Full screen', () => {
        toggleFullscreen(this);
        layer.destroy();
      }, { fontSize: 18 });
      const shakeBtn = makeButton(this, GAME_W / 2 + 112, 702, 208, 52, settings.screenShake ? 'Screen shake: On' : 'Screen shake: Off', () => {
        settings.screenShake = !settings.screenShake;
        saveSettings();
        draw();
      }, { active: settings.screenShake, fontSize: 18 });
      layer.add([...fs.all, ...shakeBtn.all]);
      const backup = makeButton(this, GAME_W / 2 - 112, 764, 208, 52, 'Back up save', () => {
        commit();
        showExport(game.save);
      }, { fontSize: 18 });
      const restore = makeButton(this, GAME_W / 2 + 112, 764, 208, 52, 'Restore save', () => {
        showImport((save) => {
          game.save = save;
          current.run = undefined;
          current.paused = undefined;
          current.challenge = undefined;
          commit();
          this.scene.restart();
        });
      }, { fontSize: 18 });
      layer.add([...backup.all, ...restore.all]);
      const close = makeButton(this, GAME_W / 2, 834, 240, 60, 'Done', () => layer.destroy());
      layer.add(close.all);
    };
    draw();
  }

  /** A draggable volume bar; changes are heard straight away. */
  private musicSlider(layer: Phaser.GameObjects.Container, y: number) {
    const x0 = 56;
    const w = 300;
    const off = settings.musicMuted;
    layer.add(this.add.rectangle(x0, y, w, 10, PAL.deepShadow).setOrigin(0, 0.5).setStrokeStyle(2, PAL.armorShadow));
    const fill = this.add.rectangle(x0, y, 0, 10, off ? PAL.steel : PAL.amber).setOrigin(0, 0.5);
    const knob = this.add.circle(x0, y, 14, off ? PAL.steel : PAL.ivory).setStrokeStyle(3, PAL.oxblood);
    const label = this.add.text(x0 + w, y - 30, '', text.body(18, off ? PAL.steel : PAL.ivory)).setOrigin(1, 0.5);
    const show = () => {
      const v = settings.musicVolume;
      fill.width = w * v;
      knob.x = x0 + w * v;
      label.setText(`${Math.round(v * 100)}%`);
    };
    const set = (px: number) => {
      const v = Math.round(Phaser.Math.Clamp((px - x0) / w, 0, 1) * 20) / 20;
      if (v === settings.musicVolume && !settings.musicMuted) return;
      const wasMuted = settings.musicMuted;
      music.setVolume(v);
      if (wasMuted !== settings.musicMuted) {
        // unmuted by dragging: recolour
        fill.setFillStyle(PAL.amber);
        knob.setFillStyle(PAL.ivory);
        label.setColor(hex(PAL.ivory));
      }
      show();
    };
    const hit = this.add.zone(x0 - 20, y, w + 40, 56).setOrigin(0, 0.5).setInteractive({ useHandCursor: true, draggable: true });
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => set(p.x));
    hit.on('drag', (p: Phaser.Input.Pointer) => set(p.x));
    layer.add([fill, label, hit, knob]);
    show();
  }
}
