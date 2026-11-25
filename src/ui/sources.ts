import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { game } from '../state/game';
import type { Bag } from '../systems/items';
import { ROMAN_RANK, opened, rankFor } from '../systems/rank';
import { amountOf, costFocus, resourceInfo, type ResourceId } from '../systems/sources';
import { makeButton } from './button';
import { drawItemIcon } from './itemIcon';
import { addFrame, addIcon, text } from './theme';

const CURRENCY_ICON: Record<string, [string, number]> = {
  gilt: ['gilt', 0xf2d27a],
  alms: ['alms', 0xc9c2b8],
  seals: ['seal', 0xd87988],
  tithes: ['tithe', PAL.amber],
  vows: ['vow', PAL.amber],
  shards: ['seal', 0xb592c8],
  stigmata: ['flame', 0xd04a5a],
  offerings: ['flame', 0xf2d27a],
};


/**
 * "Where do I get more?": a card over the screen with the resource, how many
 * you hold, and every place it comes from, each with a Go button.
 */
export function showSources(scene: Phaser.Scene, id: ResourceId) {
  const save = game.save;
  const info = resourceInfo(id);
  const layer = scene.add.container(0, 0).setDepth(80);
  const close = () => layer.destroy();
  layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.85).setInteractive().on('pointerup', close));
  const rowH = 58;
  const w = GAME_W - 40;
  const h = 196 + info.sources.length * rowH;
  const top = GAME_H / 2 - h / 2;
  const panel = addFrame(scene, GAME_W / 2, GAME_H / 2, w, h, { fill: 0x241925 });
  layer.add(panel);
  // swallow taps on the card so only the backdrop closes it
  layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, w, h, 0, 0.001).setInteractive());
  const left = 20 + 22;
  if (id in CURRENCY_ICON) {
    const [icon, tint] = CURRENCY_ICON[id];
    layer.add(addIcon(scene, left + 24, top + 44, icon, 44, tint));
  } else {
    layer.add(drawItemIcon(scene, left + 24, top + 44, id as never, 52));
  }
  layer.add([
    scene.add.text(left + 62, top + 22, info.name, text.display(20, 0xfff1d6)),
    scene.add.text(left + 62, top + 50, `You have ${amountOf(save, id).toLocaleString('en-US')}`, text.body(16, PAL.amber)),
    scene.add.text(left, top + 82, info.desc, { ...text.body(15, PAL.muted), wordWrap: { width: w - 44 } }).setCrop(0, 0, w - 44, 44),
    scene.add.text(left, top + 130, 'WHERE TO GET IT', text.hud(12, PAL.steel)),
  ]);
  info.sources.forEach((s, i) => {
    const y = top + 150 + i * rowH + rowH / 2;
    layer.add(scene.add.rectangle(GAME_W / 2, y, w - 32, rowH - 6, 0x1b131d).setStrokeStyle(1, PAL.armorShadow));
    layer.add(scene.add.text(left, y, s.text, { ...text.body(15, PAL.ivory), wordWrap: { width: w - 170 } }).setOrigin(0, 0.5));
    if (!s.scene) return;
    const need = rankFor(s.scene);
    const open = opened(save, s.scene);
    const here = s.scene === scene.scene.key;
    const go = makeButton(scene, GAME_W - 20 - 66, y, 96, 38, here ? 'Here' : open ? 'Go' : `Rank ${ROMAN_RANK(need)}`, () => {
      if (here) return close();
      scene.scene.start(s.scene!, s.data ?? {});
    }, { fontSize: 14, disabled: !open, active: open && !here });
    layer.add(go.all);
  });
  const done = makeButton(scene, GAME_W / 2, top + h - 30, 180, 44, 'Close', close, { fontSize: 16 });
  layer.add(done.all);
  return layer;
}

/** Makes `obj` open the sources of a resource when tapped. */
export function tapForSources<T extends Phaser.GameObjects.GameObject>(scene: Phaser.Scene, obj: T, id: ResourceId | (() => ResourceId)): T {
  (obj as unknown as Phaser.GameObjects.Image).setInteractive({ useHandCursor: true });
  obj.on('pointerup', () => showSources(scene, typeof id === 'function' ? id() : id));
  return obj;
}

/** A cost line that, tapped, explains the resource most worth explaining (the one you are short of). */
export function tapCost<T extends Phaser.GameObjects.GameObject>(scene: Phaser.Scene, obj: T, items?: Bag, tithes = 0): T {
  return tapForSources(scene, obj, () => costFocus(game.save, items, tithes));
}
