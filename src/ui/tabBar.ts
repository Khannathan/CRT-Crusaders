import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { game } from '../state/game';
import { crusadeTabTarget, drawBadge } from './bgFight';
import { anyReady, homeOf } from './rites';
import { limitedUnseen } from '../systems/limited';
import { nine, stretch } from './skin';
import { addIcon } from './theme';

export const TAB_BAR_H = 88;

/** Five tabs; the Crusade board sits in the middle, larger. */
const TABS = [
  { label: 'Sanctum', scene: 'Sanctum', icon: 'sanctum', home: 'sanctum' },
  { label: 'Roster', scene: 'Roster', icon: 'roster' },
  { label: 'Crusade', scene: 'Modes', icon: 'blade', home: 'board' },
  { label: 'Altar', scene: 'Recruit', icon: 'seal' },
  { label: 'Cloister', scene: 'Cloister', icon: 'book', home: 'cloister' },
] as const;

/** Screens reached through the Crusade board that light its tab. */
const BOARD_SCENES = ['Modes', 'Crusade', 'Muster', 'Crypt', 'Battle', 'Results'];

/** The tab (by its scene) a screen belongs to. */
export function tabOf(sceneKey: string): string {
  if (BOARD_SCENES.includes(sceneKey)) return 'Modes';
  const home = homeOf(sceneKey);
  if (home === 'board') return 'Modes';
  if (home === 'cloister') return 'Cloister';
  if (home === 'sanctum' || sceneKey === 'Rank') return 'Sanctum';
  if (sceneKey === 'PullHistory') return 'Recruit';
  return sceneKey;
}

/** Relative widths: the centre tab is wider. */
const WEIGHT = [1, 1, 1.35, 1, 1];

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
    if (centre) {
      // the Crusade tab rises above the rail
      keep(scene.add.rectangle(cx, cy, bw, bh, on ? 0x3a1d29 : 0x24161f).setStrokeStyle(1, PAL.goldEdge).setDepth(depth));
    }
    const box = keep(scene.add.rectangle(cx, cy, bw, bh, on ? 0x3a1d29 : 0x000000, on ? 1 : 0.001).setDepth(depth));
    const skin = on ? nine(scene, 'ui-tab-active', cx, cy, bw, bh) : null;
    if (skin) {
      keep(skin.setDepth(depth));
      box.setFillStyle(0x000000, 0.001);
    } else if (on) {
      box.setStrokeStyle(1, 0x694041);
      keep(scene.add.rectangle(cx, cy - bh / 2 + 1, bw, 3, PAL.goldEdge).setDepth(depth));
    }
    keep(addIcon(scene, cx, cy - 13, t.icon, centre ? 30 : 24, on ? PAL.amber : 0xae8b73).setDepth(depth));
    keep(
      scene.add
        .text(cx, cy + 17, t.label, { fontFamily: FONT, fontSize: centre ? '21px' : '18px', color: hex(on ? PAL.amber : PAL.muted) })
        .setOrigin(0.5)
        .setDepth(depth),
    );
    // The Altar lights up while a new limited Saint has not been looked at.
    const fresh = t.scene === 'Recruit' && limitedUnseen(game.save);
    if (fresh || ('home' in t && anyReady(game.save, t.home))) keep(scene.add.circle(cx + bw / 2 - 12, cy - bh / 2 + 12, 5, PAL.amber).setStrokeStyle(2, 0x1b121c).setDepth(depth));
    if (centre) drawBadge(scene, cx + bw / 2 - 24, cy - bh / 2 + 12, depth);
    box.setInteractive({ useHandCursor: true });
    box.on('pointerup', () => {
      // With onTab (a fight), even the lit tab leaves: Crusade goes back to the board.
      if (onTab) return onTab(t.scene);
      // An Auto fight running (or just ended) away from the screen: Crusade leads to it.
      const away = centre ? crusadeTabTarget() : undefined;
      if (away) scene.scene.start(away.scene, away.data ?? {});
      else if (on) return;
      else scene.scene.start(t.scene, {});
    });
  });
  return made;
}
