import Phaser from 'phaser';
import { GAME_W, PAL } from '../config';
import { CLASSES, RARITY_COLOR } from '../data/classes';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';
import { formatPower, sisterPower } from '../systems/power';
import { TIER_COLOR, tierOf } from '../systems/tiers';
import { portraitKey } from './placeholderPortrait';
import { drawPortraitBadges } from './portraitBadges';
import { nine } from './skin';
import { PAD, addArt, addBackdrop, addBadge, addIcon, text } from './theme';

type Obj = Phaser.GameObjects.GameObject;

/**
 * The Roster's Sister card, shared by every screen where you pick Sisters so
 * they all look the same: portrait with its four corner badges (rarity, Order,
 * class, level), then her name, role and Power underneath.
 */
export const CARD_COLS = 3;
export const CARD_GAP = 9;
/** Card width: three across the screen inside the usual side margins. */
export const CARD_W = (GAME_W - PAD * 2 - CARD_GAP * (CARD_COLS - 1)) / CARD_COLS;
/** Portrait height at the top of the card. */
export const CARD_PH = 128;
export const CARD_H = CARD_PH + 46;

/** Left edge and top of the i-th card in a grid that starts at `y0`. */
export function cardSlot(i: number, y0: number, left0 = PAD) {
  const left = left0 + (i % CARD_COLS) * (CARD_W + CARD_GAP);
  const top = y0 + Math.floor(i / CARD_COLS) * (CARD_H + CARD_GAP);
  return { left, top, x: left + CARD_W / 2 };
}

/** Where a grid of `n` cards starting at `y0` ends. */
export const cardGridBottom = (n: number, y0: number) => y0 + Math.ceil(n / CARD_COLS) * (CARD_H + CARD_GAP);

export interface RosterCardOpts {
  /** Show the portrait even when she is not sworn (banner choices). */
  reveal?: boolean;
  /** Greyed out: she cannot be chosen here. */
  dim?: boolean;
  /** Picked: gold border, and her rank number if given. */
  picked?: boolean;
  rank?: number;
  /** Replaces her Power at the right of the name line (e.g. "Recovering"). */
  note?: string;
  noteColor?: number;
}

/** Draw a Sister's card; returns its parts and a hit box over the whole card for taps. */
export function drawRosterCard(scene: Phaser.Scene, left: number, top: number, c: CrusaderDef, save: SaveData, opts: RosterCardOpts = {}) {
  const parts: Obj[] = [];
  const add = <T extends Obj | null | undefined>(o: T) => {
    if (o) parts.push(o);
    return o;
  };
  const cw = CARD_W;
  const ph = CARD_PH;
  const ch = CARD_H;
  const x = left + cw / 2;
  const have = save.owned[c.id];
  const show = have || opts.reveal;
  const tint = RARITY_COLOR[c.rarity];
  // ui-card.png skins the card behind each Sister (the portrait covers its top)
  if (!add(nine(scene, 'ui-card', x, top + ch / 2, cw, ch))) {
    add(scene.add.rectangle(x, top + ch / 2, cw, ch, show ? 0x1e1620 : 0x151017).setStrokeStyle(1, PAL.armorShadow));
  } else {
    // the card art's carved base sits under the name lines; a dark plate keeps them readable
    add(scene.add.rectangle(x, top + ph + (ch - ph) / 2, cw - 8, ch - ph - 2, 0x150e16, 0.9));
  }
  if (show) {
    parts.push(...addBackdrop(scene, portraitKey(c.id), x, top + ph / 2, cw, ph, { fade: 0, focusY: 0.3 }));
    add(scene.add.rectangle(x, top + ph, cw, 1, tint));
    parts.push(...drawPortraitBadges(scene, x, top + ph / 2, Math.min(cw, ph), c, save));
    add(scene.add.text(left + 8, top + ph + 5, c.name.split(' ')[0], { ...text.body(19, opts.picked ? PAL.amber : PAL.ivory), fontStyle: '600' }));
    const tier = have ? tierOf(have) : 0;
    const role = `${CLASSES[c.classId].role.toUpperCase()}${tier ? ` T${tier}` : ''}${have?.vow ? ` V${have.vow}` : ''}`;
    add(scene.add.text(left + 8, top + ph + 28, role, text.hud(12, tier ? TIER_COLOR[tier] : PAL.muted)));
    const note = opts.note ?? (have ? formatPower(sisterPower(save, c)) : '');
    if (note) add(scene.add.text(left + cw - 8, top + ph + 9, note, text.hud(14, opts.noteColor ?? PAL.amber)).setOrigin(1, 0));
    if (have?.tokens) {
      parts.push(...addBadge(scene, left + cw / 2 - 10, top + ph - 26, `+${have.tokens}`, PAL.amber, 12));
      // ui-vow.png beside the waiting-token count when present
      add(addArt(scene, 'ui-vow', left + cw / 2 - 22, top + ph - 15, 20));
    }
  } else {
    const g = add(scene.add.graphics());
    for (let r = 8; r > 0; r--) g.fillStyle(0x291c2b, 0.16).fillCircle(x, top + ph / 2, (r / 8) * 80);
    add(addIcon(scene, x, top + ph / 2, 'lock', 30, 0x967b8e));
    add(scene.add.rectangle(x, top + ph, cw, 1, PAL.armorShadow));
    add(scene.add.text(left + 8, top + ph + 5, 'Unknown', { ...text.body(19, PAL.muted), fontStyle: '600' }));
    add(scene.add.text(left + 8, top + ph + 28, 'UNSWORN', text.hud(12, PAL.steel)));
  }
  if (opts.dim) {
    // A dark veil over the whole card, under nothing: she cannot be chosen here.
    add(scene.add.rectangle(x, top + ch / 2, cw, ch, 0x09060b, 0.62));
  }
  if (opts.picked) {
    add(scene.add.rectangle(x, top + ch / 2, cw - 2, ch - 2, 0, 0).setStrokeStyle(4, PAL.amber));
    if (opts.rank) {
      add(scene.add.circle(x, top + ph / 2, 24, 0x0d090f, 0.85).setStrokeStyle(2, PAL.amber));
      add(scene.add.text(x, top + ph / 2, `${opts.rank}`, { ...text.hud(28, PAL.amber), stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5));
    }
  }
  // tap target on top of the whole card
  const hit = scene.add.rectangle(x, top + ch / 2, cw, ch, 0x000000, 0.001);
  parts.push(hit);
  return { parts, hit, x, top, left };
}
