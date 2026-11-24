import { sfx } from '../audio/sfx';
import { rankTitle } from '../data/crusaders';
import Phaser from 'phaser';
import { NOVICE_COST, noviceTensLeft } from '../systems/novitiate';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { CLASSES, RARITY_COLOR } from '../data/classes';
import { COST_ONE, RARITY_ORDER, canPull, tenLabel, noviceTen, pull, type PullKind, type PullResult } from '../systems/gacha';
import { music } from '../audio/music';
import { commit, game } from '../state/game';
import { makeButton } from '../ui/button';
import { NOISE_FRAMES, WAX_COLOR, noiseKey, sealKey } from '../ui/effects';
import { addSplash, portraitKey, queueSplash, splashKey } from '../ui/placeholderPortrait';
import { FIGURE_H, FIGURE_W, SisterSprite, fullKey } from '../ui/sisterSprite';
import { holdForCard } from '../ui/sisterCard';
import { fitLine } from '../ui/theme';
import { settleTaps } from '../ui/modeScreen';

const CY = 400;
const SIZE = 256;

const COLS = 5;
const CELL_W = 100;
const CELL_H = 150;
const GRID_Y = 230;
const cellX = (i: number) => (GAME_W - COLS * CELL_W) / 2 + CELL_W / 2 + (i % COLS) * CELL_W;
const cellY = (i: number) => GRID_Y + Math.floor(i / COLS) * CELL_H;
const rankOf = (r: PullResult) => RARITY_ORDER.indexOf(r.crusader.rarity);

/**
 * A single pull: tap the seal, it breaks, the portrait rises out of static.
 * A 10-pull: all ten seals are laid out first (each in its true rarity's wax),
 * then broken in order; an SSR or UR also gets the full rise.
 */
export class RevealScene extends Phaser.Scene {
  private results: PullResult[] = [];
  private index = 0;
  /** Opened from the Novitiate: its own Again and Back. */
  private novice = false;
  private busy = false;
  private card?: Phaser.GameObjects.Container;
  private hint!: Phaser.GameObjects.Text;
  private counter!: Phaser.GameObjects.Text;
  /** Highest card index whose seal has been broken. */
  private revealed = -1;
  /** 10-pull: the seals laid out on the table, by index. */
  private seals: (Phaser.GameObjects.Image | undefined)[] = [];
  /** 10-pull: an SSR or UR is shown full size over the table. */
  private focus?: Phaser.GameObjects.Container;
  private skipBest?: ReturnType<typeof makeButton>;

  constructor() {
    super('Reveal');
  }

  init(data: { results: PullResult[]; novice?: boolean }) {
    this.results = data.results ?? [];
    this.novice = !!data.novice;
    this.index = 0;
    this.busy = false;
    this.card = undefined;
    this.revealed = -1;
    this.seals = [];
    this.focus = undefined;
    if (this.results.some((r) => r.crusader.rarity === 'UR')) music.preload('ur');
  }

  preload() {
    // Splash art for everyone in this pull, ready for the reveal.
    for (const r of this.results) queueSplash(this, r.crusader.id);
  }

  create() {
    settleTaps(this);
    sfx('pull');
    this.cameras.main.setBackgroundColor(0x0a090c);
    this.counter = this.add.text(24, 28, '', { fontFamily: FONT, fontSize: '18px', color: hex(PAL.steel) }).setOrigin(0, 0.5);
    this.hint = this.add
      .text(GAME_W / 2, GAME_H - 140, '', { fontFamily: FONT, fontSize: '20px', color: hex(PAL.steel) })
      .setOrigin(0.5)
      .setDepth(25);
    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length || this.busy) return; // buttons handle their own taps
      this.advance();
    });
    if (this.results.length > 1) this.layTable();
    else this.showSeal();
  }

  // ---------- 10-pull: the table of seals ----------

  private layTable() {
    this.add.text(GAME_W / 2, 100, 'Ten oaths, sealed in wax', { fontFamily: FONT, fontSize: '26px', color: hex(PAL.amber) }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 134, 'Each seal burns the colour of the soul within.', { fontFamily: FONT, fontSize: '16px', color: hex(PAL.steel) }).setOrigin(0.5);
    this.busy = true;
    this.results.forEach((r, i) => {
      const seal = this.add.image(cellX(i), cellY(i) - 60, sealKey(r.crusader.rarity)).setDisplaySize(84, 84).setAlpha(0);
      this.seals[i] = seal;
      this.tweens.add({ targets: seal, y: cellY(i), alpha: 1, delay: i * 90, duration: 260, ease: 'Back.out' });
    });
    this.time.delayedCall(this.results.length * 90 + 300, () => {
      this.busy = false;
      this.hint.setText('Break the seals!');
    });
    this.skipBest = makeButton(this, GAME_W / 2, GAME_H - 70, 260, 64, 'Skip to all ten', () => this.skipToBest(), { fontSize: 19 });
    this.skipBest.all.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth?.(10));
  }

  /** Breaks the next seal on the table; a rare one rises full size. */
  private breakNext(quick = false) {
    const i = this.revealed + 1;
    const r = this.results[i];
    const seal = this.seals[i];
    if (!r || !seal) return;
    this.revealed = i;
    const high = rankOf(r) >= RARITY_ORDER.indexOf('SSR');
    sfx(r.crusader.rarity === 'UR' ? 'urReveal' : high ? 'sealRare' : 'seal');
    if (!quick && r.crusader.rarity === 'UR') music.stinger('ur', 'duck');
    if (quick) {
      seal.destroy();
      this.tableCard(i, r, false);
      return;
    }
    this.busy = true;
    this.hint.setText('');
    this.counter.setText(`${i + 1} / ${this.results.length}`);
    this.tweens.add({
      targets: seal,
      x: { from: seal.x - 4, to: seal.x + 4 },
      duration: 45,
      yoyo: true,
      repeat: high ? 5 : 2,
      onComplete: () => {
        seal.destroy();
        this.shards(WAX_COLOR[r.crusader.rarity], cellX(i), cellY(i), 0.45);
        this.tableCard(i, r, true);
        if (high) this.time.delayedCall(250, () => this.showFocus(r));
        else {
          this.busy = false;
          this.hint.setText(i < this.results.length - 1 ? 'Tap for the next seal' : 'Tap to see all ten');
        }
      },
    });
  }

  /** A broken seal's Sister, small, in her place on the table. */
  private tableCard(i: number, r: PullResult, animate: boolean) {
    const c = r.crusader;
    const col = RARITY_COLOR[c.rarity];
    const parts: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(0, 0, 90, 90, 0x000000).setStrokeStyle(4, col),
      this.add.image(0, 0, portraitKey(c.id)).setDisplaySize(84, 84),
      this.add.text(0, 58, c.name.split(' ')[0], { fontFamily: FONT, fontSize: '15px', color: hex(PAL.ivory) }).setOrigin(0.5),
      this.add.text(0, 76, c.rarity, { fontFamily: FONT, fontSize: '14px', color: hex(col) }).setOrigin(0.5),
    ];
    if (r.isNew) parts.push(...newStamp(this, 26, -36, 0.7));
    const card = this.add.container(cellX(i), cellY(i), parts);
    holdForCard(this, parts[1] as Phaser.GameObjects.Image, c.id);
    if (animate) {
      card.setScale(0.6).setAlpha(0);
      this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 220, ease: 'Back.out' });
    }
  }

  /** The full rise for an SSR or UR, over a dimmed table. */
  private showFocus(r: PullResult) {
    const dim = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0a090c, 0.92);
    // The dim layer takes taps, so nothing on the table underneath is pressed.
    dim.setInteractive().on('pointerup', () => !this.busy && this.closeFocus());
    this.focus = this.add.container(0, 0, [dim]).setDepth(20);
    const index = this.index;
    this.index = this.revealed;
    this.riseFromStatic(r, true);
    this.index = index;
    this.focus.add(this.card!);
  }

  private closeFocus() {
    this.focus?.destroy();
    this.focus = undefined;
    this.card = undefined;
    this.hint.setText(this.revealed < this.results.length - 1 ? 'Tap for the next seal' : 'Tap to see all ten');
  }

  /**
   * Skip: straight to the summary of all ten, whatever is on screen (a seal
   * mid-shake, a Sister mid-rise). Works at any moment; the pulls were granted
   * before this screen opened, so nothing is lost by skipping.
   */
  private skipToBest() {
    this.skipBest = undefined;
    this.showSummary();
  }

  private advance() {
    if (this.results.length > 1) {
      if (this.focus) this.closeFocus();
      else if (this.revealed < this.results.length - 1) this.breakNext();
      else this.showSummary();
      return;
    }
    if (this.card?.getData('stage') === 'seal') this.breakSeal();
    else if (this.index < this.results.length - 1) {
      this.index += 1;
      this.showSeal();
    } else this.showSummary();
  }

  private showSeal() {
    this.card?.destroy();
    const r = this.results[this.index];
    this.counter.setText(this.results.length > 1 ? `${this.index + 1} / ${this.results.length}` : '');
    const seal = this.add.image(0, 0, sealKey(r.crusader.rarity)).setDisplaySize(192, 192);
    this.card = this.add.container(GAME_W / 2, CY, [seal]).setData('stage', 'seal');
    this.tweens.add({ targets: seal, y: -10, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.hint.setText('Break the seal!');
  }

  private breakSeal() {
    const r = this.results[this.index];
    const card = this.card!;
    const seal = card.list[0] as Phaser.GameObjects.Image;
    const high = r.crusader.rarity === 'SSR' || r.crusader.rarity === 'UR';
    this.revealed = this.index;
    sfx(r.crusader.rarity === 'UR' ? 'urReveal' : high ? 'sealRare' : 'seal');
    if (r.crusader.rarity === 'UR') music.stinger('ur', 'duck');
    this.busy = true;
    this.hint.setText('');
    this.tweens.killTweensOf(seal);
    this.tweens.add({
      targets: seal,
      x: { from: -6, to: 6 },
      duration: 50,
      yoyo: true,
      repeat: high ? 7 : 3,
      onComplete: () => {
        seal.destroy();
        this.shards(WAX_COLOR[r.crusader.rarity]);
        this.riseFromStatic(r, high);
      },
    });
  }

  private shards(color: number, x = GAME_W / 2, y = CY, scale = 1) {
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 * i) / 14 + Math.random() * 0.3;
      const s = this.add.rectangle(x, y, 12 * scale, 12 * scale, color).setDepth(5);
      this.tweens.add({
        targets: s,
        x: x + Math.cos(a) * 260 * scale,
        y: y + Math.sin(a) * 260 * scale + 80 * scale,
        angle: 180,
        alpha: 0,
        duration: 700,
        ease: 'Quad.out',
        onComplete: () => s.destroy(),
      });
    }
  }

  private riseFromStatic(r: PullResult, high: boolean) {
    const c = r.crusader;
    const card = this.add.container(GAME_W / 2, CY).setData('stage', 'shown');
    this.card = card;
    // No tap closes her until the static has cleared.
    this.busy = true;
    const color = RARITY_COLOR[c.rarity];

    if (high) {
      for (let i = 0; i < 6; i++) {
        const ray = this.add.rectangle(0, 0, 40, 900, color, 0.12).setAngle(i * 30);
        card.add(ray);
      }
      this.tweens.add({ targets: card.list.slice(0, 6), angle: '+=30', duration: 4000, repeat: -1 });
      this.cameras.main.flash(250, 214, 161, 95);
    }

    // Her splash art when it exists, else her full-body figure at twice its pixel size, else her portrait.
    const splash = this.textures.exists(splashKey(c.id));
    const full = !splash && this.textures.exists(fullKey(c.id));
    const w = splash ? 336 : full ? FIGURE_W * 2 : SIZE;
    const h = splash ? 504 : full ? FIGURE_H * 2 : SIZE;
    const fy = splash ? -72 : full ? -58 : 0;
    const frame = this.add.rectangle(0, fy, w + 12, h + 12, 0x000000).setStrokeStyle(6, color);
    const sprite = full ? new SisterSprite(this, c.id, 0, fy + h / 2 - 16, 2, color) : undefined;
    const portrait = splash
      ? addSplash(this, c.id, 0, fy, w, h, 'full').setAlpha(0)
      : sprite
        ? sprite.root.setAlpha(0)
        : this.add.image(0, 0, portraitKey(c.id)).setDisplaySize(SIZE, SIZE).setAlpha(0);
    const noise = this.add.image(0, fy, noiseKey(0)).setDisplaySize(w, h);
    card.add([frame, portrait, noise]);
    // With splash art, her pixel figure steps out in front of it, at the frame's lower right.
    const stepper = splash && this.textures.exists(fullKey(c.id)) ? new SisterSprite(this, c.id, w / 2 - 46, fy + h / 2 + 22, 1, color) : undefined;
    if (stepper) {
      stepper.root.setAlpha(0);
      card.add(stepper.root);
      this.tweens.add({ targets: stepper.root, alpha: 1, x: { from: w / 2 + 30, to: w / 2 - 46 }, duration: 380, delay: high ? 1300 : 750, ease: 'Quad.out' });
    }

    let f = 0;
    const flicker = this.time.addEvent({ delay: 60, loop: true, callback: () => noise.active && noise.setTexture(noiseKey(++f % NOISE_FRAMES)).setDisplaySize(w, h) });
    // Timers that touch her die with her card (a skip or summary can clear it mid-rise).
    let after: Phaser.Time.TimerEvent | undefined;
    card.once(Phaser.GameObjects.Events.DESTROY, () => {
      flicker.remove();
      after?.remove();
    });
    this.tweens.add({ targets: portrait, alpha: 1, duration: high ? 900 : 500, delay: high ? 500 : 250 });
    this.tweens.add({
      targets: noise,
      alpha: 0,
      duration: high ? 900 : 500,
      delay: high ? 700 : 350,
      onComplete: () => {
        flicker.remove();
        noise.destroy();
        // The rare ones raise their relic as the static clears.
        if (sprite && high) sprite.cast(color, c.rarity === 'UR');
        if (stepper) after = this.time.delayedCall(high ? 700 : 450, () => card.active && (high ? stepper.cast(color, c.rarity === 'UR') : stepper.attack(-1)));
        this.busy = false;
        if (this.results.length > 1) this.hint.setText('Tap to return to the table');
        else this.hint.setText('Tap to continue');
      },
    });

    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    const tag = r.isNew ? 'NEWLY SWORN' : r.tithes ? `Every copy held: +${r.stigmata ?? 0} Stigmata, +${r.tithes} Tithes` : `Another oath from her (${r.tokens} held). Take her Vow in the Roster.`;
    // Words sit under the art, however tall it is.
    const textY = Math.max(SIZE / 2, fy + h / 2 + 6);
    const texts = [
      this.add.text(0, textY + 44, c.name, { ...style, fontSize: '30px' }).setOrigin(0.5),
      this.add.text(0, textY + 82, `${c.rarity} ${rankTitle(c)} · ${CLASSES[c.classId].name}`, { ...style, fontSize: '19px', color: hex(color) }).setOrigin(0.5),
      this.add
        .text(0, textY + 124, tag, { ...style, fontSize: '20px', color: hex(r.isNew ? PAL.amber : PAL.steel) })
        .setOrigin(0.5),
    ];
    texts.forEach((t) => t.setAlpha(0));
    card.add(texts);
    this.tweens.add({ targets: texts, alpha: 1, duration: 400, delay: high ? 1200 : 700 });
  }

  private showSummary() {
    // Skipping past an unopened UR still rings the stinger once.
    if (this.results.some((r, i) => i > this.revealed && r.crusader.rarity === 'UR')) music.stinger('ur', 'duck');
    this.revealed = this.results.length;
    this.busy = true;
    this.children.removeAll(true);
    this.tweens.killAll();
    this.time.removeAllEvents();
    // "Back to altar" sits where Skip was: a double tap on Skip must not leave before the ten are seen.
    settleTaps(this, 350);
    this.add.text(GAME_W / 2, 56, 'Sworn', { fontFamily: FONT, fontSize: '32px', color: hex(PAL.amber) }).setOrigin(0.5);

    const cols = 3;
    const cellW = 160;
    const cellH = 156;
    const x0 = (GAME_W - cols * cellW) / 2 + cellW / 2;
    // Rarest first: UR at the top left down to R at the bottom right (new Sisters first within a rarity).
    const rank = (r: PullResult) => RARITY_ORDER.indexOf(r.crusader.rarity);
    const sorted = [...this.results].sort((a, b) => rank(b) - rank(a) || Number(b.isNew) - Number(a.isNew));
    // a short last row is centred
    const n = sorted.length;
    sorted.forEach((r, i) => {
      const rowCount = Math.min(cols, n - Math.floor(i / cols) * cols);
      const rowX0 = x0 + ((cols - rowCount) * cellW) / 2;
      const x = rowX0 + (i % cols) * cellW;
      const y = 166 + Math.floor(i / cols) * cellH;
      const color = RARITY_COLOR[r.crusader.rarity];
      this.add.rectangle(x, y, 108, 108).setStrokeStyle(4, color);
      holdForCard(this, this.add.image(x, y, portraitKey(r.crusader.id)).setDisplaySize(100, 100), r.crusader.id);
      if (r.isNew) newStamp(this, x + 36, y - 42, 0.8);
      const label = r.isNew ? 'NEW' : r.tithes ? `+${r.alms ?? 0} ALMS` : 'VOW TOKEN';
      fitLine(this.add.text(x, y + 66, r.crusader.name.split(' ')[0], { fontFamily: FONT, fontSize: '17px', color: hex(PAL.ivory) }).setOrigin(0.5), cellW - 8);
      this.add
        .text(x, y + 86, `${r.crusader.rarity} · ${label}`, { fontFamily: FONT, fontSize: '15px', color: hex(r.isNew ? PAL.amber : PAL.steel) })
        .setOrigin(0.5);
    });

    // Pull again on the same banner, without going back to the altar.
    const seals = game.save.seals;
    this.add.text(GAME_W - 24, 56, `${seals} Seal${seals === 1 ? '' : 's'}`, { fontFamily: FONT, fontSize: '18px', color: hex(PAL.amber) }).setOrigin(1, 0.5);
    const again = (kind: PullKind, x: number, label: string) =>
      makeButton(this, x, GAME_H - 176, 236, 76, label, () => this.again(kind), { fontSize: 20, disabled: !canPull(game.save, kind), active: kind === 'ten' });
    if (this.novice) {
      const left = noviceTensLeft(game.save);
      makeButton(this, GAME_W / 2, GAME_H - 176, 300, 76, left ? `Novice ×10\n${NOVICE_COST} Seals` : 'Novice pulls spent', () => {
        const results = noviceTen(game.save);
        if (!results.length) return;
        commit();
        this.scene.restart({ results, novice: true });
      }, { fontSize: 20, disabled: !left || game.save.seals < NOVICE_COST, active: true });
    } else {
      again('one', GAME_W / 2 - 128, `Again ×1\n${COST_ONE} Seal`);
      again('ten', GAME_W / 2 + 128, `Again ×10\n${tenLabel(game.save)}`);
    }

    const hist = this.add.text(24, 56, 'Oath Record ›', { fontFamily: FONT, fontSize: '17px', color: hex(PAL.steel) }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    hist.on('pointerup', () => this.scene.start('PullHistory'));
    makeButton(this, GAME_W / 2 - 128, GAME_H - 80, 236, 68, this.novice ? 'Novitiate' : 'To the Altar', () => this.scene.start(this.novice ? 'Novitiate' : 'Recruit', {}), { fontSize: 19 });
    makeButton(this, GAME_W / 2 + 128, GAME_H - 80, 236, 68, 'See roster', () => this.scene.start('Roster', {}), { fontSize: 19 });
  }

  private again(kind: PullKind) {
    const results = pull(game.save, kind);
    if (!results.length) return;
    commit();
    this.scene.restart({ results });
  }
}

/** A red "NEW" stamp, tilted, for a Sister sworn for the first time. */
function newStamp(scene: Phaser.Scene, x: number, y: number, scale = 1): Phaser.GameObjects.GameObject[] {
  const box = scene.add.rectangle(x, y, 58 * scale, 28 * scale, 0x6b1f22).setStrokeStyle(2, PAL.amber).setAngle(-12);
  const t = scene.add.text(x, y, 'NEW', { fontFamily: FONT, fontSize: `${Math.round(19 * scale)}px`, color: hex(PAL.amber) }).setOrigin(0.5).setAngle(-12);
  return [box, t];
}
