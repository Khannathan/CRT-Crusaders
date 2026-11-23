import Phaser from 'phaser';
import { GAME_H, GAME_W, HUD_FONT, PAL, hex } from '../config';
import { sfx } from '../audio/sfx';
import { game } from '../state/game';
import type { WinCard } from '../state/run';
import type { StageReward } from '../systems/campaign';
import { CANDLES } from '../systems/candles';
import type { Battle, Unit } from '../systems/combat';
import { expOf, expToNext } from '../systems/exp';
import type { ItemId } from '../systems/items';
import { makeButton } from './button';
import { drawItemIcon } from './itemIcon';
import { ditherVignette, RIM_PARTY } from './pixelFx';
import { portraitKey } from './placeholderPortrait';
import { candleFrames } from './skin';
import { SisterSprite, fullKey } from './sisterSprite';
import { addIcon, text } from './theme';

/**
 * The Pilgrim's Road win card: PURGED!, the stage's three Candles lighting one
 * by one, the Sister who did the most with a line of her own, the spoils
 * dropping into slots, the party's EXP filling, and Onward one tap away.
 */

/** What the Most Zealous Sister says (Zealous sermon voice: short, fervent, to you). */
const LINES = [
  'The heretics are ash. Count them, Sister, and give thanks!',
  'Not one of them knelt in time. Their loss!',
  'Mark this ground. It is holy now, because we bled on it!',
  'Again! Point me at the next one!',
  'The road is cleaner for it. Walk on!',
  'Did you feel the Saints guide my hand? I did!',
  'They prayed to the wrong thing. We showed them!',
  'Light another candle. We have earned it!',
];

export interface WinCardOpts {
  win: WinCard;
  battle: Battle;
  /** Damage each Sister dealt (uid -> amount). */
  dealt: Map<string, number>;
  exp?: { exp: number; levelled: string[] };
  /** Where the buttons go. `story` means a story scene waits: one Continue button. */
  onMap: () => void;
  onAgain?: () => void;
  onOnward?: () => void;
  story?: boolean;
}

interface Loot {
  icon: (x: number, y: number) => Phaser.GameObjects.GameObject[];
  n: number;
  first?: boolean;
}

function lootOf(scene: Phaser.Scene, win: WinCard): Loot[] {
  const out: Loot[] = [];
  const coin = (name: string, n: number, first?: boolean) => n > 0 && out.push({ icon: (x, y) => [addIcon(scene, x, y, name, 40, PAL.amber)], n, first });
  const add = (r: StageReward | undefined, first: boolean) => {
    if (!r) return;
    coin('seal', r.seals, first);
    coin('gilt', r.gilt, first);
    coin('tithe', r.tithes, first);
    for (const [id, n] of Object.entries(r.items) as [ItemId, number][]) if (n > 0) out.push({ icon: (x, y) => drawItemIcon(scene, x, y, id, 52), n, first });
  };
  add(win.reward, true);
  add(win.chest, true);
  if (win.candles?.gilt) coin('gilt', win.candles.gilt);
  if (win.candles?.seals) coin('seal', win.candles.seals);
  return out;
}

export function showWinCard(scene: Phaser.Scene, o: WinCardOpts) {
  const layer = scene.add.container(0, 0).setDepth(70);
  const dy = GAME_H - 960;
  const add = <T extends Phaser.GameObjects.GameObject>(g: T) => (layer.add(g), g);
  add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.78).setInteractive());
  add(ditherVignette(scene, GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.45));

  // PURGED! slams in.
  const title = add(scene.add.text(GAME_W / 2, 70, 'PURGED!', { ...text.display(54, 0xffd75a), stroke: '#09060b', strokeThickness: 8 }).setOrigin(0.5).setScale(2.2).setAlpha(0));
  scene.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 220, ease: 'Quad.in', onComplete: () => (sfx('slam'), scene.cameras.main.shake(160, 0.006, true)) });
  add(scene.add.text(GAME_W / 2, 126, `STAGE ${o.win.stage}${o.win.name ? `  ·  ${o.win.name.toUpperCase()}` : ''}`, text.hud(16, PAL.steel)).setOrigin(0.5));

  // The three Candles.
  const frames = candleFrames(scene);
  const cy = 156;
  CANDLES.forEach((c, i) => {
    const x = GAME_W / 2 + (i - 1) * 150;
    const lit = o.win.candles?.lit[i] ?? false;
    const fresh = o.win.candles?.fresh[i] ?? false;
    let img: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    if (frames) img = add(scene.add.image(x, cy, 'ui-vigil-candle', frames - 1).setOrigin(0.5, 0));
    else img = add(scene.add.rectangle(x, cy + 60, 16, 60, 0x6a5a50).setOrigin(0.5, 0));
    add(scene.add.text(x, cy + 140, c.label, text.body(17, PAL.steel)).setOrigin(0.5, 0));
    if (!lit) return;
    scene.time.delayedCall(500 + i * 380, () => {
      if (img instanceof Phaser.GameObjects.Image) img.setFrame(0);
      else img.setFillStyle(0xffd75a);
      sfx('candle', i);
      scene.tweens.add({ targets: img, scaleX: 1.15, scaleY: 1.15, duration: 90, yoyo: true });
      if (fresh) {
        const tag = add(scene.add.text(x + 30, cy + 6, 'NEW', { fontFamily: HUD_FONT, fontSize: '14px', color: '#ffffff', backgroundColor: '#a8242c', padding: { x: 4, y: 1 } }).setOrigin(0.5));
        scene.tweens.add({ targets: tag, scale: { from: 1.6, to: 1 }, duration: 160 });
      }
    });
  });

  // The Most Zealous: whoever dealt the most.
  const party = o.battle.units.filter((u) => u.side === 'party');
  const total = [...o.dealt.values()].reduce((a, b) => a + b, 0) || 1;
  const mvp: Unit | undefined = [...party].sort((a, b) => (o.dealt.get(b.uid) ?? 0) - (o.dealt.get(a.uid) ?? 0))[0];
  const figY = 320 + Math.min(dy, 120) * 0.5;
  let lootY = figY + 60;
  if (mvp) {
    const share = Math.round(((o.dealt.get(mvp.uid) ?? 0) / total) * 100);
    add(scene.add.text(24, figY, `MOST ZEALOUS  ·  ${share}%`, { fontFamily: HUD_FONT, fontSize: '16px', color: hex(0x09060b), backgroundColor: '#c99a3a', padding: { x: 6, y: 3 } }));
    if (scene.textures.exists(fullKey(mvp.ref))) {
      const fig = new SisterSprite(scene, mvp.ref, 136, figY + 360, 2, PAL.amber, RIM_PARTY);
      layer.add(fig.root);
      fig.root.setAlpha(0);
      scene.tweens.add({ targets: fig.root, alpha: 1, duration: 260, delay: 300 });
      scene.time.delayedCall(700, () => fig.cast(PAL.amber, true));
    } else {
      add(scene.add.image(136, figY + 180, portraitKey(mvp.ref)).setDisplaySize(200, 200));
    }
    const line = LINES[Math.floor(Math.random() * LINES.length)];
    const bx = 268;
    const bw = GAME_W - bx - 18;
    const say = scene.add.text(bx + 14, figY + 40, line, { ...text.body(20, 0xf2e6c9), fontStyle: 'italic', wordWrap: { width: bw - 28 }, lineSpacing: 2 });
    const name = scene.add.text(bx + 14, figY + 14, mvp.name.split(' ')[0].toUpperCase(), text.hud(14, 0xd9b45a));
    add(scene.add.rectangle(bx, figY, bw, say.height + 60, 0x221722, 0.96).setOrigin(0, 0).setStrokeStyle(2, 0xa8742a));
    layer.add([name, say]);
    lootY = figY + say.height + 100;
  }

  // Spoils drop into slots one by one.
  const loot = lootOf(scene, o.win).slice(0, 8);
  const per = 4;
  loot.forEach((l, i) => {
    const x = 268 + 30 + (i % per) * 64;
    const y = lootY + Math.floor(i / per) * 70;
    scene.time.delayedCall(1700 + i * 140, () => {
      const box = add(scene.add.rectangle(x, y, 58, 58, 0x1a1219).setStrokeStyle(2, l.first ? 0xffd75a : 0x6b4a2a));
      const parts = l.icon(x, y);
      parts.forEach((p) => layer.add(p));
      const num = add(scene.add.text(x + 26, y + 28, l.n >= 10000 ? `${Math.floor(l.n / 1000)}K` : `${l.n}`, { fontFamily: HUD_FONT, fontSize: '14px', color: '#f2e6c9', stroke: '#09060b', strokeThickness: 4 }).setOrigin(1, 1));
      if (l.first) add(scene.add.text(x - 26, y - 34, 'FIRST', { fontFamily: HUD_FONT, fontSize: '12px', color: '#ffffff', backgroundColor: '#a8242c', padding: { x: 3, y: 0 } }));
      const all = [box, ...parts, num] as unknown as Phaser.GameObjects.Components.Transform[];
      all.forEach((p) => (p.y -= 18));
      scene.tweens.add({ targets: all, y: '+=18', duration: 160, ease: 'Bounce.out' });
      sfx('coin');
    });
  });

  // The party's EXP.
  const rowsY = GAME_H - 270;
  party.forEach((u, i) => {
    const y = rowsY + i * 40;
    const owned = game.save.owned[u.ref];
    add(scene.add.image(36, y, portraitKey(u.ref)).setDisplaySize(32, 32));
    const up = o.exp?.levelled.includes(u.ref);
    const lv = add(scene.add.text(62, y, owned ? `LV ${owned.level}` : '', text.hud(15, up ? 0xffd75a : PAL.ivory)).setOrigin(0, 0.5));
    const bx = 190;
    const bw = GAME_W - bx - 24;
    add(scene.add.rectangle(bx, y, bw, 12, 0x1a0f12).setOrigin(0, 0.5).setStrokeStyle(2, 0x6b4a2a));
    if (!owned || u.hp <= 0) {
      add(scene.add.text(bx + bw / 2, y, u.hp <= 0 ? 'FALLEN' : '', text.hud(14, PAL.steel)).setOrigin(0.5));
      return;
    }
    const need = expToNext(owned.level);
    const now = Math.min(1, expOf(owned) / need);
    const gained = Math.min(now, (o.exp?.exp ?? 0) / need);
    const from = up ? 0 : now - gained;
    const base = add(scene.add.rectangle(bx + 2, y, (bw - 4) * from, 8, 0xd9b45a).setOrigin(0, 0.5));
    const gain = add(scene.add.rectangle(bx + 2 + (bw - 4) * from, y, 0, 8, 0xfff6d0).setOrigin(0, 0.5));
    scene.tweens.add({
      targets: gain,
      width: (bw - 4) * (now - from),
      delay: 2200 + i * 120,
      duration: 500,
      onComplete: () => {
        base.width = (bw - 4) * now;
        if (up) {
          lv.setText(`LV ${owned.level} UP!`);
          sfx('levelUp');
          scene.tweens.add({ targets: lv, scale: { from: 1.4, to: 1 }, duration: 200 });
        }
      },
    });
  });

  // Onward is the big one.
  const by = GAME_H - 64;
  if (o.story) {
    layer.add(makeButton(scene, GAME_W / 2, by, 300, 60, 'Continue', o.onMap, { active: true, fontSize: 20 }).all);
  } else {
    const w3 = (GAME_W - 48) / 3.6;
    layer.add(makeButton(scene, 16 + w3 / 2, by, w3, 60, 'Again', o.onAgain ?? o.onMap, { fontSize: 18 }).all);
    layer.add(makeButton(scene, 24 + w3 * 1.5, by, w3, 60, 'Map', o.onMap, { fontSize: 18 }).all);
    const ow = GAME_W - 48 - w3 * 2 - 8;
    if (o.onOnward) layer.add(makeButton(scene, GAME_W - 16 - ow / 2, by, ow, 60, 'Onward!', o.onOnward, { active: true, fontSize: 20 }).all);
  }
  return layer;
}
