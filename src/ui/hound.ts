import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { HOUNDS, houndDef, type HoundDef } from '../data/hounds';
import { commit } from '../state/game';
import type { SaveData } from '../state/save';
import { HOUND_MAX, howlAt, howlParts, howlShort, houndsOf, setHound } from '../systems/hounds';
import { makeButton } from './button';
import { addScrollArea } from './scroll';
import { addFrame, text } from './theme';

/** Placeholder hound portrait: a dog's head in its coat colours, drawn once per hound. */
export function houndTexture(scene: Phaser.Scene, def: HoundDef): string {
  const key = `hound-${def.id}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  const S = 128;
  const dark = Phaser.Display.Color.IntegerToColor(def.coat).darken(30).color;
  g.fillStyle(0x150e17).fillRect(0, 0, S, S);
  g.fillStyle(Phaser.Display.Color.IntegerToColor(def.eye).darken(70).color, 0.5).fillCircle(64, 70, 58);
  // Ears, head, snout, nose, eyes.
  g.fillStyle(dark);
  g.fillTriangle(26, 20, 50, 46, 30, 66);
  g.fillTriangle(102, 20, 78, 46, 98, 66);
  g.fillStyle(def.coat);
  g.fillEllipse(64, 64, 70, 66);
  g.fillEllipse(64, 92, 40, 34);
  // A pale rim so a black coat still reads against the dark.
  g.lineStyle(2, Phaser.Display.Color.IntegerToColor(def.eye).darken(35).color, 0.8);
  g.strokeEllipse(64, 64, 70, 66);
  g.fillStyle(dark).fillEllipse(64, 98, 24, 14);
  g.fillStyle(0x0a080c).fillEllipse(64, 82, 16, 10);
  g.fillStyle(def.eye).fillCircle(49, 60, 5).fillCircle(79, 60, 5);
  g.fillStyle(0x000000).fillCircle(49, 60, 2).fillCircle(79, 60, 2);
  g.generateTexture(key, S, S);
  g.destroy();
  return key;
}

/** A framed hound portrait. */
export function houndFace(scene: Phaser.Scene, x: number, y: number, def: HoundDef, size: number, dim = false) {
  const frame = scene.add.rectangle(x, y, size + 4, size + 4, 0x000000, 0).setStrokeStyle(2, dim ? PAL.armorShadow : RARITY_COLOR[def.rarity]);
  const img = scene.add.image(x, y, houndTexture(scene, def)).setDisplaySize(size, size);
  if (dim) img.setTint(0x222222);
  return [frame, img] as const;
}

/**
 * The hound slot under a party: its face, name, level and howl. Tapping it
 * opens the chooser; `changed` runs after a pick.
 */
export function drawHoundSlot(scene: Phaser.Scene, save: SaveData, cx: number, y: number, w: number, depth: number, changed: () => void, compact = false) {
  const s = houndsOf(save);
  const def = s.active ? houndDef(s.active) : undefined;
  const lv = def ? s.owned[def.id].level : 0;
  const parts: Phaser.GameObjects.GameObject[] = [];
  const box = scene.add.rectangle(cx, y, w, compact ? 32 : 44, 0x1a1219).setStrokeStyle(1, def ? RARITY_COLOR[def.rarity] : PAL.armorShadow).setDepth(depth).setInteractive({ useHandCursor: true });
  parts.push(box);
  parts.push(scene.add.text(cx - w / 2 + 10, y, 'HOUND', text.hud(11, PAL.steel)).setOrigin(0, 0.5).setDepth(depth));
  if (def) {
    const [f, img] = houndFace(scene, cx - w / 2 + 78, y, def, compact ? 26 : 36);
    parts.push(f.setDepth(depth), img.setDepth(depth));
    if (compact) {
      parts.push(scene.add.text(cx - w / 2 + 98, y, `${def.name} Lv ${lv}  ·  ${howlShort(howlAt(def, lv))}`, text.body(14, PAL.ivory)).setOrigin(0, 0.5).setDepth(depth));
    } else {
      parts.push(scene.add.text(cx - w / 2 + 104, y - 10, `${def.name}  Lv ${lv}`, text.body(15, PAL.ivory)).setOrigin(0, 0.5).setDepth(depth));
      parts.push(scene.add.text(cx - w / 2 + 104, y + 10, `${def.howlName}: ${howlShort(howlAt(def, lv))}`, text.body(13, PAL.amber)).setOrigin(0, 0.5).setDepth(depth));
    }
  } else parts.push(scene.add.text(cx - w / 2 + 64, y, 'None. Bring a hound!', text.body(15, PAL.muted)).setOrigin(0, 0.5).setDepth(depth));
  parts.push(scene.add.text(cx + w / 2 - 10, y, 'CHANGE', text.hud(11, PAL.amber)).setOrigin(1, 0.5).setDepth(depth));
  box.on('pointerup', () => pickHound(scene, save, depth + 5, changed));
  return parts;
}

/** Overlay listing every hound owned; tap one to bring it. */
export function pickHound(scene: Phaser.Scene, save: SaveData, depth: number, changed: () => void) {
  const s = houndsOf(save);
  const layer = scene.add.container(0, 0).setDepth(depth);
  layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.96).setInteractive());
  layer.add(addFrame(scene, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 }));
  layer.add(scene.add.text(GAME_W / 2, 62, 'CHOOSE A HOUND', text.display(22, PAL.ivory)).setOrigin(0.5));
  layer.add(scene.add.text(GAME_W / 2, 92, 'One hound runs into every fight and howls every 2 seconds.', { ...text.body(15, PAL.muted), align: 'center', wordWrap: { width: GAME_W - 70 } }).setOrigin(0.5, 0));
  const owned = HOUNDS.filter((h) => s.owned[h.id]).reverse();
  const list = addScrollArea(scene, 140, GAME_H - 130, { parent: layer });
  const h = 96;
  owned.forEach((def, i) => {
    const y = 150 + i * (h + 8) + h / 2;
    const lv = s.owned[def.id].level;
    const on = s.active === def.id;
    const box = scene.add.rectangle(GAME_W / 2, y, GAME_W - 70, h, on ? 0x2e2026 : 0x1a1219).setStrokeStyle(on ? 3 : 1, on ? PAL.amber : RARITY_COLOR[def.rarity]);
    const [f, img] = houndFace(scene, 90, y, def, 72);
    const name = scene.add.text(140, y - 34, `${def.name}`, text.display(17, 0xfff1d6));
    const tag = scene.add.text(GAME_W - 50, y - 34, `${def.rarity}  Lv ${lv}/${HOUND_MAX}${on ? '  ·  WITH YOU' : ''}`, text.hud(12, on ? PAL.amber : PAL.steel)).setOrigin(1, 0);
    const howl = scene.add.text(140, y - 8, `${def.howlName}: ${howlParts(howlAt(def, lv)).join('; ')}.`, { ...text.body(14, PAL.ivory), wordWrap: { width: GAME_W - 200 } });
    list.content.add([box, f, img, name, tag, howl]);
    list.tap(box, () => {
      setHound(save, def.id);
      commit();
      layer.destroy();
      changed();
    });
  });
  list.fit(150 + owned.length * (h + 8));
  const back = makeButton(scene, GAME_W / 2, GAME_H - 62, 180, 56, 'Back', () => layer.destroy(), { fontSize: 18 });
  layer.add(back.all);
  return layer;
}
