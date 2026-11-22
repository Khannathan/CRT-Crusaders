import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { CLASSES, RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { ORDERS } from '../data/orders';
import { game } from '../state/game';
import { MAX_VOW } from '../systems/gacha';
import { formatPower, powerOf, sisterPower } from '../systems/power';
import { levelCap, sisterStats, statsFor } from '../systems/stats';
import { makeButton } from './button';
import { sigilKey } from './icons';
import { portraitKey } from './placeholderPortrait';
import { addFrame, text } from './theme';

/** How long a press must last to count as a hold. */
export const HOLD_MS = 420;

let heldAt = -Infinity;

/** True just after a hold opened a card, so the release does not also count as a tap. */
export const justHeld = () => performance.now() - heldAt < 800;

/** The small Order sigil for a Sister's card corner (null if the Order is unknown). */
export function addOrderSigil(scene: Phaser.Scene, x: number, y: number, orderName: string, size = 24) {
  const o = ORDERS[orderName];
  if (!o || !scene.textures.exists(sigilKey(o.id))) return null;
  return scene.add.image(x, y, sigilKey(o.id)).setDisplaySize(size, size);
}

/**
 * Hold `obj` (a Sister's portrait) to open her card. A tap still does whatever
 * else the portrait does; a hold opens the card instead (check `justHeld()` in
 * tap handlers that are not wired through the scroll list).
 */
export function holdForCard<T extends Phaser.GameObjects.GameObject>(scene: Phaser.Scene, obj: T, id: string): T {
  if (!obj.input) (obj as unknown as Phaser.GameObjects.Image).setInteractive({ useHandCursor: true });
  // Real time, not the scene clock: a slow frame must not stretch the hold.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sx = 0;
  let sy = 0;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  obj.on('pointerdown', (p: Phaser.Input.Pointer) => {
    cancel();
    sx = p.x;
    sy = p.y;
    timer = setTimeout(() => {
      timer = undefined;
      if (!obj.active || !scene.sys.isActive()) return;
      heldAt = performance.now();
      showSisterCard(scene, id);
    }, HOLD_MS);
  });
  const onMove = (p: Phaser.Input.Pointer) => {
    if (timer && Math.hypot(p.x - sx, p.y - sy) > 10) cancel();
  };
  scene.input.on('pointermove', onMove);
  scene.input.on('pointerup', cancel);
  obj.once('destroy', () => {
    cancel();
    scene.input.off('pointermove', onMove);
    scene.input.off('pointerup', cancel);
  });
  return obj;
}

/** A Sister's stat card over the screen: who she is, her Order, Power and stats. */
export function showSisterCard(scene: Phaser.Scene, id: string, opts: { roster?: boolean } = {}) {
  const c = CRUSADERS.find((x) => x.id === id);
  if (!c) return;
  const save = game.save;
  const own = save.owned[id];
  const layer = scene.add.container(0, 0).setDepth(85);
  const close = () => layer.destroy();
  // The release of the hold that opened it lands here too: only a fresh tap closes.
  let armed = false;
  const bg = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.86).setInteractive();
  bg.on('pointerdown', () => (armed = true));
  bg.on('pointerup', () => armed && close());
  layer.add(bg);

  const w = GAME_W - 48;
  const h = 600;
  const top = GAME_H / 2 - h / 2;
  const left = GAME_W / 2 - w / 2 + 22;
  layer.add(addFrame(scene, GAME_W / 2, GAME_H / 2, w, h, { fill: 0x241925 }));
  layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, w, h, 0, 0.001).setInteractive());

  // Portrait and who she is
  const ps = 168;
  const px = left + ps / 2;
  const py = top + 24 + ps / 2;
  layer.add(scene.add.rectangle(px, py, ps + 6, ps + 6, 0x150e17).setStrokeStyle(2, RARITY_COLOR[c.rarity]));
  layer.add(scene.add.image(px, py, portraitKey(c.id)).setDisplaySize(ps, ps));
  layer.add(scene.add.text(px - ps / 2 + 6, py - ps / 2 + 4, c.rarity, { ...text.hud(16, RARITY_COLOR[c.rarity]), stroke: '#000000', strokeThickness: 4 }));
  const rx = left + ps + 20;
  const rw = w - ps - 64;
  const cls = CLASSES[c.classId];
  const name = scene.add.text(rx, top + 26, c.name, { ...text.display(21, 0xfff1d6), wordWrap: { width: rw } });
  layer.add(name);
  let y = name.y + name.height + 4;
  const title = c.title && c.title !== cls?.name ? `${c.title}\n` : '';
  const sub = scene.add.text(rx, y, `${title}${cls ? `${cls.name} · ${cls.role}` : ''}`, {
    ...text.body(15, PAL.muted),
    wordWrap: { width: rw },
  });
  layer.add(sub);
  y = sub.y + sub.height + 10;
  const sigil = addOrderSigil(scene, rx + 14, y + 14, c.order, 28);
  if (sigil) layer.add(sigil);
  layer.add(scene.add.text(rx + (sigil ? 34 : 0), y + 14, c.order, { ...text.body(17, ORDERS[c.order]?.accent ?? PAL.ivory), fontStyle: '600' }).setOrigin(0, 0.5));
  y += 40;
  // Not yet sworn: show her as she would arrive, at level 1.
  const stats = own ? sisterStats(save, c) : statsFor(c, { level: 1, vow: 0 });
  const power = own ? sisterPower(save, c) : powerOf(c, stats, 0);
  layer.add(scene.add.text(rx, y, own ? 'POWER' : 'POWER AT LEVEL 1', text.hud(12, PAL.steel)));
  layer.add(scene.add.text(rx, y + 16, formatPower(power), text.display(26, PAL.amber)));

  // Level, Vows, Ascension
  y = top + 24 + ps + 22;
  const facts = own
    ? `Level ${own.level} / ${levelCap(own)}    Vows ${own.vow} / ${MAX_VOW}${own.tokens ? ` (+${own.tokens} waiting)` : ''}${own.asc ? `    Ascension ${own.asc}` : ''}`
    : 'Not yet sworn to you.';
  layer.add(scene.add.text(left, y, facts, text.body(16, PAL.ivory)));
  if (own?.recovering) layer.add(scene.add.text(left, y + 24, `Wounded: sits out ${own.recovering} more crusade${own.recovering > 1 ? 's' : ''}`, text.body(15, 0xe58a8a)));

  // Stats
  y += own?.recovering ? 58 : 38;
  {
    const s = stats;
    const rows: [string, string][] = [
      ['HP', Math.round(s.hp).toLocaleString('en-US')],
      ['Attack', Math.round(s.atk).toLocaleString('en-US')],
      ['Armor', String(Math.round(s.armor))],
      ['Speed', String(Math.round(s.spd))],
      ['Crit', `${Math.round(s.crit * 100)}%`],
    ];
    const colW = (w - 44) / 5;
    rows.forEach(([label, v], i) => {
      const cx = left + colW * i + colW / 2;
      layer.add(scene.add.rectangle(cx, y + 26, colW - 8, 58, 0x1b131d).setStrokeStyle(1, PAL.armorShadow));
      layer.add(scene.add.text(cx, y + 12, label.toUpperCase(), text.hud(11, PAL.steel)).setOrigin(0.5));
      layer.add(scene.add.text(cx, y + 34, v, text.hud(17, PAL.ivory)).setOrigin(0.5));
    });
    y += 74;
  }

  // Passive and class
  if (c.passive) {
    layer.add(scene.add.text(left, y, `PASSIVE · ${c.passive.name.toUpperCase()}`, text.hud(12, PAL.amber)));
    const d = scene.add.text(left, y + 20, c.passive.desc, { ...text.body(16, PAL.ivory), wordWrap: { width: w - 44 } });
    layer.add(d);
    y = d.y + d.height + 14;
  }
  if (cls) {
    layer.add(scene.add.text(left, y, cls.role.toUpperCase(), text.hud(12, PAL.amber)));
    const d = scene.add.text(left, y + 20, cls.summary, { ...text.body(16, PAL.muted), wordWrap: { width: w - 44 } });
    layer.add(d);
    y = d.y + d.height + 14;
  }
  const hook = scene.add.text(left, y, c.hook, { ...text.body(15, PAL.steel), fontStyle: 'italic', wordWrap: { width: w - 44 } });
  layer.add(hook.setCrop(0, 0, w - 44, Math.max(0, top + h - 92 - y)));

  // Buttons
  const by = top + h - 44;
  const roster = (opts.roster ?? true) && !!own && scene.scene.key !== 'Roster';
  if (roster) {
    const go = makeButton(scene, GAME_W / 2 - 104, by, 196, 50, 'Open in Roster', () => scene.scene.start('Roster', { openId: id }), { fontSize: 16 });
    layer.add(go.all);
  }
  const done = makeButton(scene, roster ? GAME_W / 2 + 104 : GAME_W / 2, by, 196, 50, 'Close', close, { fontSize: 16, active: true });
  layer.add(done.all);
  layer.add(scene.add.text(GAME_W / 2, top - 18, 'Tap outside to close', { ...text.body(13, PAL.steel) }).setOrigin(0.5));
  return layer;
}
