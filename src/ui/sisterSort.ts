import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { CLASSES } from '../data/classes';
import { ORDER_LIST } from '../data/orders';
import type { CrusaderDef } from '../data/types';
import type { SaveData } from '../state/save';
import { RARITY_ORDER } from '../systems/gacha';
import { sisterPower } from '../systems/power';
import { makeButton } from './button';
import { PAD, addFrame, text } from './theme';

/**
 * The Roster's sort and filter, shared by every screen where you choose Sisters.
 * One setting for the whole game: sort by Level in the Roster and the pickers
 * sort by Level too.
 */
export type SortKey = 'power' | 'level' | 'rarity' | 'class' | 'order' | 'name';
export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'power', label: 'Power' },
  { key: 'level', label: 'Level' },
  { key: 'rarity', label: 'Rarity' },
  { key: 'class', label: 'Class' },
  { key: 'order', label: 'Order' },
  { key: 'name', label: 'Name' },
];
const CLASS_ORDER = Object.keys(CLASSES);

/** Which Sisters are shown. Empty sets mean "any". `unsworn` only matters in the Roster. */
export interface SisterFilter {
  rarity: Set<string>;
  classId: Set<string>;
  order: Set<string>;
  unsworn: boolean;
}

/** Kept while the game runs. */
export const sortState: { key: SortKey; filter: SisterFilter } = {
  key: 'power',
  filter: { rarity: new Set(), classId: new Set(), order: new Set(), unsworn: true },
};

/** Sworn first, then by the chosen key (strongest, highest or A to Z first). */
export function sortRoster(save: SaveData, list: CrusaderDef[], key: SortKey = sortState.key): CrusaderDef[] {
  const owned = save.owned;
  const pw = new Map(list.map((c) => [c.id, sisterPower(save, c)]));
  const rar = (c: CrusaderDef) => RARITY_ORDER.indexOf(c.rarity);
  const by: Record<SortKey, (a: CrusaderDef, b: CrusaderDef) => number> = {
    power: (a, b) => pw.get(b.id)! - pw.get(a.id)!,
    level: (a, b) => (owned[b.id]?.level ?? 0) - (owned[a.id]?.level ?? 0),
    rarity: (a, b) => rar(b) - rar(a),
    class: (a, b) => CLASS_ORDER.indexOf(a.classId) - CLASS_ORDER.indexOf(b.classId),
    order: (a, b) => ORDER_LIST.findIndex((o) => o.name === a.order) - ORDER_LIST.findIndex((o) => o.name === b.order),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return [...list].sort(
    (a, b) => Number(!!owned[b.id]) - Number(!!owned[a.id]) || by[key](a, b) || rar(b) - rar(a) || pw.get(b.id)! - pw.get(a.id)! || a.name.localeCompare(b.name),
  );
}

/** Does the filter (rarity, class, Order) let her through? */
export function passes(c: CrusaderDef, f: SisterFilter = sortState.filter) {
  return (!f.rarity.size || f.rarity.has(c.rarity)) && (!f.classId.size || f.classId.has(c.classId)) && (!f.order.size || f.order.has(c.order));
}

/**
 * Filtered and sorted. `keep` are always shown (e.g. Sisters already picked),
 * so a filter never hides a choice you made.
 */
export function sortAndFilter(save: SaveData, list: CrusaderDef[], keep: string[] = []): CrusaderDef[] {
  return sortRoster(save, list.filter((c) => passes(c) || keep.includes(c.id)));
}

/** How many filter chips are on. `roster` counts "hide unsworn" too. */
export function filterCount(roster = false) {
  const f = sortState.filter;
  return f.rarity.size + f.classId.size + f.order.size + (roster && !f.unsworn ? 1 : 0);
}

/**
 * The Sort and Filter buttons, side by side, centred on (cx, y) across `w`.
 * Sort cycles; Filter opens the chip panel. `changed` redraws the list.
 */
export function sortControls(
  scene: Phaser.Scene,
  cx: number,
  y: number,
  w: number,
  changed: () => void,
  opts: { roster?: boolean; depth?: number; h?: number } = {},
): Phaser.GameObjects.GameObject[] {
  const h = opts.h ?? 40;
  const bw = (w - 10) / 2;
  const label = SORTS.find((x) => x.key === sortState.key)!.label;
  const sort = makeButton(scene, cx - bw / 2 - 5, y, bw, h, `Sort: ${label}`, () => {
    const i = SORTS.findIndex((x) => x.key === sortState.key);
    sortState.key = SORTS[(i + 1) % SORTS.length].key;
    changed();
  }, { fontSize: 16 });
  const n = filterCount(opts.roster);
  const filter = makeButton(scene, cx + bw / 2 + 5, y, bw, h, n ? `Filter (${n})` : 'Filter', () => filterPanel(scene, changed, opts), { fontSize: 16, active: n > 0 });
  return [...sort.all, ...filter.all];
}

/** Filter chips: rarity, class, Order (and in the Roster, unsworn Sisters). */
export function filterPanel(scene: Phaser.Scene, done: () => void, opts: { roster?: boolean; depth?: number } = {}) {
  const f = sortState.filter;
  const layer = scene.add.container(0, 0).setDepth((opts.depth ?? 40) + 20);
  const redraw = () => {
    layer.removeAll(true);
    layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.94).setInteractive());
    layer.add(addFrame(scene, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 }));
    layer.add(scene.add.text(GAME_W / 2, 58, 'FILTER THE SISTERS', text.display(22, PAL.ivory)).setOrigin(0.5));
    let y = 100;
    const chip = (x: number, w: number, label: string, on: boolean, toggle: () => void) => {
      const b = makeButton(scene, x, y, w, 40, label, () => {
        toggle();
        redraw();
      }, { active: on, fontSize: 15 });
      layer.add(b.all);
    };
    const section = (title: string) => {
      layer.add(scene.add.text(PAD + 12, y, title, text.hud(12, PAL.amber)));
      y += 42;
    };
    const flip = (set: Set<string>, v: string) => () => (set.has(v) ? set.delete(v) : set.add(v));
    const row = (items: [string, string][], set: Set<string>, cols: number) => {
      const w = (GAME_W - 56 - (cols - 1) * 8) / cols;
      items.forEach(([v, label], i) => {
        if (i && i % cols === 0) y += 48;
        chip(28 + w / 2 + (i % cols) * (w + 8), w, label, set.has(v), flip(set, v));
      });
      y += 52;
    };
    section('RARITY');
    row(RARITY_ORDER.slice().reverse().map((r) => [r, r]), f.rarity, 4);
    section('CLASS');
    row(CLASS_ORDER.map((id) => [id, CLASSES[id].name.split(' ').pop()!]), f.classId, 3);
    section('ORDER');
    row(ORDER_LIST.map((o) => [o.name, o.name]), f.order, 2);
    if (opts.roster) chip(GAME_W / 2, GAME_W - 56, f.unsworn ? 'Showing unsworn Sisters' : 'Hiding unsworn Sisters', f.unsworn, () => (f.unsworn = !f.unsworn));
    const clear = makeButton(scene, GAME_W / 2 - 120, GAME_H - 62, 220, 60, 'Clear all', () => {
      f.rarity.clear();
      f.classId.clear();
      f.order.clear();
      f.unsworn = true;
      redraw();
    }, { fontSize: 19 });
    const ok = makeButton(scene, GAME_W / 2 + 120, GAME_H - 62, 220, 60, 'Done', () => {
      layer.destroy();
      done();
    }, { fontSize: 19, active: true });
    layer.add([...clear.all, ...ok.all]);
  };
  redraw();
  return layer;
}
