import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { CLASSES, RARITY_COLOR } from '../data/classes';
import { COST_ONE, COST_TEN, RARITY_ORDER, canPull, pull, type PullKind, type PullResult } from '../systems/gacha';
import { commit, game } from '../state/game';
import { makeButton } from '../ui/button';
import { NOISE_FRAMES, WAX_COLOR, noiseKey, sealKey } from '../ui/effects';
import { portraitKey } from '../ui/placeholderPortrait';

const CY = 400;
const SIZE = 256;

/** One card at a time: tap the seal, it breaks, the portrait rises out of static. */
export class RevealScene extends Phaser.Scene {
  private results: PullResult[] = [];
  private index = 0;
  private busy = false;
  private card?: Phaser.GameObjects.Container;
  private hint!: Phaser.GameObjects.Text;
  private counter!: Phaser.GameObjects.Text;

  constructor() {
    super('Reveal');
  }

  init(data: { results: PullResult[] }) {
    this.results = data.results ?? [];
    this.index = 0;
    this.busy = false;
    this.card = undefined;
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0a090c);
    this.counter = this.add.text(24, 28, '', { fontFamily: FONT, fontSize: '18px', color: hex(PAL.steel) }).setOrigin(0, 0.5);
    if (this.results.length > 1) {
      const skip = makeButton(this, GAME_W - 80, 32, 120, 48, 'Skip', () => this.showSummary(), { fontSize: 18 });
      skip.box.setDepth(10);
      skip.inner.setDepth(10);
      skip.text.setDepth(11);
    }
    this.hint = this.add
      .text(GAME_W / 2, GAME_H - 140, '', { fontFamily: FONT, fontSize: '20px', color: hex(PAL.steel) })
      .setOrigin(0.5);
    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length || this.busy) return; // buttons handle their own taps
      this.advance();
    });
    this.showSeal();
  }

  private advance() {
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
    const seal = this.add.image(0, 0, sealKey(r.crusader.rarity)).setScale(2);
    this.card = this.add.container(GAME_W / 2, CY, [seal]).setData('stage', 'seal');
    this.tweens.add({ targets: seal, y: -10, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.hint.setText('Tap to break the seal');
  }

  private breakSeal() {
    const r = this.results[this.index];
    const card = this.card!;
    const seal = card.list[0] as Phaser.GameObjects.Image;
    const high = r.crusader.rarity === 'SSR' || r.crusader.rarity === 'UR';
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

  private shards(color: number) {
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 * i) / 14 + Math.random() * 0.3;
      const s = this.add.rectangle(GAME_W / 2, CY, 12, 12, color).setDepth(5);
      this.tweens.add({
        targets: s,
        x: GAME_W / 2 + Math.cos(a) * 260,
        y: CY + Math.sin(a) * 260 + 80,
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
    const color = RARITY_COLOR[c.rarity];

    if (high) {
      for (let i = 0; i < 6; i++) {
        const ray = this.add.rectangle(0, 0, 40, 900, color, 0.12).setAngle(i * 30);
        card.add(ray);
      }
      this.tweens.add({ targets: card.list.slice(0, 6), angle: '+=30', duration: 4000, repeat: -1 });
      this.cameras.main.flash(250, 214, 161, 95);
    }

    const frame = this.add.rectangle(0, 0, SIZE + 12, SIZE + 12, 0x000000).setStrokeStyle(6, color);
    const portrait = this.add.image(0, 0, portraitKey(c.id)).setDisplaySize(SIZE, SIZE).setAlpha(0);
    const noise = this.add.image(0, 0, noiseKey(0)).setDisplaySize(SIZE, SIZE);
    card.add([frame, portrait, noise]);

    let f = 0;
    const flicker = this.time.addEvent({ delay: 60, loop: true, callback: () => noise.setTexture(noiseKey(++f % NOISE_FRAMES)) });
    this.tweens.add({ targets: portrait, alpha: 1, duration: high ? 900 : 500, delay: high ? 500 : 250 });
    this.tweens.add({
      targets: noise,
      alpha: 0,
      duration: high ? 900 : 500,
      delay: high ? 700 : 350,
      onComplete: () => {
        flicker.remove();
        noise.destroy();
        this.busy = false;
        this.hint.setText(this.index < this.results.length - 1 ? 'Tap for the next Sister' : 'Tap to continue');
      },
    });

    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    const tag = r.isNew ? 'NEWLY SWORN' : r.tithes ? `Vows full: +${r.tithes} Tithes, +${r.alms ?? 0} Alms` : 'Vow token: take it in the Roster';
    const texts = [
      this.add.text(0, SIZE / 2 + 44, c.name, { ...style, fontSize: '30px' }).setOrigin(0.5),
      this.add.text(0, SIZE / 2 + 82, `${c.rarity} · ${CLASSES[c.classId].name}`, { ...style, fontSize: '19px', color: hex(color) }).setOrigin(0.5),
      this.add
        .text(0, SIZE / 2 + 124, tag, { ...style, fontSize: '20px', color: hex(r.isNew ? PAL.amber : PAL.steel) })
        .setOrigin(0.5),
    ];
    texts.forEach((t) => t.setAlpha(0));
    card.add(texts);
    this.tweens.add({ targets: texts, alpha: 1, duration: 400, delay: high ? 1200 : 700 });
  }

  private showSummary() {
    this.busy = true;
    this.children.removeAll(true);
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.add.text(GAME_W / 2, 56, 'Sworn', { fontFamily: FONT, fontSize: '32px', color: hex(PAL.amber) }).setOrigin(0.5);

    const cols = 3;
    const cellW = 160;
    const cellH = 150;
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
      const y = 170 + Math.floor(i / cols) * cellH;
      const color = RARITY_COLOR[r.crusader.rarity];
      this.add.rectangle(x, y, 120, 120).setStrokeStyle(4, color);
      this.add.image(x, y, portraitKey(r.crusader.id)).setDisplaySize(112, 112);
      const label = r.isNew ? 'NEW' : r.tithes ? `+${r.alms ?? 0} ALMS` : 'VOW TOKEN';
      this.add
        .text(x, y + 72, `${r.crusader.rarity} · ${label}`, { fontFamily: FONT, fontSize: '15px', color: hex(r.isNew ? PAL.amber : PAL.steel) })
        .setOrigin(0.5);
    });

    // Pull again on the same banner, without going back to the altar.
    const seals = game.save.seals;
    this.add.text(GAME_W - 24, 56, `${seals} Seal${seals === 1 ? '' : 's'}`, { fontFamily: FONT, fontSize: '18px', color: hex(PAL.amber) }).setOrigin(1, 0.5);
    const again = (kind: PullKind, x: number, label: string) =>
      makeButton(this, x, GAME_H - 176, 236, 76, label, () => this.again(kind), { fontSize: 20, disabled: !canPull(game.save, kind), active: kind === 'ten' });
    again('one', GAME_W / 2 - 128, `Again ×1\n${COST_ONE} Seal`);
    again('ten', GAME_W / 2 + 128, game.save.freeTenUsed ? `Again ×10\n${COST_TEN} Seals` : 'Again ×10\nFree first time');

    makeButton(this, GAME_W / 2 - 128, GAME_H - 80, 236, 68, 'Back to altar', () => this.scene.start('Recruit', {}), { fontSize: 19 });
    makeButton(this, GAME_W / 2 + 128, GAME_H - 80, 236, 68, 'See roster', () => this.scene.start('Roster', {}), { fontSize: 19 });
  }

  private again(kind: PullKind) {
    const results = pull(game.save, kind);
    if (!results.length) return;
    commit();
    this.scene.restart({ results });
  }
}
