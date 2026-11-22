import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { HOUNDS, houndDef, type HoundDef } from '../data/hounds';
import { commit, game } from '../state/game';
import {
  HOUND_MAX,
  HOUND_PITY,
  HOUND_RATES,
  WHISTLE_GILT,
  freeWhistle,
  howlAt,
  howlParts,
  houndsOf,
  setHound,
  whistle,
  whistleBlock,
  type WhistleResult,
} from '../systems/hounds';
import { makeButton } from '../ui/button';
import { houndFace } from '../ui/hound';
import { modeScreen, toast } from '../ui/modeScreen';
import { addScrollArea } from '../ui/scroll';
import { TAB_BAR_H } from '../ui/tabBar';
import { PAD, text } from '../ui/theme';

/** The Kennel: whistle for hounds, and choose the one that goes into battle. */
export class KennelScene extends Phaser.Scene {
  static listY = 0;

  constructor() {
    super('Kennel');
  }

  create() {
    const save = game.save;
    const s = houndsOf(save);
    const { top, refresh } = modeScreen(this, 'Kennel', 'The Church\'s war-dogs. One hound goes into every fight and howls at the start of each round.');
    const bw = GAME_W - PAD * 2;
    const list = addScrollArea(this, top - 4, GAME_H - TAB_BAR_H, { start: KennelScene.listY, onScroll: (y) => (KennelScene.listY = y) });
    const before = this.children.list.length;
    let y = top + 4;

    // The hound with you.
    const def = s.active ? houndDef(s.active) : undefined;
    const ch = 150;
    this.add.rectangle(GAME_W / 2, y + ch / 2, bw, ch, 0x1e1520).setStrokeStyle(2, def ? RARITY_COLOR[def.rarity] : PAL.armorShadow);
    this.add.text(PAD + 12, y + 10, 'GOES INTO BATTLE', text.hud(12, PAL.steel));
    if (def) {
      const lv = s.owned[def.id].level;
      houndFace(this, PAD + 70, y + 86, def, 100);
      this.add.text(PAD + 136, y + 30, def.name, text.display(20, 0xfff1d6));
      this.add.text(GAME_W - PAD - 12, y + 12, `${def.rarity}  LV ${lv}/${HOUND_MAX}`, text.hud(13, RARITY_COLOR[def.rarity])).setOrigin(1, 0);
      this.add.text(PAD + 136, y + 60, `${def.howlName}, every round:`, text.body(15, PAL.amber));
      this.add.text(PAD + 136, y + 82, howlParts(howlAt(def, lv)).map((p) => `• ${p}`).join('\n'), { ...text.body(15, PAL.ivory), wordWrap: { width: bw - 150 } });
    } else this.add.text(PAD + 16, y + 60, 'No hound goes with your Sisters. Tap one below.', text.body(16, PAL.muted));
    y += ch + 14;

    // The whistle.
    const free = freeWhistle(save);
    const block = whistleBlock(save);
    const btn = makeButton(this, GAME_W / 2, y + 30, 300, 58, free ? 'Whistle (free today)' : `Whistle · ${WHISTLE_GILT} Gilt`, () => {}, { active: !block, disabled: !!block, fontSize: 18 });
    btn.box.removeAllListeners('pointerup');
    list.tap(btn.box, () => this.blow());
    y += 66;
    const rates = (['R', 'SR', 'SSR', 'UR'] as const).map((r) => `${r} ${Math.round(HOUND_RATES[r] * 100)}%`).join('  ·  ');
    this.add.text(GAME_W / 2, y, `${rates}\nAn SSR or UR hound within ${HOUND_PITY - (s.pity ?? 0)} whistles. A hound you have grows a level (to ${HOUND_MAX}), each 10% stronger.`, { ...text.body(14, PAL.muted), align: 'center', wordWrap: { width: bw - 20 } }).setOrigin(0.5, 0);
    y += 64;

    // Every hound: tap one you have to bring it.
    this.add.text(PAD, y, `HOUNDS  ${Object.keys(s.owned).length}/${HOUNDS.length}`, text.hud(14, PAL.steel));
    this.add.text(GAME_W - PAD, y, 'TAP TO BRING', text.hud(11, PAL.muted)).setOrigin(1, 0);
    y += 26;
    const cols = 3;
    const cw = bw / cols;
    const rh = 190;
    [...HOUNDS].reverse().forEach((h, i) => {
      const x = PAD + cw * (i % cols) + cw / 2;
      const cy = y + Math.floor(i / cols) * rh;
      const own = s.owned[h.id];
      const on = s.active === h.id;
      const box = this.add.rectangle(x, cy + rh / 2 - 6, cw - 10, rh - 12, on ? 0x2e2026 : 0x1a1219).setStrokeStyle(on ? 3 : 1, on ? PAL.amber : own ? RARITY_COLOR[h.rarity] : PAL.armorShadow);
      houndFace(this, x, cy + 58, h, 92, !own);
      this.add.text(x, cy + 112, own ? h.name : '???', { ...text.body(15, own ? PAL.ivory : PAL.steel), align: 'center', wordWrap: { width: cw - 20 } }).setOrigin(0.5, 0);
      this.add.text(x, cy + 150, own ? `${h.rarity}  LV ${own.level}` : h.rarity, text.hud(12, own ? RARITY_COLOR[h.rarity] : PAL.steel)).setOrigin(0.5, 0);
      if (on) this.add.text(x, cy + 172, 'WITH YOU', text.hud(10, PAL.amber)).setOrigin(0.5, 0);
      list.tap(box, () => {
        if (!own) return toast(this, `${h.rarity} hound. ${h.howlName}: ${howlParts(h.howl).join('; ')}.`);
        setHound(save, h.id);
        commit();
        this.scene.restart();
      });
    });
    y += Math.ceil(HOUNDS.length / cols) * rh;

    list.content.add(this.children.list.slice(before));
    list.fit(y + 10);
    refresh();
  }

  private blow() {
    const r = whistle(game.save);
    if (!r) return toast(this, whistleBlock(game.save) ?? 'Not now.');
    commit();
    this.reveal(r);
  }

  /** The hound that answered the whistle. */
  private reveal(r: WhistleResult) {
    const h: HoundDef = r.hound;
    const layer = this.add.container(0, 0).setDepth(60);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.92).setInteractive());
    const glow = this.add.circle(GAME_W / 2, GAME_H / 2 - 120, 150, RARITY_COLOR[h.rarity], 0.18);
    layer.add(glow);
    this.tweens.add({ targets: glow, scale: 1.15, alpha: 0.3, yoyo: true, repeat: -1, duration: 900 });
    const [f, img] = houndFace(this, GAME_W / 2, GAME_H / 2 - 120, h, 200);
    layer.add([f, img]);
    img.setScale(img.scaleX * 0.2);
    this.tweens.add({ targets: img, scale: img.scaleX * 5, duration: 380, ease: 'Back.Out' });
    const head = r.isNew ? 'NEW HOUND' : r.alms ? `+${r.alms} ALMS` : `LEVEL ${r.level}`;
    layer.add(this.add.text(GAME_W / 2, GAME_H / 2 + 20, head, text.hud(18, r.isNew ? PAL.amber : PAL.ivory)).setOrigin(0.5));
    layer.add(this.add.text(GAME_W / 2, GAME_H / 2 + 50, h.name, text.display(26, RARITY_COLOR[h.rarity])).setOrigin(0.5));
    layer.add(this.add.text(GAME_W / 2, GAME_H / 2 + 84, h.rarity, text.hud(15, RARITY_COLOR[h.rarity])).setOrigin(0.5));
    const lv = houndsOf(game.save).owned[h.id].level;
    const sub = r.alms ? `${h.name} is already at its last level. The kennel-master pays Alms for the pup.` : `${h.howlName}: ${howlParts(howlAt(h, lv)).join('; ')}.`;
    layer.add(this.add.text(GAME_W / 2, GAME_H / 2 + 112, sub, { ...text.body(17, PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 90 } }).setOrigin(0.5, 0));
    layer.add(this.add.text(GAME_W / 2, GAME_H / 2 + 190, `"${h.flavor}"`, { ...text.body(15, PAL.muted), fontStyle: 'italic', align: 'center', wordWrap: { width: GAME_W - 110 } }).setOrigin(0.5, 0));
    const close = () => this.scene.restart();
    const ok = makeButton(this, GAME_W / 2 - 110, GAME_H - 200, 190, 56, 'Kennel', close, { fontSize: 18 });
    const bring = makeButton(this, GAME_W / 2 + 110, GAME_H - 200, 190, 56, 'Bring it', () => {
      setHound(game.save, h.id);
      commit();
      close();
    }, { active: true, fontSize: 18 });
    layer.add([...ok.all, ...bring.all]);
  }
}
