import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { GAME_H, GAME_W, PAL } from '../config';
import { EDICTS, GRADE, ROLL_MIN, edictDef, edictText, edictValue, uniqueDef, uniqueText, uniqueValue, type EdictId } from '../data/loot';
import type { CrusaderDef } from '../data/types';
import { commit, game } from '../state/game';
import {
  CONFESS_PENANCE,
  IMPRINT_COST,
  MAX_GEAR_LEVEL,
  MAX_REFINE,
  SLOT_NAME,
  SUB_UPGRADE_LEVELS,
  confess,
  confessBlock,
  confessTithes,
  enhance,
  enhanceBlock,
  enhanceCost,
  filterOf,
  formatStat,
  gearName,
  gradeName,
  GRADE_COLOR,
  imprint,
  imprintBlock,
  imprintTithes,
  indexOf,
  isAbsolved,
  isAncient,
  ironText,
  mainValue,
  refineIron,
  settle,
  type GearItem,
  type GearSub,
  type LootFilter,
} from '../systems/gear';
import { countOf, itemDef } from '../systems/items';
import { formatPower, gearPower } from '../systems/power';
import { enhanceTo, nextMilestone } from '../systems/quick';
import { makeButton } from './button';
import { toast } from './modeScreen';
import { addScrollArea } from './scroll';
import { tapCost } from './sources';
import { addFrame, text } from './theme';

/**
 * Relics of War screens: the item card (lines with their rolls, Edict or
 * unique power, Penance), the Anvil, the Confessional, the Index and the loot
 * filter. Opened from a Sister's Gear tab.
 */

const LEFT = 48;
const WIDTH = GAME_W - 96;

/** Roll quality as the card shows it: 70% roll = 0%, a perfect roll = 100%. */
export const rollPct = (roll: number) => Math.round(((roll - ROLL_MIN) / (1 - ROLL_MIN)) * 100);

/** "+6.2% ATK  ·  92%  · Burning ×1" */
export function subLine(s: GearSub): string {
  const bits = [formatStat(s.stat, s.value), `${rollPct(s.roll)}%`];
  if (s.burn) bits.push('BURNING');
  if (s.up) bits.push(`▲${s.up}`);
  return bits.join('  ·  ');
}

/** One-line summary of a piece's special power (Edict or unique), or ''. */
export function powerLine(g: GearItem, order?: string): string {
  if (g.edict) return `${edictDef(g.edict.id)!.name}: ${edictText(g.edict.id, edictValue(g.edict.id, g.edict.roll, g.ip))}`;
  if (g.unique) {
    const u = uniqueDef(g.unique)!;
    const sworn = !!order && order === u.order;
    return `${uniqueText(g.unique, uniqueValue(g.unique, g.uRoll ?? 0.5, sworn))}${sworn ? ' (Sworn line awake)' : ''}`;
  }
  return '';
}

/** "Ancient Anathema Blade · IP 760" */
export const gearKind = (g: GearItem) => `${isAncient(g) && GRADE[g.grade].lines < 4 && g.grade !== 'arms' ? 'Ancient ' : ''}${gradeName(g.grade)} ${SLOT_NAME[g.slot]} · IP ${g.ip}`;

function overlay(scene: Phaser.Scene, title: string, depth = 30) {
  const layer = scene.add.container(0, 0).setDepth(depth);
  layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.96).setInteractive());
  layer.add(addFrame(scene, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 }));
  layer.add(scene.add.text(GAME_W / 2, 64, title, text.display(22, PAL.ivory)).setOrigin(0.5));
  return layer;
}

/** The item card: read the piece, enhance it, confess a line, imprint an Edict. */
export function showGearCard(scene: Phaser.Scene, c: CrusaderDef, item: GearItem, onBack: () => void) {
  const save = game.save;
  const layer = overlay(scene, 'THE FORGE');
  const color = GRADE_COLOR[item.grade];
  const again = () => (layer.destroy(), showGearCard(scene, c, item, onBack));
  layer.add([
    scene.add.text(GAME_W / 2, 108, `${gearName(item)}${item.level ? ` +${item.level}` : ''}`, { ...text.body(24, color), fontStyle: '600', align: 'center', wordWrap: { width: WIDTH } }).setOrigin(0.5, 0),
  ]);
  let y = 108 + 34 + (gearName(item).length > 30 ? 28 : 0);
  layer.add(scene.add.text(GAME_W / 2, y, `${gearKind(item)} · +${formatPower(gearPower(save, c, item))} power`, text.body(16, PAL.ivory)).setOrigin(0.5, 0));
  y += 34;
  const rule = () => layer.add(scene.add.rectangle(GAME_W / 2, y, WIDTH, 1, PAL.armorShadow));
  const head = (t: string) => layer.add(scene.add.text(LEFT, y + 10, t, text.hud(13, PAL.steel)));

  // Lines
  rule();
  head(`LINES · MAIN ${formatStat(item.main, mainValue(item))}`);
  y += 32;
  if (!item.subs.length) {
    layer.add(scene.add.text(LEFT, y, 'A Worn piece rolls no lines. Melt it when better comes.', text.body(16, PAL.muted)));
    y += 28;
  }
  item.subs.forEach((s, i) => {
    const locked = item.rerollLine !== undefined && item.rerollLine === i;
    layer.add(scene.add.text(LEFT, y, `${locked ? '✠ ' : ''}${subLine(s)}`, text.body(17, s.burn ? 0xf0a040 : PAL.ivory)));
    y += 26;
  });
  // Power
  const power = powerLine(item, c.order);
  if (power) {
    y += 6;
    const t = scene.add.text(LEFT, y, power, { ...text.body(16, color), wordWrap: { width: WIDTH } });
    layer.add(t);
    y += t.height + 6;
  }
  layer.add(scene.add.text(LEFT, y, isAbsolved(item) ? 'ABSOLVED: no Penance left. It can only be enhanced.' : `PENANCE ${item.penance} · each confession costs ${CONFESS_PENANCE[0]}-${CONFESS_PENANCE[1]}`, text.hud(12, isAbsolved(item) ? PAL.amber : PAL.steel)));
  y += 30;

  // The Anvil
  rule();
  const maxed = item.level >= MAX_REFINE;
  const iron = refineIron(item);
  const next = { ...item, level: item.level + 1 };
  head(item.level >= MAX_GEAR_LEVEL ? `THE ANVIL · +${item.level} OF +${MAX_REFINE}` : `THE ANVIL · +${item.level} OF +${MAX_GEAR_LEVEL}, THEN +${MAX_REFINE}`);
  const enhText = scene.add.text(
    LEFT,
    y + 32,
    maxed ? 'Fully refined.' : `+${next.level}: ${formatStat(item.main, mainValue(next))}${SUB_UPGRADE_LEVELS.includes(next.level) && item.subs.length ? ', and a line grows a quarter' : ''}. Cost: ${enhanceCost(item)} Tithes${iron ? ` and ${ironText(iron)}` : ''}.`,
    { ...text.body(15, PAL.muted), wordWrap: { width: WIDTH } },
  );
  layer.add(enhText);
  if (!maxed) tapCost(scene, enhText, iron, enhanceCost(item));
  y += 40 + enhText.height + 26;
  const eb = enhanceBlock(save, item);
  const goal = maxed ? item.level : nextMilestone(item);
  const leap = !eb && goal > item.level + 1;
  layer.add(
    makeButton(scene, leap ? GAME_W / 2 - 108 : GAME_W / 2, y, leap ? 236 : 300, 50, maxed ? 'Fully refined' : eb ?? `Strike to +${next.level}`, () => {
      if (!enhance(save, item)) return;
      sfx('forge');
      commit();
      again();
    }, { disabled: !!eb, active: !eb, fontSize: 17 }).all,
  );
  if (leap)
    layer.add(
      makeButton(scene, GAME_W / 2 + 128, y, 196, 50, `Up to +${goal}`, () => {
        if (!enhanceTo(save, item, goal)) return;
        sfx('forge');
        commit();
        again();
      }, { fontSize: 17 }).all,
    );
  y += 44;

  // The Confessional and the Index
  rule();
  head('THE CONFESSIONAL · THE INDEX');
  y += 54;
  const half = (WIDTH - 10) / 2;
  const line = item.rerollLine ?? -1;
  const cb = item.subs.length ? confessBlock(save, item, line >= 0 ? line : 0) : 'No lines';
  layer.add(
    makeButton(scene, LEFT + half / 2, y, half, 54, item.offer ? 'Choose a line' : cb && cb !== 'Only her first confessed line' ? cb : `Confess\n${confessTithes(item)} Tithes`, () => {
      if (item.offer) return showOffer(scene, item, again);
      if (line >= 0) {
        if (!confess(save, item, line)) return;
        sfx('forge');
        commit();
        return showOffer(scene, item, again);
      }
      pickLine(scene, item, again);
    }, { active: !!item.offer || !cb, disabled: !item.offer && !!cb, fontSize: 15 }).all,
  );
  const canImprint = item.grade === 'sworn' || item.grade === 'anathema';
  layer.add(
    makeButton(scene, LEFT + half + 10 + half / 2, y, half, 54, canImprint ? 'Imprint an Edict' : 'The Index', () => showIndex(scene, canImprint ? item : undefined, again), { fontSize: 15 }).all,
  );
  y += 40;
  const note = scene.add.text(LEFT, y, item.rerollLine !== undefined ? `Only the ✠ line may be confessed again.` : 'Confess one line for two new ones. That line becomes the only one you may ever confess.', { ...text.body(14, PAL.muted), wordWrap: { width: WIDTH } });
  layer.add(note);

  const own = (id: 'iron1' | 'iron2' | 'iron3') => `${countOf(save, id)} ${itemDef(id).name}`;
  layer.add(tapCost(scene, scene.add.text(GAME_W / 2, GAME_H - 118, `You hold ${own('iron1')}, ${own('iron2')}, ${own('iron3')} · ${save.tithes.toLocaleString('en-US')} Tithes  ›`, { ...text.body(15, PAL.muted), align: 'center', wordWrap: { width: WIDTH } }).setOrigin(0.5), { iron1: 1, iron2: 1, iron3: 1 }));
  layer.add(makeButton(scene, GAME_W / 2, GAME_H - 62, 240, 60, 'Back', () => (layer.destroy(), onBack()), { fontSize: 19 }).all);
  if (item.offer) showOffer(scene, item, again);
}

/** Choose the line to confess (the first confession fixes it for good). */
function pickLine(scene: Phaser.Scene, item: GearItem, done: () => void) {
  const save = game.save;
  const layer = overlay(scene, 'CONFESS WHICH LINE?', 40);
  layer.add(scene.add.text(GAME_W / 2, 104, 'Choose well: from now on only this line may be confessed.', { ...text.body(16, PAL.muted), align: 'center', wordWrap: { width: WIDTH } }).setOrigin(0.5, 0));
  item.subs.forEach((s, i) => {
    layer.add(
      makeButton(scene, GAME_W / 2, 190 + i * 70, WIDTH, 58, subLine(s), () => {
        if (!confess(save, item, i)) return;
        sfx('forge');
        commit();
        layer.destroy();
        done();
      }, { fontSize: 16 }).all,
    );
  });
  layer.add(makeButton(scene, GAME_W / 2, GAME_H - 62, 240, 60, 'Back', () => layer.destroy(), { fontSize: 19 }).all);
}

/** The two offers of a confession, and keeping the old line. */
function showOffer(scene: Phaser.Scene, item: GearItem, done: () => void) {
  const offer = item.offer;
  if (!offer || item.rerollLine === undefined) return;
  const layer = overlay(scene, 'THE CONFESSIONAL', 40);
  const old = item.subs[item.rerollLine];
  layer.add(scene.add.text(GAME_W / 2, 104, 'Confess, and be remade. Take one, or keep your sin.', { ...text.body(16, PAL.muted), align: 'center', wordWrap: { width: WIDTH } }).setOrigin(0.5, 0));
  const choose = (n: number) => {
    settle(item, n);
    sfx(n >= 0 ? 'claim' : 'close');
    commit();
    layer.destroy();
    done();
  };
  offer.forEach((s, i) => layer.add(makeButton(scene, GAME_W / 2, 200 + i * 76, WIDTH, 62, `Take: ${subLine(s)}`, () => choose(i), { fontSize: 16, active: true }).all));
  layer.add(makeButton(scene, GAME_W / 2, 200 + offer.length * 76, WIDTH, 62, `Keep: ${subLine(old)}`, () => choose(-1), { fontSize: 16 }).all);
}

/** The Index: every Edict, the best roll melted, and imprinting one on `item`. */
export function showIndex(scene: Phaser.Scene, item: GearItem | undefined, done?: () => void) {
  const save = game.save;
  const idx = indexOf(save);
  const layer = overlay(scene, 'THE INDEX', 40);
  const known = EDICTS.filter((e) => idx[e.id] !== undefined).length;
  layer.add(
    scene.add
      .text(GAME_W / 2, 100, `${known} of ${EDICTS.length} Edicts recorded. Melt Anathema pieces to record theirs; the Index keeps the best roll.${item ? ` Imprint costs ${imprintTithes(item)} Tithes and ${ironText(IMPRINT_COST.items)}.` : ''}`, { ...text.body(15, PAL.muted), align: 'center', wordWrap: { width: WIDTH } })
      .setOrigin(0.5, 0),
  );
  const top = 178;
  const bottom = GAME_H - 100;
  const list = addScrollArea(scene, top, bottom, { parent: layer });
  const rows = item ? [...EDICTS].sort((a, b) => Number(b.slots.includes(item.slot)) - Number(a.slots.includes(item.slot))) : EDICTS;
  let y = top + 10;
  for (const e of rows) {
    const roll = idx[e.id];
    const fits = !item || e.slots.includes(item.slot);
    const col = roll === undefined ? PAL.steel : fits ? GRADE_COLOR.anathema : PAL.muted;
    const body = roll === undefined ? `Unrecorded. Carried on ${e.slots.map((s) => SLOT_NAME[s]).join(', ')}.` : `${edictText(e.id, edictValue(e.id, roll, item?.ip ?? 800))} Best roll ${Math.round(roll * 100)}%.`;
    const name = scene.add.text(LEFT, y, `${e.name.toUpperCase()} · ${e.kind.toUpperCase()}${e.wasSet ? ` · WAS THE ${e.wasSet.toUpperCase()} SET` : ''}`, text.hud(12, col));
    const t = scene.add.text(LEFT, y + 20, body, { ...text.body(15, roll === undefined ? PAL.steel : PAL.ivory), wordWrap: { width: item ? WIDTH - 120 : WIDTH } });
    list.content.add([name, t]);
    if (item && roll !== undefined) {
      const blk = imprintBlock(save, item, e.id as EdictId);
      const b = makeButton(scene, GAME_W - LEFT - 50, y + 30, 100, 44, 'Imprint', () => {
        if (list.dragging) return;
        if (blk) return toast(scene, blk);
        if (!imprint(save, item, e.id)) return;
        sfx('forge');
        commit();
        layer.destroy();
        done?.();
        toast(scene, `${edictDef(e.id)!.name} burns into the ${SLOT_NAME[item.slot]}!`, GAME_H / 2);
      }, { fontSize: 14, disabled: !!blk, active: !blk });
      list.content.add(b.all);
    }
    y += Math.max(t.height + 34, item ? 70 : 0) + 8;
  }
  list.fit(y);
  layer.add(makeButton(scene, GAME_W / 2, GAME_H - 62, 240, 60, 'Back', () => layer.destroy(), { fontSize: 19 }).all);
}

const FILTERS: { label: string; f: LootFilter['melt'] }[] = [
  { label: 'Keep all', f: undefined },
  { label: 'Melt Worn', f: 'worn' },
  { label: 'Melt Consecrated and below', f: 'consecrated' },
  { label: 'Melt Sworn and below', f: 'sworn' },
];

/** The loot filter: what melts on arrival. */
export function showLootFilter(scene: Phaser.Scene, done?: () => void) {
  const save = game.save;
  const f = filterOf(save);
  const layer = overlay(scene, 'LOOT FILTER', 40);
  layer.add(scene.add.text(GAME_W / 2, 100, 'New pieces that match melt the moment they land: Tithes, Alms, iron, and their Edicts into the Index.', { ...text.body(15, PAL.muted), align: 'center', wordWrap: { width: WIDTH } }).setOrigin(0.5, 0));
  let y = 196;
  const again = () => (layer.destroy(), showLootFilter(scene, done));
  for (const o of FILTERS) {
    layer.add(makeButton(scene, GAME_W / 2, y, WIDTH, 52, o.label, () => ((f.melt = o.f), commit(), again()), { active: f.melt === o.f, fontSize: 16 }).all);
    y += 62;
  }
  y += 10;
  layer.add(
    makeButton(scene, GAME_W / 2, y, WIDTH, 60, `${f.knownEdicts ? '✓' : '○'} Melt Anathema whose Edict the Index holds at an equal or better roll`, () => ((f.knownEdicts = !f.knownEdicts), commit(), again()), { active: !!f.knownEdicts, fontSize: 14 }).all,
  );
  y += 60;
  layer.add(scene.add.text(GAME_W / 2, y, "Saint's Arms and Godforged never melt on their own.", text.body(15, GRADE.arms.color)).setOrigin(0.5, 0));
  layer.add(makeButton(scene, GAME_W / 2, GAME_H - 62, 240, 60, 'Done', () => (layer.destroy(), done?.()), { fontSize: 19 }).all);
}
