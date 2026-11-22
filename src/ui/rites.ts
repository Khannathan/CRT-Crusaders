import Phaser from 'phaser';
import { GAME_W, PAL } from '../config';
import type { SaveData } from '../state/save';
import { matinsReady } from '../systems/matins';
import { ROMAN_RANK, unlocked } from '../systems/rank';
import { anyClaimable } from '../systems/tasks';
import { anyUnheard } from '../systems/bonds';
import { entriesLeft } from '../systems/trials';
import { PROCESSION_ENTRIES, candleReady, honouredToday, processionLeft } from '../systems/offerings';

const BRAND_MAX = 9;
import { RELICS, relicBlock } from '../systems/reliquary';
import { codexBlock } from '../systems/codex';
import { claimable as setsClaimable, SETS } from '../systems/collection';
import { CRYPTS, PILGRIMAGE_CLEARS, cryptUnlocked, pilgrimageLeft } from '../systems/crusade';
import { TOWER_FLOORS, towerOf } from '../systems/tower';
import { TRIAL_ENTRIES } from '../systems/trials';
import { rotation, totalBrands } from '../systems/inquisition';
import { untilText } from './modeScreen';
import { nextStage, roadRates, stageDef } from '../systems/campaign';
import { ORDER_LIST } from '../data/orders';
import { makeButton } from './button';
import { ladder, renownOf } from '../systems/rivals';
import { PAD } from './theme';

/**
 * Every mode and side screen, and where it lives: the Sanctum's rail (daily
 * duties), the Crusade board (modes you fight in) or the Cloister (growth and
 * spending). Each entry opens its scene; a gold dot marks one with something to claim.
 */
export interface RiteEntry {
  label: string;
  scene: string;
  icon: string;
  /** Its own icon (ui-<art>.png), used in place of `icon` once the file exists. */
  art?: string;
  /** Rank of Faith needed (see UNLOCKS in rank.ts). */
  rank: number;
  /** Something is waiting to be claimed. */
  ready?: (save: SaveData) => boolean;
  /** Where it lives: the Sanctum's rail, the Crusade board or the Cloister. */
  home: RiteHome;
  /** Scene data when opening it. */
  data?: object;
  /** One line for its card on a board. */
  blurb?: string;
  /** A short live status for its card (entries left, best floor...). */
  status?: (save: SaveData) => string;
  /** Card art (a bg-* key); falls back to the hall. */
  bg?: string;
}

export type RiteHome = 'sanctum' | 'board' | 'cloister';

export const RITES: RiteEntry[] = [
  // The Crusade board: every mode you fight in.
  {
    label: 'Crypts', scene: 'Crusade', icon: 'blade', rank: 1, home: 'board', bg: 'bg-drowned-ossuary',
    blurb: 'The core crusade: a branching descent, act by act, to the crypt\'s heart.',
    status: (s) => `${CRYPTS.filter((c) => cryptUnlocked(s, c)).length} of ${CRYPTS.length} crypts open  ·  Pilgrimage ${pilgrimageLeft(s)}/${PILGRIMAGE_CLEARS}`,
  },
  {
    label: "Pilgrim's Road", scene: 'Campaign', icon: 'flame', rank: 1, home: 'board', bg: 'bg-hall',
    blurb: 'The Vigil\'s campaign. Every stage cleared makes your Sisters gather faster while you are away.',
    status: (s) => `Stage ${stageDef(nextStage(s)).label}  ·  Vigil ${Math.round(roadRates(s).tithes)} Tithes/h`,
  },
  {
    label: 'Relic Trials', scene: 'Trials', icon: 'shield', rank: 3, home: 'board', bg: 'bg-sunken-belfry', ready: (s) => entriesLeft(s) > 0,
    blurb: 'A different spoil each dawn: gear, Tithes, Seals, ash or pages.',
    status: (s) => `${entriesLeft(s)} of ${TRIAL_ENTRIES} entries left today`,
  },
  {
    label: 'Reliquary Procession', scene: 'Procession', icon: 'flame', rank: 5, home: 'board', bg: 'bg-altar', ready: (s) => processionLeft(s) > 0,
    blurb: 'Carry the relics through the dead. Wins pay offerings for Confession.',
    status: (s) => `${processionLeft(s)} of ${PROCESSION_ENTRIES} entries left  ·  honours the ${honouredToday().name}`,
  },
  {
    label: 'Bell Tower', scene: 'Tower', icon: 'sanctum', rank: 6, home: 'board', bg: 'bg-sunken-belfry',
    blurb: 'Sixty floors, each a set fight. Some floors take only one Order.',
    status: (s) => `Best floor ${towerOf(s).best} of ${TOWER_FLOORS}`,
  },
  {
    label: 'Inquisition', scene: 'Inquisition', icon: 'blade', rank: 8, home: 'board', bg: 'bg-altar',
    blurb: 'A fortnightly Edict: three trials, nine Brands, each Sister fights once.',
    status: (s) => `${totalBrands(s)} of ${BRAND_MAX} Brands  ·  ends in ${untilText(rotation().ends - Date.now())}`,
  },
  // The Cloister: growth and spending.
  {
    label: 'Rival Orders', scene: 'Rivals', icon: 'sigil', rank: 1, home: 'board', bg: 'bg-hall',
    blurb: 'Your records, and the rival Sisterhoods just above and below you on the ladder.',
    status: (s) => `Place ${ladder(s).place} of ${ladder(s).rows.length}  ·  Renown ${renownOf(s)}`,
  },
  { label: 'Inventory', scene: 'Inventory', icon: 'shield', art: 'inventory', rank: 1, home: 'cloister', bg: 'bg-hall', blurb: 'Every relic, ash, page and writ your Sisters carried home. Refine and use them.' },
  { label: 'Shop', scene: 'Shop', icon: 'seal', art: 'shop', rank: 1, home: 'cloister', bg: 'bg-altar', blurb: 'Seals, crates, the Almonry and the Tithe Exchange. Stock turns daily and weekly.' },
  {
    label: 'Reliquary', scene: 'Reliquary', icon: 'flame', art: 'reliquary', rank: 1, home: 'cloister', bg: 'bg-hall', data: { tab: 'relics' },
    ready: (s) => RELICS.some((r) => !relicBlock(s, r.id)),
    blurb: 'Incense lights the relics. Each relic lifts every Sister.',
  },
  {
    label: 'Order Codex', scene: 'Reliquary', icon: 'book', rank: 1, home: 'cloister', bg: 'bg-altar', data: { tab: 'codex' },
    ready: (s) => ORDER_LIST.some((o) => !codexBlock(s, o.id)),
    blurb: 'Writs raise an Order. Each level lifts all its Sisters.',
  },
  // The Sanctum's rail: daily duties.
  {
    label: 'Order Book', scene: 'OrderBook', icon: 'book', rank: 1, home: 'cloister', bg: 'bg-hall',
    ready: (s) => setsClaimable(s).length > 0,
    blurb: 'Every Sister of every Order. Small sets pay Seals and a title.',
    status: (s) => `${SETS.filter((x) => (s.sets ?? []).includes(x.id)).length} of ${SETS.length} sets complete`,
  },
  { label: 'Matins', scene: 'Matins', icon: 'flame', rank: 1, home: 'sanctum', ready: (s) => matinsReady(s) },
  { label: 'Penance', scene: 'Penance', icon: 'book', rank: 2, home: 'sanctum', ready: (s) => anyClaimable(s) },
  { label: 'Confession', scene: 'Confession', icon: 'book', rank: 5, home: 'sanctum', ready: (s) => anyUnheard(s) || (Object.keys(s.owned).length > 0 && candleReady(s)) },
];

/** The Rite (or board) a scene belongs to, for its tab and its Back button. */
export const homeOf = (sceneKey: string): RiteHome | undefined => RITES.find((r) => r.scene === sceneKey && r.scene !== 'Sanctum')?.home;

/** True when a Rite in `home` has something to claim (for a dot on its tab). */
export const anyReady = (save: SaveData, home: RiteHome) => RITES.some((r) => r.home === home && unlocked(save, r.rank) && r.ready?.(save));

/** Draws the Sanctum's rail of daily Rites from `top`; returns its bottom edge. */
export function drawRites(scene: Phaser.Scene, save: SaveData, top: number, home: RiteHome = 'sanctum'): number {
  const list = RITES.filter((r) => r.home === home);
  const cols = 3;
  const gap = 10;
  const w = (GAME_W - PAD * 2 - gap * (cols - 1)) / cols;
  const h = 58;
  list.forEach((r, i) => {
    const x = PAD + w / 2 + (i % cols) * (w + gap);
    const y = top + h / 2 + Math.floor(i / cols) * (h + gap);
    if (!unlocked(save, r.rank)) {
      makeButton(scene, x, y, w, h, `${r.label}\nRANK ${ROMAN_RANK(r.rank)}`, () => scene.scene.start('Rank'), { fontSize: 17, icon: 'lock', disabled: true, skin: 'ui-rite-tile' });
      return;
    }
    // ui-rite-tile.png skins each tile; ui-ready-dot.png marks one with something to claim
    makeButton(scene, x, y, w, h, r.label, () => scene.scene.start(r.scene, r.data ?? {}), { fontSize: 18, icon: r.art && scene.textures.exists(`ui-${r.art}`) ? r.art : r.icon, skin: 'ui-rite-tile' });
    if (r.ready?.(save)) {
      if (scene.textures.exists('ui-ready-dot')) scene.add.image(x + w / 2 - 10, y - h / 2 + 10, 'ui-ready-dot').setDisplaySize(16, 16);
      else scene.add.circle(x + w / 2 - 10, y - h / 2 + 10, 6, PAL.amber).setStrokeStyle(2, 0x1b121c);
    }
  });
  return top + Math.ceil(list.length / cols) * (h + gap) - gap;
}
