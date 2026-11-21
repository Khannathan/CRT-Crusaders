import Phaser from 'phaser';
import { PAL } from '../config';
import type { IntentKind } from '../systems/combat';
import type { NodeKind } from '../systems/crusade';

/**
 * Intent icons above enemies. Each is a stand-in: drop a PNG with the same name
 * (for example icon-attack.png) into src/assets/ui/ and it replaces the drawing.
 */
export const intentIconKey = (kind: IntentKind) => `icon-${kind}`;
/** Crypt map nodes, 48 x 48: node-fight.png, node-elite.png and so on. */
export const nodeIconKey = (kind: NodeKind) => `node-${kind}`;

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
  // buff: a cross of light
  draw('buff', (g) => {
    g.fillStyle(0x9fd27a).fillRect(9, 2, 6, 20).fillRect(2, 9, 20, 6);
    g.fillStyle(PAL.ivory).fillRect(11, 4, 2, 16);
  });
  // charge: a building flame
  draw('charge', (g) => {
    g.fillStyle(PAL.oxblood).fillTriangle(12, 0, 3, 22, 21, 22);
    g.fillStyle(PAL.amber).fillTriangle(12, 7, 7, 22, 17, 22);
    g.fillStyle(PAL.ivory).fillRect(11, 16, 2, 6);
  });
}

/** Stand-in map node icons (48 x 48). Replace with src/assets/ui/node-<kind>.png. */
export function makeNodeTextures(scene: Phaser.Scene) {
  const N = 48;
  const node = (kind: NodeKind, ring: number, paint: (g: Phaser.GameObjects.Graphics) => void) => {
    const key = nodeIconKey(kind);
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({}, false);
    g.fillStyle(ring).fillCircle(24, 24, 23);
    g.fillStyle(PAL.deepShadow).fillCircle(24, 24, 19);
    paint(g);
    g.generateTexture(key, N, N);
    g.destroy();
  };
  node('fight', PAL.steel, (g) => {
    g.fillStyle(PAL.ivory).fillTriangle(24, 8, 20, 14, 28, 14).fillRect(21, 14, 6, 16);
    g.fillStyle(PAL.bronze).fillRect(15, 29, 18, 4).fillRect(22, 33, 4, 6);
  });
  node('elite', PAL.oxblood, (g) => {
    g.fillStyle(0xd65f5f).fillTriangle(24, 8, 14, 22, 34, 22).fillTriangle(24, 40, 14, 26, 34, 26);
    g.fillStyle(PAL.ivory).fillCircle(24, 24, 4);
  });
  node('event', PAL.violet, (g) => {
    g.fillStyle(PAL.ivory).fillRect(19, 11, 10, 4).fillRect(27, 13, 4, 10).fillRect(21, 21, 8, 4).fillRect(21, 23, 4, 6).fillRect(21, 32, 4, 4);
  });
  node('shrine', 0x7a9a5a, (g) => {
    g.fillStyle(PAL.ivory).fillRect(22, 18, 4, 18);
    g.fillStyle(PAL.amber).fillTriangle(24, 8, 20, 18, 28, 18);
    g.fillStyle(PAL.bronze).fillRect(16, 36, 16, 4);
  });
  node('reliquary', PAL.amber, (g) => {
    g.fillStyle(PAL.bronze).fillRect(13, 18, 22, 16);
    g.fillStyle(PAL.amber).fillRect(13, 14, 22, 6).fillRect(22, 22, 4, 6);
  });
  node('boss', PAL.oxblood, (g) => {
    g.fillStyle(PAL.ivory).fillCircle(24, 22, 11).fillRect(17, 28, 14, 8);
    g.fillStyle(PAL.bg).fillCircle(20, 21, 3).fillCircle(28, 21, 3).fillRect(20, 31, 2, 4).fillRect(23, 31, 2, 4).fillRect(26, 31, 2, 4);
  });
}
