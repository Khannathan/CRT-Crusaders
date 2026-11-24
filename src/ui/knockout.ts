import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import { settings } from '../state/settings';
import { sfx } from '../audio/sfx';

/**
 * The knockout: a fallen Sister or foe is blasted off the field.
 *
 * 1. Freeze: the whole fight stops for a beat (clock, tweens, animations),
 *    the camera punches in on the blow and the victim flickers white and red.
 * 2. Launch: the victim rockets in a straight line toward the edge, spinning
 *    in hard 45-degree steps (pixel art never rotates smoothly), leaving a
 *    trail of chunky smoke puffs.
 * 3. Blast: where it leaves the screen a burst of light rays, rings and sparks
 *    fires back in from the edge, with a flash of the victim's colour (her
 *    Order colour, or ember for a foe) and a shake.
 *
 * Driven by the scene's update with real time, so it keeps going while the
 * freeze has everything else paused.
 */

const FREEZE_S = 0.28;
const SPEED = 1050;
const SPIN = 1440;
const BLAST_S = 0.85;

export interface KnockoutOpts {
  /** Texture (and frame) to fling: the victim's still. */
  key: string;
  frame?: string | number;
  /** Centre of the victim on screen. */
  x: number;
  y: number;
  scale: number;
  /** Mirror the art (a figure facing left). */
  flipX?: boolean;
  /** Where to fly: any direction, normalised here. */
  dir: { x: number; y: number };
  /** Colour of the blast at the edge. */
  color: number;
  depth?: number;
  done?: () => void;
}

/** How many knockouts are holding the freeze (several can land at once). */
const freezes = new WeakMap<Phaser.Scene, number>();

function freeze(scene: Phaser.Scene, on: boolean) {
  const n = (freezes.get(scene) ?? 0) + (on ? 1 : -1);
  freezes.set(scene, Math.max(0, n));
  if (on && n === 1) {
    scene.time.paused = true;
    scene.tweens.pauseAll();
    scene.anims.pauseAll();
  } else if (!on && n <= 0) {
    scene.time.paused = false;
    scene.tweens.resumeAll();
    scene.anims.resumeAll();
  }
}

/** The direction a fallen unit flies: away from the middle of the field, mostly up. */
export function launchDir(x: number, party: boolean): { x: number; y: number } {
  const side = x < GAME_W / 2 ? -1 : 1;
  const out = 0.35 + Math.random() * 0.6;
  return party ? { x: side * 1, y: -0.35 - Math.random() * 0.4 } : { x: side * out, y: -1 };
}

/** Plays a knockout; calls done once the victim has left the screen. */
export function knockout(scene: Phaser.Scene, o: KnockoutOpts) {
  const cam = scene.cameras.main;
  const depth = o.depth ?? 24;
  const len = Math.hypot(o.dir.x, o.dir.y) || 1;
  const dx = o.dir.x / len;
  const dy = o.dir.y / len;
  const img = scene.add.image(o.x, o.y, o.key, o.frame).setScale(o.scale).setFlipX(!!o.flipX).setDepth(depth);
  const puffs = scene.add.graphics().setDepth(depth - 0.5);
  const fx = scene.add.graphics().setDepth(depth + 1);
  const smoke: { x: number; y: number; t: number; r: number }[] = [];
  const zoom = { z0: cam.zoom, sx: cam.scrollX, sy: cam.scrollY };
  const reduce = !settings.screenShake;
  let t = 0;
  let phase: 'freeze' | 'fly' | 'blast' = 'freeze';
  let blast = { x: 0, y: 0, t: 0 };
  let puffAt = 0;

  freeze(scene, true);
  if (!reduce) {
    cam.setZoom(zoom.z0 * 1.12);
    cam.centerOn(Phaser.Math.Clamp(o.x, GAME_W * 0.45, GAME_W * 0.55), Phaser.Math.Clamp(o.y, GAME_H * 0.3, GAME_H * 0.7));
  }

  const end = () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, step);
    img.destroy();
    puffs.destroy();
    fx.destroy();
    o.done?.();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    if (phase === 'freeze') freeze(scene, false);
    scene.events.off(Phaser.Scenes.Events.UPDATE, step);
  });

  function step(_now: number, deltaMs: number) {
    const dt = Math.min(0.05, deltaMs / 1000);
    t += dt;
    if (phase === 'freeze') {
      // flicker white / red, judder a pixel or three
      const k = Math.floor(t / 0.05) % 2;
      if (k) img.setTint(0xff5a3c);
      else img.setTintFill(0xffffff);
      img.x = o.x + (Math.floor(t / 0.033) % 2 ? 3 : -3);
      if (t >= FREEZE_S) {
        phase = 'fly';
        t = 0;
        img.clearTint();
        freeze(scene, false);
        cam.setZoom(zoom.z0).setScroll(zoom.sx, zoom.sy);
        if (!reduce) cam.shake(140, 0.008, true);
        sfx('crit');
      }
      return;
    }
    if (phase === 'fly') {
      img.x = o.x + dx * SPEED * t;
      img.y = o.y + dy * SPEED * t;
      img.angle = Math.round((SPIN * t * (dx < 0 ? -1 : 1)) / 45) * 45;
      if (t >= puffAt) {
        puffAt = t + 0.04;
        smoke.push({ x: img.x, y: img.y, t: 0, r: Phaser.Math.Between(5, 10) });
      }
      const m = 40 * o.scale;
      if (img.x < -m || img.x > GAME_W + m || img.y < -m || img.y > GAME_H + m) {
        phase = 'blast';
        blast = { x: Phaser.Math.Clamp(img.x, 0, GAME_W), y: Phaser.Math.Clamp(img.y, 0, GAME_H), t: 0 };
        img.setVisible(false);
        if (!reduce) {
          cam.flash(110, (o.color >> 16) & 255, (o.color >> 8) & 255, o.color & 255, true);
          cam.shake(180, 0.01, true);
        }
        sfx('kill');
      }
    }
    // smoke: chunky square puffs that shrink and fade
    puffs.clear();
    for (const p of smoke) {
      p.t += dt;
      if (p.t > 0.6) continue;
      const r = Math.max(1, Math.round(p.r * (1 - p.t / 0.6)));
      const g = Math.round(200 - 120 * (p.t / 0.6));
      puffs.fillStyle((g << 16) | ((g - 10) << 8) | (g - 20), 1);
      puffs.fillRect(Math.round(p.x - r), Math.round(p.y - r), r * 2, r * 2);
    }
    if (phase === 'blast') {
      blast.t += dt;
      drawBlast(fx, blast.x, blast.y, -dx, -dy, blast.t / BLAST_S, o.color);
      if (blast.t >= BLAST_S && smoke.every((p) => p.t > 0.6)) end();
    }
  }
  scene.events.on(Phaser.Scenes.Events.UPDATE, step);
}

/** The edge burst at progress k (0..1): a fan of hard rays pointing back into the screen, two rings, sparks. */
function drawBlast(g: Phaser.GameObjects.Graphics, x: number, y: number, nx: number, ny: number, k: number, color: number) {
  g.clear();
  if (k >= 1) return;
  const hot = 0xfffae6;
  const base = Math.atan2(ny, nx);
  const reach = (60 + 420 * Math.min(1, k * 2.5)) * (1 - k * 0.6);
  for (let j = -4; j <= 4; j++) {
    const a = base + j * 0.16;
    const w = Math.round((9 - Math.abs(j)) * (1 - k) * 2.4) + 1;
    const l = reach * (1 - Math.abs(j) * 0.09);
    const x2 = x + Math.cos(a) * l;
    const y2 = y + Math.sin(a) * l;
    g.lineStyle(w + 4, color, 1).lineBetween(x, y, x2, y2);
    g.lineStyle(w, hot, 1).lineBetween(x, y, x2, y2);
  }
  const rr = 20 + 120 * k;
  const ring = Math.max(2, Math.round(8 * (1 - k)));
  g.lineStyle(ring, hot, 1).strokeCircle(x, y, rr);
  if (rr > 30) g.lineStyle(ring, color, 1).strokeCircle(x, y, rr - 26);
  // sparks: a fixed scatter (seeded by angle) flying outward
  for (let i = 0; i < 14; i++) {
    const a = base + Math.sin(i * 12.9898) * 1.2;
    const d = (30 + ((i * 37) % 230)) * Math.min(1, k * 2);
    const s = 2 + (i % 3);
    g.fillStyle(i % 2 ? hot : color, 1).fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), s, s);
  }
}
