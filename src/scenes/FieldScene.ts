import Phaser from 'phaser';
import { battleLoop } from '../audio/battleMusic';
import { music } from '../audio/music';
import { BASE_H, GAME_H, GAME_W, HP_PARTY, PAL } from '../config';
import type { SkillDef } from '../data/skills';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import { nextSpeed, saveSettings, settings } from '../state/settings';
import { CHAPTERS, STAGES_PER_CHAPTER, nextStage, stageBattle, stageDef } from '../systems/campaign';
import { ZEAL_MAX, skillsFor, type Battle, type Unit } from '../systems/combat';
import { FieldBattle, screenField } from '../systems/field';
import { runFieldInBackground } from '../ui/bgFight';
import { keywordLine } from '../systems/keywords';
import { settleBattle } from '../systems/settle';
import { makeButton } from '../ui/button';
import { FieldView } from '../ui/fieldView';
import { riteCard, shake } from '../ui/juice';
import { portraitKey } from '../ui/placeholderPortrait';
import { addBackdrop, text } from '../ui/theme';

/** Where the field sits on screen: feet stand between FIELD_Y and FIELD_Y + FIELD_H. */
let FIELD_Y = 290;
const FIELD_H = 450;
const CARD = 104;
let CARD_Y = 846;
/**
 * Laid out for a 960-high screen. On taller phones the cards stay at the
 * bottom and the field moves down to the middle of the extra space. The field
 * itself keeps its size, since the fight is simulated in it.
 */
function spreadRows() {
  const extra = GAME_H - BASE_H;
  FIELD_Y = 290 + Math.round(extra / 2);
  CARD_Y = 846 + extra;
}

interface Card {
  u: Unit;
  frame: Phaser.GameObjects.Rectangle;
  img: Phaser.GameObjects.Image;
  hp: Phaser.GameObjects.Rectangle;
  zeal: Phaser.GameObjects.Rectangle;
  ready: Phaser.GameObjects.Text;
  glow: Phaser.GameObjects.Rectangle;
  wasReady: boolean;
}

/**
 * The active battle screen. Sisters and foes walk an open field and fight on
 * their own; the player's part:
 * - before the fight, tap two Sisters to trade places (or Begin at once)
 * - tap a Sister (or her card) when her Zeal is full to cast her Litany;
 *   hold the card and drag onto a foe or ally to aim it (time slows meanwhile)
 * - tap a foe to Focus it: every Sister who can reach it turns on it
 * - Pause, Speed 1x-3x, Auto (Litanies fire on their own)
 *
 * Opened two ways:
 * - from the Vigil (tap the field): a practice fight at the Vigil's stage, no rewards
 * - from a Crypt fight (always), or any fight when "Real-time battles" is on:
 *   the same fight, paid out as usual
 */
export class FieldScene extends Phaser.Scene {
  private field!: FieldBattle;
  private view!: FieldView;
  private cards: Card[] = [];
  private logText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private bossBar?: { u: Unit; hp: Phaser.GameObjects.Rectangle; wrath: Phaser.GameObjects.Rectangle; w: number };
  private ended = false;
  /** Practice fight (no rewards) rather than a real one handed over by the Battle screen. */
  private practice = false;
  /** Slow motion after a Litany: real seconds left, and the rate. */
  private slowLeft = 0;
  private toggles: Phaser.GameObjects.GameObject[] = [];
  private cardUntil = 0;
  private kwText!: Phaser.GameObjects.Text;
  /** Before the fight (formation swaps), the fight, or paused. */
  private phase: 'deploy' | 'fight' = 'deploy';
  private paused = false;
  private pauseLayer?: Phaser.GameObjects.Container;
  /** Seconds before the fight begins on its own (none once the player swaps). */
  private deployLeft?: number;
  private deployLayer: Phaser.GameObjects.GameObject[] = [];
  /** The Sister picked to trade places with the next one tapped. */
  private picked?: string;
  /** Real seconds the fight freezes for a heavy blow. */
  private hitStop = 0;
  /** A Litany being aimed: held from her card, dragged onto a target. */
  private aim?: { uid: string; x0: number; y0: number; at: number; on: boolean; line: Phaser.GameObjects.Graphics };

  constructor() {
    super('Field');
  }

  /** Practice: which Road stage is being fought. */
  private stageN = 1;

  /** Candle length at the start (kept when a fight is left and picked up again). */
  private vigilMax = 0;

  init(data: { battle?: Battle; field?: FieldBattle; vigilMax?: number; bg?: string; stage?: number }) {
    this.practice = !data.battle && !data.field;
    this.ended = false;
    this.cards = [];
    this.bossBar = undefined;
    this.slowLeft = 0;
    this.cardUntil = 0;
    this.toggles = [];
    this.phase = 'deploy';
    this.paused = false;
    this.pauseLayer = undefined;
    this.deployLayer = [];
    this.picked = undefined;
    this.hitStop = 0;
    this.aim = undefined;
    // On Auto the fight starts by itself after a moment, unless the player starts swapping.
    this.deployLeft = settings.autoBattle ? 2.2 : undefined;
    const save = game.save;
    let battle = data.field?.battle ?? data.battle;
    let bg = data.bg;
    if (!battle) {
      const party = (save.vigil?.party ?? []).filter((id) => save.owned[id]);
      // The Vigil party against the next stage of the Road (or a chosen one).
      const stage = stageDef(data.stage ?? nextStage(save));
      this.stageN = stage.n;
      battle = stageBattle(save, party.length ? party : Object.keys(save.owned).slice(0, 4), stage.n);
      bg = `bg-${CHAPTERS[Math.min(stage.chapter, CHAPTERS.length - 1)].crypt.id}`;
    }
    // Crypts fight in their own crypt; other modes in the nave.
    bg ??= current.challenge ? 'bg-battle' : current.run ? `bg-${current.run.crypt.id}` : undefined;
    this.registry.set('field-bg', bg && this.textures.exists(bg) ? bg : 'bg-hall');
    this.vigilMax = data.vigilMax ?? battle.vigil;
    if (data.field) {
      // A fight picked up again (from the background or a pause): no deploy, it goes on as it stood.
      this.field = data.field;
      this.field.opts.manualLitany = !settings.autoBattle;
      this.phase = 'fight';
      this.deployLeft = undefined;
    } else this.field = screenField(battle, !settings.autoBattle);
  }

  create() {
    spreadRows();
    const b = this.field.battle;
    music.play(battleLoop(b));
    music.preload('victory', 'defeat');
    this.cameras.main.setBackgroundColor(0x0e0d11);
    addBackdrop(this, this.registry.get('field-bg'), GAME_W / 2, (FIELD_Y + FIELD_H) / 2 + 20, GAME_W, FIELD_Y + FIELD_H + 40, { alpha: 0.6, fade: 0.25, fadeColor: 0x0e0d11 });
    // A floor glow where the fight happens.
    this.add.ellipse(GAME_W / 2, FIELD_Y + FIELD_H * 0.5, GAME_W * 1.1, FIELD_H * 0.75, 0x000000, 0.25);

    // Top bar
    this.add.rectangle(GAME_W / 2, 34, GAME_W, 68, 0x0e0d11, 0.85).setDepth(40);
    const title = this.practice ? `PRACTICE · STAGE ${stageDef(this.stageN).label}` : (current.challenge?.label ?? current.run?.crypt.name ?? 'BATTLE').toUpperCase();
    // One line: the label's first sentence, cut short to fit beside the buttons.
    const short = title.split('.')[0];
    this.add.text(14, 14, short.length > 20 ? `${short.slice(0, 19)}…` : short, text.hud(11, PAL.amber)).setDepth(41);
    this.timeText = this.add.text(14, 36, '', text.hud(13, PAL.steel)).setDepth(41);
    this.drawToggles();
    this.logText = this.add
      .text(GAME_W / 2, 96, 'Tap two Sisters to trade places, then Begin!', { ...text.body(18, PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 40 }, stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(41);

    // Order counters (Tide, Toll, Remains...) under the top bar.
    this.kwText = this.add.text(GAME_W / 2, 168, '', { ...text.hud(13, PAL.amber), stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setDepth(41);
    const boss = b.units.find((u) => u.side === 'enemy' && u.boss);
    if (boss) {
      const w = GAME_W - 80;
      this.add.text(GAME_W / 2, 122, boss.name.toUpperCase(), text.hud(13, 0xff8a7a)).setOrigin(0.5).setDepth(41);
      this.add.rectangle(GAME_W / 2, 140, w + 4, 12, 0x000000, 0.85).setDepth(41);
      const hp = this.add.rectangle(40, 140, w, 8, 0xc0392b).setOrigin(0, 0.5).setDepth(42);
      const wrath = this.add.rectangle(40, 149, 0, 3, 0xff5a3a).setOrigin(0, 0.5).setDepth(42);
      this.bossBar = { u: boss, hp, wrath, w };
    }

    this.view = new FieldView(this, this.field, {
      x: 0,
      y: FIELD_Y,
      scale: 0.75,
      depth: 10,
      rings: true,
      onText: (t) => this.log(t),
      onUltimate: (u, s, charging) => this.ultimate(u, s, charging),
    });

    this.drawCards();
    this.applySpeed();
    if (this.phase === 'deploy') this.drawDeploy();
    else this.log('Back into the fight!');
    // On the field: a Sister = her Litany (or a swap, before the fight); a foe = Focus.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.paused || this.ended || this.aim) return;
      if (p.y < FIELD_Y - 120 || p.y > FIELD_Y + FIELD_H + 20) return;
      const body = this.view.bodyAt(p.x, p.y);
      if (!body) return;
      const u = b.get(body.uid);
      if (this.phase === 'deploy') {
        if (u.side === 'party') this.pickSwap(u.uid);
        return;
      }
      if (u.side === 'party') this.tryLitany(u.uid);
      else this.focus(u.uid);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.aimMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.aimUp(p));
  }

  // ---------- before the fight: formation ----------

  private drawDeploy() {
    const y = FIELD_Y + FIELD_H * 0.47;
    const begin = makeButton(this, GAME_W / 2, y, 200, 56, 'Begin!', () => this.begin(), { active: true, icon: 'blade' });
    this.deployLayer = [...begin.all];
    this.deployLayer.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(45));
  }

  private pickSwap(uid: string) {
    // Choosing places stops the clock: the fight waits for Begin.
    this.deployLeft = undefined;
    if (!this.picked) {
      this.picked = uid;
      this.view.mark([uid]);
      this.log('Now tap the Sister she trades places with.');
      return;
    }
    const a = this.picked;
    this.picked = undefined;
    this.view.mark([]);
    if (a !== uid && this.field.swapPlaces(a, uid)) {
      this.view.sync();
      this.log(`${this.field.battle.get(a).name} and ${this.field.battle.get(uid).name} trade places.`);
      this.cards.forEach((c) => c.frame.setStrokeStyle(2, PAL.bronze));
    }
  }

  private begin() {
    if (this.phase !== 'deploy') return;
    this.phase = 'fight';
    this.picked = undefined;
    this.view.mark([]);
    this.deployLayer.forEach((o) => o.destroy());
    this.deployLayer = [];
    this.log(this.practice ? 'Tap a foe to Focus it. Tap a Sister when her Zeal burns full!' : 'The dark stirs. Steel yourselves, Sisters!');
  }

  // ---------- Focus ----------

  private focus(uid: string) {
    this.field.setFocus(uid);
    this.view.setFocus(this.field.focusUid);
    if (this.field.focusUid) this.log(`Focus: ${this.field.battle.get(uid).name}. Tap it again to let them choose.`);
  }

  // ---------- aimed Litanies ----------

  /** Pressed on a card: a quick tap casts at once; a hold or drag aims. */
  private cardDown(uid: string, p: Phaser.Input.Pointer) {
    if (this.ended || this.paused) return;
    if (this.phase === 'deploy') {
      this.pickSwap(uid);
      return;
    }
    if (!this.field.litanyReady(this.field.battle.get(uid))) return;
    this.aim = { uid, x0: p.x, y0: p.y, at: this.time.now, on: false, line: this.add.graphics().setDepth(50) };
  }

  private aimMove(p: Phaser.Input.Pointer) {
    const a = this.aim;
    if (!a) return;
    if (!a.on && Math.hypot(p.x - a.x0, p.y - a.y0) < 24 && this.time.now - a.at < 260) return;
    if (!a.on) {
      const targets = this.field.litanyTargets(a.uid);
      // A Litany with no single target (the whole party, every foe) needs no aim.
      if (!targets.length) return;
      a.on = true;
      this.view.mark(targets.map((t) => t.uid));
    }
    a.line.clear();
    a.line.lineStyle(4, PAL.amber, 0.9).lineBetween(a.x0, a.y0, p.x, p.y);
    a.line.fillStyle(0xfff1d6, 1).fillCircle(p.x, p.y, 8);
  }

  private aimUp(p: Phaser.Input.Pointer) {
    const a = this.aim;
    if (!a) return;
    this.aim = undefined;
    a.line.destroy();
    this.view.mark([]);
    if (!a.on) {
      this.tryLitany(a.uid);
      return;
    }
    const body = this.view.bodyAt(p.x, p.y);
    const legal = body && this.field.litanyTargets(a.uid).some((t) => t.uid === body.uid);
    if (legal) this.tryLitany(a.uid, body!.uid);
    else this.log('Let go over a lit target to aim the Litany.');
  }

  // ---------- pause ----------

  private togglePause() {
    if (this.ended) return;
    this.paused = !this.paused;
    this.pauseLayer?.destroy();
    this.pauseLayer = undefined;
    if (!this.paused) return;
    const layer = this.add.container(0, 0).setDepth(70);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.65).setInteractive());
    layer.add(this.add.text(GAME_W / 2, GAME_H / 2 - 70, 'PAUSED', text.display(36, PAL.amber)).setOrigin(0.5));
    const resume = makeButton(this, GAME_W / 2, GAME_H / 2 + 10, 260, 60, 'Resume', () => this.togglePause(), { active: true });
    layer.add(resume.all);
    if (!this.practice) {
      // A real fight can be left: on Auto it plays on unseen, otherwise it waits.
      const label = settings.autoBattle ? 'Leave (it plays on Auto)' : 'Leave (it waits for you)';
      const out = makeButton(this, GAME_W / 2, GAME_H / 2 + 86, 300, 52, label, () => this.leaveFight(), { fontSize: 16 });
      layer.add(out.all);
      layer.add(this.add.text(GAME_W / 2, GAME_H / 2 + 132, 'Come back from the Crusade tab.', text.body(15, PAL.steel)).setOrigin(0.5));
    }
    this.pauseLayer = layer;
  }

  update(_t: number, delta: number) {
    if (this.ended) return;
    const real = Math.min(0.1, delta / 1000);
    this.refreshCards();
    if (this.phase === 'deploy') {
      if (this.deployLeft !== undefined && (this.deployLeft -= real) <= 0) this.begin();
      return;
    }
    if (this.paused) return;
    this.kwText.setText(keywordLine(this.field.battle.kw, this.field.battle.alive('party').map((u) => u.order ?? '')));
    // A heavy blow (a crit, a kill) freezes the fight for a blink.
    if (this.hitStop > 0) {
      this.hitStop -= real;
      return;
    }
    let dt = real * settings.battleSpeed;
    if (this.slowLeft > 0) {
      this.slowLeft -= real;
      dt *= 0.3;
    }
    // Aiming a Litany: the fight crawls while the player picks a target.
    if (this.aim?.on) dt *= 0.2;
    const events = this.field.update(dt);
    this.view.sync();
    this.view.handle(events);
    if (events.some((e) => e.kind === 'act' && e.events.some((x) => x.type === 'death' || (x.type === 'damage' && x.crit)))) this.hitStop = 0.07;
    // The Focused foe fell: the marker goes.
    if (this.field.focusUid && this.field.battle.get(this.field.focusUid).hp <= 0) {
      this.field.setFocus(undefined);
      this.view.setFocus(undefined);
    }
    const secs = Math.floor(this.field.time);
    const fb = this.field.battle;
    // Timed fights (hunts, the siege) count down their rounds; others show the Vigil candle.
    const rounds = fb.roundLimit ? `R${Math.min(fb.round, fb.roundLimit)}/${fb.roundLimit}` : `R${fb.round} · CANDLE ${fb.vigil}`;
    this.timeText.setText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} · ${rounds}`);
    const end = events.find((e) => e.kind === 'end');
    if (end && end.kind === 'end') this.finish(end.outcome);
  }

  private log(t: string) {
    this.logText.setText(t).setAlpha(1);
    this.tweens.killTweensOf(this.logText);
    this.tweens.add({ targets: this.logText, alpha: 0.35, delay: 2600, duration: 600 });
  }

  /** A Litany lands or a Blasphemy begins: its name across the screen, a beat of slow motion. */
  private ultimate(u: Unit, s: SkillDef, charging: boolean) {
    if (charging) {
      this.log(`${u.name} begins ${s.name}! Strike hard or Delay it.`);
      shake(this, 'boss');
      return;
    }
    this.slowLeft = 0.7;
    // One name card at a time; a Litany cast while one shows gets a smaller stamp.
    if (this.time.now < this.cardUntil) {
      this.log(`${u.name}: ${s.name}!`);
      return;
    }
    this.cardUntil = this.time.now + 1300;
    riteCard(this, s.name, u.name, () => {}, u.side === 'party' ? 'INVOKES' : 'UNLEASHES A BLASPHEMY');
  }

  // ---------- Sister cards (Litanies) ----------

  private drawCards() {
    const party = this.field.battle.units.filter((u) => u.side === 'party');
    this.add.rectangle(GAME_W / 2, CARD_Y, GAME_W, 200, 0x140e16, 0.95).setDepth(30);
    this.add.rectangle(GAME_W / 2, CARD_Y - 100, GAME_W, 2, PAL.armorShadow).setDepth(30);
    const gap = (GAME_W - party.length * CARD) / (party.length + 1);
    party.forEach((u, i) => {
      const x = gap + CARD / 2 + i * (CARD + gap);
      const y = CARD_Y - 14;
      const glow = this.add.rectangle(x, y, CARD + 14, CARD + 14, PAL.amber, 0).setDepth(30);
      const frame = this.add.rectangle(x, y, CARD + 4, CARD + 4, 0x110b13).setStrokeStyle(2, PAL.bronze).setDepth(31);
      const img = this.add.image(x, y, portraitKey(u.ref)).setDisplaySize(CARD, CARD).setDepth(31);
      this.add.rectangle(x, y + CARD / 2 + 12, CARD, 8, 0x000000).setDepth(31);
      const hp = this.add.rectangle(x - CARD / 2, y + CARD / 2 + 12, CARD, 6, HP_PARTY).setOrigin(0, 0.5).setDepth(32);
      this.add.rectangle(x, y + CARD / 2 + 22, CARD, 7, 0x000000).setDepth(31);
      const zeal = this.add.rectangle(x - CARD / 2, y + CARD / 2 + 22, 0, 5, PAL.amber).setOrigin(0, 0.5).setDepth(32);
      const rite = skillsFor(u).find((s) => s.rite);
      const ready = this.add
        .text(x, y + CARD / 2 - 14, rite ? rite.name.toUpperCase() : '', { ...text.hud(11, 0xfff1d6), stroke: '#000000', strokeThickness: 4, align: 'center', wordWrap: { width: CARD + 10 } })
        .setOrigin(0.5)
        .setDepth(33)
        .setVisible(false);
      frame.setInteractive({ useHandCursor: true }).on('pointerdown', (p: Phaser.Input.Pointer) => this.cardDown(u.uid, p));
      this.cards.push({ u, frame, img, hp, zeal, ready, glow, wasReady: false });
    });
  }

  private refreshCards() {
    for (const c of this.cards) {
      const u = c.u;
      const alive = u.hp > 0;
      c.hp.setSize((CARD * Math.max(0, u.hp)) / u.maxHp, 6);
      c.zeal.setSize((CARD * Math.min(ZEAL_MAX, u.zeal ?? 0)) / ZEAL_MAX, 5);
      c.img.setTint(alive ? 0xffffff : 0x333333);
      const ready = alive && this.field.litanyReady(u);
      c.ready.setVisible(ready);
      c.zeal.setFillStyle(ready ? 0xfff1d6 : PAL.amber);
      if (ready && !c.wasReady) {
        c.frame.setStrokeStyle(3, PAL.amber);
        c.glow.setAlpha(0.6);
        this.tweens.add({ targets: c.glow, alpha: 0.15, duration: 420, yoyo: true, repeat: -1 });
      } else if (!ready && c.wasReady) {
        this.tweens.killTweensOf(c.glow);
        c.glow.setAlpha(0);
        c.frame.setStrokeStyle(2, PAL.bronze);
      }
      c.wasReady = ready;
    }
    if (this.bossBar) {
      const { u, hp, wrath, w } = this.bossBar;
      hp.setSize((w * Math.max(0, u.hp)) / u.maxHp, 8);
      wrath.setSize((w * Math.min(ZEAL_MAX, u.wrath ?? 0)) / ZEAL_MAX, 3);
    }
  }

  private tryLitany(uid: string, aimUid?: string) {
    if (this.ended || this.phase !== 'fight' || this.paused) return;
    const e = this.field.castLitany(uid, aimUid);
    if (e) this.view.handle([e]);
  }

  // ---------- switches ----------

  private drawToggles() {
    this.toggles.forEach((o) => o.destroy());
    const auto = makeButton(this, 236, 34, 88, 42, settings.autoBattle ? 'Auto: On' : 'Auto', () => this.toggleAuto(), { active: settings.autoBattle, fontSize: 16 });
    const speed = makeButton(this, 330, 34, 88, 42, `${settings.battleSpeed}x`, () => this.toggleSpeed(), { active: settings.battleSpeed > 1, fontSize: 17 });
    const pause = makeButton(this, 404, 34, 50, 42, 'II', () => this.togglePause(), { fontSize: 17 });
    // Practice fights can be left at any time; real ones play out.
    const out = this.practice ? makeButton(this, 482, 34, 92, 42, 'Leave', () => this.leave(), { fontSize: 16 }) : undefined;
    this.toggles = [...auto.all, ...speed.all, ...pause.all, ...(out?.all ?? [])];
    this.toggles.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(42));
  }

  private toggleAuto() {
    settings.autoBattle = !settings.autoBattle;
    saveSettings();
    this.field.opts.manualLitany = !settings.autoBattle;
    this.drawToggles();
  }

  private toggleSpeed() {
    settings.battleSpeed = nextSpeed(settings.battleSpeed);
    saveSettings();
    this.applySpeed();
    this.drawToggles();
  }

  /** Effects play faster at 2x too. */
  private applySpeed() {
    this.tweens.timeScale = settings.battleSpeed;
    this.time.timeScale = settings.battleSpeed;
  }

  /** Leaves a real fight to the Sanctum: on Auto it plays on in the background, else it waits paused. */
  private leaveFight() {
    if (this.ended) return;
    this.ended = true;
    if (settings.autoBattle) runFieldInBackground(this.field, this.vigilMax);
    else {
      const run = current.challenge ? undefined : current.run;
      current.paused = { battle: this.field.battle, field: this.field, vigilMax: this.vigilMax, run, floor: run?.floor, at: run?.at, challenge: current.challenge };
    }
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;
    this.scene.start('Sanctum');
  }

  private leave() {
    this.ended = true;
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;
    this.scene.start('Sanctum');
  }

  // ---------- the end ----------

  private finish(outcome: 'victory' | 'defeat') {
    this.ended = true;
    music.stinger(outcome, 'end');
    const won = outcome === 'victory';
    if (won) this.view.cheer();
    if (!this.practice) {
      // A real fight: paid out exactly like the turn-based screen.
      const next = settleBattle(this.field.battle, outcome);
      this.log(next.line);
      this.time.delayedCall(1400, () => {
        this.tweens.timeScale = 1;
        this.time.timeScale = 1;
        this.scene.start(next.scene, next.data ?? {});
      });
      return;
    }
    commit();
    const secs = Math.round(this.field.time);
    const layer = this.add.container(0, 0).setDepth(60);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.6));
    // the box sits over the middle of the field, which moves down on tall screens
    const dy = Math.round((GAME_H - BASE_H) / 2);
    layer.add(this.add.rectangle(GAME_W / 2, 440 + dy, GAME_W - 60, 300, 0x241925).setStrokeStyle(2, PAL.bronze));
    layer.add(this.add.text(GAME_W / 2, 340 + dy, won ? 'PURGED' : 'THE SISTERS FALL BACK', text.display(32, won ? PAL.amber : 0xd06060)).setOrigin(0.5));
    layer.add(this.add.text(GAME_W / 2, 392 + dy, `${secs} seconds · ${this.field.battle.round} rounds\nPractice: no rewards, nothing lost.`, { ...text.body(18, PAL.steel), align: 'center' }).setOrigin(0.5));
    const n = this.stageN;
    const bossN = Math.ceil(n / STAGES_PER_CHAPTER) * STAGES_PER_CHAPTER;
    const bw = 150;
    const again = makeButton(this, GAME_W / 2 - bw - 10, 530 + dy, bw, 56, 'Again', () => this.scene.restart({ stage: n }), { active: true, fontSize: 18 });
    // The chapter's boss, to see a Blasphemy (or the next chapter's, from a boss).
    const boss = makeButton(this, GAME_W / 2, 530 + dy, bw, 56, 'Boss fight', () => this.scene.restart({ stage: n === bossN ? Math.min(bossN + STAGES_PER_CHAPTER, CHAPTERS.length * STAGES_PER_CHAPTER) : bossN }), { fontSize: 18 });
    const back = makeButton(this, GAME_W / 2 + bw + 10, 530 + dy, bw, 56, 'Sanctum', () => this.leave(), { fontSize: 18 });
    layer.add([...again.all, ...boss.all, ...back.all]);
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;
  }
}
