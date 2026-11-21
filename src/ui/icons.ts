import Phaser from 'phaser';
import { PAL } from '../config';
import type { IntentKind } from '../systems/combat';

/**
 * Intent icons above enemies. Each is a stand-in: drop a PNG with the same name
 * (for example icon-attack.png) into src/assets/ui/ and it replaces the drawing.
 */
export const intentIconKey = (kind: IntentKind) => `icon-${kind}`;

const S = 24;

export function makeIconTextures(scene: Phaser.Scene) {
  const draw = (kind: IntentKind, paint: (g: Phaser.GameObjects.Graphics) => void) => {
    const key = intentIconKey(kind);
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({}, false);
    paint(g);
    g.generateTexture(key, S, S);
    g.destroy();
  };
  // attack: a blade, point up
  draw('attack', (g) => {
    g.fillStyle(PAL.ivory).fillTriangle(12, 1, 8, 7, 16, 7).fillRect(9, 7, 6, 10);
    g.fillStyle(PAL.bronze).fillRect(4, 16, 16, 3).fillRect(10, 19, 4, 4);
  });
  // aoe: a ring of three blades
  draw('aoe', (g) => {
    g.fillStyle(0xd65f5f);
    g.fillTriangle(12, 0, 8, 9, 16, 9).fillTriangle(0, 22, 6, 13, 10, 20).fillTriangle(24, 22, 18, 13, 14, 20);
    g.fillStyle(PAL.ivory).fillCircle(12, 15, 3);
  });
  // debuff: a dripping drop
  draw('debuff', (g) => {
    g.fillStyle(PAL.violet).fillTriangle(12, 1, 5, 14, 19, 14).fillCircle(12, 15, 7);
    g.fillStyle(PAL.bg).fillCircle(10, 15, 2);
  });
  // summon: a rising hand
  draw('summon', (g) => {
    g.fillStyle(0x7f9bb0).fillRect(6, 10, 12, 10).fillRect(6, 3, 2, 8).fillRect(9, 1, 2, 9).fillRect(12, 1, 2, 9).fillRect(15, 3, 2, 8);
    g.fillStyle(0x4f6170).fillRect(2, 20, 20, 3);
  });
  // charge: a building flame
  draw('charge', (g) => {
    g.fillStyle(PAL.oxblood).fillTriangle(12, 0, 3, 22, 21, 22);
    g.fillStyle(PAL.amber).fillTriangle(12, 7, 7, 22, 17, 22);
    g.fillStyle(PAL.ivory).fillRect(11, 16, 2, 6);
  });
}
