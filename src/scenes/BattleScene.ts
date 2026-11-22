import Phaser from 'phaser';
import { music } from '../audio/music';
import { FONT, GAME_W, PAL, hex } from '../config';
import { addTabBar } from '../ui/tabBar';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { ENEMIES } from '../data/enemies';
import type { SkillDef } from '../data/skills';
import { game } from '../state/game';
import { saveSettings, settings } from '../state/settings';
import { autoChoose, autoStep } from '../systems/autoplay';
import { makeButton } from '../ui/button';
import { addOrderSigil } from '../ui/sisterCard';
import { showDetail } from '../ui/glossary';
import { HOUNDS } from '../data/hounds';
import { howlParts } from '../systems/hounds';
import { houndFace } from '../ui/hound';
import { addArt, text } from '../ui/theme';
import { Bar, candleFrames, nine } from '../ui/skin';
import { current } from '../state/run';
import { BALANCE_VERSION, Battle, EXECUTE_AT, ZEAL_MAX, skillsFor, type BattleEvent, type Unit } from '../systems/combat';
import { currentNode, makeBattle } from '../systems/crusade';
import { settleBattle } from '../systems/settle';
import { runInBackground, takeBackground } from '../ui/bgFight';
import { newSeed, seeded } from '../systems/rng';
import { enemyKey } from '../ui/enemyArt';
import { intentIconKey } from '../ui/icons';
import { portraitKey } from '../ui/placeholderPortrait';
import { SisterSprite, fullKey } from '../ui/sisterSprite';
import { SKILL_FX, auraFx, burstFx, fxForEnemy, makeFxTextures, type Fx } from '../ui/portraitFx';
import { comboBurst, damageSize, hitStop, popNumber, riteCard, shake, staticDeath, whiteFlash } from '../ui/juice';

const CARD = 128;
const ENEMY_Y = 250;
const PARTY_Y = 585;
/** Party Sisters with full-body art stand as animated figures: box centre, and feet below it. */
const FIGURE_Y = 580;
const FEET = 84;
const FIGURE_BOX = 176;
const ROMAN = ['I', 'II', 'III', 'IV'];
/** Skill buttons sit just above the tab bar, which stays on screen through a fight. */
const SKILL_H = 94;
const slotX = (rank: number) => 8 + CARD / 2 + (rank - 1) * (CARD + 4);

interface Card {
  box: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
  /** ui-unit-frame.png drawn over the portrait and tinted, when present. */
  skinFrame?: Phaser.GameObjects.NineSlice;
  glow: Phaser.GameObjects.Rectangle;
  img: Phaser.GameObjects.Image;
  hp: Bar;
  shieldFill: Phaser.GameObjects.Rectangle;
  hpText: Phaser.GameObjects.Text;
  tags: Phaser.GameObjects.Text;
  /** Enemies: icon and words for the next move. */
  intentIcon?: Phaser.GameObjects.Image;
  intentText?: Phaser.GameObjects.Text;
  /** Party: how much damage is coming at this crusader. */
  threat?: Phaser.GameObjects.Text;
  /** Expected damage while choosing a target. */
  preview: Phaser.GameObjects.Text;
  /** Party Sisters with full-body art: her animated figure (img is its upper body). */
  sprite?: SisterSprite;
  /** A Sister's own Zeal, or a boss's Wrath, under her HP. */
  meter?: Bar;
}

type Mode = 'busy' | 'skill' | 'target';

/** One fight: enemies on top, your party below, skills along the bottom. */
export class BattleScene extends Phaser.Scene {
  private battle!: Battle;
  private cards = new Map<string, Card>();
  private actor?: Unit;
  private mode: Mode = 'busy';
  /** A combo about to pay off on this target: burst on its first hit. */
  private combo?: { uid: string; label: string; color: number };
  /** The acting skill's portrait effect, and who it has already marked this action. */
  private fx?: Fx;
  private fxHit = new Set<string>();
  private chosen?: SkillDef;
  private skillButtons: Phaser.GameObjects.GameObject[] = [];
  private logText!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private zealBar!: Bar;
  private zealText!: Phaser.GameObjects.Text;
  private houndImg?: Phaser.GameObjects.Image;
  private roundText!: Phaser.GameObjects.Text;
  private candle!: Phaser.GameObjects.Graphics;
  private candleSprite?: Phaser.GameObjects.Image;
  private candleFrames = 0;
  private strip: Phaser.GameObjects.GameObject[] = [];
  private vigilMax = 8;
  private toggles: Phaser.GameObjects.GameObject[] = [];
  /** A tab the player tapped while the enemy was acting: open it at the next party turn. */
  private leaveFor?: string;
  /** The fight is over (paid out); only the closing line is showing. */
  private ended = false;
  /** Whether the current actor has acted, so a fight sent to the background knows where it stands. */
  private acted = true;

  constructor() {
    super('Battle');
  }

  create() {
    // An Auto fight left running in the background comes back on screen.
    const away = takeBackground();
    const run = current.run;
    const challenge = current.challenge;
    const node = run && currentNode(run);
    if (!away && !challenge && (!run || !node?.encounter)) {
      this.scene.start('Crypt');
      return;
    }
    const encounter = challenge ? challenge.label : node?.encounter ?? '';
    // A fight left from the Menu picks up where it stopped, if it is this same fight.
    const p = current.paused;
    const resume = p && (challenge ? p.challenge === challenge : !p.challenge && p.run === run && p.floor === run!.floor && p.at === run!.at) ? p : undefined;
    if (away) {
      this.battle = away.battle;
    } else if (resume) {
      current.paused = undefined;
      this.battle = resume.battle;
    } else {
      // Seeded so a reported fight can be replayed exactly (see window.__crtLastBattle).
      const seed = newSeed();
      this.battle = challenge ? challenge.make(seeded(seed)) : makeBattle(game.save, run!, encounter, seeded(seed));
      (window as unknown as Record<string, unknown>).__crtLastBattle = { balance: BALANCE_VERSION, encounter, seed, log: this.battle.log };
      // Tech demo: a new fight plays out in real time on an open field instead.
      if (settings.realtimeBattles) {
        this.scene.start('Field', { battle: this.battle });
        return;
      }
    }
    music.play(this.battle.units.some((u) => u.side === 'enemy' && u.boss) ? 'boss' : 'battle');
    music.preload('victory', 'defeat');
    this.leaveFor = undefined;
    this.ended = false;
    this.acted = true;
    this.vigilMax = away ? away.vigilMax : resume ? resume.vigilMax : this.battle.vigil;
    this.cards.clear();
    this.mode = 'busy';
    this.chosen = undefined;
    this.skillButtons = [];
    this.strip = [];

    this.cameras.main.setBackgroundColor(0x0e0d11);
    const style = { fontFamily: FONT, color: hex(PAL.ivory) };
    this.roundText = this.add.text(16, 24, '', { ...style, fontSize: '22px', color: hex(PAL.steel) }).setOrigin(0, 0.5);
    this.applySpeed();
    this.drawToggles();
    this.candle = this.add.graphics();
    this.candleFrames = candleFrames(this);
    if (this.candleFrames) this.candleSprite = this.add.image(GAME_W - 33, 25, 'ui-vigil-candle', 0);
    this.add.text(GAME_W - 52, 24, 'Vigil', { ...style, fontSize: '17px', color: hex(PAL.steel) }).setOrigin(1, 0.5);

    for (let i = 0; i < 4; i++) {
      // Enemy rank numerals sit in the card corner, leaving the space above for intents.
      this.add.text(slotX(i + 1) - CARD / 2 + 4, ENEMY_Y - CARD / 2 + 2, ROMAN[i], { ...style, fontSize: '17px', color: hex(PAL.steel) }).setDepth(5);
      if (this.figures()) this.add.text(slotX(i + 1) - CARD / 2 + 4, FIGURE_Y + FEET + 28, ROMAN[i], { ...style, fontSize: '17px', color: hex(PAL.steel) }).setOrigin(0, 0.5);
      else this.add.text(slotX(i + 1), PARTY_Y - 84, ROMAN[i], { ...style, fontSize: '17px', color: hex(PAL.armorShadow) }).setOrigin(0.5);
    }

    this.logText = this.add
      .text(GAME_W / 2, 398, '', { ...style, fontSize: '22px', align: 'center', wordWrap: { width: GAME_W - 40 } })
      .setOrigin(0.5);
    if (!this.textures.exists('ui-bar-frame')) this.add.rectangle(GAME_W / 2, 442, 404, 18, PAL.deepShadow).setStrokeStyle(2, PAL.armorShadow);
    this.zealBar = new Bar(this, GAME_W / 2 - 200, 442, 400, 14, 'ui-bar-zeal', PAL.amber, PAL.deepShadow);
    this.zealText = this.add.text(GAME_W / 2, 463, '', { ...style, fontSize: '16px', color: hex(PAL.steel) }).setOrigin(0.5);
    this.drawHound();

    this.descText = this.add
      .text(GAME_W / 2, 740, '', { ...style, fontSize: '18px', align: 'center', color: hex(PAL.steel), wordWrap: { width: GAME_W - 40 } })
      .setOrigin(0.5);

    // The tab bar stays through the fight; leaving by it pauses the fight.
    addTabBar(this, 'Battle', 20, (k) => this.leaveTo(k));

    makeFxTextures(this);
    for (const u of this.battle.units) this.makeCard(u);
    this.refresh();
    if (away) {
      this.logText.setText('The fight went on without you.');
      this.time.delayedCall(400, () => (away.pending ? this.resumeTurn(away.pending.uid) : this.step()));
    } else if (resume) {
      this.logText.setText('The fight resumes.');
      this.time.delayedCall(400, () => this.resumeTurn(resume.actorUid));
    } else {
      this.logText.setText(challenge ? challenge.label : 'The dark stirs. Steel yourselves, Sisters.');
      this.time.delayedCall(600, () => this.step());
    }
  }

  // ---------- leaving mid-fight ----------

  /**
   * A tab tapped mid-fight: the fight waits on the player's turn (now, or the
   * next one), then that screen opens. Resume it from the Crusade tab.
   */
  private leaveTo(key: string) {
    if (this.ended) return;
    // On Auto the fight plays on in the background.
    if (settings.autoBattle) {
      runInBackground(this.battle, this.vigilMax, this.acted ? undefined : this.actor);
      this.mode = 'busy';
      this.clearSkills();
      this.scene.start(key, {});
      return;
    }
    if (this.actor?.side === 'party' && (this.mode === 'skill' || this.mode === 'target')) return this.pauseAndGo(key);
    this.leaveFor = key;
    this.descText.setText('The fight will wait at your next turn.');
  }

  private pauseAndGo(key: string) {
    const actor = this.actor!;
    current.paused = { battle: this.battle, actorUid: actor.uid, vigilMax: this.vigilMax, run: current.challenge ? undefined : current.run, floor: current.run?.floor, at: current.run?.at, challenge: current.challenge };
    this.mode = 'busy';
    this.clearSkills();
    this.scene.start(key, {});
  }

  /** Back to a party member's turn after a pause. */
  private resumeTurn(uid: string) {
    this.actor = this.battle.get(uid);
    this.refresh();
    this.mode = 'skill';
    this.chosen = undefined;
    this.logText.setText(`${this.actor.name}'s turn`);
    if (settings.autoBattle) this.time.delayedCall(350, () => this.autoAct());
    else this.showSkills();
  }

  // ---------- turn flow ----------

  private step() {
    const t = this.battle.nextTurn();
    this.acted = !!t.outcome;
    this.play(t.events, () => {
      if (t.outcome) return this.end(t.outcome);
      this.actor = t.actor!;
      this.refresh();
      if (this.actor.side === 'enemy') {
        this.time.delayedCall(550, () => {
          const { skill, target } = this.battle.enemyChoose(this.actor!);
          this.perform(skill, target);
        });
      } else {
        this.mode = 'skill';
        this.chosen = undefined;
        this.logText.setText(`${this.actor.name}'s turn`);
        if (this.leaveFor) return this.pauseAndGo(this.leaveFor);
        if (settings.autoBattle) this.time.delayedCall(350, () => this.autoAct());
        else this.showSkills();
      }
    });
  }

  private perform(skill: SkillDef, target?: Unit) {
    const actor = this.actor!;
    this.mode = 'busy';
    this.clearSkills();
    this.lunge(actor, skill);
    this.combo = undefined;
    if (target && skill.detonate && target.status.poison) this.combo = { uid: target.uid, label: 'IGNITED!', color: 0xff8a3d };
    else if (target && skill.execute && target.hp < target.maxHp * EXECUTE_AT) this.combo = { uid: target.uid, label: 'SENTENCED!', color: 0xe04848 };
    // Each skill and enemy has its own effect: a cast around the actor, then a mark on each target.
    this.fx = actor.side === 'party' ? SKILL_FX[skill.id] : fxForEnemy(actor.ref);
    this.fxHit.clear();
    const cast = this.cards.get(actor.uid);
    if (this.fx && cast) burstFx(this, cast.box.x, cast.box.y, CARD * 0.8, { ...this.fx, power: (this.fx.power ?? 1) * 0.6 });
    const go = () => {
      this.acted = true;
      this.play(this.battle.act(actor, skill, target), () => {
        this.fx = undefined;
        this.step();
      });
    };
    // A boss's Blasphemy gets its card when it lands, not on the turn it charges.
    if (skill.rite && (actor.side === 'party' || actor.status.charging)) riteCard(this, skill.name, actor.name, go, actor.side === 'party' ? 'INVOKES' : 'UNLEASHES A BLASPHEMY');
    else go();
  }

  private end(outcome: 'victory' | 'defeat') {
    music.stinger(outcome, 'end');
    // Paid out at once, so leaving during the closing line loses nothing.
    this.ended = true;
    this.mode = 'busy';
    this.clearSkills();
    const next = settleBattle(this.battle, outcome);
    if (outcome === 'victory') [...this.cards.values()].forEach((c, i) => c.sprite?.cheer(i * 90));
    this.logText.setText(next.line);
    this.time.delayedCall(1200, () => this.scene.start(next.scene, next.data ?? {}));
  }

  // ---------- input ----------

  /** Auto and speed switches along the top. */
  private drawToggles() {
    this.toggles.forEach((o) => o.destroy());
    const auto = makeButton(this, 236, 24, 92, 40, settings.autoBattle ? 'Auto: On' : 'Auto', () => this.toggleAuto(), { active: settings.autoBattle, fontSize: 19 });
    const speed = makeButton(this, 340, 24, 92, 40, settings.battleSpeed === 2 ? 'Speed 2x' : 'Speed 1x', () => this.toggleSpeed(), { active: settings.battleSpeed === 2, fontSize: 19 });
    this.toggles = [auto.box, auto.text, speed.box, speed.text];
  }

  private toggleAuto() {
    settings.autoBattle = !settings.autoBattle;
    saveSettings();
    this.drawToggles();
    // Switching on mid-turn takes over at once.
    if (settings.autoBattle && (this.mode === 'skill' || this.mode === 'target')) this.autoAct();
    else if (!settings.autoBattle && this.mode === 'skill' && this.actor?.side === 'party' && !this.skillButtons.length) this.showSkills();
  }

  private toggleSpeed() {
    settings.battleSpeed = settings.battleSpeed === 2 ? 1 : 2;
    saveSettings();
    this.applySpeed();
    this.drawToggles();
  }

  private applySpeed() {
    this.time.timeScale = settings.battleSpeed;
    this.tweens.timeScale = settings.battleSpeed;
  }

  private autoAct() {
    if (!settings.autoBattle || this.mode === 'busy' || this.actor?.side !== 'party') return;
    const actor = this.actor;
    // Auto takes the free Step first when it puts Sisters back in their ranks.
    const partner = autoStep(this.battle, actor);
    if (partner) this.battle.step(actor, partner);
    const c = autoChoose(this.battle, actor);
    this.refresh();
    this.perform(c.skill, c.target);
  }

  private showSkills() {
    this.clearSkills();
    const actor = this.actor!;
    const skills = skillsFor(actor);
    // order: three skills, Step, Rite
    const order = [skills[0], skills[1], skills[2], skills[4], skills[3]];
    const w = 102;
    order.forEach((s, i) => {
      const x = 9 + w / 2 + i * (w + 3);
      const y = 819;
      const step = s.id === 'shift';
      const usable = step ? this.battle.canStep(actor) : this.battle.canUse(actor, s);
      const selected = this.chosen === s;
      const color = s.rite ? PAL.amber : PAL.oxblood;
      const box = this.add
        .rectangle(x, y, w, SKILL_H, selected ? color : PAL.deepShadow)
        .setStrokeStyle(2, usable ? color : PAL.armorShadow)
        .setAlpha(usable ? 1 : 0.4);
      // ui-skill / ui-skill-selected / ui-skill-rite .png, when present
      const skinKey = selected ? 'ui-skill-selected' : s.rite ? (this.textures.exists('ui-skill-litany') ? 'ui-skill-litany' : 'ui-skill-rite') : 'ui-skill';
      const skin = nine(this, skinKey, x, y, w, SKILL_H);
      if (skin) {
        box.setFillStyle(0x000000, 0.001).setStrokeStyle().setAlpha(1);
        skin.setAlpha(usable ? 1 : 0.4);
        this.skillButtons.push(skin);
      }
      const cd = actor.cooldowns?.[s.id] ?? 0;
      // skill-<id>.png (32 x 32) sits above the name when present
      const icon = addArt(this, `skill-${s.id}`, x, y - 25, 30);
      if (icon) {
        icon.setAlpha(usable ? 1 : 0.4);
        this.skillButtons.push(icon);
      }
      const label = this.add
        .text(x, icon ? y + 18 : y, s.rite ? `LITANY\n${s.name}` : step ? (actor.stepped ? 'Stepped' : 'Step\n(free)') : cd > 0 ? `${s.name}\n(ready in ${cd})` : s.name, {
          fontFamily: FONT,
          fontSize: icon ? '16px' : '18px',
          color: hex(selected && s.rite && !skin ? PAL.bg : PAL.ivory),
          align: 'center',
          wordWrap: { width: w - 12 },
        })
        .setOrigin(0.5)
        .setAlpha(usable ? 1 : 0.4);
      // Tap picks the skill; hold opens its full description.
      let held = false;
      let timer: Phaser.Time.TimerEvent | undefined;
      box.setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => {
        held = false;
        timer = this.time.delayedCall(420 * settings.battleSpeed, () => {
          held = true;
          showDetail(this, { title: s.name, color: s.rite ? PAL.amber : PAL.ivory, tags: s.rite ? 'LITANY · HER ZEAL FULL' : step ? 'FREE · ONCE A TURN' : `SKILL${s.cooldown ? ` · COOLDOWN ${s.cooldown}` : ''}`, desc: s.desc }, 60);
        });
      });
      box.on('pointerout', () => timer?.remove());
      box.on('pointerup', () => {
        timer?.remove();
        if (!held) this.pickSkill(s, usable);
      });
      this.skillButtons.push(box, label);
    });
    if (!this.chosen) this.descText.setText('Choose a skill');
  }

  private pickSkill(s: SkillDef, usable: boolean) {
    if (this.mode === 'busy') return;
    const actor = this.actor!;
    if (s.id === 'shift') return this.pickStep(usable);
    if (!usable) {
      const cd = actor.cooldowns?.[s.id] ?? 0;
      const why = cd > 0 ? `Cooling down: ready in ${cd} turn${cd > 1 ? 's' : ''}.` : s.rite && (actor.zeal ?? 0) < ZEAL_MAX ? `Needs her own Zeal full (${actor.zeal ?? 0}/${ZEAL_MAX}).` : s.from.length ? `Usable from rank ${s.from.map((r) => ROMAN[r - 1]).join(', ')}.` : 'No target in reach.';
      this.descText.setText(`${s.name}: ${s.desc}\n${why}`);
      return;
    }
    // Tapping the chosen group or self skill again confirms it
    if (this.chosen === s && (s.target !== 'enemy' && s.target !== 'ally')) {
      this.perform(s);
      return;
    }
    this.chosen = s;
    this.mode = 'target';
    const targets = this.battle.validTargets(actor, s);
    const group = s.target === 'allEnemies' || s.target === 'allAllies' || s.target === 'self';
    this.descText.setText(`${s.name}: ${s.desc}\n${group ? 'Tap again, or tap a glowing card, to confirm.' : 'Tap a glowing target.'}`);
    this.showSkills();
    this.refresh(targets);
  }

  /** Step: choose the neighbour to trade places with. It costs nothing and she still acts. */
  private pickStep(usable: boolean) {
    const actor = this.actor!;
    const s = skillsFor(actor).find((x) => x.id === 'shift')!;
    if (!usable) {
      this.descText.setText(actor.stepped ? 'She has already stepped this turn. Choose a skill.' : 'No Sister stands beside her.');
      return;
    }
    if (this.chosen === s) {
      // Tapping Step again cancels it.
      this.chosen = undefined;
      this.mode = 'skill';
      this.showSkills();
      this.refresh();
      return;
    }
    this.chosen = s;
    this.mode = 'target';
    this.descText.setText(`Step: ${s.desc.split('. ')[0]}.\nTap the glowing Sister to trade places with her.`);
    this.showSkills();
    this.refresh(this.battle.stepTargets(actor));
  }

  private doStep(u: Unit) {
    const actor = this.actor!;
    const events = this.battle.step(actor, u);
    if (!events.length) return;
    this.mode = 'busy';
    this.chosen = undefined;
    this.clearSkills();
    this.play(events, () => {
      this.mode = 'skill';
      this.logText.setText(`${actor.name} steps beside ${u.name}. Still her turn.`);
      this.showSkills();
      this.refresh();
    });
  }

  private pickTarget(u: Unit) {
    if (this.mode !== 'target' || !this.chosen) return;
    const s = this.chosen;
    if (s.id === 'shift') return this.doStep(u);
    if (!this.battle.validTargets(this.actor!, s).includes(u)) return;
    this.perform(s, u);
  }

  /** Expected damage and combo callouts on a glowing target. */
  private previewText(t: Unit): string {
    const s = this.chosen;
    const actor = this.actor;
    if (!s || !actor || t.side === actor.side) return '';
    const dmg = this.battle.preview(actor, s, t);
    if (!dmg) return s.spreadPoison && t.status.poison ? 'SPREAD' : '';
    const combo =
      (s.bonusIfWeak && t.status.weaken) ||
      (s.bonusIfAccused && t.status.accused) ||
      (s.execute && t.hp < t.maxHp * 0.3) ||
      (s.detonate && t.status.poison) ||
      (s.spreadPoison && t.status.poison);
    return `${dmg >= t.hp ? 'KILL' : `~${dmg}`}${combo ? '\nCOMBO' : ''}`;
  }

  /** Tapping an enemy outside targeting spells out its next move. */
  private explain(u: Unit) {
    const view = this.battle.intentOf(u);
    if (!view || this.mode === 'busy') return;
    const who = view.targets.length === 1 ? view.targets[0].name : 'all your Sisters';
    let text: string;
    if (view.kind === 'summon') text = `${u.name} will call another abomination into the line.`;
    else if (view.kind === 'buff') text = `${u.name} will use ${view.skill.name}: ${view.skill.desc || 'it strengthens its side.'}`;
    else if (view.kind === 'charge' && !view.charging) text = `${u.name} will start charging ${view.skill.name}: about ${view.estimate} to each of you the turn after. Delay it to break the charge.`;
    else text = `${u.name} will use ${view.skill.name} on ${who} for about ${view.estimate}${view.skill.target === 'allEnemies' ? ' each' : ''}.`;
    if (view.skill.weaken) text += ' It also Weakens.';
    if (view.skill.poison) text += ' It also Poisons.';
    if (view.skill.bleed) text += ' It leaves its target Bleeding.';
    if (view.skill.sunder) text += ' It Sunders armor.';
    if (view.skill.stun) text += ' It Stuns.';
    if (view.skill.zealDrain) text += ` It steals ${view.skill.zealDrain} Zeal.`;
    if (view.skill.rite) text = `BLASPHEMY! ${text}`;
    if (view.skill.pull) text += ' It drags its target to the front rank.';
    if (ENEMIES[u.ref].burst) text += ' When it dies, it bursts over all your Sisters.';
    // Which defence is thin, and which Order it fears.
    const thin = u.mres < u.armor * 0.6 ? 'Magic' : u.armor < u.mres * 0.6 ? 'Physical' : '';
    text += ` ${thin ? `Weak to ${thin} damage.` : 'Armor and Magic Resist alike.'}`;
    if (u.bane) text += ` Fears the ${u.bane}: her Sisters deal +25% to it.`;
    text += ` It deals ${u.dmg === 'magic' ? 'Magic' : 'Physical'} damage.`;
    if (view.kind === 'attack' || view.kind === 'debuff') text += ' A Taunt pulls it away, and a free Step can move out of its reach.';
    this.descText.setText(text);
  }

  private clearSkills() {
    this.skillButtons.forEach((o) => o.destroy());
    this.skillButtons = [];
    this.descText?.setText('');
  }

  // ---------- drawing ----------

  /** True when the party stands as full-body figures (any Sister in it has the art). */
  private figures() {
    return this.battle.units.some((u) => u.side === 'party' && this.textures.exists(fullKey(u.ref)));
  }

  private makeCard(u: Unit) {
    const party = u.side === 'party';
    if (party && this.textures.exists(fullKey(u.ref))) return this.makeFigure(u);
    const key = party ? portraitKey(u.ref) : enemyKey(u.ref);
    const border = party ? RARITY_COLOR[CRUSADERS.find((c) => c.id === u.ref)!.rarity] : u.boss ? PAL.oxblood : PAL.armorShadow;
    const glow = this.add.rectangle(0, 0, CARD + 14, CARD + 14).setStrokeStyle(5, PAL.amber).setVisible(false);
    const frame = this.add.rectangle(0, 0, CARD + 6, CARD + 6, 0x000000).setStrokeStyle(3, border);
    const img = this.add.image(0, 0, key).setDisplaySize(CARD, CARD);
    // ui-unit-frame.png (tinted per rarity) over the portrait, when present
    const skinFrame = nine(this, 'ui-unit-frame', 0, 0, CARD + 6, CARD + 6) ?? undefined;
    if (skinFrame) frame.setStrokeStyle();
    const hp = new Bar(this, -CARD / 2, CARD / 2 + 12, CARD, 10, party ? 'ui-bar-hp' : 'ui-bar-hp-enemy', party ? 0x7a9a5a : PAL.oxblood);
    const shieldFill = this.add.rectangle(-CARD / 2, CARD / 2 + 12, 0, 4, PAL.ivory).setOrigin(0, 0.5);
    const hpText = this.add.text(0, CARD / 2 + 35, '', { fontFamily: FONT, fontSize: '17px', color: hex(PAL.ivory) }).setOrigin(0.5);
    const tags = this.add
      .text(0, CARD / 2 + 52, '', { fontFamily: FONT, fontSize: '15px', color: hex(PAL.violet), align: 'center' })
      .setOrigin(0.5);
    // Her own Zeal (a Sister) or its Wrath (a boss), just under the HP bar.
    const meter = party || u.wrath !== undefined ? new Bar(this, -CARD / 2, CARD / 2 + 21, CARD, 8, party ? 'ui-bar-litany' : 'ui-bar-wrath', party ? PAL.bronze : 0xb0303a) : undefined;
    const y = party ? PARTY_Y : ENEMY_Y;
    const box = this.add.container(slotX(u.rank), y, [glow, frame, img, ...(skinFrame ? [skinFrame] : []), ...hp.parts, ...(meter?.parts ?? []), shieldFill, hpText, tags]);
    box.setSize(CARD, CARD).setInteractive({ useHandCursor: true });
    box.on('pointerup', () => (this.mode === 'target' ? this.pickTarget(u) : this.explain(u)));
    const preview = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '26px', color: hex(PAL.amber), stroke: '#000000', strokeThickness: 5, align: 'center' })
      .setOrigin(0.5);
    box.add(preview);
    // Enemies carry their own idle aura behind the portrait.
    if (!party) auraFx(this, box, CARD, fxForEnemy(u.ref), skinFrame ?? img);
    const card: Card = { box, frame, skinFrame, glow, img, hp, shieldFill, hpText, tags, preview, meter };
    if (party) {
      card.threat = this.add
        .text(0, -CARD / 2 + 3, '', { fontFamily: FONT, fontSize: '18px', color: hex(PAL.ivory), backgroundColor: '#652b3b', padding: { x: 5, y: 2 } })
        .setOrigin(0.5, 0);
      box.add(card.threat);
      // Her Order's sigil, as on every portrait.
      if (u.order) {
        box.add(this.add.circle(CARD / 2 - 16, -CARD / 2 + 16, 14, 0x0d090f, 0.9));
        const sig = addOrderSigil(this, CARD / 2 - 16, -CARD / 2 + 16, u.order, 24);
        if (sig) box.add(sig);
      }
    } else {
      // Intent sits above the card: what this enemy will do on its next turn.
      card.intentIcon = this.add.image(-CARD / 2 + 12, -CARD / 2 - 42, intentIconKey('attack')).setDisplaySize(24, 24);
      card.intentText = this.add
        .text(-CARD / 2 + 28, -CARD / 2 - 28, '', { fontFamily: FONT, fontSize: '17px', color: hex(PAL.ivory), lineSpacing: -2, wordWrap: { width: CARD - 26 } })
        .setOrigin(0, 1); // grows upward when a long name wraps
      box.add([card.intentIcon, card.intentText]);
      // Its bane Order's sigil, and the damage it is weak to.
      const sig = u.bane ? addOrderSigil(this, CARD / 2 - 16, -CARD / 2 + 16, u.bane, 22) : undefined;
      if (sig) box.add(sig);
      const thin = u.mres < u.armor * 0.6 ? 'MAG' : u.armor < u.mres * 0.6 ? 'PHY' : '';
      if (thin) box.add(this.add.text(CARD / 2 - 4, -CARD / 2 + 30, `WEAK ${thin}`, { fontFamily: FONT, fontSize: '11px', color: hex(thin === 'MAG' ? 0x9ab8f0 : 0xd8b48a), backgroundColor: '#140d16', padding: { x: 3, y: 1 } }).setOrigin(1, 0));
    }
    if (u.hp <= 0) box.setAlpha(0);
    this.cards.set(u.uid, card);
  }

  /** A party Sister as her animated full-body figure, with her bars underneath. */
  private makeFigure(u: Unit) {
    const rarity = RARITY_COLOR[CRUSADERS.find((c) => c.id === u.ref)!.rarity];
    const sprite = new SisterSprite(this, u.ref, 0, FEET, 1, rarity);
    const midY = FEET - FIGURE_BOX / 2;
    const glow = this.add.rectangle(0, midY, CARD + 6, FIGURE_BOX + 6).setStrokeStyle(5, PAL.amber).setVisible(false);
    // An invisible stand-in for the old card frame, so refresh() can treat both alike.
    const frame = this.add.rectangle(0, midY, CARD, FIGURE_BOX).setVisible(false);
    const hp = new Bar(this, -CARD / 2, FEET + 12, CARD, 10, 'ui-bar-hp', 0x7a9a5a);
    const shieldFill = this.add.rectangle(-CARD / 2, FEET + 12, 0, 4, PAL.ivory).setOrigin(0, 0.5);
    const meter = new Bar(this, -CARD / 2, FEET + 21, CARD, 8, 'ui-bar-litany', PAL.bronze);
    const hpText = this.add.text(0, FEET + 35, '', { fontFamily: FONT, fontSize: '17px', color: hex(PAL.ivory) }).setOrigin(0.5);
    const tags = this.add.text(0, FEET + 51, '', { fontFamily: FONT, fontSize: '15px', color: hex(PAL.violet), align: 'center', lineSpacing: -4, wordWrap: { width: CARD } }).setOrigin(0.5, 0.3);
    const preview = this.add
      .text(0, midY, '', { fontFamily: FONT, fontSize: '26px', color: hex(PAL.amber), stroke: '#000000', strokeThickness: 5, align: 'center' })
      .setOrigin(0.5);
    const threat = this.add
      .text(0, -FEET - 4, '', { fontFamily: FONT, fontSize: '18px', color: hex(PAL.ivory), backgroundColor: '#652b3b', padding: { x: 5, y: 2 } })
      .setOrigin(0.5, 0);
    const box = this.add.container(slotX(u.rank), FIGURE_Y, [glow, frame, sprite.root, ...hp.parts, ...meter.parts, shieldFill, hpText, tags, preview, threat]);
    // Her Order's sigil by her feet.
    if (u.order) {
      box.add(this.add.circle(CARD / 2 - 14, FEET - 14, 13, 0x0d090f, 0.85));
      const sig = addOrderSigil(this, CARD / 2 - 14, FEET - 14, u.order, 22);
      if (sig) box.add(sig);
    }
    box.setSize(CARD, FIGURE_BOX).setInteractive(new Phaser.Geom.Rectangle(0, 0, CARD, FIGURE_BOX + 40), Phaser.Geom.Rectangle.Contains);
    box.on('pointerup', () => (this.mode === 'target' ? this.pickTarget(u) : this.explain(u)));
    if (u.hp <= 0) {
      box.setAlpha(0);
      sprite.dead = true;
    }
    this.cards.set(u.uid, { box, frame, glow, img: sprite.upper, hp, shieldFill, hpText, tags, threat, preview, sprite, meter });
  }

  /** Redraws every card, the turn strip, Zeal and the candle. */
  private refresh(highlight: Unit[] = []) {
    for (const u of this.battle.units) {
      const c = this.cards.get(u.uid) ?? (this.makeCard(u), this.cards.get(u.uid)!);
      const dead = u.hp <= 0;
      // A fallen card stays up until its death plays out (see show 'death').
      if (dead) c.box.disableInteractive();
      else c.box.setAlpha(1);
      const tx = slotX(u.rank);
      if (!dead && c.box.x !== tx) this.tweens.add({ targets: c.box, x: tx, duration: 250 });
      c.hp.set(u.hp / u.maxHp);
      if (c.meter) {
        const v = (u.side === 'party' ? u.zeal : u.wrath) ?? 0;
        c.meter.set(v / ZEAL_MAX, v >= ZEAL_MAX ? (u.side === 'party' ? 0xffd36a : 0xff4a4a) : u.side === 'party' ? 0xc8902e : 0xa8262f);
      }
      c.shieldFill.width = Math.min(CARD, (CARD * (u.status.shield ?? 0)) / u.maxHp);
      c.hpText.setText(`${u.hp}/${u.maxHp}`);
      const st = u.status;
      const tags = [
        st.poison && `${st.poison.kind === 'burn' ? 'Burn' : 'Poison'} ${st.poison.turns}`,
        st.bleed && `Bleed ${st.bleed.turns}`,
        st.stun && 'Stunned',
        st.sunder && 'Sundered',
        st.hex && 'Hexed',
        st.weaken && 'Weak',
        st.haste && 'Haste',
        st.regen && 'Regen',
        st.ward && 'Ward',
        st.accused && 'Accused',
        st.taunt && 'Taunt',
        st.empower && 'Empowered',
        st.charging && 'Charging',
        u.side === 'enemy' && ENEMIES[u.ref].burst && 'Bursts',
      ].filter(Boolean);
      c.tags.setText(tags.join(' · '));
      const active = this.actor?.uid === u.uid && !dead;
      if (c.sprite) {
        if (!dead && c.sprite.dead) c.sprite.revive();
        c.sprite.setActive(active);
      }
      const edge = active ? PAL.ivory : u.side === 'party' ? RARITY_COLOR[CRUSADERS.find((x) => x.id === u.ref)!.rarity] : u.boss ? PAL.oxblood : PAL.armorShadow;
      if (c.skinFrame) c.skinFrame.setTint(edge);
      else if (!c.sprite) c.frame.setStrokeStyle(active ? 5 : 3, edge);
      c.glow.setVisible(highlight.includes(u));
      c.preview.setText(highlight.includes(u) ? this.previewText(u) : '');
      if (highlight.includes(u)) {
        this.tweens.killTweensOf(c.glow);
        c.glow.setAlpha(1);
        this.tweens.add({ targets: c.glow, alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });
      }
    }

    this.drawIntents();

    const b = this.battle;
    // The big bar follows the Sister whose turn it is; each Sister's own bar sits under her HP.
    const who = this.actor?.side === 'party' ? this.actor : undefined;
    const ready = b.alive('party').filter((u) => (u.zeal ?? 0) >= ZEAL_MAX).length;
    const z = who?.zeal ?? 0;
    this.zealBar.set(who ? z / ZEAL_MAX : 0, z >= ZEAL_MAX ? PAL.amber : PAL.bronze);
    this.zealText.setText(
      who
        ? z >= ZEAL_MAX
          ? `${who.name.split(' ')[0]}'s ZEAL ABLAZE: her Litany is ready`
          : `${who.name.split(' ')[0]}'s Zeal ${z} / ${ZEAL_MAX}${ready ? `  ·  ${ready} Litan${ready > 1 ? 'ies' : 'y'} ready` : ''}`
        : ready
          ? `${ready} Litan${ready > 1 ? 'ies' : 'y'} ready`
          : 'Each Sister fills her own Zeal',
    );
    this.roundText.setText(`Round ${Math.max(1, b.round)}`);

    // Vigil candle: shrinks each round; once out, enemies grow stronger
    const left = Math.max(0, b.vigil) / this.vigilMax;
    if (this.candleSprite) {
      // ui-vigil-candle.png: a strip of frames, full to snuffed
      const n = this.candleFrames;
      this.candleSprite.setFrame(b.vigil > 0 ? Math.min(n - 2, Math.floor((1 - left) * (n - 1))) : n - 1);
    } else this.drawCandle(left, b.vigil > 0);

    // Turn strip: who acts now and next
    this.strip.forEach((o) => o.destroy());
    this.strip = [];
    const order = [this.actor, ...b.upcoming()].filter((u): u is Unit => !!u && u.hp > 0).slice(0, 7);
    this.strip.push(this.add.text(16, 70, 'Turn', { fontFamily: FONT, fontSize: '16px', color: hex(PAL.steel) }).setOrigin(0, 0.5));
    order.forEach((u, i) => {
      const x = 80 + i * 60;
      const key = u.side === 'party' ? portraitKey(u.ref) : enemyKey(u.ref);
      const fr = this.add.rectangle(x, 70, 54, 54, 0x000000).setStrokeStyle(i === 0 ? 3 : 1, u.side === 'party' ? PAL.bronze : PAL.oxblood);
      const im = this.add.image(x, 70, key).setDisplaySize(48, 48).setAlpha(i === 0 ? 1 : 0.75);
      this.strip.push(fr, im);
      // ui-turn-frame.png over each face in the strip, when present
      const tf = nine(this, 'ui-turn-frame', x, 70, 54, 54);
      if (tf) {
        fr.setStrokeStyle();
        if (i > 0) tf.setAlpha(0.75);
        this.strip.push(tf);
      }
    });
  }

  /** The drawn candle, used when there is no ui-vigil-candle.png. */
  private drawCandle(left: number, lit: boolean) {
    const g = this.candle.clear();
    const h = 34;
    g.fillStyle(PAL.deepShadow).fillRect(GAME_W - 40, 8, 14, h);
    g.fillStyle(PAL.ivory).fillRect(GAME_W - 40, 8 + h * (1 - left), 14, h * left);
    if (lit) g.fillStyle(PAL.amber).fillTriangle(GAME_W - 33, 8 + h * (1 - left) - 12, GAME_W - 38, 8 + h * (1 - left) - 2, GAME_W - 28, 8 + h * (1 - left) - 2);
    else g.fillStyle(PAL.oxblood).fillRect(GAME_W - 46, 46, 26, 4);
  }

  /** Enemy intents above each enemy, and the damage each crusader is about to take. */
  private drawIntents() {
    const incoming = new Map<string, number>();
    for (const u of this.battle.units) {
      const c = this.cards.get(u.uid);
      if (!c?.intentText || !c.intentIcon) continue;
      const view = this.battle.intentOf(u);
      c.intentIcon.setVisible(!!view);
      if (!view) {
        c.intentText.setText('');
        continue;
      }
      c.intentIcon.setTexture(intentIconKey(view.charging ? 'charge' : view.kind)).setDisplaySize(24, 24);
      const who = view.targets.length === 1 ? view.targets[0].name : '';
      let line: string;
      if (view.kind === 'summon') line = 'Summons help';
      else if (view.kind === 'buff') line = view.skill.heal ? `Heals ${who || 'ally'} ${view.estimate}` : view.skill.shieldPct ? `Shields ${who || 'ally'}` : 'Grows stronger';
      else if (view.charging) line = `${view.estimate} to all, next turn!`;
      else if (view.kind === 'charge') line = 'Starts charging';
      else if (view.targets.length > 1 || view.skill.target === 'allEnemies') line = `${view.estimate} to all`;
      else line = who ? `${view.estimate} → ${who}` : `${view.estimate}`;
      c.intentText.setText(`${view.skill.name}\n${line}`);
      c.intentText.setColor(hex(view.charging ? PAL.amber : view.kind === 'aoe' ? 0xd65f5f : PAL.ivory));
      // Wind-ups only hurt on the turn they fire.
      if (view.kind !== 'buff' && (view.kind !== 'charge' || view.charging)) {
        for (const t of view.targets) incoming.set(t.uid, (incoming.get(t.uid) ?? 0) + view.estimate);
      }
    }
    for (const u of this.battle.units) {
      const c = this.cards.get(u.uid);
      if (!c?.threat) continue;
      const raw = incoming.get(u.uid) ?? 0;
      const dmg = Math.max(0, raw - (u.status.shield ?? 0));
      c.threat.setVisible(raw > 0 && u.hp > 0);
      c.threat.setText(dmg === 0 ? 'Blocked' : `${dmg >= u.hp ? 'LETHAL ' : ''}-${dmg}`);
      c.threat.setBackgroundColor(dmg === 0 ? '#383845' : dmg >= u.hp ? '#a03030' : '#652b3b');
    }
  }

  /** Plays battle events one after another, then calls done. */
  private play(events: BattleEvent[], done: () => void) {
    let delay = 0;
    for (const e of events) {
      this.time.delayedCall(delay, () => this.show(e));
      delay += e.type === 'text' ? 250 : e.type === 'phase' ? 700 : e.type === 'zeal' || e.type === 'move' || e.type === 'intent' ? 0 : 220;
    }
    this.time.delayedCall(delay + 250, () => {
      this.refresh();
      done();
    });
  }

  /** The party's hound beside the Zeal bar: it pulses as it howls; tap it for the howl. */
  private drawHound() {
    this.houndImg = undefined;
    const h = this.battle.hound;
    const def = h && HOUNDS.find((d) => d.name === h.name);
    if (!h || !def) return;
    const [, img] = houndFace(this, 36, 438, def, 46);
    this.houndImg = img;
    this.add.text(36, 464, 'HOUND', text.hud(9, PAL.steel)).setOrigin(0.5, 0);
    img.setInteractive({ useHandCursor: true }).on('pointerup', () =>
      showDetail(this, { title: def.name, color: RARITY_COLOR[def.rarity], tags: `${def.rarity} HOUND`, desc: `${h.howlName}, at the start of every round: ${howlParts(h.howl).join('; ')}.`, facts: ['Change hounds in the Kennel or under any party.'] }),
    );
  }

  private show(e: BattleEvent) {
    if (this.fx && (e.type === 'damage' || e.type === 'heal' || e.type === 'shield' || e.type === 'status') && !this.fxHit.has(e.uid)) {
      const c = this.cards.get(e.uid);
      if (c) {
        this.fxHit.add(e.uid);
        burstFx(this, c.box.x, c.box.y, CARD, this.fx);
      }
    }
    switch (e.type) {
      case 'text':
        this.logText.setText(e.text);
        if (this.houndImg && this.battle.hound && e.text.startsWith(`${this.battle.hound.name}:`)) {
          this.tweens.add({ targets: this.houndImg, scale: this.houndImg.scale * 1.25, yoyo: true, duration: 160 });
        }
        break;
      case 'damage': {
        const c = this.cards.get(e.uid);
        if (!c) break;
        const u = this.battle.get(e.uid);
        if (e.amount) popNumber(this, c.box.x, c.box.y - 20, `${e.crit ? 'CRIT ' : ''}-${e.amount}`, e.crit ? PAL.amber : 0xd65f5f, damageSize(e.amount, u.maxHp, e.crit));
        else this.float(c.box, e.blocked ? 'Blocked' : '0', PAL.ivory);
        if (e.blocked && e.amount) this.float(c.box, `(${e.blocked} blocked)`, PAL.ivory, 30);
        if (c.sprite) c.sprite.hit(!!e.amount);
        else this.tweens.add({ targets: c.img, x: { from: -6, to: 6 }, duration: 40, yoyo: true, repeat: 2, onComplete: () => c.img.setX(0) });
        if (e.amount && !c.sprite) {
          whiteFlash(this, c.img, 60);
          this.time.delayedCall(60, () => c.img.setTint(0xff6666));
          this.time.delayedCall(180, () => c.img.clearTint());
        }
        if (this.combo?.uid === e.uid && e.amount) {
          comboBurst(this, c.box.x, c.box.y, this.combo.label, this.combo.color);
          this.combo = undefined;
          shake(this, 'crit');
          hitStop(this, 90);
        } else if (e.crit) {
          shake(this, 'crit');
          hitStop(this, 70);
        }
        this.refresh();
        break;
      }
      case 'heal': {
        const c = this.cards.get(e.uid);
        if (c) this.float(c.box, `+${e.amount}`, 0x9fd27a);
        c?.sprite?.pulse(0x9fd27a);
        this.refresh();
        break;
      }
      case 'shield': {
        const c = this.cards.get(e.uid);
        if (c) this.float(c.box, `Shield ${e.amount}`, PAL.ivory);
        c?.sprite?.pulse(0xf2e6c9);
        this.refresh();
        break;
      }
      case 'status': {
        const c = this.cards.get(e.uid);
        if (c) this.float(c.box, e.label, PAL.violet, 26);
        this.refresh();
        break;
      }
      case 'death': {
        const c = this.cards.get(e.uid);
        if (!c) break;
        const u = this.battle.get(e.uid);
        hitStop(this, u.boss ? 90 : 70);
        shake(this, u.boss ? 'boss' : 'kill');
        if (u.side === 'enemy') staticDeath(this, c.box, CARD + 6, u.boss);
        else if (c.sprite) c.sprite.die(() => this.tweens.add({ targets: c.box, alpha: 0, duration: 200 }));
        else this.tweens.add({ targets: c.box, alpha: 0, scale: 0.85, duration: 400 });
        break;
      }
      case 'summon': {
        const u = this.battle.get(e.uid);
        this.makeCard(u);
        this.logText.setText(`${u.name} rises from the water.`);
        this.refresh();
        break;
      }
      case 'phase': {
        this.logText.setText(e.text);
        shake(this, 'boss');
        const c = this.cards.get(e.uid);
        if (c) {
          c.img.setTint(0xff4444);
          this.time.delayedCall(500, () => c.img.clearTint());
        }
        this.refresh();
        break;
      }
      case 'intent':
      case 'move':
      case 'zeal':
        this.refresh();
        break;
    }
  }

  private float(target: Phaser.GameObjects.Container, text: string, color: number, offset = 0) {
    const t = this.add
      .text(target.x, target.y - 20 + offset, text, { fontFamily: FONT, fontSize: '26px', color: hex(color), stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(30);
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 900, ease: 'Quad.out', onComplete: () => t.destroy() });
  }

  private lunge(u: Unit, skill: SkillDef) {
    const c = this.cards.get(u.uid);
    if (!c) return;
    if (c.sprite) {
      // A strike lunges at the foe; anything else is cast in a halo of the skill's colour.
      if (skill.rite || (skill.target !== 'enemy' && skill.target !== 'allEnemies')) c.sprite.cast(SKILL_FX[skill.id]?.color ?? PAL.amber, !!skill.rite);
      else c.sprite.attack(-1);
      return;
    }
    const dy = u.side === 'party' ? -18 : 18;
    this.tweens.add({ targets: c.box, y: c.box.y + dy, duration: 110, yoyo: true });
  }
}
