import Phaser from 'phaser';
import { settings } from '../state/settings';
import { CrtPipeline } from './CrtPipeline';

/** Registers the CRT post effect and applies it to every scene as it starts. */
export function installCrt(game: Phaser.Game) {
  const renderer = game.renderer;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return; // canvas fallback: no shader
  renderer.pipelines.addPostPipeline(CrtPipeline.KEY, CrtPipeline);
  for (const scene of game.scene.scenes) {
    scene.events.on(Phaser.Scenes.Events.CREATE, () => applyCrt(scene));
  }
}

/** Adds, updates or removes the effect on a scene's main camera to match settings. */
export function applyCrt(scene: Phaser.Scene) {
  const cam = scene.cameras?.main;
  if (!cam || !(scene.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
  if (!settings.crt) {
    cam.removePostPipeline(CrtPipeline.KEY);
    return;
  }
  let p = cam.getPostPipeline(CrtPipeline.KEY) as CrtPipeline | CrtPipeline[] | undefined;
  if (!p || (Array.isArray(p) && !p.length)) {
    cam.setPostPipeline(CrtPipeline.KEY);
    p = cam.getPostPipeline(CrtPipeline.KEY) as CrtPipeline | CrtPipeline[];
  }
  for (const pipe of Array.isArray(p) ? p : [p]) pipe.strength = settings.crtStrength;
}
