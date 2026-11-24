import Phaser from 'phaser';
import { GAME_W, PAL } from '../config';
import { game } from '../state/game';
import type { SaveData } from '../state/save';
import { anyClaimable } from '../systems/tasks';
import { anyDeedReady } from '../systems/deeds';
import { noviceOpen, noviceReady } from '../systems/novitiate';
import { anyBondRewards, anyUnheard } from '../systems/bonds';
import { candleReady } from '../systems/offerings';
import { quickVowReady } from '../systems/quick';
import { claimable as setsClaimable } from '../systems/collection';
import { freeWhistle } from '../systems/hounds';
import { unlocked } from '../systems/rank';
import { makeButton } from './button';
import { PAD } from './theme';

/**
 * The Cathedral layout (2026-11-23): five tabs, the Crusade hub's four wings,
 * and the sub-tab strips that tie related screens together (Duties, Sisters,
 * the Altar). Every "where does this screen live" question is answered here.
 */

/** The five tabs, by the scene each opens. */
export const TAB_ROOTS = ['Sanctum', 'Roster', 'Modes', 'Recruit', 'Shop'] as const;

/** The Crusade hub's wings, by Rite home, with the scene key of each wing's page. */
export const WINGS = {
  labors: { scene: 'WingLabors', title: 'Daily Labors', why: 'Materials, gear and Godblood', line: 'Spoils renew each dawn. Take them!', art: 'wing-labors', bg: 'bg-iron-oubliette' },
  crypts: { scene: 'WingCrypts', title: 'The Crypts', why: 'Runs, relics and records', line: 'Descend. Purge. Climb without end.', art: 'wing-crypts', bg: 'bg-drowned-ossuary' },
  contest: { scene: 'WingContest', title: 'The Contest', why: 'Leagues and weekly ranks', line: 'Outshine every lesser Order.', art: 'wing-contest', bg: 'bg-red-refectory' },
  abyss: { scene: 'WingAbyss', title: 'The Abyss', why: 'Bosses for your best', line: 'Where Saints are broken. Go anyway.', art: 'wing-abyss', bg: 'bg-abyssal-ossuary' },
} as const;
export type WingId = keyof typeof WINGS;
export const WING_IDS = Object.keys(WINGS) as WingId[];
export const isWing = (home: string): home is WingId => home in WINGS;

/** One sub-tab: a scene (and its data); `match` tells two tabs on one scene apart by the screen's title. */
interface SubTab {
  label: string;
  scene: string;
  data?: object;
  match?: (title: string) => boolean;
  ready?: (save: SaveData) => boolean;
  shown?: (save: SaveData) => boolean;
}

/** Screens that share a strip of sub-tabs in place of their title. */
export const GROUPS: Record<'duties' | 'sisters' | 'altar', SubTab[]> = {
  duties: [
    { label: 'Penance', scene: 'Penance', ready: (s) => anyClaimable(s) },
    { label: 'Deeds', scene: 'Deeds', ready: (s) => anyDeedReady(s) },
    { label: 'Novitiate', scene: 'Novitiate', ready: (s) => noviceReady(s), shown: (s) => noviceOpen(s) },
  ],
  sisters: [
    { label: 'Sisters', scene: 'Roster', ready: (s) => quickVowReady(s) },
    { label: 'Bonds', scene: 'Confession', shown: (s) => unlocked(s, 5), ready: (s) => anyUnheard(s) || anyBondRewards(s) || (Object.keys(s.owned).length > 0 && candleReady(s)) },
    { label: 'Satchel', scene: 'Inventory' },
    { label: 'Relics', scene: 'Reliquary', data: { tab: 'relics' }, match: (t) => t !== 'Order Codex' },
    { label: 'Codex', scene: 'Reliquary', data: { tab: 'codex' }, match: (t) => t === 'Order Codex' },
    { label: 'Book', scene: 'OrderBook', ready: (s) => setsClaimable(s).length > 0 },
  ],
  altar: [
    { label: 'Sisters', scene: 'Recruit' },
    { label: 'Gear', scene: 'Armory', data: { back: 'Recruit' } },
    { label: 'Hounds', scene: 'Kennel', ready: (s) => freeWhistle(s) },
    { label: 'Record', scene: 'PullHistory' },
  ],
};
export type GroupId = keyof typeof GROUPS;

/** The group a scene's strip belongs to (undefined: it keeps its own title). */
export function groupOf(sceneKey: string): GroupId | undefined {
  return (Object.keys(GROUPS) as GroupId[]).find((g) => GROUPS[g].some((t) => t.scene === sceneKey));
}

/** True for a screen reached straight from a tab or a strip: it needs no Back button. */
export const isTabRoot = (sceneKey: string) => (TAB_ROOTS as readonly string[]).includes(sceneKey);
export const isRootScreen = (sceneKey: string) => isTabRoot(sceneKey) || !!groupOf(sceneKey);

/** True when a tab in the group has something to claim. */
export const groupReady = (save: SaveData, g: GroupId) => GROUPS[g].some((t) => (t.shown?.(save) ?? true) && t.ready?.(save));

export const STRIP_H = 44;

/**
 * The sub-tab strip, drawn where a screen's title would sit (from `y`). The
 * lit tab is the screen itself; a gold dot marks a tab with something to claim.
 * Returns the bottom edge, the same as a one-line heading.
 */
export function addGroupStrip(scene: Phaser.Scene, y: number, title = ''): number {
  const key = scene.scene.key;
  const g = groupOf(key);
  if (!g) return y;
  const save = game.save;
  const tabs = GROUPS[g].filter((t) => t.shown?.(save) ?? true);
  const gap = 4;
  const w = (GAME_W - PAD * 2 - gap * (tabs.length - 1)) / tabs.length;
  const cy = y + 6 + STRIP_H / 2;
  const mine = tabs.filter((t) => t.scene === key);
  const lit = mine.find((t) => t.match?.(title)) ?? mine[0];
  tabs.forEach((t, i) => {
    const x = PAD + w / 2 + i * (w + gap);
    const on = t === lit;
    const b = makeButton(scene, x, cy, w, STRIP_H, t.label, () => scene.scene.start(t.scene, t.data ?? {}), { active: on, fontSize: tabs.length > 4 ? 16 : 18, skin: 'ui-subtab' });
    if (!on && t.ready?.(save)) {
      if (scene.textures.exists('ui-ready-dot')) scene.add.image(b.box.x + w / 2 - 6, b.box.y - STRIP_H / 2 + 4, 'ui-ready-dot').setDisplaySize(14, 14);
      else scene.add.circle(b.box.x + w / 2 - 6, b.box.y - STRIP_H / 2 + 4, 6, PAL.amber).setStrokeStyle(2, 0x1b121c);
    }
  });
  return y + 6 + STRIP_H + 8;
}
