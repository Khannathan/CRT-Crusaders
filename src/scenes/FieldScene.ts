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
import { CHAIN_SEC, FieldBattle, chainBonus, screenField } from '../systems/field';
import { runFieldInBackground } from '../ui/bgFight';
import { HOSANNAS, HOSANNA_MAX, battleHosanna, hosannaOpen, pickHosanna } from '../systems/hosanna';
import { keywordLine } from '../systems/keywords';
import { settleBattle } from '../systems/settle';
import { makeButton } from '../ui/button';
import { FieldView } from '../ui/fieldView';
import { litanyCutIn, riteCard, shake } from '../ui/juice';
import { portraitKey, queueSplash, splashKey } from '../ui/placeholderPortrait';
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
  /** Litany Chain readout above the cards: count, draining window bar, last count shown. */
  /** Hosanna bar above the cards (left), and the picker shown before the fight. */
  private hosUi?: { name: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Rectangle; frame: Phaser.GameObjects.Rectangle; w: number; full: boolean };
  private hosPicker: Phaser.GameObjects.GameObject[] = [];
  private chainUi?: { text: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Rectangle; w: number; shown: number };
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
  /** A Sister being dragged across the field (out of a danger zone). */
  private drag?: { uid: string; x0: number; y0: number; on: boolean; line: Phaser.GameObjects.Graphics };
  /** Danger zones on the ground, and how many zones the player has seen marked this fight. */
  private zoneGfx?: Phaser.GameObjects.Graphics;
  private zonesSeen = 0;

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
    this.hosUi = undefined;
    this.hosPicker = [];
    this.phase = 'deploy';
    this.paused = false;
    this.pauseLayer = undefined;
    this.deployLayer = [];
    this.picked = undefined;
    this.hitStop = 0;
    this.aim = undefined;
    this.drag = undefined;
    this.zoneGfx = undefined;
    this.zonesSeen = 0;
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
    } else this.field = screenField(battle, !settings.autoBattle, battleHosanna(save, battle));
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

    // Splash art for each Sister's Litany cut-in, loaded while the fight starts.
    b.units.filter((u) => u.side === 'party').forEach((u) => queueSplash(this, u.ref));
    this.load.start();

    this.drawCards();
    this.drawChain();
    this.drawHosanna();
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
      // A Sister: a tap casts her Litany, a drag moves her.
      if (u.side === 'party') this.drag = { uid: u.uid, x0: p.x, y0: p.y, on: false, line: this.add.graphics().setDepth(50) };
      else this.focus(u.uid);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.aimMove(p);
      this.dragMove(p);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.aimUp(p);
      this.dragUp(p);
    });
    this.zoneGfx = this.add.graphics().setDepth(9.5);
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
    this.closeHosannaPicker();
    this.refreshHosanna(true);
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

  // ---------- dragging Sisters (dodging) ----------

  private dragMove(p: Phaser.Input.Pointer) {
    const d = this.drag;
    if (!d) return;
    if (!d.on && Math.hypot(p.x - d.x0, p.y - d.y0) < 20) return;
    d.on = true;
    const body = this.field.bodies.get(d.uid);
    if (!body) return;
    d.line.clear();
    d.line.lineStyle(3, 0xf2d27a, 0.9).lineBetween(body.x, FIELD_Y + body.y, p.x, p.y);
    d.line.lineStyle(3, 0xfff1d6, 1).strokeCircle(p.x, p.y, 16);
  }

  private dragUp(p: Phaser.Input.Pointer) {
    const d = this.drag;
    if (!d) return;
    this.drag = undefined;
    d.line.destroy();
    if (!d.on) {
      this.tryLitany(d.uid);
      return;
    }
    if (this.field.moveTo(d.uid, p.x, Phaser.Math.Clamp(p.y, FIELD_Y, FIELD_Y + FIELD_H) - FIELD_Y)) {
      const z = this.field.zones.length;
      this.log(z ? `${this.field.battle.get(d.uid).name} runs for it!` : `${this.field.battle.get(d.uid).name} takes her ground.`);
    }
  }

  /** Charged blows' marks: a red ring with a fill that grows until it lands. */
  private drawZones() {
    const g = this.zoneGfx;
    if (!g) return;
    g.clear();
    const zs = this.field.zones;
    if (zs.length > this.zonesSeen) {
      this.zonesSeen = zs.length;
      this.log(`${zs[zs.length - 1].skillName} is coming! Drag your Sisters out of the red!`);
    } else if (!zs.length) this.zonesSeen = 0;
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 90);
    for (const z of zs) {
      const boss = this.field.bodies.get(z.bossUid);
      const left = Math.max(0.2, boss?.timer ?? 1);
      const done = Phaser.Math.Clamp((this.field.time - z.at) / (this.field.time - z.at + left), 0, 1);
      const x = z.x;
      const y = FIELD_Y + z.y;
      g.fillStyle(0xff2a1a, 0.1 + 0.06 * pulse).fillCircle(x, y, z.r);
      g.fillStyle(0xff2a1a, 0.22).fillCircle(x, y, z.r * done);
      g.lineStyle(4, 0xff3a2a, 0.7 + 0.3 * pulse).strokeCircle(x, y, z.r);
    }
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
    this.drawZones();
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
    if (s.id.startsWith('hosanna-')) return riteCard(this, s.name, 'THE SISTERHOOD', () => {}, 'SINGS A HOSANNA');
    if (u.side === 'party' && this.textures.exists(splashKey(u.ref))) {
      const chain = this.field.chainLeft() > 0 ? this.field.chain.count : 0;
      return litanyCutIn(this, u.ref, s.name, u.name, chain);
    }
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

  // ---------- Litany Chain ----------

  private drawChain() {
    const w = 170;
    const y = CARD_Y - 126;
    const text_ = this.add
      .text(GAME_W - 14, y, '', { ...text.hud(16, 0xfff1d6), stroke: '#000000', strokeThickness: 5, align: 'right' })
      .setOrigin(1, 0.5)
      .setDepth(41)
      .setAlpha(0);
    const bar = this.add.rectangle(GAME_W - 14 - w, y + 16, 0, 4, PAL.amber).setOrigin(0, 0.5).setDepth(41);
    this.chainUi = { text: text_, bar, w, shown: 0 };
  }

  // ---------- Hosanna ----------

  private drawHosanna() {
    const h = this.field.opts.hosanna;
    if (!h) return;
    const w = 190;
    const x = 14;
    const y = CARD_Y - 126;
    const frame = this.add.rectangle(x - 4, y - 16, w + 8, 44, 0x000000, 0.001).setOrigin(0, 0).setDepth(41);
    const name = this.add.text(x, y - 12, '', { ...text.hud(12, PAL.amber), stroke: '#000000', strokeThickness: 4 }).setDepth(42);
    this.add.rectangle(x, y + 14, w, 8, 0x000000, 0.85).setOrigin(0, 0.5).setDepth(41);
    const bar = this.add.rectangle(x + 1, y + 14, 0, 6, 0xd9c27a).setOrigin(0, 0.5).setDepth(42);
    frame.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.hosannaTap());
    this.hosUi = { name, bar, frame, w, full: false };
    this.refreshHosanna(true);
  }

  private refreshHosanna(force = false) {
    const c = this.hosUi;
    const h = this.field.opts.hosanna;
    if (!c || !h) return;
    c.bar.setSize(((c.w - 2) * this.field.hosanna) / HOSANNA_MAX, 6);
    const full = this.field.hosannaReady();
    if (full === c.full && !force) return;
    c.full = full;
    const where = this.phase === 'deploy' ? ' (TAP TO CHANGE)' : '';
    c.name.setText(full ? `TAP TO SING: ${h.name.toUpperCase()}` : `${h.name.toUpperCase()}${where}`);
    c.bar.setFillStyle(full ? 0xfff1d6 : 0xd9c27a);
    this.tweens.killTweensOf(c.name);
    c.name.setAlpha(1);
    if (full) this.tweens.add({ targets: c.name, alpha: 0.45, duration: 380, yoyo: true, repeat: -1 });
  }

  private hosannaTap() {
    if (this.ended || this.paused) return;
    if (this.phase === 'deploy') return this.openHosannaPicker();
    const e = this.field.castHosanna();
    if (e) this.view.handle([e]);
  }

  /** Before the fight: pick this party's Hosanna (kept for this exact party). */
  private openHosannaPicker() {
    this.deployLeft = undefined;
    if (this.hosPicker.length) return this.closeHosannaPicker();
    const save = game.save;
    const ids = this.field.battle.units.filter((u) => u.side === 'party').map((u) => u.ref);
    const rowH = 62;
    const top = 190;
    const bg = this.add.rectangle(GAME_W / 2, top + (HOSANNAS.length * rowH) / 2 + 30, GAME_W - 30, HOSANNAS.length * rowH + 80, 0x0e0d11, 0.97).setStrokeStyle(2, PAL.bronze).setDepth(60).setInteractive();
    const head = this.add.text(GAME_W / 2, top + 8, 'CHOOSE THIS PARTY\'S HOSANNA', text.hud(14, PAL.amber)).setOrigin(0.5).setDepth(61);
    this.hosPicker.push(bg, head);
    HOSANNAS.forEach((h, i) => {
      const y = top + 40 + i * rowH;
      const open = hosannaOpen(save, h);
      const chosen = this.field.opts.hosanna?.id === h.id;
      const row = this.add.rectangle(GAME_W / 2, y + rowH / 2 - 4, GAME_W - 50, rowH - 6, chosen ? 0x3a2430 : 0x1a1319).setStrokeStyle(chosen ? 2 : 1, chosen ? PAL.amber : 0x3a2c33).setDepth(61);
      const t1 = this.add.text(36, y + 2, open ? h.name : `${h.name} · Rank of Faith ${h.rank}`, text.hud(13, open ? 0xfff1d6 : 0x77707a)).setDepth(62);
      const t2 = this.add.text(36, y + 22, h.desc, { ...text.body(13, open ? PAL.steel : 0x55505a), wordWrap: { width: GAME_W - 80 } }).setDepth(62);
      this.hosPicker.push(row, t1, t2);
      if (!open) return;
      row.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        pickHosanna(save, ids, h.id);
        commit();
        this.field.opts.hosanna = h;
        this.closeHosannaPicker();
        this.refreshHosanna(true);
        this.log(`This party will sing ${h.name}.`);
      });
    });
  }

  private closeHosannaPicker() {
    this.hosPicker.forEach((o) => o.destroy());
    this.hosPicker = [];
  }

  private refreshChain() {
    const c = this.chainUi;
    if (!c) return;
    const left = this.field.chainLeft();
    const n = left > 0 ? this.field.chain.count : 0;
    c.bar.setSize((c.w * left) / CHAIN_SEC, 4);
    if (n === c.shown) return;
    c.shown = n;
    this.tweens.killTweensOf(c.text);
    if (!n) {
      this.tweens.add({ targets: c.text, alpha: 0, duration: 300 });
      return;
    }
    const next = Math.round(chainBonus(n + 1) * 100);
    c.text.setText(n >= 2 ? `CHAIN x${n}!  NEXT +${next}%` : `CHAIN OPEN · NEXT +${next}%`).setAlpha(1).setScale(n >= 2 ? 1.35 : 1);
    if (n >= 2) {
      this.tweens.add({ targets: c.text, scale: 1, duration: 260, ease: 'Back.easeOut' });
      shake(this, 'crit');
    }
  }

  private refreshCards() {
    this.refreshChain();
    this.refreshHosanna();
    for (const c of this.cards) {
      const u = c.u;
      const alive = u.hp > 0;
      c.hp.setSize((CARD * Math.max(0, u.hp)) / u.maxHp, 6);
      c.zeal.setSize((CARD * Math.min(ZEAL_MAX, u.zeal ?? 0)) / ZEAL_MAX, 5);
      c.img.setTint(alive ? 0xffffff : 0x333333);
      const ready = alive && this.field.litanyReady(u);
      c.ready.setVisible(ready);
      // While a Chain is open, a ready card says what linking it is worth.
      const link = this.field.chainLeft() > 0 ? Math.round(chainBonus(this.field.chain.count + 1) * 100) : 0;
      if (ready) c.ready.setText(link ? `LINK +${link}%` : (skillsFor(u).find((s) => s.rite)?.name ?? '').toUpperCase());
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
        music.carryCue(); // the cue plays on over the results; it stops when the player leaves them
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
