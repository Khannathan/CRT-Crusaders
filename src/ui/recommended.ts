import Phaser from 'phaser';
import { PAL } from '../config';
import { formatPower, powerVerdict, type PowerVerdict } from '../systems/power';
import { text } from './theme';

export const VERDICT_COLOR: Record<PowerVerdict, number> = { ready: PAL.health, close: 0xe5a86a, danger: 0xe58a8a };

/**
 * "RECOMMENDED 5,100  YOURS 5,600" on one line: the recommendation in muted
 * text, your power coloured green (ready), orange (close) or red (danger).
 */
export function drawRecommended(scene: Phaser.Scene, x: number, y: number, rec: number, mine: number, opts: { align?: 'left' | 'right'; size?: number; label?: string } = {}) {
  const size = opts.size ?? 12;
  const a = scene.add.text(0, y, `RECOMMENDED ${formatPower(rec)}`, text.hud(size, PAL.muted));
  const b = scene.add.text(0, y, `${opts.label ?? 'YOURS'} ${formatPower(mine)}`, text.hud(size, VERDICT_COLOR[powerVerdict(mine, rec)]));
  const gap = size;
  if (opts.align === 'right') {
    b.setOrigin(1, 0).setX(x);
    a.setOrigin(1, 0).setX(x - b.width - gap);
  } else {
    a.setX(x);
    b.setX(x + a.width + gap);
  }
  return [a, b];
}
