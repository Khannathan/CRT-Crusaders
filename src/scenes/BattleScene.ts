import Phaser from 'phaser';
import { music } from '../audio/music';
import { bondBattle } from '../systems/bonds';
import { expBattle } from '../systems/exp';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { addTabBar } from '../ui/tabBar';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { ENEMIES } from '../data/enemies';
import type { SkillDef } from '../data/skills';
import { commit, game } from '../state/game';
import { saveSettings, settings } from '../state/settings';
import { autoChoose } from '../systems/autoplay';
import { makeButton } from '../ui/button';
import { addArt } from '../ui/theme';
import { Bar, candleFrames, nine } from '../ui/skin';
import { current } from '../state/run';
import { BALANCE_VERSION, Battle, EXECUTE_AT, ZEAL_MAX, skillsFor, type BattleEvent, type Unit } from '../systems/combat';
import { absorbBattle, currentNode, finishRun, makeBattle, winRoom } from '../systems/crusade';
import { newSeed, seeded } from '../systems/rng';
import { enemyKey } from '../ui/enemyArt';
import { intentIconKey } from '../ui/icons';
import { portraitKey } from '../ui/placeholderPortrait';
import { SKILL_FX, auraFx, burstFx, fxForEnemy, makeFxTextures, type Fx } from '../ui/portraitFx';
import { comboBurst, damageSize, hitStop, popNumber, riteCard, shake, staticDeath, whiteFlash } from '../ui/juice';

const CARD = 128;
const ENEMY_Y = 250;
const PARTY_Y = 600;
const ROMAN = ['I', 'II', 'III', 'IV'];
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
  private roundText!: Phaser.GameObjects.Text;
  private candle!: Phaser.GameObjects.Graphics;
  private candleSprite?: Phaser.GameObjects.Image;
  private candleFrames = 0;
  private strip: Phaser.GameObjects.GameObject[] = [];
  private vigilMax = 8;
  private toggles: Phaser.GameObjects.GameObject[] = [];
  private pauseAsked = false;
  private menuLayer?: Phaser.GameObjects.Container;

  constructor() {
    super('Battle');
  }

  create() {
    const run = current.run;
    const challenge = current.challenge;
    const node = run && currentNode(run);
    if (!challenge && (!run || !node?.encounter)) {
      this.scene.start('Crypt');
      return;
    }
    const encounter = challenge ? challenge.label : node!.encounter!;
    // A fight left from the Menu picks up where it stopped, if it is this same fight.
    const p = current.paused;
    const resume = p && (challenge ? p.challenge === challenge : !p.challenge && p.run === run && p.floor === run!.floor && p.at === run!.at) ? p : undefined;
    if (resume) {
      current.paused = undefined;
      this.battle = resume.battle;
    } else {
      // Seeded so a reported fight can be replayed exactly (see window.__crtLastBattle).
      const seed = newSeed();
      this.battle = challenge ? challenge.make(seeded(seed)) : makeBattle(game.save, run!, encounter, seeded(seed));
      (window as unknown as Record<string, unknown>).__crtLastBattle = { balance: BALANCE_VERSION, encounter, seed, log: this.battle.log };
    }
    music.play(this.battle.units.some((u) => u.side === 'enemy' && u.boss) ? 'boss' : 'battle');
    music.preload('victory', 'defeat');
    this.pauseAsked = false;
    this.menuLayer = undefined;
    this.vigilMax = resume ? resume.vigilMax : this.battle.vigil;
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
      this.add.text(slotX(i + 1), PARTY_Y - 84, ROMAN[i], { ...style, fontSize: '17px', color: hex(PAL.armorShadow) }).setOrigin(0.5);
    }

    this.logText = this.add
      .text(GAME_W / 2, 405, '', { ...style, fontSize: '22px', align: 'center', wordWrap: { width: GAME_W - 40 } })
      .setOrigin(0.5);
    if (!this.textures.exists('ui-bar-frame')) this.add.rectangle(GAME_W / 2, 455, 404, 18, PAL.deepShadow).setStrokeStyle(2, PAL.armorShadow);
    this.zealBar = new Bar(this, GAME_W / 2 - 200, 455, 400, 14, 'ui-bar-zeal', PAL.amber, PAL.deepShadow);
    this.zealText = this.add.text(GAME_W / 2, 478, '', { ...style, fontSize: '16px', color: hex(PAL.steel) }).setOrigin(0.5);

    this.descText = this.add
      .text(GAME_W / 2, 760, '', { ...style, fontSize: '19px', align: 'center', color: hex(PAL.steel), wordWrap: { width: GAME_W - 40 } })
      .setOrigin(0.5);

    makeFxTextures(this);
    for (const u of this.battle.units) this.makeCard(u);
    this.refresh();
    if (resume) {
      this.logText.setText('The fight resumes.');
      this.time.delayedCall(400, () => this.resumeTurn(resume.actorUid));
    } else {
      this.logText.setText(challenge ? challenge.label : 'The dark stirs. Steel yourselves, Sisters.');
      this.time.delayedCall(600, () => this.step());
    }
  }

  // ---------- leaving mid-fight ----------

  /** Menu: pauses on the player's turn (now, or the next one) and shows the tabs. */
  private askMenu() {
    if (this.menuLayer) return;
    if (this.actor?.side === 'party' && (this.mode === 'skill' || this.mode === 'target')) return this.openMenu();
    this.pauseAsked = true;
    this.descText.setText('The fight will pause at your next turn.');
  }

  private openMenu() {
    const actor = this.actor!;
    current.paused = { battle: this.battle, actorUid: actor.uid, vigilMax: this.vigilMax, run: current.challenge ? undefined : current.run, floor: current.run?.floor, at: current.run?.at, challenge: current.challenge };
    this.mode = 'busy';
    this.clearSkills();
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    const layer = this.add.container(0, 0).setDepth(30);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.9).setInteractive());
    layer.add(this.add.text(GAME_W / 2, 330, 'THE FIGHT WAITS', { ...style, fontSize: '30px', color: hex(PAL.amber) }).setOrigin(0.5));
    layer.add(
      this.add
        .text(GAME_W / 2, 400, 'Your Sisters hold their ground until you return.\nCome back to it from the Crusade tab.', { ...style, fontSize: '19px', color: hex(PAL.muted), wordWrap: { width: GAME_W - 60 } })
        .setOrigin(0.5),
    );
    const resume = makeButton(this, GAME_W / 2, 500, 260, 64, 'Resume the fight', () => {
      layer.destroy();
      tabs.forEach((o) => o.destroy());
      this.menuLayer = undefined;
      current.paused = undefined;
      this.resumeTurn(actor.uid);
    }, { active: true, icon: 'blade' });
    layer.add(resume.all);
    const tabs = addTabBar(this, '', 31);
    this.menuLayer = layer;
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
        if (this.pauseAsked) {
          this.pauseAsked = false;
          return this.openMenu();
        }
        if (settings.autoBattle) this.time.delayedCall(350, () => this.autoAct());
        else this.showSkills();
      }
    });
  }

  private perform(skill: SkillDef, target?: Unit) {
    const actor = this.actor!;
    this.mode = 'busy';
    this.clearSkills();
    this.lunge(actor);
    this.combo = undefined;
    if (target && skill.detonate && target.status.poison) this.combo = { uid: target.uid, label: 'IGNITED!', color: 0xff8a3d };
    else if (target && skill.execute && target.hp < target.maxHp * EXECUTE_AT) this.combo = { uid: target.uid, label: 'SENTENCED!', color: 0xe04848 };
    // Each skill and enemy has its own effect: a cast around the actor, then a mark on each target.
    this.fx = actor.side === 'party' ? SKILL_FX[skill.id] : fxForEnemy(actor.ref);
    this.fxHit.clear();
    const cast = this.cards.get(actor.uid);
    if (this.fx && cast) burstFx(this, cast.box.x, cast.box.y, CARD * 0.8, { ...this.fx, power: (this.fx.power ?? 1) * 0.6 });
    const go = () =>
      this.play(this.battle.act(actor, skill, target), () => {
        this.fx = undefined;
        this.step();
      });
    if (skill.rite && actor.side === 'party') riteCard(this, skill.name, actor.name, go);
    else go();
  }

  private end(outcome: 'victory' | 'defeat') {
    music.stinger(outcome, 'end');
    const challenge = current.challenge;
    // Battle EXP: every Sister still standing.
    const won = expBattle(game.save, this.battle);
    const expLine = won.exp ? `  +${won.exp} EXP${won.levelled.length ? ', level up!' : ''}` : '';
    if (challenge) {
      this.mode = 'busy';
      this.clearSkills();
      this.logText.setText(outcome === 'victory' ? `The trial is passed.${expLine}` : 'Your Sisters fall back, bloodied but alive.');
      this.time.delayedCall(1200, () => {
        current.challenge = undefined;
        bondBattle(game.save, this.battle);
        const next = challenge.finish(outcome, this.battle);
        commit();
        this.scene.start(next.scene, next.data);
      });
      return;
    }
    const run = current.run!;
    absorbBattle(run, this.battle);
    this.mode = 'busy';
    this.clearSkills();
    this.logText.setText(outcome === 'victory' ? `The heretics are purged.${expLine}` : 'Your Sisters have fallen. The dark takes its tithe.');
    this.time.delayedCall(1200, () => {
      if (outcome === 'victory') {
        winRoom(run, game.save);
        commit();
        this.scene.start('Crypt');
      } else {
        const result = finishRun(game.save, run, 'defeat');
        current.run = undefined;
        commit();
        this.scene.start('Results', { result });
      }
    });
  }

  // ---------- input ----------

  /** Auto and speed switches along the top. */
  private drawToggles() {
    this.toggles.forEach((o) => o.destroy());
    const auto = makeButton(this, 236, 24, 92, 40, settings.autoBattle ? 'Auto: On' : 'Auto', () => this.toggleAuto(), { active: settings.autoBattle, fontSize: 19 });
    const speed = makeButton(this, 340, 24, 92, 40, settings.battleSpeed === 2 ? 'Speed 2x' : 'Speed 1x', () => this.toggleSpeed(), { active: settings.battleSpeed === 2, fontSize: 19 });
    const menu = makeButton(this, 150, 24, 70, 40, 'Menu', () => this.askMenu(), { fontSize: 19 });
    this.toggles = [auto.box, auto.text, speed.box, speed.text, ...menu.all];
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
    const c = autoChoose(this.battle, this.actor);
    this.refresh();
    this.perform(c.skill, c.target);
  }

  private showSkills() {
    this.clearSkills();
    const actor = this.actor!;
    const skills = skillsFor(actor);
    // order: three skills, Shift, Rite
    const order = [skills[0], skills[1], skills[2], skills[4], skills[3]];
    const w = 102;
    order.forEach((s, i) => {
      const x = 9 + w / 2 + i * (w + 3);
      const y = 862;
      const usable = this.battle.canUse(actor, s);
      const selected = this.chosen === s;
      const color = s.rite ? PAL.amber : PAL.oxblood;
      const box = this.add
        .rectangle(x, y, w, 120, selected ? color : PAL.deepShadow)
        .setStrokeStyle(2, usable ? color : PAL.armorShadow)
        .setAlpha(usable ? 1 : 0.4);
      // ui-skill / ui-skill-selected / ui-skill-rite .png, when present
      const skinKey = selected ? 'ui-skill-selected' : s.rite ? 'ui-skill-rite' : 'ui-skill';
      const skin = nine(this, skinKey, x, y, w, 120);
      if (skin) {
        box.setFillStyle(0x000000, 0.001).setStrokeStyle().setAlpha(1);
        skin.setAlpha(usable ? 1 : 0.4);
        this.skillButtons.push(skin);
      }
      const cd = actor.cooldowns?.[s.id] ?? 0;
      // skill-<id>.png (32 x 32) sits above the name when present
      const icon = addArt(this, `skill-${s.id}`, x, y - 30, 32);
      if (icon) {
        icon.setAlpha(usable ? 1 : 0.4);
        this.skillButtons.push(icon);
      }
      const label = this.add
        .text(x, icon ? y + 20 : y, s.rite ? `RITE\n${s.name}` : cd > 0 ? `${s.name}\n(ready in ${cd})` : s.name, {
          fontFamily: FONT,
          fontSize: icon ? '16px' : '18px',
          color: hex(selected && s.rite && !skin ? PAL.bg : PAL.ivory),
          align: 'center',
          wordWrap: { width: w - 12 },
        })
        .setOrigin(0.5)
        .setAlpha(usable ? 1 : 0.4);
      box.setInteractive({ useHandCursor: true }).on('pointerup', () => this.pickSkill(s, usable));
      this.skillButtons.push(box, label);
    });
    if (!this.chosen) this.descText.setText('Choose a skill');
  }

  private pickSkill(s: SkillDef, usable: boolean) {
    if (this.mode === 'busy') return;
    const actor = this.actor!;
    if (!usable) {
      const cd = actor.cooldowns?.[s.id] ?? 0;
      const why = cd > 0 ? `Cooling down: ready in ${cd} turn${cd > 1 ? 's' : ''}.` : s.rite && this.battle.zeal < ZEAL_MAX ? 'Needs a full Zeal meter.' : s.from.length ? `Usable from rank ${s.from.map((r) => ROMAN[r - 1]).join(', ')}.` : 'No target in reach.';
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

  private pickTarget(u: Unit) {
    if (this.mode !== 'target' || !this.chosen) return;
    const s = this.chosen;
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
    if (view.skill.zealDrain) text += ` It steals ${view.skill.zealDrain} Zeal.`;
    if (view.skill.pull) text += ' It drags its target to the front rank.';
    if (ENEMIES[u.ref].burst) text += ' When it dies, it bursts over all your Sisters.';
    if (u.armor >= 120) text += ' Its armor is thick: poison and burns ignore armor.';
    if (view.kind === 'attack' || view.kind === 'debuff') text += ' A Taunt pulls it away, and Shift can move out of its reach.';
    this.descText.setText(text);
  }

  private clearSkills() {
    this.skillButtons.forEach((o) => o.destroy());
    this.skillButtons = [];
    this.descText?.setText('');
  }

  // ---------- drawing ----------

  private makeCard(u: Unit) {
    const party = u.side === 'party';
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
    const hpText = this.add.text(0, CARD / 2 + 28, '', { fontFamily: FONT, fontSize: '17px', color: hex(PAL.ivory) }).setOrigin(0.5);
    const tags = this.add
      .text(0, CARD / 2 + 46, '', { fontFamily: FONT, fontSize: '15px', color: hex(PAL.violet), align: 'center' })
      .setOrigin(0.5);
    const y = party ? PARTY_Y : ENEMY_Y;
    const box = this.add.container(slotX(u.rank), y, [glow, frame, img, ...(skinFrame ? [skinFrame] : []), ...hp.parts, shieldFill, hpText, tags]);
    box.setSize(CARD, CARD).setInteractive({ useHandCursor: true });
    box.on('pointerup', () => (this.mode === 'target' ? this.pickTarget(u) : this.explain(u)));
    const preview = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '26px', color: hex(PAL.amber), stroke: '#000000', strokeThickness: 5, align: 'center' })
      .setOrigin(0.5);
    box.add(preview);
    // Enemies carry their own idle aura behind the portrait.
    if (!party) auraFx(this, box, CARD, fxForEnemy(u.ref), skinFrame ?? img);
    const card: Card = { box, frame, skinFrame, glow, img, hp, shieldFill, hpText, tags, preview };
    if (party) {
      card.threat = this.add
        .text(0, -CARD / 2 + 3, '', { fontFamily: FONT, fontSize: '18px', color: hex(PAL.ivory), backgroundColor: '#652b3b', padding: { x: 5, y: 2 } })
        .setOrigin(0.5, 0);
      box.add(card.threat);
    } else {
      // Intent sits above the card: what this enemy will do on its next turn.
      card.intentIcon = this.add.image(-CARD / 2 + 12, -CARD / 2 - 42, intentIconKey('attack')).setDisplaySize(24, 24);
      card.intentText = this.add
        .text(-CARD / 2 + 28, -CARD / 2 - 28, '', { fontFamily: FONT, fontSize: '17px', color: hex(PAL.ivory), lineSpacing: -2, wordWrap: { width: CARD - 26 } })
        .setOrigin(0, 1); // grows upward when a long name wraps
      box.add([card.intentIcon, card.intentText]);
    }
    if (u.hp <= 0) box.setAlpha(0);
    this.cards.set(u.uid, card);
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
      c.shieldFill.width = Math.min(CARD, (CARD * (u.status.shield ?? 0)) / u.maxHp);
      c.hpText.setText(`${u.hp}/${u.maxHp}`);
      const st = u.status;
      const tags = [
        st.poison && `${u.side === 'enemy' ? 'Afflicted' : 'Poisoned'} ${st.poison.turns}`,
        st.weaken && 'Weak',
        st.accused && 'Accused',
        st.taunt && 'Taunt',
        st.empower && 'Empowered',
        st.charging && 'Charging',
        u.side === 'enemy' && ENEMIES[u.ref].burst && 'Bursts',
      ].filter(Boolean);
      c.tags.setText(tags.join(' · '));
      const active = this.actor?.uid === u.uid && !dead;
      const edge = active ? PAL.ivory : u.side === 'party' ? RARITY_COLOR[CRUSADERS.find((x) => x.id === u.ref)!.rarity] : u.boss ? PAL.oxblood : PAL.armorShadow;
      if (c.skinFrame) c.skinFrame.setTint(edge);
      else c.frame.setStrokeStyle(active ? 5 : 3, edge);
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
    this.zealBar.set(b.zeal / ZEAL_MAX, b.zeal >= ZEAL_MAX ? PAL.amber : PAL.bronze);
    this.zealText.setText(b.zeal >= ZEAL_MAX ? 'ZEAL ABLAZE: a Rite is ready' : `Zeal ${b.zeal} / ${ZEAL_MAX}`);
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
        break;
      case 'damage': {
        const c = this.cards.get(e.uid);
        if (!c) break;
        const u = this.battle.get(e.uid);
        if (e.amount) popNumber(this, c.box.x, c.box.y - 20, `${e.crit ? 'CRIT ' : ''}-${e.amount}`, e.crit ? PAL.amber : 0xd65f5f, damageSize(e.amount, u.maxHp, e.crit));
        else this.float(c.box, e.blocked ? 'Blocked' : '0', PAL.ivory);
        if (e.blocked && e.amount) this.float(c.box, `(${e.blocked} blocked)`, PAL.ivory, 30);
        this.tweens.add({ targets: c.img, x: { from: -6, to: 6 }, duration: 40, yoyo: true, repeat: 2, onComplete: () => c.img.setX(0) });
        if (e.amount) {
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
        this.refresh();
        break;
      }
      case 'shield': {
        const c = this.cards.get(e.uid);
        if (c) this.float(c.box, `Shield ${e.amount}`, PAL.ivory);
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

  private lunge(u: Unit) {
    const c = this.cards.get(u.uid);
    if (!c) return;
    const dy = u.side === 'party' ? -18 : 18;
    this.tweens.add({ targets: c.box, y: c.box.y + dy, duration: 110, yoyo: true });
  }
}
