import Phaser from 'phaser';
import { MINI_SCALE } from '../ui/spriteAssets';
import { GAME_H, GAME_W, PAL, hex } from '../config';
import { CRUSADERS } from '../data/crusaders';
import { commit, game } from '../state/game';
import { tendFlame } from '../systems/flame';
import { FieldBattle } from '../systems/field';
import { FieldView } from '../ui/fieldView';
import { VIGIL_CAP_HOURS, VIGIL_SIZE, vigilHours, claimVigil, ensureVigil, fastReward, setVigil, vigilPending, vigilStage, type VigilClaim, type VigilState } from '../systems/vigil';
import { CHAPTERS, FAST_HOURS, fastCost, roadDone, stageBattle, stageRecommended } from '../systems/campaign';
import { giltOf } from '../systems/currency';
import { partyPower } from '../systems/power';
import { makeButton } from '../ui/button';
import { bagEmpty, bagText } from '../systems/items';
import { CURRENCY_BAR_H, addCurrencyBar } from '../ui/currencyBar';
import { giftsWaiting } from '../systems/rank';
import { KEEPER_BOND, blessingReady, chooseKeeper, keeperLines, keeperOf, visitKeeper, type KeeperNudges } from '../systems/keeper';
import { anyDeedReady } from '../systems/deeds';
import { noviceDay, noviceOpen, noviceReady, NOVITIATE_DAYS } from '../systems/novitiate';
import { anyClaimable } from '../systems/tasks';
import { missivesReady } from '../systems/missives';
import { nextSaint } from '../systems/calendar';
import { checkReturn, homecomingLeft } from '../systems/welcome';
import { matinsReady } from '../systems/matins';
import { passReady } from '../systems/pass';
import { chapterReady } from '../systems/chapter';
import { feastName, feastReady } from '../systems/feast';
import { limitedWindow, timeLeft } from '../systems/limited';
import { chooseLimited } from '../systems/gacha';
import { roundsReady } from '../systems/rounds';
import { hasFullBody, hasSplash, queueSplash, splashFilter, splashKey } from '../ui/placeholderPortrait';
import { DEFAULT_FRAME, SPLASH_FRAMES } from '../data/splashFrames';
import { toast } from '../ui/modeScreen';
import { drawMarchToggle, marchLine, marchUi, showMarchSummary } from '../ui/marchUi';
import { marchOf } from '../systems/march';
import { GROUPS, groupReady } from '../ui/nav';
import { runRounds } from '../ui/roundsSheet';
import { TAB_BAR_H, addTabBar } from '../ui/tabBar';
import { pickParty } from '../ui/partyPicker';
import { PAD, addBackdrop, addFrame, addIcon, addScreenGlow, fitLine, text, textWash } from '../ui/theme';

/** A gold dot. */
const dotAt = (scene: Phaser.Scene, x: number, y: number) =>
  scene.textures.exists('ui-ready-dot') ? scene.add.image(x, y, 'ui-ready-dot').setDisplaySize(16, 16).setDepth(4) : scene.add.circle(x, y, 6, PAL.amber).setStrokeStyle(2, 0x1b121c).setDepth(4);

/**
 * Home screen, the lobby (the Cathedral layout, 2026-11-23): your Keeper fills
 * the screen (tap her to talk), daily things sit on the left rail, timed events
 * on the right, the Vigil fights at the bottom, and Onward! always leads to the
 * next Road stage.
 */
export class SanctumScene extends Phaser.Scene {
  private refreshBar?: () => void;

  constructor() {
    super('Sanctum');
  }

  private keeper() {
    const save = game.save;
    const c = keeperOf(save, (id) => hasSplash(id) || hasFullBody(id));
    // The first Keeper shown stays until the player changes her.
    if (c && save.keeper?.id !== c.id) chooseKeeper(save, c.id);
    return c;
  }

  preload() {
    const c = Object.keys(game.save.owned).length ? this.keeper() : undefined;
    if (c) queueSplash(this, c.id);
  }

  create() {
    const save = game.save;
    // Away three days or more: a gift in Missives and a Homecoming week.
    const away = checkReturn(save);
    commit();
    if (away) this.time.delayedCall(400, () => toast(this, `Welcome home! ${away} days away. A gift waits in Missives, and a Homecoming week begins!`, GAME_H / 2 - 120));
    const owned = CRUSADERS.filter((c) => save.owned[c.id]);
    const areaTop = CURRENCY_BAR_H;
    const areaBot = GAME_H - TAB_BAR_H;
    const areaH = areaBot - areaTop;
    const c = owned.length ? this.keeper() : undefined;

    // Her splash fills the lobby; without one, her figure stands in the great hall.
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0e0a10);
    if (c && this.textures.exists(splashKey(c.id))) {
      // the whole painting, scaled to cover the lobby from the top down, so her face sits clear of the Vigil
      const img = this.add.image(GAME_W / 2, areaTop, splashKey(c.id)).setOrigin(0.5, 0);
      const scale = Math.max(GAME_W / img.width, areaH / img.height);
      img.setScale(scale);
      splashFilter(this, splashKey(c.id), scale);
      // keep her face in view when the painting is wider than the lobby
      const [cx] = SPLASH_FRAMES[c.id] ?? DEFAULT_FRAME;
      const spare = (img.width * scale - GAME_W) / 2;
      img.x = GAME_W / 2 + Phaser.Math.Clamp((0.5 - cx) * img.width * scale, -spare, spare);
    }
    else {
      addBackdrop(this, owned.length ? 'bg-hall' : 'bg-altar', GAME_W / 2, areaTop + areaH / 2, GAME_W, areaH, { alpha: 0.85, fade: 0.3, fadeColor: 0x0e0a10 });
      if (c && this.textures.exists(`full-${c.id}`)) this.add.image(GAME_W / 2, areaTop + areaH * 0.62, `full-${c.id}`).setScale(3).setOrigin(0.5, 1);
    }
    // dark bands keep the name, the rails and the Vigil readable over any art
    const g = this.add.graphics();
    for (let i = 0; i < 10; i++) g.fillStyle(0x0e0a10, 0.7 - i * 0.07).fillRect(0, areaTop + i * 12, GAME_W, 12);
    for (let i = 0; i < 24; i++) g.fillStyle(0x0e0a10, Math.min(0.94, 0.04 * (i + 1))).fillRect(0, areaBot - 380 + i * 12, GAME_W, 12);
    g.fillStyle(0x0e0a10, 0.94).fillRect(0, areaBot - 92, GAME_W, 92);
    addScreenGlow(this);
    this.refreshBar = addCurrencyBar(this);

    if (!owned.length) {
      this.add
        .text(PAD + 8, areaBot - 260, 'The Sanctum stands empty. No Sister keeps the vigil!', { ...text.display(26, 0xfff1d6), wordWrap: { width: GAME_W - PAD * 2 - 16 } })
        .setShadow(0, 2, '#000000', 9, false, true);
      this.add.text(PAD + 8, areaBot - 160, 'Ten Sisters await your call\nat the Sealed Altar.', { ...text.body(20, 0xd8c2bc), fontStyle: 'italic' });
      makeButton(this, GAME_W / 2, areaBot - 52, GAME_W - PAD * 2, 64, 'To the Altar!', () => this.scene.start('Recruit'), { active: true, icon: 'seal', fontSize: 22 });
      addTabBar(this, 'Sanctum');
      return;
    }

    const onward = areaBot - 12 - 32;
    const stripH = 196;
    const stripTop = onward - 32 - 10 - stripH;
    this.drawKeeperTalk(c, areaTop, stripTop);
    this.drawLeftRail(areaTop + 104, stripTop);
    this.drawRightRail(areaTop + 104);
    this.drawVigil(PAD, stripTop, GAME_W - PAD * 2, stripH);

    // Onward: straight to the team for the next stage of the Pilgrim's Road (Back shows the map).
    const stage = vigilStage(save);
    const done = roadDone(save);
    makeButton(this, GAME_W / 2, onward, GAME_W - PAD * 2, 64, done ? 'The Road' : `Onward!  ·  ${stage.label}`, () => this.scene.start('Campaign', done ? { mode: 'road' } : { mode: 'road', fight: stage.n }), { active: !done, icon: 'blade', fontSize: 24 });

    addTabBar(this, 'Sanctum');
    // What the march cleared while you were away, or why it halted.
    if (marchUi.away || marchOf(save)?.stopped) showMarchSummary(this, !!marchUi.away);
    marchUi.away = false;
  }

  /** Her name top left; tap her for her next line (the first word each day adds bond). */
  private drawKeeperTalk(c: ReturnType<typeof keeperOf>, areaTop: number, stripTop: number) {
    if (!c) return;
    const save = game.save;
    this.add.text(PAD, areaTop + 12, 'KEEPER OF THE SANCTUM', text.hud(11, PAL.steel)).setShadow(0, 1, '#000000', 3, false, true);
    fitLine(this.add.text(PAD, areaTop + 28, c.name, text.display(22, 0xfff1d6)).setShadow(0, 2, '#000000', 8, false, true), GAME_W - PAD * 2 - 170);
    const hint = this.add.text(PAD, areaTop + 62, '', text.hud(11, 0xe0607a)).setShadow(0, 1, '#000000', 3, false, true);
    const nudges: KeeperNudges = {
      vigilFull: !!save.vigil && vigilHours(save.vigil, Date.now()) >= VIGIL_CAP_HOURS,
      novitiate: noviceReady(save),
      deeds: anyDeedReady(save),
      penance: anyClaimable(save),
    };
    const lines = keeperLines(save, c, nudges);
    // the speech bubble sits between the rails, under her name
    const bx = 92;
    const bw = GAME_W - bx - PAD;
    const say = this.add.text(bx + 12, 0, '', { ...text.body(18, 0xfff1d6), fontStyle: 'italic', wordWrap: { width: bw - 24 }, lineSpacing: -2 }).setDepth(6);
    const bubble = this.add.rectangle(bx, 0, bw, 10, 0x0e0a10, 0.92).setOrigin(0, 0).setStrokeStyle(2, PAL.goldEdge).setDepth(5);
    let i = 0;
    let timer: Phaser.Time.TimerEvent | undefined;
    const show = (line: string) => {
      // the bubble sits low, over her hands, so her face stays clear
      say.setText(`"${line}"`).setAlpha(1);
      bubble.setSize(bw, say.height + 20).setAlpha(1).setY(stripTop - 14 - say.height - 20);
      say.setY(bubble.y + 10);
      bubble.setStrokeStyle(2, PAL.goldEdge);
      hint.setText(blessingReady(save) ? `TAP HER  ·  +${KEEPER_BOND} BOND TODAY` : 'TAP HER TO SPEAK');
      timer?.remove();
      timer = this.time.delayedCall(4200, () => this.tweens.add({ targets: [say, bubble], alpha: 0, duration: 400 }));
    };
    show(lines[0]);
    const zone = this.add.zone(GAME_W / 2, (areaTop + 96 + stripTop) / 2, GAME_W - 200, stripTop - areaTop - 96).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => {
      const gained = visitKeeper(save);
      if (gained) commit();
      i += 1;
      show(lines[i % lines.length]);
      if (gained) toast(this, `${c.name.split(' ')[0]} draws closer. +${gained} bond.`);
    });
  }

  /** Daily things: Duties, Matins, the Pass, the Chapter, and Collect when chores wait. */
  private drawLeftRail(top: number, bottom: number) {
    const save = game.save;
    const duty = GROUPS.duties.find((t) => (t.shown?.(save) ?? true) && t.ready?.(save)) ?? GROUPS.duties[0];
    const items: { label: string; icon: string; go: () => void; ready: boolean }[] = [
      { label: 'Duties', icon: 'book', go: () => this.scene.start(duty.scene, duty.data ?? {}), ready: groupReady(save, 'duties') },
      { label: 'Missives', icon: 'book', go: () => this.scene.start('Missives'), ready: missivesReady(save) },
      { label: 'Matins', icon: 'matins', go: () => this.scene.start('Matins'), ready: matinsReady(save) },
      { label: 'Pass', icon: 'sigil', go: () => this.scene.start('Pass'), ready: passReady(save) },
      { label: 'Chapter', icon: 'chapter', go: () => this.scene.start('Chapter'), ready: chapterReady(save) },
    ];
    if (roundsReady(save)) items.push({ label: 'Collect', icon: 'tithe', go: () => runRounds(this), ready: true });
    const step = Math.min(82, (bottom - top - 10) / items.length);
    items.forEach((it, k) => {
      const x = PAD + 26;
      const y = top + 28 + k * step;
      const box = this.add.rectangle(x, y, 54, 54, 0x0e0a10, 0.85).setStrokeStyle(2, PAL.bronze).setDepth(3);
      // rail-icons art (ui-rail-<name>.png) replaces the menu icons once it lands
      const icon = this.textures.exists(`ui-rail-${it.label.toLowerCase()}`) ? `rail-${it.label.toLowerCase()}` : it.icon === 'matins' ? 'flame' : it.icon === 'chapter' ? 'roster' : it.icon;
      addIcon(this, x, y, icon, 32, PAL.amber).setDepth(3);
      this.add.text(x, y + 30, it.label, { ...text.body(15, 0xfff1d6), fontStyle: '600' }).setOrigin(0.5, 0).setShadow(0, 1, '#000000', 4, false, true).setDepth(3);
      if (it.ready) dotAt(this, x + 24, y - 24);
      box.setInteractive({ useHandCursor: true }).on('pointerup', it.go);
    });
  }

  /** Timed things: the Feast, the Limited Saint, the Novitiate, a Rank gift. */
  private drawRightRail(top: number) {
    const save = game.save;
    const win = limitedWindow();
    const items: { title: string; sub: string; art: string; go: () => void; ready?: boolean }[] = [
      { title: feastName(win), sub: `${timeLeft(win.ends)} LEFT`, art: 'bg-candle-maze', go: () => this.scene.start('Feast'), ready: feastReady(save) },
      {
        title: 'Limited Saint',
        sub: `${win.saint.name.split(' ')[0]} · ${timeLeft(win.ends)}`,
        art: 'banner-limited',
        go: () => {
          chooseLimited(save);
          commit();
          this.scene.start('Recruit');
        },
      },
    ];
    const home = homecomingLeft(save);
    if (home) items.unshift({ title: 'Homecoming', sub: `+100% VIGIL · ${timeLeft(Date.now() + home)}`, art: 'bg-altar', go: () => this.scene.start('Missives') });
    const coming = nextSaint();
    items.push({ title: 'Calendar', sub: coming ? `NEXT: ${coming.saint.name.split(' ')[0]} · ${timeLeft(coming.starts)}` : 'WHAT COMES', art: 'bg-hall', go: () => this.scene.start('Calendar') });
    if (noviceOpen(save)) items.push({ title: 'Novitiate', sub: `DAY ${Math.min(NOVITIATE_DAYS, noviceDay(save))} OF ${NOVITIATE_DAYS}`, art: 'bg-altar', go: () => this.scene.start('Novitiate'), ready: noviceReady(save) });
    if (giftsWaiting(save).length) items.push({ title: 'Rank gift', sub: 'CLAIM IT', art: 'bg-hall', go: () => this.scene.start('Rank'), ready: true });
    const w = 158;
    const h = 64;
    const x = GAME_W - PAD - w / 2;
    items.forEach((it, k) => {
      const y = top + h / 2 + k * (h + 10);
      if (this.textures.exists(it.art)) addBackdrop(this, it.art, x, y, w, h, { fade: 0.25, fadeColor: 0x0e0a10, focusY: 0.4 });
      textWash(this, x - w / 2, y - h / 2, w, h);
      if (this.textures.exists('ui-event-plaque')) this.add.nineslice(x, y, 'ui-event-plaque', undefined, w, h, 12, 12, 12, 12);
      else this.add.rectangle(x, y, w, h).setStrokeStyle(2, PAL.bronze);
      fitLine(this.add.text(x - w / 2 + 8, y - h / 2 + 6, it.title, { ...text.body(18, 0xfff1d6), fontStyle: '700' }).setShadow(0, 2, '#000000', 5, false, true), w - 16);
      fitLine(this.add.text(x - w / 2 + 8, y + h / 2 - 8, it.sub.toUpperCase(), text.hud(11, PAL.amber)).setOrigin(0, 1), w - 16);
      if (it.ready) dotAt(this, x + w / 2 - 6, y - h / 2 + 6);
      this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }).on('pointerup', it.go);
    });
  }

  /**
   * The Vigil strip: the chosen Sisters fight the stage's horrors on a loop
   * (real combat, played by the Auto player), what the Vigil has gathered,
   * and Claim, Fast, Sisters and March.
   */
  private drawVigil(left: number, top: number, fw: number, fh: number) {
    const save = game.save;
    const v = ensureVigil(save, Date.now())!;
    commit();
    const stage = vigilStage(save);
    const crypt = CHAPTERS[stage.chapter].crypt;
    const zoneH = 130;
    const fx = left + fw / 2;
    const art = this.textures.exists('lobby-vigil-strip') ? 'lobby-vigil-strip' : this.textures.exists(`bg-${crypt.id}`) ? `bg-${crypt.id}` : 'bg-hall';
    addBackdrop(this, art, fx, top + zoneH / 2, fw, zoneH, { alpha: 0.75, fade: 0.25, fadeColor: 0x140e16, focusY: 0.6 });
    textWash(this, left, top, fw * 0.6, zoneH);
    this.add.rectangle(fx, top + zoneH + (fh - zoneH) / 2, fw, fh - zoneH, 0x1b121c, 0.96);
    addFrame(this, fx, top + fh / 2, fw, fh);

    const stageText = this.add.text(left + 14, top + 12, '', text.hud(12, PAL.amber)).setDepth(5);
    const gotText = this.add.text(left + 14, top + 30, '', { ...text.body(19, 0xfff1d6), fontStyle: '600', wordWrap: { width: fw * 0.5 } }).setDepth(5);
    const timeText = this.add.text(left + 14, top + zoneH - 30, '', text.hud(11, PAL.steel)).setDepth(5);
    const marchText = this.add.text(left + 14, top + zoneH - 14, '', text.hud(11, PAL.amber)).setDepth(5);
    marchText.setInteractive({ useHandCursor: true }).on('pointerup', () => showMarchSummary(this));
    // The Vigil Flame: a candle that grows a step for each day you keep the vigil.
    const tended = tendFlame(save);
    commit();
    if (tended && save.flame!.level > 1) {
      const lines = [`The Vigil Flame grows: ${save.flame!.level} days`];
      if (tended.graced) lines.push(`A pardon kept it for ${tended.graced} missed day${tended.graced > 1 ? 's' : ''}`);
      if (tended.dimmed) lines.push(`It dimmed ${tended.dimmed} step${tended.dimmed > 1 ? 's' : ''} while you were away`);
      for (const t of tended.titles) lines.push(`New title: "${t}"`);
      toast(this, lines.join('\n'), top - 40);
    }
    this.purged = 0;
    this.purgedText = undefined;
    // Tap the fight to watch it up close.
    if (v.party.some((id) => save.owned[id])) this.add.zone(left + fw * 0.7, top + zoneH / 2, fw * 0.6, zoneH).setInteractive({ useHandCursor: true }).on('pointerup', () => this.scene.start('Field', {}));

    const bw = (fw - 28 - 18) / 4;
    const bx = (i: number) => left + 14 + bw / 2 + i * (bw + 6);
    const by = top + fh - 34;
    const claim = makeButton(this, bx(0), by, bw, 46, 'Claim', () => {
      this.showClaim(claimVigil(save, Date.now()));
      commit();
      this.refreshBar?.();
      update();
    }, { active: true, fontSize: 17, icon: 'tithe' });
    const cost = fastCost(save);
    makeButton(
      this,
      bx(1),
      by,
      bw,
      46,
      cost === null ? 'Fast: done' : cost ? `Fast ${cost}` : 'Fast: free',
      () => {
        const got = fastReward(save, Date.now());
        if (!got) return;
        this.showClaim(got, `Hasten the Vigil: ${FAST_HOURS} hours at once`);
        commit();
        this.scene.restart();
      },
      { fontSize: 15, disabled: cost === null || giltOf(save) < (cost ?? 0), icon: 'flame' },
    );
    makeButton(this, bx(2), by, bw, 46, 'Sisters', () => this.choosePartyFor(), { fontSize: 16, icon: 'roster' });
    if (!roadDone(save) || marchOf(save)) drawMarchToggle(this, bx(3), by, bw, 46, 14);
    else makeButton(this, bx(3), by, bw, 46, 'Watch', () => this.scene.start('Field', {}), { fontSize: 16 });
    if (!roadDone(save) && stageRecommended(save, stage.n) <= partyPower(save, v.party.filter((id) => save.owned[id]))) dotAt(this, GAME_W - PAD - 8, top + fh + 8);

    const update = () => {
      const now = Date.now();
      const ml = marchLine();
      marchText.setText(ml.text.toUpperCase()).setColor(hex(ml.good ? PAL.amber : 0xe58a8a)).setVisible(!!ml.text);
      const flame = save.flame?.level ?? 0;
      stageText.setText(`THE VIGIL  ·  ${vigilStage(save).label}${flame > 1 ? `  ·  FLAME ${flame}` : ''}`);
      const p = vigilPending(save, v, now);
      const parts = [`${p.tithes} Tithes`, ...(p.gear ? [`${p.gear} gear`] : []), ...(p.seals ? [`${p.seals} Seal${p.seals > 1 ? 's' : ''}`] : [])];
      gotText.setText(parts.join(' · '));
      const hm = (h: number) => `${Math.floor(h)}H ${String(Math.floor((h % 1) * 60)).padStart(2, '0')}M`;
      timeText.setText(p.full ? 'FULL · CLAIM TO KEEP GATHERING' : `${hm(p.hours)} OF ${VIGIL_CAP_HOURS}H GATHERED`);
      claim.box.setAlpha(p.tithes > 0 ? 1 : 0.5);
    };
    update();
    this.time.addEvent({ delay: 1000, loop: true, callback: update });

    this.startSkirmish(v, left + fw * 0.42, top, fw * 0.58);
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
      this.skirmish.push(this.add.text(left + fw / 2, top + 64, 'No Sister keeps watch.\nPost one!', { ...text.body(18, PAL.muted), align: 'center' }).setOrigin(0.5));
      return;
    }
    const battle = stageBattle(save, party, vigilStage(save).n);
    // The field: feet stand between y = top + 110 and the bottom of the art.
    const fieldTop = top + 78;
    const fb = new FieldBattle(battle, { w: fw, h: 44, carry, enemiesEnter: !!carry });
    const view = new FieldView(this, fb, {
      x: left,
      y: fieldTop,
      // her mini's size: drawn pixel for pixel (sisterSprite.ts)
      scale: MINI_SCALE,
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
        .text(left + fw / 2, top + 24, won ? 'PURGED. THE VIGIL HOLDS.' : 'THE SISTERS FALL BACK, SWORN TO RETURN.', { ...text.hud(12, won ? PAL.amber : PAL.oxblood), stroke: '#000000', strokeThickness: 4 })
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
}
