import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { CRUSADERS } from '../data/crusaders';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';
import { partyPower, sisterPower } from '../systems/power';
import { addScrollArea } from './scroll';
import { drawOrderChips } from './orderBonus';
import { drawHoundSlot } from './hound';
import { makeButton } from './button';
import { drawRecommended } from './recommended';
import { sortAndFilter, sortControls, emptyListLine } from './sisterSort';
import { holdForCard } from './sisterCard';
import { cardGridBottom, cardSlot, drawRosterCard } from './rosterCard';
import { openPresets } from './presets';
import { addFrame, text } from './theme';

export interface PickOpts {
  title: string;
  sub: string;
  /** Pre-selected, in rank order. */
  initial: string[];
  max?: number;
  /** Fewest Sisters the fight takes (Confirm waits until then). */
  min?: number;
  /** Only these Sisters may be chosen (others are shown dimmed with `why`). */
  allow?: (c: CrusaderDef) => boolean;
  why?: string;
  confirm: string;
  /** Recommended party power, shown against the picked party's. */
  rec?: number;
  /** Show the hound slot (defaults to on when `rec` is given: a fight). */
  hound?: boolean;
  /** The party Suggest picks; defaults to the strongest Sisters allowed. */
  suggest?: () => string[];
}

/**
 * Overlay to choose up to four Sisters, in the order tapped (first = rank 1).
 * The roster scrolls (drag or mouse wheel); Suggest fills the party for you.
 */
export function pickParty(scene: Phaser.Scene, save: SaveData, opts: PickOpts, done: (ids: string[]) => void) {
  const max = opts.max ?? 4;
  const allow = opts.allow ?? (() => true);
  const all = CRUSADERS.filter((c) => save.owned[c.id]);
  const picked = opts.initial.filter((id) => all.some((c) => c.id === id && allow(c))).slice(0, max);
  let scroll = 0;
  const suggest = opts.suggest ?? (() => all.filter(allow).sort((a, b) => sisterPower(save, b) - sisterPower(save, a)).slice(0, max).map((c) => c.id));
  const layer = scene.add.container(0, 0).setDepth(40);
  const draw = () => {
    layer.removeAll(true);
    layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.96).setInteractive());
    layer.add(addFrame(scene, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 }));
    layer.add(scene.add.text(GAME_W / 2, 62, opts.title.toUpperCase(), text.display(22, PAL.ivory)).setOrigin(0.5));
    // Saved parties (only where a full party fights).
    if (max > 1) {
      const pre = makeButton(scene, GAME_W - 82, 62, 104, 38, 'Presets', () => {
        openPresets(scene, save, [...picked], 45, (ids) => {
          picked.splice(0, picked.length, ...ids.filter((id) => all.some((c) => c.id === id && allow(c))).slice(0, max));
          draw();
        });
      }, { fontSize: 15 });
      layer.add(pre.all);
    }
    layer.add(scene.add.text(GAME_W / 2, 90, `${opts.sub} Hold a portrait for her stats.`, { ...text.body(15, PAL.muted), align: 'center', wordWrap: { width: GAME_W - 70 } }).setOrigin(0.5, 0));
    // The Roster's sort and filter; those who can be chosen come first, and a picked Sister is never filtered out.
    const owned = sortAndFilter(save, all, picked).sort((a, b) => Number(allow(b)) - Number(allow(a)));
    layer.add(sortControls(scene, GAME_W / 2, 152, GAME_W - 60, () => {
      scroll = 0;
      draw();
    }, { depth: 40, h: 36 }));
    if (!owned.length) layer.add(scene.add.text(GAME_W / 2, 260, emptyListLine(save), text.body(17, PAL.muted)).setOrigin(0.5));
    const list = addScrollArea(scene, 174, GAME_H - 206, { parent: layer, start: scroll, onScroll: (y) => (scroll = y) });
    // The Roster's cards, at the Roster's size.
    const y0 = 182;
    owned.forEach((c, i) => {
      const { left, top } = cardSlot(i, y0);
      const ok = allow(c);
      const at = picked.indexOf(c.id);
      const on = at >= 0;
      const card = drawRosterCard(scene, left, top, c, save, { dim: !ok, picked: on, rank: max > 1 ? at + 1 : undefined });
      list.content.add(card.parts);
      if (ok) {
        list.tap(card.hit, () => {
          if (on) picked.splice(at, 1);
          else if (picked.length < max) picked.push(c.id);
          else if (max === 1) picked.splice(0, 1, c.id);
          scene.time.delayedCall(0, draw);
        });
      }
      holdForCard(scene, card.hit, c.id);
    });
    list.fit(cardGridBottom(owned.length, y0) + 4);
    if (opts.rec) {
      const parts = drawRecommended(scene, GAME_W / 2, GAME_H - 184, opts.rec, partyPower(save, picked), { size: 13, label: 'PARTY', grow: picked });
      const last = parts[parts.length - 1];
      const w = last.x + last.width - parts[0].x;
      parts.forEach((p) => p.setX(p.x - w / 2));
      layer.add(parts);
    }
    // The hound that goes with a fighting party.
    if (opts.hound ?? !!opts.rec) layer.add(drawHoundSlot(scene, save, GAME_W / 2, GAME_H - 146, GAME_W - 70, 40, () => scene.time.delayedCall(0, draw)));
    // The Order blessings this pick turns on (tap for details), or why some are dimmed.
    const orders = picked.map((id) => all.find((c) => c.id === id)!.order);
    if (orders.length && max > 1) layer.add(drawOrderChips(scene, GAME_W / 2, GAME_H - 108, orders, 40));
    else if (opts.why) layer.add(scene.add.text(GAME_W / 2, GAME_H - 104, opts.why, text.body(14, PAL.steel)).setOrigin(0.5));
    const need = Math.max(1, opts.min ?? 1);
    const ready = picked.length >= need;
    const go = makeButton(scene, GAME_W / 2 + 166, GAME_H - 62, 160, 60, ready ? opts.confirm : `${picked.length} of ${need}`, () => {
      if (!ready) return;
      layer.destroy();
      done([...picked]);
    }, { active: ready, disabled: !ready, fontSize: 18 });
    const sug = makeButton(scene, GAME_W / 2, GAME_H - 62, 160, 60, 'Suggest', () => {
      picked.splice(0, picked.length, ...suggest());
      draw();
    }, { fontSize: 18 });
    const back = makeButton(scene, GAME_W / 2 - 166, GAME_H - 62, 160, 60, 'Back', () => layer.destroy(), { fontSize: 18 });
    layer.add([...go.all, ...sug.all, ...back.all]);
  };
  draw();
  return layer;
}
