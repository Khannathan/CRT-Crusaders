import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS, crusaderById } from '../data/crusaders';
import { KITS } from '../data/kits';
import { ORDERS } from '../data/orders';
import type { CrusaderDef } from '../data/types';
import { applyCrt } from '../fx/crt';
import { newSave, type SaveData } from '../state/save';
import { settings } from '../state/settings';
import { makeButton } from '../ui/button';
import { litanyCutIn } from '../ui/juice';
import { REVIEW_SCREENS, captureFileName, captureLabel, edgeTouches, findSister, stepId, type CaptureInfo, type ReviewScreen } from '../ui/artReview';
import { RIG_CLIPS, RIG_GUIDES, RIG_H, RIG_SRC_H, RIG_SRC_W, RIG_W, rigKey, rigSheet, type RigClip } from '../ui/pixelRig';
import { RIM_FOE, RIM_PARTY, ditherVignette, rimKey } from '../ui/pixelFx';
import { hasFullBody, hasPortrait, hasSplash, loadSplash, portraitKey, splashKey, addSplash } from '../ui/placeholderPortrait';
import { CARD_GAP, CARD_W, drawRosterCard } from '../ui/rosterCard';
import { drawPortraitBadges } from '../ui/portraitBadges';
import { MINI_SCALE, posesKey } from '../ui/spriteAssets';
import { SisterSprite, fullKey } from '../ui/sisterSprite';
import { addBackdrop, addFrame, fade, text } from '../ui/theme';

/**
 * ART REVIEW (developer only): opened with ?artreview on the game's address
 * (or ?artreview=IV-LUR to open on one Sister). Pick a Sister by roster id and
 * see her art where the game really shows it (pixel-rig motion, battle,
 * roster, the Sanctum Vigil, the Altar banner, her bust), run her moves, flip
 * her, stand 3 allies beside her, toggle the CRT filter, pause on any frame
 * and capture it (a labelled PNG, a frame sheet or a short loop) to send to
 * the artist. Nothing here touches the player's save.
 */

type Motion = RigClip | 'poses';
const MOTIONS: Motion[] = ['idle', 'strike', 'cast', 'litany', 'hurt', 'run'];
const SPEEDS = [1, 0.5, 0.25];

/** Kept across restarts (screen resize, new Sister). */
const st = {
  id: '',
  screen: 'motion' as ReviewScreen,
  motion: 'idle' as Motion,
  frame: 0,
  playing: true,
  speed: 1,
  flip: false,
  allies: true,
  guides: true,
  artOnly: true,
};

/** The stage: the captured area. Header above, controls below. */
const STAGE_Y = 78;
/** The controls' height under the stage. */
const CONTROLS_H = 300;
/** The stage fills what the controls leave (taller phones get a taller stage). Set in create(). */
let STAGE_H = 560;
const HEAD_H = STAGE_Y - 4;
/** Motion screen zoom (whole pixels): 3x when the stage is tall enough, else 2x. Set in create(). */
let Z = 2;

const hasArt = (id: string) => hasFullBody(id) || hasPortrait(id) || hasSplash(id);

export class ArtReviewScene extends Phaser.Scene {
  private c!: CrusaderDef;
  private stage!: Phaser.GameObjects.Container;
  private info?: Phaser.GameObjects.Text;
  /** Motion screen: the rig frame on show. */
  private rigImg?: Phaser.GameObjects.Image;
  private rigTex?: string;
  private acc = 0;
  /** Edge touches per rig frame index (frame art cut off at the frame edge). */
  private edges: string[][] = [];
  /** The figures on the other screens; the first is her. */
  private figs: SisterSprite[] = [];
  private running = false;
  private overlay?: HTMLDivElement;

  constructor() {
    super('ArtReview');
  }

  init(data: { id?: string }) {
    const pick = (data.id && findSister(CRUSADERS, data.id)) || crusaderById(st.id) || CRUSADERS.find((c) => hasFullBody(c.id)) || CRUSADERS[0];
    st.id = pick.id;
    this.c = pick;
  }

  preload() {
    if (hasSplash(this.c.id) && !this.textures.exists(splashKey(this.c.id))) loadSplash(this, this.c.id);
    for (const a of this.allies()) if (hasSplash(a.id)) loadSplash(this, a.id);
  }

  create() {
    STAGE_H = GAME_H - STAGE_Y - CONTROLS_H;
    Z = STAGE_H >= RIG_H * 3 + 110 ? 3 : 2;
    this.cameras.main.setBackgroundColor(0x0e0d11);
    this.figs = [];
    this.running = false;
    this.rigImg = undefined;
    this.rigTex = undefined;
    this.edges = [];
    this.info = undefined;
    this.acc = 0;
    this.stage = this.add.container(0, 0);
    this.drawStage();
    this.drawHeader();
    this.drawControls();
    this.applySpeed();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.remove();
      this.time.paused = false;
      this.tweens.timeScale = 1;
      this.anims.globalTimeScale = 1;
      this.anims.resumeAll();
    });
  }

  // ---- who is shown ---------------------------------------------------------

  private ids() {
    const all = CRUSADERS.map((c) => c.id);
    const art = all.filter(hasArt);
    return st.artOnly && art.length ? art : all;
  }

  /** Three allies: Sisters with their own figures first, then her Order-mates. */
  private allies(): CrusaderDef[] {
    const others = CRUSADERS.filter((c) => c.id !== this.c.id);
    const drawn = others.filter((c) => hasFullBody(c.id));
    const mates = others.filter((c) => c.order === this.c.order && !drawn.includes(c));
    return [...drawn, ...mates, ...others].slice(0, 3);
  }

  private open(id: string) {
    st.id = id;
    st.frame = 0;
    this.scene.restart({ id });
  }

  private get color() {
    return ORDERS[this.c.order]?.color ?? RARITY_COLOR[this.c.rarity];
  }

  // ---- header + controls ------------------------------------------------------

  private drawHeader() {
    const d = 100;
    this.add.rectangle(GAME_W / 2, HEAD_H / 2, GAME_W, HEAD_H, 0x0e0d11).setDepth(d);
    this.add.rectangle(GAME_W / 2, HEAD_H, GAME_W, 1, PAL.goldEdge).setDepth(d);
    const btn = (x: number, w: number, label: string, fn: () => void, active = false) =>
      makeButton(this, x, 38, w, 50, label, fn, { fontSize: label.length > 2 ? 15 : 26, active }).all.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(d + 1));
    btn(28, 48, '‹', () => this.open(stepId(this.ids(), this.c.id, -1)));
    btn(GAME_W - 28, 48, '›', () => this.open(stepId(this.ids(), this.c.id, 1)));
    btn(86, 60, 'Find', () => this.find());
    btn(GAME_W - 86, 60, st.artOnly ? 'Art' : 'All', () => {
      st.artOnly = !st.artOnly;
      this.scene.restart({ id: this.c.id });
    }, st.artOnly);
    const ids = this.ids();
    const n = ids.indexOf(this.c.id) + 1;
    const own = [hasFullBody(this.c.id) && 'figure', hasPortrait(this.c.id) && 'bust', hasSplash(this.c.id) && 'splash'].filter(Boolean).join(', ') || 'stand-in only';
    this.add.text(124, 10, `ART REVIEW · ${n || '-'} / ${ids.length}`, text.hud(11, PAL.steel)).setDepth(d + 1);
    this.add.text(124, 26, this.c.id, text.hud(16, RARITY_COLOR[this.c.rarity])).setDepth(d + 1);
    this.add.text(124, 46, `${this.c.name.split(' ')[0]} · ${own}`, text.body(15, PAL.ivory)).setDepth(d + 1).setCrop(0, 0, GAME_W - 124 - 124, 30);
  }

  private find() {
    const typed = window.prompt('Roster id or name (e.g. IV-LUR)', this.c.id);
    if (!typed) return;
    const c = findSister(CRUSADERS, typed);
    if (!c) return this.say(`No Sister matches "${typed}".`);
    // A Sister outside the art-only list widens it.
    if (!this.ids().includes(c.id)) st.artOnly = false;
    this.open(c.id);
  }

  private drawControls() {
    const d = 100;
    const top = STAGE_Y + STAGE_H + 4;
    this.add.rectangle(GAME_W / 2, (top + GAME_H) / 2, GAME_W, GAME_H - top, 0x0e0d11).setDepth(d);
    this.add.rectangle(GAME_W / 2, top, GAME_W, 1, PAL.goldEdge).setDepth(d);
    const row = (y: number, items: [string, () => void, boolean?][]) => {
      const gap = 5;
      const w = (GAME_W - 16 - gap * (items.length - 1)) / items.length;
      items.forEach(([label, fn, on], i) => {
        const b = makeButton(this, 8 + w / 2 + i * (w + gap), y, w, 42, label, fn, { fontSize: 14, active: !!on });
        b.all.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(d + 1));
      });
    };
    const H = 47;
    let y = top + 28;
    const names: Record<ReviewScreen, string> = { motion: 'Motion', battle: 'Battle', roster: 'Roster', sanctum: 'Sanctum', altar: 'Altar', bust: 'Bust' };
    row(y, REVIEW_SCREENS.map((s) => [names[s], () => this.setScreen(s), st.screen === s]));
    y += H;
    if (st.screen !== 'bust') row(y, MOTIONS.map((m) => [m[0].toUpperCase() + m.slice(1), () => this.play(m), st.motion === m]));
    y += H;
    const extra: [string, () => void, boolean?][] = [];
    if (st.screen === 'motion') {
      if (this.textures.exists(posesKey(this.c.id))) extra.push(['Drawn poses', () => this.play('poses'), st.motion === 'poses']);
      extra.push(['Guides', () => ((st.guides = !st.guides), this.redraw()), st.guides]);
    } else if (st.screen !== 'bust') {
      extra.push(['Die', () => this.die()], ['Knockout', () => this.ko()], ['Cheer', () => this.figs.forEach((f, i) => f.cheer(i * 90))]);
      if (st.screen === 'battle') extra.push(['Cut-in', () => this.cutIn()]);
    }
    if (extra.length) row(y, extra);
    y += H;
    row(y, [
      ['◀', () => this.step(-1)],
      [st.playing ? 'Pause' : 'Play', () => this.togglePlay(), !st.playing],
      ['▶', () => this.step(1)],
      [`${st.speed}x`, () => this.cycleSpeed(), st.speed !== 1],
      ['Flip', () => ((st.flip = !st.flip), this.redraw()), st.flip],
      ['Allies', () => ((st.allies = !st.allies), this.redraw()), st.allies],
      ['CRT', () => this.toggleCrt(), settings.crt],
    ]);
    y += H;
    row(y, [
      ['Snap PNG', () => this.snap()],
      [st.screen === 'motion' ? 'Frame sheet' : 'Burst sheet', () => this.sheet()],
      ['Loop 3s', () => this.loop()],
      ['Exit', () => this.exit()],
    ]);
    y += 34;
    this.info = this.add.text(GAME_W / 2, y, '', { ...text.hud(12, PAL.amber), align: 'center', wordWrap: { width: GAME_W - 24 } }).setOrigin(0.5, 0).setDepth(d + 1);
    this.updateInfo();
  }

  private say(msg: string) {
    this.info?.setText(msg);
    this.time.delayedCall(2600, () => this.updateInfo());
  }

  private setScreen(s: ReviewScreen) {
    st.screen = s;
    if (s !== 'motion' && st.motion === 'poses') st.motion = 'idle';
    st.frame = 0;
    this.scene.restart({ id: this.c.id });
  }

  /** Rebuilds the stage and the buttons (their on/off look). */
  private redraw() {
    this.scene.restart({ id: this.c.id });
  }

  private toggleCrt() {
    settings.crt = !settings.crt;
    applyCrt(this);
    this.redraw();
  }

  private exit() {
    const url = new URL(window.location.href);
    url.searchParams.delete('artreview');
    window.location.href = url.toString();
  }

  // ---- the stage ------------------------------------------------------------

  private drawStage() {
    const draw: Record<ReviewScreen, () => void> = {
      motion: () => this.drawMotion(),
      battle: () => this.drawBattle(),
      roster: () => this.drawRoster(),
      sanctum: () => this.drawSanctum(),
      altar: () => this.drawAltar(),
      bust: () => this.drawBust(),
    };
    draw[st.screen]();
    // Replay the chosen motion on the new figures.
    if (st.screen !== 'motion' && st.screen !== 'bust' && st.motion !== 'idle') this.time.delayedCall(250, () => this.play(st.motion, true));
  }

  private add2<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.stage.add(o);
    return o;
  }

  /** The motion lab: her rig frame at 2x on a plain floor, frame by frame. */
  private drawMotion() {
    const cx = GAME_W / 2;
    const feet = STAGE_Y + STAGE_H - 70;
    this.add2(this.add.rectangle(cx, STAGE_Y + STAGE_H / 2, GAME_W, STAGE_H, 0x17121a));
    // a checker so dark outlines and transparent holes both show
    const g = this.add2(this.add.graphics());
    const left = cx - (RIG_W * Z) / 2;
    const topY = feet - RIG_H * Z;
    for (let y = 0; y < RIG_H * Z; y += 16)
      for (let x = 0; x < RIG_W * Z; x += 16) if (((x + y) / 16) % 2 === 0) g.fillStyle(0x221b25, 1).fillRect(left + x, topY + y, 16, 16);
    const still = fullKey(this.c.id);
    const rig = rigKey(this, still);
    this.rigTex = rig;
    if (rig) this.edges = this.findEdges(still);
    const key = st.motion === 'poses' ? posesKey(this.c.id) : rig ?? still;
    const img = this.add2(this.add.image(cx, feet, key, 0).setOrigin(0.5, 1).setScale(Z).setFlipX(st.flip));
    this.rigImg = img;
    // the frame's own edge (art cut off here is lost) and the 128-wide still inside it
    const fw = (st.motion === 'poses' || !rig ? RIG_SRC_W : RIG_W) * Z;
    this.add2(this.add.rectangle(cx, feet - (RIG_H * Z) / 2, fw, RIG_H * Z).setStrokeStyle(1, 0x8a6a8a, 0.9));
    if (st.guides) {
      const gl = this.add2(this.add.graphics());
      gl.lineStyle(1, 0x5fb0c8, 0.55);
      if (st.motion !== 'poses' && rig) {
        gl.strokeRect(cx - (RIG_SRC_W * Z) / 2, topY, RIG_SRC_W * Z, RIG_SRC_H * Z);
      }
      for (const [name, row] of Object.entries(RIG_GUIDES)) {
        const y = topY + row * Z;
        gl.lineBetween(left - 6, y, left + RIG_W * Z + 6, y);
        this.add2(this.add.text(Math.max(4, left - 8), y - 1, name, text.hud(10, 0x5fb0c8)).setOrigin(left - 8 > 60 ? 1 : 0, 1));
      }
    }
    this.add2(this.add.text(12, STAGE_Y + 8, `${Z}x · pixel rig${hasFullBody(this.c.id) ? '' : ' (stand-in: no figure art yet)'}`, text.hud(11, PAL.steel)));
    this.add2(this.add.text(12, STAGE_Y + 24, 'Blue box: her 128x192 still. Purple: the rig frame (art past it is cut off).', { ...text.hud(10, PAL.steel), wordWrap: { width: GAME_W - 24 } }));
    this.showFrame();
  }

  /** Which rig frames have art on their edge (cut off). */
  private findEdges(still: string): string[][] {
    const src = this.textures.get(still).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const cv = document.createElement('canvas');
    cv.width = src.width;
    cv.height = src.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(src, 0, 0);
    const px = ctx.getImageData(0, 0, cv.width, cv.height).data;
    return rigSheet(px, cv.width, cv.height).map((f) => edgeTouches(f, RIG_W, RIG_H));
  }

  private clipLen() {
    if (st.motion === 'poses') return 4;
    return RIG_CLIPS[st.motion].count;
  }

  private frameMs() {
    if (st.motion === 'poses') return 700;
    return RIG_CLIPS[st.motion].ms[st.frame] ?? 150;
  }

  private showFrame() {
    if (!this.rigImg) return;
    const n = this.clipLen();
    st.frame = ((st.frame % n) + n) % n;
    if (st.motion === 'poses') this.rigImg.setFrame(st.frame);
    else if (this.rigTex) this.rigImg.setFrame(RIG_CLIPS[st.motion].start + st.frame);
    this.updateInfo();
  }

  /** A battle field: the arena backdrop, her gold-rimmed figure, allies, and a foe to strike. */
  private drawBattle() {
    const bgKey = this.textures.exists('bg-battle') ? 'bg-battle' : 'bg-hall';
    if (this.textures.exists(bgKey)) {
      const src = this.textures.get(bgKey).getSourceImage();
      const z = Math.max(1, Math.round(Math.max(GAME_W / src.width, STAGE_H / src.height)));
      this.add2(this.add.image(GAME_W / 2, STAGE_Y + STAGE_H / 2, bgKey).setScale(z).setAlpha(0.55));
    }
    this.add2(fade(this, GAME_W / 2, STAGE_Y + STAGE_H / 2, GAME_W, STAGE_H, 0.25, 0x0e0d11) as Phaser.GameObjects.GameObject);
    this.add2(ditherVignette(this, GAME_W / 2, STAGE_Y + STAGE_H / 2, GAME_W, STAGE_H, 0x0e0d11, 0.6));
    const foot = STAGE_Y + STAGE_H - 40;
    const spots = [
      { x: 190, y: foot },
      { x: 70, y: foot - 90 },
      { x: 300, y: foot - 110 },
      { x: 120, y: foot - 190 },
    ];
    this.placeFigures(spots, 1, true);
    // a foe on the right, facing her
    const foe = Object.keys(this.textures.list).find((k) => /^full-enemy-[a-z-]+$/.test(k) && !k.endsWith('-blasphemy'));
    if (foe) {
      const img = this.add.image(450, foot - 30, rimKey(this, foe, RIM_FOE)).setOrigin(0.5, 1).setFlipX(true);
      this.stage.add(img);
    }
    this.sortDepth();
  }

  /** Her page (splash with her figure in front) and the Roster cards. */
  private drawRoster() {
    const heroH = Math.max(300, STAGE_H - 210);
    const cy = STAGE_Y + heroH / 2;
    this.add2(this.add.rectangle(GAME_W / 2, STAGE_Y + STAGE_H / 2, GAME_W, STAGE_H, 0x0d090f));
    if (this.textures.exists(splashKey(this.c.id))) {
      this.add2(addSplash(this, this.c.id, GAME_W / 2, cy, GAME_W, heroH, 'hero'));
      this.add2(fade(this, GAME_W / 2, cy, GAME_W, heroH, 0.45, 0x0d090f) as Phaser.GameObjects.GameObject);
    } else {
      for (const o of addBackdrop(this, 'bg-hall', GAME_W / 2, cy, GAME_W, heroH, { alpha: 0.18, fade: 0.7, fadeColor: 0x0d090f })) this.add2(o);
      this.add2(this.add.text(12, STAGE_Y + 8, 'No splash yet: her page shows the figure alone', text.hud(11, PAL.steel)));
    }
    const fig = new SisterSprite(this, this.c.id, GAME_W - 104, STAGE_Y + heroH - 10, 1, this.color);
    fig.face(st.flip ? -1 : 1);
    this.stage.add(fig.root);
    this.figs.push(fig);
    // the cards: hers and two allies', as the Roster grid shows them
    const save = this.fakeSave();
    const cards = [this.c, ...(st.allies ? this.allies().slice(0, 2) : [])];
    const top = STAGE_Y + heroH + 12;
    cards.forEach((c, i) => {
      const left = 18 + i * (CARD_W + CARD_GAP);
      drawRosterCard(this, left, top, c, save).parts.forEach((p) => this.stage.add(p));
    });
  }

  /** The Sanctum's Vigil: small figures at the real mini size, and her mini at 3x below. */
  private drawSanctum() {
    const cy = STAGE_Y + 150;
    this.add2(this.add.rectangle(GAME_W / 2, STAGE_Y + STAGE_H / 2, GAME_W, STAGE_H, 0x0d090f));
    for (const o of addBackdrop(this, 'bg-hall', GAME_W / 2, cy, GAME_W - 36, 250, { alpha: 0.5, fade: 0.4 })) this.add2(o);
    for (const o of addFrame(this, GAME_W / 2, cy, GAME_W - 36, 250)) this.add2(o);
    this.add2(this.add.text(30, STAGE_Y + 34, 'THE VIGIL (real size)', text.hud(11, PAL.amber)));
    const feet = cy + 90;
    this.placeFigures([{ x: 150, y: feet }, { x: 230, y: feet - 6 }, { x: 310, y: feet + 4 }, { x: 390, y: feet - 2 }], MINI_SCALE, false);
    this.add2(this.add.text(30, STAGE_Y + 292, 'HER MINI AT 3x', text.hud(11, PAL.amber)));
    const big = new SisterSprite(this, this.c.id, GAME_W / 2, Math.min(STAGE_Y + STAGE_H - 12, STAGE_Y + 560), MINI_SCALE * 3, this.color, undefined, { mini: true });
    big.face(st.flip ? -1 : 1);
    this.stage.add(big.root);
    this.figs.push(big);
  }

  /** The Altar banner: her splash above, the featured Sisters on the floor below (she stands in the middle). */
  private drawAltar() {
    const bw = GAME_W - 36;
    const bh = 444;
    const by = STAGE_Y + 10 + bh / 2;
    const bTop = by - bh / 2;
    const edge = this.c.rarity === 'UR' ? RARITY_COLOR.UR : this.color;
    this.add2(this.add.rectangle(GAME_W / 2, STAGE_Y + STAGE_H / 2, GAME_W, STAGE_H, 0x0e0d11));
    this.add2(this.add.rectangle(GAME_W / 2, by, bw, bh, 0x140b12, 1));
    this.add2(this.add.rectangle(GAME_W / 2, by, bw, bh, edge, 0.08));
    const splashH = bh - 206;
    const splashY = bTop + splashH / 2;
    if (this.textures.exists(splashKey(this.c.id))) this.add2(addSplash(this, this.c.id, GAME_W / 2, splashY, bw, splashH, 'hero'));
    else {
      const o = ORDERS[this.c.order];
      const art = o && this.textures.exists(`banner-${o.id}`) ? `banner-${o.id}` : 'bg-altar';
      for (const p of addBackdrop(this, art, GAME_W / 2, splashY, bw, splashH, { focusY: 0.35 })) this.add2(p);
    }
    this.add2(fade(this, GAME_W / 2, splashY, bw, splashH, 0.3, 0x140b12) as Phaser.GameObjects.GameObject);
    for (const o of addFrame(this, GAME_W / 2, by, bw, bh, { edge })) this.add2(o);
    const feet = bTop + bh - 76;
    this.placeFigures([{ x: GAME_W / 2, y: feet }, { x: GAME_W / 2 - 160, y: feet - 6 }, { x: GAME_W / 2 + 160, y: feet - 6 }], 1, false);
  }

  /** Her bust: 1x (as cards draw it), 2x, and with the card's corner badges. */
  private drawBust() {
    this.add2(this.add.rectangle(GAME_W / 2, STAGE_Y + STAGE_H / 2, GAME_W, STAGE_H, 0x17121a));
    const key = portraitKey(this.c.id);
    const y1 = STAGE_Y + 40;
    this.add2(this.add.text(24, y1 - 22, '1x', text.hud(11, PAL.steel)));
    this.add2(this.add.image(24, y1, key).setOrigin(0, 0).setDisplaySize(128, 128).setFlipX(st.flip));
    this.add2(this.add.text(24, y1 + 150, 'WITH BADGES', text.hud(11, PAL.steel)));
    this.add2(this.add.image(88, y1 + 238, key).setDisplaySize(128, 128).setFlipX(st.flip));
    drawPortraitBadges(this, 88, y1 + 238, 128, this.c, this.fakeSave()).forEach((o) => this.stage.add(o));
    this.add2(this.add.text(184, y1 - 22, '2x', text.hud(11, PAL.steel)));
    this.add2(this.add.image(184, y1, key).setOrigin(0, 0).setDisplaySize(256, 256).setFlipX(st.flip));
    if (!hasPortrait(this.c.id)) this.add2(this.add.text(184, y1 + 270, 'No bust yet: this is her stand-in.', text.hud(11, PAL.steel)));
  }

  /** Her (first spot) and up to 3 allies as live figures. */
  private placeFigures(spots: { x: number; y: number }[], scale: number, rim: boolean) {
    const who = [this.c, ...(st.allies ? this.allies() : [])].slice(0, spots.length);
    who.forEach((c, i) => {
      const color = ORDERS[c.order]?.color ?? RARITY_COLOR[c.rarity];
      const f = new SisterSprite(this, c.id, spots[i].x, spots[i].y, scale, i === 0 ? PAL.amber : color, rim ? RIM_PARTY : undefined, { mini: scale < 1 });
      f.face(st.flip ? -1 : 1);
      this.stage.add(f.root);
      this.figs.push(f);
      // allies a step back in her light
      if (i > 0) f.root.setAlpha(0.92);
    });
  }

  /** Figures further down the field draw in front. */
  private sortDepth() {
    this.stage.sort('y');
  }

  /** A save that owns her and the allies, for the cards' badges (never stored). */
  private fakeSave(): SaveData {
    const s = newSave();
    for (const c of [this.c, ...this.allies()]) s.owned[c.id] = { level: 50, vow: 0 };
    return s;
  }

  // ---- motion -----------------------------------------------------------------

  private play(m: Motion, replay = false) {
    const changed = st.motion !== m;
    st.motion = m;
    if (st.screen === 'motion') {
      st.frame = 0;
      this.acc = 0;
      if (changed || m === 'poses') this.redraw();
      else this.showFrame();
      return;
    }
    // A new motion rebuilds the stage (fresh figures, its button lit); drawStage replays it.
    if (changed && !replay) return this.redraw();
    const her = this.figs[0];
    if (!her || m === 'idle') return;
    // In loops (the chosen move repeats until another is picked), so any frame can be caught.
    const once = () => {
      if (st.motion !== m || !this.figs[0]) return;
      if (m === 'strike') her.strike(st.flip ? -1 : 1, 0);
      if (m === 'cast') her.cast(this.color);
      if (m === 'litany') her.cast(this.color, true);
      if (m === 'hurt') her.hit(true, 1);
    };
    if (m === 'run') {
      this.figs.forEach((f) => f.walk(true));
      this.updateInfo();
      return;
    }
    once();
    if (!this.running) {
      this.running = true;
      this.time.addEvent({ delay: 1400, loop: true, callback: once });
    }
    this.updateInfo();
  }

  private die() {
    const her = this.figs[0];
    if (!her || her.dead) return;
    her.die(() => this.time.delayedCall(700, () => her.revive()));
  }

  private ko() {
    const her = this.figs[0];
    if (!her || her.dead) return;
    her.knockout({ x: st.flip ? 1 : -1, y: -0.6 }, this.color, () => this.time.delayedCall(500, () => this.redraw()));
  }

  private cutIn() {
    if (!this.textures.exists(splashKey(this.c.id))) return this.say('She needs a splash for the Litany cut-in.');
    const name = KITS[this.c.id]?.skills[3]?.name ?? 'Litany';
    litanyCutIn(this, this.c.id, name, this.c.name.split(' ')[0], 0, KITS[this.c.id]?.cry);
  }

  update(_t: number, delta: number) {
    if (st.screen !== 'motion' || !st.playing || !this.rigImg) return;
    this.acc += delta * st.speed;
    let guard = 0;
    while (this.acc >= this.frameMs() && guard++ < 8) {
      this.acc -= this.frameMs();
      st.frame += 1;
      this.showFrame();
    }
  }

  private togglePlay() {
    st.playing = !st.playing;
    this.applySpeed();
    this.redraw();
  }

  private cycleSpeed() {
    st.speed = SPEEDS[(SPEEDS.indexOf(st.speed) + 1) % SPEEDS.length];
    this.redraw();
  }

  /** Speed and pause for everything the figures run on (timers, tweens, sheets). */
  private applySpeed() {
    this.time.timeScale = st.speed;
    this.tweens.timeScale = st.speed;
    this.anims.globalTimeScale = st.speed;
    if (st.screen === 'motion') return;
    if (!st.playing) {
      // let the replayed motion reach its first frames, then hold
      this.time.delayedCall(300, () => this.freeze(true));
    }
  }

  private freeze(on: boolean) {
    this.time.paused = on;
    if (on) {
      this.tweens.pauseAll();
      this.anims.pauseAll();
    } else {
      this.tweens.resumeAll();
      this.anims.resumeAll();
    }
  }

  /** One frame on (or back, on the Motion screen). Pauses first. */
  private step(d: number) {
    if (st.playing) {
      st.playing = false;
      if (st.screen !== 'motion') this.freeze(true);
      this.redraw();
      return;
    }
    if (st.screen === 'motion') {
      st.frame += d;
      this.showFrame();
      return;
    }
    if (d < 0) return this.say('Back-stepping only works on the Motion screen.');
    // let the game run for one tick, then hold again
    this.freeze(false);
    this.events.once(Phaser.Scenes.Events.POST_UPDATE, () => this.freeze(true));
  }

  private updateInfo() {
    if (!this.info) return;
    const lines: string[] = [];
    if (st.screen === 'motion') {
      const n = this.clipLen();
      lines.push(`${st.motion.toUpperCase()} · frame ${st.frame + 1} of ${n} · ${this.frameMs()} ms · ${st.playing ? 'playing' : 'paused'}`);
      if (st.motion !== 'poses' && this.edges.length) {
        const hit = MOTIONS.flatMap((m) => {
          if (m === 'poses') return [];
          const c = RIG_CLIPS[m];
          const fr = [...Array(c.count).keys()].filter((i) => this.edges[c.start + i]?.length);
          return fr.length ? [`${m} ${fr.map((i) => i + 1).join(',')}`] : [];
        });
        lines.push(hit.length ? `Cut off at the frame edge: ${hit.join(' · ')}` : 'No frame cuts her off.');
        const here = this.edges[RIG_CLIPS[st.motion].start + st.frame];
        if (here?.length) lines.push(`This frame touches the ${here.join(' + ')} edge.`);
      }
    } else if (st.screen === 'bust') {
      lines.push('Her bust as the cards and pickers show it.');
    } else {
      lines.push(`${st.motion.toUpperCase()} · ${st.playing ? 'playing' : 'paused'}${st.speed !== 1 ? ` · ${st.speed}x` : ''}. Pause, then ▶ steps one game frame.`);
    }
    this.info.setText(lines.join('\n'));
  }

  // ---- capture ------------------------------------------------------------------

  private capInfo(): CaptureInfo {
    const motion = st.screen === 'bust' ? 'bust' : st.motion;
    return {
      id: this.c.id,
      name: this.c.name,
      screen: st.screen,
      motion,
      frame: st.screen === 'motion' ? st.frame + 1 : undefined,
      frames: st.screen === 'motion' ? this.clipLen() : undefined,
      flipped: st.flip,
      crt: settings.crt,
      speed: st.speed,
      allies: st.allies,
    };
  }

  /** A canvas with the label strip on top and room for an image of w x h at `scale`. */
  private labelled(w: number, h: number, scale: number, label: string) {
    const strip = 44;
    const cv = document.createElement('canvas');
    cv.width = w * scale;
    cv.height = h * scale + strip;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0e0d11';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#efbc79';
    ctx.font = `bold ${Math.max(12, Math.round(13 * Math.min(scale, 1.6)))}px monospace`;
    // wrap the label onto two lines if it is long
    const words = label.split(' · ');
    const lines: string[] = [''];
    for (const w2 of words) {
      const cand = lines[lines.length - 1] ? `${lines[lines.length - 1]} · ${w2}` : w2;
      if (ctx.measureText(cand).width > cv.width - 16 && lines[lines.length - 1]) lines.push(w2);
      else lines[lines.length - 1] = cand;
    }
    lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, 8, 18 + i * 18));
    return { cv, ctx, top: strip };
  }

  /** The stage as it looks right now (CRT and all), labelled, at 2x. */
  private snap() {
    const r = this.game.renderer;
    const info = this.capInfo();
    const done = (img: HTMLImageElement) => {
      const { cv, ctx, top } = this.labelled(GAME_W, STAGE_H, 2, captureLabel(info));
      ctx.drawImage(img, 0, top, GAME_W * 2, STAGE_H * 2);
      this.showResult(cv, captureFileName(info, 'png'));
    };
    // The canvas may be drawn larger than the game (resolution), so scale the area to it.
    const k = this.game.canvas.width / GAME_W;
    r.snapshotArea(0, Math.round(STAGE_Y * k), Math.round(GAME_W * k), Math.round(STAGE_H * k), (img) => done(img as HTMLImageElement));
  }

  /**
   * Motion screen: every frame of the motion side by side from the rig itself
   * (no CRT), numbered with its time. Other screens: 8 shots of the stage over 1.6 s.
   */
  private sheet() {
    const info = this.capInfo();
    if (st.screen === 'motion') {
      info.crt = false;
      const key = st.motion === 'poses' ? posesKey(this.c.id) : this.rigTex;
      if (!key) return this.say('No rig for this figure.');
      const tex = this.textures.get(key);
      const n = this.clipLen();
      const fw = st.motion === 'poses' ? RIG_SRC_W : RIG_W;
      const S = 2;
      const cols = Math.min(n, 4);
      const rows = Math.ceil(n / cols);
      const cellH = RIG_H * S + 22;
      const { cv, ctx, top } = this.labelled(fw * cols, (cellH * rows) / S, S, captureLabel(info, 'sheet'));
      const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      for (let i = 0; i < n; i++) {
        const f = tex.get(st.motion === 'poses' ? i : RIG_CLIPS[st.motion as RigClip].start + i);
        const x = (i % cols) * fw * S;
        const y = top + Math.floor(i / cols) * cellH;
        ctx.fillStyle = (i + Math.floor(i / cols)) % 2 ? '#17121a' : '#1d1720';
        ctx.fillRect(x, y, fw * S, cellH);
        ctx.save();
        if (st.flip) {
          ctx.translate(x + fw * S, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(src, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, y + 20, fw * S, RIG_H * S);
        } else ctx.drawImage(src, f.cutX, f.cutY, f.cutWidth, f.cutHeight, x, y + 20, fw * S, RIG_H * S);
        ctx.restore();
        const edge = st.motion !== 'poses' ? this.edges[RIG_CLIPS[st.motion as RigClip].start + i] : undefined;
        ctx.strokeStyle = edge?.length ? '#e04848' : '#4a3a4e';
        ctx.lineWidth = edge?.length ? 2 : 1;
        ctx.strokeRect(x + 1, y + 20, fw * S - 2, RIG_H * S - 1);
        ctx.fillStyle = edge?.length ? '#ff8a8a' : '#c5a4d5';
        ctx.font = 'bold 13px monospace';
        const ms = st.motion === 'poses' ? '' : ` · ${RIG_CLIPS[st.motion as RigClip].ms[i]}ms`;
        ctx.fillText(`frame ${i + 1}${ms}${edge?.length ? ` · CUT ${edge.join('+')}` : ''}`, x + 6, y + 15);
      }
      return this.showResult(cv, captureFileName(info, 'png', 'sheet'));
    }
    // A burst of the live stage.
    const shots = 8;
    const k = this.game.canvas.width / GAME_W;
    const S = 1;
    const cols = 4;
    const cw = GAME_W * S;
    const ch = STAGE_H * S;
    const { cv, ctx, top } = this.labelled(cw * cols, (ch + 18) * (shots / cols), 1, captureLabel(info, 'sheet'));
    let i = 0;
    this.say('Capturing 8 shots...');
    const grab = () => {
      const n = i;
      this.game.renderer.snapshotArea(0, Math.round(STAGE_Y * k), Math.round(GAME_W * k), Math.round(STAGE_H * k), (img) => {
        const x = (n % cols) * cw;
        const y = top + Math.floor(n / cols) * (ch + 18);
        ctx.fillStyle = '#c5a4d5';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`shot ${n + 1} · ${n * 200}ms`, x + 4, y + 13);
        ctx.drawImage(img as HTMLImageElement, x, y + 18, cw, ch);
        if (n === shots - 1) this.showResult(cv, captureFileName(info, 'png', 'sheet'));
      });
      i++;
      if (i < shots) window.setTimeout(grab, 200);
    };
    grab();
  }

  /** Records 3 seconds of the stage as a video (WebM), labelled. */
  private loop() {
    const info = this.capInfo();
    if (typeof MediaRecorder === 'undefined') return this.say('This browser cannot record video. Use the sheet instead.');
    const { cv, ctx, top } = this.labelled(GAME_W, STAGE_H, 1, captureLabel(info, 'loop'));
    const stream = (cv as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }).captureStream?.(30);
    if (!stream) return this.say('This browser cannot record the canvas.');
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported?.(t));
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 4_000_000 } : undefined);
    } catch {
      return this.say('This browser cannot record video. Use the sheet instead.');
    }
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const k = this.game.canvas.width / GAME_W;
    // Copy the stage out of the game canvas right after each render (the WebGL buffer is still there).
    const copy = () => ctx.drawImage(this.game.canvas, 0, STAGE_Y * k, GAME_W * k, STAGE_H * k, 0, top, GAME_W, STAGE_H);
    this.game.events.on(Phaser.Core.Events.POST_RENDER, copy);
    rec.onstop = () => {
      this.game.events.off(Phaser.Core.Events.POST_RENDER, copy);
      const type = rec.mimeType || 'video/webm';
      const blob = new Blob(chunks, { type });
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      this.showResult(blob, captureFileName(info, ext as 'webm', 'loop'));
    };
    this.say('Recording 3 seconds...');
    rec.start(250);
    window.setTimeout(() => rec.state !== 'inactive' && rec.stop(), 3000);
  }

  /**
   * Shows the capture over the game with Save and Share (Android's share sheet
   * sends it straight to ChatGPT or a chat). Long-press the picture works too.
   */
  private showResult(out: HTMLCanvasElement | Blob, name: string) {
    const show = (blob: Blob) => {
      this.overlay?.remove();
      const url = URL.createObjectURL(blob);
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;z-index:50;background:rgba(10,8,12,0.94);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;box-sizing:border-box;font:14px monospace;color:#efbc79;touch-action:auto;';
      const media = blob.type.startsWith('video')
        ? Object.assign(document.createElement('video'), { src: url, autoplay: true, loop: true, muted: true, playsInline: true, controls: true })
        : Object.assign(document.createElement('img'), { src: url, alt: name });
      media.style.cssText = 'max-width:100%;max-height:70vh;image-rendering:pixelated;border:1px solid #aa7c4b;';
      const label = document.createElement('div');
      label.textContent = name;
      label.style.cssText = 'word-break:break-all;text-align:center;';
      const bar = document.createElement('div');
      bar.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;';
      const button = (txt: string, fn: () => void) => {
        const b = document.createElement('button');
        b.textContent = txt;
        b.style.cssText = 'font:600 16px sans-serif;padding:12px 18px;background:#63283a;color:#f0e2ca;border:1px solid #aa7c4b;border-radius:4px;';
        b.addEventListener('click', fn);
        bar.appendChild(b);
      };
      button('Save', () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
      const file = new File([blob], name, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) button('Share', () => void navigator.share({ files: [file], title: name }).catch(() => {}));
      button('Close', () => {
        box.remove();
        URL.revokeObjectURL(url);
        this.overlay = undefined;
      });
      box.append(media, label, bar);
      document.body.appendChild(box);
      this.overlay = box;
      this.updateInfo();
    };
    if (out instanceof Blob) show(out);
    else out.toBlob((b) => b && show(b), 'image/png');
  }
}
