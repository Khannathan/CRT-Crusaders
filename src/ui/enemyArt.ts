import Phaser from 'phaser';
import { PAL } from '../config';
import { ENEMIES } from '../data/enemies';

export const enemyKey = (type: string) => `enemy-${type}`;

/**
 * 128x128 stand-in enemy portraits: flat stepped shapes on charcoal, one
 * silhouette per enemy type, until real enemy art exists.
 */
export function makeEnemyTextures(scene: Phaser.Scene) {
  for (const e of Object.values(ENEMIES)) {
    const key = enemyKey(e.id);
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({}, false);
    const dark = Phaser.Display.Color.ValueToColor(e.color).darken(35).color;
    g.fillStyle(PAL.bg).fillRect(0, 0, 128, 128);
    g.fillStyle(PAL.deepShadow).fillRect(4, 4, 120, 120);
    g.fillStyle(e.color);
    switch (e.shape) {
      case 'husk':
        g.fillEllipse(64, 84, 96, 70);
        g.fillStyle(dark).fillCircle(64, 46, 22);
        g.fillStyle(PAL.amber).fillRect(54, 42, 6, 4).fillRect(68, 42, 6, 4);
        break;
      case 'hood':
        g.fillTriangle(64, 14, 22, 120, 106, 120);
        g.fillStyle(PAL.bg).fillEllipse(64, 56, 30, 36);
        g.fillStyle(0x7f9bb0).fillRect(54, 52, 5, 5).fillRect(69, 52, 5, 5).fillRect(50, 92, 3, 22).fillRect(76, 98, 3, 16);
        break;
      case 'bell':
        g.fillRect(58, 12, 12, 16);
        g.fillTriangle(64, 22, 26, 104, 102, 104);
        g.fillStyle(dark).fillRect(20, 102, 88, 10);
        g.fillStyle(PAL.ivory).fillCircle(64, 116, 8);
        break;
      case 'hound':
        g.fillTriangle(16, 70, 100, 40, 100, 100);
        g.fillStyle(dark).fillTriangle(70, 36, 84, 14, 90, 44);
        g.fillStyle(PAL.oxblood).fillRect(20, 72, 34, 6);
        g.fillStyle(PAL.bg).fillRect(30, 62, 6, 4);
        g.fillStyle(PAL.ivory).fillRect(22, 78, 4, 6).fillRect(34, 78, 4, 6).fillRect(46, 78, 4, 6);
        break;
      case 'wisp':
        g.fillCircle(64, 52, 28).fillTriangle(40, 60, 88, 60, 64, 120);
        g.fillStyle(PAL.bg).fillRect(52, 46, 8, 10).fillRect(68, 46, 8, 10).fillRect(58, 64, 12, 6);
        g.fillStyle(PAL.bronze).fillCircle(98, 92, 10);
        break;
      case 'choir':
        g.fillRect(10, 30, 108, 94);
        g.fillStyle(dark);
        for (const [x, y] of [[34, 58], [64, 46], [94, 58], [46, 92], [82, 92]]) {
          g.fillStyle(PAL.ivory).fillEllipse(x, y, 22, 28);
          g.fillStyle(PAL.bg).fillRect(x - 6, y - 4, 4, 4).fillRect(x + 2, y - 4, 4, 4).fillEllipse(x, y + 7, 6, 8);
        }
        break;
      case 'warden':
        g.fillRect(30, 40, 68, 80);
        g.fillStyle(dark).fillCircle(64, 32, 18);
        g.fillStyle(PAL.ivory).fillRect(12, 50, 40, 60).fillStyle(dark).fillRect(28, 56, 8, 48).fillRect(16, 74, 32, 8);
        g.fillStyle(PAL.amber).fillRect(58, 28, 4, 4).fillRect(68, 28, 4, 4);
        break;
      case 'priest':
        g.fillTriangle(64, 30, 28, 122, 100, 122);
        g.fillStyle(PAL.ivory).fillCircle(64, 30, 16);
        g.fillStyle(PAL.bg).fillRect(57, 26, 4, 4).fillRect(67, 26, 4, 4);
        g.fillStyle(PAL.amber).fillRect(60, 60, 8, 34).fillRect(50, 70, 28, 8);
        break;
      case 'golem':
        g.fillRect(18, 34, 92, 86);
        g.fillStyle(dark).fillRect(40, 10, 48, 30).fillRect(10, 50, 14, 50).fillRect(104, 50, 14, 50);
        g.fillStyle(PAL.amber).fillRect(50, 20, 8, 6).fillRect(70, 20, 8, 6);
        g.fillStyle(PAL.bronze).fillRect(48, 60, 32, 40);
        g.fillStyle(PAL.ivory).fillRect(60, 66, 8, 28).fillRect(52, 74, 24, 6);
        break;
      case 'lurker':
        g.fillEllipse(64, 96, 110, 40);
        g.fillStyle(dark).fillEllipse(64, 70, 60, 40);
        g.fillStyle(0x9fd2c8).fillRect(48, 64, 6, 4).fillRect(74, 64, 6, 4);
        g.fillStyle(PAL.ivory).fillTriangle(50, 80, 56, 80, 53, 90).fillTriangle(72, 80, 78, 80, 75, 90);
        g.fillStyle(e.color).fillRect(14, 40, 6, 50).fillRect(108, 46, 6, 44);
        break;
      case 'pilgrim':
        g.fillCircle(64, 80, 44);
        g.fillStyle(dark).fillCircle(64, 30, 16);
        g.fillStyle(0xa6b06a).fillCircle(46, 76, 8).fillCircle(82, 92, 10).fillCircle(70, 62, 6);
        g.fillStyle(PAL.bg).fillRect(58, 26, 4, 4).fillRect(66, 26, 4, 4);
        break;
      case 'thief':
        g.fillTriangle(64, 20, 30, 110, 98, 110);
        g.fillStyle(PAL.bg).fillEllipse(64, 50, 26, 30);
        g.fillStyle(PAL.amber).fillRect(56, 46, 5, 4).fillRect(67, 46, 5, 4);
        g.fillStyle(PAL.ivory).fillRect(96, 70, 8, 30).fillStyle(PAL.amber).fillTriangle(100, 56, 95, 70, 105, 70);
        break;
      case 'nun':
        g.fillRect(36, 40, 56, 82);
        g.fillStyle(dark).fillRect(30, 20, 68, 36);
        g.fillStyle(PAL.ivory).fillEllipse(64, 42, 26, 26);
        g.fillStyle(0x7a8a3c).fillRect(56, 38, 5, 5).fillRect(67, 38, 5, 5).fillCircle(48, 90, 6).fillCircle(80, 104, 5);
        break;
      case 'bishop':
        g.fillTriangle(64, 40, 18, 124, 110, 124);
        g.fillStyle(PAL.ivory).fillTriangle(64, 4, 46, 40, 82, 40).fillCircle(64, 48, 14);
        g.fillStyle(PAL.bg).fillRect(57, 44, 4, 4).fillRect(67, 44, 4, 4);
        g.fillStyle(PAL.amber).fillRect(104, 20, 6, 100).fillCircle(107, 18, 9);
        break;
      case 'abbess':
        g.fillRect(14, 30, 100, 94);
        g.fillStyle(dark).fillTriangle(64, 6, 20, 70, 108, 70);
        g.fillStyle(PAL.ivory).fillEllipse(64, 52, 34, 40);
        g.fillStyle(PAL.bg).fillEllipse(56, 50, 8, 12).fillEllipse(72, 50, 8, 12).fillRect(58, 64, 12, 4);
        g.fillStyle(PAL.bronze).fillTriangle(64, 82, 44, 120, 84, 120).fillStyle(PAL.ivory).fillCircle(64, 120, 5);
        break;
    }
    g.generateTexture(key, 128, 128);
    g.destroy();
  }
}
