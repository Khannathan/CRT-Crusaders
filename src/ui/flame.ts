import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import type { SaveData } from '../state/save';
import { FLAME_TIERS, GRACE_PER_WEEK, flameOf, nextTier, tierOf } from '../systems/flame';
import { makeButton } from './button';
import { addFrame, text } from './theme';

/** Candle height in pixels for a flame level: grows fast at first, then slowly. */
export const candleHeight = (level: number) => Math.round(18 + 7 * Math.sqrt(Math.max(0, level)) * 2.2);

/**
 * Draws the Vigil Flame candle with its base at (x, baseY): wax that grows with
 * the level, a flickering flame in its tier's colour, and the day count.
 * Tapping it opens the details.
 */
export function drawFlame(scene: Phaser.Scene, x: number, baseY: number, save: SaveData, tappable = true): Phaser.GameObjects.GameObject[] {
  const f = flameOf(save);
  const tier = tierOf(f.level);
  const h = candleHeight(f.level);
  const w = 14 + Math.min(8, Math.floor(f.level / 8));
  const out: Phaser.GameObjects.GameObject[] = [];
  out.push(scene.add.rectangle(x, baseY, w + 12, 5, 0x6b5538).setOrigin(0.5, 1));
  out.push(scene.add.rectangle(x, baseY - 4, w, h, 0xeadfc6).setOrigin(0.5, 1).setStrokeStyle(1, 0x8b7a5e));
  // a drip
  out.push(scene.add.rectangle(x - w / 2 + 3, baseY - 4 - h, 4, Math.min(16, h / 3), 0xf6efdc).setOrigin(0.5, 0));
  const top = baseY - 4 - h;
  const glow = scene.add.circle(x, top - 10, 16, tier.color, 0.22);
  const flame = scene.add.ellipse(x, top - 9, 9, 18, tier.color);
  const core = scene.add.ellipse(x, top - 6, 4, 8, 0xfff6dc);
  out.push(glow, flame, core);
  scene.tweens.add({ targets: [flame, core], scaleY: { from: 0.85, to: 1.12 }, scaleX: { from: 1.05, to: 0.9 }, duration: 320, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  scene.tweens.add({ targets: glow, alpha: { from: 0.12, to: 0.3 }, duration: 600, yoyo: true, repeat: -1 });
  out.push(scene.add.text(x, baseY + 4, `${f.level}`, text.hud(11, PAL.amber)).setOrigin(0.5, 0));
  if (tappable) {
    const hit = scene.add.rectangle(x, baseY - h / 2 - 10, 44, h + 40, 0x000000, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => showFlame(scene, save));
    out.push(hit);
  }
  return out;
}

/** The Flame's page: what it is, its tier, grace left and the titles along the way. */
export function showFlame(scene: Phaser.Scene, save: SaveData) {
  const f = flameOf(save);
  const tier = tierOf(f.level);
  const next = nextTier(f.level);
  const layer = scene.add.container(0, 0).setDepth(40);
  layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.9).setInteractive());
  layer.add(addFrame(scene, GAME_W / 2, 470, GAME_W - 40, 720, { fill: 0x241925 }));
  layer.add(scene.add.text(GAME_W / 2, 150, 'The Vigil Flame', text.display(30, PAL.amber)).setOrigin(0.5));
  layer.add(drawFlame(scene, GAME_W / 2, 310, save, false));
  const lines = [
    `${tier.name}  ·  ${f.level} day${f.level === 1 ? '' : 's'} lit`,
    next ? `${next.at - f.level} more day${next.at - f.level === 1 ? '' : 's'} to the ${next.name}` : 'The flame burns as high as it can. Glory!',
    `Pardons this week: ${f.grace} of ${GRACE_PER_WEEK}`,
  ];
  layer.add(scene.add.text(GAME_W / 2, 350, lines.join('\n'), { ...text.body(19, PAL.ivory), align: 'center', lineSpacing: 6 }).setOrigin(0.5, 0));
  layer.add(
    scene.add
      .text(
        GAME_W / 2,
        462,
        'Each day you keep the vigil, the flame grows a step. A pardon covers a missed day; past that it dims a step. It never goes out. It grants titles, never power.',
        { ...text.body(15, PAL.steel), align: 'center', wordWrap: { width: GAME_W - 90 } },
      )
      .setOrigin(0.5, 0),
  );
  FLAME_TIERS.forEach((t, i) => {
    const y = 586 + i * 30;
    const got = f.best >= t.at;
    layer.add(scene.add.circle(80, y, 6, t.color, got ? 1 : 0.25));
    layer.add(scene.add.text(96, y, `${t.at}  ${t.name}`, { fontFamily: FONT, fontSize: '16px', color: hex(got ? PAL.ivory : PAL.steel) }).setOrigin(0, 0.5));
    layer.add(scene.add.text(GAME_W - 70, y, `"${t.title}"`, { fontFamily: FONT, fontSize: '14px', color: hex(got ? PAL.amber : PAL.steel) }).setOrigin(1, 0.5));
  });
  const close = makeButton(scene, GAME_W / 2, 792, 220, 60, 'Done', () => layer.destroy());
  layer.add(close.all);
}
