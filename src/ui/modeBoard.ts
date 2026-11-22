import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { game } from '../state/game';
import { ROMAN_RANK, unlocked } from '../systems/rank';
import { makeButton } from './button';
import { CURRENCY_BAR_H, addCurrencyBar } from './currencyBar';
import { RITES, type RiteHome } from './rites';
import { addScrollArea } from './scroll';
import { TAB_BAR_H, addTabBar } from './tabBar';
import { PAD, addBackdrop, addFrame, addHeading, addIcon, addScreenGlow, text } from './theme';

const CARD_H = 138;
const GAP = 12;

/**
 * A board of mode cards (the Crusade tab, the Cloister): painted card per
 * entry with a line on what it is, a live status, a gold dot when something
 * waits, and the Rank it needs while locked. The board scrolls, so a new mode
 * is just a new entry in RITES.
 */
/** `resume`: a fight or run left mid-way, offered above the cards. */
export function drawBoard(scene: Phaser.Scene, home: RiteHome, title: string, sub: string, resume?: { label: string; go: () => void }) {
  addScreenGlow(scene);
  addCurrencyBar(scene);
  let top = addHeading(scene, title, CURRENCY_BAR_H + 10, sub) + 14;
  if (resume) {
    makeButton(scene, GAME_W / 2, top + 34, GAME_W - PAD * 2, 64, resume.label, resume.go, { active: true, icon: 'blade', fontSize: 20 });
    top += 82;
  }
  const save = game.save;
  const bottom = GAME_H - TAB_BAR_H;
  const list = addScrollArea(scene, top - 6, bottom, { start: scrollOf[home], onScroll: (y) => (scrollOf[home] = y) });
  const before = scene.children.list.length;
  const entries = RITES.filter((r) => r.home === home);
  const w = GAME_W - PAD * 2;
  entries.forEach((r, i) => {
    const cy = top + CARD_H / 2 + i * (CARD_H + GAP);
    const open = unlocked(save, r.rank);
    const art = r.bg && scene.textures.exists(r.bg) ? r.bg : 'bg-hall';
    const bd = addBackdrop(scene, art, GAME_W / 2, cy, w, CARD_H, { fade: 0.82, fadeColor: 0x180d17, focusY: 0.5 });
    if (!open) bd.forEach((o) => (o as unknown as Phaser.GameObjects.Components.AlphaSingle).setAlpha?.(0.3));
    addFrame(scene, GAME_W / 2, cy, w, CARD_H);
    const left = PAD + 20;
    const y0 = cy - CARD_H / 2;
    const icon = r.art && scene.textures.exists(`ui-${r.art}`) ? r.art : r.icon;
    addIcon(scene, left + 14, y0 + 30, open ? icon : 'lock', 28, open ? PAL.amber : PAL.steel);
    scene.add.text(left + 40, y0 + 14, r.label.toUpperCase(), text.display(22, open ? 0xfff1d6 : PAL.muted)).setShadow(0, 2, '#000000', 8, false, true);
    if (r.blurb) scene.add.text(left, y0 + 52, r.blurb, { ...text.body(16, open ? 0xe1cabf : PAL.muted), wordWrap: { width: w - 120 } });
    const status = open ? r.status?.(save) : `Opens at Rank ${ROMAN_RANK(r.rank)}`;
    if (status) scene.add.text(left, y0 + CARD_H - 30, status.toUpperCase(), text.hud(12, open ? PAL.amber : PAL.steel));
    if (open) scene.add.text(PAD + w - 22, cy, '›', text.display(40, PAL.amber)).setOrigin(1, 0.5);
    if (open && r.ready?.(save)) {
      if (scene.textures.exists('ui-ready-dot')) scene.add.image(PAD + w - 16, y0 + 16, 'ui-ready-dot').setDisplaySize(16, 16);
      else scene.add.circle(PAD + w - 16, y0 + 16, 7, PAL.amber).setStrokeStyle(2, 0x1b121c);
    }
    const hit = scene.add.rectangle(GAME_W / 2, cy, w, CARD_H, 0, 0.001);
    list.tap(hit, () => scene.scene.start(open ? r.scene : 'Rank', open ? (r.data ?? {}) : {}));
  });
  list.content.add(scene.children.list.slice(before));
  list.fit(top + entries.length * (CARD_H + GAP) + 6);
  addTabBar(scene, scene.scene.key);
}

/** Where each board was scrolled to, kept across visits. */
const scrollOf: Partial<Record<RiteHome, number>> = {};
