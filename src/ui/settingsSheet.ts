import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { applyCrt } from '../fx/crt';
import { commit, game, resetGame } from '../state/game';
import { current } from '../state/run';
import { saveSettings, settings } from '../state/settings';
import { music } from '../audio/music';
import { makeButton } from './button';
import { toggleFullscreen } from './fullscreen';
import { showExport, showImport } from './saveTransfer';
import { addFrame, text } from './theme';

/** Settings and the save tools (moved from the Sanctum page to the crest sheet, 2026-11-23). */

export function confirmReset(scene: Phaser.Scene) {
  const layer = scene.add.container(0, 0).setDepth(20);
  const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
  layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.9).setInteractive());
  layer.add(addFrame(scene, GAME_W / 2, 480, GAME_W - 40, 440, { fill: 0x241925 }));
  layer.add(
    scene.add
      .text(GAME_W / 2, 360, 'Burn the records?\n\nEvery Sister, Seal, Tithe and\ncrusade will be forgotten.', { ...style, fontSize: '22px' })
      .setOrigin(0.5),
  );
  const yes = makeButton(scene, GAME_W / 2, 520, 300, 76, 'Burn it all', () => {
    resetGame();
    scene.scene.start('Sanctum');
  }, { active: true });
  const no = makeButton(scene, GAME_W / 2, 620, 300, 76, 'Keep my progress', () => layer.destroy());
  layer.add([...yes.all, ...no.all]);
}

export function showSettings(scene: Phaser.Scene) {
  const layer = scene.add.container(0, 0).setDepth(20);
  const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
  const draw = () => {
    layer.removeAll(true);
    layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.88).setInteractive());
    layer.add(addFrame(scene, GAME_W / 2, 470, GAME_W - 40, 800, { fill: 0x241925 }));
    layer.add(scene.add.text(GAME_W / 2, 130, 'Settings', text.display(30, PAL.amber)).setOrigin(0.5));
    layer.add(scene.add.text(GAME_W / 2, 200, 'Music', { ...style, fontSize: '22px' }).setOrigin(0.5));
    musicSlider(scene, layer, 260);
    const mute = makeButton(scene, GAME_W - 104, 260, 128, 56, settings.musicMuted ? 'Muted' : 'Mute', () => {
      music.setMuted(!settings.musicMuted);
      draw();
    }, { active: settings.musicMuted, fontSize: 19 });
    layer.add(mute.all);
    const fxBtn = makeButton(scene, GAME_W / 2, 316, 240, 44, settings.sfx ? 'Sound effects: On' : 'Sound effects: Off', () => {
      settings.sfx = !settings.sfx;
      saveSettings();
      draw();
    }, { active: settings.sfx, fontSize: 17 });
    layer.add(fxBtn.all);
    layer.add(scene.add.text(GAME_W / 2, 366, 'CRT screen effect', { ...style, fontSize: '22px' }).setOrigin(0.5));
    const toggle = (on: boolean) => () => {
      settings.crt = on;
      saveSettings();
      applyCrt(scene);
      draw();
    };
    for (const [i, on] of [true, false].entries()) {
      const b = makeButton(scene, GAME_W / 2 + (i ? 90 : -90), 420, 160, 64, on ? 'On' : 'Off', toggle(on), { active: settings.crt === on });
      layer.add(b.all);
    }
    layer.add(scene.add.text(GAME_W / 2, 510, 'Strength', { ...style, fontSize: '22px', color: hex(settings.crt ? PAL.ivory : PAL.steel) }).setOrigin(0.5));
    const levels: [string, number][] = [['Subtle', 0.35], ['Standard', 0.6], ['Heavy', 1]];
    levels.forEach(([label, v], i) => {
      const b = makeButton(
        scene,
        GAME_W / 2 + (i - 1) * 168,
        570,
        156,
        64,
        label,
        () => {
          settings.crtStrength = v;
          saveSettings();
          applyCrt(scene);
          draw();
        },
        { active: settings.crt && settings.crtStrength === v, disabled: !settings.crt, fontSize: 19 },
      );
      layer.add(b.all);
    });
    layer.add(
      scene.add
        .text(GAME_W / 2, 640, 'Scanlines, colour bleed and screen curve.', { ...style, fontSize: '16px', color: hex(PAL.steel) })
        .setOrigin(0.5),
    );
    const fs = makeButton(scene, GAME_W / 2 - 112, 702, 208, 52, scene.scale.isFullscreen ? 'Leave full screen' : 'Full screen', () => {
      toggleFullscreen(scene);
      layer.destroy();
    }, { fontSize: 18 });
    const shakeBtn = makeButton(scene, GAME_W / 2 + 112, 702, 208, 52, settings.screenShake ? 'Screen shake: On' : 'Screen shake: Off', () => {
      settings.screenShake = !settings.screenShake;
      saveSettings();
      draw();
    }, { active: settings.screenShake, fontSize: 18 });
    layer.add([...fs.all, ...shakeBtn.all]);
    const backup = makeButton(scene, GAME_W / 2 - 112, 764, 208, 52, 'Back up save', () => {
      commit();
      showExport(game.save);
    }, { fontSize: 18 });
    const restore = makeButton(scene, GAME_W / 2 + 112, 764, 208, 52, 'Restore save', () => {
      showImport((save) => {
        game.save = save;
        current.run = undefined;
        current.paused = undefined;
        current.challenge = undefined;
        commit();
        scene.scene.start('Sanctum');
      });
    }, { fontSize: 18 });
    layer.add([...backup.all, ...restore.all]);
    const close = makeButton(scene, GAME_W / 2, 834, 240, 60, 'Done', () => layer.destroy());
    layer.add(close.all);
  };
  draw();
}

/** A draggable volume bar; changes are heard straight away. */
function musicSlider(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, y: number) {
  const x0 = 56;
  const w = 300;
  const off = settings.musicMuted;
  layer.add(scene.add.rectangle(x0, y, w, 10, PAL.deepShadow).setOrigin(0, 0.5).setStrokeStyle(2, PAL.armorShadow));
  const fill = scene.add.rectangle(x0, y, 0, 10, off ? PAL.steel : PAL.amber).setOrigin(0, 0.5);
  const knob = scene.add.circle(x0, y, 14, off ? PAL.steel : PAL.ivory).setStrokeStyle(3, PAL.oxblood);
  const label = scene.add.text(x0 + w, y - 30, '', text.body(18, off ? PAL.steel : PAL.ivory)).setOrigin(1, 0.5);
  const show = () => {
    const v = settings.musicVolume;
    fill.width = w * v;
    knob.x = x0 + w * v;
    label.setText(`${Math.round(v * 100)}%`);
  };
  const set = (px: number) => {
    const v = Math.round(Phaser.Math.Clamp((px - x0) / w, 0, 1) * 20) / 20;
    if (v === settings.musicVolume && !settings.musicMuted) return;
    const wasMuted = settings.musicMuted;
    music.setVolume(v);
    if (wasMuted !== settings.musicMuted) {
      // unmuted by dragging: recolour
      fill.setFillStyle(PAL.amber);
      knob.setFillStyle(PAL.ivory);
      label.setColor(hex(PAL.ivory));
    }
    show();
  };
  const hit = scene.add.zone(x0 - 20, y, w + 40, 56).setOrigin(0, 0.5).setInteractive({ useHandCursor: true, draggable: true });
  hit.on('pointerdown', (p: Phaser.Input.Pointer) => set(p.x));
  hit.on('drag', (p: Phaser.Input.Pointer) => set(p.x));
  layer.add([fill, label, hit, knob]);
  show();
}
