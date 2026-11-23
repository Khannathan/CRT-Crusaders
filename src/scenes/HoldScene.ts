import Phaser from 'phaser';
import { GAME_W, HP_PARTY, PAL } from '../config';
import { CRUSADERS } from '../data/crusaders';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import { maxHpOf, type RunState } from '../systems/crusade';
import {
  BLESSINGS,
  HOLD_STANDS,
  HOLD_WAVES,
  beginStand,
  finishWave,
  holdCrypt,
  holdLeft,
  holdOf,
  standReward,
  takeBlessing,
  waveBattle,
  yieldStand,
  type WaveResult,
} from '../systems/holdLine';
import { itemDef, type ItemId } from '../systems/items';
import { makeButton } from '../ui/button';
import { modeScreen, toast } from '../ui/modeScreen';
import { pickParty } from '../ui/partyPicker';
import { portraitKey } from '../ui/placeholderPortrait';
import { PAD, addFrame, text } from '../ui/theme';

const rewardText = (held: number) => {
  const r = standReward(held);
  const items = (Object.entries(r.items) as [ItemId, number][]).filter(([, n]) => n > 0);
  const canon = items.map(([id, n]) => `${n} ${itemDef(id).name}`);
  return [r.tithes ? `${r.tithes} Tithes` : '', r.gilt ? `${r.gilt} Gilt` : '', ...canon].filter(Boolean).join(', ') || 'nothing';
};

/** Hold the Line: the day's stand, wave by wave, with a blessing between waves. */
export class HoldScene extends Phaser.Scene {
  private notice?: string;

  constructor() {
    super('Hold');
  }

  init(data: { notice?: string }) {
    this.notice = data?.notice;
  }

  create() {
    const save = game.save;
    const h = holdOf(save);
    const { top } = modeScreen(this, 'Hold the Line', 'Ten waves. Wounds carry. The fallen stay down.', 'Modes', 'bg-candle-maze');
    const bw = GAME_W - PAD * 2;
    const crypt = holdCrypt();
    this.add.text(PAD, top, `TODAY: ${crypt.name.toUpperCase()}`, text.hud(14, PAL.amber));
    this.add.text(GAME_W - PAD, top, `BEST ${h.best} / ${HOLD_WAVES}`, text.hud(14, h.best ? PAL.amber : PAL.steel)).setOrigin(1, 0);
    let y = top + 32;

    // Wave pips: held, next, ahead.
    const held = h.stand?.held ?? h.today;
    const pw = (bw - 9 * 6) / HOLD_WAVES;
    for (let i = 0; i < HOLD_WAVES; i++) {
      const done = i < held;
      const next = !!h.stand && i === held;
      const x = PAD + pw / 2 + i * (pw + 6);
      this.add.rectangle(x, y + 16, pw, 32, done ? 0x3a2a14 : 0x1b121c).setStrokeStyle(next ? 2 : 1, next ? PAL.amber : done ? PAL.bronze : PAL.armorShadow);
      this.add.text(x, y + 16, (i + 1) % 5 === 0 ? 'B' : String(i + 1), text.hud(13, done ? PAL.amber : next ? 0xfff1d6 : PAL.steel)).setOrigin(0.5);
    }
    this.add.text(PAD, y + 40, 'B = the crypt\'s boss. Every wave is harder than the last.', text.body(14, PAL.steel));
    y += 72;

    if (!h.stand) {
      const left = holdLeft(save);
      addFrame(this, GAME_W / 2, y + 120, bw, 240);
      const lines = [
        'Foes are set against your party\'s own Power: wave 1 is easy, wave 10 is three times your strength.',
        'Between waves, take one of three blessings.',
        `Rewards by waves held. All ten: ${rewardText(HOLD_WAVES)}.`,
      ];
      let ly = y + 18;
      for (const l of lines) {
        const t = this.add.text(PAD + 18, ly, l, { ...text.body(16, PAL.ivory), wordWrap: { width: bw - 36 } });
        ly += t.height + 10;
      }
      makeButton(this, GAME_W / 2, y + 200, bw - 60, 60, left ? 'Take your stand!' : 'Come back tomorrow', () => this.begin(), {
        active: left > 0,
        disabled: left <= 0,
        icon: 'blade',
      });
      this.add.text(GAME_W / 2, y + 256, `${left} of ${HOLD_STANDS} stand left today${h.today ? `  ·  held ${h.today} today` : ''}`, text.hud(12, PAL.steel)).setOrigin(0.5);
    } else {
      const st = h.stand;
      // The party, wounds and all.
      const run = { crypt, party: st.party, relics: [], hp: st.hp } as unknown as RunState;
      st.party.forEach((id, i) => {
        const c = CRUSADERS.find((x) => x.id === id)!;
        const rx = PAD + i * (bw / 4) + bw / 8;
        const max = maxHpOf(save, run, id);
        const hp = st.hp[id] ?? 0;
        const img = this.add.image(rx, y + 40, portraitKey(id)).setDisplaySize(76, 76);
        if (hp <= 0) img.setTint(0x555555).setAlpha(0.6);
        this.add.text(rx, y + 88, c.name.split(' ')[0].toUpperCase(), text.hud(12, hp > 0 ? 0xfff1d6 : PAL.steel)).setOrigin(0.5);
        this.add.rectangle(rx, y + 104, 80, 8, 0x000000);
        this.add.rectangle(rx - 40, y + 104, (80 * hp) / max, 6, HP_PARTY).setOrigin(0, 0.5);
        if (hp <= 0) this.add.text(rx, y + 40, 'FALLEN', text.hud(13, 0xff6a5a)).setOrigin(0.5);
      });
      y += 124;
      if (st.blessings.length) {
        const names = st.blessings.map((b) => BLESSINGS.find((x) => x.id === b)!.name).join(' · ');
        const t = this.add.text(PAD, y, `BLESSINGS: ${names.toUpperCase()}`, { ...text.hud(12, PAL.amber), wordWrap: { width: bw } });
        y += t.height + 12;
      }
      if (st.offer) {
        this.add.text(PAD, y, `WAVE ${st.held} HELD! TAKE A BLESSING`, text.hud(15, 0xfff1d6));
        y += 30;
        for (const id of st.offer) {
          const b = BLESSINGS.find((x) => x.id === id)!;
          addFrame(this, GAME_W / 2, y + 40, bw, 80);
          this.add.text(PAD + 18, y + 14, b.name.toUpperCase(), text.hud(15, PAL.amber));
          this.add.text(PAD + 18, y + 40, b.desc, { ...text.body(16, PAL.ivory), wordWrap: { width: bw - 150 } });
          makeButton(this, GAME_W - PAD - 62, y + 40, 100, 50, 'Take', () => {
            takeBlessing(save, id);
            commit();
            this.scene.restart({});
          }, { active: true, fontSize: 17 });
          y += 90;
        }
      } else {
        const n = st.held + 1;
        makeButton(this, GAME_W / 2, y + 36, bw - 60, 64, `Fight wave ${n}${n % 5 === 0 ? ': the boss' : ''}`, () => this.wave(), { active: true, icon: 'blade' });
        y += 82;
      }
      makeButton(this, GAME_W / 2, y + 30, bw - 60, 50, `Yield now: ${rewardText(st.held)}`, () => {
        const r = yieldStand(save);
        commit();
        this.scene.restart({ notice: r ? this.endText(r) : undefined });
      }, { fontSize: 15 });
    }
    if (this.notice) toast(this, this.notice);
  }

  private endText(r: WaveResult) {
    const head = r.held >= HOLD_WAVES ? 'The line held all ten waves!' : r.held ? `The line held ${r.held} wave${r.held === 1 ? '' : 's'}.` : 'The line broke at once.';
    return `${head}${r.newBest ? ' A new best!' : ''}\n${rewardText(r.held)}`;
  }

  private begin() {
    const save = game.save;
    pickParty(this, save, { title: 'Hold the Line', sub: 'Ten waves with this party. Choose well: no swaps.', initial: save.lastParty, confirm: 'Hold the line!' }, (party) => {
      if (!beginStand(save, party)) return;
      commit();
      this.wave();
    });
  }

  private wave() {
    const save = game.save;
    const st = holdOf(save).stand;
    if (!st) return;
    const n = st.held + 1;
    current.challenge = {
      label: `Hold the Line, wave ${n} of ${HOLD_WAVES}. They pour through the doors!`,
      make: (rng) => waveBattle(save, st, rng),
      finish: (outcome, battle) => {
        const r = finishWave(save, outcome, battle);
        commit();
        const notice = r.over ? this.endText(r) : `Wave ${r.held} held! Take a blessing.`;
        return { scene: 'Hold', data: { notice } };
      },
    };
    this.scene.start('Battle');
  }
}
