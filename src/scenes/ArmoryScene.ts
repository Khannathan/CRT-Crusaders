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
  featuredSet,
  forgeBlock,
  forgeUR,
  giftWrits,
  pullArmory,
  pullBlock,
  type PullPay,
} from '../systems/armory';
import { giltOf } from '../systems/currency';
import { GEAR_SETS, GEAR_SLOTS, MAX_GEAR, SLOT_HINT, SLOT_NAME, formatStat, gearOf, gearSet, mainValue, setText, type GearItem, type GearSetId, type GearSlot } from '../systems/gear';
import { countOf } from '../systems/items';
import { timeLeft } from '../systems/limited';
import { makeButton } from '../ui/button';
import { modeScreen, progressBar, toast } from '../ui/modeScreen';
import { TAB_BAR_H } from '../ui/tabBar';
import { PAD, addFrame, addPanel, text } from '../ui/theme';

// Overlay buttons sit above the tab bar, so a double tap on Done cannot fall through to a tab.
const BTN_Y = GAME_H - TAB_BAR_H - 46;
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

/** The Saints' Armory: the UR gear banner (weekly featured set) and the UR forge. */
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
    const { set, ends } = featuredSet();
    const { top } = modeScreen(this, "The Saints' Armory", '', this.back, 'bg-armory');
    const bw = GAME_W - PAD * 2;
    let y = top;

    // Featured set
    addPanel(this, PAD, y, bw, 150);
    this.add.rectangle(PAD + 6, y + 75, 6, 138, set.color);
    this.add.text(PAD + 20, y + 12, `FEATURED THIS WEEK · ENDS IN ${timeLeft(ends).toUpperCase()}`, text.hud(12, PAL.steel));
    this.add.text(PAD + 20, y + 32, `The ${set.name} Set`, text.display(24, set.color));
    this.add.text(PAD + 20, y + 72, setText(set), { ...text.body(17, PAL.ivory), wordWrap: { width: bw - 40 } });
    this.add.text(PAD + 20, y + 100, `Suits ${set.for}. ${Math.round(FEATURED_SHARE * 100)}% of UR pulls are this set.`, { ...text.body(15, PAL.muted), wordWrap: { width: bw - 40 } });
    y += 162;

    // Rates and pity
    this.add.text(PAD, y, `UR ${pct(UR_RATE)} · SSR ${pct(SSR_RATE)} · SR THE REST`, text.hud(13, PAL.amber));
    makeButton(this, GAME_W - PAD - 56, y + 8, 112, 34, 'Details', () => this.showRates(), { fontSize: 14, icon: 'book' });
    y += 32;
    const left = PITY - a.pity;
    this.add.text(PAD, y, `UR within ${left} pull${left === 1 ? '' : 's'}. Carries across weeks.`, text.body(15, PAL.ivory));
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
    addPanel(this, PAD, y, bw, 132);
    this.add.text(PAD + 14, y + 12, 'THE UR FORGE', text.hud(13, PAL.steel));
    this.add.text(PAD + 14, y + 32, `Any slot and set: ${FORGE_FRAGMENTS} Saint's Fragments or 1 Reliquary Mould.`, { ...text.body(15, PAL.ivory), wordWrap: { width: bw - 28 } });
    progressBar(this, PAD + 14, y + 84, bw - 200, frags / FORGE_FRAGMENTS, PAL.amber, 10);
    this.add.text(PAD + 14, y + 98, `Fragments ${frags}/${FORGE_FRAGMENTS}${moulds ? `  ·  Moulds ${moulds}` : ''}`, text.hud(12, PAL.amber));
    const canForge = !forgeBlock(save, 'fragments') || !forgeBlock(save, 'mould');
    makeButton(this, GAME_W - PAD - 82, y + 92, 140, 48, 'Forge a UR', () => this.showForge(), { active: canForge, fontSize: 16 });

    if (gifted) toast(this, `The Saints bless your first visit: ${FIRST_WRITS} Armory Writs!`);
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
    const set = gearSet(g.set);
    layer.add([
      this.add.rectangle(GAME_W / 2, y, GAME_W - 70, h, g.rarity === 'UR' ? 0x2c1a2a : 0x1b131d).setStrokeStyle(g.rarity === 'UR' ? 2 : 1, RARITY_COLOR[g.rarity]),
      this.add.text(48, y - h / 2 + 8, `${g.rarity} · ${g.name}`, { ...text.body(18, RARITY_COLOR[g.rarity]), fontStyle: '600' }),
      this.add.text(48, y - h / 2 + 34, `${SLOT_NAME[g.slot]} · ${formatStat(g.main, mainValue(g))}${g.subs.length ? ' · ' + g.subs.map((s) => formatStat(s.stat, s.value)).join(' ') : ''}`, text.body(14, PAL.ivory)),
    ]);
    if (set) layer.add(this.add.text(GAME_W - 48, y - h / 2 + 10, `${set.name.toUpperCase()} SET`, text.hud(11, set.color)).setOrigin(1, 0));
  }

  private showPulls(got: GearItem[]) {
    const layer = this.overlay(got.some((g) => g.rarity === 'UR') ? 'A SAINT ANSWERS' : 'FROM THE ARMORY');
    const h = got.length > 1 ? 56 : 90;
    got.forEach((g, i) => this.pieceRow(layer, g, 120 + h / 2 + i * (h + 6), h));
    layer.add(this.add.text(GAME_W / 2, BTN_Y - 60, `+${got.length} Saint's Fragment${got.length > 1 ? 's' : ''}. Arm a Sister from her Gear tab.`, { ...text.body(15, PAL.muted), align: 'center', wordWrap: { width: GAME_W - 90 } }).setOrigin(0.5));
    layer.add(makeButton(this, GAME_W / 2, BTN_Y, 240, 60, 'Done', () => this.scene.restart(), { fontSize: 19, active: true }).all);
  }

  private showRates() {
    const { set } = featuredSet();
    const layer = this.overlay('ARMORY RATES');
    const lines = [
      `UR: ${pct(UR_RATE)} a pull. ${Math.round(FEATURED_SHARE * 100)}% of URs are from the featured set (${set.name} this week); the rest from any of the ${GEAR_SETS.length} sets.`,
      `SSR: ${pct(SSR_RATE)}.  SR: ${pct(1 - UR_RATE - SSR_RATE)}. The Armory never gives R pieces.`,
      `A UR is certain on the ${PITY}th pull since your last. The count never resets.`,
      `UR pieces: double the main stat of an R, three substats, and the full +15 refine.`,
      `Writs come from the Feast stall, the Shop (Gilt and the Almonry), bonds at levels 15 and 25, the Inquisition and every 50th Bell Tower floor.`,
      `Fragments come from Crusade bosses, Bell Tower boss floors, Relic Trials tier 3 and up, the Inquisition, melting SSR and UR gear, and every pull here.`,
    ];
    const t = this.add.text(48, 110, lines.join('\n\n'), { ...text.body(17, PAL.ivory), wordWrap: { width: GAME_W - 96 } });
    layer.add(t);
    layer.add(makeButton(this, GAME_W / 2, BTN_Y, 240, 60, 'Close', () => layer.destroy(), { fontSize: 19 }).all);
  }

  private showForge(slot: GearSlot = 'blade', setId: GearSetId = featuredSet().set.id) {
    const save = game.save;
    const layer = this.overlay('THE UR FORGE');
    let y = 104;
    layer.add(this.add.text(PAD + 10, y, 'SLOT', text.hud(13, PAL.steel)));
    y += 22;
    const sw = (GAME_W - PAD * 2 - 20 - 4 * 6) / 5;
    GEAR_SLOTS.forEach((s, i) => {
      const b = makeButton(this, PAD + 10 + sw / 2 + i * (sw + 6), y + 24, sw, 46, SLOT_NAME[s], () => (layer.destroy(), this.showForge(s, setId)), { active: s === slot, fontSize: 14 });
      layer.add(b.all);
    });
    y += 56;
    layer.add(this.add.text(PAD + 10, y, `Main stat: ${SLOT_HINT[slot]}`, text.body(15, PAL.muted)));
    y += 34;
    layer.add(this.add.text(PAD + 10, y, 'SET', text.hud(13, PAL.steel)));
    y += 22;
    const cw = (GAME_W - PAD * 2 - 20 - 6) / 2;
    GEAR_SETS.forEach((st, i) => {
      const x = PAD + 10 + cw / 2 + (i % 2) * (cw + 6);
      const by = y + 22 + Math.floor(i / 2) * 52;
      const b = makeButton(this, x, by, cw, 46, st.name, () => (layer.destroy(), this.showForge(slot, st.id)), { active: st.id === setId, fontSize: 15 });
      layer.add(b.all);
    });
    y += 22 + 4 * 52;
    const set = gearSet(setId)!;
    const desc = this.add.text(PAD + 10, y, `${set.name}: ${setText(set)}\nSuits ${set.for}.`, { ...text.body(16, set.color), wordWrap: { width: GAME_W - PAD * 2 - 20 } });
    layer.add(desc);
    y += desc.height + 20;
    const forge = (pay: 'fragments' | 'mould') => {
      const g = forgeUR(save, slot, setId, pay);
      if (!g) return;
      commit();
      layer.destroy();
      this.showPulls([g]);
    };
    const fb = forgeBlock(save, 'fragments');
    const mb = forgeBlock(save, 'mould');
    const half = (GAME_W - PAD * 2 - 20 - 8) / 2;
    layer.add(makeButton(this, PAD + 10 + half / 2, y + 30, half, 60, `Forge\n${countOf(save, 'armory1')}/${FORGE_FRAGMENTS} Fragments`, () => forge('fragments'), { active: !fb, disabled: !!fb, fontSize: 15 }).all);
    layer.add(makeButton(this, GAME_W - PAD - 10 - half / 2, y + 30, half, 60, `Forge\n${countOf(save, 'armory3')} Mould${countOf(save, 'armory3') === 1 ? '' : 's'}`, () => forge('mould'), { active: !mb, disabled: !!mb, fontSize: 15 }).all);
    layer.add(makeButton(this, GAME_W / 2, BTN_Y, 240, 60, 'Back', () => layer.destroy(), { fontSize: 19 }).all);
  }
}
