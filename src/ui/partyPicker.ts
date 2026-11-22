import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';
import { RARITY_ORDER } from '../systems/gacha';
import { partyPower, sisterPower } from '../systems/power';
import { addScrollArea } from './scroll';
import { makeButton } from './button';
import { portraitKey } from './placeholderPortrait';
import { drawRecommended } from './recommended';
import { addFrame, text } from './theme';

export interface PickOpts {
  title: string;
  sub: string;
  /** Pre-selected, in rank order. */
  initial: string[];
  max?: number;
  /** Only these Sisters may be chosen (others are shown dimmed with `why`). */
  allow?: (c: CrusaderDef) => boolean;
  why?: string;
  confirm: string;
  /** Recommended party power, shown against the picked party's. */
  rec?: number;
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
  const owned = CRUSADERS.filter((c) => save.owned[c.id]).sort(
    (a, b) => Number(allow(b)) - Number(allow(a)) || RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity),
  );
  const picked = opts.initial.filter((id) => owned.some((c) => c.id === id && allow(c))).slice(0, max);
  let scroll = 0;
  const suggest = opts.suggest ?? (() => owned.filter(allow).sort((a, b) => sisterPower(save, b) - sisterPower(save, a)).slice(0, max).map((c) => c.id));
  const layer = scene.add.container(0, 0).setDepth(40);
  const draw = () => {
    layer.removeAll(true);
    layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.96).setInteractive());
    layer.add(addFrame(scene, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 }));
    layer.add(scene.add.text(GAME_W / 2, 62, opts.title.toUpperCase(), text.display(22, PAL.ivory)).setOrigin(0.5));
    layer.add(scene.add.text(GAME_W / 2, 96, opts.sub, { ...text.body(16, PAL.muted), align: 'center', wordWrap: { width: GAME_W - 70 } }).setOrigin(0.5, 0));
    const cell = 112;
    const list = addScrollArea(scene, 138, GAME_H - 206, { parent: layer, start: scroll, onScroll: (y) => (scroll = y) });
    owned.forEach((c, i) => {
      const x = GAME_W / 2 + ((i % 4) - 1.5) * cell;
      const y = 200 + Math.floor(i / 4) * (cell + 18);
      const ok = allow(c);
      const at = picked.indexOf(c.id);
      const on = at >= 0;
      const frame = scene.add.rectangle(x, y, 100, 100, 0x150e17).setStrokeStyle(on ? 3 : 1, on ? PAL.amber : ok ? RARITY_COLOR[c.rarity] : PAL.armorShadow);
      const img = scene.add.image(x, y, portraitKey(c.id)).setDisplaySize(94, 94).setAlpha(!ok ? 0.2 : on ? 1 : 0.6);
      const name = scene.add.text(x, y + 60, c.name.split(' ')[0], text.body(15, on ? PAL.amber : ok ? PAL.ivory : PAL.steel)).setOrigin(0.5);
      list.content.add([frame, img, name]);
      if (on) list.content.add(scene.add.text(x - 44, y - 46, `${at + 1}`, { ...text.hud(16, PAL.amber), stroke: '#000000', strokeThickness: 4 }));
      if (!ok) return;
      list.tap(frame, () => {
        if (on) picked.splice(at, 1);
        else if (picked.length < max) picked.push(c.id);
        scene.time.delayedCall(0, draw);
      });
    });
    list.fit(200 + Math.ceil(owned.length / 4) * (cell + 18) - 40);
    if (opts.rec) {
      const parts = drawRecommended(scene, GAME_W / 2, GAME_H - 184, opts.rec, partyPower(save, picked), { size: 13, label: 'PARTY' });
      const w = parts[1].x + parts[1].width - parts[0].x;
      parts.forEach((p) => p.setX(p.x - w / 2));
      layer.add(parts);
    }
    if (opts.why) layer.add(scene.add.text(GAME_W / 2, GAME_H - 104, opts.why, text.body(14, PAL.steel)).setOrigin(0.5));
    const go = makeButton(scene, GAME_W / 2 + 166, GAME_H - 62, 160, 60, opts.confirm, () => {
      layer.destroy();
      done([...picked]);
    }, { active: picked.length > 0, disabled: !picked.length, fontSize: 18 });
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
