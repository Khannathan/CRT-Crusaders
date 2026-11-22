import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { commit } from '../state/game';
import type { SaveData } from '../state/save';
import { PRESET_ICONS, PRESET_MAX, deletePreset, presetsOf, savePreset, setPresetIcon } from '../systems/presets';
import { makeButton } from './button';
import { portraitKey } from './placeholderPortrait';
import { iconDisc } from './portraitBadges';
import { addScrollArea } from './scroll';
import { addFrame, text } from './theme';

/**
 * Party presets: load a saved party, save the current one over a preset or as
 * a new one, change a preset's icon, or delete it. `load` gets the chosen ids.
 */
export function openPresets(scene: Phaser.Scene, save: SaveData, current: string[], depth: number, load: (ids: string[]) => void) {
  const layer = scene.add.container(0, 0).setDepth(depth);
  let scroll = 0;
  const draw = () => {
    layer.removeAll(true);
    const list = presetsOf(save);
    layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.96).setInteractive());
    layer.add(addFrame(scene, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 }));
    layer.add(scene.add.text(GAME_W / 2, 62, 'PARTY PRESETS', text.display(22, PAL.ivory)).setOrigin(0.5));
    layer.add(scene.add.text(GAME_W / 2, 88, `Load a saved party in one tap. A preset's icon shows on the portraits of its Sisters. Tap an icon to change it. ${list.length}/${PRESET_MAX} saved.`, { ...text.body(15, PAL.muted), align: 'center', wordWrap: { width: GAME_W - 70 } }).setOrigin(0.5, 0));
    const area = addScrollArea(scene, 150, GAME_H - 150, { parent: layer, start: scroll, onScroll: (y) => (scroll = y) });
    const rh = 118;
    if (!list.length) layer.add(scene.add.text(GAME_W / 2, 220, 'No presets yet. Pick a party, then save it here.', text.body(17, PAL.muted)).setOrigin(0.5));
    list.forEach((p, i) => {
      const y = 160 + i * (rh + 8) + rh / 2;
      area.content.add(scene.add.rectangle(GAME_W / 2, y, GAME_W - 60, rh, 0x1a1219).setStrokeStyle(1, PAL.armorShadow));
      const disc = iconDisc(scene, 76, y - 14, p.icon, 52, PAL.amber);
      area.content.add(disc);
      const hit = scene.add.circle(76, y - 14, 32, 0x000000, 0.001);
      area.content.add(hit);
      area.tap(hit, () => pickIcon(scene, depth + 5, p.icon, (icon) => {
        setPresetIcon(save, i, icon);
        commit();
        draw();
      }));
      area.content.add(scene.add.text(76, y + 30, p.name, text.hud(11, PAL.steel)).setOrigin(0.5, 0));
      p.party.forEach((id, k) => {
        const c = CRUSADERS.find((c) => c.id === id);
        if (!c) return;
        const fx = 140 + k * 56;
        area.content.add(scene.add.rectangle(fx, y - 18, 50, 50, 0x000000, 0).setStrokeStyle(1, RARITY_COLOR[c.rarity]));
        area.content.add(scene.add.image(fx, y - 18, portraitKey(id)).setDisplaySize(48, 48));
      });
      const btns = [
        makeButton(scene, 172, y + 34, 96, 36, 'Load', () => {}, { active: true, fontSize: 15 }),
        makeButton(scene, 280, y + 34, 108, 36, 'Save here', () => {}, { fontSize: 15, disabled: !current.length }),
        makeButton(scene, GAME_W - 70, y + 34, 60, 36, 'X', () => {}, { fontSize: 15 }),
      ];
      btns.forEach((b) => {
        b.box.removeAllListeners('pointerup');
        area.content.add(b.all);
      });
      area.tap(btns[0].box, () => {
        layer.destroy();
        load([...p.party]);
      });
      if (current.length) {
        area.tap(btns[1].box, () => {
          savePreset(save, current, p.icon, i);
          commit();
          draw();
        });
      }
      area.tap(btns[2].box, () => {
        deletePreset(save, i);
        commit();
        draw();
      });
    });
    area.fit(160 + list.length * (rh + 8));
    const full = list.length >= PRESET_MAX;
    const add = makeButton(scene, GAME_W / 2 + 100, GAME_H - 62, 240, 56, full ? 'Presets full' : 'Save current party', () => {
      pickIcon(scene, depth + 5, PRESET_ICONS[list.length % PRESET_ICONS.length], (icon) => {
        savePreset(save, current, icon);
        commit();
        draw();
      });
    }, { active: !full && current.length > 0, disabled: full || !current.length, fontSize: 17 });
    const back = makeButton(scene, GAME_W / 2 - 150, GAME_H - 62, 140, 56, 'Back', () => layer.destroy(), { fontSize: 17 });
    layer.add([...add.all, ...back.all]);
  };
  draw();
  return layer;
}

/** A grid of every icon a preset can wear. */
export function pickIcon(scene: Phaser.Scene, depth: number, selected: string, done: (icon: string) => void) {
  const layer = scene.add.container(0, 0).setDepth(depth);
  layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.97).setInteractive());
  layer.add(addFrame(scene, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x1f1620 }));
  layer.add(scene.add.text(GAME_W / 2, 62, 'CHOOSE AN ICON', text.display(22, PAL.ivory)).setOrigin(0.5));
  const icons = PRESET_ICONS.filter((k) => scene.textures.exists(k));
  const area = addScrollArea(scene, 96, GAME_H - 110, { parent: layer });
  const cols = 6;
  const cell = 78;
  const x0 = GAME_W / 2 - ((cols - 1) * cell) / 2;
  icons.forEach((key, i) => {
    const x = x0 + (i % cols) * cell;
    const y = 140 + Math.floor(i / cols) * cell;
    const on = key === selected;
    const box = scene.add.rectangle(x, y, cell - 8, cell - 8, on ? 0x3a2a30 : 0x150e17).setStrokeStyle(on ? 3 : 1, on ? PAL.amber : PAL.armorShadow);
    area.content.add([box, scene.add.image(x, y, key).setDisplaySize(52, 52)]);
    area.tap(box, () => {
      layer.destroy();
      done(key);
    });
  });
  area.fit(140 + Math.ceil(icons.length / cols) * cell - 20);
  const back = makeButton(scene, GAME_W / 2, GAME_H - 62, 160, 52, 'Back', () => layer.destroy(), { fontSize: 17 });
  layer.add(back.all);
  return layer;
}
