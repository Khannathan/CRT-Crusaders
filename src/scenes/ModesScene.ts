import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { game } from '../state/game';
import { current } from '../state/run';
import { drawBoard, showWeek } from '../ui/modeBoard';
import { CHAPTERS, STAGES_PER_CHAPTER, nextStage, roadDone, stageDef } from '../systems/campaign';
import { stageCandles } from '../systems/candles';
import { boostLines, dayName } from '../systems/boosts';
import { roundsReady } from '../systems/rounds';
import { opened } from '../systems/rank';
import { RITES, anyReady } from '../ui/rites';
import { WINGS, WING_IDS, type WingId } from '../ui/nav';
import { makeButton } from '../ui/button';
import { CURRENCY_BAR_H, addCurrencyBar } from '../ui/currencyBar';
import { runRounds } from '../ui/roundsSheet';
import { addScrollArea } from '../ui/scroll';
import { TAB_BAR_H, addTabBar } from '../ui/tabBar';
import { settleTaps } from '../ui/modeScreen';
import { PAD, addBackdrop, addFrame, addScreenGlow, fitLine, text, textWash } from '../ui/theme';

/** A gold dot at the top-right corner of a card. */
function readyDot(scene: Phaser.Scene, x: number, y: number) {
  if (scene.textures.exists('ui-ready-dot')) return scene.add.image(x, y, 'ui-ready-dot').setDisplaySize(16, 16);
  return scene.add.circle(x, y, 7, PAL.amber).setStrokeStyle(2, 0x1b121c);
}

/** The status line of a wing's first open mode that has one. */
function wingStatus(wing: WingId) {
  const s = game.save;
  const open = RITES.filter((r) => r.home === wing && opened(s, r.scene));
  if (!open.length) {
    const first = RITES.filter((r) => r.home === wing).sort((a, b) => a.rank - b.rank)[0];
    return first ? `Opens at Rank ${first.rank}` : '';
  }
  return open.find((r) => r.status)?.status?.(s).split('  ·  ')[0] ?? `${open.length} modes`;
}

/**
 * The Crusade tab: the Pilgrim's Road on top (always the next step), today's
 * blessing, the four wings every other mode lives in, and the event strip.
 */
export class ModesScene extends Phaser.Scene {
  private static scrollY = 0;

  constructor() {
    super('Modes');
  }

  create() {
    const save = game.save;
    addScreenGlow(this);
    settleTaps(this);
    addCurrencyBar(this);
    let top = CURRENCY_BAR_H + 12;
    const w = GAME_W - PAD * 2;

    // A fight or run left mid-way comes first.
    const mid = current.run ? 'Return to the dark!' : current.paused?.challenge && current.paused.challenge === current.challenge ? 'Return to the fight!' : '';
    if (mid) {
      makeButton(this, GAME_W / 2, top + 30, w, 60, mid, () => this.scene.start(current.run ? 'Crypt' : 'Crusade'), { active: true, icon: 'blade', fontSize: 20 });
      top += 72;
    }

    const list = addScrollArea(this, top - 4, GAME_H - TAB_BAR_H, { start: ModesScene.scrollY, onScroll: (y) => (ModesScene.scrollY = y) });
    const before = this.children.list.length;

    // The Road card: the chapter's art, the next stage, Continue.
    const n = nextStage(save);
    const st = stageDef(n);
    const ch = CHAPTERS[st.chapter];
    const rh = 196;
    const ry = top + rh / 2;
    const art = this.textures.exists(`chapter-${st.chapter + 1}`) ? `chapter-${st.chapter + 1}` : this.textures.exists(`bg-${ch.crypt.id}`) ? `bg-${ch.crypt.id}` : 'bg-weeping-cloister';
    addBackdrop(this, art, GAME_W / 2, ry, w, rh, { fade: 0.35, fadeColor: 0x180d17, focusY: 0.45 });
    textWash(this, PAD, top + rh * 0.35, w, rh * 0.65);
    addFrame(this, GAME_W / 2, ry, w, rh);
    let stars = 0;
    const first = st.chapter * STAGES_PER_CHAPTER + 1;
    for (let k = first; k < first + STAGES_PER_CHAPTER; k++) stars += stageCandles(save, k).filter(Boolean).length;
    const done = roadDone(save);
    this.add.text(PAD + 18, top + rh - 98, `PILGRIM'S ROAD  ·  CHAPTER ${st.chapter + 1}`, text.hud(13, PAL.amber)).setShadow(0, 1, '#000000', 3, false, true);
    fitLine(this.add.text(PAD + 18, top + rh - 78, ch.name, text.display(26, 0xfff1d6)).setShadow(0, 2, '#000000', 8, false, true), w - 36);
    this.add.text(PAD + 18, top + rh - 34, done ? 'THE ROAD IS WALKED' : `CANDLES ${stars} / ${STAGES_PER_CHAPTER * 3}  ·  NEXT ${st.label}`, text.hud(13, PAL.steel)).setShadow(0, 1, '#000000', 3, false, true);
    const go = makeButton(this, PAD + w - 84, top + rh - 34, 148, 48, done ? 'The Road' : 'Continue', () => this.scene.start('Campaign'), { active: !done, fontSize: 19, icon: 'blade' });
    const roadHit = this.add.rectangle(GAME_W / 2, ry, w, rh, 0, 0.001);
    list.tap(roadHit, () => this.scene.start('Campaign'));
    this.children.bringToTop(go.box);
    top += rh + 12;

    // Today's blessing: tap for the whole week.
    makeButton(this, GAME_W / 2, top + 24, w, 48, `${dayName().toUpperCase()}: ${boostLines().join(' · ')}`, () => showWeek(this), { fontSize: 14, icon: 'flame' });
    top += 60;

    // The four wings, two by two.
    const gap = 10;
    const tw = (w - gap) / 2;
    // tiles grow on tall screens, so the hub fills the phone
    const th = Math.round(Math.max(172, Math.min(240, (GAME_H - TAB_BAR_H - 40 - top - 96 - gap) / 2)));
    WING_IDS.forEach((id, i) => {
      const wing = WINGS[id];
      const x = PAD + tw / 2 + (i % 2) * (tw + gap);
      const y = top + th / 2 + Math.floor(i / 2) * (th + gap);
      const key = this.textures.exists(wing.art) ? wing.art : this.textures.exists(wing.bg) ? wing.bg : 'bg-hall';
      addBackdrop(this, key, x, y, tw, th, { fade: 0.3, fadeColor: 0x180d17, focusY: 0.45 });
      textWash(this, x - tw / 2, y - th * 0.1, tw, th * 0.6);
      addFrame(this, x, y, tw, th);
      const l = x - tw / 2 + 14;
      fitLine(this.add.text(l, y + th / 2 - 82, wing.title, text.display(19, 0xfff1d6)).setShadow(0, 2, '#000000', 6, false, true), tw - 24);
      this.add.text(l, y + th / 2 - 54, wing.why, { ...text.body(15, 0xe1cabf), wordWrap: { width: tw - 24 } }).setShadow(0, 1, '#000000', 4, false, true);
      fitLine(this.add.text(l, y + th / 2 - 26, wingStatus(id).toUpperCase(), text.hud(11, PAL.amber)).setShadow(0, 1, '#000000', 3, false, true), tw - 24);
      if (anyReady(save, id)) readyDot(this, x + tw / 2 - 14, y - th / 2 + 14);
      const hit = this.add.rectangle(x, y, tw, th, 0, 0.001);
      list.tap(hit, () => this.scene.start(wing.scene, {}));
    });
    top += th * 2 + gap + 12;

    // The event strip: the Feast beside the Limited Saint.
    const feast = RITES.find((r) => r.home === 'event');
    if (feast) {
      const eh = 84;
      const ey = top + eh / 2;
      addBackdrop(this, this.textures.exists('bg-candle-maze') ? 'bg-candle-maze' : 'bg-altar', GAME_W / 2, ey, w, eh, { fade: 0.55, fadeColor: 0x180d17, focusY: 0.5 });
      textWash(this, PAD, top, w * 0.8, eh);
      this.add.rectangle(GAME_W / 2, ey, w, eh).setStrokeStyle(2, PAL.oxblood);
      this.add.text(PAD + 16, top + 10, 'LIMITED EVENT', text.hud(11, 0xe0607a));
      this.add.text(PAD + 16, top + 24, feast.status?.(save).split('  ·  ')[0] ?? 'The Feast', { ...text.body(21, 0xfff1d6), fontStyle: '700' }).setShadow(0, 2, '#000000', 6, false, true);
      this.add.text(PAD + 16, top + eh - 10, (feast.status?.(save).split('  ·  ').slice(1).join('  ·  ') ?? '').toUpperCase(), text.hud(11, PAL.steel)).setOrigin(0, 1);
      if (feast.ready?.(save)) readyDot(this, PAD + w - 14, top + 14);
      this.add.text(PAD + w - 20, ey, '›', text.display(36, PAL.amber)).setOrigin(1, 0.5);
      const hit = this.add.rectangle(GAME_W / 2, ey, w, eh, 0, 0.001);
      list.tap(hit, () => this.scene.start(feast.scene, feast.data ?? {}));
      top += eh + 12;
    }

    list.content.add(this.children.list.slice(before));
    list.fit(top);
    addTabBar(this, 'Modes');
  }
}

/** One page per wing: its modes as cards, Back to the hub. The Labors page sweeps the day's chores. */
function wingScene(id: WingId) {
  return class extends Phaser.Scene {
    constructor() {
      super(WINGS[id].scene);
    }
    create() {
      settleTaps(this);
      const sweep = id === 'labors' && roundsReady(game.save) ? { label: 'Sweep all', go: () => runRounds(this), icon: 'flame' } : undefined;
      drawBoard(this, id, WINGS[id].title, WINGS[id].line, sweep);
    }
  };
}
export const WingLaborsScene = wingScene('labors');
export const WingCryptsScene = wingScene('crypts');
export const WingContestScene = wingScene('contest');
export const WingAbyssScene = wingScene('abyss');

/** The old Altar board: the Altar tab now opens the banner itself. */
export class AltarScene extends Phaser.Scene {
  constructor() {
    super('Altar');
  }
  create() {
    this.scene.start('Recruit');
  }
}

/** The old Cloister tab: its screens now live under Sisters, the Market and the lobby. */
export class CloisterScene extends Phaser.Scene {
  constructor() {
    super('Cloister');
  }
  create() {
    this.scene.start('Roster');
  }
}
