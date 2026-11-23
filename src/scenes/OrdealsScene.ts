import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { sfx } from '../audio/sfx';
import { ENCOUNTERS, ENEMIES } from '../data/enemies';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import {
  BRACKET,
  FALL,
  GRADES,
  LEAGUES,
  ORDEALS_PER_DAY,
  RISE,
  bracket,
  champions,
  claimLastWeek,
  finishOrdeal,
  ordealBattle,
  ordealsLeft,
  ordealsOf,
  weekEnds,
  type Champion,
} from '../systems/ordeals';
import { rewardText } from '../systems/tasks';
import { makeButton } from '../ui/button';
import { modeScreen, toast, untilText } from '../ui/modeScreen';
import { pickParty } from '../ui/partyPicker';
import { addScrollArea } from '../ui/scroll';
import { TAB_BAR_H } from '../ui/tabBar';
import { PAD, fitLine, text } from '../ui/theme';
import { fightMarks } from '../systems/pickMarks';
import { ordealBattle as ordealFight } from '../systems/ordeals';

const GRADE_COLOR = { easy: 0x8fb68a, even: 0xd9b45a, hard: 0xd0543a };

/** The Ordeals: this week's bracket of twenty, and three champions to face. */
export class OrdealsScene extends Phaser.Scene {
  private msg?: string;

  constructor() {
    super('Ordeals');
  }

  init(data: { msg?: string }) {
    this.msg = data?.msg;
  }

  create() {
    const save = game.save;
    const now = Date.now();
    const o = ordealsOf(save, now);
    const { rows, place } = bracket(save, now);
    const left = ordealsLeft(save, now);
    const { top, refresh } = modeScreen(this, 'The Ordeals', 'Twenty Orders. One week. Rise or be cast down!');
    const bw = GAME_W - PAD * 2;

    this.add.text(PAD, top, `${LEAGUES[o.league].toUpperCase()} LEAGUE`, text.hud(16, PAL.amber));
    this.add.text(GAME_W - PAD, top, `JUDGED IN ${untilText(weekEnds(now) - now).toUpperCase()}`, text.hud(12, PAL.steel)).setOrigin(1, 0);
    this.add.text(PAD, top + 26, `PLACE ${place}/${BRACKET} · ${o.points} POINTS`, text.hud(13, PAL.ivory));
    this.add.text(GAME_W - PAD, top + 26, `ORDEALS TODAY ${left}/${ORDEALS_PER_DAY}`, text.hud(13, left ? PAL.amber : PAL.steel)).setOrigin(1, 0);
    let y = top + 54;

    // Last week's judgement, until claimed.
    const last = o.last && !o.last.claimed ? o.last : undefined;
    if (last) {
      const moved = last.now > last.league ? `You rise to ${LEAGUES[last.now]}!` : last.now < last.league ? `You fall to ${LEAGUES[last.now]}.` : `You hold ${LEAGUES[last.now]}.`;
      this.add.rectangle(GAME_W / 2, y + 32, bw, 64, 0x2a1c24).setStrokeStyle(2, PAL.amber);
      this.add.text(PAD + 12, y + 10, `LAST WEEK: PLACE ${last.place} IN ${LEAGUES[last.league].toUpperCase()}`, text.hud(12, PAL.amber));
      fitLine(this.add.text(PAD + 12, y + 32, `${moved} ${rewardText(last.reward)}`, text.body(14, PAL.ivory)), bw - 150);
      makeButton(this, GAME_W - PAD - 64, y + 32, 112, 44, 'Claim', () => {
        const r = claimLastWeek(save, Date.now());
        if (!r) return;
        commit();
        sfx('sealRare', 1);
        refresh();
        this.scene.restart({ msg: `Glory! ${rewardText(r.reward)}` });
      }, { active: true, fontSize: 16 });
      y += 74;
    }

    // Three champions to face.
    this.add.text(PAD, y, 'CHOOSE YOUR FOE (SCALED TO THE PARTY YOU SEND)', text.hud(11, PAL.steel));
    y += 20;
    const h = 74;
    champions(save, now).forEach((c) => {
      const g = GRADES[c.grade];
      const col = GRADE_COLOR[c.grade];
      this.add.rectangle(GAME_W / 2, y + h / 2, bw, h, 0x1e1520).setStrokeStyle(1, col);
      this.add.rectangle(PAD + 3, y + h / 2, 6, h - 2, col);
      this.add.text(PAD + 16, y + 10, `${g.label.toUpperCase()} · WIN ${g.points}`, text.hud(13, col));
      fitLine(this.add.text(PAD + 16, y + 30, `${c.title} of ${c.rival.replace(/^The /, 'the ')}`, text.body(15, PAL.ivory)), bw - 150);
      fitLine(this.add.text(PAD + 16, y + 51, foesText(c), text.body(13, PAL.muted)), bw - 150);
      makeButton(this, GAME_W - PAD - 58, y + h / 2, 100, 48, 'Fight', () => this.fight(c), { active: left > 0 && c.grade === 'even', disabled: left <= 0, fontSize: 17 });
      y += h + 6;
    });

    // The bracket.
    y += 6;
    this.add.text(PAD, y, `TOP ${RISE} RISE · BOTTOM ${FALL} FALL · A LOSS STILL EARNS 2`, text.hud(11, PAL.steel));
    const listTop = y + 20;
    const list = addScrollArea(this, listTop, GAME_H - TAB_BAR_H - 6, { start: -Math.max(0, place - 6) * 30 });
    const add = <T extends Phaser.GameObjects.GameObject>(obj: T) => (list.content.add(obj), obj);
    let ry = listTop;
    rows.forEach((r, i) => {
      const n = i + 1;
      const zone = n <= RISE ? 0x8fb68a : n > BRACKET - FALL ? 0xd0543a : PAL.armorShadow;
      add(this.add.rectangle(GAME_W / 2, ry + 13, bw, 26, r.you ? 0x3a2228 : n % 2 ? 0x181118 : 0x140e15).setStrokeStyle(r.you ? 2 : 0, PAL.amber));
      add(this.add.rectangle(PAD + 2, ry + 13, 4, 26, zone));
      add(this.add.text(PAD + 14, ry + 13, `${n}`, text.hud(13, r.you ? PAL.amber : PAL.steel)).setOrigin(0, 0.5));
      add(fitLine(this.add.text(PAD + 48, ry + 13, r.name, text.body(15, r.you ? 0xfff1d6 : PAL.ivory)).setOrigin(0, 0.5), bw - 130));
      add(this.add.text(GAME_W - PAD - 10, ry + 13, `${r.points}`, text.hud(13, r.you ? PAL.amber : PAL.ivory)).setOrigin(1, 0.5));
      ry += 30;
    });
    list.fit(ry + 10);
    if (this.msg) toast(this, this.msg);
  }

  private fight(c: Champion) {
    const save = game.save;
    if (ordealsLeft(save) <= 0) return toast(this, 'No Ordeals left today. Return at dawn!');
    const g = GRADES[c.grade];
    pickParty(
      this,
      save,
      { title: `${g.label} Ordeal`, sub: `${c.title} of ${c.rival.replace(/^The /, 'the ')}. Their might rises to meet yours.`, initial: save.lastParty, confirm: 'Face the Ordeal!', marks: fightMarks(ordealFight(save, [], c)) },
      (party) => {
        current.challenge = {
          label: `The ${c.title} of ${c.rival.replace(/^The /, 'the ')} stands ready. Prove your Order!`,
          make: (rng) => ordealBattle(save, party, c, rng),
          finish: (outcome) => {
            const won = outcome === 'victory';
            const pts = finishOrdeal(save, c, won);
            const msg = won ? `Victory! +${pts} points for your Order!` : `Beaten, but not broken. +${pts} points.`;
            return { scene: 'Ordeals', data: { msg }, line: msg };
          },
        };
        this.scene.start('Battle');
      },
    );
  }
}

/** "Brings: The Drowned Choir and 3 more". */
function foesText(c: Champion) {
  const foes = ENCOUNTERS[c.encounter] ?? [];
  const lead = foes.map((f) => ENEMIES[f]).find((e) => e?.boss) ?? ENEMIES[foes[0]];
  return `Brings ${lead?.name ?? 'the faithless'}${foes.length > 1 ? ` and ${foes.length - 1} more` : ''}`;
}
