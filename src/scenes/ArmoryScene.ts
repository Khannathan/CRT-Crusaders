import { sfx } from '../audio/sfx';
import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { commit, game } from '../state/game';
import {
  FEATURED_SHARE,
  FIRST_WRITS,
  FORGE_FRAGMENTS,
  PITY,
  PULL_GILT,
  SSR_RATE,
  TEN_GILT,
  UR_RATE,
  armoryOf,
  GODFORGED,
  SAINTS_ARMS,
  featuredArms,
  forgeBlock,
  forgeUnique,
  giftWrits,
  pullArmory,
  pullBlock,
  type ForgePay,
  type PullPay,
} from '../systems/armory';
import { uniqueText, uniqueValue, type UniqueDef } from '../data/loot';
import { giltOf } from '../systems/currency';
import { GODSPARKS_TO_FORGE, GRADE_COLOR, MAX_GEAR, SLOT_NAME, formatStat, gearName, gearOf, lineText, mainValue, type GearItem } from '../systems/gear';
import { countOf } from '../systems/items';
import { timeLeft } from '../systems/limited';
import { makeButton } from '../ui/button';
import { modeScreen, progressBar, toast } from '../ui/modeScreen';
import { TAB_BAR_H } from '../ui/tabBar';
import { PAD, addFrame, addPanel, text } from '../ui/theme';

// Overlay buttons sit above the tab bar, so a double tap on Done cannot fall through to a tab.
const BTN_Y = GAME_H - TAB_BAR_H - 46;
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

/** The Saints' Armory: the Saint's Arms banner (weekly featured piece) and the forge (Saint's Arms and Godforged). */
export class ArmoryScene extends Phaser.Scene {
  private back = 'Roster';
  private notice?: string;

  constructor() {
    super('Armory');
  }

  init(data: { back?: string; notice?: string }) {
    if (data?.back) this.back = data.back;
    this.notice = data?.notice;
  }

  create() {
    const save = game.save;
    const gifted = giftWrits(save);
    if (gifted) commit();
    const a = armoryOf(save);
    const { arms, ends } = featuredArms();
    const { top } = modeScreen(this, "The Saints' Armory", '', this.back, 'bg-armory');
    const bw = GAME_W - PAD * 2;
    let y = top;

    // Featured Saint's Arms
    addPanel(this, PAD, y, bw, 150);
    this.add.rectangle(PAD + 6, y + 75, 6, 138, GRADE_COLOR.arms);
    this.add.text(PAD + 20, y + 12, `FEATURED THIS WEEK · ENDS IN ${timeLeft(ends).toUpperCase()}`, text.hud(12, PAL.steel));
    this.add.text(PAD + 20, y + 32, arms.name, text.display(21, GRADE_COLOR.arms));
    this.add.text(PAD + 20, y + 64, `${SLOT_NAME[arms.slot]} of the ${arms.order}. ${uniqueText(arms.id, uniqueValue(arms.id, 1, false))}`, { ...text.body(16, PAL.ivory), wordWrap: { width: bw - 40 } });
    this.add.text(PAD + 20, y + 120, `${Math.round(FEATURED_SHARE * 100)}% of Saint's Arms pulls are this piece.`, { ...text.body(15, PAL.muted), wordWrap: { width: bw - 40 } });
    y += 162;

    // Rates and pity
    this.add.text(PAD, y, `SAINT'S ARMS ${pct(UR_RATE)} · ANATHEMA OR SWORN ${pct(SSR_RATE)}`, text.hud(13, PAL.amber));
    makeButton(this, GAME_W - PAD - 56, y + 8, 112, 34, 'Details', () => this.showRates(), { fontSize: 14, icon: 'book' });
    y += 32;
    const left = PITY - a.pity;
    this.add.text(PAD, y, `Saint's Arms within ${left} pull${left === 1 ? '' : 's'}. Carries across weeks.`, text.body(15, PAL.ivory));
    y += 30;
    progressBar(this, PAD, y, bw, a.pity / PITY, RARITY_COLOR.UR, 10);
    y += 24;

    // Holdings
    const writs = countOf(save, 'armory2');
    this.add.text(PAD, y, `Armory Writs ${writs}  ·  Gilt ${giltOf(save).toLocaleString('en-US')}`, text.body(17, PAL.ivory));
    y += 34;

    // Pull buttons
    const half = (bw - 12) / 2;
    const pull = (n: 1 | 10, pay: PullPay) => {
      const got = pullArmory(save, n, pay);
      if (!got.length) return;
      sfx('pull');
      commit();
      this.showPulls(got);
    };
    const btn = (x: number, by: number, n: 1 | 10, pay: PullPay) => {
      const block = pullBlock(save, n, pay);
      const cost = pay === 'writ' ? `${n} Writ${n > 1 ? 's' : ''}` : `${n === 10 ? TEN_GILT : PULL_GILT} Gilt`;
      makeButton(this, x, by, half, 64, `Pull x${n}\n${cost}`, () => pull(n, pay), { active: !block && pay === 'writ', disabled: !!block, fontSize: 17 });
    };
    btn(PAD + half / 2, y + 32, 1, 'writ');
    btn(GAME_W - PAD - half / 2, y + 32, 10, 'writ');
    btn(PAD + half / 2, y + 104, 1, 'gilt');
    btn(GAME_W - PAD - half / 2, y + 104, 10, 'gilt');
    y += 146;
    // A full armory greys out every pull: say why, or the buttons just look dead.
    const full = gearOf(save).length + 1 > MAX_GEAR;
    this.add.text(GAME_W / 2, y, full ? `The armory is full: ${MAX_GEAR} pieces! Melt gear to pull again.` : 'Every pull also leaves a Saint\'s Fragment.', text.body(15, full ? PAL.amber : PAL.muted)).setOrigin(0.5, 0);
    y += 34;

    // The forge
    const frags = countOf(save, 'armory1');
    const moulds = countOf(save, 'armory3');
    const sparks = countOf(save, 'spark1');
    addPanel(this, PAD, y, bw, 132);
    this.add.text(PAD + 14, y + 12, 'THE FORGE', text.hud(13, PAL.steel));
    this.add.text(PAD + 14, y + 32, `Any Saint's Arms: ${FORGE_FRAGMENTS} Fragments or 1 Mould. A Godforged relic: ${GODSPARKS_TO_FORGE} Godsparks.`, { ...text.body(15, PAL.ivory), wordWrap: { width: bw - 28 } });
    progressBar(this, PAD + 14, y + 84, bw - 200, frags / FORGE_FRAGMENTS, PAL.amber, 10);
    this.add.text(PAD + 14, y + 98, `Fragments ${frags}/${FORGE_FRAGMENTS}${moulds ? `  ·  Moulds ${moulds}` : ''}  ·  Godsparks ${sparks}`, text.hud(12, PAL.amber));
    const canForge = !forgeBlock(save, 'fragments') || !forgeBlock(save, 'mould') || !forgeBlock(save, 'sparks');
    makeButton(this, GAME_W - PAD - 82, y + 92, 140, 48, 'Forge', () => this.showForge(), { active: canForge, fontSize: 16 });

    if (gifted) toast(this, `The Order arms you: ${FIRST_WRITS} Armory Writs!`);
    else if (this.notice) toast(this, this.notice);
  }

  private overlay(title: string) {
    const layer = this.add.container(0, 0).setDepth(30);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.95).setInteractive());
    layer.add(addFrame(this, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 }));
    layer.add(this.add.text(GAME_W / 2, 64, title, text.display(22, PAL.ivory)).setOrigin(0.5));
    return layer;
  }

  private pieceRow(layer: Phaser.GameObjects.Container, g: GearItem, y: number, h = 74) {
    const col = GRADE_COLOR[g.grade];
    const top = g.grade === 'arms' || g.grade === 'godforged';
    layer.add([
      this.add.rectangle(GAME_W / 2, y, GAME_W - 70, h, top ? 0x2c1a2a : 0x1b131d).setStrokeStyle(top ? 2 : 1, col),
      this.add.text(48, y - h / 2 + 8, gearName(g), { ...text.body(18, col), fontStyle: '600' }),
      this.add.text(48, y - h / 2 + 34, `${SLOT_NAME[g.slot]} · IP ${g.ip} · ${formatStat(g.main, mainValue(g))}${h > 60 && g.subs.length ? ' · ' + g.subs.map(lineText).join(' ') : ''}`, { ...text.body(14, PAL.ivory), wordWrap: { width: GAME_W - 110 } }),
    ]);
  }

  private showPulls(got: GearItem[]) {
    const layer = this.overlay(got.some((g) => g.grade === 'arms' || g.grade === 'godforged') ? 'A SAINT ANSWERS' : 'FROM THE ARMORY');
    const h = got.length > 1 ? 56 : 90;
    got.forEach((g, i) => this.pieceRow(layer, g, 120 + h / 2 + i * (h + 6), h));
    layer.add(this.add.text(GAME_W / 2, BTN_Y - 60, `+${got.length} Saint's Fragment${got.length > 1 ? 's' : ''}. Arm a Sister from her Gear tab.`, { ...text.body(15, PAL.muted), align: 'center', wordWrap: { width: GAME_W - 90 } }).setOrigin(0.5));
    layer.add(makeButton(this, GAME_W / 2, BTN_Y, 240, 60, 'Done', () => this.scene.restart(), { fontSize: 19, active: true }).all);
  }

  private showRates() {
    const { arms } = featuredArms();
    const layer = this.overlay('ARMORY RATES');
    const lines = [
      `Saint's Arms: ${pct(UR_RATE)} a pull. ${Math.round(FEATURED_SHARE * 100)}% of them are the featured piece (${arms.name} this week); the rest any of the ${SAINTS_ARMS.length}.`,
      `Sworn or Anathema: ${pct(SSR_RATE)}.  Consecrated or Sworn: ${pct(1 - UR_RATE - SSR_RATE)}. Armory pieces drop at IP 400 or your own, if higher.`,
      `A Saint's Arms is certain on the ${PITY}th pull since your last. The count never resets.`,
      `Saint's Arms: IP 800, a named power, three lines. Worn by a Sister of its Order, its power grows a quarter.`,
      `Godforged relics are never pulled or sold. Forge one with ${GODSPARKS_TO_FORGE} Godsparks, from Heresy IV bosses and melted twins.`,
      `Writs come from the Feast stall, the Shop, bonds at levels 15 and 25, the Inquisition and every 50th Bell Tower floor. Fragments from Crusade bosses, Tower boss floors, Relic Trials, the Inquisition, melted Anathema and Saint's Arms, and every pull here.`,
    ];
    const t = this.add.text(48, 110, lines.join('\n\n'), { ...text.body(16, PAL.ivory), wordWrap: { width: GAME_W - 96 } });
    layer.add(t);
    layer.add(makeButton(this, GAME_W / 2, BTN_Y, 240, 60, 'Close', () => layer.destroy(), { fontSize: 19 }).all);
  }

  private showForge(pickId: string = featuredArms().arms.id) {
    const save = game.save;
    const layer = this.overlay('THE FORGE');
    let y = 100;
    const all: UniqueDef[] = [...SAINTS_ARMS, ...GODFORGED];
    const pick = all.find((u) => u.id === pickId) ?? all[0];
    for (const u of all) {
      const on = u.id === pick.id;
      const b = makeButton(this, GAME_W / 2, y + 22, GAME_W - PAD * 2 - 20, 44, `${u.name} · ${SLOT_NAME[u.slot]}`, () => (layer.destroy(), this.showForge(u.id)), { active: on, fontSize: 15 });
      if (u.grade === 'godforged') b.text.setColor('#' + GRADE_COLOR.godforged.toString(16).padStart(6, '0'));
      layer.add(b.all);
      y += 50;
    }
    y += 8;
    const desc = this.add.text(PAD + 10, y, `${pick.name}: ${uniqueText(pick.id, uniqueValue(pick.id, 1, false))}\nSworn to the ${pick.order}.`, { ...text.body(16, GRADE_COLOR[pick.grade]), wordWrap: { width: GAME_W - PAD * 2 - 20 } });
    layer.add(desc);
    y += desc.height + 18;
    const forge = (pay: ForgePay) => {
      const g = forgeUnique(save, pick.id, pay);
      if (!g) return;
      sfx('forge');
      commit();
      layer.destroy();
      this.showPulls([g]);
    };
    const half = (GAME_W - PAD * 2 - 20 - 8) / 2;
    if (pick.grade === 'godforged') {
      const sb = forgeBlock(save, 'sparks');
      layer.add(makeButton(this, GAME_W / 2, y + 30, half * 1.4, 60, `Forge\n${countOf(save, 'spark1')}/${GODSPARKS_TO_FORGE} Godsparks`, () => forge('sparks'), { active: !sb, disabled: !!sb, fontSize: 15 }).all);
    } else {
      const fb = forgeBlock(save, 'fragments');
      const mb = forgeBlock(save, 'mould');
      layer.add(makeButton(this, PAD + 10 + half / 2, y + 30, half, 60, `Forge\n${countOf(save, 'armory1')}/${FORGE_FRAGMENTS} Fragments`, () => forge('fragments'), { active: !fb, disabled: !!fb, fontSize: 15 }).all);
      layer.add(makeButton(this, GAME_W - PAD - 10 - half / 2, y + 30, half, 60, `Forge\n${countOf(save, 'armory3')} Mould${countOf(save, 'armory3') === 1 ? '' : 's'}`, () => forge('mould'), { active: !mb, disabled: !!mb, fontSize: 15 }).all);
    }
    layer.add(makeButton(this, GAME_W / 2, BTN_Y, 240, 60, 'Back', () => layer.destroy(), { fontSize: 19 }).all);
  }
}
