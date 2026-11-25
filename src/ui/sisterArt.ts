import Phaser from 'phaser';
import { CRUSADERS } from '../data/crusaders';
import type { SaveData } from '../state/save';
import { boostedSSRs } from '../systems/gacha';
import { fullBodyUrl, portraitUrl } from './placeholderPortrait';
import { poseSheetUrl, posesKey, queuePoses } from './spriteAssets';

/**
 * Sister art on demand. With 500 Sisters each bringing a bust, a full body
 * and a pose sheet, loading all of it before the title would keep a phone
 * waiting. So the boot loads only the Sisters you will see first (yours, the
 * banner's and your Vigil's) and the rest stream in behind the title, a few at
 * a time. Until a Sister's art is in, her Order-and-class stand-in shows.
 */

/** Files fetched at once while streaming. */
const IN_FLIGHT = 6;

/** The Sisters whose art the boot waits for. */
export function bootSisters(save: SaveData, now = Date.now()): string[] {
  const ids = new Set<string>(Object.keys(save.owned));
  if (save.banner?.target) ids.add(save.banner.target);
  for (const c of boostedSSRs(save, now)) ids.add(c.id);
  for (const id of save.vigil?.party ?? []) ids.add(id);
  for (const id of save.lastParty ?? []) ids.add(id);
  return [...ids];
}

/** Queues her art on a scene's loader (BootScene.preload). */
export function queueSisterArt(load: Phaser.Loader.LoaderPlugin, id: string) {
  const bust = portraitUrl(id);
  if (bust) load.image(`portrait-${id}`, bust);
  const full = fullBodyUrl(id);
  if (full) load.image(`full-${id}`, full);
  queuePoses(load, id);
}

type Job = { key: string; url: string; sheet?: boolean };

const jobsFor = (id: string): Job[] => {
  const out: Job[] = [];
  const bust = portraitUrl(id);
  if (bust) out.push({ key: `portrait-${id}`, url: bust });
  const full = fullBodyUrl(id);
  if (full) out.push({ key: `full-${id}`, url: full });
  const poses = poseSheetUrl(id);
  if (poses) out.push({ key: posesKey(id), url: poses, sheet: true });
  return out;
};

const fetchImage = (url: string) =>
  new Promise<HTMLImageElement | undefined>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = url;
  });

/**
 * Loads these Sisters' art straight into the texture manager (no scene's
 * loader, so leaving a screen never cuts it off). Pixel art keeps square
 * pixels; only an old painted bust over 400px is smoothed.
 */
export async function streamSisterArt(textures: Phaser.Textures.TextureManager, ids: string[]): Promise<void> {
  const queue = ids.flatMap(jobsFor).filter((j) => !textures.exists(j.key));
  const worker = async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      if (textures.exists(j.key)) continue;
      const img = await fetchImage(j.url);
      if (!img || textures.exists(j.key)) continue;
      const tex = j.sheet ? textures.addSpriteSheet(j.key, img, { frameWidth: 128, frameHeight: 192 }) : textures.addImage(j.key, img);
      tex?.setFilter(img.width > 400 ? Phaser.Textures.FilterMode.LINEAR : Phaser.Textures.FilterMode.NEAREST);
    }
  };
  await Promise.all(Array.from({ length: IN_FLIGHT }, worker));
}

/** Every other Sister, banner and rarest first, streamed after the title is up. */
export function streamTheRest(textures: Phaser.Textures.TextureManager, save: SaveData) {
  const first = new Set(bootSisters(save));
  const rank = { UR: 0, SSR: 1, SR: 2, R: 3 } as Record<string, number>;
  const rest = CRUSADERS.filter((c) => !first.has(c.id)).sort((a, b) => (rank[a.rarity] ?? 4) - (rank[b.rarity] ?? 4));
  return streamSisterArt(textures, rest.map((c) => c.id));
}
