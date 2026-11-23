import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { game } from '../state/game';
import { crusadeTabTarget, drawBadge } from './bgFight';
import { marchOf } from '../systems/march';
import { anyReady, homeOf } from './rites';
import { WINGS, WING_IDS, groupOf, groupReady, isWing } from './nav';
import { limitedUnseen } from '../systems/limited';
import { nine, stretch } from './skin';
import { addIcon } from './theme';

export const TAB_BAR_H = 88;

/** Five tabs; the Crusade medallion rises in the middle (the Cathedral layout, ui/nav.ts). */
const TABS = [
  { label: 'Sanctum', scene: 'Sanctum', icon: 'sanctum' },
  { label: 'Sisters', scene: 'Roster', icon: 'roster' },
  { label: 'Crusade', scene: 'Modes', icon: 'blade', art: 'crusade' },
  { label: 'Altar', scene: 'Recruit', icon: 'seal', art: 'altar' },
  { label: 'Market', scene: 'Shop', icon: 'seal', art: 'shop' },
] as const;

/** Screens of the Crusade side (fights, runs, results) that light its tab. */
const BOARD_SCENES = ['Modes', 'Crusade', 'Muster', 'Crypt', 'Battle', 'Results', 'Campaign', 'Chronicle', 'Story', 'Camp', 'Field', ...WING_IDS.map((w) => WINGS[w].scene)];

/** The tab (by its scene) a screen belongs to. */
export function tabOf(sceneKey: string): string {
  if (BOARD_SCENES.includes(sceneKey)) return 'Modes';
  const g = groupOf(sceneKey);
  if (g === 'sisters') return 'Roster';
  if (g === 'altar' || sceneKey === 'Reveal') return 'Recruit';
  if (g === 'duties' || sceneKey === 'Rank' || sceneKey === 'Profile') return 'Sanctum';
  const home = homeOf(sceneKey);
  if (home && (isWing(home) || home === 'road' || home === 'event')) return 'Modes';
  if (home === 'lobby') return 'Sanctum';
  if (home === 'market') return 'Shop';
  if (home === 'sisters') return 'Roster';
  if (home === 'altar') return 'Recruit';
  return sceneKey;
}

/** Where a screen's Back button leads: its wing, the hub, the lobby or its tab. */
export function backOf(sceneKey: string): string {
  const home = homeOf(sceneKey);
  if (home && isWing(home)) return WINGS[home].scene;
  if (WING_IDS.some((w) => WINGS[w].scene === sceneKey)) return 'Modes';
  if (home === 'road' || home === 'event') return 'Modes';
  return tabOf(sceneKey);
}

/** Relative widths: the centre tab is wider. */
const WEIGHT = [1, 1, 1.3, 1, 1];

/** Something waits behind a tab (a gold dot on it). */
function tabReady(scene: string) {
  const save = game.save;
  if (scene === 'Sanctum') return !!marchOf(save)?.stopped || groupReady(save, 'duties') || anyReady(save, 'lobby');
  if (scene === 'Roster') return groupReady(save, 'sisters');
  if (scene === 'Modes') return WING_IDS.some((w) => anyReady(save, w)) || anyReady(save, 'event');
  if (scene === 'Recruit') return limitedUnseen(save) || groupReady(save, 'altar');
  return anyReady(save, 'market');
}

/**
 * Bottom navigation, in thumb reach: pixel icon over label, gold edge on the
 * current tab, a gold dot on a tab with something to claim. `current` is any
 * scene key; it lights the tab that screen belongs to. `onTab`, when given,
 * decides how to leave (a fight pauses first) instead of starting the scene.
 */
export function addTabBar(scene: Phaser.Scene, current: string, depth = 5, onTab?: (sceneKey: string) => void): Phaser.GameObjects.GameObject[] {
  const currentTab = current ? tabOf(current) : '';
  const top = GAME_H - TAB_BAR_H;
  const made: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    made.push(o);
    return o;
  };
  // ui-tabbar.png (540 x 88) replaces the drawn rail
  const rail = stretch(scene, 'ui-tabbar', GAME_W / 2, top + TAB_BAR_H / 2, GAME_W, TAB_BAR_H);
  if (rail) keep(rail.setDepth(depth));
  else {
    const g = keep(scene.add.graphics().setDepth(depth));
    // rail gradient (#20161c -> #151016) and top hairline
    for (let i = 0; i < 8; i++) g.fillStyle(i < 3 ? 0x1d151b : 0x161117).fillRect(0, top + (i * TAB_BAR_H) / 8, GAME_W, TAB_BAR_H / 8 + 1);
    g.fillStyle(PAL.armorShadow).fillRect(0, top, GAME_W, 1);
  }

  const unit = GAME_W / WEIGHT.reduce((a, b) => a + b, 0);
  let x0 = 0;
  TABS.forEach((t, i) => {
    const on = t.scene === currentTab;
    const w = unit * WEIGHT[i];
    const cx = x0 + w / 2;
    x0 += w;
    const centre = i === 2;
    const cy = top + TAB_BAR_H / 2 - (centre ? 6 : 0);
    const bw = w - 6;
    const bh = TAB_BAR_H - (centre ? 2 : 14);
    const box = keep(scene.add.rectangle(cx, cy, bw, bh, 0x000000, 0.001).setDepth(depth));
    if (centre) {
      // The Crusade medallion rises above the rail (ui-medal-crusade.png replaces the drawn one).
      const my = top + 22;
      const art = scene.textures.exists('ui-medal-crusade') ? `ui-medal-crusade${on && scene.textures.exists('ui-medal-crusade-pressed') ? '-pressed' : ''}` : '';
      if (art) keep(scene.add.image(cx, my, art).setDisplaySize(80, 80).setDepth(depth));
      else {
        keep(scene.add.circle(cx, my + 3, 40, 0x000000).setDepth(depth));
        keep(scene.add.circle(cx, my, 38, 0x1a0d12).setDepth(depth));
        keep(scene.add.circle(cx, my, 35, on ? 0x8e2434 : 0x5e1622).setStrokeStyle(3, PAL.goldEdge).setDepth(depth));
        keep(scene.add.circle(cx, my, 26, on ? 0xa02a3a : 0x6b1a24).setDepth(depth));
        keep(addIcon(scene, cx, my, 'art' in t && t.art && scene.textures.exists(`ui-${t.art}`) ? t.art : t.icon, 40, PAL.amber).setDepth(depth));
      }
      keep(scene.add.text(cx, top + TAB_BAR_H - 16, t.label, { fontFamily: FONT, fontSize: '19px', color: hex(on ? PAL.amber : PAL.muted) }).setOrigin(0.5).setDepth(depth));
      box.setSize(bw, TAB_BAR_H + 20).setPosition(cx, top + TAB_BAR_H / 2 - 10);
    } else {
      if (on) {
        // ui-tab-active.png glows gold; it is dimmed so the tab's label stays readable on it
        const skin = nine(scene, 'ui-tab-active', cx, cy, bw, bh)?.setTint(0x7a5a44) ?? null;
        if (skin) keep(skin.setDepth(depth));
        else keep(scene.add.rectangle(cx, cy, bw, bh, 0x3a1d29).setStrokeStyle(1, 0x694041).setDepth(depth));
        keep(scene.add.rectangle(cx, top + TAB_BAR_H - 6, bw - 16, 3, PAL.goldEdge).setDepth(depth));
      }
      keep(addIcon(scene, cx, cy - 13, 'art' in t && t.art && scene.textures.exists(`ui-${t.art}`) ? t.art : t.icon, 26, on ? PAL.amber : 0xae8b73).setDepth(depth));
      keep(scene.add.text(cx, cy + 17, t.label, { fontFamily: FONT, fontSize: '18px', color: hex(on ? PAL.amber : PAL.muted) }).setOrigin(0.5).setDepth(depth));
    }
    if (tabReady(t.scene)) keep(scene.add.circle(cx + (centre ? 34 : bw / 2 - 12), centre ? top - 10 : cy - bh / 2 + 12, 6, PAL.amber).setStrokeStyle(2, 0x1b121c).setDepth(depth));
    if (centre) drawBadge(scene, cx + 40, top - 12, depth);
    box.setInteractive({ useHandCursor: true });
    box.on('pointerup', () => {
      // With onTab (a fight), even the lit tab leaves: Crusade goes back to the board.
      if (onTab) return onTab(t.scene);
      // An Auto fight running (or just ended) away from the screen: Crusade leads to it.
      const away = centre ? crusadeTabTarget() : undefined;
      if (away) scene.scene.start(away.scene, away.data ?? {});
      else if (current === t.scene) return;
      else scene.scene.start(t.scene, {});
    });
  });
  return made;
}
