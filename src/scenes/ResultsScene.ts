import { sfx } from '../audio/sfx';
import Phaser from 'phaser';
import { bagEmpty, bagText, type Bag, type ItemId } from '../systems/items';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { ORDER_LIST } from '../data/orders';
import { game } from '../state/game';
import type { SaveData } from '../state/save';
import { HERESY_FIRST_CLEAR_SEALS, ROMAN, type RunResult } from '../systems/crusade';
import { expOf, expToNext } from '../systems/exp';
import { COST_TEN } from '../systems/gacha';
import { SLOT_NAME } from '../systems/gear';
import { codexGoal, leadOrder, nearGoals } from '../systems/goals';
import { rankFromXp, rankOf } from '../systems/rank';
import { makeButton } from '../ui/button';
import { recordBanner } from '../ui/juice';
import { beatenText } from '../systems/records';
import { portraitKey } from '../ui/placeholderPortrait';
import { holdForCard } from '../ui/sisterCard';

const TITLES = { victory: 'The crypt is purified!', defeat: 'The crusade is broken', retreat: 'You fall back to the Sanctum' };

/** One bar's journey: from (level, fraction) to (level, fraction). */
interface Track {
  label: string;
  from: [number, number];
  to: [number, number];
  /** Right-hand text once it lands. */
  value: string;
  color: number;
  /** Stamp shown when the bar wraps a level, e.g. "RANK UP". */
  up?: string;
}

export class ResultsScene extends Phaser.Scene {
  private result!: RunResult;
  private at = 0;

  constructor() {
    super('Results');
  }

  init(data: { result: RunResult }) {
    this.result = data.result;
    this.at = 0;
  }

  create() {
    const r = this.result;
    const save = game.save;
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.cameras.main.setBackgroundColor(PAL.bg);
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    this.add
      .text(GAME_W / 2, 70, TITLES[r.outcome], { ...style, fontSize: '30px', color: hex(r.outcome === 'defeat' ? PAL.oxblood : PAL.amber) })
      .setOrigin(0.5);

    // Tithes and Seals count up.
    this.counter(GAME_W / 2 - 120, 140, r.tithes, 'Tithes', PAL.ivory);
    this.counter(GAME_W / 2 + 120, 140, r.seals, 'Wax Seals', PAL.amber);
    this.wait(1000);

    // Gear lands one card at a time, in its rarity colour.
    this.gear(282);
    const mats: string[] = [];
    if (!bagEmpty(r.items)) mats.push(bagText(r.items));
    if (r.gilt) mats.push(`+${r.gilt} Gilt`);
    let matsBottom = 354;
    if (mats.length) {
      const m = this.add.text(GAME_W / 2, 354, mats.join('   '), { ...style, fontSize: '16px', color: hex(PAL.muted), align: 'center', wordWrap: { width: GAME_W - 50 } }).setOrigin(0.5, 0);
      matsBottom = 354 + m.height;
      this.reveal(m);
    }

    // Bars toward what this run moved (pushed down when the materials run long).
    let y = Math.max(418, matsBottom + 48);
    this.reveal(this.add.text(GAME_W / 2, y - 26, 'Spoils of this crusade', { ...style, fontSize: '18px', color: hex(PAL.steel) }).setOrigin(0.5));
    for (const t of this.tracks(save)) {
      this.bar(26, y + 10, GAME_W - 52, t);
      y += 50;
    }
    const sistersEnd = this.sisters(y + 4);

    // Notes, then the nearest real goal beside March again.
    const notes: string[] = [];
    if (r.pilgrimage) notes.push(`Pilgrimage blessing: +${r.pilgrimage.seals} Seals, +${r.pilgrimage.tithes} Tithes. ${r.pilgrimage.left} blessed clear${r.pilgrimage.left === 1 ? '' : 's'} left today.`);
    if (r.melted) notes.push(`Armory full: spare gear melted for +${r.melted} Tithes.`);
    if (r.firstClear) notes.push('First clear! Heresy I is open.');
    if (r.heresyCleared) notes.push(`Heresy ${ROMAN[r.heresyCleared - 1]} cleared: +${HERESY_FIRST_CLEAR_SEALS} Seals. Heresy ${ROMAN[r.heresyCleared]} is open.`);
    if (r.outcome === 'defeat') notes.push('You keep Seals, gear, Sanctuary banks and most of the rest.');
    if (r.outcome === 'retreat') notes.push('You keep your spoils. Purify the crypt for its full reward.');
    if (r.fallen.length) notes.push('The fallen sit out one crusade, or pay Tithes to absolve them.');
    let notesEnd = 738;
    if (notes.length) {
      const n = this.add.text(GAME_W / 2, Math.max(738, sistersEnd + 8), notes.join('\n'), { ...style, fontSize: '15px', color: hex(PAL.steel), align: 'center', wordWrap: { width: GAME_W - 50 }, lineSpacing: 2 }).setOrigin(0.5, 0);
      notesEnd = n.y + n.height;
      this.reveal(n);
    }

    const goal = nearGoals(save, r.party)[0];
    if (goal) {
      const line = this.add
        .text(GAME_W / 2, Math.max(830, notesEnd + 22), `Next: ${goal.text}  ›`, { ...style, fontSize: '19px', color: hex(PAL.amber), wordWrap: { width: GAME_W - 40 } })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      line.on('pointerup', () => this.scene.start(goal.scene, goal.data));
      this.reveal(line);
    }

    makeButton(this, GAME_W / 2 - 128, GAME_H - 56, 236, 76, 'Sanctum', () => this.scene.start('Sanctum'));
    makeButton(this, GAME_W / 2 + 128, GAME_H - 56, 236, 76, 'March again!', () => this.scene.start('Crusade'), { active: true });

    if (r.record) {
      const rec = r.record;
      this.time.delayedCall(this.at + 300, () => recordBanner(this, beatenText(rec), 470));
    }

    // Tap anywhere to hurry the ceremony along.
    this.input.on('pointerdown', () => {
      this.time.timeScale = 6;
      this.tweens.timeScale = 6;
    });
  }

  /** Moves the reveal clock on. */
  private wait(ms: number) {
    this.at += ms;
  }

  private reveal(obj: Phaser.GameObjects.Text | Phaser.GameObjects.Container, ms = 200) {
    obj.setAlpha(0);
    this.tweens.add({ targets: obj, alpha: 1, delay: this.at, duration: ms });
  }

  private counter(x: number, y: number, n: number, label: string, color: number) {
    const t = this.add.text(x, y, '+0', { fontFamily: FONT, fontSize: '40px', color: hex(color), stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5);
    this.add.text(x, y + 38, label, { fontFamily: FONT, fontSize: '17px', color: hex(PAL.steel) }).setOrigin(0.5);
    const v = { n: 0 };
    this.tweens.add({
      targets: v,
      n,
      delay: 250,
      duration: Math.min(1100, 300 + n * 2),
      ease: 'Cubic.out',
      onUpdate: () => t.setText(`+${Math.round(v.n)}`),
      onComplete: () => {
        t.setText(`+${n}`);
        if (n) this.tweens.add({ targets: t, scale: 1.18, duration: 90, yoyo: true });
      },
    });
  }

  private gear(y: number) {
    const items = this.result.gear;
    if (!items.length) {
      this.reveal(this.add.text(GAME_W / 2, y, 'The dead gave no gear', { fontFamily: FONT, fontSize: '17px', color: hex(PAL.steel) }).setOrigin(0.5));
      this.wait(200);
      return;
    }
    const shown = items.slice(0, 5);
    const w = 92;
    shown.forEach((g, i) => {
      const x = GAME_W / 2 + (i - (shown.length - 1) / 2) * (w + 8);
      const col = RARITY_COLOR[g.rarity];
      const card = this.add.container(x, y, [
        this.add.rectangle(0, 0, w, 112, 0x1a1218).setStrokeStyle(3, col),
        this.add.rectangle(0, -40, w - 6, 26, col, 0.25),
        this.add.text(0, -40, g.rarity, { fontFamily: FONT, fontSize: '18px', color: hex(col) }).setOrigin(0.5),
        this.add.text(0, -8, SLOT_NAME[g.slot], { fontFamily: FONT, fontSize: '15px', color: hex(PAL.steel) }).setOrigin(0.5),
        this.add.text(0, 24, g.name, { fontFamily: FONT, fontSize: '14px', color: hex(PAL.ivory), align: 'center', wordWrap: { width: w - 8 } }).setOrigin(0.5),
      ]);
      card.setAlpha(0).setScale(1.4).setY(y - 30);
      this.tweens.add({ targets: card, alpha: 1, scale: 1, y, delay: this.at, duration: 220, ease: 'Back.out' });
      if (g.rarity === 'SSR' || g.rarity === 'UR') {
        const glow = this.add.rectangle(x, y, w + 10, 122).setStrokeStyle(4, col).setAlpha(0);
        this.tweens.add({ targets: glow, alpha: { from: 0.9, to: 0 }, scale: 1.15, delay: this.at + 200, duration: 600 });
      }
      this.wait(260);
    });
    if (items.length > shown.length) {
      this.reveal(this.add.text(GAME_W - 20, y + 66, `+${items.length - shown.length} more`, { fontFamily: FONT, fontSize: '15px', color: hex(PAL.steel) }).setOrigin(1, 0.5));
    }
  }

  /** Rank of Faith, the next 10-pull and the party's Order Codex. */
  private tracks(save: SaveData): Track[] {
    const r = this.result;
    const out: Track[] = [];
    const now = rankOf(save).xp;
    const was = r.start?.faith ?? now;
    const a = rankFromXp(was);
    const b = rankFromXp(now);
    out.push({
      label: `Rank of Faith ${b.rank}`,
      from: [a.rank, a.need ? a.into / a.need : 1],
      to: [b.rank, b.need ? b.into / b.need : 1],
      value: b.need ? `${b.into}/${b.need}` : 'Max',
      color: PAL.amber,
      up: 'RANK UP',
    });
    const before = save.seals - r.seals;
    const ready = Math.floor(save.seals / COST_TEN);
    out.push({
      label: 'Next 10-pull',
      from: [0, Math.min(1, before / COST_TEN)],
      to: [0, Math.min(1, save.seals / COST_TEN)],
      value: ready ? `${ready} ready` : `${save.seals}/${COST_TEN} Seals`,
      color: 0xc9a24a,
    });
    const order = leadOrder(r.party);
    const g = order && codexGoal(save, order);
    if (order && g) {
      const old = codexGoal(withoutRun(save, r), order);
      const name = ORDER_LIST.find((o) => o.id === order)?.name ?? order;
      out.push({ label: `${name} Codex`, from: [0, old?.frac ?? 0], to: [0, g.frac], value: g.frac >= 1 ? 'Ready' : `${Math.round(g.frac * 100)}%`, color: 0x8a7fb0 });
    }
    return out;
  }

  /** A labelled bar that fills from where the run began to where it ended, stamping each wrap. */
  private bar(x: number, y: number, w: number, t: Track, h = 12) {
    const label = this.add.text(x, y - 16, t.label, { fontFamily: FONT, fontSize: '17px', color: hex(PAL.ivory) }).setOrigin(0, 0.5);
    const value = this.add.text(x + w, y - 16, t.value, { fontFamily: FONT, fontSize: '16px', color: hex(PAL.steel) }).setOrigin(1, 0.5);
    const track = this.add.rectangle(x, y, w, h, 0x1b151e).setOrigin(0, 0.5).setStrokeStyle(1, 0x3a2e38);
    // A faint mark where the bar stood before the run (only when no level was crossed).
    const ghost = this.add.rectangle(x, y, t.to[0] > t.from[0] ? 0 : w * t.from[1], h, t.color, 0.35).setOrigin(0, 0.5);
    const fill = this.add.rectangle(x, y, w * t.from[1], h, t.color).setOrigin(0, 0.5);
    const parts = [label, value, track, ghost, fill];
    parts.forEach((o) => o.setAlpha(0));
    this.tweens.add({ targets: parts, alpha: 1, delay: this.at, duration: 150 });
    const wraps = Math.max(0, t.to[0] - t.from[0]);
    const step = (left: number) => {
      if (left > 0) {
        this.tweens.add({
          targets: fill,
          width: w,
          duration: 380,
          ease: 'Quad.in',
          onComplete: () => {
            if (t.up) this.stamp(x + w / 2, y - 16, t.up, t.color);
            fill.width = 0;
            step(left - 1);
          },
        });
      } else this.tweens.add({ targets: fill, width: w * Math.max(0, t.to[1]), duration: 420, ease: 'Quad.out' });
    };
    this.time.delayedCall(this.at, () => step(wraps));
    this.wait(260 + wraps * 380);
  }

  private stamp(x: number, y: number, text: string, color: number) {
    if (text === 'RANK UP') sfx('rankUp');
    const s = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: '22px', color: hex(color), stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setScale(1.8)
      .setAlpha(0)
      .setDepth(5);
    this.tweens.add({ targets: s, scale: 1, alpha: 1, duration: 160, ease: 'Back.out' });
    this.tweens.add({ targets: s, alpha: 0, y: y - 18, delay: 700, duration: 300, onComplete: () => s.destroy() });
  }

  /** Each Sister's level bar, two to a row; the fallen are greyed. */
  /** Each Sister's EXP bar; returns where the rows end. */
  private sisters(y0: number): number {
    const r = this.result;
    const save = game.save;
    const colW = (GAME_W - 52) / 2;
    r.party.forEach((id, i) => {
      const o = save.owned[id];
      if (!o) return;
      const x = 26 + (i % 2) * (colW + 0);
      const y = y0 + Math.floor(i / 2) * 64;
      const fallen = r.fallen.includes(id);
      const img = this.add.image(x + 24, y + 22, portraitKey(id)).setDisplaySize(46, 46);
      if (fallen) img.setTint(0x555555);
      holdForCard(this, img, id);
      const name = CRUSADERS.find((c) => c.id === id)!.name.split(' ')[0];
      const was = r.start?.exp[id] ?? { level: o.level, exp: expOf(o) };
      this.bar(x + 56, y + 34, colW - 66, {
        label: `${name}${fallen ? ' (mending)' : ''}`,
        from: [was.level, Math.min(1, was.exp / expToNext(was.level))],
        to: [o.level, Math.min(1, expOf(o) / expToNext(o.level))],
        value: `Lv ${o.level}`,
        color: fallen ? 0x6a6a6a : 0x7fc4a0,
        up: 'LEVEL UP',
      }, 8);
      img.setAlpha(0);
      this.tweens.add({ targets: img, alpha: 1, delay: this.at - 260, duration: 150 });
    });
    return y0 + Math.ceil(r.party.length / 2) * 64 - 10;
  }
}

/** The save as it stood before this run's spoils were added. */
function withoutRun(save: SaveData, r: RunResult): SaveData {
  const items: Bag = { ...(save.items ?? {}) };
  for (const [id, n] of Object.entries(r.items) as [ItemId, number][]) items[id] = Math.max(0, (items[id] ?? 0) - n);
  return { ...save, tithes: save.tithes - r.tithes - r.melted, seals: save.seals - r.seals, items };
}
