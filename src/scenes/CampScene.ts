import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { CRUSADERS } from '../data/crusaders';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import { MORALE_MAX, REACT, TOPICS, makeCamp, moraleBuff, moraleOf, reactions, topicsOf, type Talk } from '../systems/campfire';
import { makeButton } from '../ui/button';
import { portraitKey } from '../ui/placeholderPortrait';
import { PAD, addBackdrop, addHeading, addScreenGlow, shrinkToFit, text } from '../ui/theme';

const topicName = (id: string) => TOPICS.find((t) => t.id === id)!.name;
const REACT_MARK = { love: '♥', neutral: '·', loathe: '✗' } as const;
const REACT_COLOR = { love: 0xf2d27a, neutral: 0x9a93a3, loathe: 0xff6a5a } as const;

/**
 * The Campfire before a descent: tap a Sister to speak, pick one of the two
 * topics she loves; the others react. Two talks, then march on with the Morale.
 */
export class CampScene extends Phaser.Scene {
  private talks: Talk[] = [];
  private speaker?: string;

  constructor() {
    super('Camp');
  }

  init() {
    this.talks = [];
    this.speaker = undefined;
  }

  create() {
    const run = current.run;
    if (!run) {
      this.scene.start('Crusade');
      return;
    }
    this.draw();
  }

  private draw() {
    this.children.removeAll(true);
    this.tweens.killAll();
    const run = current.run!;
    const party = run.party;
    if (this.textures.exists('event-pilgrim-camp')) addBackdrop(this, 'event-pilgrim-camp', GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, { alpha: 0.5, fade: 0.55, fadeColor: 0x0e0d11 });
    addScreenGlow(this);
    addHeading(this, 'The Campfire', 30, 'Two Sisters speak. Morale steels the whole descent.');

    // The fire, in the middle.
    const fx = GAME_W / 2;
    const fy = 400;
    const glow = this.add.circle(fx, fy, 70, 0xff8a3a, 0.18);
    this.tweens.add({ targets: glow, scale: 1.12, alpha: 0.28, duration: 520, yoyo: true, repeat: -1 });
    if (this.textures.exists('ui-flame')) {
      const f = this.add.image(fx, fy - 6, 'ui-flame').setDisplaySize(64, 64);
      this.tweens.add({ targets: f, scaleY: f.scaleY * 1.08, duration: 300, yoyo: true, repeat: -1 });
    } else this.add.text(fx, fy, '🔥', { fontSize: '48px' }).setOrigin(0.5);

    // The Sisters round it.
    const spots = [
      [fx - 160, fy - 150],
      [fx + 160, fy - 150],
      [fx - 160, fy + 110],
      [fx + 160, fy + 110],
    ];
    const last = this.talks[this.talks.length - 1];
    const reacted = last ? new Map(reactions(party, last).map((r) => [r.id, r.reaction])) : new Map();
    party.forEach((id, i) => {
      const [x, y] = spots[i];
      const c = CRUSADERS.find((s) => s.id === id)!;
      const spoke = this.talks.some((t) => t.speaker === id);
      const picked = this.speaker === id;
      const can = !spoke && this.talks.length < 2;
      const frame = this.add.rectangle(x, y, 104, 104, 0x110b13).setStrokeStyle(picked ? 3 : 2, picked ? 0xf2d27a : spoke ? PAL.steel : PAL.bronze);
      this.add.image(x, y, portraitKey(id)).setDisplaySize(100, 100).setAlpha(spoke ? 0.55 : 1);
      shrinkToFit(this.add.text(x, y + 62, c.name.split(' ')[0].toUpperCase(), text.hud(13, picked ? 0xf2d27a : 0xfff1d6)).setOrigin(0.5), 96, 8);
      const t = topicsOf(id);
      this.add.text(x, y + 82, `♥ ${topicName(t.loves[0])}, ${topicName(t.loves[1])}`, { ...text.body(13, PAL.muted), align: 'center', wordWrap: { width: 200 } }).setOrigin(0.5, 0);
      this.add.text(x, y + 118, `✗ ${topicName(t.loathes)}`, text.body(13, 0xd07a70)).setOrigin(0.5, 0);
      const r = reacted.get(id);
      if (r) {
        const m = this.add.text(x + 40, y - 52, `${REACT_MARK[r as keyof typeof REACT_MARK]} ${REACT[r as keyof typeof REACT] > 0 ? '+' : ''}${REACT[r as keyof typeof REACT]}`, { ...text.hud(16, REACT_COLOR[r as keyof typeof REACT_COLOR]), stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5);
        this.tweens.add({ targets: m, y: m.y - 10, duration: 400, ease: 'Back.out' });
      }
      if (can) frame.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        this.speaker = id;
        this.draw();
      });
    });

    // Morale.
    const morale = moraleOf(party, this.talks);
    const buff = moraleBuff(morale);
    const my = 660;
    const bw = GAME_W - PAD * 2;
    this.add.text(PAD, my, `MORALE ${morale} / ${MORALE_MAX}`, text.hud(15, PAL.amber));
    this.add.text(GAME_W - PAD, my, buff.atkPct ? `${buff.name.toUpperCase()}: ATK +${Math.round(buff.atkPct * 100)}%, +${buff.zeal} ZEAL` : '50 FOR A BLESSING', text.hud(12, buff.atkPct ? 0xf2d27a : PAL.steel)).setOrigin(1, 0);
    this.add.rectangle(PAD, my + 32, bw, 12, 0x000000).setOrigin(0, 0.5);
    this.add.rectangle(PAD, my + 32, (bw * morale) / MORALE_MAX, 8, 0xff9a4a).setOrigin(0, 0.5);
    for (const at of [50, 70, 90]) this.add.rectangle(PAD + (bw * at) / MORALE_MAX, my + 32, 2, 16, 0xfff1d6, 0.7);

    // What is said, or what to do next.
    const ly = my + 60;
    if (last) {
      const c = CRUSADERS.find((s) => s.id === last.speaker)!;
      const topic = TOPICS.find((t) => t.id === last.topic)!;
      this.add.text(GAME_W / 2, ly, `${c.name.split(' ')[0]}, on ${topic.name}: "${topic.line}"`, { ...text.body(16, PAL.ivory), align: 'center', fontStyle: 'italic', wordWrap: { width: bw } }).setOrigin(0.5, 0);
    }
    const by = GAME_H - 150;
    if (this.speaker && this.talks.length < 2) {
      const t = topicsOf(this.speaker);
      const w = (bw - 12) / 2;
      t.loves.forEach((topic, i) => {
        makeButton(this, PAD + w / 2 + i * (w + 12), by, w, 60, topicName(topic), () => {
          this.talks.push({ speaker: this.speaker!, topic });
          this.speaker = undefined;
          this.draw();
        }, { active: true, fontSize: 17 });
      });
    } else if (this.talks.length < 2) {
      this.add.text(GAME_W / 2, by, this.talks.length ? 'Tap another Sister to speak.' : 'Tap a Sister to speak. The others react to her topic.', { ...text.body(17, PAL.amber), align: 'center', wordWrap: { width: bw } }).setOrigin(0.5);
    } else {
      makeButton(this, GAME_W / 2, by, bw, 64, 'Break camp and descend!', () => this.finish(), { active: true, icon: 'blade' });
    }
    makeButton(this, GAME_W / 2, GAME_H - 66, 260, 48, this.talks.length < 2 ? 'Skip the fire' : 'Talk again', () => {
      if (this.talks.length < 2) this.march();
      else {
        this.talks = [];
        this.draw();
      }
    }, { fontSize: 15 });
  }

  private finish() {
    makeCamp(game.save, current.run!, this.talks);
    commit();
    this.march();
  }

  private march() {
    this.scene.start('Crypt');
  }
}
