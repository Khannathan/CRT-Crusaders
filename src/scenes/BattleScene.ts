import Phaser from 'phaser';
import { FONT, GAME_W, PAL, hex } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import type { SkillDef } from '../data/skills';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import { Battle, ZEAL_MAX, skillsFor, type BattleEvent, type Unit } from '../systems/combat';
import { absorbBattle, currentRoom, finishRun, makeBattle, winRoom } from '../systems/crusade';
import { enemyKey } from '../ui/enemyArt';
import { portraitKey } from '../ui/placeholderPortrait';

const CARD = 128;
const ENEMY_Y = 250;
const PARTY_Y = 600;
const ROMAN = ['I', 'II', 'III', 'IV'];
const slotX = (rank: number) => 8 + CARD / 2 + (rank - 1) * (CARD + 4);

interface Card {
  box: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Rectangle;
  img: Phaser.GameObjects.Image;
  hpFill: Phaser.GameObjects.Rectangle;
  shieldFill: Phaser.GameObjects.Rectangle;
  hpText: Phaser.GameObjects.Text;
  tags: Phaser.GameObjects.Text;
}

type Mode = 'busy' | 'skill' | 'target';

/** One fight: enemies on top, your party below, skills along the bottom. */
export class BattleScene extends Phaser.Scene {
  private battle!: Battle;
  private cards = new Map<string, Card>();
  private actor?: Unit;
  private mode: Mode = 'busy';
  private chosen?: SkillDef;
  private skillButtons: Phaser.GameObjects.GameObject[] = [];
  private logText!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private zealFill!: Phaser.GameObjects.Rectangle;
  private zealText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private candle!: Phaser.GameObjects.Graphics;
  private strip: Phaser.GameObjects.GameObject[] = [];
  private vigilMax = 8;

  constructor() {
    super('Battle');
  }

  create() {
    const run = current.run;
    const room = run && currentRoom(run);
    if (!run || !room || room.kind === 'choice' && !run.sideFight) {
      this.scene.start('Crypt');
      return;
    }
    const encounter = room.kind === 'choice' ? 'ossuary-side' : room.encounter;
    this.battle = makeBattle(game.save, run, encounter);
    this.vigilMax = this.battle.vigil;
    this.cards.clear();
    this.mode = 'busy';
    this.chosen = undefined;
    this.skillButtons = [];
    this.strip = [];

    this.cameras.main.setBackgroundColor(0x0e0d11);
    const style = { fontFamily: FONT, color: hex(PAL.ivory) };
    this.roundText = this.add.text(16, 24, '', { ...style, fontSize: '18px', color: hex(PAL.steel) }).setOrigin(0, 0.5);
    this.candle = this.add.graphics();
    this.add.text(GAME_W - 52, 24, 'Vigil', { ...style, fontSize: '14px', color: hex(PAL.steel) }).setOrigin(1, 0.5);

    for (let i = 0; i < 4; i++) {
      this.add.text(slotX(i + 1), ENEMY_Y - 84, ROMAN[i], { ...style, fontSize: '14px', color: hex(PAL.armorShadow) }).setOrigin(0.5);
      this.add.text(slotX(i + 1), PARTY_Y - 84, ROMAN[i], { ...style, fontSize: '14px', color: hex(PAL.armorShadow) }).setOrigin(0.5);
    }

    this.logText = this.add
      .text(GAME_W / 2, 405, '', { ...style, fontSize: '18px', align: 'center', wordWrap: { width: GAME_W - 40 } })
      .setOrigin(0.5);
    this.add.rectangle(GAME_W / 2, 455, 404, 18, PAL.deepShadow).setStrokeStyle(2, PAL.armorShadow);
    this.zealFill = this.add.rectangle(GAME_W / 2 - 200, 455, 0, 14, PAL.amber).setOrigin(0, 0.5);
    this.zealText = this.add.text(GAME_W / 2, 478, '', { ...style, fontSize: '13px', color: hex(PAL.steel) }).setOrigin(0.5);

    this.descText = this.add
      .text(GAME_W / 2, 760, '', { ...style, fontSize: '16px', align: 'center', color: hex(PAL.steel), wordWrap: { width: GAME_W - 40 } })
      .setOrigin(0.5);

    for (const u of this.battle.units) this.makeCard(u);
    this.refresh();
    this.logText.setText('The dark stirs...');
    this.time.delayedCall(600, () => this.step());
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
        this.showSkills();
      }
    });
  }

  private perform(skill: SkillDef, target?: Unit) {
    const actor = this.actor!;
    this.mode = 'busy';
    this.clearSkills();
    this.lunge(actor);
    const events = this.battle.act(actor, skill, target);
    this.play(events, () => this.step());
  }

  private end(outcome: 'victory' | 'defeat') {
    const run = current.run!;
    absorbBattle(run, this.battle);
    this.mode = 'busy';
    this.clearSkills();
    this.logText.setText(outcome === 'victory' ? 'Victory.' : 'Your party has fallen.');
    this.time.delayedCall(1200, () => {
      if (outcome === 'victory') {
        winRoom(run);
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

  private showSkills() {
    this.clearSkills();
    const actor = this.actor!;
    const skills = skillsFor(actor);
    // order: skill 1, skill 2, Shift, Rite
    const order = [skills[0], skills[1], skills[3], skills[2]];
    const w = 128;
    order.forEach((s, i) => {
      const x = 8 + w / 2 + i * (w + 4);
      const y = 862;
      const usable = this.battle.canUse(actor, s);
      const selected = this.chosen === s;
      const color = s.rite ? PAL.amber : PAL.oxblood;
      const box = this.add
        .rectangle(x, y, w, 120, selected ? color : PAL.deepShadow)
        .setStrokeStyle(2, usable ? color : PAL.armorShadow)
        .setAlpha(usable ? 1 : 0.4);
      const label = this.add
        .text(x, y, s.rite ? `RITE\n${s.name}` : s.name, {
          fontFamily: FONT,
          fontSize: '17px',
          color: hex(selected ? PAL.bg : PAL.ivory),
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
      const why = s.rite && this.battle.zeal < ZEAL_MAX ? 'Needs a full Zeal meter.' : s.from.length ? `Usable from rank ${s.from.map((r) => ROMAN[r - 1]).join(', ')}.` : 'No target in reach.';
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
    const hpBg = this.add.rectangle(-CARD / 2, CARD / 2 + 12, CARD, 10, PAL.deepShadow).setOrigin(0, 0.5);
    const hpFill = this.add.rectangle(-CARD / 2, CARD / 2 + 12, CARD, 10, party ? 0x7a9a5a : PAL.oxblood).setOrigin(0, 0.5);
    const shieldFill = this.add.rectangle(-CARD / 2, CARD / 2 + 12, 0, 4, PAL.ivory).setOrigin(0, 0.5);
    const hpText = this.add.text(0, CARD / 2 + 28, '', { fontFamily: FONT, fontSize: '14px', color: hex(PAL.ivory) }).setOrigin(0.5);
    const tags = this.add
      .text(0, CARD / 2 + 46, '', { fontFamily: FONT, fontSize: '12px', color: hex(PAL.violet), align: 'center' })
      .setOrigin(0.5);
    const y = party ? PARTY_Y : ENEMY_Y;
    const box = this.add.container(slotX(u.rank), y, [glow, frame, img, hpBg, hpFill, shieldFill, hpText, tags]);
    box.setSize(CARD, CARD).setInteractive({ useHandCursor: true });
    box.on('pointerup', () => this.pickTarget(u));
    this.cards.set(u.uid, { box, frame, glow, img, hpFill, shieldFill, hpText, tags });
  }

  /** Redraws every card, the turn strip, Zeal and the candle. */
  private refresh(highlight: Unit[] = []) {
    for (const u of this.battle.units) {
      const c = this.cards.get(u.uid) ?? (this.makeCard(u), this.cards.get(u.uid)!);
      const dead = u.hp <= 0;
      c.box.setAlpha(dead ? 0 : 1);
      if (dead) c.box.disableInteractive();
      const tx = slotX(u.rank);
      if (!dead && c.box.x !== tx) this.tweens.add({ targets: c.box, x: tx, duration: 250 });
      c.hpFill.width = (CARD * u.hp) / u.maxHp;
      c.shieldFill.width = Math.min(CARD, (CARD * (u.status.shield ?? 0)) / u.maxHp);
      c.hpText.setText(`${u.hp}/${u.maxHp}`);
      const st = u.status;
      const tags = [
        st.poison && `${u.side === 'enemy' ? 'Afflicted' : 'Poisoned'} ${st.poison.turns}`,
        st.weaken && 'Weak',
        st.accused && 'Accused',
        st.taunt && 'Taunt',
        st.empower && 'Empowered',
      ].filter(Boolean);
      c.tags.setText(tags.join(' · '));
      const active = this.actor?.uid === u.uid && !dead;
      c.frame.setStrokeStyle(active ? 5 : 3, active ? PAL.ivory : u.side === 'party' ? RARITY_COLOR[CRUSADERS.find((x) => x.id === u.ref)!.rarity] : u.boss ? PAL.oxblood : PAL.armorShadow);
      c.glow.setVisible(highlight.includes(u));
      if (highlight.includes(u)) {
        this.tweens.killTweensOf(c.glow);
        c.glow.setAlpha(1);
        this.tweens.add({ targets: c.glow, alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });
      }
    }

    const b = this.battle;
    this.zealFill.width = (400 * b.zeal) / ZEAL_MAX;
    this.zealFill.setFillStyle(b.zeal >= ZEAL_MAX ? PAL.amber : PAL.bronze);
    this.zealText.setText(b.zeal >= ZEAL_MAX ? 'ZEAL FULL: a Rite is ready' : `Zeal ${b.zeal} / ${ZEAL_MAX}`);
    this.roundText.setText(`Round ${Math.max(1, b.round)}`);

    // Vigil candle: shrinks each round; once out, enemies grow stronger
    const g = this.candle.clear();
    const h = 34;
    const left = Math.max(0, b.vigil) / this.vigilMax;
    g.fillStyle(PAL.deepShadow).fillRect(GAME_W - 40, 8, 14, h);
    g.fillStyle(PAL.ivory).fillRect(GAME_W - 40, 8 + h * (1 - left), 14, h * left);
    if (b.vigil > 0) g.fillStyle(PAL.amber).fillTriangle(GAME_W - 33, 8 + h * (1 - left) - 12, GAME_W - 38, 8 + h * (1 - left) - 2, GAME_W - 28, 8 + h * (1 - left) - 2);
    else g.fillStyle(PAL.oxblood).fillRect(GAME_W - 46, 46, 26, 4);

    // Turn strip: who acts now and next
    this.strip.forEach((o) => o.destroy());
    this.strip = [];
    const order = [this.actor, ...b.upcoming()].filter((u): u is Unit => !!u && u.hp > 0).slice(0, 7);
    this.strip.push(this.add.text(16, 70, 'Turn', { fontFamily: FONT, fontSize: '13px', color: hex(PAL.steel) }).setOrigin(0, 0.5));
    order.forEach((u, i) => {
      const x = 80 + i * 60;
      const key = u.side === 'party' ? portraitKey(u.ref) : enemyKey(u.ref);
      const fr = this.add.rectangle(x, 70, 54, 54, 0x000000).setStrokeStyle(i === 0 ? 3 : 1, u.side === 'party' ? PAL.bronze : PAL.oxblood);
      const im = this.add.image(x, 70, key).setDisplaySize(48, 48).setAlpha(i === 0 ? 1 : 0.75);
      this.strip.push(fr, im);
    });
  }

  /** Plays battle events one after another, then calls done. */
  private play(events: BattleEvent[], done: () => void) {
    let delay = 0;
    for (const e of events) {
      this.time.delayedCall(delay, () => this.show(e));
      delay += e.type === 'text' ? 250 : e.type === 'zeal' || e.type === 'move' ? 0 : 220;
    }
    this.time.delayedCall(delay + 250, () => {
      this.refresh();
      done();
    });
  }

  private show(e: BattleEvent) {
    switch (e.type) {
      case 'text':
        this.logText.setText(e.text);
        break;
      case 'damage': {
        const c = this.cards.get(e.uid);
        if (!c) break;
        this.float(c.box, e.amount ? `-${e.amount}` : e.blocked ? 'Blocked' : '0', e.amount ? 0xd65f5f : PAL.ivory);
        if (e.blocked && e.amount) this.float(c.box, `(${e.blocked} blocked)`, PAL.ivory, 22);
        this.tweens.add({ targets: c.img, x: { from: -6, to: 6 }, duration: 40, yoyo: true, repeat: 2, onComplete: () => c.img.setX(0) });
        c.img.setTint(0xff6666);
        this.time.delayedCall(160, () => c.img.clearTint());
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
        if (c) this.tweens.add({ targets: c.box, alpha: 0, scale: 0.85, duration: 400 });
        break;
      }
      case 'summon': {
        const u = this.battle.get(e.uid);
        this.makeCard(u);
        this.logText.setText(`${u.name} rises from the water.`);
        this.refresh();
        break;
      }
      case 'move':
      case 'zeal':
        this.refresh();
        break;
    }
  }

  private float(target: Phaser.GameObjects.Container, text: string, color: number, offset = 0) {
    const t = this.add
      .text(target.x, target.y - 20 + offset, text, { fontFamily: FONT, fontSize: '22px', color: hex(color), stroke: '#000000', strokeThickness: 4 })
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
