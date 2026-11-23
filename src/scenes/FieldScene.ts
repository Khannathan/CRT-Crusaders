import Phaser from 'phaser';
import { battleLoop } from '../audio/battleMusic';
import { music } from '../audio/music';
import { GAME_H, GAME_W, PAL } from '../config';
import type { SkillDef } from '../data/skills';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import { nextSpeed, saveSettings, settings } from '../state/settings';
import { CHAPTERS, STAGES_PER_CHAPTER, nextStage, stageBattle, stageDef } from '../systems/campaign';
import { ZEAL_MAX, skillsFor, type Battle, type Unit } from '../systems/combat';
import { FieldBattle } from '../systems/field';
import { settleBattle } from '../systems/settle';
import { makeButton } from '../ui/button';
import { FieldView } from '../ui/fieldView';
import { riteCard, shake } from '../ui/juice';
import { portraitKey } from '../ui/placeholderPortrait';
import { addBackdrop, text } from '../ui/theme';

/** Where the field sits on screen: feet stand between FIELD_Y and FIELD_Y + FIELD_H. */
const FIELD_Y = 290;
const FIELD_H = 450;
const CARD = 104;
const CARD_Y = 846;

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
 * Real-time battle (tech demo). Sisters and foes walk an open field and fight
 * on their own, like an AFK auto-battler; the player's part is the Litanies:
 * tap a Sister's card when her Zeal is full (or leave Auto on).
 *
 * Opened two ways:
 * - from the Vigil (tap the field): a practice fight at the Vigil's stage, no rewards
 * - from any battle when "Real-time battles" is on: the same fight, paid out as usual
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

  constructor() {
    super('Field');
  }

  /** Practice: which Road stage is being fought. */
  private stageN = 1;

  init(data: { battle?: Battle; bg?: string; stage?: number }) {
    this.practice = !data.battle;
    this.ended = false;
    this.cards = [];
    this.bossBar = undefined;
    this.slowLeft = 0;
    this.cardUntil = 0;
    this.toggles = [];
    const save = game.save;
    let battle = data.battle;
    let bg = data.bg;
    if (!battle) {
      const party = (save.vigil?.party ?? []).filter((id) => save.owned[id]);
      // The Vigil party against the next stage of the Road (or a chosen one).
      const stage = stageDef(data.stage ?? nextStage(save));
      this.stageN = stage.n;
      battle = stageBattle(save, party.length ? party : Object.keys(save.owned).slice(0, 4), stage.n);
      bg = `bg-${CHAPTERS[Math.min(stage.chapter, CHAPTERS.length - 1)].crypt.id}`;
    }
    bg ??= current.run ? `bg-${current.run.crypt.id}` : undefined;
    this.registry.set('field-bg', bg && this.textures.exists(bg) ? bg : 'bg-hall');
    this.field = new FieldBattle(battle, { w: GAME_W, h: FIELD_H, manualLitany: !settings.autoBattle, bodyScale: 1.45 });
  }

  create() {
    const b = this.field.battle;
    music.play(battleLoop(b));
    music.preload('victory', 'defeat');
    this.cameras.main.setBackgroundColor(0x0e0d11);
    addBackdrop(this, this.registry.get('field-bg'), GAME_W / 2, (FIELD_Y + FIELD_H) / 2 + 20, GAME_W, FIELD_Y + FIELD_H + 40, { alpha: 0.6, fade: 0.25, fadeColor: 0x0e0d11 });
    // A floor glow where the fight happens.
    this.add.ellipse(GAME_W / 2, FIELD_Y + FIELD_H * 0.5, GAME_W * 1.1, FIELD_H * 0.75, 0x000000, 0.25);

    // Top bar
    this.add.rectangle(GAME_W / 2, 34, GAME_W, 68, 0x0e0d11, 0.85).setDepth(40);
    this.add.text(14, 12, this.practice ? `DEMO · STAGE ${stageDef(this.stageN).label}` : 'REAL-TIME DEMO', text.hud(12, PAL.amber)).setDepth(41);
    this.timeText = this.add.text(14, 32, '', text.hud(18, PAL.steel)).setDepth(41);
    this.drawToggles();
    this.logText = this.add
      .text(GAME_W / 2, 96, this.practice ? 'Tap a Sister when her Zeal is full to cast her Litany.' : 'The dark stirs. Steel yourselves, Sisters.', { ...text.body(18, PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 40 }, stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(41);

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
      onText: (t) => this.log(t),
      onUltimate: (u, s, charging) => this.ultimate(u, s, charging),
    });

    this.drawCards();
    this.applySpeed();
    // Tapping a Sister on the field works like tapping her card.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y < FIELD_Y - 120 || p.y > FIELD_Y + FIELD_H + 20) return;
      const body = this.view.bodyAt(p.x, p.y);
      if (body) this.tryLitany(body.uid);
    });
  }

  update(_t: number, delta: number) {
    if (this.ended) return;
    let dt = Math.min(0.1, delta / 1000) * settings.battleSpeed;
    if (this.slowLeft > 0) {
      this.slowLeft -= delta / 1000;
      dt *= 0.3;
    }
    const events = this.field.update(dt);
    this.view.sync();
    this.view.handle(events);
    this.refreshCards();
    const secs = Math.floor(this.field.time);
    this.timeText.setText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} · ROUND ${this.field.battle.round}`);
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
      const hp = this.add.rectangle(x - CARD / 2, y + CARD / 2 + 12, CARD, 6, 0x7aba5a).setOrigin(0, 0.5).setDepth(32);
      this.add.rectangle(x, y + CARD / 2 + 22, CARD, 7, 0x000000).setDepth(31);
      const zeal = this.add.rectangle(x - CARD / 2, y + CARD / 2 + 22, 0, 5, PAL.amber).setOrigin(0, 0.5).setDepth(32);
      const rite = skillsFor(u).find((s) => s.rite);
      const ready = this.add
        .text(x, y + CARD / 2 - 14, rite ? rite.name.toUpperCase() : '', { ...text.hud(11, 0xfff1d6), stroke: '#000000', strokeThickness: 4, align: 'center', wordWrap: { width: CARD + 10 } })
        .setOrigin(0.5)
        .setDepth(33)
        .setVisible(false);
      frame.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.tryLitany(u.uid));
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

  private tryLitany(uid: string) {
    if (this.ended) return;
    const e = this.field.castLitany(uid);
    if (e) this.view.handle([e]);
  }

  // ---------- switches ----------

  private drawToggles() {
    this.toggles.forEach((o) => o.destroy());
    const auto = makeButton(this, 262, 34, 96, 42, settings.autoBattle ? 'Auto: On' : 'Auto', () => this.toggleAuto(), { active: settings.autoBattle, fontSize: 17 });
    const speed = makeButton(this, 364, 34, 96, 42, `Speed ${settings.battleSpeed}x`, () => this.toggleSpeed(), { active: settings.battleSpeed > 1, fontSize: 17 });
    // Practice fights can be left at any time; real ones are short and play out.
    const out = this.practice ? makeButton(this, 472, 34, 108, 42, 'Leave', () => this.leave(), { fontSize: 17 }) : undefined;
    this.toggles = [...auto.all, ...speed.all, ...(out?.all ?? [])];
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
    layer.add(this.add.rectangle(GAME_W / 2, 440, GAME_W - 60, 300, 0x241925).setStrokeStyle(2, PAL.bronze));
    layer.add(this.add.text(GAME_W / 2, 340, won ? 'PURGED' : 'THE SISTERS FALL BACK', text.display(32, won ? PAL.amber : 0xd06060)).setOrigin(0.5));
    layer.add(this.add.text(GAME_W / 2, 392, `${secs} seconds · ${this.field.battle.round} rounds\nPractice: no rewards, nothing lost.`, { ...text.body(18, PAL.steel), align: 'center' }).setOrigin(0.5));
    const all = makeButton(this, GAME_W / 2, 458, 380, 48, settings.realtimeBattles ? 'Real-time for all battles: On' : 'Real-time for all battles: Off', () => {
      settings.realtimeBattles = !settings.realtimeBattles;
      saveSettings();
      all.text.setText(settings.realtimeBattles ? 'Real-time for all battles: On' : 'Real-time for all battles: Off');
    }, { fontSize: 16, active: settings.realtimeBattles });
    const n = this.stageN;
    const bossN = Math.ceil(n / STAGES_PER_CHAPTER) * STAGES_PER_CHAPTER;
    const bw = 150;
    const again = makeButton(this, GAME_W / 2 - bw - 10, 530, bw, 56, 'Again', () => this.scene.restart({ stage: n }), { active: true, fontSize: 18 });
    // The chapter's boss, to see a Blasphemy (or the next chapter's, from a boss).
    const boss = makeButton(this, GAME_W / 2, 530, bw, 56, 'Boss fight', () => this.scene.restart({ stage: n === bossN ? Math.min(bossN + STAGES_PER_CHAPTER, CHAPTERS.length * STAGES_PER_CHAPTER) : bossN }), { fontSize: 18 });
    const back = makeButton(this, GAME_W / 2 + bw + 10, 530, bw, 56, 'Sanctum', () => this.leave(), { fontSize: 18 });
    layer.add([...all.all, ...again.all, ...boss.all, ...back.all]);
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;
  }
}
