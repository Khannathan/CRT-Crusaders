import { sfx } from '../audio/sfx';
import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { ENEMIES } from '../data/enemies';
import type { Unit } from '../systems/combat';
import { shake } from './juice';
import { portraitKey } from './placeholderPortrait';
import { text } from './theme';

/**
 * A boss fight opens on a title card: the party's faces down the left, the
 * boss tall on the right, its name and its Blasphemy, then the card tears
 * away. Tap to skip. Calls `done` when it has gone.
 */
export function bossIntro(scene: Phaser.Scene, party: Unit[], boss: Unit, done: () => void) {
  const layer = scene.add.container(0, 0).setDepth(80);
  sfx('bossAppear');
  const dim = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.9).setInteractive();
  layer.add(dim);
  const cy = GAME_H / 2 - 40;
  // A red slash between the two sides.
  const slash = scene.add.rectangle(GAME_W / 2, cy, 18, GAME_H * 1.4, 0xa0202a).setAngle(14).setScale(1, 0);
  layer.add(slash);
  scene.tweens.add({ targets: slash, scaleY: 1, duration: 180, ease: 'Quad.out' });

  // The party, left, sliding in one by one.
  const n = party.length;
  party.forEach((u, i) => {
    const y = cy - ((n - 1) * 116) / 2 + i * 116;
    const f = scene.add.rectangle(-80, y, 104, 104, 0x110b13).setStrokeStyle(2, PAL.amber);
    const img = scene.add.image(-80, y, portraitKey(u.ref)).setDisplaySize(100, 100);
    const name = scene.add.text(-80, y + 44, u.name.toUpperCase(), { ...text.hud(12, 0xfff1d6), stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5);
    layer.add([f, img, name]);
    scene.tweens.add({ targets: [f, img, name], x: 90 + (i % 2) * 34, duration: 220, delay: 80 + i * 70, ease: 'Back.out' });
  });

  // The boss, right.
  const full = `full-enemy-${boss.ref}`;
  const bust = `enemy-${boss.ref}`;
  const key = scene.textures.exists(full) ? full : scene.textures.exists(bust) ? bust : undefined;
  if (key) {
    const img = scene.add.image(GAME_W + 160, cy + 20, key);
    if (key === full) img.setScale(2);
    else img.setDisplaySize(220, 220);
    img.setTint(0xffd0c0);
    layer.add(img);
    scene.tweens.add({ targets: img, x: GAME_W - 150, duration: 260, delay: 120, ease: 'Quad.out' });
  }
  const vs = scene.add.text(GAME_W / 2, cy, 'VS', { ...text.display(64, 0xffd75a), stroke: '#09060b', strokeThickness: 10 }).setOrigin(0.5).setScale(2.6).setAlpha(0);
  layer.add(vs);
  scene.tweens.add({ targets: vs, scale: 1, alpha: 1, duration: 200, delay: 300, ease: 'Quad.in', onComplete: () => shake(scene, 'boss') });

  const def = ENEMIES[boss.ref];
  const name = scene.add.text(GAME_W / 2, GAME_H - 250, boss.name.toUpperCase(), { ...text.display(34, 0xff8a7a), stroke: '#000000', strokeThickness: 6, align: 'center', wordWrap: { width: GAME_W - 40 } }).setOrigin(0.5).setAlpha(0);
  layer.add(name);
  const sub = def?.blasphemy ? `BLASPHEMY: ${def.blasphemy.name.toUpperCase()}` : 'IT HUNGERS';
  const subT = scene.add.text(GAME_W / 2, GAME_H - 204, sub, { ...text.hud(15, PAL.amber), stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setAlpha(0);
  layer.add(subT);
  const hint = scene.add.text(GAME_W / 2, GAME_H - 170, 'Watch the ground. When it burns red, drag your Sisters clear!', { ...text.body(15, PAL.steel), align: 'center', wordWrap: { width: GAME_W - 60 } }).setOrigin(0.5, 0).setAlpha(0);
  layer.add(hint);
  scene.tweens.add({ targets: [name, subT, hint], alpha: 1, duration: 220, delay: 520 });

  let gone = false;
  const leave = () => {
    if (gone) return;
    gone = true;
    scene.tweens.add({ targets: layer, alpha: 0, duration: 220, onComplete: () => layer.destroy() });
    done();
  };
  dim.on('pointerup', leave);
  scene.time.delayedCall(2200, leave);
}

/**
 * The battle report after a win: every Sister's share of the damage as a bar,
 * the one who did most crowned. Tap (or wait) to go on.
 */
export function battleReport(scene: Phaser.Scene, party: Unit[], dealt: Map<string, number>, done: () => void) {
  const layer = scene.add.container(0, 0).setDepth(80);
  const dim = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.82).setInteractive();
  layer.add(dim);
  const rows = [...party].sort((a, b) => (dealt.get(b.uid) ?? 0) - (dealt.get(a.uid) ?? 0));
  const top = Math.max(1, dealt.get(rows[0]?.uid ?? '') ?? 0);
  const total = Math.max(1, rows.reduce((s, u) => s + (dealt.get(u.uid) ?? 0), 0));
  const y0 = GAME_H / 2 - rows.length * 48 - 30;
  layer.add(scene.add.text(GAME_W / 2, y0 - 40, 'BATTLE REPORT', text.display(30, 0xffd75a)).setOrigin(0.5));
  rows.forEach((u, i) => {
    const y = y0 + 30 + i * 96;
    const d = dealt.get(u.uid) ?? 0;
    const mvp = i === 0 && d > 0;
    layer.add(scene.add.rectangle(64, y, 84, 84, 0x110b13).setStrokeStyle(mvp ? 3 : 2, mvp ? 0xffd75a : PAL.bronze));
    const img = scene.add.image(64, y, portraitKey(u.ref)).setDisplaySize(80, 80);
    if (u.hp <= 0) img.setTint(0x555555);
    layer.add(img);
    layer.add(scene.add.text(118, y - 34, `${u.name.toUpperCase()}${mvp ? '  ·  MOST ZEALOUS' : u.hp <= 0 ? '  ·  FALLEN' : ''}`, text.hud(13, mvp ? 0xffd75a : 0xfff1d6)));
    const bw = GAME_W - 118 - 24;
    layer.add(scene.add.rectangle(118, y + 2, bw, 18, 0x1a0f12).setOrigin(0, 0.5).setStrokeStyle(1, 0x6b4a2a));
    const bar = scene.add.rectangle(120, y + 2, 0, 14, mvp ? 0xffd75a : 0xd9883a).setOrigin(0, 0.5);
    layer.add(bar);
    scene.tweens.add({ targets: bar, width: ((bw - 4) * d) / top, duration: 500, delay: 150 + i * 120, ease: 'Quad.out' });
    layer.add(scene.add.text(118, y + 18, `${d.toLocaleString('en-US')} damage  ·  ${Math.round((d / total) * 100)}%`, text.body(14, PAL.muted)));
  });
  layer.add(scene.add.text(GAME_W / 2, GAME_H - 110, 'Tap to go on', text.body(16, PAL.steel)).setOrigin(0.5));
  let gone = false;
  const leave = () => {
    if (gone) return;
    gone = true;
    layer.destroy();
    done();
  };
  dim.on('pointerup', leave);
  scene.time.delayedCall(4200, leave);
}
